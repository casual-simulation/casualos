import {
    BotsState,
    PartialBotsState,
    Bot,
    PrecalculatedBot,
} from '../bots/Bot';
import { splice } from '../utils';
import { hasValue, convertToString } from '../bots/BotCalculations';
import { VersionVector } from '../common';

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
export function remoteEdit(
    version: VersionVector,
    ...operations: TagEditOp[]
): TagEdit {
    const e = edit(version, ...operations);
    e.isRemote = true;
    return e;
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
 * Creates a tag edit using the given list of operations.
 */
export function remoteEdits(
    version: VersionVector,
    ...operations: TagEditOp[][]
): TagEdit {
    const e = edits(version, ...operations);
    e.isRemote = true;
    return e;
}

/**
 * Creates a new tag edit using the operations from both of the given edits.
 * @param first The first edit.
 * @param second The second edit.
 */
export function mergeEdits(first: TagEdit, second: TagEdit): TagEdit {
    const result = edits(
        mergeVersions(first.version, second.version),
        ...first.operations,
        ...second.operations
    );

    if (first.isRemote || second.isRemote) {
        result.isRemote = true;
    }

    return result;
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
     * Whether the edit should be considered a "remote" edit.
     * Remote edits should be processed by partitions as a separate site ID from the
     * local partition site ID.
     * This is useful for edits that were not made through the UI.
     */
    isRemote?: boolean;

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
        let isNewBot = !(id in state);
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
                    bot.tags[tag] = applyTagEdit(
                        isNewBot ? '' : bot.tags[tag],
                        val
                    );
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
                        bot.masks[space][tag] = applyTagEdit(
                            isNewBot ? '' : bot.masks[space][tag],
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
 * Applies the given tag edit to the given value and returns a value suitable for use in a tag.
 * i.e. This converts empty strings to null.
 * @param value The value to edit.
 * @param edit The edit to apply.
 * @returns
 */
export function applyTagEdit(value: any, edit: TagEdit): any {
    value = applyEdit(value, edit);
    if (hasValue(value)) {
        return value;
    }
    return null;
}

/**
 * Applies the edit to the given value and returns the result.
 * Unlike applyTagEdit(), this function only edits the value and returns the result.
 * As a result,
 * @param value The value.
 * @param edit The edit that should be applied.
 */
export function applyEdit(value: any, edit: TagEdit): any {
    value = convertToString(value);
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
    return value;
}
