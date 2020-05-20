import { BotsState, getUploadState } from '@casual-simulation/aux-common';

export type StoredAux = StoredAuxVersion1;

export interface StoredAuxVersion1 {
    version: 1;
    state: BotsState;
}

/**
 * Gets the bot state from the given stored causal tree.
 * @param stored The stored tree to load.
 */
export function getBotsStateFromStoredAux(stored: StoredAux) {
    return getUploadState(stored);
}
