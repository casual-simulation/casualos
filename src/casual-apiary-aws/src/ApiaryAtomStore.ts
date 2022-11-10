import { Atom } from '@casual-simulation/causal-trees';

/**
 * Defines an interface that defines a general atom store that is useful for apiarys.
 */
export interface ApiaryAtomStore {
    /**
     * Saves the given atoms to the given namespace.
     * @param namespace The namespace that the atoms should be stored in.
     * @param atoms The atoms that should be stored.
     */
    saveAtoms(namespace: string, atoms: Atom<any>[]): Promise<void>;

    /**
     * Loads all the atoms in the given namespace.
     * @param namespace The namespace that the atoms should be loaded for.
     */
    loadAtoms(namespace: string): Promise<Atom<any>[]>;

    /**
     * Deletes the given atoms from the given namespace.
     * @param namespace The namespace that the atoms should be deleted from.
     * @param atoms The IDs of the atoms that should be deleted
     */
    deleteAtoms(namespace: string, atomHashes: string[]): Promise<void>;

    /**
     * Deletes all the atoms in the given namespace.
     * @param namespace The namespace to clear.
     */
    clearNamespace(namespace: string): Promise<void>;

    /**
     * Counts the number of atoms that are stored in the given namespace.
     * @param namespace The namespace.
     */
    countAtoms(namespace: string): Promise<number>;
}
