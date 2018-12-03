
import {File, FileType} from './File';

export type Event = 
    FileCreatedEvent | 
    FileDiscoveredEvent | 
    FileRemovedEvent | 
    CommitAddedEvent |
    FileUpdatedEvent;

export interface EventBase {
    /**
     * Whether this event was from a remote server.
     */
    remote: boolean;
}

export interface FileCreatedEvent extends EventBase {
    type: 'file_created';
    file: File;
}

export interface FileDiscoveredEvent extends EventBase {
    type: 'file_discovered';
    file: File;
}

export interface FileRemovedEvent extends EventBase {
    type: 'file_removed';
    file: File;
}

export interface FileUpdatedEvent extends EventBase {
    type: 'file_updated';
    file: File;
}

export interface CommitAddedEvent extends EventBase {
    type: 'commit_added';

    /**
     * The SHA1 hash of the commit.
     */
    hash: string;

    /**
     * The branch that the commit was made on.
     */
    branch: string;

    /**
     * The author of the commit.
     */
    author: {
        email: string;
        username: string;
    };
}

export function fileCreated(file: File): FileCreatedEvent {
    return {
        type: 'file_created',
        remote: false,
        file: file
    };
}

export function fileDiscovered(file: File): FileDiscoveredEvent {
    return {
        type: 'file_discovered',
        remote: false,
        file: file
    };
}

export function fileRemoved(file: File): FileRemovedEvent {
    return {
        type: 'file_removed',
        remote: false,
        file: file
    };
}

export function fileUpdated(file: File): FileUpdatedEvent {
    return {
        type: 'file_updated',
        remote: false,
        file: file
    };
}

export function commitAdded(hash: string, branch: string, email: string, username: string): CommitAddedEvent {
    return {
        type: 'commit_added',
        remote: false,
        hash: hash,
        branch: branch,
        author: {
            email,
            username
        },
    };
}
