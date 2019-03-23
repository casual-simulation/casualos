import { Atom, AtomId, AtomOp, idEquals, atomIdToString, atomId } from "./Atom";
import { keys } from "lodash";
import { WeaveVersion, WeaveSiteVersion } from "./WeaveVersion";
import { getHash } from './Hash';

/**
 * Defines a weave. 
 * That is, the depth-first preorder traversal of a causal tree.
 */
export class Weave<TOp extends AtomOp> {
    
    private _atoms: Atom<TOp>[];
    private _sites: SiteMap<TOp>;

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
    getSite(siteId: number): Atom<TOp>[] {
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
    insert<T extends TOp>(atom: Atom<T>): Atom<T> {
        const site = this.getSite(atom.id.site);
        if (!atom.cause) {

            // check for an existing root atom
            if (this.atoms.length > 0) {
                throw new Error('Cannot add second root atom.');
            }

            // Add the atom at the root of the weave.
            this._atoms.splice(0, 0, atom);
            site[atom.id.timestamp] = atom;
            this._sizeMap.set(atom.id, 1);
            return atom;
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
                if (existingAtom && idEquals(existingAtom.id, atom.id)) {
                    return <Atom<T>>existingAtom;
                }
            }
            this._atoms.splice(weaveIndex, 0, atom);
            site[siteIndex] = atom;
            
            this._updateAtomSizes([atom]);

            return atom;
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
     * Returns the references that were removed.
     * @param ref The reference to remove.
     */
    remove(ref: Atom<TOp>): Atom<TOp>[] {
        if (!ref) {
            return [];
        }
        const span = this._getSpan(ref);
        if (!span) {
            return [];
        }
        return this._removeSpan(span.index, span.length);
    }

    /**
     * Removes all of the siblings of the given atom that happened before it.
     * Returns the references that were removed.
     * @param atom The reference whose older siblings should be removed.
     */
    removeBefore(atom: Atom<TOp>): Atom<TOp>[] {
        if (!atom) {
            return [];
        }
        if (!atom.cause) {
            return [];
        }
        const cause = this.getAtom(atom.cause);
        if (!cause) {
            return [];
        }
        const causeSpan = this._getSpan(cause);
        if (!causeSpan) {
            return [];
        }
        const refSpan = this._getSpan(atom, causeSpan.index);
        if (!refSpan) {
            return [];
        }
        const startSplice = refSpan.index + refSpan.length;
        const endSplice = causeSpan.index + causeSpan.length;
        const spliceLength = (endSplice - startSplice);
        return this._removeSpan(startSplice, spliceLength);
    }

    private _removeSpan(index: number, length: number) {
        const removed = this._atoms.splice(index, length);
        for (let i = removed.length - 1; i >= 0; i--) {
            const r = removed[i];

            const chain = this.referenceChain(r);
            for (let i = 1; i < chain.length; i++) {
                const id = chain[i].id;
                const current = this.getAtomSize(id);
                this._sizeMap.set(id, current - 1);
            }

            this._sizeMap.delete(r.id);
            const site = this.getSite(r.id.site);
            delete site[r.id.timestamp];
        }
        return removed;
    }

    /**
     * Gets the atom for the given reference.
     * @param reference The reference.
     */
    getAtom<T extends TOp>(id: AtomId): Atom<T> {
        if (!id) {
            return null;
        }
        const site = this.getSite(id.site);
        if (id.timestamp >= 0 && id.timestamp < site.length) {
            return <Atom<T>>site[id.timestamp];
        } else {
            return null;
        }
    }

    /**
     * Gets the size of the atom with the given ID.
     * The size of an atom is defined as the number of children it has plus 1.
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
     * Gets a new weave that contains only the atoms needed to keep the given version consistent.
     * @param version The version of the weave to get.
     */
    getWeft(version: WeaveSiteVersion, preserveChildren: boolean = false): Weave<TOp> {
        let newWeave = this.copy();

        if (preserveChildren) {
            // travel from leaf nodes to the root node
            for (let i = newWeave.atoms.length - 1; i >= 0; i--) {
                const atom = newWeave.atoms[i];
                const id = atom.id;
                const site = id.site;
                const oldestAllowed = version[site];
                if (!oldestAllowed || id.timestamp > oldestAllowed) {
                    // When preserving children,
                    // we only remove an atom if it has no children.
                    if (newWeave.getAtomSize(id) === 1) {
                        newWeave.remove(atom);
                    }
                }
            }
        } else {
            for (let i = 0; i < newWeave.atoms.length; i++) {
                const atom = newWeave.atoms[i];
                const id = atom.id;
                const site = id.site;
                const oldestAllowed = version[site];
                if (!oldestAllowed || id.timestamp > oldestAllowed) {
                    newWeave.remove(atom);
                    i -= 1;
                }
            }
        }
        newWeave._trimSites();

        return newWeave;
    }

    /**
     * Copies this weave and returns the clone.
     */
    copy(): Weave<TOp> {
        let newWeave = new Weave<TOp>();
        newWeave._atoms = this._atoms.slice();
        newWeave._sizeMap = new Map(this._sizeMap);
        newWeave._sites = {};
        for (let key in this._sites) {
            newWeave._sites[key] = this._sites[key].slice();
        }
        return newWeave;
    }

    /**
     * Imports the given list of atoms into this weave.
     * The atoms are assumed to be pre-sorted.
     * Returns the list of atoms that were added to the weave.
     * @param atoms The atoms to import into this weave.
     */
    import(atoms: Atom<TOp>[]): Atom<TOp>[] {
        
        let newAtoms: Atom<TOp>[] = [];
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
                    const atom = finalAtoms[b];
                    if (atom.cause) {
                        const cause = this.getAtom(atom.cause);
                        if (!cause) {
                            // prevent atoms without parents
                            // if the input is properly sorted,
                            // then it is impossible to end up with
                            // an atom without a cause.
                            continue;
                        }
                    }
                    
                    this._atoms.push(atom);
                    newAtoms.push(atom);
                    const site = this.getSite(atom.id.site);
                    site[atom.id.timestamp] = atom;
                }
                break;
            } else {
                // Could either be the same, a new sibling, or a new child of the current subtree

                if (a.cause) {
                    const cause = this.getAtom(a.cause);
                    if (!cause) {
                        // prevent atoms without parents
                        // if the input is properly sorted,
                        // then it is impossible to end up with
                        // an atom without a cause.
                        continue;
                    }
                }

                const exists = this.getAtom(a.id);
                if (exists && a.checksum !== exists.checksum) {
                    // Break because the atoms aren't actually the same
                    // even though they claim to be
                    console.warn(`[Weave] Atom ${atomIdToString(a.id)} rejected because its checksum didn't match the existing atom (${a.checksum} !== ${exists.checksum})`);
                    break;
                }

                let order = this._compareAtoms(a, local);
                if (isNaN(order)) {
                    break;
                } else if (order === 0) {
                    // Atoms are equal, no action needed.
                } else if(order < 0) {
                    // New atom should be before local atom.
                    // insert at this index.
                    this._atoms.splice(i + localOffset, 0, a);
                    newAtoms.push(a);
                    
                    const site = this.getSite(a.id.site);
                    site[a.id.timestamp] = a;
                } else if(order > 0) {
                    // New atom should be after local atom.
                    // Skip local atoms until we find the right place to put the new atom.
                    do {
                        localOffset += 1;
                        local = this._atoms[i + localOffset];
                    } while(local && a.id.timestamp <= local.cause.timestamp);
                    
                    order = this._compareAtoms(a, local);
                    if (order < 0) {
                        this._atoms.splice(i + localOffset, 0, a);
                        newAtoms.push(a);

                        const site = this.getSite(a.id.site);
                        site[a.id.timestamp] = a;
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
    referenceChain(ref: Atom<TOp>): Atom<TOp>[] {
        let chain = [ref];

        let cause = ref.cause;
        while(cause) {
            const causeRef = this.getAtom(cause);
            
            if (!causeRef) {
                throw new Error(`[Weave] Could not find cause for atom ${atomIdToString(cause)}`);
            }

            chain.push(causeRef);

            cause = causeRef.cause;
        }

        return chain;
    }

    /**
     * Determines if this causal tree is valid.
     */
    isValid(): boolean {
        if (this._atoms.length === 0) {
            return true;
        }

        let parents = [this._atoms[0]];
        for (let i = 1; i < this._atoms.length; i++) {
            const child = this._atoms[i];
            let parent = parents[0];

            const existing = this.getAtom(child.id);
            if (!existing) {
                console.warn(`[Weave] Invalid tree. ${atomIdToString(child.id)} was not able to be found by its ID. This means the site cache is out of date.`);
                return false;
            } else if (child.checksum !== existing.checksum) {
                console.warn(`[Weave] Invalid tree. There is a duplicate ${atomIdToString(child.id)} in the tree. Checksums did not match.`);
                return false;
            }

            if (idEquals(child.cause, parent.cause)) {
                const order = this._compareAtoms(child, parent);

                // siblings
                if (order < 0) {
                    console.warn(`[Weave] Invalid tree. ${atomIdToString(child.id)} says it happened before its sibling (${parent.id}) that occurred before it in the tree.`);
                    return false;
                }
            }

            while (!idEquals(child.cause, parent.id)) {
                parents.shift();
                if (parents.length === 0) {
                    console.warn(`[Weave] Invalid tree. ${atomIdToString(child.id)} is either inserted before ${atomIdToString(child.cause)} or the cause is not in the tree.`);
                    return false;
                }
                parent = parents[0];
            }

            if (child.id.timestamp <= parent.id.timestamp) {
                console.warn(`[Weave] Invalid tree. ${atomIdToString(child.id)} says it happened before its parent ${atomIdToString(child.cause)}.`);
                return false;
            }

            parents.unshift(child);
        }

        return true;
    }

    /**
     * Trims the site map so that it only contains spaces for atoms that are currently in this weave.
     * As a result, getVersion() will no longer show the latest timestamp from each site but only 
     * the latest timestamp that is currently in the site.
     */
    private _trimSites() {
        for (let siteId in this._sites) {
            let site = this._sites[siteId];
            let i = site.length;
            while (i > 0) {
                if (typeof site[i - 1] !== 'undefined') {
                    break;
                }
                i -= 1;
            }
            site.splice(i);

            if (site.length === 0) {
                delete this._sites[siteId];
            }
        }
    }

    /**
     * Updates the sizes of the given references in the map.
     * @param atoms The references to update.
     */
    private _updateAtomSizes(atoms: Atom<TOp>[]) {
        for (let i = 0; i < atoms.length; i++) {
            const atom = atoms[i];
            const chain = this.referenceChain(atom);
            for (let b = 0; b < chain.length; b++) {
                const id = chain[b].id;
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
    private _getSpan(ref: Atom<TOp>, start: number = 0) {
        const index = this._indexOf(ref.id, start);
        if (index < 0) {
            return null;
        }
        return { index, length: this.getAtomSize(ref.id) };
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
            const atom = this._atoms[index];
            const order = this._compareAtomIds(atomId, atom.id);
            if (order < 0) {
                break;
            }
            
            if (!idEquals(atom.cause, cause.id)) {
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
    static buildFromArray<TOp extends AtomOp>(refs: Atom<TOp>[]): Weave<TOp> {
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
    [site: number]: Atom<TOp>[];
}

/**
 * Finds the index of the given atom in the given array.
 * Returns -1 if the atom could not be found.
 * @param arr The array to search through.
 * @param id The ID of the atom to find.
 * @param start The optional starting index.
 */
export function weaveIndexOf<TOp extends AtomOp>(arr: Atom<TOp>[], id: AtomId, start: number = 0): number {
    for (let i = start; i < arr.length; i++) {
        const atom = arr[i];
        if (idEquals(atom.id, id)) {
            return i;
        }
    }

    return -1;
}
