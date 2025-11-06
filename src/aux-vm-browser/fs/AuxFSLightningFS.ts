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
import {
    AuxFileSystemEvent,
    type AuxFileSystem,
    type AuxFileSystemEvents,
} from '../../aux-common/bots/AuxFileSystem';
import LightningFS from '@isomorphic-git/lightning-fs';

/** The IDB store name LightningFS will use. */
export const LIGHTNING_FS_NAME = 'AuxLightningFS' as const;

export class AuxFSLightningFS implements AuxFileSystem {
    private _handlers: { [event: string]: ((...args: any[]) => void)[] } = {};

    constructor(
        private _fs: LightningFS = new LightningFS(LIGHTNING_FS_NAME)
    ) {}

    on<e extends keyof AuxFileSystemEvents>(
        event: e,
        callback: AuxFileSystemEvents[e]
    ): void {
        if (!this._handlers[event]) {
            this._handlers[event] = [];
        }
        this._handlers[event].push(callback);
    }

    off<e extends keyof AuxFileSystemEvents>(
        event: e,
        callback: AuxFileSystemEvents[e]
    ): void {
        if (this._handlers[event]) {
            this._handlers[event] = this._handlers[event].filter(
                (cb) => cb !== callback
            );
        }
    }

    $emit<e extends keyof AuxFileSystemEvents>(
        event: e,
        ...args: Parameters<AuxFileSystemEvents[e]>
    ): void {
        if (this._handlers[event]) {
            for (const cb of this._handlers[event]) {
                cb(...args);
            }
        }
    }

    async readFile(path: string, opts?: any): Promise<string> {
        return this._fs.promises.readFile(path, opts ?? { encoding: 'utf8' });
    }
    async writeFile(path: string, content: string, opts?: any): Promise<void> {
        return this._fs.promises.writeFile(path, content, opts).then(() => {
            this.$emit(AuxFileSystemEvent.FileChanged, path);
        });
    }
    async unlink(path: string, opts?: any): Promise<void> {
        return this._fs.promises.unlink(path, opts).then(() => {
            this.$emit(AuxFileSystemEvent.FileDeleted, path);
        });
    }
    async exists(path: string): Promise<boolean> {
        try {
            await this._fs.promises.stat(path);
            return true;
        } catch {
            return false;
        }
    }
    async ls(path: string): Promise<string[]> {
        try {
            return await this._fs.promises.readdir(path);
        } catch {
            return [];
        }
    }
    async mkdir(path: string): Promise<void> {
        const parts = path.split('/').filter(Boolean);
        let parentPath = '';
        for (const dir of parts) {
            const currentPath = parentPath + '/' + dir;
            if (!(await this.exists(currentPath))) {
                await this._fs.promises.mkdir(currentPath);
                this.$emit(AuxFileSystemEvent.DirectoryCreated, currentPath);
            }
            parentPath = currentPath;
        }
    }
    async rmdir(path: string): Promise<void> {
        await this._fs.promises.rmdir(path);
        this.$emit(AuxFileSystemEvent.DirectoryDeleted, path);
    }
    async readdir(path: string): Promise<string[]> {
        return this._fs.promises.readdir(path);
    }
    async stat(path: string): Promise<any> {
        return this._fs.promises.stat(path);
    }
    async lstat(path: string): Promise<any> {
        return this._fs.promises.lstat(path);
    }
    async readlink(path: string): Promise<string> {
        return this._fs.promises.readlink(path);
    }
    async symlink(target: string, path: string): Promise<void> {
        return this._fs.promises.symlink(target, path);
    }
}

/**
 * Represents a Git author with a name and email.
 */
export interface GitAuthor {
    /** The name of the author. */
    name: string;
    /** The email of the author. */
    email: string;
}

/**
 * The location where the current git author configuration is stored.
 */
export const CURRENT_GIT_AUTHOR_FILE = '/.aux_config/gitAuthor.json' as const;

/**
 * The root directory to store all repos in a file system.
 * * Useful when looking up existing local repos.
 */
const ROOT_GIT_LOCAL_REPO_DIR = '/git/repos/' as const;

/**
 * A store for git-related information.
 */
export interface AuxGitStore {
    getGitAuthor(): Promise<GitAuthor | undefined>;
    setGitAuthor(author: GitAuthor): Promise<void>;
    listLocalRepoEntries(): Promise<string[]>;
}

/**
 * An implementation of AuxGitStore that uses LightningFS as the storage backend.
 */
export class LightningFSAuxGitStore implements AuxGitStore {
    constructor(private _fs: AuxFileSystem) {}
    async getGitAuthor(): Promise<GitAuthor | undefined> {
        try {
            const authorJSON = await this._fs.readFile(CURRENT_GIT_AUTHOR_FILE);
            const author = JSON.parse(authorJSON);
            if (author && author.name && author.email) {
                return author;
            }
        } catch (_) {
            return undefined;
        }
        return undefined;
    }
    async setGitAuthor(author: GitAuthor): Promise<void> {
        const authorJSON = JSON.stringify(author);
        await this._fs.writeFile(CURRENT_GIT_AUTHOR_FILE, authorJSON);
    }
    async listLocalRepoEntries(): Promise<string[]> {
        return await this._fs.ls(ROOT_GIT_LOCAL_REPO_DIR);
    }
}
