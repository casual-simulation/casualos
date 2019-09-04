import { CausalRepoHead, CausalRepoBranchHead } from './CausalRepo';
import { Observable } from 'rxjs';
import { AtomIndexFullDiff } from './AtomIndex';

/**
 * Defines an interface that represents an update to a branch.
 */
export interface CausalRepoBranchUpdate {
    /**
     * The hash of the index/commit that the branch is now pointing to.
     */
    ref: string;

    /**
     * The hash of the index/commit that the branch was pointing at.
     */
    prev: string;

    /**
     * The diff that contains the changes from the previous version to the next version.
     */
    diff: AtomIndexFullDiff;
}

/**
 * Defines an interface for a realtime connection to a specific branch in a causal repo.
 */
export interface CausalRepoBranchConnection {
    /**
     * The branch that is being watched.
     */
    branch: CausalRepoBranchHead;

    /**
     * Gets the observable list of updates to the given head from the remote.
     */
    remoteUpdates: Observable<CausalRepoBranchUpdate>;

    /**
     *
     * @param update
     */
    sendUpdate(update: CausalRepoBranchUpdate): void;
}
