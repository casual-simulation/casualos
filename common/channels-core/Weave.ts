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
     * Creates a new weave reference.
     * @param id 
     * @param index 
     */
    constructor(id: AtomId, index: number) {
        this.id = id;
        this.index = index;
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
            return new WeaveReference(atom.id, 0);
        } else {
            const causeIndex = this._indexOf(atom.cause);
            const weaveIndex = this._weaveIndex(causeIndex, atom.id);

            this._atoms.splice(weaveIndex, 0, atom);
            return new WeaveReference(atom.id, weaveIndex);
        }
    }

    /**
     * Finds the index that an atom should appear at in the weave.
     * @param causeIndex The index of the parent for the atom.
     * @param atomId The ID of the atom to find the index for.
     */
    private _weaveIndex(causeIndex: number, atomId: AtomId) {
        const cause = this._atoms[causeIndex];
        let index = causeIndex + 1;
        for (; index < this._atoms.length; index++) {
            const atom = this._atoms[index];
            if (atomId.priority > atom.id.priority) {
                break;
            } else if (atomId.timestamp > atom.id.timestamp) {
                break;
            } else if(atomId.timestamp === atom.id.timestamp) {
                if (atomId.site < atom.id.site) {
                    break;
                }
            } else if(!atom.cause.equals(cause.id)) {
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