import type { Options, RedisReply, SendCommandFn } from './types';
import type {
    RateLimiter,
    RateLimiterIncrementResult,
    RateLimiterOptions,
} from './RateLimiter';

/**
 * A `Store` for the `express-rate-limit` package that stores hit counts in
 * Redis.
 */
class RedisStore implements RateLimiter {
    /**
     * The function used to send raw commands to Redis.
     */
    sendCommand: SendCommandFn;

    /**
     * The text to prepend to the key in Redis.
     */
    prefix: string;

    /**
     * Whether to reset the expiry for a particular key whenever its hit count
     * changes.
     */
    resetExpiryOnChange: boolean;

    /**
     * Stores the loaded SHA1 of the LUA script for executing the increment operations.
     */
    loadedScriptSha1: Promise<string>;

    /**
     * The number of milliseconds to remember that user's requests.
     */
    windowMs!: number;

    /**
     * @constructor for `RedisStore`.
     *
     * @param options {Options} - The configuration options for the store.
     */
    constructor(options: Options) {
        this.sendCommand = options.sendCommand;
        this.prefix = options.prefix ?? 'rl:';
        this.resetExpiryOnChange = options.resetExpiryOnChange ?? false;
    }

    /**
     * Setup the RedisRateLimitStore.
     * Must be called before first use.
     */
    async setup() {
        // So that the script loading can occur non-blocking, this will send
        // the script to be loaded, and will capture the value within the
        // promise return. This way, if increments start being called before
        // the script has finished loading, it will wait until it is loaded
        // before it continues.
        this.loadedScriptSha1 = this.loadScript();
    }

    async loadScript(): Promise<string> {
        const result = await this.sendCommand(
            'SCRIPT',
            'LOAD',
            `
        local count = tonumber(ARGV[3])
        local totalHits = redis.call("INCRBY", KEYS[1], count)
        local timeToExpire = redis.call("PTTL", KEYS[1])
        if timeToExpire <= 0 or ARGV[1] == "1"
        then
            redis.call("PEXPIRE", KEYS[1], tonumber(ARGV[2]))
            timeToExpire = tonumber(ARGV[2])
        end

        return { totalHits, timeToExpire }
    `
                // Ensure that code changes that affect whitespace do not affect
                // the script contents.
                .replace(/^\s+/gm, '')
                .trim()
        );

        if (typeof result !== 'string') {
            throw new TypeError('unexpected reply from redis client');
        }

        return result;
    }

    /**
     * Method to prefix the keys with the given text.
     *
     * @param key {string} - The key.
     *
     * @returns {string} - The text + the key.
     */
    prefixKey(key: string): string {
        return `${this.prefix}${key}`;
    }

    /**
     * Method that actually initializes the store.
     *
     * @param options {RateLimitConfiguration} - The options used to setup the middleware.
     */
    init(options: RateLimiterOptions) {
        this.windowMs = options.windowMs;
    }

    /**
     * Method to increment a client's hit counter.
     *
     * @param key {string} - The identifier for a client
     */
    async increment(
        key: string,
        amount: number = 1
    ): Promise<RateLimiterIncrementResult> {
        const results = await this._runScript(this.prefixKey(key), amount);

        if (!Array.isArray(results)) {
            throw new TypeError('Expected result to be array of values');
        }

        if (results.length !== 2) {
            throw new Error(`Expected 2 replies, got ${results.length}`);
        }

        const totalHits = results[0];
        if (typeof totalHits !== 'number') {
            throw new TypeError('Expected value to be a number');
        }

        const timeToExpire = results[1];
        if (typeof timeToExpire !== 'number') {
            throw new TypeError('Expected value to be a number');
        }

        const resetTimeMs = Date.now() + timeToExpire;
        return {
            totalHits,
            resetTimeMs,
        };
    }

    /**
     * Method to decrement a client's hit counter.
     *
     * @param key {string} - The identifier for a client
     */
    async decrement(key: string, amount: number = 1): Promise<void> {
        await this.sendCommand(
            'DECRBY',
            this.prefixKey(key),
            amount.toString()
        );
    }

    /**
     * Method to reset a client's hit counter.
     *
     * @param key {string} - The identifier for a client
     */
    async resetKey(key: string): Promise<void> {
        await this.sendCommand('DEL', this.prefixKey(key));
    }

    private async _runScript(
        key: string,
        amount: number
    ): Promise<RedisReply | RedisReply[]> {
        try {
            return await this.sendCommand(
                'EVALSHA',
                await this.loadedScriptSha1,
                '1',
                key,
                this.resetExpiryOnChange ? '1' : '0',
                this.windowMs.toString(),
                amount.toString()
            );
        } catch (e) {
            const errString = e.toString();
            if (errString.includes('NOSCRIPT')) {
                this.loadedScriptSha1 = this.loadScript();
                return await this._runScript(key, amount);
            }
            throw e;
        }
    }
}

export default RedisStore;
