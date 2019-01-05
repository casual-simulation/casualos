import { ReducingStateStore, Event } from "../channels-core";
import {File, Object, Workspace, PartialFile} from './File';
import {merge, filter, values} from 'lodash';
import { tagsMatchingFilter, createCalculationContext, FileCalculationContext, calculateFileValue, convertToFormulaObject } from './FileCalculations';

export interface FilesState {
    [id: string]: File;
}

export type FileEvent = 
    FileAddedEvent | 
    FileRemovedEvent | 
    FileUpdatedEvent |
    ActionEvent;

/**
 * Defines the base reducer for the files channel.
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
    } else if(event.type === 'action') {
        return actionReducer(state, event);
    }

    return state;
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

/**
 * The reducer for the "action" event type.
 * @param state 
 * @param event 
 */
function actionReducer(state: FilesState, event: ActionEvent) {
    const objects = <Object[]>values(state).filter(f => f.type === 'object');
    const sender = <Object>state[event.senderFileId];
    const receiver = <Object>state[event.receiverFileId];
    const context = createCalculationContext(objects);
    const events = [
        ...eventActions(objects, context, sender, receiver, event.eventName),
        ...eventActions(objects, context, receiver, sender, event.eventName),
    ];

    return applyEvents(state, events);
}

function eventActions(objects: Object[], context: FileCalculationContext, file: Object, other: Object, eventName: string): FileEvent[] {
    const filters = tagsMatchingFilter(file, other, eventName);
    const scripts = filters.map(f => calculateFileValue(context, file, f));
    let actions: FileEvent[] = [];
    
    scripts.forEach(s => context.sandbox.run(s, {}, file, [
        { name: 'that', value: convertToFormulaObject(context, other) },
        { name: '__actions', value: actions }
    ]));

    return actions;
}

function applyEvents(state: FilesState, actions: FileEvent[]) {
    for (let i = 0; i < actions.length; i++) {
        state = filesReducer(state, actions[i]);
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
 * Defines an event for actions.
 * Actions are basically user-defined events.
 */
export interface ActionEvent extends Event {
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

export function fileRemoved(file: File): FileRemovedEvent {
    return {
        type: 'file_removed',
        id: file.id,
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