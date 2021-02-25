import {
    PrecalculatedBotsState,
    Bot,
    PartialPrecalculatedBotsState,
    PartialBot,
    UpdatedBot,
} from './Bot';
import { merge } from '../utils';
import { apply } from '../aux-format-2/AuxStateHelpers';
import { hasValue } from './BotCalculations';
import { cloneDeep } from 'lodash';

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

export function updatedBot(
    partialBot: PartialBot,
    currentBot: Bot
): UpdatedBot {
    let tags = new Set<string>();
    let signatures = [] as string[];
    const bot = cloneDeep(currentBot);

    if (partialBot.tags) {
        for (let tag in partialBot.tags) {
            const val = partialBot.tags[tag];
            bot.tags[tag] = val;
            tags.add(tag);
        }
    }

    if (partialBot.signatures) {
        for (let sig in partialBot.signatures) {
            if (!signatures) {
                signatures = [];
            }
            if (!bot.signatures) {
                bot.signatures = {};
            }
            const val = partialBot.signatures[sig];
            if (hasValue(val)) {
                bot.signatures[sig] = val;
            } else {
                delete bot.signatures[sig];
            }
            signatures.push(sig);
        }
    }

    if (partialBot.masks) {
        for (let space in partialBot.masks) {
            for (let tag in partialBot.masks[space]) {
                tags.add(tag);
                if (!bot.masks) {
                    bot.masks = {};
                }
                if (!bot.masks[space]) {
                    bot.masks[space] = {};
                }
                const val = partialBot.masks[space][tag];
                if (hasValue(val)) {
                    bot.masks[space][tag] = val;
                } else {
                    delete bot.masks[space][tag];
                }
            }
        }
    }

    if (signatures.length > 0) {
        return {
            bot,
            tags: [...tags.values()],
            signatures,
        };
    } else {
        return {
            bot,
            tags: [...tags.values()],
        };
    }
}
