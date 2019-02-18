import { AtomOp, AtomId, idEquals } from "./Atom";
import { Weave, WeaveReference } from "./Weave";

/**
 * Defines a class that helps with traversing weaves.
 */
export class WeaveTraverser<TOp extends AtomOp> {

    private _weave: Weave<TOp>;
    private _index: number;

    constructor(weave: Weave<TOp>) {
        this._weave = weave;
        this._index = 0;
    }

    /**
     * Gets a reference to the next atom in the tree.
     * Returns null if we're at the end.
     * @param parent The ID of the parent that the next atom should match.
     */
    peek(parent?: AtomId): WeaveReference<TOp> {
        if (this._index < this._weave.atoms.length) {
            const atom = this._weave.atoms[this._index];
            if (parent) {
                if (idEquals(parent, atom.atom.cause)) {
                    return atom;
                } else {
                    return null;
                }
            } else {
                return atom;
            }
        } else {
            return null;
        }
    }

    /**
     * Consumes and returns the next atom in the tree.
     */
    next(): WeaveReference<TOp> {
        const atom = this._weave.atoms[this._index];
        this._index += 1;
        return atom;
    }

    /**
     * Skips atoms until the next atom is a sibling of the given parent.
     * @param parent The parent to skip out of.
     */
    skip(parent: AtomId) {
        while (this.peek(parent)) {
            const ref = this.next();
            const nextRef = this.peek();
            if (nextRef && idEquals(ref.atom.id, nextRef.atom.cause)) {
                this.skip(ref.atom.id);
            }
        }
    }

    /**
     * Copies this traverser.
     */
    fork() {
        const copy = new WeaveTraverser(this._weave);
        copy._index = this._index;
        return copy;
    }
}