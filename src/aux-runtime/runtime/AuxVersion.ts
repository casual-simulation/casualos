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

export interface AuxVersion {
    /**
     * The commit of the hash that AUX was built from.
     */
    hash: string;

    /**
     * The full version number.
     */
    version: string;

    /**
     * The major portion of the version.
     */
    major: number;

    /**
     * The minor portion of the version.
     */
    minor: number;

    /**
     * The patch portion of the version.
     */
    patch: number;

    /**
     * Whether this version is an alpha (i.e. test) version.
     */
    alpha: boolean | number;

    /**
     * Gets the player mode of this CasualOS version.
     *
     * - "player" indicates that the instance has been configured for experiencing AUXes.
     * - "builder" indicates that the instance has been configured for building AUXes.
     */
    playerMode: 'player' | 'builder';
}
