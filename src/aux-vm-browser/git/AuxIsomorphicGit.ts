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
import http from 'isomorphic-git/http/web';
import type { AuxFileSystem } from '@casual-simulation/aux-common/bots/AuxFileSystem';
import git from 'isomorphic-git';
import type { AuxGitStore, GitAuthor } from '../fs/AuxFSLightningFS';
import {
    AuxFSLightningFS,
    LightningFSAuxGitStore,
} from '../fs/AuxFSLightningFS';
// import { Buffer } from 'buffer';

export type GitProvider = typeof git;

export class AuxIsomorphicGit {
    static get http(): typeof http {
        return http;
    }

    constructor(private _fs: AuxFileSystem) {}

    params(
        additional: any = {}
    ): { http: typeof http; fs: AuxFileSystem } & any {
        return { http, fs: this._fs, ...additional };
    }

    get git(): typeof git {
        return git;
    }
}

/**
 * Represents a source control provider for Git.
 */
export interface GitRepoSCP {
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

    /**
     * Initializes a new Git repository.
     */
    init(): Promise<void>;

    /**
     * Clones a repository from the given URL to the working directory for the SCP instance.
     * @param url The URL of the repository to clone.
     * @param opts Options for the clone operation.
     */
    clone(
        url: string,
        opts: { ref?: string; singleBranch?: boolean; depth?: number }
    ): Promise<void>;
}

export interface GitSCPProvider {
    gitStore: AuxGitStore;
    get fs(): AuxFileSystem;
    getRepoSCP(repositoryName: string): Promise<GitRepoSCP>;
}

/**
 * Formats a directory name to a path part for use in the SCP.
 * @param dir The singular directory name.
 */
export function formatSCPPathDir(dir: string): string {
    return '/' + dir.replace(/[^A-Z0-9_]/gi, '');
}

export class IsomorphicGitSCPProvider implements GitSCPProvider {
    private _repoSCPs: Map<string, IsomorphicGitRepoSCP> = new Map();
    gitStore: AuxGitStore;

    constructor(
        /** The directory the git repository should be stored in. */
        protected _rootDir: string,
        /** The file system to use for git operations. */
        private _fs?: AuxFileSystem,
        /** The author config to use in git actions (e.g. commits). */
        protected _gitAuthor?: GitAuthor,
        /** The git helper to use for git operations. */
        private _gitHelper?: AuxIsomorphicGit
    ) {
        this.gitStore = new LightningFSAuxGitStore(this.fs);
    }

    get fs(): AuxFileSystem {
        if (!this._fs) return this.initFs();
        return this._fs;
    }

    get gitHelper(): AuxIsomorphicGit {
        if (!this._gitHelper) {
            return (this._gitHelper = new AuxIsomorphicGit(this.fs));
        }
        return this._gitHelper;
    }

    initFs(): AuxFileSystem {
        return (this._fs = new AuxFSLightningFS());
    }

    async getRepoSCP(repositoryName: string): Promise<IsomorphicGitRepoSCP> {
        if (this._repoSCPs.has(repositoryName)) {
            return this._repoSCPs.get(repositoryName);
        }
        if (!this._gitAuthor) {
            const cachedAuthor = await this.gitStore.getGitAuthor();
            if (cachedAuthor) {
                this._gitAuthor = cachedAuthor;
            } else {
                this._gitAuthor = {
                    name: 'CasualOS User',
                    email: '',
                };
            }
        }
        const repoSCP = new IsomorphicGitRepoSCP(
            this._rootDir,
            repositoryName,
            this._gitAuthor,
            this.fs,
            this.gitHelper
        );
        this._repoSCPs.set(repositoryName, repoSCP);
        return repoSCP;
    }
}

/** An implementation of GitSCP using IsomorphicGit */
export class IsomorphicGitRepoSCP implements GitRepoSCP {
    constructor(
        /** The directory the git repository should be stored in. */
        private _rootDir: string,
        /** The name of the repository. */
        private _repositoryName: string,
        /** The author config to use in git actions (e.g. commits). */
        private _gitAuthor: GitAuthor,
        /** The file system to use for git operations. */
        private _fs: AuxFileSystem,
        /** The git helper to use for git operations. */
        private _gitHelper: AuxIsomorphicGit
    ) {
        const newRootDir = formatSCPPathDir(this._rootDir);
        if (newRootDir !== this._rootDir) {
            this._rootDir = newRootDir;
            console.warn(
                `[GitSCP]: The provided rootDir "${this._rootDir}" was reformatted to "${newRootDir}". Only alphanumeric characters and underscores are allowed.`
            );
        }
        const newRepoName = formatSCPPathDir(this._repositoryName);
        if (newRepoName !== this._repositoryName) {
            this._repositoryName = newRepoName;
            console.warn(
                `[GitSCP]: The provided repositoryName "${this._repositoryName}" was reformatted to "${newRepoName}". Only alphanumeric characters and underscores are allowed.`
            );
        }
    }

    get fs() {
        return this._fs;
    }

    get gitAuthor(): GitAuthor {
        return this._gitAuthor;
    }

    set gitAuthor(author: GitAuthor) {
        this._gitAuthor = author;
    }

    get git(): AuxIsomorphicGit['git'] {
        return this._gitHelper.git;
    }

    get PWD(): string {
        return this._rootDir + this._repositoryName;
    }

    async add(
        path: string,
        opts?: { cache?: object; force?: boolean; parallel?: boolean }
    ): Promise<void> {
        return await this.git.add({
            fs: this.fs,
            dir: this.PWD,
            filepath: path,
            cache: opts.cache,
            force: opts.force,
            parallel: opts.parallel,
        });
    }

    async commit(message: string): Promise<string> {
        return await this.git.commit({
            fs: this.fs,
            dir: this.PWD,
            message,
            author: this._gitAuthor,
        });
    }

    async log(opts?: { depth?: number }): Promise<Record<any, any>[]> {
        return await this.git.log({
            fs: this.fs,
            dir: this.PWD,
            depth: opts.depth,
        });
    }

    async remove(path: string, opts?: { cache?: object }): Promise<void> {
        return await this.git.remove({
            fs: this.fs,
            dir: this.PWD,
            filepath: path,
            cache: opts.cache,
        });
    }

    async status(path: string, opts?: { cache?: object }): Promise<string> {
        return await this.git.status({
            fs: this.fs,
            dir: this.PWD,
            filepath: path,
            cache: opts.cache,
        });
    }

    async init(): Promise<void> {
        const dir = this.PWD;
        if (await this.fs.exists(dir)) {
            if (await this.fs.exists(dir + '/.git')) {
                console.warn(
                    `[GitSCP]: Repository already initialized at ${dir}`
                );
                return;
            }
        }
        await this.fs.mkdir(dir);
        return await this.git.init({
            fs: this.fs,
            dir: dir,
        });
    }

    async clone(
        url: string,
        opts: {
            corsProxy?: string;
            depth?: number;
            ref?: string;
            singleBranch?: boolean;
        }
    ): Promise<void> {
        return await this.git.clone({
            fs: this.fs,
            http: AuxIsomorphicGit.http,
            dir: this.PWD,
            url: url,
            corsProxy: opts.corsProxy,
            ref: opts.ref,
            singleBranch: opts.singleBranch,
            depth: opts.depth,
        });
    }
}
