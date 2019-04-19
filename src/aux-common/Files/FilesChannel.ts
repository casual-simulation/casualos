import { sortBy, flatMap, mapValues } from 'lodash';
import { File, Object, PartialFile} from './File';
import { createCalculationContext, FileCalculationContext, calculateFileValue, convertToFormulaObject, getActiveObjects, filtersMatchingArguments, calculateFormulaValue, isFile } from './FileCalculations';
import { merge as mergeObj } from '../utils';
import formulaLib, { setActions, getActions, setFileState, setCalculationContext, getCalculationContext, setUserId, getUserId } from '../Formulas/formula-lib';
import { SetValueHandler, isProxy } from './FileProxy';

/**
 * Defines an interface for the state that an AUX file can contain.
 */
export interface FilesState {
    [id: string]: File;
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
    FileAddedEvent | 
    FileRemovedEvent | 
    FileUpdatedEvent |
    FileTransactionEvent |
    ApplyStateEvent |
    LocalEvent;

/**
 * Calculates the set of events that should be run for the given action.
 * @param state The current file state.
 * @param action The action to process.
 */
export function calculateActionEvents(state: FilesState, action: Action) {
    const objects = getActiveObjects(state);
    const files = !!action.fileIds ? action.fileIds.map(id => state[id]) : objects;
    const factory = (o: File) => {
        return (tag: string, value: any) => {
            if (!changes[o.id]) {
                changes[o.id] = {
                    changedTags: [],
                    newValues: []
                };
            }
            changes[o.id].changedTags.push(tag);
            changes[o.id].newValues.push(value);
        };
    };
    const context = createCalculationContext(objects, formulaLib, factory);

    let changes: {
        [key: string]: {
            changedTags: string[];
            newValues: string[];
        }
    } = {};

    objects.forEach(o => {
        changes[o.id] = {
            changedTags: [],
            newValues: []
        };
    });

    const fileEvents = flatMap(files, (f) => eventActions(
        state, 
        files, 
        context, 
        f,
        action.eventName,
        factory,
        action.userId,
        action.argument));
    let events = fileEvents;

    const updates = objects.map(o => calculateFileUpdateFromChanges(o.id, changes[o.id]));
    updates.forEach(u => {
        if (u) {
            events.push(u);
        }
    });

    return {
        events,
        hasUserDefinedEvents: events.length > 0
    };
}


/**
 * Calculates the list of events needed to destroy the given file and all of its decendents.
 * @param calc The file calculation context.
 * @param file The file to destroy.
 */
export function calculateDestroyFileEvents(calc: FileCalculationContext, file: File): FileEvent[] {
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

function destroyChildren(calc: FileCalculationContext, events: FileEvent[], id: string) {
    const result = calculateFormulaValue(calc, `@aux._creator("${id}")`); 
    if (result.success) {
        const children = result.result;
        let all: File[] = [];
        if (children) {
            if (Array.isArray(children)) {
                all = children;
            } else {
                all = [children];
            }
        }

        all.forEach(child => {
            events.push(fileRemoved(child.id));
            destroyChildren(calc, events, child.id);
        });
    }
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


function eventActions(state: FilesState, 
    objects: Object[], 
    context: FileCalculationContext, 
    file: Object, 
    eventName: string,
    setValueHandlerFactory: (file: File) => SetValueHandler,
    userId: string | null,
    argument: any): FileEvent[] {
    const otherObjects = objects.filter(o => o !== file);
    const sortedObjects = sortBy(objects, o => o !== file);
    const filters = filtersMatchingArguments(context, file, eventName, otherObjects);
    const scripts = filters.map(f => calculateFileValue(context, file, f.tag));
    let previous = getActions();
    let prevContext = getCalculationContext();
    let prevUserId = getUserId();
    let actions: FileEvent[] = [];

    let vars: {
        [key: string]: any
    } = {};
    setActions(actions);
    setFileState(state);
    setCalculationContext(context);
    setUserId(userId);

    let formulaObjects = sortedObjects.map(o => convertToFormulaObject(context, o, setValueHandlerFactory(o)));

    if (typeof argument === 'undefined') {
        formulaObjects.forEach((obj, index) => {
            if (index === 1) {
                vars['that'] = obj;
            }
            
            vars[`arg${index}`] = obj;
        });
    } else {
        vars['that'] = mapToFormulaObjects(context, argument, setValueHandlerFactory);
    }

    scripts.forEach(s => context.sandbox.run(s, {}, formulaObjects[0], vars));

    setActions(previous);
    setFileState(null);
    setCalculationContext(prevContext);
    setUserId(prevUserId);

    return actions;
}

function mapToFormulaObjects(context: FileCalculationContext, argument: any, setValueHandlerFactory: (file: File) => SetValueHandler): any {
    if (isFile(argument)) {
        return convertToFormulaObject(context, argument, setValueHandlerFactory(argument));
    } else if (argument && typeof argument === 'object' && !argument[isProxy]) {
        if (Array.isArray(argument)) {
            return argument.map(v => {
                if (isFile(v)) {
                    return convertToFormulaObject(context, v, setValueHandlerFactory(v));
                }
                return v;
            });
        } else {
            return mapValues(argument, v => {
                if (isFile(v)) {
                    return convertToFormulaObject(context, v, setValueHandlerFactory(v));
                }
                return mapToFormulaObjects(context, v, setValueHandlerFactory);
            });
        }
    } else {
        return argument;
    }
}

function calculateFileUpdateFromChanges(id: string, changes: { changedTags: string[], newValues: any[] }): FileUpdatedEvent {
    if (!changes) {
        return null;
    }
    if (changes.changedTags.length === 0) {
        return null;
    }
    let partial: PartialFile = {
        tags: {}
    };
    for(let i = 0; i < changes.changedTags.length; i++) {
        partial.tags[changes.changedTags[i]] = changes.newValues[i];
    }

    return fileUpdated(id, partial);
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
export type LocalEvents = ShowToastEvent | TweenToEvent;

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
}

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
        file: file
    };
}

/**
 * Creates a new FileRemovedEvent.
 * @param fileId The ID of the file that was removed.
 */
export function fileRemoved(fileId: string): FileRemovedEvent {
    return {
        type: 'file_removed',
        id: fileId
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
        events: events
    };
}

/**
 * Creates a new Action.
 * @param eventName The name of the event.
 * @param fileIds The IDs of the files that the event should be sent to. If null then the event is sent to every file.
 * @param userId The ID of the file for the current user.
 * @param arg The optional argument to provide.
 */
export function action(eventName: string, fileIds: string[] = null, userId: string = null, arg?: any): Action {
    return {
        type: 'action',
        fileIds,
        eventName,
        userId,
        argument: arg
    };
}

/**
 * Creates a new ApplyStateEvent.
 * @param state The state to apply.
 */
export function addState(state: FilesState): ApplyStateEvent {
    return {
        type: 'apply_state',
        state: state
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
        message: message
    };
}

/**
 * Creates a new TweenToEvent.
 * @param fileId The ID of the file to tween to.
 */
export function tweenTo(fileId: string): TweenToEvent {
    return {
        type: 'local',
        name: 'tween_to',
        fileId: fileId
    };
}