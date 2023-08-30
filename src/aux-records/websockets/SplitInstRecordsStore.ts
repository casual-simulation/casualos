import {
    AddUpdatesResult,
    BranchRecord,
    BranchRecordWithInst,
    InstRecord,
    InstRecordsStore,
    InstWithBranches,
    ReplaceUpdatesResult,
    StoredUpdates,
} from './InstRecordsStore';

/**
 * Defines a class that implements the InstRecordsStore interface by first storing updates in a temporary store and then sending them to a permanent store.
 */
export class SplitInstRecordsStore implements InstRecordsStore {
    private _temp: TemporaryInstRecordsStore;
    private _permanent: InstRecordsStore;

    constructor(
        temporary: TemporaryInstRecordsStore,
        permanent: InstRecordsStore
    ) {
        this._temp = temporary;
        this._permanent = permanent;
    }

    async getInstByName(recordName: string, inst: string): Promise<InstRecord> {
        return await this._permanent.getInstByName(recordName, inst);
    }

    async getBranchByName(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<BranchRecordWithInst> {
        const tempResult = await this._temp.getBranchByName(
            recordName,
            inst,
            branch
        );

        if (tempResult) {
            return tempResult;
        }

        const info = await this._permanent.getBranchByName(
            recordName,
            inst,
            branch
        );
        if (info) {
            await this._temp.saveBranchInfo(info);
        }

        return info;
    }

    async saveInst(inst: InstWithBranches): Promise<void> {
        await this._permanent.saveInst(inst);
    }

    async saveBranch(branch: BranchRecord): Promise<void> {
        await this._permanent.saveBranch(branch);
        const info = await this._permanent.getBranchByName(
            branch.recordName,
            branch.inst,
            branch.branch
        );
        await this._temp.saveBranchInfo(info);
    }

    async getCurrentUpdates(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<StoredUpdates> {
        const tempUpdates = await this._temp.getUpdates(
            recordName,
            inst,
            branch
        );

        if (tempUpdates) {
            return tempUpdates;
        }

        const updates = await this._permanent.getCurrentUpdates(
            recordName,
            inst,
            branch
        );
        if (updates.updates.length > 0) {
            await this._temp.addUpdates(
                recordName,
                inst,
                branch,
                updates.updates
            );
        }

        return updates;
    }

    getAllUpdates(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<StoredUpdates> {
        throw new Error('Method not implemented.');
    }

    addUpdates(
        recordName: string,
        inst: string,
        branch: string,
        updates: string[]
    ): Promise<AddUpdatesResult> {
        throw new Error('Method not implemented.');
    }

    deleteBranch(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<void> {
        throw new Error('Method not implemented.');
    }

    replaceUpdates(
        recordName: string,
        inst: string,
        branch: string,
        updatesToRemove: StoredUpdates,
        updatesToAdd: string[]
    ): Promise<ReplaceUpdatesResult> {
        throw new Error('Method not implemented.');
    }

    countUpdates(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<number> {
        throw new Error('Method not implemented.');
    }
}

/**
 * Defines an interface for a store that keeps track of temporary inst records.
 *
 * A key feature of temporary records stores is that they act like a cache.
 * As a result, it may evict data based on configuration or other factors (like memory pressure).
 */
export interface TemporaryInstRecordsStore {
    /**
     * Gets info for the given branch.
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
     * Saves the branch info to the temporary store.
     * @param branch
     */
    saveBranchInfo(branch: BranchRecordWithInst): Promise<void>;

    /**
     * Gets the updates that are stored in this temporary store.
     * Returns null if no updates are stored.
     * @param recordName The name of the record.
     * @param inst The name of the inst.
     * @param branch The name of the branch.
     */
    getUpdates(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<StoredUpdates | null>;

    /**
     * Adds the given updates to this temporary store.
     * @param recordName The name of the record.
     * @param inst The name of the inst.
     * @param branch The name of the branch.
     * @param updates The updates that should be added.
     */
    addUpdates(
        recordName: string,
        inst: string,
        branch: string,
        updates: string[]
    ): Promise<void>;

    /**
     * Sets the given updates in this temporary store.
     * @param recordName The name of the record.
     * @param inst The name of the inst.
     * @param branch The name of the branch.
     * @param updates The updates that should be set.
     */
    setUpdates(
        recordName: string,
        inst: string,
        branch: string,
        updates: string[]
    ): Promise<void>;

    /**
     * Deletes the given number of updates from the beginning of the updates list.
     * @param recordName The name of the record.
     * @param inst The inst.
     * @param branch The branch.
     * @param numToDelete The number of updates that should be deleted from the beginning of the list.
     */
    trimUpdates(
        recordName: string,
        inst: string,
        branch: string,
        numToDelete: number
    ): Promise<void>;
}
