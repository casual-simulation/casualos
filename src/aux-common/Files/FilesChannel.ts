import { sortBy, flatMap} from 'lodash';
import { File, Object, PartialFile} from './File';
import { createCalculationContext, FileCalculationContext, calculateFileValue, convertToFormulaObject, isDestroyed, getActiveObjects, calculateStateDiff, FilesStateDiff, filtersMatchingArguments, calculateFormulaValue } from './FileCalculations';
import { merge as mergeObj } from '../utils';
import formulaLib, { setActions, getActions, setFileState, setCalculationContext, getCalculationContext, setUserId, getUserId } from '../Formulas/formula-lib';
import { SetValueHandler } from './FileProxy';
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
    ApplyStateEvent;

export interface DiffOptions {
    /**
     * Whether the diff results should contain
     * both parents or just the changes needed to turn parent 1 into parent 2.
     */
    fullDiff?: boolean;
}

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

    const fileEvents = flatMap(files, (f, index) => eventActions(
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
        vars['that'] = argument;
    }

    scripts.forEach(s => context.sandbox.run(s, {}, formulaObjects[0], vars));

    setActions(previous);
    setFileState(null);
    setCalculationContext(prevContext);
    setUserId(prevUserId);

    return actions;
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

export interface FileAddedEvent extends Event {
    type: 'file_added';
    id: string;
    file: File;
}

export interface FileRemovedEvent extends Event {
    type: 'file_removed';
    id: string;
}

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

export function fileAdded(file: File): FileAddedEvent {
    return {
        type: 'file_added',
        id: file.id,
        file: file
    };
}

export function fileRemoved(fileId: string): FileRemovedEvent {
    return {
        type: 'file_removed',
        id: fileId
    };
}

export function fileUpdated(id: string, update: PartialFile): FileUpdatedEvent {
    return {
        type: 'file_updated',
        id: id,
        update: update,
    };
}

export function transaction(events: FileEvent[]): FileTransactionEvent {
    return {
        type: 'transaction',
        events: events
    };
}

export function action(eventName: string, fileIds: string[] = null, userId: string = null, arg?: any): Action {
    return {
        type: 'action',
        fileIds,
        eventName,
        userId,
        argument: arg
    };
}

export function addState(state: FilesState): ApplyStateEvent {
    return {
        type: 'apply_state',
        state: state
    };
}