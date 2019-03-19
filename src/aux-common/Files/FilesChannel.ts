import {filter, values, union, keys, isEqual, transform, set, mergeWith, unset, get, sortBy, flatMap} from 'lodash';
import {
    map as rxMap,
    flatMap as rxFlatMap,
    pairwise as rxPairwise,
    startWith
} from 'rxjs/operators';
import { ReducingStateStore, Event, ChannelConnection } from "../channels-core";
import {File, Object, Workspace, PartialFile} from './File';
import { tagsMatchingFilter, createCalculationContext, FileCalculationContext, calculateFileValue, convertToFormulaObject, isDestroyed, getActiveObjects, calculateStateDiff, FilesStateDiff } from './FileCalculations';
import { merge as mergeObj } from '../utils';
import { setActions, getActions, setFileState } from '../Formulas/formula-lib';
export interface FilesState {
    [id: string]: File;
}

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
    const context = createCalculationContext(objects);
    const fileEvents = flatMap(files, (f, index) => eventActions(
        state, 
        objects, 
        context, 
        f, 
        (files.length > 1 && index === 0) ? files[1] : files[0], 
        action.eventName));
    const events = fileEvents;
    
    if (action.eventName === '+') {
        events.push(
            ...files.map(f => fileUpdated(f.id, {
                tags: {
                    _destroyed: true
                }
            }))
        );
    }

    return {
        events,
        hasUserDefinedEvents: fileEvents.length > 0
    };
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


function eventActions(state: FilesState, objects: Object[], context: FileCalculationContext, file: Object, other: Object, eventName: string): FileEvent[] {
    const filters = tagsMatchingFilter(file, other, eventName, context);
    const scripts = filters.map(f => calculateFileValue(context, other, f));
    let previous = getActions();
    let actions: FileEvent[] = [];
    setActions(actions);
    setFileState(state);
    
    let thisChangedTags: string[] = [];
    let thisNewValues: any[] = [];

    const thisFormulaObject = convertToFormulaObject(context, other, (tag, value) => {
        thisChangedTags.push(tag);
        thisNewValues.push(value);
    });

    let thatChangedTags: string[] = [];
    let thatNewValues: any[] = [];

    const thatFormulaObject = convertToFormulaObject(context, file, (tag, value) => {
        thatChangedTags.push(tag);
        thatNewValues.push(value);
    });

    scripts.forEach(s => context.sandbox.run(s, {}, thisFormulaObject, {
        that: thatFormulaObject
    }));

    setActions(previous);
    setFileState(null);

    const thisUpdate = calculateFileUpdateFromChanges(other.id, thisChangedTags, thisNewValues);
    const thatUpdate = calculateFileUpdateFromChanges(file.id, thatChangedTags, thatNewValues);

    if (thisUpdate) {
        actions.push(thisUpdate);
    }
    if (thatUpdate) {
        actions.push(thatUpdate);
    }

    return actions;
}

function calculateFileUpdateFromChanges(id: string, tags: string[], values: any[]): FileUpdatedEvent {
    if (tags.length === 0) {
        return null;
    }
    let partial: PartialFile = {
        tags: {}
    };
    for(let i = 0; i < tags.length; i++) {
        partial.tags[tags[i]] = values[i];
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
     * The name of the event.
     */
    eventName: string;
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

export function action(eventName: string, fileIds: string[] = null): Action {
    return {
        type: 'action',
        fileIds,
        eventName,
    };
}

export function addState(state: FilesState): ApplyStateEvent {
    return {
        type: 'apply_state',
        state: state
    };
}