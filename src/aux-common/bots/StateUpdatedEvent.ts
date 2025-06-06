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
import type {
    PrecalculatedBotsState,
    Bot,
    PartialPrecalculatedBotsState,
    PartialBot,
    UpdatedBot,
} from './Bot';
import { apply } from '../bots/AuxStateHelpers';
import { hasValue } from './BotCalculations';
import type { CurrentVersion } from '../common';

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

    /**
     * The version of this state.
     */
    version: CurrentVersion | null;
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
 * @param version The version of the state.
 */
export function stateUpdatedEvent(
    state: PartialPrecalculatedBotsState,
    version: CurrentVersion = null
): StateUpdatedEvent {
    let update = {
        addedBots: [],
        removedBots: [],
        updatedBots: [],
        state: state,
        version,
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

    if (partialBot.tags) {
        for (let tag in partialBot.tags) {
            tags.add(tag);
        }
    }

    if (partialBot.signatures) {
        for (let sig in partialBot.signatures) {
            if (!signatures) {
                signatures = [];
            }
            signatures.push(sig);
        }
    }

    if (partialBot.masks) {
        for (let space in partialBot.masks) {
            for (let tag in partialBot.masks[space]) {
                tags.add(tag);
            }
        }
    }

    if (signatures.length > 0) {
        return {
            bot: currentBot,
            tags: [...tags.values()],
            signatures,
        };
    } else {
        return {
            bot: currentBot,
            tags: [...tags.values()],
        };
    }
}
