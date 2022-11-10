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
    addUpdates(branch: string, updates: string[]): Promise<void>;

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
