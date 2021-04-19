import { UpdatesStore } from './UpdatesStore';

/**
 * Defines an implementation of UpdatesStore which keeps everything in memory.
 */
export class MemoryUpdatesStore implements UpdatesStore {
    private _branches: Map<string, string[]> = new Map();

    async getUpdates(branch: string): Promise<string[]> {
        let updates = this._branches.get(branch);
        return (updates ?? []).slice();
    }

    async addUpdates(branch: string, updates: string[]): Promise<void> {
        let storedUpdates = this._branches.get(branch);
        if (!storedUpdates) {
            storedUpdates = [];
            this._branches.set(branch, storedUpdates);
        }
        storedUpdates.push(...updates);
    }

    async clearUpdates(branch: string): Promise<void> {
        this._branches.delete(branch);
    }
}
