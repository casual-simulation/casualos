import { AtomIndex } from './AtomIndex';
import { Atom } from './Atom2';

/**
 * Defines the possible objects that can exist in a causal repo.
 * All caual repo
 */
export type CausalRepoObject =
    | CausalRepoCommit
    | CausalRepoIndex
    | CausalRepoAtom;

/**
 * Defines a HEAD for a causal repo.
 * A HEAD is a reference to a branch, index, or commit.
 */
export type CausalRepoHead =
    | CausalRepoIndexHead
    | CausalRepoBranchHead
    | CausalRepoCommitHead;

/**
 * Defines a HEAD that points to a specific index hash.
 */
export interface CausalRepoIndexHead {
    type: 'index_pointer';
    hash: string;
}

/**
 * Defines a HEAD that points to a specific branch.
 */
export interface CausalRepoBranchHead {
    type: 'branch';
    name: string;
}

/**
 * Defines a HEAD that points to a specific commit hash.
 */
export interface CausalRepoCommitHead {
    type: 'commit_pointer';
    hash: string;
}

/**
 * Defines information about an index in a causal repo.
 */
export interface CausalRepoIndex {
    type: 'index';

    /**
     * The hash of the index.
     */
    hash: string;

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
