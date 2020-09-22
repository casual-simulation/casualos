import {
    Atom,
    AtomId,
    atomMatchesHash,
    atomIdToString,
    idEquals,
    RejectedAtom,
    RejectionReason,
} from './Atom2';
import { createIndex, AtomIndex } from './AtomIndex';

/**
 * Defines a possible result from manipulating the weave.
 */
export type WeaveResult =
    | AtomAddedResult
    | AlreadyAddedResult
    | AtomRemovedResult
    | CauseNotFoundResult
    | HashFailedResult
    | InvalidTimestampResult
    | AtomConflictResult
    | InvalidArgumentResult
    | AtomNotFoundResult
    | InvalidCardinalityResult
    | CardinalityViolatedResult
    | NothingResult;

/**
 * Defines an interface that indicates the given atom was removed from the weave.
 */
export interface AtomRemovedResult {
    type: 'atom_removed';
    ref: WeaveNode<any>;
}

/**
 * Defines an interface that indicates the given atom was added to the weave.
 */
export interface AtomAddedResult {
    type: 'atom_added';
    atom: Atom<any>;
}

/**
 * Defines an interface that indicates the given atom has already been added to the weave.
 */
export interface AlreadyAddedResult {
    type: 'atom_already_added';
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

    /**
     * The weave reference of the looser.
     * Null if the loser was not in the weave.
     */
    loserRef: WeaveNode<any>;
}

/**
 * Defines an interface that indicates that one of the given arguments was invalid.
 */
export interface InvalidArgumentResult {
    type: 'invalid_argument';
}

/**
 * Defines an interface that indicates that the given atom was not found.
 */
export interface AtomNotFoundResult {
    type: 'atom_not_found';
    atom: Atom<any>;
}

/**
 * Defines an interface that indicates that the cardinality of the atom was invalid.
 */
export interface InvalidCardinalityResult {
    type: 'invalid_cardinality';

    /**
     * The atom that was rejected.
     */
    atom: Atom<any>;
}

/**
 * Defines an interface that indicates that the given atom violated the cardinality restraints of another atom that was already in the weave.
 */
export interface CardinalityViolatedResult {
    type: 'cardinality_violated';

    /**
     * The atom that was rejected.
     */
    atom: Atom<any>;
}

/**
 * Defines an interface that indicates that nothing happened.
 */
export interface NothingResult {
    type: 'nothing_happened';
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

interface CardinalityStats {
    current: number;
    max: number;
}

/**
 * Defines a weave.
 * That is, the depth-first preorder traversal of a causal tree.
 *
 * Weaves preserve the causality and order of a causal tree.
 * This means storing the list of atoms that are in the tree and preserving the integrity of the tree.
 */
export class Weave<T> {
    private _roots: WeaveNode<T>[];
    private _cardinality: Map<string, CardinalityStats>;
    private _idMap: Map<string, WeaveNode<T>>;
    private _hashMap: Map<string, WeaveNode<T>>;

    /**
     * Gets the root nodes used by this weave.
     */
    get roots() {
        return this._roots;
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
        this._hashMap = new Map();
        this._cardinality = new Map();
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

            // Check cardinality
            if (
                (typeof atom.id.cardinality !== 'object' &&
                    typeof atom.id.cardinality !== 'undefined') ||
                (typeof atom.id.cardinality === 'object' &&
                    (typeof atom.id.cardinality.number !== 'number' ||
                        typeof atom.id.cardinality.group !== 'string' ||
                        atom.id.cardinality.number <= 0))
            ) {
                return {
                    type: 'invalid_cardinality',
                    atom: atom,
                };
            }

            const existing = this.getNode(atom.id);
            if (existing) {
                return this._resolveConflict(existing, atom, null);
            }

            // Check against current cardinality
            if (atom.id.cardinality) {
                let cardinality = this._cardinality.get(
                    atom.id.cardinality.group
                );
                if (cardinality && cardinality.current >= cardinality.max) {
                    return {
                        type: 'cardinality_violated',
                        atom: atom,
                    };
                }
                if (!cardinality) {
                    cardinality = {
                        current: 0,
                        max: atom.id.cardinality.number,
                    };
                }
                cardinality = {
                    current: cardinality.current + 1,
                    max: Math.min(cardinality.max, atom.id.cardinality.number),
                };
                // Update cardinality
                this._cardinality.set(atom.id.cardinality.group, cardinality);
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
        this._addNodeToMaps(node);
    }

    /**
     * Gets the node reference to the given atom.
     * @param atomId The ID of the atom.
     */
    getNode(atomId: AtomId | string): WeaveNode<T> {
        if (atomId === null) {
            return null;
        }
        const id = typeof atomId === 'string' ? atomId : atomIdToString(atomId);
        const node = this._idMap.get(id);
        return node;
    }

    /**
     * Gets the node reference to the given atom by hash.
     * @param hash The hash of the atom to get.
     */
    getNodeByHash(hash: string): WeaveNode<T> {
        if (hash === null) {
            return null;
        }
        const node = this._hashMap.get(hash);
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
    remove(atom: Atom<T>): WeaveResult {
        if (!atom) {
            return {
                type: 'invalid_argument',
            };
        }
        const node = this.getNode(atom.id);
        if (!node) {
            return {
                type: 'atom_not_found',
                atom: atom,
            };
        }

        const removed = this._remove(node);

        return {
            type: 'atom_removed',
            ref: removed,
        };
    }

    /**
     * Removes the siblings of the given atom which occurred before it.
     * Returns a reference to a linked list that contains all of the removed atoms.
     * @param atom The atom whose siblings should be removed.
     */
    removeSiblingsBefore(atom: Atom<T>): WeaveResult {
        if (!atom) {
            return {
                type: 'invalid_argument',
            };
        }
        const node = this.getNode(atom.id);
        if (!node) {
            return {
                type: 'atom_not_found',
                atom: atom,
            };
        }

        const firstSibling = first(iterateSiblings(node));
        if (!firstSibling) {
            return {
                type: 'nothing_happened',
            };
        }

        const lastSibling = last(iterateSiblings(node)) || firstSibling;
        const lastChild = lastInCausalGroup(lastSibling);
        const removed = this._removeSpan(firstSibling, lastChild);

        return {
            type: 'atom_removed',
            ref: removed,
        };
    }

    /**
     * Calculates the index for this weave.
     */
    calculateIndex(): AtomIndex {
        return createIndex(this.getAtoms());
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
                    loserRef: existing,
                };

                return conflict;
            }
        }
        return {
            type: 'atom_already_added',
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
        this._addNodeToMaps(node);
        return node;
    }

    private _insertAfter(pos: WeaveNode<T>, atom: Atom<T>) {
        const next = pos.next;
        const node: WeaveNode<T> = _createNode(atom, next, pos);
        if (next) {
            next.prev = node;
        }
        pos.next = node;
        this._addNodeToMaps(node);
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
        this._removeListFromMaps(start);
        if (!start.atom.cause) {
            const index = this._roots.indexOf(start);
            if (index >= 0) {
                this._roots.splice(index, 1);
            }
        }
        return start;
    }

    private _addNodeToMaps(node: WeaveNode<T>) {
        this._idMap.set(atomIdToString(node.atom.id), node);
        this._hashMap.set(node.atom.hash, node);
    }

    private _removeListFromMaps(node: WeaveNode<T>) {
        this._removeNodeIdFromMaps(node);
        for (let n of iterateFrom(node)) {
            this._removeNodeIdFromMaps(n);
        }
    }

    private _removeNodeIdFromMaps(node: WeaveNode<T>) {
        this._idMap.delete(atomIdToString(node.atom.id));
        this._hashMap.delete(node.atom.hash);
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
 * Gets the item at the given index in the iterator.
 * @param iterator The iterator.
 * @param item The index of the item to get.
 */
export function nth<T>(iterator: IterableIterator<T>, item: number) {
    let count = 0;
    for (let node of iterator) {
        if (count === item) {
            return node;
        }
        count += 1;
    }

    return null;
}

/**
 * Iterates all of the children of the given node.
 * @param parent The node.
 */
export function* iterateChildren<T>(parent: WeaveNode<T>) {
    const firstChild = first(iterateCausalGroup(parent));
    if (firstChild) {
        yield firstChild;
        yield* iterateSiblings(firstChild);
    }
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
        if (
            node.atom.cause !== null &&
            start.atom.cause !== null &&
            node.atom.cause.timestamp < start.atom.cause.timestamp
        ) {
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
 * Calculates the atom that was added to the tree from the given result.
 * Returns null if no atom was added.
 * @param result The weave result.
 */
export function addedAtom(result: WeaveResult): Atom<any> {
    if (result.type === 'atom_added') {
        return result.atom;
    } else if (result.type === 'conflict') {
        return result.winner;
    }
    return null;
}

/**
 * Calculates the atoms that were removed from the tree with the given result.
 * @param result The result.
 */
export function weaveRemovedAtoms(result: WeaveResult): Atom<any>[] {
    let atoms = [] as Atom<any>[];
    if (result.type === 'conflict') {
        for (let node of iterateFrom(result.loserRef)) {
            atoms.push(node.atom);
        }
    } else if (result.type === 'atom_removed') {
        for (let node of iterateFrom(result.ref)) {
            atoms.push(node.atom);
        }
    }

    return atoms;
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
