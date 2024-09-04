/**
 * Represents a memory lock store
 * * This is used to store and enforce locks in memory
 */
export interface MemoryLockStore {
    /**
     * The locks that are currently being held.
     * * The key is the id of the lock and the value is the time at which the lock will be released
     * ! Implementation advice (private _locks map)
     * private _locks: Map<string, number> = new Map();
     */

    /**
     * Acquire a lock for/with the given id
     * @param id The id to acquire the lock for
     * @param timeout The amount of time to wait before the lock is released
     * @returns
     * If successful, returns a function that will release the lock when called.
     * If unsuccessful, returns null.
     */
    acquireLock(
        id: string,
        timeout: number
    ): Promise<() => Promise<boolean> | null>;
}
