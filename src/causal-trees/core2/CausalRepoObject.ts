import { AtomIndex } from './AtomIndex';
import { Atom } from './Atom2';
import { getHash } from '@casual-simulation/crypto';

/**
 * Defines the possible objects that can exist in a causal repo.
 * All caual repo
 */
export type CausalRepoObject =
    | CausalRepoCommit
    | CausalRepoIndex
    | CausalRepoAtom;

/**
 * Defines a branch.
 * That is, a named pointer to a commit/index.
 */
export interface CausalRepoBranch {
    type: 'branch';

    /**
     * The name of the branch.
     */
    name: string;

    /**
     * The hash of the commit/index that this branch is pointing at.
     */
    hash: string;
}

/**
 * Defines information about an index in a causal repo.
 */
export interface CausalRepoIndex {
    type: 'index';

    /**
     * The data in the index.
     */
    data: AtomIndex;
}

/**
 * Defines information about a commit in a causal repo.
 */
export interface CausalRepoCommit {
    type: 'commit';

    /**
     * The hash of the commit.
     *
     * The commit hash is created from the following pieces of data:
     * - The message.
     * - The time (formatted as an ISO 8601 date).
     * - The index hash.
     * - The previous commit.
     */
    hash: string;

    /**
     * The message contained in the commit.
     */
    message: string;

    /**
     * The time the commit was created.
     */
    time: Date;

    /**
     * The hash of the index that the commit references.
     */
    index: string;

    /**
     * The hash of the previous commit.
     */
    previousCommit: string;
}

/**
 * Defines information about an atom in a causal repo.
 */
export interface CausalRepoAtom {
    type: 'atom';

    /**
     * The atom.
     */
    data: Atom<any>;
}

/**
 * Creates a new causal repo branch.
 * @param name The name of the branch.
 * @param hash The hash that the branch points to.
 */
export function repoBranch(name: string, hash: string): CausalRepoBranch {
    return {
        type: 'branch',
        name: name,
        hash: hash,
    };
}

/**
 * Creates a new CausalRepoAtom.
 * @param atom The atom to include.
 */
export function repoAtom(atom: Atom<any>): CausalRepoAtom {
    return {
        type: 'atom',
        data: atom,
    };
}

/**
 * Creates a new CausalRepoIndex.
 * @param index The index to include.
 */
export function repoIndex(index: AtomIndex): CausalRepoIndex {
    return {
        type: 'index',
        data: index,
    };
}

/**
 * Creates a new CausalRepoCommit.
 * @param message The message to include in the commit.
 * @param time The time to include in the commit.
 * @param indexHash The hash of the index to reference.
 * @param previousCommit The hash of the previous commit.
 */
export function repoCommit(
    message: string,
    time: Date,
    indexHash: string,
    previousCommit: string
): CausalRepoCommit {
    return {
        type: 'commit',
        message: message,
        time: time,
        index: indexHash,
        previousCommit: previousCommit,
        hash: getHash([message, time.toISOString(), indexHash, previousCommit]),
    };
}

/**
 * Gets the hash that can be used to store or retrieve the given object.
 * @param obj The object.
 */
export function getObjectHash(obj: CausalRepoObject): string {
    if (obj.type === 'atom') {
        return obj.data.hash;
    } else if (obj.type === 'index') {
        return obj.data.hash;
    } else {
        return obj.hash;
    }
}
