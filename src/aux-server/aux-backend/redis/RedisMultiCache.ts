import { Cache, MultiCache } from '@casual-simulation/aux-records';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';
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

    @traced('RedisCache')
    async store<T>(key: string, data: T, expireSeconds: number): Promise<void> {
        const k = `${this._namespace}/${key}`;
        await this._redis.set(k, JSON.stringify(data));
        await this._redis.expire(k, expireSeconds);
    }

    @traced('RedisCache')
    async retrieve<T>(key: string): Promise<T> {
        const k = `${this._namespace}/${key}`;
        const result = await this._redis.get(k);
        if (result) {
            return JSON.parse(result);
        } else {
            return undefined;
        }
    }

    @traced('RedisCache')
    async remove(key: string): Promise<void> {
        const k = `${this._namespace}/${key}`;
        await this._redis.del(k);
    }
}
