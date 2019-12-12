import {
    BotsState,
    getBotsStateFromStoredTree,
} from '@casual-simulation/aux-common';
import { StoredCausalTree } from '@casual-simulation/causal-trees';

export type StoredAux = StoredCausalTree<any> | StoredAuxVersion1;

export interface StoredAuxVersion1 {
    version: 1;
    state: BotsState;
}

/**
 * Gets the bot state from the given stored causal tree.
 * @param stored The stored tree to load.
 */
export async function getBotsStateFromStoredAux(stored: StoredAux) {
    if ('version' in stored) {
        return stored.state;
    } else {
        return await getBotsStateFromStoredTree(stored);
    }
}
