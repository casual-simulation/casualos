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
 * Info about the conflict.
 */
export interface ConflictInfo<T> {
    /**
     * The conflict.
     */
    conflict: AtomConflictResult;

    /**
     * A reference to the weave nodes that were removed from the weave.
     */
    loserRef: WeaveNode<T>;
}

/**
 * Defines a weave.
 * That is, the depth-first preorder traversal of a causal tree.
 */
export class Weave<T> {
    private _roots: WeaveNode<T>[];
    private _idMap: Map<string, WeaveNode<T>>;
    private _lastConflict: ConflictInfo<T>;

    /**
     * Gets the root nodes used by this weave.
     */
    get roots() {
        return this._roots;
    }

    /**
     * Gets the info for the given conflict.
     * If null, then the info has been disposed.
     * @param conflict The conflict to lookup.
     */
    getConflictInfo(conflict: AtomConflictResult): ConflictInfo<T> {
        if (this._lastConflict && this._lastConflict.conflict === conflict) {
            return this._lastConflict;
        }
        return null;
    }

    iterateAtoms() {
        const _this = this;
        function* iterator() {
            for (let root of _this._roots) {
                for (let node of iterateFrom(root)) {
                    yield node.atom;
                }
            }
        }

        return iterator();
    }

    /**
     * Gets the full list of atoms from the weave.
     */
    getAtoms(): Atom<T>[] {
        return [...this.iterateAtoms()];
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
                    const conflict: AtomConflictResult = {
                        type: 'conflict',
                        winner: existing.atom,
                        loser: atom,
                    };

                    this._lastConflict = {
                        conflict: conflict,
                        loserRef: null,
                    };

                    return conflict;
                } else {
                    // Replace the existing atom with the new one.
                    this._remove(existing);
                    this._insertUnder(causeNode, atom);

                    const conflict: AtomConflictResult = {
                        type: 'conflict',
                        winner: atom,
                        loser: existing.atom,
                    };
                    this._lastConflict = {
                        conflict: conflict,
                        loserRef: existing,
                    };

                    return conflict;
                }
            }
            return {
                type: 'atom_added',
                atom: existing.atom,
            };
        }

        this._insertUnder(causeNode, atom);

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

    /**
     * Inserts the given atom under the given cause atom.
     * @param cause The cause.
     * @param atom The atom.
     */
    private _insertUnder(cause: WeaveNode<T>, atom: Atom<T>) {
        let last: WeaveNode<T>;
        for (let node of iterateCausalGroup(cause)) {
            if (idEquals(node.atom.cause, cause.atom.id)) {
                if (_compareAtomIds(atom.id, node.atom.id) < 0) {
                    return this._insertBefore(node, atom);
                }
            }
            last = node;
        }

        if (last) {
            return this._insertAfter(last, atom);
        } else {
            return this._insertAfter(cause, atom);
        }
    }

    private _insertBefore(pos: WeaveNode<T>, atom: Atom<T>) {
        const prev = pos.prev;
        const node: WeaveNode<T> = {
            atom: atom,
            next: pos,
            prev: prev,
        };
        if (prev) {
            prev.next = node;
        }
        pos.prev = node;
        this._addNodeToIdMap(node);
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
        const last = lastInCausalGroup(node);
        const next = last.next;
        const prev = node.prev;
        if (next) {
            next.prev = prev;
        }
        if (prev) {
            prev.next = next;
        }
        node.prev = null;
        last.next = null;
        this._removeNodeFromMap(node);
    }

    private _addNodeToIdMap(node: WeaveNode<T>) {
        this._idMap.set(atomIdToString(node.atom.id), node);
    }

    private _removeNodeFromMap(node: WeaveNode<T>) {
        this._removeNodeIdFromMap(node);
        for (let n of iterateCausalGroup(node)) {
            this._removeNodeIdFromMap(n);
        }
    }

    private _removeNodeIdFromMap(node: WeaveNode<T>) {
        this._idMap.delete(atomIdToString(node.atom.id));
    }
}

/**
 * Gets the last node in the given node's causal group.
 * @param start The node to start from.
 */
export function lastInCausalGroup<T>(start: WeaveNode<T>) {
    let last: WeaveNode<T>;
    for (let node of iterateCausalGroup(start)) {
        last = node;
    }
    return last || start;
}

/**
 * Iterates all of the nodes in the given node's causal group.
 * @param start The node to start from.
 */
export function* iterateCausalGroup<T>(start: WeaveNode<T>) {
    for (let node of iterateFrom(start.next)) {
        if (node.atom.id.timestamp <= start.atom.id.timestamp) {
            break;
        }
        yield node;
    }
}

/**
 * Iterates all of the nodes to the end of the linked list.
 * @param start The node to start from.
 */
export function* iterateFrom<T>(start: WeaveNode<T>) {
    let current = start;
    while (current) {
        yield current;
        current = current.next;
    }
}

/**
 * Determines if the first atom ID should sort before, at, or after the second atom ID.
 * Returns -1 if the first should be before the second.
 * Returns 0 if the IDs are equal.
 * Returns 1 if the first should be after the second.
 * @param first The first atom ID.
 * @param second The second atom ID.
 */
function _compareAtomIds(first: AtomId, second: AtomId) {
    if (!first && second) {
        return -1;
    } else if (!second && first) {
        return 1;
    } else if (first === second) {
        return 0;
    }
    const firstPriority = _getPriority(first);
    const secondPriority = _getPriority(second);
    if (firstPriority > secondPriority) {
        return -1;
    } else if (firstPriority < secondPriority) {
        return 1;
    } else if (firstPriority === secondPriority) {
        if (first.timestamp > second.timestamp) {
            return -1;
        } else if (first.timestamp < second.timestamp) {
            return 1;
        } else if (first.timestamp === second.timestamp) {
            if (first.site < second.site) {
                return -1;
            } else if (first.site > second.site) {
                return 1;
            }
        }
    }
    return 0;
}

function _getPriority(id: AtomId) {
    return id.priority || 0;
}
