
import {File, FileType} from './File';

export type Event = CreateFileEvent | FileCreatedEvent | FileDiscoveredEvent | FileRemovedEvent;

export interface CreateFileEvent {
    type: 'create_file';
    file_type: FileType;
}

export interface FileCreatedEvent {
    type: 'file_created'
    file: File;
}

export interface FileDiscoveredEvent {
    type: 'file_discovered',
    file: File
}

export interface FileRemovedEvent {
    type: 'file_removed',
    file: File
}

export function createFile(fileType: FileType): CreateFileEvent {
    return {
        type: 'create_file',
        file_type: fileType
    };
}

export function fileCreated(file: File): FileCreatedEvent {
    return {
        type: 'file_created',
        file: file
    };
}

export function fileDiscovered(file: File): FileDiscoveredEvent {
    return {
        type: 'file_discovered',
        file: file
    };
}

export function fileRemoved(file: File): FileRemovedEvent {
    return {
        type: 'file_removed',
        file: file
    };
}