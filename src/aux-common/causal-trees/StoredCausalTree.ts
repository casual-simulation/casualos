import { AtomOp, Atom } from "./Atom";
import { SiteInfo } from "./SiteIdInfo";

export const currentFormatVersion = 2;

/**
 * Defines an interface for a causal tree that is in a storable format.
 */
export type StoredCausalTree<T extends AtomOp> = StoredCausalTreeVersion1<T> | StoredCausalTreeVersion2<T>;

/**
 * Defines an interface for a causal tree that is in a storable format.
 * This interface represents the second version of the storable format.
 */
export interface StoredCausalTreeVersion2<T extends AtomOp> {
    formatVersion: 2;
    site: SiteInfo;
    knownSites: SiteInfo[],
    weave: Atom<T>[];
}

/**
 * Defines an interface for a causal tree that is in a storable format.
 * This interface represents the first version of the storable format.
 */
export interface StoredCausalTreeVersion1<T extends AtomOp> {
    formatVersion?: 1;
    site: SiteInfo;
    knownSites: SiteInfo[],
    weave: WeaveReference<T>[];
}

/**
 * @deprecated Use Atom.
 */
export interface WeaveReference<T extends AtomOp> {
    atom: Atom<T>;
}

/**
 * Creates a stored causal tree with the given data.
 * @param site 
 * @param knownSites 
 * @param weave 
 */
export function storedTree<T extends AtomOp>(site: SiteInfo, knownSites: SiteInfo[] = null, weave: Atom<T>[] = null): StoredCausalTreeVersion2<T> {
    return {
        formatVersion: currentFormatVersion,
        site: site,
        knownSites: knownSites,
        weave: weave
    };
}