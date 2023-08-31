import { StoredUpdates } from '@casual-simulation/causal-trees';
import { BranchRecordWithInst, CurrentUpdates } from './InstRecordsStore';

/**
 * Defines an interface for a store that keeps track of temporary inst records.
 *
 * A key feature of temporary records stores is that they act like a cache.
 * As a result, it may evict data based on configuration or other factors (like memory pressure).
 */
export interface TemporaryInstRecordsStore {
    /**
     * Gets the key that should be used for the given branch.
     * @param recordName The name of the record.
     * @param inst The name of the inst.
     * @param branch The name of the branch.
     */
    getBranchKey(recordName: string, inst: string, branch: string): string;

    /**
     * Gets the key that should be used for the given inst/
     * @param recordName The name of the record.
     * @param inst The name of the inst.
     */
    getInstKey(recordName: string, inst: string): string;

    /**
     * Gets info for the given branch.
     * @param branchKey The key for the branch.
     */
    getBranchByName(branchKey: string): Promise<TempBranchInfo | null>;

    /**
     * Saves the branch info to the temporary store.
     * @param branch
     */
    saveBranchInfo(branch: TempBranchInfo): Promise<void>;

    /**
     * Deletes all the branches that are associated with the given inst.
     * @param recordName The name of the record.
     * @param inst The name of the inst.
     */
    deleteAllInstBranchInfo(recordName: string, inst: string): Promise<void>;

    /**
     * Gets the updates that are stored in this temporary store.
     * Returns null if no updates are stored.
     * @param branchKey The key for the branch.
     */
    getUpdates(branchKey: string): Promise<CurrentUpdates | null>;

    /**
     * Adds the given updates to this temporary store.
     * @param branchKey The branch key.
     * @param updates The updates that should be added.
     * @param sizeInBytes The size of the updates in bytes.
     */
    addUpdates(
        branchKey: string,
        updates: string[],
        sizeInBytes: number
    ): Promise<void>;

    /**
     * Gets the size of the inst in bytes.
     *
     * @param instKey The inst key.
     */
    getInstSize(instKey: string): Promise<number | null>;

    /**
     * Sets the size of the inst in bytes.
     * @param instKey The inst key.
     * @param sizeInBytes The size of the inst in bytes.
     */
    setInstSize(instKey: string, sizeInBytes: number): Promise<void>;

    /**
     * Adds the given amount to the size of the inst.
     * @param instKey The inst key.
     * @param sizeInBytes The size.
     */
    addInstSize(instKey: string, sizeInBytes: number): Promise<void>;

    /**
     * Deletes the given number of updates from the beginning of the updates list.
     * @param branchKey The branch key.
     * @param numToDelete The number of updates that should be deleted from the beginning of the list.
     */
    trimUpdates(branchKey: string, numToDelete: number): Promise<void>;
}

export interface TempBranchInfo extends BranchRecordWithInst {}
