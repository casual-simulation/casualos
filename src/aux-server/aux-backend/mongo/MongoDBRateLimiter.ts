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
import type {
    RateLimiter,
    RateLimiterIncrementResult,
    RateLimiterOptions,
} from '@casual-simulation/rate-limit-redis';
import type { Collection } from 'mongodb';

export class MongoDBRateLimiter implements RateLimiter {
    private _collection: Collection<MongoDBRateLimitRecord>;
    private _windowMs: number;

    private _updatedIndex: boolean = false;

    constructor(collection: Collection<MongoDBRateLimitRecord>) {
        this._collection = collection;
    }

    /**
     * Initializes the rate limiter with the given options.
     * @param options The options.
     */
    init(options: RateLimiterOptions): void {
        this._windowMs = options.windowMs;
    }

    /**
     * Increments the number of hits that the given key has recieved by the given amount.
     * Returns a promise that resolves with the total number of hits that the key has recieved.
     * @param key The key.
     * @param amount The amount to increment the key by. Defaults to 1.
     */
    async increment(
        key: string,
        amount?: number
    ): Promise<RateLimiterIncrementResult> {
        await this._updateCollection();
        const expirationDate = Date.now() + this._windowMs;

        const result = await this._collection.findOneAndUpdate(
            {
                _id: { $eq: key },
            },
            {
                $inc: { count: amount ?? 1 },
                $setOnInsert: {
                    expirationDateMs: expirationDate,
                },
            },
            {
                upsert: true,
                returnDocument: 'after',
            }
        );

        const record = result.value;

        return {
            totalHits: record.count,
            resetTimeMs:
                record.expirationDateMs ??
                record.expirationDate?.getTime() ??
                0,
        };
    }

    /**
     * Decrements the number of hits that the given key has recieved by the given amount.
     * @param key The key.
     * @param amount The amount to decrement the key by. Defaults to 1.
     */
    async decrement(key: string, amount?: number): Promise<void> {
        await this._updateCollection();
        const expirationDateMs = Date.now() + this._windowMs;

        await this._collection.findOneAndUpdate(
            {
                _id: { $eq: key },
            },
            {
                $inc: { count: -(amount ?? 1) },
                $setOnInsert: {
                    expirationDateMs: expirationDateMs,
                },
            },
            {
                upsert: true,
            }
        );
    }

    /**
     * Resets the given key to zero hits.
     * @param key The key to reset.
     */
    async resetKey(key: string): Promise<void> {
        await this._updateCollection();
        await this._collection.deleteOne({
            _id: { $eq: key },
        });
    }

    private async _updateCollection() {
        if (this._updatedIndex) return;

        this._updatedIndex = true;
        await this._collection.createIndex(
            { expirationDateMs: 1 },
            {
                expireAfterSeconds: 0,
            }
        );
    }
}

export interface MongoDBRateLimitRecord {
    _id: string;

    /**
     * The current count.
     */
    count: number;

    /**
     * The expiration date in UTC-0.
     */
    expirationDate?: Date;

    /**
     * The expiration date in unix time in miliseconds.
     */
    expirationDateMs?: number;
}
