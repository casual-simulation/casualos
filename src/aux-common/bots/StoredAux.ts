import { getStateFromUpdates } from 'partitions/PartitionUtils';
import { BotsState } from './Bot';
import { getInstStateFromUpdates } from './BotEvents';

export type StoredAux = StoredAuxVersion1 | StoredAuxVersion2;

export interface StoredAuxVersion1 {
    version: 1;
    state: BotsState;
}

export interface StoredAuxVersion2 {
    version: 2;
    update: InstUpdate;
}

/**
 * Defines an interface that represents an update that has been applied to an inst.
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
export function isStoredVersion2(
    stored: StoredAux
): stored is StoredAuxVersion2 {
    return stored && stored.version === 2;
}

/**
 * Gets the bot state from the given stored causal tree.
 * @param stored The stored tree to load.
 */
export function getBotsStateFromStoredAux(stored: StoredAuxVersion1) {
    return getUploadState(stored);
}

/**
 * Gets the state that should be uploaded from the given data.
 * @param data The data.
 */
export function getUploadState(data: StoredAux): BotsState {
    if ('version' in data) {
        if (isStoredVersion2(data)) {
            return getStateFromUpdates(getInstStateFromUpdates([data.update]));
        } else {
            return data.state;
        }
    }
    return data;
}
