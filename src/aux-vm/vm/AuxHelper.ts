import {
    AuxCausalTree,
    SandboxLibrary,
    LocalEvents,
    FilesState,
    getActiveObjects,
    createCalculationContext,
    FileCalculationContext,
    AuxFile,
    FileEvent,
    createFile,
    File,
    updateFile,
    PartialFile,
    merge,
    AUX_FILE_VERSION,
    calculateFormulaEvents,
    calculateActionEvents,
    FileSandboxContext,
    DEFAULT_USER_MODE,
    PasteStateEvent,
    getFileConfigContexts,
    createWorkspace,
    createContextId,
    duplicateFile,
    cleanFile,
    addState,
    Sandbox,
    SandboxFactory,
    searchFileState,
    AuxOp,
    createFormulaLibrary,
    FormulaLibraryOptions,
} from '@casual-simulation/aux-common';
import { storedTree, StoredCausalTree } from '@casual-simulation/causal-trees';
import formulaLib from '@casual-simulation/aux-common/Formulas/formula-lib';
import { Subject, Observable } from 'rxjs';
import { flatMap, sortBy } from 'lodash';
import { BaseHelper } from '../managers/BaseHelper';
import { AuxUser } from '../AuxUser';

/**
 * Definesa a class that contains a set of functions to help an AuxChannel
 * run formulas and process file events.
 */
export class AuxHelper extends BaseHelper<AuxFile> {
    private static readonly _debug = false;
    private _tree: AuxCausalTree;
    private _lib: SandboxLibrary;
    private _localEvents: Subject<LocalEvents[]>;
    private _sandboxFactory: SandboxFactory;

    /**
     * Creates a new file helper.
     * @param tree The tree that the file helper should use.
     * @param userFileId The ID of the user's file.
     */
    constructor(
        tree: AuxCausalTree,
        userFileId: string,
        config: FormulaLibraryOptions['config'],
        sandboxFactory?: (lib: SandboxLibrary) => Sandbox
    ) {
        super(userFileId);
        this._localEvents = new Subject<LocalEvents[]>();
        this._sandboxFactory = sandboxFactory;

        this._tree = tree;
        this._lib = createFormulaLibrary({ config });
    }

    /**
     * Gets the current local file state.
     */
    get filesState() {
        return this._tree.value;
    }

    get localEvents() {
        return this._localEvents;
    }

    /**
     * Creates a new FileCalculationContext from the current state.
     */
    createContext(): FileSandboxContext {
        return createCalculationContext(
            this.objects,
            this.userId,
            this._lib,
            this._sandboxFactory
        );
    }

    /**
     * Adds the given events in a transaction.
     * That is, they should be performed in a batch.
     * @param events The events to run.
     */
    async transaction(...events: FileEvent[]): Promise<void> {
        const allEvents = this._flattenEvents(events);
        await this._tree.addEvents(allEvents);
        this._sendLocalEvents(allEvents);
    }

    /**
     * Creates a new file with the given ID and tags. Returns the ID of the new file.
     * @param id (Optional) The ID that the file should have.
     * @param tags (Optional) The tags that the file should have.
     */
    async createFile(id?: string, tags?: File['tags']): Promise<string> {
        if (AuxHelper._debug) {
            console.log('[FileManager] Create File');
        }

        const file = createFile(id, tags);
        await this._tree.addFile(file);

        return file.id;
    }

    /**
     * Updates the given file with the given data.
     * @param file The file.
     * @param newData The new data that the file should have.
     */
    async updateFile(file: AuxFile, newData: PartialFile): Promise<void> {
        updateFile(file, this.userFile.id, newData, () => this.createContext());

        await this._tree.updateFile(file, newData);
    }

    /**
     * Creates a new globals file.
     * @param fileId The ID of the file to create. If not specified a new ID will be generated.
     */
    async createGlobalsFile(fileId?: string) {
        const workspace = createFile(fileId, {});

        const final = merge(workspace, {
            tags: {
                'aux.version': AUX_FILE_VERSION,
                'aux.destroyable': false,
            },
        });

        await this._tree.addFile(final);
    }

    /**
     * Creates or updates the user file for the given user.
     * @param user The user that the file is for.
     * @param userFile The file to update. If null or undefined then a file will be created.
     */
    async createOrUpdateUserFile(user: AuxUser, userFile: AuxFile) {
        const userContext = `_user_${user.username}_${this._tree.site.id}`;
        const userInventoryContext = `_user_${user.username}_inventory`;
        const userMenuContext = `_user_${user.username}_menu`;
        const userSimulationsContext = `_user_${user.username}_simulations`;
        if (!userFile) {
            await this.createFile(user.id, {
                [userContext]: true,
                ['aux.context']: userContext,
                ['aux.context.visualize']: true,
                ['aux._user']: user.username,
                ['aux._userInventoryContext']: userInventoryContext,
                ['aux._userMenuContext']: userMenuContext,
                ['aux._userSimulationsContext']: userSimulationsContext,
                'aux._mode': DEFAULT_USER_MODE,
            });
        } else {
            if (!userFile.tags['aux._userMenuContext']) {
                await this.updateFile(userFile, {
                    tags: {
                        ['aux._userMenuContext']: userMenuContext,
                    },
                });
            }
            if (!userFile.tags['aux._userInventoryContext']) {
                await this.updateFile(userFile, {
                    tags: {
                        ['aux._userInventoryContext']: userInventoryContext,
                    },
                });
            }
            if (!userFile.tags['aux._userSimulationsContext']) {
                await this.updateFile(userFile, {
                    tags: {
                        ['aux._userSimulationsContext']: userSimulationsContext,
                    },
                });
            }
        }
    }

    async formulaBatch(formulas: string[]): Promise<void> {
        const state = this.filesState;
        let events = flatMap(formulas, f =>
            calculateFormulaEvents(state, f, this.userId)
        );
        await this.transaction(...events);
    }

    search(search: string) {
        return searchFileState(
            search,
            this.filesState,
            undefined,
            this._sandboxFactory
        );
    }

    exportFiles(fileIds: string[]): StoredCausalTree<AuxOp> {
        const files = fileIds.map(id => this.filesState[id]);
        const atoms = files.map(f => f.metadata.ref);
        const weave = this._tree.weave.subweave(...atoms);
        const stored = storedTree(
            this._tree.site,
            this._tree.knownSites,
            weave.atoms
        );
        return stored;
    }

    private _flattenEvents(events: FileEvent[]): FileEvent[] {
        let resultEvents: FileEvent[] = [];
        for (let event of events) {
            if (event.type === 'action') {
                const result = calculateActionEvents(this.filesState, event);
                resultEvents.push(...this._flattenEvents(result.events));
            } else if (event.type === 'file_updated') {
                const file = this.filesState[event.id];
                updateFile(file, this.userFile.id, event.update, () =>
                    this.createContext()
                );
                resultEvents.push(event);
            } else if (event.type === 'paste_state') {
                resultEvents.push(this._pasteState(event));
            } else {
                resultEvents.push(event);
            }
        }

        return resultEvents;
    }

    private _sendLocalEvents(events: FileEvent[]) {
        this._localEvents.next(<LocalEvents[]>(
            events.filter(e => e.type === 'local')
        ));
    }

    private _pasteState(event: PasteStateEvent) {
        // TODO: Cleanup this function to make it easier to understand
        const value = event.state;
        const fileIds = Object.keys(value);
        let state: FilesState = {};
        const oldFiles = fileIds.map(id => value[id]);
        const calc = createCalculationContext(
            oldFiles,
            this.userId,
            this._lib,
            this._sandboxFactory
        );

        // Grab the old worksurface
        // and map everything into a new context
        // where they keep their relative positions
        const oldWorksurface =
            oldFiles.find(f => getFileConfigContexts(calc, f).length > 0) ||
            createWorkspace();
        const oldContexts = getFileConfigContexts(calc, oldWorksurface);
        const contextMap: Map<string, string> = new Map();
        let newContexts: string[] = [];
        oldContexts.forEach(c => {
            const context = createContextId();
            newContexts.push(context);
            contextMap.set(c, context);
        });
        let worksurface = duplicateFile(calc, oldWorksurface);
        oldContexts.forEach(c => {
            let newContext = contextMap.get(c);
            worksurface.tags[c] = null;
            worksurface.tags['aux.context'] = newContext;
            worksurface.tags['aux.context.visualize'] = 'surface';
            worksurface.tags[newContext] = true;
        });
        worksurface = cleanFile(worksurface);
        worksurface.tags['aux.context.x'] = event.x;
        worksurface.tags['aux.context.y'] = event.z;
        worksurface.tags['aux.context.z'] = event.y;
        state[worksurface.id] = worksurface;
        for (let i = 0; i < fileIds.length; i++) {
            const file = value[fileIds[i]];
            if (file.id === oldWorksurface.id) {
                continue;
            }
            let newFile = duplicateFile(calc, file);
            oldContexts.forEach(c => {
                let newContext = contextMap.get(c);
                newFile.tags[c] = null;
                let x = file.tags[`${c}.x`];
                let y = file.tags[`${c}.y`];
                let z = file.tags[`${c}.z`];
                let index = file.tags[`${c}.index`];
                newFile.tags[`${c}.x`] = null;
                newFile.tags[`${c}.y`] = null;
                newFile.tags[`${c}.z`] = null;
                newFile.tags[`${c}.index`] = null;
                newFile.tags[newContext] = true;
                newFile.tags[`${newContext}.x`] = x;
                newFile.tags[`${newContext}.y`] = y;
                newFile.tags[`${newContext}.z`] = z;
                newFile.tags[`${newContext}.index`] = index;
            });
            state[newFile.id] = cleanFile(newFile);
        }

        return addState(state);
    }
}
