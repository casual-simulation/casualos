export const RateLimiterOptions = Symbol.for('RateLimiterOptions');

/**
 * Defines an interface that contains options for a rate limiter.
 */
export interface RateLimiterOptions {
    /**
     * The length of time that requests should be remembered for.
     */
    readonly windowMs: number;
}

/**
 * Defines an interface that contains the result of incrementing a key in rate limiter.
 */
export interface RateLimiterIncrementResult {
    /**
     * The number of hits that the given key has recieved over the window.
     */
    totalHits: number;

    /**
     * The unix time in miliseconds when the counter will reset.
     */
    resetTimeMs: number;
}

export const RateLimiter = Symbol.for('RateLimiter');

/**
 * Defines an interface for a rate limiter.
 */
export interface RateLimiter {
    /**
     * Initializes the rate limiter with the given options.
     * @param options The options.
     */
    init(options: RateLimiterOptions): void;

    /**
     * Increments the number of hits that the given key has recieved by the given amount.
     * Returns a promise that resolves with the total number of hits that the key has recieved.
     * @param key The key.
     * @param amount The amount to increment the key by. Defaults to 1.
     */
    increment(
        key: string,
        amount?: number
    ): Promise<RateLimiterIncrementResult>;

    /**
     * Decrements the number of hits that the given key has recieved by the given amount.
     * @param key The key.
     * @param amount The amount to decrement the key by. Defaults to 1.
     */
    decrement(key: string, amount?: number): Promise<void>;

    /**
     * Resets the given key to zero hits.
     * @param key The key to reset.
     */
    resetKey(key: string): Promise<void>;
}
