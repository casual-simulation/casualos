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
import type { Cache, MultiCache } from '@casual-simulation/aux-records';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';
import type { SpanOptions } from '@opentelemetry/api';
import { SpanKind } from '@opentelemetry/api';
import {
    SEMATTRS_DB_NAME,
    SEMRESATTRS_SERVICE_NAME,
} from '@opentelemetry/semantic-conventions';
import type { RedisClientType } from 'redis';

const TRACE_NAME = 'RedisCache';
const SPAN_OPTIONS: SpanOptions = {
    kind: SpanKind.PRODUCER,
    attributes: {
        [SEMATTRS_DB_NAME]: 'redis',
        [SEMRESATTRS_SERVICE_NAME]: 'redis',
    },
};

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

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async store<T>(key: string, data: T, expireSeconds: number): Promise<void> {
        const k = `${this._namespace}/${key}`;
        await this._redis.set(
            k,
            JSON.stringify(data, (key, value) => {
                if (typeof value === 'bigint') {
                    return value.toString();
                }
                return value;
            })
        );
        await this._redis.expire(k, expireSeconds);
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async retrieve<T>(key: string): Promise<T> {
        const k = `${this._namespace}/${key}`;
        const result = await this._redis.get(k);
        if (result) {
            return JSON.parse(result);
        } else {
            return undefined;
        }
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async remove(key: string): Promise<void> {
        const k = `${this._namespace}/${key}`;
        await this._redis.del(k);
    }
}
