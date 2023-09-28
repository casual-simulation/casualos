import { sortBy } from 'lodash';
import {
    AddUpdatesResult,
    BranchRecord,
    BranchRecordWithInst,
    CurrentUpdates,
    InstRecord,
    InstRecordsStore,
    InstWithBranches,
    InstWithSubscriptionInfo,
    ReplaceUpdatesResult,
    SaveBranchFailure,
    SaveBranchResult,
    SaveInstResult,
    StoredUpdates,
} from './InstRecordsStore';
import { TemporaryInstRecordsStore } from './TemporaryInstRecordsStore';

/**
 * Defines a class that implements the InstRecordsStore interface by first storing updates in a temporary store and then sending them to a permanent store.
 */
export class SplitInstRecordsStore implements InstRecordsStore {
    private _temp: TemporaryInstRecordsStore;
    private _permanent: InstRecordsStore;

    get temp() {
        return this._temp;
    }

    get perm() {
        return this._permanent;
    }

    constructor(
        temporary: TemporaryInstRecordsStore,
        permanent: InstRecordsStore
    ) {
        this._temp = temporary;
        this._permanent = permanent;
    }

    async getInstByName(
        recordName: string | null,
        inst: string
    ): Promise<InstWithSubscriptionInfo> {
        return await this._permanent.getInstByName(recordName, inst);
    }

    async getBranchByName(
        recordName: string | null,
        inst: string,
        branch: string
    ): Promise<BranchRecordWithInst> {
        const tempResult = await this._temp.getBranchByName(
            recordName,
            inst,
            branch
        );

        if (tempResult) {
            const { branchSizeInBytes, ...result } = tempResult;
            return result;
        } else if (!recordName) {
            return null;
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

    async saveInst(inst: InstWithBranches): Promise<SaveInstResult> {
        if (inst.recordName) {
            const result = await this._permanent.saveInst(inst);
            if (!result.success) {
                return result;
            }
            await this._temp.deleteAllInstBranchInfo(
                inst.recordName,
                inst.inst
            );
        }

        return {
            success: true,
        };
    }

    async saveBranch(branch: BranchRecord): Promise<SaveBranchResult> {
        if (branch.recordName) {
            const result = await this._permanent.saveBranch(branch);
            if (!result.success) {
                return result;
            }
            const info = await this._permanent.getBranchByName(
                branch.recordName,
                branch.inst,
                branch.branch
            );
            if (info) {
                await this._temp.saveBranchInfo(info);
            }
        } else {
            await this._temp.saveBranchInfo({
                recordName: null,
                inst: branch.inst,
                branch: branch.branch,
                linkedInst: null,
                temporary: branch.temporary,
            });
        }

        return {
            success: true,
        };
    }

    async getCurrentUpdates(
        recordName: string | null,
        inst: string,
        branch: string
    ): Promise<CurrentUpdates> {
        const tempUpdates = await this._temp.getUpdates(
            recordName,
            inst,
            branch
        );

        if (tempUpdates) {
            const { branchSizeInBytes, ...result } = tempUpdates;
            return result;
        } else if (!recordName) {
            return null;
        }

        const updates = await this._permanent.getCurrentUpdates(
            recordName,
            inst,
            branch
        );
        if (updates && updates.updates.length > 0) {
            await this._temp.addUpdates(
                recordName,
                inst,
                branch,
                updates.updates,
                updates.instSizeInBytes
            );
        }

        return updates;
    }

    async getAllUpdates(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<StoredUpdates> {
        const tempUpdates = await this._temp.getUpdates(
            recordName,
            inst,
            branch
        );
        const permUpdates = await this._permanent.getAllUpdates(
            recordName,
            inst,
            branch
        );

        if (!tempUpdates) {
            return permUpdates;
        } else if (!permUpdates) {
            return tempUpdates;
        }

        let allUpdates = new Set<string>();

        let merged = [];
        for (let i = 0; i < permUpdates.updates.length; i++) {
            let u = permUpdates.updates[i];
            let t = permUpdates.timestamps[i];

            allUpdates.add(u);
            merged.push({
                u,
                t,
            });
        }

        for (let i = 0; i < tempUpdates.updates.length; i++) {
            let u = tempUpdates.updates[i];
            let t = tempUpdates.timestamps[i];
            if (allUpdates.has(u)) {
                continue;
            }
            allUpdates.add(u);
            merged.push({
                u,
                t,
            });
        }

        const sorted = sortBy(merged, (m) => m.t);
        let updates: string[] = [];
        let timestamps: number[] = [];
        for (let i = 0; i < sorted.length; i++) {
            let m = sorted[i];
            updates.push(m.u);
            timestamps.push(m.t);
        }
        return {
            updates,
            timestamps,
        };
    }

    async getInstSize(
        recordName: string | null,
        inst: string
    ): Promise<number> {
        return (
            (await this._temp.getInstSize(recordName, inst)) ??
            (await this._permanent.getInstSize(recordName, inst))
        );
    }

    async addUpdates(
        recordName: string | null,
        inst: string,
        branch: string,
        updates: string[],
        sizeInBytes: number
    ): Promise<AddUpdatesResult> {
        await this._temp.addUpdates(
            recordName,
            inst,
            branch,
            updates,
            sizeInBytes
        );
        const size = await this._temp.getInstSize(recordName, inst);

        return {
            success: true,
            instSizeInBytes: size,
        };
    }

    async deleteBranch(
        recordName: string | null,
        inst: string,
        branch: string
    ): Promise<void> {
        let promises = [
            this._temp.deleteBranch(recordName, inst, branch),
        ] as Promise<any>[];

        if (recordName) {
            promises.push(
                this._permanent.deleteBranch(recordName, inst, branch)
            );
        }
        await Promise.all(promises);
    }

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
    async replaceCurrentUpdates(
        recordName: string,
        inst: string,
        branch: string,
        updateToAdd: string,
        sizeInBytes: number
    ): Promise<ReplaceUpdatesResult> {
        const updateCount = await this._temp.countBranchUpdates(
            recordName,
            inst,
            branch
        );
        const permanentReplaceResult =
            await this._permanent.replaceCurrentUpdates(
                recordName,
                inst,
                branch,
                updateToAdd,
                sizeInBytes
            );
        if (permanentReplaceResult.success === false) {
            return permanentReplaceResult;
        }
        await this._temp.addUpdates(
            recordName,
            inst,
            branch,
            [updateToAdd],
            sizeInBytes
        );
        await this._temp.trimUpdates(recordName, inst, branch, updateCount);
        return {
            success: true,
        };
    }
}
