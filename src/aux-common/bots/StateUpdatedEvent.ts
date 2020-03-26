import omitBy from 'lodash/omitBy';
import { PrecalculatedBotsState, Bot } from './Bot';
import { merge } from '../utils';

/**
 * Defines an event for state updates from the VM.
 */
export interface StateUpdatedEvent {
    /**
     * The state that was updated. This is a partial precalculated bots state instance,
     * so it must be merged with the previous version to get the full updated bot state.
     *
     * You can use the merge() function from aux-common or lodash to do this.
     */
    state: Partial<PrecalculatedBotsState>;

    /**
     * The list of Bot IDs that were added.
     */
    addedBots: string[];

    /**
     * The list of Bot IDs that were removed.
     */
    removedBots: string[];

    /**
     * The list of Bot IDs that were updated.
     */
    updatedBots: string[];
}

/**
 * Applies the given update to the given state and returns a new object representing the final state.
 * @param currentState The current state.
 * @param update The update to apply.
 */
export function applyUpdates(
    currentState: PrecalculatedBotsState,
    update: StateUpdatedEvent
): PrecalculatedBotsState {
    if (currentState) {
        let updatedState = omitBy(
            merge(currentState, update.state),
            val => val === null
        );

        for (let id in update.state) {
            let botUpdate: Partial<Bot> = update.state[id];
            if (!botUpdate) {
                continue;
            }
            let bot = updatedState[id];
            for (let tag in botUpdate.tags) {
                if (bot.tags[tag] === null) {
                    delete bot.tags[tag];
                    delete bot.values[tag];
                }
            }
        }

        return updatedState;
    } else {
        return update.state;
    }
}
