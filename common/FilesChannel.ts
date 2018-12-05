import { ReducingStateStore, Event } from "./channels-core";
import {File, Object, Workspace} from './File';
import {merge, filter} from 'lodash';

export interface FilesState {
    [id: string]: File;
}

export interface PartialFile {
    id?: string;
    type?: string;
    workspace?: string;
    position?: {
        x?: number;
        y?: number;
        z?: number;
    };
    tags?: {
        [key: string]: any;
    }
}

export type FileEvent = 
    FileAddedEvent | 
    FileRemovedEvent | 
    FileUpdatedEvent;

export function filesReducer(state: FilesState, event: FileEvent) {
    state = state || {};

    if (event.type === 'file_added') {
        return merge({}, state, {
            [event.id]: event.file
        });
    } else if(event.type === 'file_removed') {
        const { [event.id]: removed, ...others } = state;
        return others;
    } else if(event.type === 'file_updated') {
        return merge({}, state, {
            [event.id]: event.update
        });
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