import { WeaveReference } from "./Weave";
import { SiteInfo } from "./SiteIdInfo";
import { AtomOp } from "./Atom";
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