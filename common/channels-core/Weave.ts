import { Atom, AtomId } from "./Atom";
import { VirtualArray } from "./VirtualArray";

/**
 * Defines a reference to an atom inside a weave.
 */
export class WeaveReference {
    /**
     * The index that the atom is at.
     */
    index: number;

    /**
     * The ID of the atom that this reference is for.
     */
    id: AtomId;

    /**
     * The version of the weave that this reference is referring to.
     */
    version: number;

    /**
     * Creates a new weave reference.
     * @param id 
     * @param index 
     */
    constructor(id: AtomId, index: number, version: number) {
        this.id = id;
        this.index = index;
        this.version = version;
    }
}

/**
 * Defines a weave. 
 * That is, the depth-first preorder traversal of a causal tree.
 */
export class Weave<T> {

    private _atoms: Atom<T>[];
    private _sites: SiteMap;
    private _version: number;

    /**
     * Creates a new weave.
     */
    constructor() {
        this._atoms = [];
        this._sites = {};
    }

    /**
     * Inserts the given atom into the weave.
     * @param atom 
     */
    insert(atom: Atom<T>): WeaveReference {
        if (!atom.cause) {
            // Add the atom at the root of the weave.
            this._atoms.splice(0, 0, atom);
            return new WeaveReference(atom.id, 0, this._version);
        } else {
            const index = this._indexOf(atom.cause);

            

            this._atoms.splice(index, 0, atom);
            return new WeaveReference(atom.id, index, this._version);
        }
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

    private _getSite(site: number): VirtualArray<Atom<T>> {
        const siteIndex = this._sites[site];
        if (typeof siteIndex === 'undefined') {
            return new VirtualArray(this._atoms, this._atoms.length);
        } else {
            return new VirtualArray(this._atoms, siteIndex.start, siteIndex.end);
        }
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