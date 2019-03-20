import { AtomOp, Atom } from "./Atom";
import { SiteInfo } from "./SiteIdInfo";

export const currentFormatVersion = 3;

/**
 * Defines an interface for a causal tree that is in a storable format.
 */
export type StoredCausalTree<T extends AtomOp> = StoredCausalTreeVersion1<T> | 
    StoredCausalTreeVersion2<T> |
    StoredCausalTreeVersion3<T>;

export interface StoredCausalTreeVersion3<T extends AtomOp> {
    formatVersion: 3;
    site: SiteInfo;
    knownSites: SiteInfo[],
    weave: Atom<T>[];

    /**
     * Whether the weave is ordered in the proper format.
     * If false, then the atoms aren't in any particular order and
     * cannot be imported but must instead be inserted.
     */
    ordered: boolean;
}

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
export function storedTree<T extends AtomOp>(site: SiteInfo, knownSites: SiteInfo[] = null, weave: Atom<T>[] = null): StoredCausalTreeVersion3<T> {
    return {
        formatVersion: currentFormatVersion,
        site: site,
        knownSites: knownSites,
        weave: weave,
        ordered: true
    };
}

/**
 * Upgrades the given stored causal tree to the latest version.
 * @param stored The stored tree.
 */
export function upgrade<T extends AtomOp>(stored: StoredCausalTree<T>): StoredCausalTreeVersion3<T> {
    if (!stored) {
        return null;
    }
    if (stored.formatVersion === 3) {
        return stored;
    } else if(stored.formatVersion === 2) {
        return {
            formatVersion: 3,
            knownSites: stored.knownSites,
            site: stored.site,
            weave: stored.weave,
            ordered: true
        };
    } else if(typeof stored.formatVersion === 'undefined') {
        return {
            formatVersion: 3,
            knownSites: stored.knownSites,
            site: stored.site,
            weave: stored.weave ? stored.weave.map(a => a.atom) : null,
            ordered: true
        };
    } else {
        throw new Error(`[StoredCausalTree] Unable to update the given tree version ${stored.formatVersion}`);
    }
}