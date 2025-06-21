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
interface GitSCConfig {
    provider: 'isomorphic-git';
}

/**
 * Type representing possible commands for the Isomorphic Git library.
 * Commands as of Isomorphic Git version 1.30.2
 * @link https://github.com/isomorphic-git/isomorphic-git?tab=readme-ov-file#commands
 */
type IsomorphicGitCommands =
    | 'abortMerge'
    | 'add'
    | 'addNote'
    | 'addRemote'
    | 'annotatedTag'
    | 'branch'
    | 'checkout'
    | 'clone'
    | 'commit'
    | 'currentBranch'
    | 'deleteBranch'
    | 'deleteRef'
    | 'deleteRemote'
    | 'deleteTag'
    | 'expandOid'
    | 'expandRef'
    | 'fastForward'
    | 'fetch'
    | 'findMergeBase'
    | 'findRoot'
    | 'getConfig'
    | 'getConfigAll'
    | 'getRemoteInfo'
    | 'getRemoteInfo2'
    | 'hashBlob'
    | 'indexPack'
    | 'init'
    | 'isDescendent'
    | 'isIgnored'
    | 'listBranches'
    | 'listFiles'
    | 'listNotes'
    | 'listRefs'
    | 'listRemotes'
    | 'listServerRefs'
    | 'listTags'
    | 'log'
    | 'merge'
    | 'packObjects'
    | 'pull'
    | 'push'
    | 'readBlob'
    | 'readCommit'
    | 'readNote'
    | 'readObject'
    | 'readTag'
    | 'readTree'
    | 'remove'
    | 'removeNote'
    | 'renameBranch'
    | 'resetIndex'
    | 'resolveRef'
    | 'setConfig'
    | 'stash'
    | 'status'
    | 'statusMatrix'
    | 'tag'
    | 'updateIndex'
    | 'version'
    | 'walk'
    | 'writeBlob'
    | 'writeCommit'
    | 'writeObject'
    | 'writeRef'
    | 'writeTag'
    | 'writeTree';

export interface IGitSource {
    abortMerge: () => Promise<void>;
    add: (args: any) => Promise<void>;
    addNote: (args: any) => Promise<void>;
    addRemote: (args: any) => Promise<void>;
    annotatedTag: (args: any) => Promise<void>;
    branch: (args: any) => Promise<void>;
    checkout: (args: any) => Promise<void>;
    clone: (args: any) => Promise<void>;
    commit: (args: any) => Promise<void>;
    currentBranch: () => Promise<string>;
    deleteBranch: (args: any) => Promise<void>;
    deleteRef: (args: any) => Promise<void>;
    deleteRemote: (args: any) => Promise<void>;
    deleteTag: (args: any) => Promise<void>;
    expandOid: (args: any) => Promise<void>;
    expandRef: (args: any) => Promise<void>;
    fastForward: (args: any) => Promise<void>;
    fetch: (args: any) => Promise<void>;
    findMergeBase: (args: any) => Promise<string>;
    findRoot: (args: any) => Promise<string>;
    getConfig: (args: any) => Promise<string>;
    getConfigAll: (args: any) => Promise<string[]>;
    getRemoteInfo: (args: any) => Promise<any>;
    getRemoteInfo2: (args: any) => Promise<any>;
    hashBlob: (args: any) => Promise<string>;
    indexPack: (args: any) => Promise<void>;
    init: (args: any) => Promise<void>;
    isDescendent: (args: any) => Promise<boolean>;
    isIgnored: (args: any) => Promise<boolean>;
    listBranches: (args: any) => Promise<string[]>;
    listFiles: (args: any) => Promise<string[]>;
    listNotes: (args: any) => Promise<any[]>;
    listRefs: (args: any) => Promise<string[]>;
    listRemotes: (args: any) => Promise<string[]>;
    listServerRefs: (args: any) => Promise<string[]>;
    listTags: (args: any) => Promise<string[]>;
    log: (args: any) => Promise<any[]>;
    merge: (args: any) => Promise<void>;
    packObjects: (args: any) => Promise<void>;
    pull: (args: any) => Promise<void>;
    push: (args: any) => Promise<void>;
    readBlob: (args: any) => Promise<string>;
    readCommit: (args: any) => Promise<any>;
    readNote: (args: any) => Promise<any>;
    readObject: (args: any) => Promise<any>;
    readTag: (args: any) => Promise<any>;
    readTree: (args: any) => Promise<any>;
    remove: (args: any) => Promise<void>;
    removeNote: (args: any) => Promise<void>;
    renameBranch: (args: any) => Promise<void>;
    resetIndex: (args: any) => Promise<void>;
    resolveRef: (args: any) => Promise<string>;
    setConfig: (args: any) => Promise<void>;
    stash: (args: any) => Promise<void>;
    status: (args: any) => Promise<any>;
    statusMatrix: (args: any) => Promise<any[]>;
    tag: (args: any) => Promise<void>;
    updateIndex: (args: any) => Promise<void>;
    version: () => Promise<string>;
    walk: (args: any) => Promise<any>;
    writeBlob: (args: any) => Promise<string>;
    writeCommit: (args: any) => Promise<string>;
    writeObject: (args: any) => Promise<string>;
    writeRef: (args: any) => Promise<void>;
    writeTag: (args: any) => Promise<void>;
    writeTree: (args: any) => Promise<string>;
}

export default class GitSourceController /**implements IGitSource*/ {
    constructor(private _config: GitSCConfig) {}
}
