import { AtomOp } from "./Atom";
import { SiteInfo } from "./SiteIdInfo";
import { WeaveReference } from "./Weave";

/**
 * Defines an interface for a causal tree that is in a storable format.
 */
export interface StoredCausalTree<T extends AtomOp> {
    site: SiteInfo;
    knownSites: SiteInfo[],
    weave: WeaveReference<T>[];
}