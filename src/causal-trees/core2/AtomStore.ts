import { Atom, AtomId } from './Atom2';

/**
 * Defines an interface for a repository of atoms.
 */
export interface AtomStore {
    /**
     * Runs any needed setup.
     */
    init(): Promise<void>;

    /**
     * Adds the given atoms to the store.
     */
    add<T>(atoms: Atom<T>[]): Promise<void>;

    /**
     * Finds all the atoms whose cause matches the given atom ID.
     * @param cause The ID of the cause that the atoms should be found by.
     */
    findByCause(cause: AtomId): Promise<Atom<any>[]>;

    /**
     * Finds all of the atoms whose hashes are contained in the given array of hashes.
     * @param hashes The list of hashes to search.
     */
    findByHashes(hashes: string[]): Promise<Atom<any>[]>;
}
