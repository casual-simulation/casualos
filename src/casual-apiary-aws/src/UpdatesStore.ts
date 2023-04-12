/**
 * Defines an interface for services which are able to store branch updates.
 *
 * An "update" is a simplified interface where updates are encoded as strings and can be applied in any order
 * and multiple times.
 */
export interface UpdatesStore {
    /**
     * Gets the list of updates for the given branch.
     * @param branch The branch.
     */
    getUpdates(branch: string): Promise<StoredUpdates>;

    /**
     * Adds the given updates to the given branch.
     * @param branch The branch that the updates should be added to.
     * @param updates The updates that should be added.
     */
    addUpdates(branch: string, updates: string[]): Promise<AddUpdatesResult>;

    /**
     * Deletes all the updates for the given branch.
     * @param branch The branch.
     */
    clearUpdates(branch: string): Promise<void>;
}

export interface StoredUpdates {
    updates: string[];
    timestamps: number[];
}

export type AddUpdatesResult = AddUpdatesSuccess | AddUpdatesFailure;

export interface AddUpdatesSuccess {
    success: true;
}

export type AddUpdatesFailure = MaxSizeReachedFailure;

export interface MaxSizeReachedFailure {
    success: false;
    errorCode: 'max_size_reached';

    /**
     * The branch that the updates were being added to.
     */
    branch: string;

    /**
     * The maximum allowed size for the inst.
     */
    maxBranchSizeInBytes: number;

    /**
     * The size that the inst would be at if the updates were added.
     */
    neededBranchSizeInBytes: number;
}
