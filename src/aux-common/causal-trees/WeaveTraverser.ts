import { AtomOp, AtomId, idEquals, Atom } from './Atom';
import { Weave } from './Weave';

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
    peek(parent?: AtomId): Atom<TOp> {
        if (this._index < this._weave.atoms.length) {
            const atom = this._weave.atoms[this._index];
            if (!parent) {
                return atom;
            }
            if (idEquals(parent, atom.cause)) {
                return atom;
            }
        }
        return null;
    }

    /**
     * Consumes and returns the next atom in the tree.
     */
    next(): Atom<TOp> {
        const atom = this._weave.atoms[this._index];
        this._index += 1;
        return atom;
    }

    /**
     * Gets the current atom.
     */
    current(): Atom<TOp> {
        return this._weave.atoms[this._index];
    }

    /**
     * Skips atoms until the next atom is a sibling of the given parent.
     * @param parent The parent to skip out of.
     */
    skip(parent: AtomId) {
        const current = this.current();
        if (current && idEquals(parent, current.id)) {
            const size = this._weave.getAtomSize(parent);
            this._index += size;
        } else {
            while (this.peek(parent)) {
                const atom = this.next();
                const nextRef = this.peek();
                if (nextRef && idEquals(atom.id, nextRef.cause)) {
                    this.skip(atom.id);
                }
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
