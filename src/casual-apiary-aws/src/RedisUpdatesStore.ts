import { RedisClient } from 'redis';
import { promisify } from 'util';
import { AddUpdatesResult, StoredUpdates, UpdatesStore } from './UpdatesStore';
import { sumBy } from 'lodash';

export class RedisUpdatesStore implements UpdatesStore {
    private _globalNamespace: string;
    private _redis: RedisClient;

    private _maxSizeInBytes: number = Infinity;

    private rpush: (args: [string, ...string[]]) => Promise<number>;
    private incr: (args: [string]) => Promise<number>;
    private incrBy: (args: [string, number]) => Promise<number>;
    private lrange: (
        key: string,
        start: number,
        end: number
    ) => Promise<string[]>;
    private del: (key: string) => Promise<void>;
    private script: (command: string, script: string) => Promise<string>;
    private evalsha: (script: string, ...args: any[]) => Promise<any>;

    private _scriptSha1: string;

    get maxBranchSizeInBytes(): number {
        return this._maxSizeInBytes;
    }

    set maxBranchSizeInBytes(value: number) {
        this._maxSizeInBytes = value;
    }

    constructor(globalNamespace: string, client: RedisClient) {
        this._globalNamespace = globalNamespace;
        this._redis = client;

        this._redis.rpush('key', 'abc');

        this.del = promisify(this._redis.del).bind(this._redis);
        this.rpush = promisify(this._redis.rpush).bind(this._redis);
        this.lrange = promisify(this._redis.lrange).bind(this._redis);
        this.incr = promisify(this._redis.incr).bind(this._redis);
        this.incrBy = promisify(this._redis.incrby).bind(this._redis);
        this.script = promisify(this._redis.script.bind(this._redis));
        this.evalsha = promisify(this._redis.evalsha.bind(this._redis));
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

    async addUpdates(
        branch: string,
        updates: string[]
    ): Promise<AddUpdatesResult> {
        const key = branchKey(this._globalNamespace, branch);
        const count = countKey(this._globalNamespace, branch);
        const size = sizeKey(this._globalNamespace, branch);

        const loadScript = async () => {
            this._scriptSha1 = await this.script(
                'load',
                `
                local maxSize = tonumber(ARGV[1])
                local updatesSize = tonumber(ARGV[2])
                local currentSize = redis.call('GET', KEYS[3])
                if not currentSize then
                    currentSize = 0
                end
                local requiredSize = currentSize + updatesSize
                if maxSize > 0 and requiredSize > maxSize then
                    return { 1, requiredSize }
                end

                redis.call('INCR', KEYS[2])
                redis.call('INCRBY', KEYS[3], updatesSize)
                
                local numUpdates = tonumber(ARGV[3])
                local i = 0
                while i < numUpdates do
                    local update = ARGV[4 + i]
                    redis.call('RPUSH', KEYS[1], update)
                    i = i + 1
                end

                return 0
                `
                    .replace(/^\s+/gm, '')
                    .trim()
            );
        };

        const finalUpdates = updates.map((u) => `${u}:${Date.now()}`);

        // Updates are assumed to be ASCII (usually Base64-encoded strings),
        // so the size in bytes is just the sum of the length of each string.
        const updatesSize = sumBy(updates, (u) => u.length);

        const executeScript: () => Promise<number | number[]> = async () => {
            try {
                return await this.evalsha(
                    this._scriptSha1,
                    '3',
                    key,
                    count,
                    size,
                    isFinite(this._maxSizeInBytes)
                        ? this._maxSizeInBytes.toString()
                        : '-1',
                    updatesSize,
                    finalUpdates.length.toString(),
                    ...finalUpdates
                );
            } catch (e) {
                const errString = e.toString();
                if (errString.includes('NOSCRIPT')) {
                    await loadScript();
                    return await executeScript();
                }
                throw e;
            }
        };

        if (!this._scriptSha1) {
            await loadScript();
        }

        const statusCode = await executeScript();

        if (typeof statusCode === 'object' && Array.isArray(statusCode)) {
            if (statusCode[0] === 1) {
                // Max size reached
                return {
                    success: false,
                    errorCode: 'max_size_reached',
                    branch: branch,
                    maxBranchSizeInBytes: this._maxSizeInBytes,
                    neededBranchSizeInBytes: statusCode[1] as number,
                };
            }
        }

        return {
            success: true,
        };

        // await Promise.all([
        //     this.rpush([key, ...finalUpdates]),
        //     this.incr([count]),
        //     this.incrBy([size, updatesSize]),
        // ]);
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
