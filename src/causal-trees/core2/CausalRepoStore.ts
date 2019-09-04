import { CausalRepoObject, CausalRepoBranch } from './CausalRepoObject';

/**
 * Defines an interface for a causal repo store.
 * A causal repo store is simply a key/value store of CausalRepoObjects.
 */
export interface CausalRepoStore {
    /**
     * Gets the objects with the given key.
     * @param key The keys.
     */
    getObjects(keys: string[]): Promise<CausalRepoObject[]>;

    /**
     * Stores the given objects.
     * @param objects The objects to store.
     */
    storeObjects(objects: CausalRepoObject[]): Promise<void>;

    /**
     * Gets the list of branches that match the given prefix.
     * @param prefix The prefix that branch names should match.
     */
    getBranches(prefix: string): Promise<CausalRepoBranch[]>;

    /**
     * Saves/updates the given head to the given repo.
     * @param head The branch to save.
     */
    saveBranch(head: CausalRepoBranch): Promise<void>;

    /**
     * Deletes the given branch from the repo.
     * @param head The branch to delete.
     */
    deleteBranch(head: CausalRepoBranch): Promise<void>;
}
