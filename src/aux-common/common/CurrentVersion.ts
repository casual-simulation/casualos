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

export interface CurrentVersion {
    /**
     * The ID of the local site.
     * Null if the local site does not have an ID.
     */
    currentSite: string | null;

    /**
     * The ID of the site that is used for "remote" edits.
     * That is, edits that were not made through the UI.
     */
    remoteSite: string | null;

    /**
     * The current version vector.
     */
    vector: VersionVector;
}

/**
 * Defines an interface that represents a map of site IDs to timestamps.
 */
export interface VersionVector {
    [site: string]: number;
}
