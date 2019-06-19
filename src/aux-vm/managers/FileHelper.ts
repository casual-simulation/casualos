import {
    AuxFile,
    PartialFile,
    File,
    FileEvent,
    FilesState,
    AuxCausalTree,
    AuxObject,
    updateFile,
    FileCalculationContext,
    createCalculationContext,
    getActiveObjects,
    createFile,
    createWorkspace,
    createContextId,
    action,
    calculateActionEvents,
    addState,
    Workspace,
    calculateFormattedFileValue,
    calculateFileValue,
    SandboxLibrary,
    LocalEvent,
    LocalEvents,
    filesInContext,
    getFileChannel,
    calculateDestroyFileEvents,
    merge,
    calculateFormulaEvents,
    PrecalculatedFile,
    PrecalculatedFilesState,
    fileAdded,
} from '@casual-simulation/aux-common';
import { Subject, Observable } from 'rxjs';
import { flatMap, sortBy } from 'lodash';
import { BaseHelper } from './BaseHelper';
import { AuxVM } from '../vm';

/**
 * Defines an class that contains a simple set of functions
 * that help manipulate files.
 */
export class FileHelper extends BaseHelper<PrecalculatedFile> {
    private static readonly _debug = false;
    private _vm: AuxVM;
    private _localEvents: Subject<LocalEvents>;
    private _state: PrecalculatedFilesState;

    /**
     * Creates a new file helper.
     * @param tree The tree that the file helper should use.
     * @param userFileId The ID of the user's file.
     */
    constructor(userFileId: string) {
        super(userFileId);
        this._localEvents = new Subject<LocalEvents>();
    }

    /**
     * Gets the current local file state.
     */
    get filesState() {
        return this._state;
    }

    /**
     * Gets the observable list of local events that have been processed by this file helper.
     */
    get localEvents(): Observable<LocalEvents> {
        return this._localEvents;
    }

    /**
     * Updates the given file with the given data.
     * @param file The file.
     * @param newData The new data that the file should have.
     */
    async updateFile(
        file: PrecalculatedFile,
        newData: PartialFile
    ): Promise<void> {
        await this._vm.updateFile(file.id, newData);
    }

    /**
     * Creates a new file with the given ID and tags. Returns the ID of the new file.
     * @param id (Optional) The ID that the file should have.
     * @param tags (Optional) The tags that the file should have.
     */
    async createFile(id?: string, tags?: File['tags']): Promise<string> {
        if (FileHelper._debug) {
            console.log('[FileManager] Create File');
        }

        const file = createFile(id, tags);

        await this._vm.sendEvents([fileAdded(file)]);

        return file.id;
    }

    /**
     * Creates a new workspace file.
     * @param fileId The ID of the file to create. If not specified a new ID will be generated.
     * @param builderContextId The ID of the context to create for the file. If not specified a new context ID will be generated.
     * @param locked Whether the context should be accessible in AUX Player.
     */
    async createWorkspace(
        fileId?: string,
        builderContextId?: string,
        locked?: boolean,
        x?: number,
        y?: number
    ): Promise<AuxObject> {
        if (FileHelper._debug) {
            console.log('[FileManager] Create Workspace');
        }

        const workspace: Workspace = createWorkspace(
            fileId,
            builderContextId,
            locked
        );

        const updated = merge(workspace, {
            tags: {
                'aux.context.x': x || 0,
                'aux.context.y': y || 0,
            },
        });

        await this._vm.sendEvents([fileAdded(updated)]);
        // await this._tree.addFile(updated);

        return this.filesState[workspace.id];
    }

    /**
     * Creates a new file for the current user that loads the simulation with the given ID.
     * @param id The ID of the simulation to load.
     * @param fileId The ID of the file to create.
     */
    async createSimulation(id: string, fileId?: string) {
        const simFiles = this.getSimulationFiles(id);

        if (simFiles.length === 0) {
            await this.createFile(fileId, {
                [this.userFile.tags['aux._userSimulationsContext']]: true,
                ['aux.channel']: id,
            });
        }
    }

    /**
     * Gets the list of files that are loading the simulation with the given ID.
     * @param id The ID of the simulation.
     */
    getSimulationFiles(id: string) {
        const simFiles = this._getSimulationFiles(id);
        return simFiles;
    }

    /**
     * Deletes all the files in the current user's simulation context that load the given simulation ID.
     * @param id The ID of the simulation to load.
     */
    async destroySimulations(id: string) {
        const simFiles = this._getSimulationFiles(calc, id);

        const events = flatMap(simFiles, f =>
            calculateDestroyFileEvents(calc, f)
        );

        await this.transaction(...events);
    }

    /**
     * Deletes the given file.
     * @param file The file to delete.
     */
    async destroyFile(file: AuxObject) {
        const calc = this.createContext();
        const events = calculateDestroyFileEvents(calc, file);
        await this.transaction(...events);
    }

    /**
     * Calculates the list of file events for the given event running on the given files.
     * @param eventName The name of the event to run.
     * @param files The files that should be searched for handlers for the event.
     * @param arg The argument that should be passed to the event handlers.
     */
    actionEvents(eventName: string, files: File[], arg?: any) {
        if (FileHelper._debug) {
            console.log(
                '[FileManager] Run event:',
                eventName,
                'on files:',
                files
            );
        }

        // Calculate the events on a single client and then run them in a transaction to make sure the order is right.
        const fileIds = files ? files.map(f => f.id) : null;
        const actionData = action(eventName, fileIds, this._userId, arg);
        const result = calculateActionEvents(this._tree.value, actionData);
        if (FileHelper._debug) {
            console.log('  result: ', result);
        }

        return result;
    }

    /**
     * Calculates the list of file events for the given formula.
     * @param formula The formula to execute.
     */
    formulaEvents(formula: string) {
        if (FileHelper._debug) {
            console.log('[FileManager] Run formula:', formula);
        }
        const result = calculateFormulaEvents(
            this._tree.value,
            formula,
            this._userId
        );
        if (FileHelper._debug) {
            console.log('  result: ', result);
        }
        return result;
    }

    /**
     * Runs the given event on the given files.
     * @param eventName The name of the event to run.
     * @param files The files that should be searched for handlers for the event name.
     * @param arg The argument that should be passed to the event handlers.
     */
    async action(eventName: string, files: File[], arg?: any): Promise<void> {
        const result = this.actionEvents(eventName, files, arg);
        await this._tree.addEvents(result.events);
        this._sendLocalEvents(result.events);
    }

    /**
     * Adds the given events in a transaction.
     * That is, they should be performed in a batch.
     * @param events The events to run.
     */
    async transaction(...events: FileEvent[]): Promise<void> {
        await this._tree.addEvents(events);
        this._sendLocalEvents(events);
    }

    /**
     * Adds the given state to the current file state.
     * @param state The state to add.
     */
    async addState(state: FilesState): Promise<void> {
        await this._tree.addEvents([addState(state)]);
    }

    /**
     * Calculates the nicely formatted value for the given file and tag.
     * @param file The file to calculate the value for.
     * @param tag The tag to calculate the value for.
     */
    calculateFormattedFileValue(file: File, tag: string): string {
        return calculateFormattedFileValue(this.createContext(), file, tag);
    }

    /**
     * Calculates the value of the tag on the given file.
     * @param file The file.
     * @param tag The tag to calculate the value of.
     */
    calculateFileValue(file: File, tag: string) {
        return calculateFileValue(this.createContext(), file, tag);
    }

    /**
     * Sets the file that the user is editing.
     * @param file The file.
     */
    setEditingFile(file: File) {
        return this.updateFile(this.userFile, {
            tags: {
                'aux._editingFile': file.id,
            },
        });
    }

    private _sendLocalEvents(events: FileEvent[]) {
        for (let i = 0; i < events.length; i++) {
            const event = events[i];
            if (event.type === 'local') {
                this._localEvents.next(<LocalEvents>event);
            }
        }
    }

    /**
     * Gets the list of simulation files that are in the current user's simulation context.
     * @param id The ID of the simulation to search for.
     */
    private _getSimulationFiles(id: string): AuxObject[] {
        // TODO: Make these functions support precalculated file contexts
        const simFiles = filesInContext(
            calc,
            this.userFile.tags['aux._userSimulationsContext']
        ).filter(f => getFileChannel(calc, f) === id);

        return <AuxObject[]>simFiles;
    }
}
