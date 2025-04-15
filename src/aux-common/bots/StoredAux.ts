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
import { getStateFromUpdates } from '../partitions/PartitionUtils';
import type { BotsState } from './Bot';
import { getInstStateFromUpdates } from './BotEvents';

export type StoredAux = StoredAuxVersion1 | StoredAuxVersion2;

export interface StoredAuxVersion1 {
    version: 1;
    state: BotsState;
}

export interface StoredAuxVersion2 {
    version: 2;
    updates: InstUpdate[];
}

/**
 * Defines an interface that represents an update that has been applied to an inst.
 * @dochash types/os/spaces
 * @docname InstUpdate
 */
export interface InstUpdate {
    /**
     * The ID of the update.
     */
    id: number;

    /**
     * The update content.
     */
    update: string;

    /**
     * The time that the update occurred at.
     */
    timestamp: number;
}

/**
 * Gets whether the given stored aux matches the given version.
 * @param stored
 * @param version
 * @returns
 */
export function isStoredVersion2(stored: unknown): stored is StoredAuxVersion2 {
    return (
        typeof stored === 'object' &&
        stored &&
        'version' in stored &&
        (stored as any).version === 2
    );
}

/**
 * Gets whether the given stored aux matches the given version.
 * @param stored
 * @param version
 * @returns
 */
export function isStoredVersion1(stored: unknown): stored is StoredAuxVersion1 {
    return (
        typeof stored === 'object' &&
        stored &&
        'version' in stored &&
        (stored as any).version === 1
    );
}

/**
 * Gets the bot state from the given stored causal tree.
 * @param stored The stored tree to load.
 */
export function getBotsStateFromStoredAux(stored: StoredAux): BotsState {
    return getUploadState(stored);
}

/**
 * Gets the state that should be uploaded from the given data.
 * @param data The data.
 */
export function getUploadState(data: StoredAux | BotsState): BotsState {
    if ('version' in data) {
        if (isStoredVersion2(data)) {
            return getStateFromUpdates(getInstStateFromUpdates(data.updates));
        } else if (isStoredVersion1(data)) {
            return data.state;
        }
    }
    return data;
}
