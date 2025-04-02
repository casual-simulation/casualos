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
import z from 'zod';

export interface DirectoryUpdate {
    /**
     * The public human readable name of the directory entry.
     */
    publicName: string;

    /**
     * The key that can be used to uniquely identify the entry.
     */
    key: string;

    /**
     * The password that should be used to update the entry.
     * If the password doesn't match then the entry should not be allowed to update.
     */
    password: string;

    /**
     * The private IP Address that should be stored in the listing.
     */
    privateIpAddress: string;

    /**
     * The public IP Address should be stored in the listing.
     */
    publicIpAddress: string;
}

/**
 * The schema for a directory update.
 */
export const DirectoryUpdateSchema = z.object({
    publicName: z.string().min(1),
    key: z.string().min(1),
    password: z.string().min(1),
    privateIpAddress: z.string().min(1),
    publicIpAddress: z.string().min(1),
});
