import { CausalRepoStore } from './CausalRepoStore';
import {
    CausalRepoBranch,
    CausalRepoObject,
    getObjectHash,
} from './CausalRepoObject';
import sortBy from 'lodash/sortBy';

export class MemoryCausalRepoStore implements CausalRepoStore {
    private _map: Map<string, CausalRepoObject>;
    private _headsMap: Map<string, Map<string, CausalRepoObject>>;
    private _branches: CausalRepoBranch[];

    constructor() {
        this._map = new Map();
        this._headsMap = new Map();
        this._branches = [];
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
