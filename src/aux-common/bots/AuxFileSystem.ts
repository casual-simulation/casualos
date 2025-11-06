/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

export enum AuxFileSystemEvent {
    FileChanged = 'fileChanged',
    FileDeleted = 'fileDeleted',
    DirectoryCreated = 'directoryCreated',
    DirectoryDeleted = 'directoryDeleted',
}

export interface AuxFileSystemEvents {
    [AuxFileSystemEvent.FileChanged]: (path: string) => void;
    [AuxFileSystemEvent.FileDeleted]: (path: string) => void;
    [AuxFileSystemEvent.DirectoryCreated]: (path: string) => void;
    [AuxFileSystemEvent.DirectoryDeleted]: (path: string) => void;
}

/**
 * Basic POSIX-like file system interface.
 * * Includes events for basic file system operations.
 */
export interface AuxFileSystem {
    /** Add an event listener to an event. */
    on<e extends keyof AuxFileSystemEvents>(
        event: e,
        callback: AuxFileSystemEvents[e]
    ): void;
    /** Remove an event listener from an event. */
    off<e extends keyof AuxFileSystemEvents>(
        event: e,
        callback: AuxFileSystemEvents[e]
    ): void;
    /** Read a file as a string. */
    readFile(path: string, opts?: any): Promise<string>;
    writeFile(path: string, content: string, opts?: any): Promise<void>;
    /** Delete a file. */
    unlink(path: string, opts?: any): Promise<void>;
    exists(path: string): Promise<boolean>;
    ls(path: string): Promise<string[]>;
    mkdir(path: string): Promise<void>;
    rmdir(path: string): Promise<void>;
    readdir(path: string): Promise<string[]>;
    stat(path: string): Promise<any>;
    lstat(path: string): Promise<any>;
    readlink(path: string): Promise<string>;
    symlink(target: string, path: string): Promise<void>;
}
