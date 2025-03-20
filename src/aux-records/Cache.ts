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

export interface Cache {
    /**
     * Stores the given data in the cache.
     * @param key The key to store the data under.
     * @param data The data to store.
     * @param expireSeconds The number of seconds after which the data should expire.
     */
    store<T>(key: string, data: T, expireSeconds: number): Promise<void>;

    /**
     * Retrieves the data stored under the given key.
     * @param key The key to retrieve the data for.
     * @returns The data stored under the given key, or undefined if no data was found.
     */
    retrieve<T>(key: string): Promise<T>;

    /**
     * Removes the data stored under the given key.
     * @param key The key to remove the data for.
     */
    remove(key: string): Promise<void>;
}

/**
 * Defines an interface for services that can construct caches.
 */
export interface MultiCache {
    /**
     * Creates a new cache with the given key.
     * @param key The key of the cache.
     */
    getCache(key: string): Cache;
}
