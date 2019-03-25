import { getHashBuffer } from "./Hash";

/**
 * Defines an interface for normal JS objects that represent Atom IDs.
 */
export interface StorableAtomId {
    site: number;
    timestamp: number;
    priority: number;
}

/**
 * Defines an ID for an atom.
 * 
 * 16 bytes per ID. (each number is 8 bytes)
 */
export interface AtomId {
    /**
     * The ID of the originator of this atom.
     */
    site: number;

    /**
     * The lamport timestamp of this atom.
     */
    timestamp: number;

    /**
     * The priority of this atom.
     * If specified, causes this atom to sort to the beginning
     * on a chain of atoms that share the same cause.
     */
    priority: number;
}

/**
 * Determines if the two given IDs equal each other.
 * @param first 
 * @param second 
 */
export function idEquals(first: AtomId, second: AtomId) {
    return first === second || 
        (first && second &&
            second.site === first.site &&
            second.timestamp === first.timestamp &&
            second.priority === first.priority);
}

/**
 * Creates a new Atom ID.
 * @param site 
 * @param timestamp 
 * @param priority 
 */
export function atomId(site: number, timestamp: number, priority: number = 0): AtomId {
    return {
        site, 
        timestamp,
        priority
    };
}

/**
 * Defines an interface for an atom operation.
 */
export interface AtomOp {
    type: number;
}

/**
 * Defines an atom.
 * That is, an object that represents a unique operation paired with a unique cause.
 * The cause is effectively the parent of this atom because without it the atom logically could not exist.
 * 
 * 32 bytes + value size per atom.
 */
export interface Atom<T extends AtomOp> {
    /**
     * The ID of this atom.
     */
    id: AtomId;

    /**
     * The ID of this atom's parent.
     */
    cause: AtomId;

    /**
     * The operation that the atom contains.
     */
    value: T;

    /**
     * The checksum for this atom.
     * Used to verify that a atom is valid.
     */
    checksum: number;
}

/**
 * Defines an interface that represents an atom that has been archived.
 */
export interface ArchivedAtom {
    /**
     * The key that relates this atom to a particular tree/weave.
     */
    key: string;

    /**
     * The atom that was archived.
     */
    atom: Atom<any>;
}

/**
 * Creates a new atom.
 * @param id 
 * @param cause 
 * @param value 
 */
export function atom<T extends AtomOp>(id: AtomId, cause: AtomId, value: T): Atom<T> {
    const hash = getHashBuffer([id, cause, value]);
    return {
        id,
        cause,
        value,
        
        // Read only 32 bits of the hash.
        // This should be good enough to prevent collisions for weaves 
        // of up to ~2 billion atoms instead of never.
        checksum: hash.readUInt32BE(0)
    };
}

/**
 * Verifies that the given atom matches its own checksum.
 * @param atom The atom to check.
 */
export function atomMatchesChecksum<T extends AtomOp>(atom: Atom<T>) {
    const hash = getHashBuffer([atom.id, atom.cause, atom.value]);
    const checksum = hash.readUInt32BE(0);
    return checksum === atom.checksum;
}

/**
 * Converts the given atom ID into a string that is suitable for
 * storage.
 * @param id The ID.
 */
export function atomIdToString(id: AtomId): string {
    return `${id.site}@${id.timestamp}:${id.priority}`;
}