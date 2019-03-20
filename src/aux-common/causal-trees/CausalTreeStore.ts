import { SiteInfo } from "./SiteIdInfo";
import { AtomOp, Atom } from "./Atom";
import { StoredCausalTree } from "./StoredCausalTree";

/**
 * Defines an interface for a store that can store causal trees.
 */
export interface CausalTreeStore {

    /**
     * Runs any needed setup.
     */
    init(): Promise<void>;

    /**
     * Updates the causal tree stored under the given ID with the new data.
     * @param id The ID that the weave should be stored under.
     * @param tree The tree to store.
     */
    update<T extends AtomOp>(id: string, tree: StoredCausalTree<T>): Promise<void>;


    /**
     * Gets the causal tree that is stored under the given ID.
     * @param id The ID that the tree is stored under.
     */
    get<T extends AtomOp>(id: string): Promise<StoredCausalTree<T>>;
}

/**
 * Defines an interface for objects that can archive atoms.
 */
export interface ArchivingCausalTreeStore extends CausalTreeStore {
    /**
     * Stores the given atoms in the store under the given archive ID.
     * Multiple atoms can be stored under the same ID, and so calling this
     * function multiple times will simply continue to append the given atoms to the archive.
     * @param id The ID that.
     * @param atom The atom that should be archived.
     */
    archiveAtoms<T extends AtomOp>(id: string, atoms: Atom<T>[]): Promise<void>;

    /**
     * Gets the archived atoms that were stored under the given ID.
     * @param id The ID to get the archived atoms from.
     */
    getArchive<T extends AtomOp>(id: string): Promise<Atom<T>[]>;
}