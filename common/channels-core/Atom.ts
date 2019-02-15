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
     * The priority of this atom.
     * If specified, causes this atom to sort to the beginning
     * on a chain of atoms that share the same cause.
     */
    priority: number;

    /**
     * Creates a new Atom ID.
     * @param site The ID of the site for this ID.
     * @param timestamp The timestamp for this ID.
     * @param priority The priority for this atom.
     */
    constructor(site: number, timestamp: number, priority: number = 0) {
        this.site = site;
        this.timestamp = timestamp;
        this.priority = priority;
    }

    /**
     * Determines if this atom ID matches the other one.
     * @param other 
     */
    equals(other: AtomId): boolean {
        return other &&
            other.site === this.site &&
            other.timestamp === this.timestamp &&
            other.priority === this.priority;
    }

    toString() {
        if (this.priority) {
            return `P${this.timestamp}@T${this.timestamp}@S${this.site}`;
        } else {
            return `T${this.timestamp}@S${this.site}`;
        }
    }
}


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
export class Atom<T extends AtomOp> {
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

    toString() {
        if (this.cause) {
            return `${this.id}->${this.cause}`;
        } else {
            return `${this.id}->${this.cause}`;
        }
    }
}