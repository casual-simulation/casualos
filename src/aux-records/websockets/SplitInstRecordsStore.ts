import { sortBy } from 'lodash';
import {
    AddUpdatesResult,
    BranchRecord,
    BranchRecordWithInst,
    CurrentUpdates,
    InstRecord,
    InstRecordsStore,
    InstWithBranches,
    ReplaceUpdatesResult,
    StoredUpdates,
} from './InstRecordsStore';
import { TemporaryInstRecordsStore } from './TemporaryInstRecordsStore';
import WebTileLayer from 'esri/layers/WebTileLayer';

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

    async getInstByName(
        recordName: string | null,
        inst: string
    ): Promise<InstRecord> {
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
        await this._temp.deleteAllInstBranchInfo(inst.recordName, inst.inst);
    }

    async saveBranch(branch: BranchRecord): Promise<void> {
        if (branch.recordName) {
            await this._permanent.saveBranch(branch);
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
        if (updates.updates.length > 0) {
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

    async getInstSize(recordName: string, inst: string): Promise<number> {
        return (
            (await this._temp.getInstSize(recordName, inst)) ??
            (await this._permanent.getInstSize(recordName, inst))
        );
    }

    async addUpdate(
        recordName: string,
        inst: string,
        branch: string,
        update: string,
        sizeInBytes: number
    ): Promise<AddUpdatesResult> {
        await this._temp.addUpdates(
            recordName,
            inst,
            branch,
            [update],
            sizeInBytes
        );
        const size = await this._temp.getInstSize(recordName, inst);

        return {
            success: true,
            instSizeInBytes: size,
        };
    }

    async deleteBranch(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<void> {
        await Promise.all([
            this._temp.deleteBranch(recordName, inst, branch),
            this._permanent.deleteBranch(recordName, inst, branch),
        ]);
    }

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
