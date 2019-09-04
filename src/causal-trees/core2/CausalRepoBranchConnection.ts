import { Observable } from 'rxjs';
import { AtomIndexFullDiff } from './AtomIndex';

/**
 * Defines an interface for a realtime connection to a specific branch in a causal repo.
 */
export interface CausalRepoBranchConnection {
    /**
     * The name of the branch that is being watched.
     */
    branch: string;

    /**
     * Gets the observable list of updates to the given head from the remote.
     */
    remoteUpdates: Observable<AtomIndexFullDiff>;

    /**
     * Sends the given update to the remote for syncing.
     * @param update The update to send.
     */
    sendUpdate(update: AtomIndexFullDiff): void;
}
