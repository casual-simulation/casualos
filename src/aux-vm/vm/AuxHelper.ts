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
    addToContextDiff,
    fileAdded,
    getFilePosition,
    getContexts,
    filterWellKnownAndContextTags,
    tagsOnFile,
} from '@casual-simulation/aux-common';
import {
    storedTree,
    StoredCausalTree,
    RemoteEvent,
    DeviceEvent,
} from '@casual-simulation/causal-trees';
import { Subject, Observable } from 'rxjs';
import { flatMap, fromPairs, union, sortBy } from 'lodash';
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
    private _remoteEvents: Subject<RemoteEvent[]>;
    private _deviceEvents: Subject<DeviceEvent[]>;
    private _sandboxFactory: SandboxFactory;

    /**
     * Creates a new file helper.
     * @param tree The tree that the file helper should use.
     */
    constructor(
        tree: AuxCausalTree,
        config?: FormulaLibraryOptions['config'],
        sandboxFactory?: (lib: SandboxLibrary) => Sandbox
    ) {
        super();
        this._localEvents = new Subject<LocalEvents[]>();
        this._remoteEvents = new Subject<RemoteEvent[]>();
        this._deviceEvents = new Subject<DeviceEvent[]>();
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

    get remoteEvents() {
        return this._remoteEvents;
    }

    get deviceEvents() {
        return this._deviceEvents;
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
        this._sendOtherEvents(allEvents);
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
        updateFile(file, this.userFile ? this.userFile.id : null, newData, () =>
            this.createContext()
        );

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
            calculateFormulaEvents(
                state,
                f,
                this.userId,
                undefined,
                this._sandboxFactory,
                this._lib
            )
        );
        await this.transaction(...events);
    }

    search(search: string) {
        return searchFileState(
            search,
            this.filesState,
            this.userId,
            this._lib,
            this._sandboxFactory
        );
    }

    getTags(): string[] {
        let objects = getActiveObjects(this.filesState);
        let allTags = union(...objects.map(o => tagsOnFile(o)));
        let sorted = sortBy(allTags, t => t);
        return sorted;
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
                const result = calculateActionEvents(
                    this.filesState,
                    event,
                    this._sandboxFactory,
                    this._lib
                );
                resultEvents.push(...this._flattenEvents(result.events));
            } else if (event.type === 'file_updated') {
                const file = this.filesState[event.id];
                updateFile(file, this.userFile.id, event.update, () =>
                    this.createContext()
                );
                resultEvents.push(event);
            } else if (event.type === 'paste_state') {
                resultEvents.push(...this._pasteState(event));
            } else {
                resultEvents.push(event);
            }
        }

        return resultEvents;
    }

    private _sendOtherEvents(events: FileEvent[]) {
        let remoteEvents: RemoteEvent[] = [];
        let localEvents: LocalEvents[] = [];
        let deviceEvents: DeviceEvent[] = [];

        for (let event of events) {
            if (event.type === 'local') {
                localEvents.push(<LocalEvents>event);
            } else if (event.type === 'remote') {
                remoteEvents.push(event);
            } else if (event.type === 'device') {
                deviceEvents.push(event);
            }
        }

        if (localEvents.length > 0) {
            this._localEvents.next(localEvents);
        }
        if (remoteEvents.length > 0) {
            this._remoteEvents.next(remoteEvents);
        }
        if (deviceEvents.length > 0) {
            this._deviceEvents.next(deviceEvents);
        }
    }

    private _pasteState(event: PasteStateEvent) {
        // TODO: Cleanup this function to make it easier to understand
        const value = event.state;
        const fileIds = Object.keys(value);
        let state: FilesState = {};
        const oldFiles = fileIds.map(id => value[id]);
        const oldCalc = createCalculationContext(
            oldFiles,
            this.userId,
            this._lib,
            this._sandboxFactory
        );
        const newCalc = this.createContext();

        if (event.options.context) {
            return this._pasteExistingWorksurface(
                oldFiles,
                oldCalc,
                event,
                newCalc
            );
        } else {
            return this._pasteNewWorksurface(oldFiles, oldCalc, event, newCalc);
        }
    }

    private _pasteExistingWorksurface(
        oldFiles: File[],
        oldCalc: FileSandboxContext,
        event: PasteStateEvent,
        newCalc: FileSandboxContext
    ) {
        let events: FileEvent[] = [];

        // Preserve positions from old context
        for (let oldFile of oldFiles) {
            const tags = tagsOnFile(oldFile);
            const tagsToRemove = filterWellKnownAndContextTags(newCalc, tags);
            const removedValues = tagsToRemove.map(t => [t, null]);
            let newFile = duplicateFile(oldCalc, oldFile, {
                tags: {
                    ...fromPairs(removedValues),
                    ...addToContextDiff(
                        newCalc,
                        event.options.context,
                        event.options.x,
                        event.options.y
                    ),
                    [`${event.options.context}.z`]: event.options.z,
                },
            });
            events.push(fileAdded(cleanFile(newFile)));
        }

        return events;
    }

    private _pasteNewWorksurface(
        oldFiles: File[],
        oldCalc: FileSandboxContext,
        event: PasteStateEvent,
        newCalc: FileSandboxContext
    ) {
        const oldContextFiles = oldFiles.filter(
            f => getFileConfigContexts(oldCalc, f).length > 0
        );
        const oldContextFile =
            oldContextFiles.length > 0 ? oldContextFiles[0] : null;
        const oldContexts = oldContextFile
            ? getFileConfigContexts(oldCalc, oldContextFile)
            : [];
        let oldContext = oldContexts.length > 0 ? oldContexts[0] : null;
        let events: FileEvent[] = [];
        const context = createContextId();
        let workspace: File;
        if (oldContextFile) {
            workspace = duplicateFile(oldCalc, oldContextFile, {
                tags: {
                    'aux.context': context,
                },
            });
        } else {
            workspace = createWorkspace(undefined, context);
        }
        workspace.tags['aux.context.x'] = event.options.x;
        workspace.tags['aux.context.y'] = event.options.y;
        workspace.tags['aux.context.z'] = event.options.z;
        events.push(fileAdded(workspace));
        if (!oldContext) {
            oldContext = context;
        }

        // Preserve positions from old context
        for (let oldFile of oldFiles) {
            if (oldContextFile && oldFile.id === oldContextFile.id) {
                continue;
            }
            const tags = tagsOnFile(oldFile);
            const tagsToRemove = filterWellKnownAndContextTags(newCalc, tags);
            const removedValues = tagsToRemove.map(t => [t, null]);
            let newFile = duplicateFile(oldCalc, oldFile, {
                tags: {
                    ...fromPairs(removedValues),
                    ...addToContextDiff(
                        newCalc,
                        context,
                        oldFile.tags[`${oldContext}.x`],
                        oldFile.tags[`${oldContext}.y`],
                        oldFile.tags[`${oldContext}.sortOrder`]
                    ),
                    [`${context}.z`]: oldFile.tags[`${oldContext}.z`],
                },
            });
            events.push(fileAdded(cleanFile(newFile)));
        }
        return events;
    }
}
