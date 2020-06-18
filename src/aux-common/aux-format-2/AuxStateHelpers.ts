import {
    BotsState,
    PartialBotsState,
    Bot,
    PrecalculatedBotsState,
    PartialPrecalculatedBotsState,
    PrecalculatedBot,
} from '../bots/Bot';
import { merge } from '../utils';
import { isBot } from '../bots/BotCalculations';

/**
 * Applies the given update to the current state and returns the final result.
 * @param state The state.
 * @param update The update.
 */
export function apply(
    state: BotsState | PrecalculatedBotsState,
    update: PartialBotsState | PartialPrecalculatedBotsState
): BotsState {
    let updatedState = merge(state, update);

    for (let id in update) {
        let botUpdate: Partial<Bot> = update[id];
        if (!botUpdate) {
            delete updatedState[id];
            continue;
        }
        let bot = updatedState[id] as Bot | PrecalculatedBot;
        for (let tag in botUpdate.tags) {
            if (bot.tags[tag] === null) {
                delete bot.tags[tag];
                if ('values' in bot) {
                    delete bot.values[tag];
                }
            }
        }
    }

    return updatedState;
}

/**
 * Calculates the individual bot updates that are contained in the given update.
 * @param state The state.
 * @param update The update.
 */
export function updates(
    state: BotsState,
    update: PartialBotsState | PartialPrecalculatedBotsState
) {
    let result: BotStateUpdates = {
        addedBots: [],
        removedBots: [],
        updatedBots: [],
    };

    for (let id in update) {
        let botUpdate = update[id];
        let existingBot = state[id];
        if (!existingBot) {
            // bot was added
            if (isBot(botUpdate)) {
                result.addedBots.push(botUpdate);
            }
        } else if (!botUpdate) {
            // bot was removed
            result.removedBots.push(existingBot.id);
        } else {
            let updatedTags = new Set<string>();
            // bot was updated
            let updatedBot = {
                ...existingBot,
                tags: {
                    ...existingBot.tags,
                },
            };

            if (botUpdate.tags) {
                for (let tag in botUpdate.tags) {
                    const value = botUpdate.tags[tag];
                    if (value === null) {
                        delete updatedBot.tags[tag];
                    } else {
                        updatedBot.tags[tag] = value;
                    }
                    updatedTags.add(tag);
                }

                if (updatedTags.size > 0) {
                    result.updatedBots.push({
                        bot: updatedBot,
                        tags: updatedTags,
                    });
                }
            }
        }
    }

    return result;
}

/**
 * Defines an interface that contains a list of bot that were added, removed, and updated.
 */
export interface BotStateUpdates {
    addedBots: Bot[];
    removedBots: string[];
    updatedBots: UpdatedBot[];
}

/**
 * Defines an interface for a bot that was updated.
 */
export interface UpdatedBot {
    /**
     * The updated bot.
     */
    bot: Bot;

    /**
     * The tags that were updated on the bot.
     */
    tags: Set<string>;
}
