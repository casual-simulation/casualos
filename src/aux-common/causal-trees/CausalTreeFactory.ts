import { AtomOp } from "./Atom";
import { CausalTree } from "./CausalTree";
import { SiteInfo } from "./SiteIdInfo";
import { StoredCausalTree } from "./StoredCausalTree";

export interface CausalTreeFactoryMap {
    [type: string]: (tree: StoredCausalTree<AtomOp> | null) => CausalTree<AtomOp, any, any>;
}

/**
 * Defines a class that is able to create new causal trees from a given type.
 */
export class CausalTreeFactory {

    private _map: CausalTreeFactoryMap;

    constructor(map: CausalTreeFactoryMap) {
        this._map = map;
    }

    /**
     * Creates a new Causal Tree.
     * @param type The type of tree to create.
     * @param site The info of the site.
     */
    create(type: string, storedTree?: StoredCausalTree<AtomOp>): CausalTree<AtomOp, any, any> {
        const factory = this._map[type];
        if (factory) {
            return factory(storedTree);
        } else {
            return null;
        }
    }
}