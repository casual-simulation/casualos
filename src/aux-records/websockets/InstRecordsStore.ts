import { ServerError } from '@casual-simulation/aux-common';

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
    getInstByName(
        recordName: string | null,
        inst: string
    ): Promise<InstWithSubscriptionInfo | null>;

    /**
     * Gets the list of insts that are in the given record.
     * @param recordName The name of the record. If null, then an empty list will be returned.
     * @param startingInst The name of the inst to start listing at.
     */
    listInstsByRecord(
        recordName: string | null,
        startingInst?: string | null
    ): Promise<ListInstsStoreResult>;

    /**
     * Gets the info for the given branch. Returns null if the branch does not exist.
     * @param recordName The name of the record.
     * @param inst The name of the inst.
     * @param branch The name of the branch.
     */
    getBranchByName(
        recordName: string | null,
        inst: string,
        branch: string
    ): Promise<BranchRecordWithInst | null>;

    /**
     * Creates or updates the given inst.
     * If branches are included, then they will be added/updated to the inst as well.
     * @param inst The inst that should be saved.
     */
    saveInst(inst: InstWithBranches): Promise<SaveInstResult>;

    /**
     * Creates or updates the given branch record.
     * @param branch The branch that should be saved.
     */
    saveBranch(branch: BranchRecord): Promise<SaveBranchResult>;

    /**
     * Gets the list of updates for the given branch in the given inst and record.
     * Returns null if the branch does not exist.
     * This will only include updates that are currently being worked on.
     * @param recordName The name of the record. If null, then the updates for a tempPublic inst will be returned.
     * @param inst The name of the inst.
     * @param branch The branch in the inst.
     */
    getCurrentUpdates(
        recordName: string | null,
        inst: string,
        branch: string
    ): Promise<CurrentUpdates | null>;

    /**
     * Gets the size of the inst.
     * Returns null if the inst does not exist.
     * @param recordName The name of the record. If null, then the updates for a tempPublic inst will be returned.
     * @param inst The name of the inst.
     * @param branch The branch in the inst.
     */
    getInstSize(
        recordName: string | null,
        inst: string
    ): Promise<number | null>;

    /**
     * Gets the entire list of updates for the given branch in the given inst and record.
     * This should include historical updates.
     * Returns null if the branch does not exist.
     * @param recordName The name of the record. If null, then the updates for a tempPublic inst will be returned.
     * @param inst The name of the inst.
     * @param branch The branch in the inst.
     */
    getAllUpdates(
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
     * @param sizeInBytes The size of the updates in bytes.
     */
    addUpdates(
        recordName: string | null,
        inst: string,
        branch: string,
        updates: string[],
        sizeInBytes: number
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
     * Replaces the current set of updates with a new update.
     * Useful for when updates have been merged and the old ones should be replaced by the new one.
     *
     * Depending on the implementation, this function may or may not be concurrent safe.
     * That is, if two clients call this function at the same time for the same branch, then it is possible that the branch will be put into an invalid state.
     *
     * @param recordName The name of the record. If null, then the updates will be added to a tempPublic inst.
     * @param inst The name of the inst.
     * @param branch The branch in the inst.
     * @param updatesToRemove The updates that should be moved. Only valid if the result from getUpdates() is used.
     * @param updateToAdd The update that should be added.
     * @param sizeInBytes The size of the new update in bytes.
     */
    replaceCurrentUpdates(
        recordName: string | null,
        inst: string,
        branch: string,
        updateToAdd: string,
        sizeInBytes: number
    ): Promise<ReplaceUpdatesResult>;

    /**
     * Deletes the given inst.
     * @param recordName The name of the record.
     * @param inst The name of the inst.
     */
    deleteInst(recordName: string | null, inst: string): Promise<void>;
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
    instSizeInBytes?: number;
}

export interface AddUpdatesFailure {
    success: false;
    errorCode: 'max_size_reached' | 'record_not_found' | 'inst_not_found';

    /**
     * The branch that the updates were being added to.
     */
    branch: string;

    /**
     * The maximum allowed size for the inst.
     */
    maxInstSizeInBytes?: number;

    /**
     * The size that the inst would be at if the updates were added.
     */
    neededInstSizeInBytes?: number;
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
    recordName: string | null;

    /**
     * The name of the inst.
     */
    inst: string;

    /**
     * The list of resource markers that are applied to this inst.
     */
    markers: string[];
}

export interface InstWithSubscriptionInfo extends InstRecord {
    /**
     * The ID of the subscription that is associated with the inst.
     */
    subscriptionId: string | null;

    /**
     * The status of the subscription that is associated with the inst.
     */
    subscriptionStatus: string | null;

    /**
     * The type of the subscription.
     */
    subscriptionType: 'user' | 'studio' | null;
}

export interface BranchRecordWithInst extends BranchRecord {
    /**
     * The inst that this branch belongs to.
     * Null if the branch does not have a reocrd name.
     */
    linkedInst: InstWithSubscriptionInfo | null;
}

export interface BranchRecord {
    /**
     * The name of the record.
     */
    recordName: string | null;

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

export interface CurrentUpdates extends StoredUpdates {
    instSizeInBytes: number;
}

export type SaveInstResult = SaveInstSuccess | SaveInstFailure;

export interface SaveInstSuccess {
    success: true;
}

export interface SaveInstFailure {
    success: false;
    errorCode: ServerError | 'record_not_found';
    errorMessage: string;
}

export type SaveBranchResult = SaveBranchSuccess | SaveBranchFailure;

export interface SaveBranchSuccess {
    success: true;
}

export interface SaveBranchFailure {
    success: false;
    errorCode: ServerError | 'inst_not_found';
    errorMessage: string;
}

export type ListInstsStoreResult =
    | ListInstsStoreSuccess
    | ListInstsStoreFailure;

export interface ListInstsStoreSuccess {
    success: true;
    insts: InstRecord[];
    totalCount: number;
}

export interface ListInstsStoreFailure {
    success: false;
    errorCode: ServerError | 'record_not_found';
    errorMessage: string;
}

/**
 * Gets the ID for an inst with the given origin.
 * @param recordName The name of the record for the simulation.
 * @param inst The name of the inst for the simulation.
 */
export function formatInstId(recordName: string | null, inst: string): string {
    return `${recordName ?? ''}/${inst}`;
}

/**
 * Parses the given inst ID into the record name and inst name.
 * @param id The ID of the inst.
 */
export function parseInstId(id: string): {
    recordName: string | null;
    inst: string;
} {
    if (!id) {
        return null;
    }
    const indexOfFirstSlash = id.indexOf('/');
    if (indexOfFirstSlash < 0) {
        return null;
    }
    const recordName = id.substring(0, indexOfFirstSlash);
    const inst = id.substring(indexOfFirstSlash + 1);
    return {
        recordName: recordName ? recordName : null,
        inst,
    };
}

/**
 * Normalizes the given isnt ID.
 * Insts can belong to a record, so inst IDs have to formatted like: "{recordName}/{instName}""
 * In previous versions, insts were only referenced by their name. This function is able to normalize those IDs so that they can be parsed correctly.
 * @param id The ID that should be normalized.
 */
export function normalizeInstId(id: string): string {
    if (!id) {
        return null;
    }
    const indexOfFirstSlash = id.indexOf('/');
    if (indexOfFirstSlash < 0) {
        return '/' + id;
    }

    return id;
}
