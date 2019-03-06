import { Atom, AtomId, AtomOp, StorableAtomId, idEquals } from "./Atom";
import { VirtualArray } from "./VirtualArray";
import { sortBy, findIndex, keys, find } from "lodash";
import { WeaveVersion, WeaveSiteVersion, weaveVersion } from "./WeaveVersion";
import { getHash, getHashBuffer } from './Hash';

/**
 * Creates a weave reference.
 * @param atom 
 * @param index 
 * @param causeIndex 
 */
export function reference<T extends AtomOp>(atom: Atom<T>): WeaveReference<T> {
    return {
        atom
    };
}

/**
 * Defines a reference to an atom inside a weave.
 * Once created, this reference will always be valid.
 */
export interface WeaveReference<TOp extends AtomOp> {

    /**
     * The atom that this reference refers to.
     */
    atom: Atom<TOp>;
}

/**
 * Defines a weave. 
 * That is, the depth-first preorder traversal of a causal tree.
 */
export class Weave<TOp extends AtomOp> {
    
    private _atoms: WeaveReference<TOp>[];
    private _sites: SiteMap<TOp>;
    private _version: number;

    /**
     * A map of atom IDs to the total number of atoms that they contain.
     * 
     * This can effectively be used as a skip list so that jumping between parent nodes
     * is a quick operation. (much quicker than O(n) and closer to O(log n))
     */
    private _sizeMap: Map<AtomId, number>;

    /**
     * Gets the list of atoms stored in this weave.
     * The order is the depth-first traversal of the causal tree.
     */
    get atoms() {
        return this._atoms;
    }

    /**
     * Creates a new weave.
     */
    constructor() {
        this._atoms = [];
        this._sites = {};
        this._sizeMap = new Map();
    }

    /**
     * Gets the list of atoms for a site.
     * @param site The site identifier.
     */
    getSite(siteId: number): WeaveReference<TOp>[] {
        let site = this._sites[siteId];
        if (typeof site === 'undefined') {
            site = [];
            this._sites[siteId] = site;
        }
        return site;
    }

    /**
     * Inserts the given atom into the weave.
     * @param atom 
     */
    insert<T extends TOp>(atom: Atom<T>): WeaveReference<T> {
        const site = this.getSite(atom.id.site);
        if (!atom.cause) {
            // check for an existing root atom
            if (this.atoms.length > 0) {
                return <WeaveReference<T>>this.atoms[0];
            }

            const ref = reference<T>(atom);
            // Add the atom at the root of the weave.
            this._atoms.splice(0, 0, ref);
            site[ref.atom.id.timestamp] = ref;
            this._sizeMap.set(atom.id, 1);
            return ref;
        } else {
            const causeIndex = this._indexOf(atom.cause);
            if (causeIndex < 0 ) {
                return null;
            }
            const cause = this.atoms[causeIndex];
            const weaveIndex = this._weaveIndex(causeIndex, atom.id);
            const siteIndex = atom.id.timestamp;

            if (siteIndex >= 0 && siteIndex < site.length) {
                const existingAtom = site[siteIndex];
                if (existingAtom && idEquals(existingAtom.atom.id, atom.id)) {
                    return <WeaveReference<T>>existingAtom;
                }
            }
            const ref = reference<T>(atom);
            this._atoms.splice(weaveIndex, 0, ref);
            site[siteIndex] = ref;
            
            this._updateAtomSizes([ref]);

            return ref;
        }
    }

    /**
     * Inserts the given list of atoms into the weave.
     * @param atoms The atoms to insert.
     */
    insertMany<T extends TOp>(...atoms: Atom<T>[]) {
        atoms.forEach(a => {
            this.insert(a);
        });
    }

    /**
     * Removes the given reference from the weave.
     * @param ref The reference to remove.
     */
    remove(ref: WeaveReference<TOp>): boolean {
        if (!ref) {
            return false;
        }
        const span = this._getSpan(ref);
        if (!span) {
            return false;
        }
        this._removeSpan(span.index, span.length);
        return true;
    }

    /**
     * Removes all of the siblings of the given atom that happened before it.
     * @param ref The reference whose older siblings should be removed.
     */
    removeBefore(ref: WeaveReference<TOp>): boolean {
        if (!ref) {
            return false;
        }
        if (!ref.atom.cause) {
            return false;
        }
        const cause = this.getAtom(ref.atom.cause);
        if (!cause) {
            return false;
        }
        const causeSpan = this._getSpan(cause);
        if (!causeSpan) {
            return false;
        }
        const refSpan = this._getSpan(ref, causeSpan.index);
        if (!refSpan) {
            return false;
        }
        const startSplice = refSpan.index + refSpan.length;
        const endSplice = causeSpan.index + causeSpan.length;
        const spliceLength = (endSplice - startSplice);
        this._removeSpan(startSplice, spliceLength);
        return true;
    }

    private _removeSpan(index: number, length: number) {
        const removed = this._atoms.splice(index, length);
        for (let i = removed.length - 1; i >= 0; i--) {
            const r = removed[i];

            const chain = this.referenceChain(r);
            for (let i = 1; i < chain.length; i++) {
                const id = chain[i].atom.id;
                const current = this.getAtomSize(id);
                this._sizeMap.set(id, current - 1);
            }

            this._sizeMap.delete(r.atom.id);
            const site = this.getSite(r.atom.id.site);
            delete site[r.atom.id.timestamp];
        }
    }

    /**
     * Gets the atom for the given reference.
     * @param reference The reference.
     */
    getAtom<T extends TOp>(id: AtomId): WeaveReference<T> {
        if (!id) {
            return null;
        }
        const site = this.getSite(id.site);
        if (id.timestamp >= 0 && id.timestamp < site.length) {
            return <WeaveReference<T>>site[id.timestamp];
        } else {
            return null;
        }
    }

    /**
     * Gets the total number of children that the given atom contains.
     * @param id The ID of the atom to find the size of. If the tree doesn't contain the given reference then undefined is returned.
     */
    getAtomSize(id: AtomId): number {
        return this._sizeMap.get(id);
    }

    /**
     * Gets the version that this weave is currently at.
     */
    getVersion(): WeaveVersion {
        let knownSites = this.siteIds();
        let sites: WeaveSiteVersion = {};

        knownSites.forEach(id => {
            const site = this.getSite(id);
            sites[id] = site.length - 1;
        });

        return {
            sites,
            hash: this.getHash()
        };
    }

    /**
     * Gets the hash of the weave.
     */
    getHash(): string {
        return getHash(this.atoms);
    }

    /**
     * Imports the given list of atoms into this weave.
     * The atoms are assumed to be pre-sorted.
     * Returns the list of atoms that were added to the weave.
     * @param atoms The atoms to import into this weave.
     */
    import(atoms: WeaveReference<TOp>[]): WeaveReference<TOp>[] {
        
        let newAtoms: WeaveReference<TOp>[] = [];
        let localOffset = 0;
        for (let i = 0; i < atoms.length; i++) {
            const a = atoms[i];
            let local = this._atoms[i + localOffset];

            // No more local atoms, so the remote atoms are merely append
            // operations
            if (!local) {
                // Short circut by appending the rest.
                const finalAtoms = atoms.slice(i);

                for (let b = 0; b < finalAtoms.length; b++) {
                    const ref = finalAtoms[b];
                    if (ref.atom.cause) {
                        const cause = this.getAtom(ref.atom.cause);
                        if (!cause) {
                            // prevent atoms without parents
                            // if the input is properly sorted,
                            // then it is impossible to end up with
                            // an atom without a cause.
                            continue;
                        }
                    }
                    
                    this._atoms.push(ref);
                    newAtoms.push(ref);
                    const site = this.getSite(ref.atom.id.site);
                    site[ref.atom.id.timestamp] = ref;
                }
                break;
            } else {
                // Could either be the same, a new sibling, or a new child of the current subtree

                if (a.atom.cause) {
                    const cause = this.getAtom(a.atom.cause);
                    if (!cause) {
                        // prevent atoms without parents
                        // if the input is properly sorted,
                        // then it is impossible to end up with
                        // an atom without a cause.
                        continue;
                    }
                }

                let order = this._compareAtoms(a.atom, local.atom);
                if (isNaN(order)) {
                    break;
                } else if (order === 0) {
                    // Atoms are equal, no action needed.
                } else if(order < 0) {
                    // New atom should be before local atom.
                    // insert at this index.
                    this._atoms.splice(i + localOffset, 0, a);
                    newAtoms.push(a);
                    
                    const site = this.getSite(a.atom.id.site);
                    site[a.atom.id.timestamp] = a;
                } else if(order > 0) {
                    // New atom should be after local atom.
                    // Skip local atoms until we find the right place to put the new atom.
                    do {
                        localOffset += 1;
                        local = this._atoms[i + localOffset];
                    } while(local && a.atom.id.timestamp <= local.atom.cause.timestamp);
                    
                    order = this._compareAtoms(a.atom, local.atom);
                    if (order < 0) {
                        this._atoms.splice(i + localOffset, 0, a);
                        newAtoms.push(a);

                        const site = this.getSite(a.atom.id.site);
                        site[a.atom.id.timestamp] = a;
                    }
                }
            }
        }

        this._updateAtomSizes(newAtoms);

        return newAtoms;
    }
    
    /**
     * Gets the list of site IDs that this weave contains.
     */
    siteIds() {
        return keys(this._sites).map(id => parseInt(id)).sort();
    }

    /**
     * Calculates the chain of references from the root directly to the given reference.
     * Returns the chain from the given reference to the rootmost reference.
     * @param weave The weave that the reference is from.
     * @param ref The reference.
     */
    referenceChain(ref: WeaveReference<TOp>): WeaveReference<TOp>[] {
        let chain = [ref];

        let cause = ref.atom.cause;
        while(cause) {
            const causeRef = this.getAtom(cause);
            
            chain.push(causeRef);

            cause = causeRef.atom.cause;
        }

        return chain;
    }

    /**
     * Updates the sizes of the given references in the map.
     * @param refs The references to update.
     */
    private _updateAtomSizes(refs: WeaveReference<TOp>[]) {
        for (let i = 0; i < refs.length; i++) {
            const ref = refs[i];
            const chain = this.referenceChain(ref);
            for (let b = 0; b < chain.length; b++) {
                const id = chain[b].atom.id;
                const current = this.getAtomSize(id) || 0;
                this._sizeMap.set(id, current + 1);
            }
        }
    }

    /**
     * Gets the index that the given ref starts and and the number of children it has
     * after it.
     * Returns null if the given ref doesn't exist in the weave.
     * @param ref The reference.
     * @param start The index to start searching at.
     */
    private _getSpan(ref: WeaveReference<TOp>, start: number = 0) {
        const index = this._indexOf(ref.atom.id, start);
        if (index < 0) {
            return null;
        }
        return { index, length: this.getAtomSize(ref.atom.id) };
    }

    /**
     * Finds the index that an atom should appear at in the weave.
     * @param causeIndex The index of the parent for the atom.
     * @param atomId The ID of the atom to find the index for.
     */
    private _weaveIndex(causeIndex: number, atomId: AtomId): number {
        const cause = this._atoms[causeIndex];
        let index = causeIndex + 1;
        for (; index < this._atoms.length; index++) {
            const ref = this._atoms[index];
            const order = this._compareAtomIds(atomId, ref.atom.id);
            if (order < 0) {
                break;
            }
            
            if (!idEquals(ref.atom.cause, cause.atom.id)) {
                break;
            }
        }

        return index;
    }

    /**
     * Finds the index that the atom with the given ID is in the atoms array.
     * TODO: Improve performance. This function is ~90% of the cost of inserting atoms.
     *       It's kinda tricky to do because the weave can't use traditional algorithms like
     *       binary search because its not sorted in a regular manner.
     * @param atom The atom ID to search for.
     */
    private _indexOf(id: AtomId, start: number = 0): number {
        return weaveIndexOf(this._atoms, id, start);
    }

    /**
     * Compares the two atoms to see which should be sorted in front of the other.
     * Returns -1 if the first should be before the second.
     * Returns 0 if they are equal.
     * Returns 1 if the first should be after the second.
     * @param first The first atom.
     * @param second The second atom.
     */
    private _compareAtoms(first: Atom<TOp>, second: Atom<TOp>): number {
        const cause = this._compareAtomIds(first.cause, second.cause);
        if (cause === 0) {
            let order = this._compareAtomIds(first.id, second.id);
            if (order === 0 && first.checksum !== second.checksum) {
                return NaN;
            }
            return order;
        }
        return cause;
    }

    /**
     * Determines if the first atom ID should sort before, at, or after the second atom ID.
     * Returns -1 if the first should be before the second.
     * Returns 0 if the IDs are equal.
     * Returns 1 if the first should be after the second.
     * @param first The first atom ID.
     * @param second The second atom ID.
     */
    private _compareAtomIds(first: AtomId, second: AtomId) {
        if (!first && second) {
            return -1;
        } else if(!second && first) {
            return 1;
        } else if (first === second) {
            return 0;
        }
        if (first.priority > second.priority) {
            return -1;
        } else if(first.priority < second.priority) {
            return 1;
        } else if (first.priority === second.priority) {
            if (first.timestamp > second.timestamp) {
                return -1;
            } else if(first.timestamp < second.timestamp) {
                return 1;
            } else if (first.timestamp === second.timestamp) {
                if (first.site < second.site) {
                    return -1;
                } else if(first.site > second.site) {
                    return 1;
                }
            }
        }
        return 0;
    }

    /**
     * Builds a weave from an array of atoms.
     * This array is assumed to already be sorted in the correct order.
     * If the array was obtained from Weave.atoms, then it will be in the correct order. 
     * @param refs The atom references that the new weave should be built from.
     */
    static buildFromArray<TOp extends AtomOp>(refs: WeaveReference<TOp>[]): Weave<TOp> {
        let weave = new Weave<TOp>();
        weave.import(refs);
        return weave;
    }
}

/**
 * Defines a map from site IDs to indexes in an array of atoms.
 * This is used to make it easy to jump to a specific site's atoms
 * even though they are stored in the same array.
 */
export interface SiteMap<TOp extends AtomOp> {
    [site: number]: WeaveReference<TOp>[];
}

/**
 * Finds the index of the given atom in the given array.
 * Returns -1 if the atom could not be found.
 * @param arr The array to search through.
 * @param id The ID of the atom to find.
 * @param start The optional starting index.
 */
export function weaveIndexOf<TOp extends AtomOp>(arr: WeaveReference<TOp>[], id: AtomId, start: number = 0): number {
    for (let i = start; i < arr.length; i++) {
        const ref = arr[i];
        if (idEquals(ref.atom.id, id)) {
            return i;
        }
    }

    return -1;
}
