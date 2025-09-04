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

import type { AuxFileSystem } from '@casual-simulation/aux-common/bots/AuxFileSystem';
import { AuxFSLightningFS } from '@casual-simulation/aux-vm-browser/fs/AuxFSLightningFS';
import { AuxIsomorphicGit } from '@casual-simulation/aux-vm-browser/git/AuxIsomorphicGit';

/**
 * Represents a source control provider for Git.
 */
export interface GitSCP {
    /**
     * Adds a file to staging area.
     * @param path The path of the file to add.
     * @param opts Options for the add operation.
     */
    add(
        path: string,
        opts?: { cache?: object; force?: boolean; parallel?: boolean }
    ): Promise<void>;

    /**
     * Clones a repository from the given URL to the specified directory.
     * @param url The URL of the repository to clone.
     * @param dir The directory where the repository should be cloned.
     * @param opts Options for the clone operation.
     */
    clone(
        url: string,
        dir: string,
        opts?: { ref?: string; singleBranch?: boolean; depth?: number }
    ): Promise<void>;

    /**
     * Commits staged changes to the repository.
     * @param message The commit message.
     * @returns A promise that resolves to the commit hash.
     */
    commit(message: string): Promise<string>;

    /**
     * Returns commit history for the specified path.
     * @param path The path to the file or directory for which to retrieve commit history.
     * @param opts Options for the log operation.
     */
    log(opts: { depth?: number }): Promise<Record<any, any>[]>;

    /**
     * Removes a file from tracking / deletes it from the repository.
     * * This should not delete the file from the file system.
     * @param path The path of the file to remove.
     * @param opts Options for the remove operation.
     */
    remove(path: string, opts?: { cache?: object }): Promise<void>;

    /**
     * Gets the status of the file at the specified path.
     * @param path The path of the file to check status.
     * @param opts Options for the status operation.
     */
    status(path: string, opts?: { cache?: object }): Promise<string>;
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

/** The IDB store name LightningFS will use. */
export const LIGHTNING_FS_NAME = 'git_scp_fs' as const;

/** An implementation of GitSCP using IsomorphicGit */
export class IsomorphicGitSCP implements GitSCP {
    private _fs: AuxFileSystem;
    private _gitHelper: AuxIsomorphicGit;
    /** The author config to use in git actions (e.g. commits). */
    private _gitAuthor: GitAuthor;

    constructor(
        /** The directory the git repository is working from. */
        private _dir: string
    ) {}

    get gitAuthor(): GitAuthor {
        return this._gitAuthor;
    }

    set gitAuthor(author: GitAuthor) {
        this._gitAuthor = author;
    }

    get fs(): AuxFileSystem {
        if (!this._fs) {
            return (this._fs = new AuxFSLightningFS());
        }
        return this._fs;
    }

    get gitHelper(): AuxIsomorphicGit {
        if (!this._gitHelper) {
            return (this._gitHelper = new AuxIsomorphicGit(this.fs));
        }
        return this._gitHelper;
    }

    get git(): AuxIsomorphicGit['git'] {
        return this.gitHelper.git;
    }

    async add(
        path: string,
        opts?: { cache?: object; force?: boolean; parallel?: boolean }
    ): Promise<void> {
        return await this.git.add({
            fs: this._fs,
            dir: this._dir,
            filepath: path,
            cache: opts.cache,
            force: opts.force,
            parallel: opts.parallel,
        });
    }

    async commit(message: string): Promise<string> {
        return await this.git.commit({
            fs: this._fs,
            dir: this._dir,
            message,
            author: this._gitAuthor,
        });
    }

    async log(opts?: { depth?: number }): Promise<Record<any, any>[]> {
        return await this.git.log({
            fs: this._fs,
            dir: this._dir,
            depth: opts.depth,
        });
    }

    async remove(path: string, opts?: { cache?: object }): Promise<void> {
        return await this.git.remove({
            fs: this._fs,
            dir: this._dir,
            filepath: path,
            cache: opts.cache,
        });
    }

    async status(path: string, opts?: { cache?: object }): Promise<string> {
        return await this.git.status({
            fs: this._fs,
            dir: this._dir,
            filepath: path,
            cache: opts.cache,
        });
    }

    async clone(
        url: string,
        dir: string,
        opts: {
            corsProxy?: string;
            depth?: number;
            ref?: string;
            singleBranch?: boolean;
        }
    ): Promise<void> {
        return await this.git.clone({
            fs: this._fs,
            http: AuxIsomorphicGit.http,
            dir: dir,
            url: url,
            corsProxy: opts.corsProxy,
            ref: opts.ref,
            singleBranch: opts.singleBranch,
            depth: opts.depth,
        });
    }
}
