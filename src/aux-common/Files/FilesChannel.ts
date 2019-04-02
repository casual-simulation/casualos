import {filter, values, union, keys, isEqual, transform, set, mergeWith, unset, get, sortBy, flatMap} from 'lodash';
import {
    map as rxMap,
    flatMap as rxFlatMap,
    pairwise as rxPairwise,
    startWith
} from 'rxjs/operators';
import { ReducingStateStore, Event, ChannelConnection } from "../channels-core";
import {File, Object, Workspace, PartialFile} from './File';
import { createCalculationContext, FileCalculationContext, calculateFileValue, convertToFormulaObject, isDestroyed, getActiveObjects, calculateStateDiff, FilesStateDiff, filtersMatchingArguments } from './FileCalculations';
import { merge as mergeObj } from '../utils';
import formulaLib, { setActions, getActions, setFileState, setCalculationContext, getCalculationContext } from '../Formulas/formula-lib';
import { AnimationActionLoopStyles } from 'three';
import { SetValueHandler } from './FileProxy';
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
    const factory = (o: File) => {
        return (tag: string, value: any) => {
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
        factory));
    let events = fileEvents;

    const updates = objects.map(o => calculateFileUpdateFromChanges(o.id, changes[o.id].changedTags, changes[o.id].newValues));
    updates.forEach(u => {
        if (u) {
            events.push(u);
        }
    });

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


function eventActions(state: FilesState, 
    objects: Object[], 
    context: FileCalculationContext, 
    file: Object, 
    eventName: string,
    setValueHandlerFactory: (file: File) => SetValueHandler): FileEvent[] {
    const otherObjects = objects.filter(o => o !== file);
    const sortedObjects = sortBy(objects, o => o !== file);
    const filters = filtersMatchingArguments(context, file, eventName, otherObjects);
    const scripts = filters.map(f => calculateFileValue(context, file, f.tag));
    let previous = getActions();
    let prevContext = getCalculationContext();
    let actions: FileEvent[] = [];
    
    let vars: {
        [key: string]: any
    } = {};
    setActions(actions);
    setFileState(state);
    setCalculationContext(context);
    
    let formulaObjects = sortedObjects.map(o => convertToFormulaObject(context, o, setValueHandlerFactory(o)));

    formulaObjects.forEach((obj, index) => {
        if (index === 1) {
            vars['that'] = obj;
        }

        vars[`arg${index}`] = obj;
    });

    scripts.forEach(s => context.sandbox.run(s, {}, formulaObjects[0], vars));

    setActions(previous);
    setFileState(null);
    setCalculationContext(prevContext);

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