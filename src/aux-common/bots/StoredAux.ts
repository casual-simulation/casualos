import { BotsState, getUploadState } from '@casual-simulation/aux-common';

export type StoredAux = StoredAuxVersion1;

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
 * Gets the bot state from the given stored causal tree.
 * @param stored The stored tree to load.
 */
export function getBotsStateFromStoredAux(stored: StoredAux) {
    return getUploadState(stored);
}
