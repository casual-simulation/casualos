import { AtomOp } from "./Atom";
import { CausalTree } from "./CausalTree";
import { SiteInfo } from "./SiteIdInfo";
import { StoredCausalTree } from "./StoredCausalTree";

export interface CausalTreeFactoryMap {
    [type: string]: (site: SiteInfo, tree: StoredCausalTree<AtomOp> | null) => CausalTree<AtomOp, any>;
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
    create(type: string, site: SiteInfo, storedTree?: StoredCausalTree<AtomOp>): CausalTree<AtomOp, any> {
        const factory = this._map[type];
        if (factory) {
            return factory(site, storedTree);
        } else {
            return null;
        }
    }

}