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

    async getBranchByName(key: string): Promise<TempBranchInfo> {
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

    async getUpdates(key: string): Promise<CurrentUpdates> {
        const updates = this._updates.get(key);

        if (!updates) {
            return null;
        }
        const size = this._sizes.get(key) ?? 0;
        return {
            ...updates,
            instSizeInBytes: size,
        };
    }

    async addUpdates(
        key: string,
        updates: string[],
        sizeInBytes: number
    ): Promise<void> {
        let currentUpdates = this._updates.get(key) ?? {
            updates: [],
            timestamps: [],
        };

        for (let update of updates) {
            currentUpdates.updates.push(update);
            currentUpdates.timestamps.push(Date.now());
        }

        this._updates.set(key, currentUpdates);

        const currentSize = this._sizes.get(key) ?? 0;
        this._sizes.set(key, currentSize + sizeInBytes);
    }

    async getUpdatesSize(key: string): Promise<number> {
        return this._sizes.get(key) ?? 0;
    }

    async setUpdatesSize(
        branchKey: string,
        sizeInBytes: number
    ): Promise<void> {
        this._sizes.set(branchKey, sizeInBytes);
    }

    async addUpdatesSize(
        branchKey: string,
        sizeInBytes: number
    ): Promise<void> {
        const currentSize = this._sizes.get(branchKey) ?? 0;
        this._sizes.set(branchKey, currentSize + sizeInBytes);
    }

    async trimUpdates(key: string, numToDelete: number): Promise<void> {
        const updates = this._updates.get(key);
        if (updates) {
            updates.updates.splice(0, numToDelete);
            updates.timestamps.splice(0, numToDelete);
        }
    }
}
