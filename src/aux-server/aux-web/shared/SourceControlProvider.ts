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

import type { Bot } from '@casual-simulation/aux-common';
import { AuxFileSystemEvent } from '@casual-simulation/aux-common/bots/AuxFileSystem';
import type { SimulationManager } from '@casual-simulation/aux-vm';
import type { BotManager } from '@casual-simulation/aux-vm-browser';
import type {
    GitRepoSCP,
    GitSCPProvider,
} from '@casual-simulation/aux-vm-browser/git/AuxIsomorphicGit';
import Vue from 'vue';

export enum VFileExt {
    LISTENER = '.tsx',
    MOD = '.json',
    PLAIN = '.txt',
}

export class VFile {
    constructor(
        /**
         * The file contents represented as a string.
         * * Effectively tag values.
         */
        public contents: string,
        /**
         * The name of the file (tag name).
         */
        public name: string,
        /**
         * The type / extension of the file.
         */
        public extension: VFileExt,
        /**
         * The directory which holds this file.
         */
        public parentDir: VGenericDirectory,
        /**
         * The bot which holds this file (tag).
         */
        public bot: Bot
    ) {}
}

type Is<a, b> = a extends b ? true : false;

export abstract class VGenericDirectory {
    abstract get pwd(): string;
    abstract get items(): Set<VDir | VFile>;
    abstract get bot(): Bot | undefined;
    abstract get dirName(): string;

    addDirectory(dirName: string, bot?: Bot): VDir | void {
        const newDir = new VDir(dirName, this, bot);
        return this.addItem(newDir);
    }

    addFile(
        fileName: string,
        contents: string,
        extension: VFileExt,
        bot: Bot
    ): VFile | void {
        const newFile = new VFile(contents, fileName, extension, this, bot);
        return this.addItem(newFile);
    }

    protected addItem<T extends VDir | VFile>(i: T): T | void {
        if (this.bot) {
            if (i instanceof VFile) {
                if (i.bot.id !== this.bot.id) {
                    console.warn(
                        '[VRoot]: A sub file (tag) should be on the same bot containing it.'
                    );
                    return;
                }
            } else if (i instanceof VDir) {
                if (i.bot && i.bot.id == this.bot.id) {
                    console.warn(
                        '[VRoot]: A sub directory (bot) cannot be the same bot containing it.'
                    );
                    return;
                }
            }
        } else {
            if (i instanceof VFile) {
                console.warn(
                    '[VRoot]: A sub file (tag) cannot be added to a generic directory without a bot.'
                );
                return;
            }
        }
        this.items.add(i);
        return i;
    }

    /**
     * Gets directory items as an Array for easy array operations.
     */
    get childItems(): Array<VDir | VFile> {
        return Array.from(this.items);
    }
}

export class VRoot extends VGenericDirectory {
    /**
     * Instance of VRoot is also useful.
     */
    public readonly isRoot: boolean = true;
    private _items: Set<VDir | VFile> = new Set();

    get items() {
        return this._items;
    }

    get pwd(): string {
        return this.parentDirectoryPath + '/' + this.dirName;
    }

    constructor(
        /**
         * The path to this directory (excluding this directory name).
         * This is used to indicate the working directory inside a repo.
         * E.G., "/myRepo/instBots"
         */
        public parentDirectoryPath: string,
        /**
         * The root directory name.
         * This will be the working directory inside given parentDirectoryPath.
         * E.G., "root"
         */
        public dirName: string,
        /**
         * The bot which holds this root (tag).
         * If undefined, this is a generic root not tied to any bot.
         */
        public bot: Bot = undefined
    ) {
        super();
    }

    get VDir() {
        return VDir;
    }

    get VFile() {
        return VFile;
    }
}

export class VDir extends VGenericDirectory {
    public readonly isRoot: false = false as const;
    private _items: Set<VDir | VFile> = new Set();

    get items() {
        return this._items;
    }

    get pwd(): string {
        return this.parentDir.pwd + '/' + this.dirName;
    }

    constructor(
        /**
         * The directory name (part of system tag).
         */
        public dirName: string,
        /**
         * The directory
         */
        public parentDir: VGenericDirectory,
        /**
         * The bot which holds this directory (tag).
         * If no bot is provided, this directory serves as a grouping directory only and should not contain files.
         */
        public bot: Bot = undefined
    ) {
        super();
    }
}

export class SourceControlController {
    private _currentRepoSCP: GitRepoSCP;
    reactiveStore = Vue.observable({
        /** The working directory inside the selected repo where source control concerns are rooted. */
        instanceWorkingDirectory: undefined,
        visualFS: {
            rootMeta: '',
            root: null,
        },
    });

    constructor(
        private _gitSCP: GitSCPProvider,
        private _sim: SimulationManager<BotManager>
    ) {
        this._gitSCP.fs.on(
            AuxFileSystemEvent.FileChanged,
            async (path: string) => this.storeFileChange(path)
        );
        this._gitSCP.fs.on(
            AuxFileSystemEvent.FileDeleted,
            async (path: string) => this.storeFileDeletion(path)
        );
        this._gitSCP.fs.on(
            AuxFileSystemEvent.DirectoryCreated,
            async (path: string) => this.storeDirectoryCreation(path)
        );
        this._gitSCP.fs.on(
            AuxFileSystemEvent.DirectoryDeleted,
            async (path: string) => this.storeDirectoryDeletion(path)
        );
    }

    storeFileChange(path: string) {
        //TODO: Implement
    }
    storeFileDeletion(path: string) {
        //TODO: Implement
    }
    storeDirectoryCreation(path: string) {
        //TODO: Implement
    }
    storeDirectoryDeletion(path: string) {
        //TODO: Implement
    }

    async init(): Promise<void> {
        this.reactiveStore.visualFS.root = new VRoot('/', 'root');
        console.log(await this._gitSCP.gitStore.listLocalRepoEntries());
    }
}
