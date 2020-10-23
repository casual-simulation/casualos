import {
    BotsState,
    PartialBotsState,
    Bot,
    PrecalculatedBotsState,
    PartialPrecalculatedBotsState,
    PrecalculatedBot,
} from '../bots/Bot';
import { merge, splice } from '../utils';
import { hasValue, isBot } from '../bots/BotCalculations';
import { sortBy } from 'lodash';
import { VersionVector } from '@casual-simulation/causal-trees';

/**
 * The name of the property that indicates an object represents a tag edit.
 * Uses the Device Control One control character (UTF code 11) at the beginning to help prevent conflicts with normal property names.
 * Normally, we would use a Symbol, but symbols are not supported via structure clone which means that we have to use a normal property.
 */
export const TAG_EDIT_NAME = '\u0011tag_edit';

/**
 * Creates a tag edit using the given list of operations.
 */
export function edit(
    version: VersionVector,
    ...operations: TagEditOp[]
): TagEdit {
    return {
        [TAG_EDIT_NAME]: true,
        version,
        operations: [operations],
    };
}

/**
 * Creates a tag edit using the given list of operations.
 */
export function edits(
    version: VersionVector,
    ...operations: TagEditOp[][]
): TagEdit {
    return {
        [TAG_EDIT_NAME]: true,
        version,
        operations,
    };
}

/**
 * Creates a new tag edit using the operations from both of the given edits.
 * @param first The first edit.
 * @param second The second edit.
 */
export function mergeEdits(first: TagEdit, second: TagEdit): TagEdit {
    return edits(
        mergeVersions(first.version, second.version),
        ...first.operations,
        ...second.operations
    );
}

/**
 * Creates a preserve operation that keeps the given number of characters.
 * @param count The number of characters to preserve.
 */
export function preserve(count: number): TagPreserveOp {
    return {
        type: 'preserve',
        count,
    };
}

/**
 * Creates a insert operation that inserts the given text.
 * @param text The text to insert.
 */
export function insert(text: string): TagInsertOp {
    return {
        type: 'insert',
        text,
    };
}

/**
 * Creates a delete operation that deletes the text between the given start and end indexes.
 * @param count The number of characters to delete.
 */
export function del(count: number): TagDeleteOp {
    return {
        type: 'delete',
        count,
    };
}

/**
 * Determines if the given value is a tag edit.
 * @param value The value to check.
 */
export function isTagEdit(value: any): value is TagEdit {
    return typeof value === 'object' && value && value[TAG_EDIT_NAME] === true;
}

/**
 * Merges the two version vectors, taking the latest timestamp from each.
 * @param first The first.
 * @param second The second.
 */
export function mergeVersions(
    first: VersionVector,
    second: VersionVector
): VersionVector {
    let final = {
        ...first,
    };
    for (let site in second) {
        final[site] = Math.max(final[site] || 0, second[site] || 0);
    }

    return final;
}

/**
 * Defines an interface that represents a tag edit.
 */
export interface TagEdit {
    [TAG_EDIT_NAME]: boolean;

    /**
     * The timestamp that the edit should be made at.
     */
    version: VersionVector;

    /**
     * The operations that are part of the edit.
     */
    operations: TagEditOp[][];
}

export type TagEditOp = TagPreserveOp | TagInsertOp | TagDeleteOp;

/**
 * A tag edit that represents the act of not changing some text in a tag's value.
 */
export interface TagPreserveOp {
    type: 'preserve';

    /**
     * The number of characters to preserve.
     */
    count: number;
}

/**
 * A tag edit that represents inserting some text into a tag's value.
 */
export interface TagInsertOp {
    type: 'insert';

    /**
     * The text that should be inserted.
     */
    text: string;
}

/**
 * A tag edit operation that represents deleting some text from a tag's value.
 */
export interface TagDeleteOp {
    type: 'delete';

    /**
     * The number of characters to delete.
     */
    count: number;
}

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
            bot = Object.assign({}, update[id]) as any;
            updatedState[id] = bot as any;
        } else {
            bot = Object.assign({}, bot);
            updatedState[id] = bot as any;
        }

        if (botUpdate.tags) {
            bot.tags = {
                ...bot.tags,
            };
            for (let tag in botUpdate.tags) {
                let val = botUpdate.tags[tag];
                if (isTagEdit(val)) {
                    bot.tags[tag] = applyEdit(bot.tags[tag], val);
                } else {
                    bot.tags[tag] = val;
                }
            }
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
                bot.masks[space] = Object.assign({}, bot.masks[space]);

                const tags = botUpdate.masks[space];
                for (let tag in tags) {
                    let val = tags[tag];
                    if (isTagEdit(val)) {
                        bot.masks[space][tag] = applyEdit(
                            bot.masks[space][tag],
                            val
                        );
                    } else {
                        bot.masks[space][tag] = val;
                    }
                }
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
 * Applies the tag edit to the given value and returns the result.
 * @param value The value.
 * @param edit The edit that should be applied.
 */
export function applyEdit(value: any, edit: TagEdit): any {
    if (!hasValue(value)) {
        value = '';
    }
    if (typeof value === 'string') {
        for (let ops of edit.operations) {
            let index = 0;
            for (let op of ops) {
                if (op.type === 'preserve') {
                    index += op.count;
                } else if (op.type === 'insert') {
                    value = splice(value, index, 0, op.text);
                    index += op.text.length;
                } else {
                    value = splice(value, index, op.count, '');
                }
            }
        }
    }
    return value;
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
