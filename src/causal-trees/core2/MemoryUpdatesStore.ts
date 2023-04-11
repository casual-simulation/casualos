import { AddUpdatesResult, StoredUpdates, UpdatesStore } from './UpdatesStore';

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
                    errorCode: 'max_inst_size_reached',
                    inst: branch,
                    maxInstSizeInBytes: this.maxAllowedInstSize,
                    neededInstSizeInBytes: newSize,
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

    async clearUpdates(branch: string): Promise<void> {
        this._branches.delete(branch);
    }
}
