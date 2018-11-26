
import {File} from './File';

export type Event = CreateFileEvent | FileCreatedEvent;

export interface CreateFileEvent {
    type: 'create_file';
}

export interface FileCreatedEvent {
    type: 'file_created'
    file: File;
}

export function createFile(): CreateFileEvent {
    return {
        type: 'create_file'
    };
}

export function fileCreated(file: File): FileCreatedEvent {
    return {
        type: 'file_created',
        file: file
    };
}