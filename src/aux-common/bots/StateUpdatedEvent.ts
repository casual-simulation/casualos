import omitBy from 'lodash/omitBy';
import {
    PrecalculatedBotsState,
    Bot,
    PartialPrecalculatedBotsState,
} from './Bot';
import { merge } from '../utils';
import { apply } from '../aux-format-2/AuxStateHelpers';
import { hasValue } from './BotCalculations';

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
    state: PartialPrecalculatedBotsState;

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
        return apply(currentState, update.state);
    } else {
        return update.state as PrecalculatedBotsState;
    }
}

/**
 * Calculates the StateUpdatedEvent from the given partial bots state.
 * @param state The state update.
 */
export function stateUpdatedEvent(
    state: PartialPrecalculatedBotsState
): StateUpdatedEvent {
    let update = {
        addedBots: [],
        removedBots: [],
        updatedBots: [],
        state: state,
    } as StateUpdatedEvent;

    for (let id in state) {
        const bot = state[id];
        if (bot === null) {
            update.removedBots.push(id);
        } else if (!hasValue(bot)) {
            // Do nothing for this bot.
            // Incorrectly formatted state.
        } else if (bot.id === id) {
            update.addedBots.push(bot.id);
        } else {
            update.updatedBots.push(id);
        }
    }

    return update;
}
