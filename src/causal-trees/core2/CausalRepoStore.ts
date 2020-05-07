import { CausalRepoObject, CausalRepoBranch } from './CausalRepoObject';

/**
 * Defines an interface for a causal repo store.
 * A causal repo store is simply a key/value store of CausalRepoObjects.
 */
export interface CausalRepoStore extends CausalObjectStore, CausalBranchStore {}

/**
 * Defines an interface for a causal branch store.
 * A causal branch store is a store for branches.
 */
export interface CausalBranchStore {
    /**
     * Gets the list of branches that match the given prefix.
     * @param prefix The prefix that branch names should match. If null, then all branches are returned.
     */
    getBranches(prefix: string | null): Promise<CausalRepoBranch[]>;

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

/**
 * Defines an interface for a causal object store.
 * A causal object store is simply a key/value store of Causal Repo Objects.
 */
export interface CausalObjectStore {
    /**
     * Gets the objects with the given key.
     * @param head The head that the keys are being loaded for.
     * @param key The keys.
     */
    getObjects(head: string, keys: string[]): Promise<CausalRepoObject[]>;

    /**
     * Gets the object with the given key.
     * @param key The key.
     */
    getObject(key: string): Promise<CausalRepoObject>;

    /**
     * Stores the given objects.
     * @param head The head that the objects are being stored for.
     * @param objects The objects to store.
     */
    storeObjects(head: string, objects: CausalRepoObject[]): Promise<void>;
}

/**
 * Defines a class that uses one store for branches and another store for objects.
 */
export class CombinedCausalRepoStore implements CausalRepoStore {
    private _branches: CausalBranchStore;
    private _objects: CausalObjectStore;

    constructor(branches: CausalBranchStore, objects: CausalObjectStore) {
        this._branches = branches;
        this._objects = objects;
    }

    getObjects(head: string, keys: string[]): Promise<CausalRepoObject[]> {
        return this._objects.getObjects(head, keys);
    }

    getObject(key: string): Promise<CausalRepoObject> {
        return this._objects.getObject(key);
    }

    storeObjects(head: string, objects: CausalRepoObject[]): Promise<void> {
        return this._objects.storeObjects(head, objects);
    }

    getBranches(prefix: string): Promise<CausalRepoBranch[]> {
        return this._branches.getBranches(prefix);
    }

    saveBranch(head: CausalRepoBranch): Promise<void> {
        return this._branches.saveBranch(head);
    }

    deleteBranch(head: CausalRepoBranch): Promise<void> {
        return this._branches.deleteBranch(head);
    }
}

/**
 * Defines a class that tries loading objects from one store before trying another store.
 */
export class FallbackCausalObjectStore implements CausalObjectStore {
    private _first: CausalObjectStore;
    private _second: CausalObjectStore;

    constructor(first: CausalObjectStore, second: CausalObjectStore) {
        this._first = first;
        this._second = second;
    }

    async getObjects(
        head: string,
        keys: string[]
    ): Promise<CausalRepoObject[]> {
        let objs = await this._first.getObjects(head, keys);
        if (!objs || objs.every(o => typeof o === 'undefined')) {
            objs = await this._second.getObjects(head, keys);
        }
        return objs;
    }

    async getObject(key: string): Promise<CausalRepoObject> {
        return (
            (await this._first.getObject(key)) ||
            (await this._second.getObject(key))
        );
    }

    storeObjects(head: string, objects: CausalRepoObject[]): Promise<void> {
        return this._first.storeObjects(head, objects);
    }
}
