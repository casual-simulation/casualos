import { DirectoryEntry } from './DirectoryEntry';
import { DirectoryStore } from './DirectoryStore';
import { sortBy } from 'lodash';
import { DirectoryUpdate } from './DirectoryUpdate';
import { DirectoryResult } from './DirectoryResult';
import { compareSync, hashSync, genSaltSync } from 'bcryptjs';

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
        let existing = await this._store.findByHash(update.key);

        if (!existing) {
            let salt = genSaltSync(10);
            let hash = hashSync(update.password, salt);
            let entry: DirectoryEntry = {
                key: update.key,
                passwordHash: hash,
                privateIpAddress: update.privateIpAddress,
                publicIpAddress: update.publicIpAddress,
                publicName: update.publicName,
                lastUpdateTime: Date.now(),
            };

            return await this._updateEntry(entry);
        }

        if (!compareSync(update.password, existing.passwordHash)) {
            return {
                type: 'not_authorized',
            };
        }

        let updated = {
            ...existing,
            privateIpAddress: update.privateIpAddress,
            publicIpAddress: update.publicIpAddress,
            publicName: update.publicName,
            lastUpdateTime: Date.now(),
        };

        return await this._updateEntry(updated);
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

    private async _updateEntry(
        entry: DirectoryEntry
    ): Promise<DirectoryResult> {
        await this._store.update(entry);

        return {
            type: 'entry_updated',
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
