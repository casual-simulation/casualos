import { AtomOp, Atom } from "./Atom";
import { SiteInfo } from "./SiteIdInfo";

/**
 * Defines an interface for a causal tree that is in a storable format.
 */
export interface StoredCausalTree<T extends AtomOp> {
    site: SiteInfo;
    knownSites: SiteInfo[],
    weave: Atom<T>[];
}

/**
 * Creates a stored causal tree with the given data.
 * @param site 
 * @param knownSites 
 * @param weave 
 */
export function storedTree<T extends AtomOp>(site: SiteInfo, knownSites: SiteInfo[] = null, weave: Atom<T>[] = null): StoredCausalTree<T> {
    return {
        site: site,
        knownSites: knownSites,
        weave: weave
    };
}