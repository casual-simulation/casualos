import {
    AddUpdatesResult,
    ReplaceUpdatesResult,
    StoredUpdates,
    UpdatesStore,
} from './UpdatesStore';

/**
 * Defines an implementation of UpdatesStore which keeps everything in memory.
 */
export class MemoryUpdatesStore implements UpdatesStore {
    private _branches: Map<
        string,
        StoredUpdates & {
            instSizeInBytes: number;
        }
    > = new Map();

    maxAllowedInstSize: number = Infinity;

    async getUpdates(branch: string): Promise<StoredUpdates> {
        let updates = this._branches.get(branch) ?? {
            updates: [],
            timestamps: [],
            instSizeInBytes: 0,
        };

        return {
            updates: updates.updates.slice(),
            timestamps: updates.timestamps.slice(),
        };
    }

    async countUpdates(branch: string): Promise<number> {
        let updates = this._branches.get(branch) ?? {
            updates: [],
            timestamps: [],
            instSizeInBytes: 0,
        };

        return updates.updates.length;
    }

    async addUpdates(
        branch: string,
        updates: string[]
    ): Promise<AddUpdatesResult> {
        let storedUpdates = this._branches.get(branch);
        if (!storedUpdates) {
            storedUpdates = {
                updates: [],
                timestamps: [],
                instSizeInBytes: 0,
            };
            this._branches.set(branch, storedUpdates);
        }

        let newSize = storedUpdates.instSizeInBytes;
        for (let update of updates) {
            newSize += update.length;

            if (newSize > this.maxAllowedInstSize) {
                return {
                    success: false,
                    errorCode: 'max_size_reached',
                    branch,
                    maxBranchSizeInBytes: this.maxAllowedInstSize,
                    neededBranchSizeInBytes: newSize,
                };
            }
        }
        storedUpdates.instSizeInBytes = newSize;

        for (let update of updates) {
            storedUpdates.updates.push(update);
            storedUpdates.timestamps.push(Date.now());
        }

        return {
            success: true,
        };
    }

    async replaceUpdates(
        branch: string,
        updatesToRemove: StoredUpdates,
        updatesToAdd: string[]
    ): Promise<ReplaceUpdatesResult> {
        let storedUpdates = this._branches.get(branch);
        if (!storedUpdates) {
            storedUpdates = {
                updates: [],
                timestamps: [],
                instSizeInBytes: 0,
            };
            this._branches.set(branch, storedUpdates);
        }

        for (let u of updatesToRemove.updates) {
            let i = storedUpdates.updates.indexOf(u);
            if (i === -1) {
                continue;
            }
            storedUpdates.updates.splice(i, 1);
            storedUpdates.timestamps.splice(i, 1);
            storedUpdates.instSizeInBytes -= u.length;
        }

        return this.addUpdates(branch, updatesToAdd);
    }

    async clearUpdates(branch: string): Promise<void> {
        this._branches.delete(branch);
    }

    reset() {
        this._branches = new Map();
        this.maxAllowedInstSize = Infinity;
    }
}
