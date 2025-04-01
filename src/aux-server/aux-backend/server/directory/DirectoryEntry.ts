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

export interface DirectoryEntry {
    /**
     * The public human readable name of the directory entry.
     */
    publicName: string;

    /**
     * The key that can be used to identify the entry.
     */
    key: string;

    /**
     * The bcrypt hash of the password that was used to create the entry.
     */
    passwordHash: string;

    /**
     * The Private IP Address for the entry.
     */
    privateIpAddress: string;

    /**
     * The Public IP Address for the entry.
     */
    publicIpAddress: string;

    /**
     * The unix timestamp that the entry was last updated on.
     */
    lastUpdateTime: number;

    /**
     * Whether the last webhook request succeeded.
     */
    webhookSucceeded?: boolean;
}
