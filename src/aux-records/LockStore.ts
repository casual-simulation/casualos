/**
 * Represents a lock store.
 * Locks are used to prevent multiple processes from accessing the same resource at the same time.
 */
export interface LockStore {
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
