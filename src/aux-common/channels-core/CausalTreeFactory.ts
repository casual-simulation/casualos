import { AtomOp } from "./Atom";
import { CausalTree } from "./CausalTree";

export interface CausalTreeFactoryMap {
    [type: string]: (siteId: number) => CausalTree<AtomOp, any>;
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
     * @param siteId The ID of the site.
     */
    create(type: string, siteId: number): CausalTree<AtomOp, any> {
        const factory = this._map[type];
        if (factory) {
            return factory(siteId);
        } else {
            return null;
        }
    }

}