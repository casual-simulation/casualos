import { Atom, AtomId, atom, atomId } from './Atom2';

/**
 * Defines a class that can create atoms based on a site ID and lamport timestamp.
 */
export class AtomFactory {
    private _site: string;
    private _time: number;

    /**
     * Gets the site ID for this factory.
     */
    get site() {
        return this._site;
    }

    /**
     * Gets the current lamport time from this factory.
     */
    get time() {
        return this._time;
    }

    /**
     * Creates a new atom factory with the given site.
     * @param site The site that this factory creates atoms for.
     * @param timestamp The timestamp that this factory is starting at.
     */
    constructor(site: string, timestamp: number = 0) {
        this._site = site;
        this._time = timestamp;
    }

    /**
     * Updates the timestamp stored by this factory.
     * @param atom The atom that is being added to the tree.
     */
    updateTime<T>(atom: Atom<T>) {
        if (atom.id.site !== this.site) {
            this._time = Math.max(this._time, atom.id.timestamp) + 1;
        } else {
            this._time = Math.max(this._time, atom.id.timestamp);
        }
    }

    /**
     * Creates a new Atom with the given op.
     * @param op The operation to include with the atom.
     * @param cause The parent cause of this atom.
     */
    async create<T>(
        op: T,
        cause: Atom<T>,
        priority?: number
    ): Promise<Atom<T>> {
        this._time += 1;
        return atom(atomId(this.site, this._time, priority), cause, op);
    }
}
