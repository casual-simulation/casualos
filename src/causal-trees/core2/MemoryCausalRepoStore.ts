import { CausalRepoStore } from './CausalRepoStore';
import {
    CausalRepoBranch,
    CausalRepoObject,
    getObjectHash,
    CausalRepoIndex,
    CausalRepoReflog,
    reflog,
    CausalRepoSitelog,
    sitelog,
    CausalRepoSitelogType,
    CausalRepoSitelogConnectionReason,
    CausalRepoBranchSettings,
} from './CausalRepoObject';
import sortBy from 'lodash/sortBy';
import { getAtomHashes } from './AtomIndex';

export class MemoryCausalRepoStore implements CausalRepoStore {
    private _map: Map<string, CausalRepoObject>;
    private _headsMap: Map<string, Map<string, CausalRepoObject>>;
    private _indexes: Map<string, CausalRepoObject[]>;
    private _branches: CausalRepoBranch[];
    private _reflog: Map<string, CausalRepoReflog[]>;
    private _sitelog: Map<string, CausalRepoSitelog[]>;
    private _settings: Map<string, CausalRepoBranchSettings>;

    constructor() {
        this._map = new Map();
        this._headsMap = new Map();
        this._indexes = new Map();
        this._reflog = new Map();
        this._sitelog = new Map();
        this._settings = new Map();
        this._branches = [];
    }

    async getBranchSettings(branch: string): Promise<CausalRepoBranchSettings> {
        return this._settings.get(branch);
    }

    async saveSettings(settings: CausalRepoBranchSettings): Promise<void> {
        this._settings.set(settings.branch, settings);
    }

    async getReflog(branch: string): Promise<CausalRepoReflog[]> {
        let reflog = this._reflog.get(branch);
        if (!reflog) {
            return [];
        }
        return reflog;
    }

    async getSitelog(branch: string): Promise<CausalRepoSitelog[]> {
        let sitelog = this._sitelog.get(branch);
        if (!sitelog) {
            return [];
        }
        return sitelog;
    }

    async logSite(
        branch: string,
        site: string,
        type: CausalRepoSitelogType,
        connectionReason: CausalRepoSitelogConnectionReason
    ): Promise<CausalRepoSitelog> {
        let log = this._sitelog.get(branch);
        if (!log) {
            log = [];
            this._sitelog.set(branch, log);
        }
        const newLog = sitelog(branch, site, type, connectionReason);
        log.unshift(newLog);
        return newLog;
    }

    async loadIndex(
        head: string,
        index: CausalRepoIndex
    ): Promise<CausalRepoObject[]> {
        let data = this._indexes.get(index.data.hash);
        if (!data) {
            return await this.getObjects(head, getAtomHashes(index.data.atoms));
        }
        return data.slice();
    }

    async storeIndex(
        head: string,
        index: string,
        objects: CausalRepoObject[]
    ): Promise<void> {
        this._indexes.set(index, objects);
        await this.storeObjects(head, objects);
    }

    async getObjects(
        head: string,
        keys: string[]
    ): Promise<CausalRepoObject[]> {
        let results: CausalRepoObject[] = [];
        let map = this._getHeadMap(head);
        for (let key of keys) {
            let result = map.get(key);
            results.push(result);
        }

        return results;
    }

    async getObject(key: string): Promise<CausalRepoObject> {
        return this._map.get(key) || null;
    }

    async storeObjects(
        head: string,
        objects: CausalRepoObject[]
    ): Promise<void> {
        let map = this._getHeadMap(head);
        for (let obj of objects) {
            const hash = getObjectHash(obj);
            this._map.set(hash, obj);
            map.set(hash, obj);
        }
    }

    async getBranches(prefix: string): Promise<CausalRepoBranch[]> {
        let branches: CausalRepoBranch[] = [];
        for (let branch of this._branches) {
            if (!prefix || branch.name.indexOf(prefix) === 0) {
                branches.push(branch);
            }
        }

        return sortBy(branches, b => b.name);
    }

    async saveBranch(head: CausalRepoBranch): Promise<void> {
        const index = this._branches.findIndex(b => b.name === head.name);
        if (index >= 0) {
            this._branches[index] = head;
        } else {
            this._branches.push(head);
        }

        let log = this._reflog.get(head.name);
        if (!log) {
            log = [];
            this._reflog.set(head.name, log);
        }
        log.unshift(reflog(head));
    }

    async deleteBranch(head: CausalRepoBranch): Promise<void> {
        const index = this._branches.findIndex(b => b.name === head.name);
        if (index >= 0) {
            this._branches.splice(index, 1);
        }
    }

    private _getHeadMap(head: string): Map<string, CausalRepoObject> {
        let map = this._headsMap.get(head);
        if (!map) {
            map = new Map();
            this._headsMap.set(head, map);
        }

        return map;
    }
}
