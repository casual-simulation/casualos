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

/**
 * Defines a possible result from manipulating the weave.
 */
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

    /**
     * Iterates all of the atoms in the weave.
     */
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

            const existing = this.getNode(atom.id);
            if (existing) {
                return this._resolveConflict(existing, atom, null);
            }

            // Atom is a root
            this._addRoot(atom);

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
            return this._resolveConflict(existing, atom, causeNode);
        }

        this._insertUnder(causeNode, atom);

        return {
            type: 'atom_added',
            atom: atom,
        };
    }

    private _addRoot(atom: Atom<T>) {
        const node: WeaveNode<T> = _createNode(atom, null, null);
        this._roots.push(node);
        this._addNodeToIdMap(node);
    }

    /**
     * Gets the node reference to the given atom.
     */
    getNode(atomId: AtomId): WeaveNode<T> {
        const id = atomIdToString(atomId);
        const node = this._idMap.get(id);
        return node;
    }

    /**
     * Calculates the chain of references from the root directly to the given reference.
     * Returns the chain from the given reference to the rootmost reference.
     * @param weave The weave that the reference is from.
     * @param ref The reference.
     */
    referenceChain(ref: AtomId): WeaveNode<T>[] {
        let node = this.getNode(ref);

        if (!node) {
            return [];
        }

        let chain = [node];

        let cause = node.atom.cause;
        while (cause) {
            const causeRef = this.getNode(cause);

            if (!causeRef) {
                throw new Error(
                    `[Weave] Could not find cause for atom ${atomIdToString(
                        cause
                    )}`
                );
            }

            chain.push(causeRef);
            cause = causeRef.atom.cause;
        }

        return chain;
    }

    /**
     * Removes the given atom and all of its children from the weave.
     * Returns a reference to a linked list that contains all of the removed atoms.
     * @param atom The atom that should be removed.
     */
    remove(atom: Atom<T>): WeaveNode<T> {
        if (!atom) {
            return null;
        }
        const node = this.getNode(atom.id);
        if (!node) {
            return null;
        }

        return this._remove(node);
    }

    /**
     * Removes the siblings of the given atom which occurred before it.
     * Returns a reference to a linked list that contains all of the removed atoms.
     * @param atom The atom whose siblings should be removed.
     */
    removeSiblingsBefore(atom: Atom<T>) {
        if (!atom) {
            return null;
        }
        const node = this.getNode(atom.id);
        if (!node) {
            return null;
        }

        const firstSibling = first(iterateSiblings(node));
        if (!firstSibling) {
            return null;
        }

        const lastSibling = last(iterateSiblings(node)) || firstSibling;
        const lastChild = lastInCausalGroup(lastSibling);
        return this._removeSpan(firstSibling, lastChild);
    }

    private _resolveConflict(
        existing: WeaveNode<T>,
        atom: Atom<T>,
        causeNode: WeaveNode<T>
    ): WeaveResult {
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

                if (causeNode) {
                    this._insertUnder(causeNode, atom);
                } else {
                    this._addRoot(atom);
                }

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
        const node: WeaveNode<T> = _createNode(atom, pos, prev);
        if (prev) {
            prev.next = node;
        }
        pos.prev = node;
        this._addNodeToIdMap(node);
        return node;
    }

    private _insertAfter(pos: WeaveNode<T>, atom: Atom<T>) {
        const next = pos.next;
        const node: WeaveNode<T> = _createNode(atom, next, pos);
        if (next) {
            next.prev = node;
        }
        pos.next = node;
        this._addNodeToIdMap(node);
        return node;
    }

    private _remove(node: WeaveNode<T>) {
        const last = lastInCausalGroup(node);
        return this._removeSpan(node, last);
    }

    private _removeSpan(start: WeaveNode<T>, end: WeaveNode<T>): WeaveNode<T> {
        const next = end.next;
        const prev = start.prev;
        if (next) {
            next.prev = prev;
        }
        if (prev) {
            prev.next = next;
        }
        start.prev = null;
        end.next = null;
        this._removeListFromMap(start);
        if (!start.atom.cause) {
            const index = this._roots.indexOf(start);
            if (index >= 0) {
                this._roots.splice(index, 1);
            }
        }
        return start;
    }

    private _addNodeToIdMap(node: WeaveNode<T>) {
        this._idMap.set(atomIdToString(node.atom.id), node);
    }

    private _removeListFromMap(node: WeaveNode<T>) {
        this._removeNodeIdFromMap(node);
        for (let n of iterateFrom(node)) {
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
    return last(iterateCausalGroup(start)) || start;
}

/**
 * Gets the last sibling of the given node.
 * @param start The node to start from.
 */
export function lastSibling<T>(start: WeaveNode<T>) {
    return last(iterateSiblings(start)) || start;
}

/**
 * Gets the first value from the given iterator.
 * returns undefined if the iterator contains no values.
 * @param iterator The iterator.
 */
export function first<T>(iterator: IterableIterator<T>) {
    for (let node of iterator) {
        return node;
    }
    return undefined;
}

/**
 * Gets the last value from the given iterator.
 * Returns undefined if the iterator contains no values.
 * @param iterator The iterator.
 */
export function last<T>(iterator: IterableIterator<T>) {
    let last: T = undefined;
    for (let node of iterator) {
        last = node;
    }
    return last;
}

/**
 * Iterates all of sibling nodes that occur after the given node.
 * @param start The start node.
 */
export function* iterateSiblings<T>(start: WeaveNode<T>) {
    for (let node of iterateFrom(start.next)) {
        if (idEquals(node.atom.cause, start.atom.cause)) {
            yield node;
        }
        if (node.atom.cause.timestamp < start.atom.cause.timestamp) {
            break;
        }
    }
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

function _createNode<T>(
    atom: Atom<T>,
    next: WeaveNode<T>,
    prev: WeaveNode<T>
): WeaveNode<T> {
    return {
        atom: atom,
        next: next,
        prev: prev,
    };
}
