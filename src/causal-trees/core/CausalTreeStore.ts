import { AtomOp, Atom, atomIdToString } from './Atom';
import { StoredCausalTree } from './StoredCausalTree';
import { CausalTree } from './CausalTree';

/**
 * Defines an interface for a store that can store causal trees.
 */
export interface CausalTreeStore {
    /**
     * Runs any needed setup.
     */
    init(): Promise<void>;

    /**
     * Updates the causal tree stored under the given ID with the new complete state.
     * @param id The ID that the tree should be stored under.
     * @param tree The tree to store.
     * @param fullUpdate Whether to update the entire stored tree.
     *                   If unspecified, then the entire tree is updated.
     *                   If false, then only the tree info (site, and known sites) will be updated.
     */
    put<T extends AtomOp>(
        id: string,
        tree: StoredCausalTree<T>,
        fullUpdate?: boolean
    ): Promise<void>;

    /**
     * Adds the given atoms to the tree stored under the given ID.
     * @param id The ID of the tree that the atoms should be added to.
     * @param atoms The atoms to add.
     * @param archived Whether the given atoms should be marked as archived.
     */
    add<T extends AtomOp>(
        id: string,
        atoms: Atom<T>[],
        archived?: boolean
    ): Promise<void>;

    /**
     * Gets the causal tree that is stored under the given ID.
     * @param id The ID that the tree is stored under.
     * @param archived Optional parameter to only get archived or unarchived atoms. If not specified, all atoms for the tree
     *                 will be returned.
     */
    get<T extends AtomOp>(
        id: string,
        archived?: boolean
    ): Promise<StoredCausalTree<T>>;

    /**
     * Gets the list of IDs that causal trees are stored under.
     */
    getTreeIds(): Promise<string[]>;

    /**
     * Updates the keys stored for the given ID.
     * @param id The ID that the keys are for.
     * @param privateKey The private key to store in PEM format. May or may not already be encrypted.
     * @param publicKey The public key to store in PEM format. May or may not already be encrypted.
     */
    putKeys(id: string, privateKey: string, publicKey: string): Promise<void>;

    /**
     * Gets the keys stored under the given ID.
     * Returns a promise that resolves with the stored keys or null if there are none.
     * @param id The ID that the keys are under.
     */
    getKeys(id: string): Promise<StoredCryptoKeys>;
}

/**
 * Defines an interface for a pair of keys that have been stored.
 */
export interface StoredCryptoKeys {
    /**
     * The PKCS #8 private key in PEM format.
     */
    privateKey: string;

    /**
     * The SPKI public key in PEM format.
     */
    publicKey: string;
}
