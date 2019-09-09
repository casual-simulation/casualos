import { DirectoryEntry } from './DirectoryEntry';
import { DirectoryStore } from './DirectoryStore';
import { sortBy } from 'lodash';

/**
 * Defines a service that is able to update and query the device directory.
 */
export class DirectoryService {
    private _store: DirectoryStore;

    constructor(store: DirectoryStore) {
        this._store = store;
    }

    /**
     * Updates the given directory entry.
     * @param entry The entry to update.
     */
    async update(entry: DirectoryEntry): Promise<void> {
        let updated = {
            ...entry,
            lastUpdateTime: Date.now(),
        };
        await this._store.update(updated);
    }

    async findByIpAddress(ip: string): Promise<DirectoryEntry[]> {
        const entries = await this._store.findByIpAddress(ip);
        return sortBy(entries, e => e.publicName);
    }

    isInternal(entry: DirectoryEntry, ip: string) {
        return entry.ipAddress === ip;
    }
}
