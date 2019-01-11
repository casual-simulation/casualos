import {merge, filter, values, union, keys, isEqual, transform} from 'lodash';
import {
    map as rxMap,
    flatMap as rxFlatMap,
    pairwise as rxPairwise,
    startWith
} from 'rxjs/operators';
import { ReducingStateStore, Event, ChannelConnection } from "../channels-core";
import {File, Object, Workspace, PartialFile} from './File';
import { tagsMatchingFilter, createCalculationContext, FileCalculationContext, calculateFileValue, convertToFormulaObject } from './FileCalculations';
import { Transform } from 'stream';
import { some } from 'bluebird';

export interface FilesState {
    [id: string]: File;
}

export interface FilesStateDiff {
    prev: FilesState;
    current: FilesState;

    addedFiles: File[];
    removedFiles: File[];
    updatedFiles: File[];
}

/**
 * Defines an interface for file data that contains merge conflicts.
 */
export interface FileConflicts {
    [id: string]: {
        __first: any,
        __second: any
    } | FileConflicts;
}

/**
 * Defines an interface for a file that is being merged with another file.
 */
export interface MergedFile {
    /**
     * Whether the merge operation was successful.
     */
    success: boolean;

    /**
     * The base version of the file.
     */
    base: File;

    /**
     * The changes that the first parent made to this file.
     */
    first: PartialFile;

    /**
     * The changes that the second parent made to this file.
     */
    second: PartialFile;

    /**
     * The conflicts that exist between the first and second parents.
     */
    conflicts: FileConflicts;

    /**
     * The final version of the file.
     */
    final: PartialFile;
}

export interface FileMergeDiff {
    addedFiles: MergedFile[];
    removedFiles: MergedFile[];
    updatedFiles: MergedFile[];
}

export interface FileMergeResult {
    success: boolean;
    changes: FilesStateDiff;
}

export type FileEvent = 
    FileAddedEvent | 
    FileRemovedEvent | 
    FileUpdatedEvent |
    FileTransactionEvent;

/**
 * Defines the base reducer for the files channel. For more info google "Redux reducer".
 * @param state The current state.
 * @param event The event that should be used to manipulate the state.
 */
export function filesReducer(state: FilesState, event: FileEvent) {
    state = state || {};

    if (event.type === 'file_added') {
        return fileAddedReducer(state, event);
    } else if(event.type === 'file_removed') {
        return fileRemovedReducer(state, event);
    } else if(event.type === 'file_updated') {
        return fileUpdatedReducer(state, event);
    } else if(event.type === 'transaction') {
        return applyEvents(state, event.events);
    }

    return state;
}

/**
 * Calculates the difference between the two given states.
 * In particular, it calculates which operations need to be performed on prev in order to get current.
 * The returned object contains the files that were added, removed, and/or updated between the two states.
 * This operation runs in O(n) time where n is the number of files.
 * @param prev The previous state.
 * @param current The current state.
 * @param event If provided, this event will be used to help short-circut the diff calculation to be O(1) whenever the event is a 'file_added', 'file_removed', or 'file_updated' event.
 */
export function calculateStateDiff(prev: FilesState, current: FilesState, event?: FileEvent): FilesStateDiff {

    if (event) {
        if (event.type === 'file_added') {
            return {
                prev: prev,
                current: current,
                addedFiles: [current[event.id]],
                removedFiles: [],
                updatedFiles: []
            };
        } else if(event.type === 'file_removed') {
            return {
                prev: prev,
                current: current,
                addedFiles: [],
                removedFiles: [prev[event.id]],
                updatedFiles: []
            };
        } else if(event.type === 'file_updated') {
            return {
                prev: prev,
                current: current,
                addedFiles: [],
                removedFiles: [],
                updatedFiles: [current[event.id]]
            };
        }
    }

    let diff: FilesStateDiff = {
        prev: prev,
        current: current,
        addedFiles: [],
        removedFiles: [],
        updatedFiles: []
    };

    const ids = union(keys(prev), keys(current));

    ids.forEach(id => {
        const prevVal = prev[id];
        const currVal = current[id];
        
        if (prevVal && !currVal) {
            diff.removedFiles.push(prevVal);
        } else if(!prevVal && currVal) {
            diff.addedFiles.push(currVal);
        } else if(prevVal !== currVal) {
            diff.updatedFiles.push(currVal);
        }
    });

    return diff;
}

export interface DiffOptions {
    /**
     * Whether the diff results should contain
     * both parents or just the changes needed to turn parent 1 into parent 2.
     */
    fullDiff?: boolean;
}

/**
 * Calculates the diff between two objects.
 * @param first The first object.
 * @param second The second object.
 */
export function objDiff(firstId: symbol | string, first: any, secondId: symbol | string, second: any, options?: DiffOptions) {
    const opts = merge({
        fullDiff: true
    }, options || {});
    let diff: FileConflicts = {};
    let allKeys = union(keys(first), keys(second));

    allKeys.forEach(key => {
        const firstVal = first[key];
        const secondVal = second[key];

        if (!isEqual(firstVal, secondVal)) {
            if (!Array.isArray(firstVal) && !Array.isArray(secondVal) &&  typeof firstVal === 'object' && typeof secondVal === 'object') {
                diff[key] = objDiff(firstId, firstVal, secondId, secondVal, opts);
            } else if(opts.fullDiff) {
                diff[key] = {
                    [firstId]: firstVal,
                    [secondId]: secondVal
                };
            } else {
                diff[key] = secondVal;
            }
        }
    });

    return diff;
}

/**
 * Attempts to merge the two given files together.
 * @param base The last shared file between the two parents.
 * @param parent1 The first parent.
 * @param parent2 The second parent.
 * @param options The merge options.
 */
export function mergeFile(base: File, parent1: File, parent2: File, options?: any): MergedFile {
    const baseId = Symbol('base');
    const parent1Id = Symbol('parent1');
    const parent2Id = Symbol('parent2');
    const diff1Id = Symbol('diff1');
    const diff2Id = Symbol('diff2');
    let parent1Diff = objDiff(baseId, base, parent1Id, parent1, { fullDiff: false });
    let parent2Diff = objDiff(baseId, base, parent2Id, parent2, { fullDiff: false });
    let diffDiff = objDiff(diff1Id, parent1Diff, diff2Id, parent2Diff);
    let conflicts = diffConflicts(diffDiff, diff1Id, diff2Id);
    let final = diffNonConflicts(diffDiff, diff1Id, diff2Id) || {};

    let merged: MergedFile = {
        base: base,
        first: parent1,
        second: parent2,
        conflicts: conflicts,
        final: final,
        success: conflicts === null
    };

    return merged;
}

/**
 * Reduces the the given nested file conflicts to a single deep file conflicts file.
 * @param diff 
 */
function diffConflicts(diff: FileConflicts, parent1Id: symbol | string, parent2Id: symbol | string): FileConflicts {
    const results: any = transform(diff, (result: any, value: any, key) => {
        const isDiff = value && typeof value === 'object' && value.hasOwnProperty(parent1Id);
        let parent1: FileConflicts = value[parent1Id];
        let parent2: FileConflicts = value[parent2Id];

        // Value was modified by first but not by second.
        // No Conflict.
        if (typeof parent1 !== 'undefined' && typeof parent2 === 'undefined') {
            
            // Value was modified by second but not by first.
            // No Conflict.
        } else if(typeof parent1 === 'undefined' && typeof parent2 !== 'undefined') {
          
            // Value was modified by neither. No conflict.
        } else if(isDiff && typeof parent1 === 'undefined' && typeof parent2 === 'undefined') { 

            // Value was modified by both and they're different.
            // (otherwise it wouldn't be in the diff)
            // Conflict.
        } else if(isDiff) {
            result[key] = {
                first: parent1,
                second: parent2
            };

            // Value isn't a diff.
        } else {
            const conflicts = diffConflicts(value, parent1Id, parent2Id);
            if (conflicts) {
                result[key] = conflicts;
            }
        }
    }, {});

    const k = keys(results);
    if (k.length > 0) {
        return results;
    } else {
        return null;
    }
}

function diffNonConflicts(diff: FileConflicts, parent1Id: symbol | string, parent2Id: symbol | string): PartialFile {
    const results = transform(diff, (result, value: any, key) => {
        const isDiff = value && typeof value === 'object' && value.hasOwnProperty(parent1Id);
        let parent1: FileConflicts = value[parent1Id];
        let parent2: FileConflicts = value[parent2Id];
        
        // Value was modified by first but not by second.
        // No Conflict.
        if (typeof parent1 !== 'undefined' && typeof parent2 === 'undefined') {
            result[key] = parent1;
            
            // Value was modified by second but not by first.
            // No Conflict.
        } else if(typeof parent1 === 'undefined' && typeof parent2 !== 'undefined') {
            result[key] = parent2;
          
            // Value was modified by neither. No conflict.
        } else if(isDiff && typeof parent1 === 'undefined' && typeof parent2 === 'undefined') { 
            result[key] = null;

            // Value was modified by both and they're different.
            // (otherwise it wouldn't be in the diff)
            // Conflict.
        } else if(isDiff) {

            // Value isn't a diff.
        } else {
            const conflicts = diffNonConflicts(value, parent1Id, parent2Id);
            if (conflicts) {
                result[key] = conflicts;
            }
        }
    }, {});

    const k = keys(results);
    if (k.length > 0) {
        return results;
    } else {
        return null;
    }
}

/**
 * Attempts to merge the two given file states together.
 * If successful, the returned result will be successful and the resulting transaction events can be retreived from endMergeFiles().
 * @param base The last shared file state between parent1 and parent2.
 * @param parent1 The first parent of the merge.
 * @param parent2 The last parent of the merge.
 * @param options The merge options.
 */
export function beginMergeFiles(base: FilesState, parent1: FilesState, parent2: FilesState, options?: any) {
    return {success: true, changes: {}};
}

/**
 * Builds the fileAdded, fileRemoved, and fileUpdated observables from the given channel connection.
 * @param connection The channel connection.
 */
export function fileChangeObservables(connection: ChannelConnection<FilesState>) {
    const states = connection.events.pipe(
        rxMap(e => ({state: connection.store.state(), event: e})), 
        startWith({state: connection.store.state(), event: null})
    );

    // pair new states with their previous values
    const statePairs = states.pipe(rxPairwise());

    // calculate the difference between the current state and new state.
    const stateDiffs = statePairs.pipe(rxMap(pair => {
      const prev = pair[0];
      const curr = pair[1];

      return calculateStateDiff(prev.state, curr.state, <FileEvent>curr.event);
    }));

    const fileAdded = stateDiffs.pipe(rxFlatMap(diff => diff.addedFiles));

    const fileRemoved = stateDiffs.pipe(
      rxFlatMap(diff => diff.removedFiles),
      rxMap(f => f.id)
    );

    const fileUpdated = stateDiffs.pipe(rxFlatMap(diff => diff.updatedFiles));

    return {
        fileAdded,
        fileRemoved,
        fileUpdated
    };
}

/**
 * Calculates the set of events that should be run for the given action.
 * @param state The current file state.
 * @param action The action to process.
 */
export function calculateActionEvents(state: FilesState, action: Action): FileEvent[] {
    const objects = <Object[]>values(state).filter(f => f.type === 'object');
    const sender = <Object>state[action.senderFileId];
    const receiver = <Object>state[action.receiverFileId];
    const context = createCalculationContext(objects);
    const events = [
        ...eventActions(objects, context, sender, receiver, action.eventName),
        ...eventActions(objects, context, receiver, sender, action.eventName),
        fileUpdated(sender.id, {
            tags: {
                _destroyed: true
            }
        }),
        fileUpdated(receiver.id, {
            tags: {
                _destroyed: true
            }
        })
    ];

    return events;
}

/**
 * The reducer for the "file_added" event type.
 * @param state 
 * @param event 
 */
function fileAddedReducer(state: FilesState, event: FileAddedEvent) {
    return merge({}, state, {
        [event.id]: event.file
    });
}

/**
 * The reducer for the "file_removed" event type.
 * @param state 
 * @param event 
 */
function fileRemovedReducer(state: FilesState, event: FileRemovedEvent) {
    const { [event.id]: removed, ...others } = state;
    return others;
}

/**
 * The reducer for the "file_updated" event type.
 * @param state 
 * @param event 
 */
function fileUpdatedReducer(state: FilesState, event: FileUpdatedEvent) {
    const newData = merge({}, state, {
        [event.id]: event.update
    });

    for(let property in newData[event.id].tags) {
        let value = newData[event.id].tags[property];
        if (value === null) {
            delete newData[event.id].tags[property];
        }
    }

    return newData;
}

function eventActions(objects: Object[], context: FileCalculationContext, file: Object, other: Object, eventName: string): FileEvent[] {
    const filters = tagsMatchingFilter(file, other, eventName);
    const scripts = filters.map(f => calculateFileValue(context, other, f));
    let actions: FileEvent[] = [];
    
    scripts.forEach(s => context.sandbox.run(s, {}, convertToFormulaObject(context, other), {
        that: convertToFormulaObject(context, file),
        __actions: actions
    }));

    return actions;
}

function applyEvents(state: FilesState, events: FileEvent[]) {
    for (let i = 0; i < events.length; i++) {
        state = filesReducer(state, events[i]);
    }

    return state;
}

export class FilesStateStore extends ReducingStateStore<FilesState> {
    constructor(defaultState: FilesState) {
        super(defaultState, filesReducer);
    }
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
 * Defines an event for actions.
 * Actions are basically user-defined events.
 */
export interface Action {
    type: 'action';

    /**
     * The file that is "sending" the event.
     * 
     */
    senderFileId: string;

    /**
     * The file that is "receiving" the event.
     */
    receiverFileId: string;

    /**
     * The name of the event.
     */
    eventName: string;
}

export function fileAdded(file: File): FileAddedEvent {
    return {
        type: 'file_added',
        id: file.id,
        file: file,
        creation_time: new Date()
    };
}

export function fileRemoved(fileId: string): FileRemovedEvent {
    return {
        type: 'file_removed',
        id: fileId,
        creation_time: new Date()
    };
}

export function fileUpdated(id: string, update: PartialFile): FileUpdatedEvent {
    return {
        type: 'file_updated',
        id: id,
        update: update,
        creation_time: new Date()
    };
}

export function transaction(events: FileEvent[]): FileTransactionEvent {
    return {
        type: 'transaction',
        creation_time: new Date(),
        events: events
    };
}

export function action(senderFileId: string, receiverFileId: string, eventName: string): Action {
    return {
        type: 'action',
        senderFileId,
        receiverFileId,
        eventName,
    };
}