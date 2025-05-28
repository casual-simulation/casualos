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
export interface MemoryLockStore {
    /**
     * The locks that are currently being held.
     * * The key is the id of the lock and the value is the time at which the lock will be released
     * ! Implementation advice (private _locks map)
     * private _locks: Map<string, number> = new Map();
     */

    /**
     * Acquire a lock for/with the given id
     * @param id The id to acquire the lock for
     * @param timeout The amount of time to wait before the lock is released
     * @returns
     * If successful, returns a function that will release the lock when called.
     * If unsuccessful, returns null.
     */
    acquireLock(
        id: string,
        timeout: number
    ): Promise<() => Promise<boolean> | null>;
}
