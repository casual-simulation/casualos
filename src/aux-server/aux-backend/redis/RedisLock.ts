import { randomBytes } from 'crypto';
import { RedisClientType, defineScript } from 'redis';

const releaseLock = defineScript({
    NUMBER_OF_KEYS: 1,
    SCRIPT: `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`,
    transformArguments: (key: string, randomValue: number) => [
        key,
        randomValue.toString(),
    ],
});

/**
 * Attempts to aquire a lock on the given key.
 * Returns a function that will release the lock when called.
 * If the lock could not be aquired, returns null.
 *
 * Follows the simple implementation pattern described here:
 * https://redis.io/docs/latest/develop/use/patterns/distributed-locks/#correct-implementation-with-a-single-instance
 *
 * @param redis The redis client.
 * @param key The key that should be aquired.
 * @param timeout The timeout for the lock in miliseconds. If the lock isn't released in this time, it will be automatically released.
 */
export async function tryAquireLock(
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
