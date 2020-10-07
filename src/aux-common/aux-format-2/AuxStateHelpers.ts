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
export function apply<T extends BotsState, U extends PartialBotsState>(
    state: T,
    update: U
): T {
    let updatedState = Object.assign({}, state);

    for (let id in update) {
        let botUpdate: Partial<Bot | PrecalculatedBot> = update[id];
        if (!botUpdate) {
            delete updatedState[id];
            continue;
        }

        let bot = updatedState[id] as Bot | PrecalculatedBot;
        if (!bot) {
            updatedState[id] = update[id] as any;
            continue;
        } else {
            bot = Object.assign({}, bot);
            updatedState[id] = bot as any;
        }

        if (botUpdate.tags) {
            bot.tags = Object.assign({}, bot.tags, botUpdate.tags);
        }
        if (botUpdate.signatures) {
            bot.signatures = Object.assign(
                {},
                bot.signatures,
                botUpdate.signatures
            );
        }
        if ('values' in botUpdate) {
            (<PrecalculatedBot>(<any>bot)).values = Object.assign(
                {},
                (<PrecalculatedBot>(<any>bot)).values,
                botUpdate.values
            );
        }
        if (botUpdate.masks) {
            bot.masks = Object.assign({}, bot.masks);
            for (let space in botUpdate.masks) {
                bot.masks[space] = Object.assign(
                    {},
                    bot.masks[space],
                    botUpdate.masks[space]
                );
            }
        }

        for (let tag in botUpdate.tags) {
            if (bot.tags[tag] === null) {
                delete bot.tags[tag];
                if ('values' in bot) {
                    delete bot.values[tag];
                }
            }
        }
        let copiedSignatures = false;
        for (let hash in botUpdate.signatures) {
            if (bot.signatures[hash] === null) {
                if (
                    bot.signatures === botUpdate.signatures &&
                    !copiedSignatures
                ) {
                    copiedSignatures = true;
                    bot.signatures = {
                        ...botUpdate.signatures,
                    };
                }
                delete bot.signatures[hash];
            }
        }
        if (!!bot.signatures && Object.keys(bot.signatures).length <= 0) {
            delete bot.signatures;
        }
        for (let space in botUpdate.masks) {
            for (let tag in botUpdate.masks[space]) {
                if (bot.masks[space][tag] === null) {
                    delete bot.masks[space][tag];
                }
            }
            if (Object.keys(bot.masks[space]).length <= 0) {
                delete bot.masks[space];
            }
        }
        if (!!bot.masks && Object.keys(bot.masks).length <= 0) {
            delete bot.masks;
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
            let updatedSignatures = new Set<string>();
            // bot was updated
            let updatedBot = {
                ...existingBot,
                tags: {
                    ...existingBot.tags,
                },
            };
            if (existingBot.signatures) {
                updatedBot.signatures = {
                    ...existingBot.signatures,
                };
            }
            if (existingBot.masks) {
                updatedBot.masks = {};
                for (let space in existingBot.masks) {
                    updatedBot.masks[space] = {
                        ...existingBot.masks[space],
                    };
                }
            }

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
            }
            if (botUpdate.signatures) {
                for (let tag in botUpdate.signatures) {
                    const value = botUpdate.signatures[tag];
                    if (value === null) {
                        if (!!updatedBot.signatures) {
                            delete updatedBot.signatures[tag];
                        }
                    } else {
                        if (!updatedBot.signatures) {
                            updatedBot.signatures = {};
                        }
                        updatedBot.signatures[tag] = value;
                    }
                    updatedSignatures.add(tag);
                }
                if (
                    !!updatedBot.signatures &&
                    Object.keys(updatedBot.signatures).length <= 0
                ) {
                    delete updatedBot.signatures;
                }
            }
            const updatedMasks = new Set<string>();
            if (botUpdate.masks) {
                for (let space in botUpdate.masks) {
                    const tags = botUpdate.masks[space];
                    for (let tag in tags) {
                        const value = tags[tag];
                        if (value === null) {
                            delete updatedBot.masks[space][tag];
                        } else {
                            if (!updatedBot.masks) {
                                updatedBot.masks = {};
                            }
                            if (!updatedBot.masks[space]) {
                                updatedBot.masks[space] = {};
                            }
                            updatedBot.masks[space][tag] = value;
                        }
                        updatedMasks.add(tag);
                    }
                }
            }
            if (updatedTags.size > 0 || updatedSignatures.size > 0) {
                if (updatedMasks.size > 0) {
                    updatedTags = new Set([
                        ...updatedTags.values(),
                        ...updatedMasks.values(),
                    ]);
                }
                result.updatedBots.push(
                    updatedSignatures.size <= 0
                        ? {
                              bot: updatedBot,
                              tags: updatedTags,
                          }
                        : {
                              bot: updatedBot,
                              tags: updatedTags,
                              signatures: updatedSignatures,
                          }
                );
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

    /**
     * The tags that had updated signatures.
     */
    signatures?: Set<string>;
}
