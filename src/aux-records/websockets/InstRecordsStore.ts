/**
 * Defines an interface for services which are able to store inst update data.
 *
 * An "update" is a simplified interface where updates are encoded as strings and can be applied in any order
 * and multiple times.
 */
export interface InstRecordsStore {
    /**
     * Gets the info for the given inst.
     * @param recordName The name of the record that the inst is in.
     * @param inst The name of the inst.
     */
    getInstByName(recordName: string, inst: string): Promise<InstRecord | null>;

    /**
     * Gets the info for the given branch. Returns null if the branch does not exist.
     * @param recordName The name of the record.
     * @param inst The name of the inst.
     * @param branch The name of the branch.
     */
    getBranchByName(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<BranchRecordWithInst | null>;

    /**
     * Creates or updates the given inst.
     * If branches are included, then they will be added/updated to the inst as well.
     * @param inst The inst that should be saved.
     */
    saveInst(inst: InstWithBranches): Promise<void>;

    /**
     * Creates or updates the given branch record.
     * @param branch The branch that should be saved.
     */
    saveBranch(branch: BranchRecord): Promise<void>;

    /**
     * Gets the list of updates for the given branch in the given inst and record.
     * @param recordName The name of the record. If null, then the updates for a tempPublic inst will be returned.
     * @param inst The name of the inst.
     * @param branch The branch in the inst.
     */
    getUpdates(
        recordName: string | null,
        inst: string,
        branch: string
    ): Promise<StoredUpdates>;

    /**
     * Adds the given updates to the given branch. If the branch does not exist, then it will be created.
     * @param recordName The name of the record that the updates should be added to. If null, then the updates will be added to a tempPublic inst.
     * @param inst The name of the inst.
     * @param branch The branch that the updates should be added to.
     * @param updates The updates that should be added.
     */
    addUpdates(
        recordName: string | null,
        inst: string,
        branch: string,
        updates: string[]
    ): Promise<AddUpdatesResult>;

    /**
     * Deletes the given branch.
     * @param recordName The name of the record. If null, then the updates will be added to a tempPublic inst.
     * @param inst The name of the inst.
     * @param branch The branch in the inst.
     */
    deleteBranch(
        recordName: string | null,
        inst: string,
        branch: string
    ): Promise<void>;

    /**
     * Replaces the given set of updates with a new set of updates.
     * Useful for when updates have been merged and the old ones should be replaced by the new one(s).
     *
     * @param recordName The name of the record. If null, then the updates will be added to a tempPublic inst.
     * @param inst The name of the inst.
     * @param branch The branch in the inst.
     * @param updatesToRemove The updates that should be moved. Only valid if the result from getUpdates() is used.
     * @param updatesToAdd The updates that should be added.
     */
    replaceUpdates(
        recordName: string | null,
        inst: string,
        branch: string,
        updatesToRemove: StoredUpdates,
        updatesToAdd: string[]
    ): Promise<ReplaceUpdatesResult>;

    /**
     * Gets the number of updates for the given branch.
     * @param recordName The name of the record. If null, then the updates will be added to a tempPublic inst.
     * @param inst The name of the inst.
     * @param branch The branch.
     */
    countUpdates(
        recordName: string | null,
        inst: string,
        branch: string
    ): Promise<number>;
}

export interface StoredUpdates {
    updates: string[];
    timestamps: number[];
}

export type AddUpdatesResult = AddUpdatesSuccess | AddUpdatesFailure;

export interface AddUpdatesSuccess {
    success: true;

    /**
     * The current size of the branch.
     */
    branchSizeInBytes?: number;
}

export interface AddUpdatesFailure {
    success: false;
    errorCode: 'max_size_reached' | 'record_not_found' | 'inst_not_found';

    /**
     * The branch that the updates were being added to.
     */
    branch: string;

    /**
     * The maximum allowed size for the branch.
     */
    maxBranchSizeInBytes?: number;

    /**
     * The size that the branch would be at if the updates were added.
     */
    neededBranchSizeInBytes?: number;
}

export type ReplaceUpdatesResult =
    | ReplaceUpdatesSuccess
    | ReplaceUpdatesFailure;

export interface ReplaceUpdatesSuccess {
    success: true;
}

export interface ReplaceUpdatesFailure {
    success: false;
    errorCode: 'max_size_reached' | 'record_not_found' | 'inst_not_found';

    /**
     * The branch that the updates were being added to.
     */
    branch: string;

    /**
     * The maximum allowed size for the branch.
     */
    maxBranchSizeInBytes?: number;

    /**
     * The size that the branch would be at if the updates were added.
     */
    neededBranchSizeInBytes?: number;
}

export interface InstRecord {
    /**
     * The name of the record.
     */
    recordName: string;

    /**
     * The name of the inst.
     */
    inst: string;

    /**
     * The list of resource markers that are applied to this inst.
     */
    markers: string[];
}

export interface BranchRecordWithInst extends BranchRecord {
    /**
     * The inst that this branch belongs to.
     */
    linkedInst: InstRecord;
}

export interface BranchRecord {
    /**
     * The name of the record.
     */
    recordName: string;

    /**
     * The name of the inst.
     */
    inst: string;

    /**
     * The name of the branch.
     */
    branch: string;

    /**
     * Whether the branch is temporary.
     */
    temporary: boolean;
}

export interface InstWithBranches extends InstRecord {
    /**
     * The list of branches that are in the inst.
     */
    branches?: BranchRecord[];
}
