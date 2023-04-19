import { RedisClient } from 'redis';
import { promisify } from 'util';
import {
    AddUpdatesResult,
    ReplaceUpdatesResult,
    StoredUpdates,
    UpdatesStore,
} from '@casual-simulation/causal-trees/core2';
import { sumBy } from 'lodash';

export class RedisUpdatesStore implements UpdatesStore {
    private _globalNamespace: string;
    private _redis: RedisClient;

    /**
     * The maximum size of the branch in bytes.
     */
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
    // private ltrim: (key: string, start: number, end: number) => Promise<void>;

    private _addUpdatesScriptSha1: string;
    private _replaceUpdatesScriptSha1: string;

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

        const finalUpdates = updates.map((u) => `${u}:${Date.now()}`);

        // Updates are assumed to be ASCII (usually Base64-encoded strings),
        // so the size in bytes is just the sum of the length of each string.
        const updatesSize = sumBy(updates, (u) => u.length);

        const statusCode = await this._executeScript<number | number[]>(
            '_addUpdatesScriptSha1',
            {
                script: `
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

                return { 0, requiredSize }
            `,
                keys: [key, count, size],
                args: [
                    isFinite(this._maxSizeInBytes)
                        ? this._maxSizeInBytes.toString()
                        : '-1',
                    updatesSize,
                    finalUpdates.length.toString(),
                    ...finalUpdates,
                ],
            }
        );

        if (typeof statusCode === 'object' && Array.isArray(statusCode)) {
            if (statusCode[0] === 0) {
                // Max size reached
                return {
                    success: true,
                    branchSizeInBytes: statusCode[1] as number,
                };
            } else if (statusCode[0] === 1) {
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

    async replaceUpdates(
        branch: string,
        updatesToRemove: StoredUpdates,
        updatesToAdd: string[]
    ): Promise<ReplaceUpdatesResult> {
        const key = branchKey(this._globalNamespace, branch);
        const count = countKey(this._globalNamespace, branch);
        const size = sizeKey(this._globalNamespace, branch);
        const mergeTime = mergeTimeKey(this._globalNamespace, branch);

        // Updates are assumed to be ASCII (usually Base64-encoded strings),
        // so the size in bytes is just the sum of the length of each string.
        const removedSize = sumBy(updatesToRemove.updates, (u) => u.length);
        const addedSize = sumBy(updatesToAdd, (u) => u.length);

        const firstMergedUpdateTimestamp =
            updatesToRemove.timestamps.length > 0
                ? updatesToRemove.timestamps[0]
                : Date.now();
        const lastUpdateIndex = updatesToRemove.updates.length - 1;
        const finalUpdates = updatesToAdd.map((u) => `${u}:${Date.now()}`);

        const statusCode = await this._executeScript<number | number[]>(
            '_addUpdatesScriptSha1',
            {
                script: `
                local mergeTimestamp = redis.call('GET', KEYS[4])
                if not mergeTimestamp then
                    mergeTimestamp = 0
                end
                local timestamp = tonumber(ARGV[1])

                local maxSize = tonumber(ARGV[2])
                local addedSize = tonumber(ARGV[3])
                local removedSize = tonumber(ARGV[4])
                local sizeDelta = addedSize - removedSize
                local currentSize = redis.call('GET', KEYS[3])
                if not currentSize then
                    currentSize = 0
                end
                local requiredSize = currentSize + sizeDelta
                if maxSize > 0 and requiredSize > maxSize then
                    return { 1, requiredSize }
                end

                local trim = 1

                if mergeTimestamp >= timestamp then
                    trim = 0
                else
                    redis.call('SET', KEYS[4], timestamp)
                end

                local lastUpdateIndex = tonumber(ARGV[5])
                if lastUpdateIndex < 0 then
                    trim = 0
                end

                if trim == 1 then
                    redis.call('LTRIM', KEYS[1], lastUpdateIndex, -1)
                else
                    if currentSize + addedSize > maxSize then
                        return { 1, currentSize + addedSize }
                    end
                end

                redis.call('INCR', KEYS[2])

                if trim == 1 then
                    redis.call('INCRBY', KEYS[3], sizeDelta)
                else
                    redis.call('INCRBY', KEYS[3], addedSize)
                end
                
                local numUpdates = tonumber(ARGV[6])
                local i = 0
                while i < numUpdates do
                    local update = ARGV[7 + i]
                    redis.call('RPUSH', KEYS[1], update)
                    i = i + 1
                end

                return 0
            `,
                keys: [key, count, size, mergeTime],
                args: [
                    firstMergedUpdateTimestamp.toString(),
                    isFinite(this._maxSizeInBytes)
                        ? this._maxSizeInBytes.toString()
                        : '-1',
                    addedSize.toString(),
                    removedSize.toString(),
                    lastUpdateIndex.toString(),
                    finalUpdates.length.toString(),
                    ...finalUpdates,
                ],
            }
        );

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
    }

    private async _executeScript<T>(
        scriptName: '_addUpdatesScriptSha1' | '_replaceUpdatesScriptSha1',
        options: {
            script: string;
            keys: string[];
            args: any[];
        }
    ): Promise<T> {
        const loadScript = async () => {
            this[scriptName] = await this.script(
                'load',
                options.script.replace(/^\s+/gm, '').trim()
            );
        };

        if (!this[scriptName]) {
            await loadScript();
        }

        const executeScript: () => Promise<T> = async () => {
            try {
                return await this.evalsha(
                    this[scriptName],
                    options.keys.length.toString(),
                    ...options.keys,
                    ...options.args
                    // '3',
                    // key,
                    // count,
                    // size,
                    // isFinite(this._maxSizeInBytes)
                    //     ? this._maxSizeInBytes.toString()
                    //     : '-1',
                    // updatesSize,
                    // finalUpdates.length.toString(),
                    // ...finalUpdates
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

        return await executeScript();

        // return new Promise((resolve, reject) => {
        //     const callback = (err: Error, result: any) => {
        //         if (err) {
        //             reject(err);
        //         } else {
        //             resolve(result);
        //         }
        //     };
        //     this._redis[scriptName](script, ...args, callback);
        // });
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

function mergeTimeKey(globalNamespace: string, branch: string) {
    return `/${globalNamespace}/mergeTime/${branch}`;
}
