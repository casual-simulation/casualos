import { CurrentUpdates, StoredUpdates } from './InstRecordsStore';
import {
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
    ): Promise<TempBranchInfo> {
        const key = this.getBranchKey(recordName, inst, branch);
        return this._branches.get(key) ?? null;
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
    ): Promise<CurrentUpdates> {
        const key = this.getBranchKey(recordName, inst, branch);
        const instKey = this.getInstKey(recordName, inst);
        const updates = this._updates.get(key);

        if (!updates) {
            return null;
        }
        const size = this._sizes.get(instKey) ?? 0;
        return {
            ...updates,
            instSizeInBytes: size,
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
        const instKey = this.getInstKey(recordName, inst);
        let currentUpdates = this._updates.get(key) ?? {
            updates: [],
            timestamps: [],
        };

        for (let update of updates) {
            currentUpdates.updates.push(update);
            currentUpdates.timestamps.push(Date.now());
        }

        this._updates.set(key, currentUpdates);

        const currentSize = this._sizes.get(instKey) ?? 0;
        this._sizes.set(instKey, currentSize + sizeInBytes);
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

    async trimUpdates(
        recordName: string,
        inst: string,
        branch: string,
        numToDelete: number
    ): Promise<void> {
        const key = this.getBranchKey(recordName, inst, branch);
        const updates = this._updates.get(key);
        if (updates) {
            updates.updates.splice(0, numToDelete);
            updates.timestamps.splice(0, numToDelete);
        }
    }
}
