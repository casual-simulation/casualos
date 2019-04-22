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
} from '@casual-simulation/aux-common';
import formulaLib from '@casual-simulation/aux-common/Formulas/formula-lib';
import { Subject, Observable } from 'rxjs';

/**
 * Defines an class that contains a simple set of functions
 * that help manipulate files.
 */
export class FileHelper {
    private static readonly _debug = false;
    private _tree: AuxCausalTree;
    private _userId: string;
    private _lib: SandboxLibrary;
    private _localEvents: Subject<LocalEvents>;

    /**
     * Creates a new file helper.
     * @param tree The tree that the file helper should use.
     * @param userFileId The ID of the user's file.
     */
    constructor(
        tree: AuxCausalTree,
        userFileId: string,
        { isBuilder, isPlayer } = { isBuilder: false, isPlayer: false }
    ) {
        this._tree = tree;
        this._userId = userFileId;
        this._localEvents = new Subject<LocalEvents>();
        this._lib = {
            ...formulaLib,
            isBuilder,
            isPlayer,
        };
    }

    /**
     * Gets the current local file state.
     */
    get filesState() {
        return this._tree.value;
    }

    /**
     * Gets all the files that represent an object.
     */
    get objects(): AuxObject[] {
        return <AuxObject[]>getActiveObjects(this.filesState);
    }

    /**
     * Gets the file for the current user.
     */
    get userFile(): AuxObject {
        var objs = this.objects.filter(o => o.id === this._userId);
        if (objs.length > 0) {
            return objs[0];
        }
        return null;
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
    async updateFile(file: AuxFile, newData: PartialFile): Promise<void> {
        updateFile(file, this.userFile.id, newData, () => this.createContext());

        await this._tree.updateFile(file, newData);
    }

    /**
     * Creates a new file with the given ID and tags.
     * @param id (Optional) The ID that the file should have.
     * @param tags (Optional) The tags that the file should have.
     */
    async createFile(id?: string, tags?: File['tags']): Promise<void> {
        if (FileHelper._debug) {
            console.log('[FileManager] Create File');
        }

        const file = createFile(id, tags);
        await this._tree.addFile(file);
    }

    /**
     * Creates a new workspace file.
     */
    async createWorkspace(
        builderContextId?: string,
        contextType?: unknown
    ): Promise<void> {
        if (FileHelper._debug) {
            console.log('[FileManager] Create File');
        }

        const workspace: Workspace = createWorkspace(
            undefined,
            builderContextId,
            contextType
        );

        await this._tree.addFile(workspace);
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
     * Creates a new FileCalculationContext from the current state.
     */
    createContext(): FileCalculationContext {
        return createCalculationContext(this.objects, this._lib);
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

    private _sendLocalEvents(events: FileEvent[]) {
        for (let i = 0; i < events.length; i++) {
            const event = events[i];
            if (event.type === 'local') {
                this._localEvents.next(<LocalEvents>event);
            }
        }
    }
}
