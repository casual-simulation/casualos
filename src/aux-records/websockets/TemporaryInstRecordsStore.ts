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
     * Gets info for the given branch.
     * @param branchKey The key for the branch.
     */
    getBranchByName(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<TempBranchInfo | null>;

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
    getUpdates(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<CurrentUpdates | null>;

    /**
     * Adds the given updates to this temporary store.
     * @param recordName The name of the record.
     * @param inst The name of the inst.
     * @param branch The name of the branch.
     * @param updates The updates that should be added.
     * @param sizeInBytes The size of the updates in bytes.
     */
    addUpdates(
        recordName: string,
        inst: string,
        branch: string,
        updates: string[],
        sizeInBytes: number
    ): Promise<void>;

    /**
     * Gets the size of the inst in bytes.
     * Returns null if no size is stored.
     *
     * @param recordName The name of the record.
     * @param inst The name of the inst.
     */
    getInstSize(recordName: string, inst: string): Promise<number | null>;

    /**
     * Sets the size of the inst in bytes.
     * @param recordName The name of the record.
     * @param inst The name of the inst.
     * @param sizeInBytes The size of the inst in bytes.
     */
    setInstSize(
        recordName: string,
        inst: string,
        sizeInBytes: number
    ): Promise<void>;

    /**
     * Adds the given amount to the size of the inst.
     * @param recordName The name of the record.
     * @param inst The name of the inst.
     * @param sizeInBytes The size.
     */
    addInstSize(
        recordName: string,
        inst: string,
        sizeInBytes: number
    ): Promise<void>;

    /**
     * Deletes the given number of updates from the beginning of the updates list.
     * @param recordName The name of the record.
     * @param inst The name of the inst.
     * @param branch The name of the branch.
     * @param numToDelete The number of updates that should be deleted from the beginning of the list.
     */
    trimUpdates(
        recordName: string,
        inst: string,
        branch: string,
        numToDelete: number
    ): Promise<void>;
}

export interface TempBranchInfo extends BranchRecordWithInst {}
