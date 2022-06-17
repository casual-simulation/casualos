import { StoredUpdates, UpdatesStore } from './UpdatesStore';

/**
 * Defines an implementation of UpdatesStore which keeps everything in memory.
 */
export class MemoryUpdatesStore implements UpdatesStore {
    private _branches: Map<string, StoredUpdates> = new Map();

    async getUpdates(branch: string): Promise<StoredUpdates> {
        let updates = this._branches.get(branch) ?? {
            updates: [],
            timestamps: [],
        };

        return {
            updates: updates.updates.slice(),
            timestamps: updates.timestamps.slice(),
        };
    }

    async addUpdates(branch: string, updates: string[]): Promise<void> {
        let storedUpdates = this._branches.get(branch);
        if (!storedUpdates) {
            storedUpdates = {
                updates: [],
                timestamps: [],
            };
            this._branches.set(branch, storedUpdates);
        }
        storedUpdates.updates.push(...updates);
        storedUpdates.timestamps.push(...updates.map((u) => Date.now()));
    }

    async clearUpdates(branch: string): Promise<void> {
        this._branches.delete(branch);
    }
}
