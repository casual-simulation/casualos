/**
 * Defines an interface for services that can cache arbitrary data.
 */
export interface Cache {
    /**
     * Stores the given data in the cache.
     * @param key The key to store the data under.
     * @param data The data to store.
     * @param expireSeconds The number of seconds after which the data should expire.
     */
    store<T>(key: string, data: T, expireSeconds: number): Promise<void>;

    /**
     * Retrieves the data stored under the given key.
     * @param key The key to retrieve the data for.
     * @returns The data stored under the given key, or undefined if no data was found.
     */
    retrieve<T>(key: string): Promise<T>;

    /**
     * Removes the data stored under the given key.
     * @param key The key to remove the data for.
     */
    remove(key: string): Promise<void>;

    /**
     * Clears all the data from the cache.
     */
    clear(): Promise<void>;
}

/**
 * Defines an interface for services that can construct caches.
 */
export interface MultiCache {
    /**
     * Creates a new cache with the given key.
     * @param key The key of the cache.
     */
    getCache(key: string): Cache;
}
