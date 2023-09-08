import { CurrentUpdates, StoredUpdates } from './InstRecordsStore';
import {
    BranchUpdates,
    TempBranchInfo,
    TemporaryInstRecordsStore,
} from './TemporaryInstRecordsStore';

/**
 * Defines an implementation of TemporaryInstRecordsStore which keeps everything in memory.
 */
export class MemoryTempInstRecordsStore implements TemporaryInstRecordsStore {
    private _branches: Map<string, TempBranchInfo> = new Map();
    private _updates: Map<string, StoredUpdates> = new Map();
    private _sizes: Map<string, number> = new Map();
    private _counts: Map<string, number> = new Map();

    getBranchKey(recordName: string, inst: string, branch: string): string {
        return `/${recordName}/${inst}/${branch}`;
    }

    getInstKey(recordName: string, inst: string): string {
        return `/${recordName}/${inst}`;
    }

    async getBranchByName(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<TempBranchInfo & { branchSizeInBytes: number }> {
        const key = this.getBranchKey(recordName, inst, branch);
        const b = this._branches.get(key) ?? null;

        if (!b) {
            return null;
        }

        return {
            ...b,
            branchSizeInBytes:
                (await this.getBranchSize(recordName, inst, branch)) ?? 0,
        };
    }

    async saveBranchInfo(branch: TempBranchInfo): Promise<void> {
        const key = this.getBranchKey(
            branch.recordName,
            branch.inst,
            branch.branch
        );
        this._branches.set(key, branch);
    }

    async deleteAllInstBranchInfo(
        recordName: string,
        inst: string
    ): Promise<void> {
        for (let key of this._branches.keys()) {
            if (key.startsWith(`/${recordName}/${inst}/`)) {
                this._branches.delete(key);
            }
        }
    }

    async getUpdates(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<BranchUpdates> {
        const key = this.getBranchKey(recordName, inst, branch);
        const instKey = this.getInstKey(recordName, inst);
        const updates = this._updates.get(key);

        if (!updates) {
            return null;
        }
        const instSize = (await this.getInstSize(recordName, inst)) ?? 0;
        const branchSize =
            (await this.getBranchSize(recordName, inst, branch)) ?? 0;
        return {
            ...updates,
            instSizeInBytes: instSize,
            branchSizeInBytes: branchSize,
        };
    }

    async addUpdates(
        recordName: string,
        inst: string,
        branch: string,
        updates: string[],
        sizeInBytes: number
    ): Promise<void> {
        const key = this.getBranchKey(recordName, inst, branch);
        let currentUpdates = this._updates.get(key) ?? {
            updates: [],
            timestamps: [],
        };

        for (let update of updates) {
            currentUpdates.updates.push(update);
            currentUpdates.timestamps.push(Date.now());
        }

        this._updates.set(key, currentUpdates);

        await this.addInstSize(recordName, inst, sizeInBytes);
        await this.addBranchSize(recordName, inst, branch, sizeInBytes);
        this._counts.set(key, (this._counts.get(key) ?? 0) + updates.length);
    }

    async listPublicBranches(): Promise<TempBranchInfo[]> {
        let publicBranches = [] as TempBranchInfo[];
        for (let branch of this._branches.values()) {
            if (branch.recordName === null) {
                publicBranches.push(branch);
            }
        }

        return publicBranches;
    }

    async deleteBranch(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<void> {
        const key = this.getBranchKey(recordName, inst, branch);
        this._branches.delete(key);
        this._updates.delete(key);

        const branchSize =
            (await this.getBranchSize(recordName, inst, branch)) ?? 0;
        await this.addInstSize(recordName, inst, -branchSize);
        await this.deleteBranchSize(recordName, inst, branch);
        this._counts.delete(key);
    }

    async getInstSize(
        recordName: string,
        inst: string
    ): Promise<number | null> {
        const key = this.getInstKey(recordName, inst);
        return this._sizes.get(key) ?? null;
    }

    async setInstSize(
        recordName: string,
        inst: string,
        sizeInBytes: number
    ): Promise<void> {
        const instKey = this.getInstKey(recordName, inst);
        this._sizes.set(instKey, sizeInBytes);
    }

    async addInstSize(
        recordName: string,
        inst: string,
        sizeInBytes: number
    ): Promise<void> {
        const instKey = this.getInstKey(recordName, inst);
        const currentSize = this._sizes.get(instKey) ?? 0;
        this._sizes.set(instKey, currentSize + sizeInBytes);
    }

    async deleteInstSize(recordName: string, inst: string): Promise<void> {
        const key = this.getInstKey(recordName, inst);
        this._sizes.delete(key);
    }

    async trimUpdates(
        recordName: string,
        inst: string,
        branch: string,
        numToDelete: number
    ): Promise<void> {
        const key = this.getBranchKey(recordName, inst, branch);
        const updates = this._updates.get(key);
        let numDeleted = 0;
        if (updates) {
            let deleted = updates.updates.splice(0, numToDelete);
            updates.timestamps.splice(0, numToDelete);

            numDeleted = deleted.length;
        }
        this._counts.set(key, (this._counts.get(key) ?? 0) - numDeleted);
    }

    async countBranchUpdates(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<number> {
        const key = this.getBranchKey(recordName, inst, branch);
        return this._counts.get(key) ?? 0;
    }

    async getBranchSize(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<number> {
        return (
            this._sizes.get(this.getBranchKey(recordName, inst, branch)) ?? null
        );
    }

    async setBranchSize(
        recordName: string,
        inst: string,
        branch: string,
        sizeInBytes: number
    ): Promise<void> {
        this._sizes.set(
            this.getBranchKey(recordName, inst, branch),
            sizeInBytes
        );
    }

    async addBranchSize(
        recordName: string,
        inst: string,
        branch: string,
        sizeInBytes: number
    ): Promise<void> {
        const key = this.getBranchKey(recordName, inst, branch);
        const currentSize = this._sizes.get(key) ?? 0;
        this._sizes.set(key, currentSize + sizeInBytes);
    }

    async deleteBranchSize(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<void> {
        this._sizes.delete(this.getBranchKey(recordName, inst, branch));
    }
}
