import { Atom, AtomId, AtomOp } from "./Atom";
import { VirtualArray } from "./VirtualArray";

/**
 * Defines a reference to an atom inside a weave.
 * Once created, this reference will always be valid.
 */
export class WeaveReference {

    /**
     * The site that this atom refers to.
     */
    site: number;

    /**
     * The index in the site that this atom refers to.
     */
    index: number;

    /**
     * Creates a new weave reference.
     * @param site
     * @param index 
     */
    constructor(site: number, index: number) {
        this.site = site;
        this.index = index;
    }
}

/**
 * Defines a weave. 
 * That is, the depth-first preorder traversal of a causal tree.
 */
export class Weave<T extends AtomOp> {

    private _atoms: Atom<T>[];
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
    private _yarn: Atom<T>[];

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
    getSite(site: number): VirtualArray<Atom<T>> {
        const siteIndex = this._sites[site];
        if (typeof siteIndex === 'undefined') {
            return new VirtualArray(this._yarn, this._yarn.length);
        } else {
            return new VirtualArray(this._yarn, siteIndex.start, siteIndex.end);
        }
    }

    /**
     * Inserts the given atom into the weave.
     * @param atom 
     */
    insert(atom: Atom<T>): WeaveReference {
        const site = this.getSite(atom.id.site);
        if (!atom.cause) {
            // Add the atom at the root of the weave.
            this._atoms.splice(0, 0, atom);
            site.insert(0, atom);
            this._sites[atom.id.site] = {
                start: site.start,
                end: site.end
            };
            return new WeaveReference(atom.id.site, 0);
        } else {
            const causeIndex = this._indexOf(atom.cause);
            const weaveIndex = this._weaveIndex(causeIndex, atom.id);
            const siteIndex = this._siteIndex(atom.id, site);
            this._atoms.splice(weaveIndex, 0, atom);
            site.insert(siteIndex, atom);
            this._sites[atom.id.site] = {
                start: site.start,
                end: site.end
            };

            return new WeaveReference(atom.id.site, siteIndex);
        }
    }

    /**
     * Gets the atom for the given reference.
     * @param reference The reference.
     */
    getAtom(reference: WeaveReference): Atom<T> {
        const site = this.getSite(reference.site);
        return site.get(reference.index);
    }

    /**
     * Finds the index that an atom should appear at in a yarn.
     */
    private _siteIndex(atomId: AtomId, site: VirtualArray<Atom<T>>): number {
        for (let i = site.length - 1; i >= 0; i--) {
            const atom = site.get(i);
            if (atomId.timestamp < atom.id.timestamp) {
                return i;
            } else if(atomId.timestamp === atom.id.timestamp && atomId.priority > atom.id.priority) {
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
            const atom = this._atoms[index];
            if (atomId.priority > atom.id.priority) {
                break;
            } else if (atomId.priority === atom.id.priority) {
                if (atomId.timestamp > atom.id.timestamp) {
                    break;
                } else if (atomId.timestamp === atom.id.timestamp) {
                    if (atomId.site < atom.id.site) {
                        break;
                    }
                }
            }
            
            if (!atom.cause.equals(cause.id)) {
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
            const atom = this._atoms[i];
            if (atom.id.equals(id)) {
                return i;
            }
        }

        return -1;
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