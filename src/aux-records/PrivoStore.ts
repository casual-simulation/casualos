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

export interface PrivoStore {
    /**
     * Gets the stored privo credentials.
     * Returns the stored credentials or null if there are none stored credentials.
     */
    getStoredCredentials(): Promise<PrivoClientCredentials | null>;

    /**
     * Saves the given credentials.
     * @param credentials The credentials to save.
     */
    saveCredentials(credentials: PrivoClientCredentials): Promise<void>;
}

export interface PrivoClientCredentials {
    /**
     * The ID of these credentials in the database.
     */
    id: string;

    /**
     * The unix time in seconds that these credentials expire at.
     */
    expiresAtSeconds: number;

    /**
     * The access token.
     */
    accessToken: string;

    /**
     * The refresh token.
     */
    refreshToken: string | null | undefined;

    /**
     * The scope that was granted.
     */
    scope: string;
}
