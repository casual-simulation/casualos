import { DirectoryStore } from './DirectoryStore';
import { DirectoryEntry } from './DirectoryEntry';
import { DirectoryClientSettings } from './DirectoryClientSettings';

/**
 * Defines a directory store which stores data in memory.
 */
export class MemoryDirectoryStore implements DirectoryStore {
    private _map: Map<string, DirectoryEntry>;
    private _settings: DirectoryClientSettings;

    constructor() {
        this._map = new Map();
    }

    async init() {}

    async update(entry: DirectoryEntry): Promise<void> {
        this._map.set(entry.key, entry);
    }

    async findByPublicIpAddress(ipAddress: string): Promise<DirectoryEntry[]> {
        let values = [...this._map.values()];
        return values.filter(v => v.publicIpAddress === ipAddress);
    }

    async findByHash(hash: string): Promise<DirectoryEntry> {
        return this._map.get(hash);
    }

    async getClientSettings(): Promise<DirectoryClientSettings> {
        return this._settings;
    }

    async saveClientSettings(settings: DirectoryClientSettings): Promise<void> {
        this._settings = settings;
    }
}
