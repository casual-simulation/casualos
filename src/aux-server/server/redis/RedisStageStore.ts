import {
    CausalRepoStageStore,
    AtomIndexFullDiff,
    Atom,
    atomIdToString,
} from '@casual-simulation/causal-trees/core2';
import { RedisClient } from 'redis';
import { promisify } from 'util';

/**
 * Defines a stage store that is backed by Redis.
 * This is optimal for servers where data can be lost if the server crashes or restarts before data is saved to the database.
 */
export class RedisStageStore implements CausalRepoStageStore {
    private _redis: RedisClient;
    private lrange: (
        key: string,
        start: number,
        end: number
    ) => Promise<string[]>;
    private rpush: (key: string, ...values: string[]) => Promise<void>;
    private del: (key: string) => Promise<void>;

    constructor(redis: RedisClient) {
        this._redis = redis;

        this.lrange = promisify(this._redis.lrange).bind(this._redis);
        this.del = promisify(this._redis.del).bind(this._redis);
        this.rpush = promisify(this._redis.rpush).bind(this._redis);
    }

    async getStage(branch: string): Promise<AtomIndexFullDiff> {
        const addedJson = await this.lrange(addedKey(branch), 0, -1);
        const removedJson = await this.lrange(removedKey(branch), 0, -1);
        const added = addedJson.map(a => JSON.parse(a));
        const removed = removedJson.map(a => JSON.parse(a));
        let deletions: AtomIndexFullDiff['deletions'] = {};
        for (let atom of removed) {
            deletions[atom.hash] = atomIdToString(atom.id);
        }

        return {
            additions: added,
            deletions: deletions,
        };
    }

    async clearStage(branch: string): Promise<void> {
        await this.del(addedKey(branch));
        await this.del(removedKey(branch));
    }

    async addAtoms(branch: string, atoms: Atom<any>[]): Promise<void> {
        await this.rpush(
            addedKey(branch),
            ...atoms.map(a => JSON.stringify(a))
        );
    }

    async removeAtoms(branch: string, atoms: Atom<any>[]): Promise<void> {
        await this.rpush(
            removedKey(branch),
            ...atoms.map(a => JSON.stringify(a))
        );
    }
}

function addedKey(branch: string) {
    return `/stage/added/${branch}`;
}

function removedKey(branch: string) {
    return `/stage/removed/${branch}`;
}
