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
        public parentDir: VDir | null,
        /**
         * The bot which holds this file (tag).
         */
        public bot: Bot
    ) {}
}

type Is<a, b> = a extends b ? true : false;

export class VRoot {
    /**
     * Instance of VRoot is also useful.
     */
    public readonly isRoot: boolean = true;
    constructor(
        /**
         * Child items (nested dirs and files).
         * * All nested dirs should inheret the bot from this.
         */
        public items: Set<VDir | VFile>,
        /**
         * The path to this directory as if it were working directory in a CLI.
         */
        public pwd: string,
        /**
         * The root directory name.
         */
        public dirName: string
    ) {}
}

export class VDir extends VRoot {
    public readonly isRoot: false = false as const;
    constructor(
        /**
         * Child items (nested dirs and files).
         * * All nested dirs should inheret the bot from this.
         */
        public items: Set<VDir | VFile>,
        /**
         * The path to this directory as if it were working directory in a CLI.
         */
        public pwd: string,
        /**
         * The directory name (part of system tag).
         */
        public dirName: string,
        /**
         * The directory
         */
        public parentDir: VDir
    ) {
        super(items, pwd, dirName);
    }

    /**
     * Adds an item to this directory as a child item.
     * @param i The item to add to the directory.
     */
    // addItem(i: VDir | VFile) {
    //     if (i instanceof VFile) {
    //         if (i.bot !== this.bot) {
    //             throw new Error("[VDir]: A sub file (tag) should be on the same bot containing it.");
    //         }
    //     }
    //     i.parentDir = this;
    //     this.items.add(i);
    // }

    /**
     * Gets directory items as an Array for easy array operations.
     */
    get childItems(): Array<VDir | VFile> {
        return Array.from(this.items);
    }
}

export class SourceControlController {
    private _currentRepoSCP: GitRepoSCP;
    reactiveStore = Vue.observable({
        /** The working directory inside the selected repo where source control concerns are rooted. */
        instanceWorkingDirectory: undefined,
    });

    constructor(
        private _gitSCP: GitSCPProvider,
        private _sim: SimulationManager<BotManager>
    ) {}

    async init(): Promise<void> {
        console.log(await this._gitSCP.gitStore.listLocalRepoEntries());
    }
}
