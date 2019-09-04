import { CausalRepoObject } from './CausalRepoObject';

/**
 * Defines an interface for a causal repo store.
 * A causal repo store is simply a key/value store of CausalRepoObjects.
 */
export interface CausalRepoStore {
    /**
     * Gets the objects with the given key.
     * @param key The keys.
     */
    getObjects(keys: string[]): Promise<CausalRepoObject>;

    /**
     * Stores the objects.
     * @param objects The objects to store.
     */
    storeObjects(objects: CausalRepoObject[]): Promise<void>;
}
