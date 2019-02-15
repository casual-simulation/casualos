import { AtomOp, Atom, AtomId } from "./Atom";
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
    create<T extends TOp>(op: T, cause: WeaveReference<TOp, TOp> | Atom<TOp> | AtomId, priority?: number): Atom<T> {
        const causeId = (cause instanceof WeaveReference || cause instanceof Atom) ? cause.id : cause;
        this._time += 1;
        return new Atom<T>(new AtomId(this._site, this._time, priority), causeId, op);
    }
}