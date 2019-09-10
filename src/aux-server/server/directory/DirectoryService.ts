import { DirectoryEntry } from './DirectoryEntry';
import { DirectoryStore } from './DirectoryStore';
import { sortBy } from 'lodash';
import { DirectoryUpdate } from './DirectoryUpdate';
import { DirectoryResult } from './DirectoryResult';

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
     * @param update The update for the entry.
     */
    async update(update: DirectoryUpdate): Promise<DirectoryResult> {
        let entry: DirectoryEntry = {
            key: update.key,
            passwordHash: update.password,
            privateIpAddress: update.privateIpAddress,
            publicIpAddress: update.publicIpAddress,
            publicName: update.publicName,
            lastUpdateTime: Date.now(),
        };
        await this._store.update(entry);

        return {
            type: 'entry_updated',
        };
    }

    async findEntries(ip: string): Promise<DirectoryResult> {
        const stored = await this._store.findByPublicIpAddress(ip);
        const entries = sortBy(stored, e => e.publicName);

        return {
            type: 'query_results',
            entries: entries.map(e => ({
                publicName: e.publicName,
                subhost: getSubHost(e, ip),
            })),
        };
    }
}

export function isInternal(entry: DirectoryEntry, ip: string): boolean {
    return entry.publicIpAddress === ip;
}

export function getSubHost(entry: DirectoryEntry, ip: string): string {
    if (isInternal(entry, ip)) {
        return `internal.${entry.key}`;
    } else {
        return `external.${entry.key}`;
    }
}
