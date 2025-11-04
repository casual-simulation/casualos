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
import type { AuxFileSystem } from '../../aux-common/bots/AuxFileSystem';
import LightningFS from '@isomorphic-git/lightning-fs';

/** The IDB store name LightningFS will use. */
export const LIGHTNING_FS_NAME = 'AuxLightningFS' as const;

export class AuxFSLightningFS implements AuxFileSystem {
    constructor(
        private _fs: LightningFS = new LightningFS(LIGHTNING_FS_NAME)
    ) {}
    readFile(path: string, opts?: any): Promise<string> {
        return this._fs.promises.readFile(path, opts ?? { encoding: 'utf8' });
    }
    writeFile(path: string, content: string, opts?: any): Promise<void> {
        return this._fs.promises.writeFile(path, content, opts);
    }
    unlink(path: string, opts?: any): Promise<void> {
        return this._fs.promises.unlink(path, opts);
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
        await this._fs.promises.mkdir(path);
    }
    async rmdir(path: string): Promise<void> {
        await this._fs.promises.rmdir(path);
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
