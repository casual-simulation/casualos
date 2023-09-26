import { Cache, MultiCache } from '@casual-simulation/aux-records';
import { RedisClientType } from 'redis';

/**
 * Implements a MultiCache that uses Redis.
 */
export class RedisMultiCache implements MultiCache {
    private _redis: RedisClientType;
    private _namespace: string;

    constructor(redis: RedisClientType, namespace: string) {
        this._redis = redis;
        this._namespace = namespace;
    }

    getCache(key: string): Cache {
        return new RedisCache(this._redis, `${this._namespace}/${key}`);
    }
}

/**
 * Implements a Cache that uses Redis.
 */
export class RedisCache implements Cache {
    private _redis: RedisClientType;
    private _namespace: string;

    constructor(redis: RedisClientType, namespace: string) {
        this._redis = redis;
        this._namespace = namespace;
    }

    async store<T>(key: string, data: T, expireSeconds: number): Promise<void> {
        await this._redis.hSet(this._namespace, key, JSON.stringify(data));
    }
    async retrieve<T>(key: string): Promise<T> {
        const result = await this._redis.hGet(this._namespace, key);
        if (result) {
            return JSON.parse(result);
        } else {
            return undefined;
        }
    }
    async remove(key: string): Promise<void> {
        await this._redis.hDel(this._namespace, key);
    }

    async clear(): Promise<void> {
        await this._redis.del(this._namespace);
    }
}
