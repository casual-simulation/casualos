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
import type { DirectoryEntry } from './DirectoryEntry';
import type { DirectoryClientSettings } from './DirectoryClientSettings';

/**
 * Defines a store for directory values.
 */
export interface DirectoryStore {
    init(): Promise<void>;

    /**
     * Updates the given entry in the database.
     * @param entry The entry.
     */
    update(entry: DirectoryEntry): Promise<void>;

    /**
     * Finds all of the entries that are at the given IP address.
     * @param ipAddress The IP Address.
     */
    findByPublicIpAddress(ipAddress: string): Promise<DirectoryEntry[]>;

    /**
     * Finds the entry with the given hash.
     * @param hash The hash.
     */
    findByHash(hash: string): Promise<DirectoryEntry>;

    /**
     * Gets the settings for the client.
     * Returns null if no settings have been saved.
     */
    getClientSettings(): Promise<DirectoryClientSettings>;

    /**
     * Saves the given settings.
     * @param settings The settings.
     */
    saveClientSettings(settings: DirectoryClientSettings): Promise<void>;
}
