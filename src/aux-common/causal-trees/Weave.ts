import { Atom, AtomId, AtomOp, StorableAtomId, idEquals } from "./Atom";
import { VirtualArray } from "./VirtualArray";
import { sortBy, findIndex, keys, find } from "lodash";
import { WeaveVersion, WeaveSiteVersion } from "./WeaveVersion";
import { getHash, getHashBuffer } from './Hash';

/**
 * Creates a weave reference.
 * @param atom 
 * @param index 
 * @param causeIndex 
 */
export function reference<T extends AtomOp>(atom: Atom<T>, index: number, causeIndex: number): WeaveReference<T> {
    const hash = getHashBuffer([atom, index, causeIndex]);
    return {
        atom,
        index,
        causeIndex,
        
        // Read only 32 bits of the hash.
        // This should be good enough to prevent collisions for weaves 
        // of up to ~2 billion atoms instead of never.
        checksum: hash.readUInt32BE(0)
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

    /**
     * The index in the site that this atom refers to.
     * Because sites cannot create concurrent atoms,
     * this value will always be valid.
     */
    index: number;

    /**
     * The index in the site that is this atom's cause.
     */
    causeIndex: number;

    /**
     * The checksum for this reference.
     * Used to verify that a reference is valid.
     */
    checksum: number;
}

/**
 * Defines a weave. 
 * That is, the depth-first preorder traversal of a causal tree.
 */
export class Weave<TOp extends AtomOp> {
    private _atoms: WeaveReference<TOp>[];
    private _sites: SiteMap;
    private _version: number;

    /**
     * The yarn of the weave.
     * Yarn is just a fancy name for an array that is split into
     * different segments where each segment represents a particular site's
     * atoms.
     * 
     * In the context of Causal Trees, yarn is useful because it gives us an easy way to prune the tree
     * without causing errors. Once pruned we can simply recreate the tree via re-inserting everything.
     */
    private _yarn: WeaveReference<TOp>[];

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
        this._yarn = [];
        this._sites = {};
    }

    /**
     * Gets the list of atoms for a site.
     * @param site The site identifier.
     */
    getSite(site: number): VirtualArray<WeaveReference<TOp>> {
        const siteIndex = this._sites[site];
        if (typeof siteIndex === 'undefined') {
            const siteIds = this.siteIds();
            let index = findIndex(siteIds, id => id > site);
            let yarnIndex = this._yarn.length;
            if (index >= 0) {
                const siteAfter = this._sites[siteIds[index]];
                yarnIndex = siteAfter.start;
            }
            return new VirtualArray(this._yarn, yarnIndex, yarnIndex);
        } else {
            return new VirtualArray(this._yarn, siteIndex.start, siteIndex.end);
        }
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

            const ref = reference<T>(atom, 0, null);
            // Add the atom at the root of the weave.
            this._atoms.splice(0, 0, ref);
            site.insert(0, ref);
            this._sites[atom.id.site] = {
                start: site.start,
                end: site.end
            };
            return ref;
        } else {
            const causeIndex = this._indexOf(atom.cause);
            if (causeIndex < 0 ) {
                return null;
            }
            const cause = this.atoms[causeIndex];
            const weaveIndex = this._weaveIndex(causeIndex, atom.id);
            const siteIndex = this._siteIndex(atom.id, site);

            if (siteIndex >= 0 && siteIndex < site.length) {
                const existingAtom = site.get(siteIndex);
                if (existingAtom && idEquals(existingAtom.atom.id, atom.id)) {
                    return <WeaveReference<T>>existingAtom;
                }
            }

            const ref = reference<T>(atom, siteIndex, cause ? cause.index : null);
            this._atoms.splice(weaveIndex, 0, ref);
            site.insert(siteIndex, ref);
            this._updateSites(atom.id.site, site);

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
     * Gets the atom for the given reference.
     * @param reference The reference.
     */
    getAtom<T extends TOp>(id: AtomId, index: number): WeaveReference<T> {
        const site = this.getSite(id.site);
        return <WeaveReference<T>>site.get(index);
    }

    /**
     * Gets the version that this weave is currently at.
     */
    getVersion(): WeaveVersion {
        let knownSites = this.siteIds();
        let sites: WeaveSiteVersion = {};

        knownSites.forEach(id => {
            const site = this.getSite(id);
            const mostRecentAtom = site.get(site.length - 1);
            sites[id] = mostRecentAtom.atom.id.timestamp;
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
                this._atoms.push(...finalAtoms);
                newAtoms.push(...finalAtoms);

                for (let b = 0; b < finalAtoms.length; b++) {
                    const ref = finalAtoms[b];
                    const site = this.getSite(ref.atom.id.site);
                    site.set(ref.index, ref);
                    this._sites[ref.atom.id.site] = {
                        start: site.start,
                        end: site.end
                    };
                }
                break;
            } else {
                // Could either be the same, a new sibling, or a new child of the current subtree

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
                    const site = this.getSite(a.atom.id.site);
                    site.set(a.index, a);
                    this._sites[a.atom.id.site] = {
                        start: site.start,
                        end: site.end
                    };
                } else if(order > 0) {
                    // New atom should be after local atom.
                    // Skip local atoms until we find the right place to put the new atom.
                    do {
                        localOffset += 1;
                        local = this._atoms[i + localOffset];
                    } while(local && a.atom.id.timestamp <= local.atom.cause.timestamp);
                    
                    order = this._compareAtoms(a, local);
                    if (order < 0) {
                        this._atoms.splice(i + localOffset, 0, a);
                        newAtoms.push(a);
                        const site = this.getSite(a.atom.id.site);
                        site.set(a.index, a);
                        this._sites[a.atom.id.site] = {
                            start: site.start,
                            end: site.end
                        };
                    }
                }
            }
        }

        return newAtoms;
    }
    
    /**
     * Gets the list of site IDs that this weave contains.
     */
    siteIds() {
        return keys(this._sites).map(id => parseInt(id)).sort();
    }

    /**
     * Updates the sites map.
     */
    private _updateSites(siteId: number, site: VirtualArray<WeaveReference<TOp>>) {
        const siteIds = this.siteIds();
        let updatedSite = false;
        for (let i = 0; i < siteIds.length; i++) {
            let id = siteIds[i];
            
            if (id === siteId || (id > siteId && !updatedSite)) {
                this._sites[siteId] = {
                    start: site.start,
                    end: site.end
                };
                updatedSite = true;
            }
            if (id > siteId) {
                let current = this.getSite(id);
                const offset = (site.end - current.start);
                // offset all the other sites
                for (let b = i; b < siteIds.length; b++) {
                    id = siteIds[b];
                    current = this.getSite(id);
                    this._sites[id] = {
                        start: current.start + offset,
                        end: current.end + offset
                    };
                }
                break;
            }
        }

        if (!updatedSite) {
            this._sites[siteId] = {
                start: site.start,
                end: site.end
            };
        }
    }

    private _sortYarn() {
        this._yarn = sortBy(this._yarn, ['atom.id.site', 'atom.id.timestamp', 'atom.id.priority']);

        let currentSite = null;
        let siteStart = 0;
        for (let i = 0; i < this._yarn.length; i++) {
            const ref = this._yarn[i];
            const newSite = ref.atom.id.site;
            if (currentSite !== newSite) {
                if (currentSite) {
                    this._sites[currentSite] = {
                        start: siteStart,
                        end: i
                    };
                }
                siteStart = i;
                currentSite = ref.atom.id.site;
            }
        }
        if (currentSite) {
            this._sites[currentSite] = {
                start: siteStart,
                end: this._yarn.length
            };
        }
    }

    /**
     * Finds the index that an atom should appear at in a yarn.
     */
    private _siteIndex(atomId: AtomId, site: VirtualArray<WeaveReference<TOp>>): number {
        for (let i = site.length - 1; i >= 0; i--) {
            const ref = site.get(i);
            if (atomId.timestamp < ref.atom.id.timestamp) {
                return i;
            } else if(atomId.timestamp === ref.atom.id.timestamp && atomId.priority > ref.atom.id.priority) {
                return i;
            } else if(idEquals(atomId, ref.atom.id)) {
                return i;
            }
        }
        return site.length;
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
     * @param atom The atom ID to search for.
     */
    private _indexOf(id: AtomId): number {
        for (let i = this._atoms.length - 1; i >= 0; i--) {
            const ref = this._atoms[i];
            if (idEquals(ref.atom.id, id)) {
                return i;
            }
        }

        return -1;
    }

    /**
     * Compares the two atoms to see which should be sorted in front of the other.
     * Returns -1 if the first should be before the second.
     * Returns 0 if they are equal.
     * Returns 1 if the first should be after the second.
     * @param first The first atom.
     * @param second The second atom.
     */
    private _compareAtoms(first: WeaveReference<TOp>, second: WeaveReference<TOp>): number {
        const cause = this._compareAtomIds(first.atom.cause, second.atom.cause);
        if (cause === 0) {
            let order = this._compareAtomIds(first.atom.id, second.atom.id);
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
export interface SiteMap {
    [site: number]: {start: number, end: number};
}