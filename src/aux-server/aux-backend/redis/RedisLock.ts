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
import { randomBytes } from 'crypto';
import type { RedisClientType } from 'redis';
import { defineScript } from 'redis';

const releaseLock = defineScript({
    NUMBER_OF_KEYS: 1,
    SCRIPT: `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`,
    transformArguments: (key: string, randomValue: number) => [
        key,
        randomValue.toString(),
    ],
});

/**
 * Attempts to acquire a lock on the given key.
 * Returns a function that will release the lock when called.
 * If the lock could not be acquired, returns null.
 *
 * Follows the simple implementation pattern described here:
 * https://redis.io/docs/latest/develop/use/patterns/distributed-locks/#correct-implementation-with-a-single-instance
 *
 * @param redis The redis client.
 * @param key The key that should be acquired.
 * @param timeout The timeout for the lock in miliseconds. If the lock isn't released in this time, it will be automatically released.
 */
export async function tryAcquireLock(
    redis: RedisClientType,
    key: string,
    timeout: number
): Promise<(() => Promise<boolean>) | null> {
    const randomValue = randomBytes(32).readInt32LE();
    await redis.set(key, randomValue, {
        NX: true,
        PX: timeout,
    });

    const value = await redis.get(key);

    if (parseInt(value) === randomValue) {
        return async () => {
            const result = await redis.executeScript(releaseLock, [
                key,
                randomValue.toString(),
            ]);
            return result === 1;
        };
    }

    return null;
}
