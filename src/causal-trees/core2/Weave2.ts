import {
    Atom,
    AtomId,
    atomMatchesHash,
    atomIdToString,
    idEquals,
    RejectedAtom,
    RejectionReason,
} from './Atom2';
import { keys } from 'lodash';

export type WeaveResult = AtomAddedResult;

/**
 * Defines an interface that indicates the given atom was added to the weave.
 */
export interface AtomAddedResult {
    type: 'atom_added';
    atom: Atom<any>;
}

/**
 * Defines an interface that indicates the given atom's hash does not match its contents.
 */
export interface HashFailedResult {
    type: 'hash_failed';
    atom: Atom<any>;
}

/**
 * Defines a node for a doubly linked list of atoms.
 */
export interface WeaveNode<T> {
    /**
     * The atom for the node.
     */
    atom: Atom<T>;

    /**
     * The next node.
     */
    next: WeaveNode<T>;
}

/**
 * Defines a weave.
 * That is, the depth-first preorder traversal of a causal tree.
 */
export class Weave<T> {
    private _root: WeaveNode<T>;

    iterate() {
        const _this = this;
        function* iterator() {
            let current = _this._root;
            while (current) {
                yield current.atom;
                current = current.next;
            }
        }

        return iterator();
    }

    getAtoms(): Atom<T>[] {
        return [...this.iterate()];
    }

    /**
     * Creates a new weave.
     */
    constructor() {}

    /**
     * Inserts the given atom into the weave and returns it.
     * @param atom The atom.
     */
    insert(atom: Atom<T>): WeaveResult {
        return null;
    }
}
