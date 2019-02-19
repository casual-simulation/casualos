import { AtomOp, Atom, AtomId, atom, atomId } from "./Atom";
import { WeaveReference } from "./Weave";

/**
 * Defines a class that can create atoms based on a site ID and lamport timestamp.
 */
export class AtomFactory<TOp extends AtomOp> {

    private _site: number;
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
     * @param site 
     * @param timestamp 
     */
    constructor(site: number, timestamp: number = 0) {
        this._site = site;
        this._time = timestamp;
    }

    /**
     * Updates the timestamp stored by this factory.
     * This should only be called upon receiving new never-seen events from a remote source.
     * @param newTimestamp The latest timestamp seen by the app.
     */
    updateTime(newTimestamp: number) {
        this._time = Math.max(this._time, newTimestamp) + 1;
    }

    /**
     * Creates a new Atom with the given op.
     * @param op The operation to include with the atom.
     * @param cause The parent cause of this atom.
     */
    create<T extends TOp>(op: T, cause: WeaveReference<TOp> | Atom<TOp> | AtomId, priority?: number): Atom<T> {
        let causeId: AtomId = null;
        if (cause) {
            causeId = <any>(!!(<WeaveReference<TOp>>cause).atom ? (<WeaveReference<TOp>>cause).atom.id : 
                (<Atom<TOp>>cause).id ? (<Atom<TOp>>cause).id : cause);
        }
        this._time += 1;
        return atom(atomId(this._site, this._time, priority), causeId, op);
    }
}