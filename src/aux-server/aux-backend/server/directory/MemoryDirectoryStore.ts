/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type { DirectoryStore } from './DirectoryStore';
import type { DirectoryEntry } from './DirectoryEntry';
import type { DirectoryClientSettings } from './DirectoryClientSettings';

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
        return values.filter((v) => v.publicIpAddress === ipAddress);
    }

    async findByHash(hash: string): Promise<DirectoryEntry> {
        return this._map.get(hash) as DirectoryEntry;
    }

    async getClientSettings(): Promise<DirectoryClientSettings> {
        return this._settings;
    }

    async saveClientSettings(settings: DirectoryClientSettings): Promise<void> {
        this._settings = settings;
    }
}
