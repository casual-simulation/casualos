import { AtomOp, Atom, AtomId, atom, atomId } from "./Atom";
import { SiteInfo } from "./SiteIdInfo";

/**
 * Defines a class that can create atoms based on a site ID and lamport timestamp.
 */
export class AtomFactory<TOp extends AtomOp> {

    private _site: SiteInfo;
    private _time: number;

    /**
     * Gets the site ID for this factory.
     */
    get site() {
        return this._site.id;
    }

    /**
     * Gets the current lamport time from this factory.
     */
    get time() {
        return this._time;
    }

    /**
     * Creates a new atom factory with the given site.
     * @param site 
     * @param timestamp 
     */
    constructor(site: SiteInfo, timestamp: number = 0) {
        this._site = site;
        this._time = timestamp;
    }

    /**
     * Updates the timestamp stored by this factory.
     * @param atom The atom that is being added to the tree.
     */
    updateTime<T extends TOp>(atom: Atom<T>) {
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
    create<T extends TOp>(op: T, cause: Atom<TOp> | AtomId, priority?: number): Atom<T> {
        let causeId: AtomId = null;
        if (cause) {
            causeId = <any>(!!(<Atom<TOp>>cause).id ? (<Atom<TOp>>cause).id : cause);
        }
        this._time += 1;
        return atom(atomId(this.site, this._time, priority), causeId, op);
    }
}