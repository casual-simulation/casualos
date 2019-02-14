/**
 * Defines an ID for an atom.
 * 
 * 16 bytes per ID. (each number is 8 bytes)
 */
export class AtomId {

    /**
     * The ID of the originator of this atom.
     */
    site: number;

    /**
     * The lamport timestamp of this atom.
     */
    timestamp: number;

    /**
     * Creates a new Atom ID.
     * @param site The ID of the site for this ID.
     * @param timestamp The timestamp for this ID.
     */
    constructor(site: number, timestamp: number) {
        this.site = site;
        this.timestamp = timestamp;
    }

    /**
     * Determines if this atom ID matches the other one.
     * @param other 
     */
    equals(other: AtomId): boolean {
        return other &&
            other.site === this.site &&
            other.timestamp === this.timestamp;
    }
}

/**
 * Defines an atom.
 * That is, an object that represents a unique operation paired with a unique cause.
 * The cause is effectively the parent of this atom because without it the atom logically could not exist.
 * 
 * 32 bytes + value size per atom.
 */
export class Atom<T> {
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
     * Creates a new atom.
     * @param id The ID of the atom.
     * @param cause The cause of the atom. Null if this atom is the root.
     * @param value The value of the atom.
     */
    constructor(id: AtomId, cause: AtomId, value: T) {
        this.id = id;
        this.cause = cause;
        this.value = value;
    }
}