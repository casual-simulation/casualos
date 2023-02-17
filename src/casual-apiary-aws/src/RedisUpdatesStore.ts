import { RedisClient } from 'redis';
import { promisify } from 'util';
import { StoredUpdates, UpdatesStore } from './UpdatesStore';
import { spanify } from './Utils';
import { sumBy } from 'lodash';

export class RedisUpdatesStore implements UpdatesStore {
    private _globalNamespace: string;
    private _redis: RedisClient;

    private rpush: (args: [string, ...string[]]) => Promise<number>;
    private incr: (args: [string]) => Promise<number>;
    private incrBy: (args: [string, number]) => Promise<number>;
    private lrange: (
        key: string,
        start: number,
        end: number
    ) => Promise<string[]>;
    private del: (key: string) => Promise<void>;

    constructor(globalNamespace: string, client: RedisClient) {
        this._globalNamespace = globalNamespace;
        this._redis = client;

        this._redis.rpush('key', 'abc');

        this.del = spanify(
            'Redis DEL',
            promisify(this._redis.del).bind(this._redis)
        );
        this.rpush = spanify(
            'Redis RPUSH',
            promisify(this._redis.rpush).bind(this._redis)
        );
        this.lrange = spanify(
            'Redis LRANGE',
            promisify(this._redis.lrange).bind(this._redis)
        );
        this.incr = spanify(
            'Redis INCR',
            promisify(this._redis.incr).bind(this._redis)
        );
        this.incrBy = spanify(
            'Redis INCRBY',
            promisify(this._redis.incrby).bind(this._redis)
        );
    }

    async getUpdates(branch: string): Promise<StoredUpdates> {
        const key = branchKey(this._globalNamespace, branch);
        const updates = await this.lrange(key, 0, -1);
        let u = [] as string[];
        let timestamps = [] as number[];
        for (let update of updates) {
            const index = update.indexOf(':');
            if (index >= 0) {
                const up = update.slice(0, index);
                const timestamp = parseInt(update.slice(index + 1));
                u.push(up);
                timestamps.push(timestamp);
            } else {
                u.push(update);
                timestamps.push(-1);
            }
        }
        return {
            updates: u,
            timestamps: timestamps.length > 0 ? timestamps : null,
        };
    }

    async addUpdates(branch: string, updates: string[]): Promise<void> {
        const key = branchKey(this._globalNamespace, branch);
        const count = countKey(this._globalNamespace, branch);
        const size = sizeKey(this._globalNamespace, branch);

        const finalUpdates = updates.map((u) => `${u}:${Date.now()}`);

        // Updates are assumed to be ASCII (usually Base64-encoded strings),
        // so the size in bytes is just the sum of the length of each string.
        const updatesSize = sumBy(updates, (u) => u.length);

        await Promise.all([
            this.rpush([key, ...finalUpdates]),
            this.incr([count]),
            this.incrBy([size, updatesSize]),
        ]);
    }

    async clearUpdates(branch: string): Promise<void> {
        const key = branchKey(this._globalNamespace, branch);
        await this.del(key);
    }
}

function branchKey(globalNamespace: string, branch: string) {
    return `/${globalNamespace}/updates/${branch}`;
}

function countKey(globalNamespace: string, branch: string) {
    return `/${globalNamespace}/updateCount/${branch}`;
}

function sizeKey(globalNamespace: string, branch: string) {
    return `/${globalNamespace}/updateSize/${branch}`;
}
