import { getHash } from '@casual-simulation/crypto';

/**
 * Defines the type for Atom Site IDs.
 */
export type AtomSiteId = string;

/**
 * Defines an interface that specifies the cardinality of an atom.
 */
export interface AtomCardinality {
    /**
     * The cardinality group.
     * Atoms with the same cardinality group affect each other.
     */
    group: string;

    /**
     * The maximum number of atoms allowed to be in the cardinality group.
     */
    number: number;
}

/**
 * Defines an interface for an Atom ID.
 *
 * An Atom ID is a unique reference to a position in a causal group.
 * A causal group is the set of atoms childed under a parent atom.
 *
 * As a result, a unique reference to a position in a tree is the
 * parent ID + the atom ID. This process is recursive until the root atom is met.
 */
export interface AtomId {
    /**
     * The ID of the site that created the atom.
     */
    site: AtomSiteId;

    /**
     * The timestamp that the Atom was created at.
     */
    timestamp: number;

    /**
     * The priority override for the Atom.
     * Defaults to 0.
     */
    priority?: number;

    /**
     * The cardinality of the atom.
     * For root atoms, setting this enables cardinality enforcement on all atoms with the
     * same cardinality group.
     */
    cardinality?: AtomCardinality;
}

/**
 * Defines an interface for an Atom.
 * That is, a uniquely identifiable and immutable event in a causal tree.
 */
export interface Atom<T> {
    /**
     * The ID of the atom.
     */
    id: AtomId;

    /**
     * The ID of the cause of the atom.
     */
    cause: AtomId;

    /**
     * The value that the atom contains.
     */
    value: T;

    /**
     * The hash for this atom.
     *
     * The hash is calculated from the following parts:
     * - The Atom ID.
     * - The value.
     * - The cause's hash.
     */
    hash: string;
}

/**
 * The possible reasons for rejecting an atom.
 */
export type RejectionReason =
    | CauseNotFound
    | SecondRootNotAllowed
    | AtomIdAlreadyExists
    | HashFailed;

/**
 * Defines that the atom was not added to the weave
 * because its cause could not be found.
 */
export type CauseNotFound = 'cause_not_found';

/**
 * Defines that the atom was rejected because it is a root atom
 * and there was already a root.
 */
export type SecondRootNotAllowed = 'second_root_not_allowed';

/**
 * Defines that the atom was rejected because another atom with the same ID
 * and different checksum already exists in the weave.
 */
export type AtomIdAlreadyExists = 'atom_id_already_exists';

/**
 * Defines that the atom was rejected because its hash failed to match its contents.
 */
export type HashFailed = 'hash_failed';

/**
 * Defines that the atom was rejected because the specified cardinality was not a positive non-zero number.
 */
export type InvalidCardinality = 'invalid_cardinality';

/**
 * Defines an interface for an atom that was rejected.
 */
export interface RejectedAtom<T> {
    /**
     * The atom that was rejected.
     */
    atom: Atom<T>;

    /**
     * The reason why the atom was rejected.
     */
    reason: RejectionReason;
}

/**
 * Creates a new Atom ID.
 * @param site The ID of the site.
 * @param timestamp The time that the atom was created at.
 * @param priority The priority of the atom.
 */
export function atomId(
    site: string,
    timestamp: number,
    priority?: number,
    cardinality?: AtomCardinality
): AtomId {
    let id = {
        site,
        timestamp,
    } as AtomId;
    if (typeof priority === 'number') {
        id.priority = priority;
    }
    if (typeof cardinality === 'object') {
        id.cardinality = cardinality;
    }
    return id;
}

/**
 * Creates a new Atom.
 * @param id The ID of the atom.
 * @param cause The parent of this atom.
 * @param value The value of the atom.
 */
export function atom<T>(id: AtomId, cause: Atom<any>, value: T): Atom<T> {
    return {
        id: id,
        cause: cause ? cause.id : null,
        value: value,
        hash: atomHash(id, cause ? cause.hash : null, value),
    };
}

/**
 * Calculates the hash for an atom.
 * @param id The ID of the atom.
 * @param causeHash The hash of the cause of the atom.
 * @param value The value of the atom.
 */
export function atomHash<T>(
    id: AtomId,
    causeHash: string | null,
    value: T
): string {
    if (id.cardinality) {
        return getHash([
            causeHash || null,
            id.site,
            id.timestamp,
            id.priority,
            id.cardinality,
            value,
        ]);
    } else {
        return getHash([
            causeHash || null,
            id.site,
            id.timestamp,
            id.priority,
            value,
        ]);
    }
}

/**
 * Determines if the atom matches its own hash.
 * Use this to detect if some value became corrupted.
 * @param atom The atom to check.
 */
export function atomMatchesHash(atom: Atom<any>, cause: Atom<any>): boolean {
    return (
        atomHash(atom.id, cause ? cause.hash : null, atom.value) === atom.hash
    );
}

/**
 * Converts the given atom ID into a string that is suitable for
 * storage.
 * @param id The ID.
 */
export function atomIdToString(id: AtomId): string {
    let str = `${id.site}@${id.timestamp}`;
    if (id.priority) {
        str += `:${id.priority}`;
    }
    if (id.cardinality) {
        str += `-${id.cardinality.group}^${id.cardinality.number}`;
    }
    return str;
}

/**
 * Determines if the two given IDs equal each other.
 * @param first
 * @param second
 */
export function idEquals(first: AtomId, second: AtomId) {
    return (
        first === second ||
        (first &&
            second &&
            second.site === first.site &&
            second.timestamp === first.timestamp &&
            (second.priority === first.priority ||
                (second.priority === null &&
                    typeof first.priority === 'undefined') ||
                (typeof second.priority === 'undefined' &&
                    first.priority === null)) &&
            (second.cardinality === first.cardinality ||
                ((second.cardinality === null &&
                    typeof first.cardinality === 'undefined') ||
                    (typeof second.cardinality === 'undefined' &&
                        first.cardinality === null) ||
                    (!!second.cardinality &&
                        !!first.cardinality &&
                        second.cardinality.group === first.cardinality.group &&
                        second.cardinality.number ===
                            first.cardinality.number))))
    );
}

/**
 * Determines if the given value is an atom.
 * @param value The value to check.
 */
export function isAtom(value: unknown): value is Atom<any> {
    return (
        typeof value === 'object' &&
        'id' in value &&
        'cause' in value &&
        'value' in value &&
        'hash' in value
    );
}
