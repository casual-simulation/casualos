import { sortBy, flatMap, mapValues, sortedIndexBy, values } from 'lodash';
import { File, Object, PartialFile, PrecalculatedFile, FileTags } from './File';
import {
    calculateFileValue,
    getActiveObjects,
    filtersMatchingArguments,
    calculateFormulaValue,
    isFile,
    isDestroyable,
    objectsAtContextGridPosition,
} from './FileCalculations';
import { FileCalculationContext, FileSandboxContext } from './FileContext';
import { merge as mergeObj } from '../utils';
import {
    setActions,
    getActions,
    setFileState,
    setCalculationContext,
    getCalculationContext,
    getUserId,
    getFileState,
} from '../Formulas/formula-lib-globals';
import formulaLib from '../Formulas/formula-lib';
import SandboxInterface, { FilterFunction } from '../Formulas/SandboxInterface';
import { SandboxLibrary, Sandbox } from '../Formulas/Sandbox';
import uuid from 'uuid/v4';

/**
 * Defines an interface for the state that an AUX file can contain.
 */
export interface FilesState {
    [id: string]: File;
}

/**
 * Defines an interface for a set of files that have precalculated formulas.
 */
export interface PrecalculatedFilesState {
    [id: string]: PrecalculatedFile;
}

/**
 * Defines an interface that represents an event.
 * That is, a time-ordered action in a channel.
 * @deprecated
 */
export interface Event {
    /**
     * The type of the event.
     * This helps determine how the event should be applied to the state.
     */
    type: string;
}

/**
 * Defines a union type for all the possible events that can be emitted from a files channel.
 */
export type FileEvent =
    | FileAddedEvent
    | FileRemovedEvent
    | FileUpdatedEvent
    | FileTransactionEvent
    | ApplyStateEvent
    | Action
    | SetForcedOfflineEvent
    | LocalEvent;

interface FileChanges {
    [key: string]: {
        changedTags: string[];
        newValues: string[];
    };
}

/**
 * Creates a new file calculation context.
 * @param objects The objects that should be included in the context.
 * @param lib The library JavaScript that should be used.
 */
export function createCalculationContext(
    objects: Object[],
    userId: string = null,
    lib: SandboxLibrary = formulaLib
): FileSandboxContext {
    const context = {
        sandbox: new Sandbox(lib),
        objects: objects,
    };
    context.sandbox.interface = new SandboxInterfaceImpl(context, userId);
    return context;
}

export function createPrecalculatedContext(
    objects: PrecalculatedFile[]
): FileCalculationContext {
    const context = {
        objects: objects,
    };
    return context;
}

/**
 * Creates a new file calculation context from the given files state.
 * @param state The state to use.
 * @param includeDestroyed Whether to include destroyed files in the context.
 */
export function createCalculationContextFromState(
    state: FilesState,
    includeDestroyed: boolean = false
) {
    const objects = includeDestroyed ? values(state) : getActiveObjects(state);
    return createCalculationContext(objects);
}

/**
 * Executes the given formula on the given file state and returns the results.
 * @param formula The formula to run.
 * @param state The file state to use.
 * @param options The options.
 */
export function searchFileState(
    formula: string,
    state: FilesState,
    { includeDestroyed }: { includeDestroyed?: boolean } = {}
) {
    includeDestroyed = includeDestroyed || false;
    const context = createCalculationContextFromState(state, includeDestroyed);
    const result = calculateFormulaValue(context, formula);
    return result;
}

/**
 * Calculates the set of events that should be run for the given action.
 * @param state The current file state.
 * @param action The action to process.
 * @param context The calculation context to use.
 */
export function calculateActionEvents(state: FilesState, action: Action) {
    const { files, objects } = getFilesForAction(state, action);
    const context = createCalculationContext(
        objects,
        action.userId,
        formulaLib
    );

    const fileEvents = calculateFileActionEvents(state, action, context, files);
    let events = [...fileEvents, ...context.sandbox.interface.getFileUpdates()];

    return {
        events,
        hasUserDefinedEvents: events.length > 0,
    };
}

/**
 * Calculates the set of events that should be run as the result of the given action using the given context.
 * The returned events are only events that were added directly from the scripts and not any events that were added via setTag() calls.
 */
export function calculateActionEventsUsingContext(
    state: FilesState,
    action: Action,
    context: FileSandboxContext
) {
    const { files, objects } = getFilesForAction(state, action);
    return calculateFileActionEvents(state, action, context, files);
}

function getFilesForAction(state: FilesState, action: Action) {
    const objects = getActiveObjects(state);
    const files = !!action.fileIds
        ? action.fileIds.map(id => state[id])
        : objects;
    return { files, objects };
}

export function calculateFileActionEvents(
    state: FilesState,
    action: Action,
    context: FileSandboxContext,
    files: File[]
) {
    return flatMap(files, f =>
        eventActions(
            state,
            files,
            context,
            f,
            action.eventName,
            action.argument
        )
    );
}

/**
 * Calculates the set of events that should be run for the given formula.
 * @param state The current file state.
 * @param formula The formula to run.
 * @param userId The ID of the user to run the script as.
 * @param argument The argument to include as the "that" variable.
 */
export function calculateFormulaEvents(
    state: FilesState,
    formula: string,
    userId: string = null,
    argument: any = null
) {
    const objects = getActiveObjects(state);
    const context = createCalculationContext(
        objects,
        userId,
        formulaLib
        // factory
    );

    let fileEvents = formulaActions(state, context, [], null, [formula]);

    return [...fileEvents, ...context.sandbox.interface.getFileUpdates()];
}

/**
 * Calculates the list of events needed to destroy the given file and all of its decendents.
 * @param calc The file calculation context.
 * @param file The file to destroy.
 */
export function calculateDestroyFileEvents(
    calc: FileCalculationContext,
    file: File
): FileEvent[] {
    if (!isDestroyable(calc, file)) {
        return [];
    }
    let events: FileEvent[] = [];
    let id: string;
    if (typeof file === 'object') {
        id = file.id;
    } else if (typeof file === 'string') {
        id = file;
    }

    if (id) {
        events.push(fileRemoved(id));
    }

    destroyChildren(calc, events, id);

    return events;
}

function destroyChildren(
    calc: FileCalculationContext,
    events: FileEvent[],
    id: string
) {
    const result = calc.objects.filter(
        o => calculateFileValue(calc, o, 'aux.creator') === id
    );

    result.forEach(child => {
        if (!isDestroyable(calc, child)) {
            return;
        }
        events.push(fileRemoved(child.id));
        destroyChildren(calc, events, child.id);
    });
}

/**
 * Determines whether the given tag value is a valid value or if
 * it represents nothing.
 * @param value The value.
 */
export function hasValue(value: string) {
    return !(value === null || typeof value === 'undefined' || value === '');
}

/**
 * Cleans the file by removing any null or undefined properties.
 * @param file The file to clean.
 */
export function cleanFile(file: File): File {
    let cleaned = mergeObj({}, file);
    // Make sure we're not modifying another file's tags
    let newTags = mergeObj({}, cleaned.tags);
    cleaned.tags = newTags;
    for (let property in cleaned.tags) {
        let value = cleaned.tags[property];
        if (!hasValue(value)) {
            delete cleaned.tags[property];
        }
    }
    return cleaned;
}

// function calculateEventsFromUpdates(
//     context: FileCalculationContext,
//     changes: FileChanges,
//     events: FileEvent[]
// ) {
//     const updates = context.sandbox.interface.objects.map(o =>
//         calculateFileUpdateFromChanges(o.id, changes[o.id])
//     );
//     updates.forEach(u => {
//         if (u) {
//             events.push(u);
//         }
//     });
// }

function eventActions(
    state: FilesState,
    objects: Object[],
    context: FileSandboxContext,
    file: Object,
    eventName: string,
    argument: any
): FileEvent[] {
    if (file === undefined) {
        return;
    }
    const otherObjects = objects.filter(o => o !== file);
    const sortedObjects = sortBy(objects, o => o !== file);

    const filters = filtersMatchingArguments(
        context,
        file,
        eventName,
        otherObjects
    );

    const scripts = filters.map(f => calculateFileValue(context, file, f.tag));

    const events = formulaActions(
        state,
        context,
        sortedObjects,
        argument,
        scripts
    );

    return events;
}

function formulaActions(
    state: FilesState,
    context: FileSandboxContext,
    sortedObjects: File[],
    argument: any,
    scripts: any[]
) {
    let previous = getActions();
    let prevContext = getCalculationContext();
    let prevState = getFileState();
    let prevUserId = getUserId();
    let actions: FileEvent[] = [];
    let vars: {
        [key: string]: any;
    } = {};
    setActions(actions);
    setFileState(state);
    setCalculationContext(context);
    if (typeof argument === 'undefined') {
        sortedObjects.forEach((obj, index) => {
            if (index === 1) {
                vars['that'] = obj;
            }
            vars[`arg${index}`] = obj;
        });
    } else {
        vars['that'] = argument;
    }
    scripts.forEach(s => context.sandbox.run(s, {}, sortedObjects[0], vars));
    setActions(previous);
    setFileState(prevState);
    setCalculationContext(prevContext);
    return actions;
}

/**
 * Defines a file event that indicates a file was added to the state.
 */
export interface FileAddedEvent extends Event {
    type: 'file_added';
    id: string;
    file: File;
}

/**
 * Defines a file event that indicates a file was removed from the state.
 */
export interface FileRemovedEvent extends Event {
    type: 'file_removed';
    id: string;
}

/**
 * Defines a file event that indicates a file was updated.
 */
export interface FileUpdatedEvent extends Event {
    type: 'file_updated';
    id: string;
    update: PartialFile;
}

/**
 * A set of file events in one.
 */
export interface FileTransactionEvent extends Event {
    type: 'transaction';
    events: FileEvent[];
}

/**
 * An event to apply some generic FilesState to the current state.
 * This is useful when you have some generic file state and want to just apply it to the
 * current state. An example of doing this is from the automatic merge system.
 */
export interface ApplyStateEvent extends Event {
    type: 'apply_state';
    state: FilesState;
}

/**
 * An event that is used as a way to communicate local changes from script actions to the interface.
 * For example, showing a toast message is a local event.
 */
export interface LocalEvent extends Event {
    type: 'local';
}

/**
 * Defines a set of possible local event types.
 */
export type LocalEvents =
    | ShowToastEvent
    | TweenToEvent
    | OpenQRCodeScannerEvent
    | ShowQRCodeEvent
    | LoadSimulationEvent
    | UnloadSimulationEvent
    | SuperShoutEvent
    | GoToContextEvent
    | ImportAUXEvent
    | ShowInputForTagEvent;

/**
 * An event that is used to show a toast message to the user.
 */
export interface ShowToastEvent extends LocalEvent {
    name: 'show_toast';
    message: string;
}

/**
 * An event that is used to tween the camera to the given file's location.
 */
export interface TweenToEvent extends LocalEvent {
    name: 'tween_to';

    /**
     * The ID of the file to tween to.
     */
    fileId: string;

    /*
     * The zoom value to use.
     */
    zoomValue: number;
}

/**
 * An event that is used to show or hide the QR Code Scanner.
 */
export interface OpenQRCodeScannerEvent extends LocalEvent {
    name: 'show_qr_code_scanner';

    /**
     * Whether the QR Code scanner should be visible.
     */
    open: boolean;
}

/**
 * An event that is used to show or hide a QR Code on screen.
 */
export interface ShowQRCodeEvent extends LocalEvent {
    name: 'show_qr_code';

    /**
     * Whether the QR Code should be visible.
     */
    open: boolean;

    /**
     * The code to display.
     */
    code: string;
}

/**
 * An event that is used to load a simulation.
 */
export interface LoadSimulationEvent extends LocalEvent {
    name: 'load_simulation';

    /**
     * The ID of the simulation to load.
     */
    id: string;
}

/**
 * An event that is used to unload a simulation.
 */
export interface UnloadSimulationEvent extends LocalEvent {
    name: 'unload_simulation';

    /**
     * The ID of the simulation to unload.
     */
    id: string;
}

/**
 * An event that is used to load an AUX from a remote location.
 */
export interface ImportAUXEvent extends LocalEvent {
    name: 'import_aux';

    /**
     * The URL to load.
     */
    url: string;
}

/**
 * Defines an event for actions that are shouted to every current loaded simulation.
 */
export interface SuperShoutEvent extends LocalEvent {
    name: 'super_shout';

    /**
     * The name of the event.
     */
    eventName: string;

    /**
     * The argument to pass as the "that" variable to scripts.
     */
    argument?: any;
}

/**
 * Defines an event that is used to send the player to a context.
 */
export interface GoToContextEvent extends LocalEvent {
    name: 'go_to_context';

    /**
     * The context that should be loaded.
     */
    context: string;
}

/**
 * Defines an event that is used to show an input box to edit a tag on a file.
 */
export interface ShowInputForTagEvent extends LocalEvent {
    name: 'show_input_for_tag';

    /**
     * The ID of the file to edit.
     */
    fileId: string;

    /**
     * The tag that should be edited on the file.
     */
    tag: string;

    /**
     * The options for the input box.
     */
    options: Partial<ShowInputOptions>;
}

/**
 * Defines an event that is used to set whether the connection is forced to be offline.
 */
export interface SetForcedOfflineEvent extends Event {
    type: 'set_offline_state';

    /**
     * Whether the connection should be offline.
     */
    offline: boolean;
}

/**
 * Defines an interface for options that a show input event can use.
 */
export interface ShowInputOptions {
    /**
     * The type of input box to show.
     */
    type: ShowInputType;

    /**
     * The subtype of input box to show.
     */
    subtype: ShowInputSubtype;

    /**
     * The title that should be used for the input.
     */
    title: string;

    /**
     * The placeholder for the value.
     */
    placeholder: string;

    /**
     * The background color to use.
     */
    backgroundColor: string;

    /**
     * The foreground color to use.
     */
    foregroundColor: string;
}

/**
 * Defines the possible input types.
 */
export type ShowInputType = 'text' | 'color';

/**
 * Defines the possible input types.
 */
export type ShowInputSubtype = 'basic' | 'swatch' | 'advanced';

/**
 * Defines an event for actions.
 * Actions are basically user-defined events.
 */
export interface Action {
    type: 'action';

    /**
     * The IDs of the files that the event is being sent to.
     * If null, then the action is sent to every file.
     */
    fileIds: string[] | null;

    /**
     * The File ID of the user.
     */
    userId: string | null;

    /**
     * The name of the event.
     */
    eventName: string;

    /**
     * The argument to pass as the "that" variable to scripts.
     */
    argument?: any;
}

/**
 * Creates a new FileAddedEvent.
 * @param file The file that was added.
 */
export function fileAdded(file: File): FileAddedEvent {
    return {
        type: 'file_added',
        id: file.id,
        file: file,
    };
}

/**
 * Creates a new FileRemovedEvent.
 * @param fileId The ID of the file that was removed.
 */
export function fileRemoved(fileId: string): FileRemovedEvent {
    return {
        type: 'file_removed',
        id: fileId,
    };
}

/**
 * Creates a new FileUpdatedEvent.
 * @param id The ID of the file that was updated.
 * @param update The update that was applied to the file.
 */
export function fileUpdated(id: string, update: PartialFile): FileUpdatedEvent {
    return {
        type: 'file_updated',
        id: id,
        update: update,
    };
}

/**
 * Creates a new FileTransactionEvent.
 * @param events The events to contain in the transaction.
 */
export function transaction(events: FileEvent[]): FileTransactionEvent {
    return {
        type: 'transaction',
        events: events,
    };
}

/**
 * Creates a new Action.
 * @param eventName The name of the event.
 * @param fileIds The IDs of the files that the event should be sent to. If null then the event is sent to every file.
 * @param userId The ID of the file for the current user.
 * @param arg The optional argument to provide.
 */
export function action(
    eventName: string,
    fileIds: string[] = null,
    userId: string = null,
    arg?: any
): Action {
    return {
        type: 'action',
        fileIds,
        eventName,
        userId,
        argument: arg,
    };
}

/**
 * Creates a new ApplyStateEvent.
 * @param state The state to apply.
 */
export function addState(state: FilesState): ApplyStateEvent {
    return {
        type: 'apply_state',
        state: state,
    };
}

/**
 * Creates a new ShowToastEvent.
 * @param message The message to show with the event.
 */
export function toast(message: string): ShowToastEvent {
    return {
        type: 'local',
        name: 'show_toast',
        message: message,
    };
}

/**
 * Creates a new TweenToEvent.
 * @param fileId The ID of the file to tween to.
 * @param zoomValue The zoom value to use.
 */
export function tweenTo(fileId: string, zoomValue: number = -1): TweenToEvent {
    return {
        type: 'local',
        name: 'tween_to',
        fileId: fileId,
        zoomValue: zoomValue,
    };
}

/**
 * Creates a new OpenQRCodeScannerEvent.
 * @param open Whether the QR Code scanner should be open or closed.
 */
export function openQRCodeScanner(open: boolean): OpenQRCodeScannerEvent {
    return {
        type: 'local',
        name: 'show_qr_code_scanner',
        open: open,
    };
}

/**
 * Creates a new ShowQRCodeEvent.
 * @param open Whether the QR Code should be visible.
 * @param code The code that should be shown.
 */
export function showQRCode(open: boolean, code?: string): ShowQRCodeEvent {
    return {
        type: 'local',
        name: 'show_qr_code',
        open: open,
        code: code,
    };
}

/**
 * Creates a new LoadSimulationEvent.
 * @param id The ID of the simulation to load.
 */
export function loadSimulation(id: string): LoadSimulationEvent {
    return {
        type: 'local',
        name: 'load_simulation',
        id: id,
    };
}

/**
 * Creates a new UnloadSimulationEvent.
 * @param id The ID of the simulation to unload.
 */
export function unloadSimulation(id: string): UnloadSimulationEvent {
    return {
        type: 'local',
        name: 'unload_simulation',
        id: id,
    };
}

/**
 * Creates a new SuperShoutEvent.
 * @param eventName The name of the event.
 * @param arg The argument to send as the "that" variable to scripts.
 */
export function superShout(eventName: string, arg?: any): SuperShoutEvent {
    return {
        type: 'local',
        name: 'super_shout',
        eventName: eventName,
        argument: arg,
    };
}

/**
 * Creates a new GoToContextEvent.
 * @param simulationOrContext The simulation ID or context to go to. If a simulation ID is being provided, then the context parameter must also be provided.
 * @param context
 */
export function goToContext(context: string): GoToContextEvent {
    return {
        type: 'local',
        name: 'go_to_context',
        context: context,
    };
}

/**
 * Creates a new ImportAUXEvent.
 * @param url The URL that should be loaded.
 */
export function importAUX(url: string): ImportAUXEvent {
    return {
        type: 'local',
        name: 'import_aux',
        url: url,
    };
}

/**
 * Creates a new ShowInputForTagEvent.
 * @param fileId The ID of the file to edit.
 * @param tag The tag to edit.
 */
export function showInputForTag(
    fileId: string,
    tag: string,
    options?: Partial<ShowInputOptions>
): ShowInputForTagEvent {
    return {
        type: 'local',
        name: 'show_input_for_tag',
        fileId: fileId,
        tag: tag,
        options: options || {},
    };
}

/**
 * Creates a new SetForcedOfflineEvent event.
 * @param offline Whether the connection should be offline.
 */
export function setForcedOffline(offline: boolean): SetForcedOfflineEvent {
    return {
        type: 'set_offline_state',
        offline: offline,
    };
}

class SandboxInterfaceImpl implements SandboxInterface {
    private _userId: string;
    objects: Object[];
    context: FileCalculationContext;

    private _fileMap: Map<string, FileTags>;

    constructor(context: FileCalculationContext, userId: string) {
        this.objects = sortBy(context.objects, 'id');
        this.context = context;
        this._userId = userId;
        this._fileMap = new Map();
    }

    /**
     * Adds the given file to the calculation context and returns a proxy for it.
     * @param file The file to add.
     */
    addFile(file: File): File {
        const index = sortedIndexBy(this.objects, file, f => f.id);
        this.objects.splice(index, 0, file);
        return file;
    }

    listTagValues(tag: string, filter?: FilterFunction, extras?: any) {
        const tags = this.objects
            .map(o => this._calculateValue(o, tag))
            .filter(t => hasValue(t));
        const filtered = this._filterValues(tags, filter);
        return filtered;
    }

    listObjectsWithTag(tag: string, filter?: FilterFunction, extras?: any) {
        const objs = this.objects.filter(o =>
            hasValue(this._calculateValue(o, tag))
        );
        const filtered = this._filterObjects(objs, filter, tag);
        return filtered;
    }

    list(obj: any, context: string) {
        if (!context) {
            return [];
        }
        const x: number = obj[`${context}.x`];
        const y: number = obj[`${context}.y`];

        if (typeof x !== 'number' || typeof y !== 'number') {
            return [];
        }

        const objs = objectsAtContextGridPosition(this.context, context, {
            x,
            y,
        });
        return objs;
    }

    uuid(): string {
        return uuid();
    }

    userId(): string {
        return this._userId;
    }

    getTag(file: File, tag: string): any {
        const tags = this._getFileTags(file.id);
        if (tags.hasOwnProperty(tag)) {
            return tags[tag];
        }
        return calculateFileValue(this.context, file, tag);
    }

    setTag(file: File, tag: string, value: any): any {
        const tags = this._getFileTags(file.id);
        tags[tag] = value;
        return value;
    }

    getFileUpdates(): FileUpdatedEvent[] {
        const files = [...this._fileMap.entries()];
        const updates = files
            .filter(f => {
                return Object.keys(f[1]).length > 0;
            })
            .map(f =>
                fileUpdated(f[0], {
                    tags: f[1],
                })
            );

        return sortBy(updates, u => u.id);
    }

    private _filterValues(values: any[], filter: FilterFunction) {
        if (filter) {
            if (typeof filter === 'function') {
                return values.filter(filter);
            } else {
                return values.filter(t => t === filter);
            }
        } else {
            return values;
        }
    }

    private _filterObjects(objs: any[], filter: FilterFunction, tag: string) {
        if (filter) {
            if (typeof filter === 'function') {
                return objs.filter(o => filter(this._calculateValue(o, tag)));
            } else {
                return objs.filter(o => this._calculateValue(o, tag) == filter);
            }
        } else {
            return objs;
        }
    }

    private _calculateValue(object: any, tag: string) {
        return calculateFileValue(this.context, object, tag);
    }

    private _getFileTags(id: string): FileTags {
        if (this._fileMap.has(id)) {
            return this._fileMap.get(id);
        }
        const tags = {};
        this._fileMap.set(id, tags);
        return tags;
    }
}
