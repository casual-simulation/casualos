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

export type WeaveResult =
    | AtomAddedResult
    | CauseNotFoundResult
    | HashFailedResult
    | InvalidTimestampResult
    | AtomConflictResult;

/**
 * Defines an interface that indicates the given atom was added to the weave.
 */
export interface AtomAddedResult {
    type: 'atom_added';
    atom: Atom<any>;
}

/**
 * Defines an interface that indicates the given atom's cause was missing from the tree.
 */
export interface CauseNotFoundResult {
    type: 'cause_not_found';
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
 * Defines an interface that indicates the given atom's timestamp is invalid.
 * This usually means that the timestamp is before it's cause's timestamp.
 */
export interface InvalidTimestampResult {
    type: 'invalid_timestamp';
    atom: Atom<any>;
}

/**
 * Defines an interface that indicates that the given atom conflicted with an atom that was already in the weave.
 */
export interface AtomConflictResult {
    type: 'conflict';

    /**
     * The atom that was kept/added to the weave.
     */
    winner: Atom<any>;

    /**
     * The atom that removed/excluded from the weave.
     */
    loser: Atom<any>;
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

    /**
     * The previous node.
     */
    prev: WeaveNode<T>;
}

/**
 * Defines a weave.
 * That is, the depth-first preorder traversal of a causal tree.
 */
export class Weave<T> {
    private _roots: WeaveNode<T>[];
    private _idMap: Map<string, WeaveNode<T>>;

    iterateFrom = function*(start: WeaveNode<T>) {
        let current = start;
        while (current) {
            yield current.atom;
            current = current.next;
        }
    };

    iterate() {
        const _this = this;
        function* iterator() {
            for (let root of _this._roots) {
                yield* _this.iterateFrom(root);
            }
        }

        return iterator();
    }

    /**
     * Gets the full list of atoms from the weave.
     */
    getAtoms(): Atom<T>[] {
        return [...this.iterate()];
    }

    /**
     * Creates a new weave.
     */
    constructor() {
        this._roots = [];
        this._idMap = new Map();
    }

    /**
     * Inserts the given atom into the weave and returns it.
     * @param atom The atom.
     */
    insert(atom: Atom<T>): WeaveResult {
        if (!atom.cause) {
            // Check hash
            if (!atomMatchesHash(atom, null)) {
                return {
                    type: 'hash_failed',
                    atom: atom,
                };
            }

            // Atom is a root
            const node: WeaveNode<T> = {
                atom: atom,
                next: null,
                prev: null,
            };

            this._roots.push(node);
            this._addNodeToIdMap(node);

            return {
                type: 'atom_added',
                atom: atom,
            };
        }

        const causeNode = this.getNode(atom.cause);
        if (!causeNode) {
            return {
                type: 'cause_not_found',
                atom: atom,
            };
        }

        const cause = causeNode.atom;
        if (!atomMatchesHash(atom, cause)) {
            return {
                type: 'hash_failed',
                atom: atom,
            };
        }

        if (atom.id.timestamp <= cause.id.timestamp) {
            return {
                type: 'invalid_timestamp',
                atom: atom,
            };
        }

        const existing = this.getNode(atom.id);
        if (existing) {
            if (existing.atom.hash !== atom.hash) {
                if (existing.atom.hash < atom.hash) {
                    // No changes needed
                    return {
                        type: 'conflict',
                        winner: existing.atom,
                        loser: atom,
                    };
                } else {
                    // Replace the existing atom with the new one.
                    this._remove(existing);
                    this._insertAfter(causeNode, atom);

                    return {
                        type: 'conflict',
                        winner: atom,
                        loser: existing.atom,
                    };
                }
            }
            return {
                type: 'atom_added',
                atom: existing.atom,
            };
        }

        this._insertAfter(causeNode, atom);

        return {
            type: 'atom_added',
            atom: atom,
        };
    }

    getNode(atomId: AtomId): WeaveNode<T> {
        const id = atomIdToString(atomId);
        const node = this._idMap.get(id);
        return node;
    }

    private _insertAfter(pos: WeaveNode<T>, atom: Atom<T>) {
        const next = pos.next;
        const node: WeaveNode<T> = {
            atom: atom,
            next: next,
            prev: pos,
        };
        if (next) {
            next.prev = node;
        }
        pos.next = node;
        this._addNodeToIdMap(node);
        return node;
    }

    private _remove(node: WeaveNode<T>) {
        const next = node.next;
        const prev = node.prev;
        if (next) {
            next.prev = prev;
        }
        if (prev) {
            prev.next = next;
        }
        this._removeNodeIdFromMap(node);
    }

    private _addNodeToIdMap(node: WeaveNode<T>) {
        this._idMap.set(atomIdToString(node.atom.id), node);
    }

    private _removeNodeIdFromMap(node: WeaveNode<T>) {
        this._idMap.delete(atomIdToString(node.atom.id));
    }
}
