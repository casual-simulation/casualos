import { DirectoryStore } from './DirectoryStore';
import { DirectoryEntry } from './DirectoryEntry';

/**
 * Defines a directory store which stores data in memory.
 */
export class MemoryDirectoryStore implements DirectoryStore {
    private _map: Map<string, DirectoryEntry>;

    constructor() {
        this._map = new Map();
    }

    async update(entry: DirectoryEntry): Promise<void> {
        this._map.set(entry.hash, entry);
    }

    async findByIpAddress(ipAddress: string): Promise<DirectoryEntry[]> {
        let values = [...this._map.values()];
        return values.filter(v => v.ipAddress === ipAddress);
    }

    async findByHash(hash: string): Promise<DirectoryEntry> {
        return this._map.get(hash);
    }
}
