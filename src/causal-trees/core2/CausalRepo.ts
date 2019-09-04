import { AtomIndex } from './AtomIndex';

/**
 * Defines an interface for a repository that contains metadata about a set of causal trees.
 *
 * A causal repo is kinda similar to a Git repo.
 */
export interface CausalRepo {
    /**
     * The current head that the repo is using.
     */
    currentHead: CausalRepoHead;

    /**
     * The list of heads that are currently available.
     */
    heads: CausalRepoHead[];
}
