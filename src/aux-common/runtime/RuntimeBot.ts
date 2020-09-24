import {
    BotSpace,
    BotTags,
    Bot,
    ScriptTags,
    PrecalculatedBot,
    BOT_SPACE_TAG,
    getBotSpace,
    createPrecalculatedBot,
    BotSignatures,
    BotTagMasks,
    getTag,
    getTagMaskSpaces,
    hasValue,
    DEFAULT_TAG_MASK_SPACE,
    TAG_MASK_SPACE_PRIORITIES_REVERSE,
    TAG_MASK_SPACE_PRIORITIES,
} from '../bots';
import {
    CompiledBot,
    CompiledBotListeners,
    CompiledBotListener,
} from './CompiledBot';

/**
 * Defines a symbol that is used to clear changes on a runtime bot.
 */
export const CLEAR_CHANGES_SYMBOL = Symbol('clear_changes');

/**
 * Defines a symbol that is used to set a tag mask on a runtime bot.
 */
export const SET_TAG_MASK_SYMBOL = Symbol('set_tag_mask');

/**
 * Defines a symbol that is used to get a tag mask on a runtime bot.
 */
export const GET_TAG_MASK_SYMBOL = Symbol('get_tag_mask');

/**
 * Defines a symbol that is used to get all the tag masks on a runtime bot.
 */
export const CLEAR_TAG_MASKS_SYMBOL = Symbol('clear_tag_masks');

/**
 * Defines an interface for a bot in a script/formula.
 *
 * The difference between this and Bot is that the tags
 * are calculated values and raw is the original tag values.
 *
 * i.e. tags will evaluate formulas while raw will return the formula scripts themselves.
 */
export interface RuntimeBot {
    id: string;
    space?: BotSpace;

    /**
     * The calculated tag values.
     * This lets you get the calculated values from formulas.
     */
    tags: ScriptTags;

    /**
     * The raw tag values. This lets you get the raw script text from formulas.
     */
    raw: BotTags;

    /**
     * The tag masks that have been applied to this bot.
     */
    masks: BotTags;

    /**
     * The changes that have been made to the bot.
     */
    changes: BotTags;

    /**
     * The tag mask changes that have been made to the bot.
     */
    maskChanges: BotTagMasks;

    /**
     * The signatures that are on the bot.
     */
    signatures: BotSignatures;

    /**
     * The calculated listener functions.
     * This lets you get the compiled listener functions.
     */
    listeners: CompiledBotListeners;

    /**
     * A function that can clear all the changes from the runtime bot.
     */
    [CLEAR_CHANGES_SYMBOL]: () => void;

    /**
     * A function that can set a tag mask on the bot.
     */
    [SET_TAG_MASK_SYMBOL]: (tag: string, value: any, space?: string) => void;

    /**
     * A function that can clear the tag masks from the bot.
     * @param space The space that the masks should be cleared from. If not specified then all tag masks in all spaces will be cleared.
     */
    [CLEAR_TAG_MASKS_SYMBOL]: (space?: string) => any;
}

/**
 * Defines an interface that contains runtime bots state.
 * That is, a map of bot IDs to the runtime bot instances.
 */
export interface RuntimeBotsState {
    [id: string]: RuntimeBot;
}

/**
 * Determines if the given bot is a runtime bot.
 * @param bot The bot to check.
 */
export function isRuntimeBot(bot: any): bot is RuntimeBot {
    if (!!bot && typeof bot === 'object') {
        return (
            !!bot.id &&
            typeof bot.tags === 'object' &&
            typeof bot.raw === 'object' &&
            typeof bot.masks === 'object' &&
            typeof bot.tags.toJSON === 'function' &&
            typeof bot.listeners === 'object' &&
            typeof bot.changes === 'object' &&
            typeof bot.maskChanges === 'object'
        );
    }
    return false;
}

/**
 * Flattens the given tag masks into a normal tags object.
 * Spaces are prioritized accoring to the TAG_MASK_SPACE_PRIORITIES_REVERSE list.
 * @param masks The masks to flatten.
 */
export function flattenTagMasks(masks: BotTagMasks): BotTags {
    let result = {} as BotTags;
    if (masks) {
        for (let space of TAG_MASK_SPACE_PRIORITIES_REVERSE) {
            if (!!masks[space]) {
                Object.assign(result, masks[space]);
            }
        }
    }
    return result;
}

/**
 * Constructs a new script bot for the given bot.
 * Script bots provide special behaviors by implemlementing getters and setters for tag values as well
 * as handling extra compatibility concerns like serialization.
 *
 * @param bot The bot.
 * @param manager The service that is able to track updates on a bot.
 * @param context The global context.
 */
export function createRuntimeBot(
    bot: CompiledBot,
    manager: RuntimeBotInterface
): RuntimeBot {
    if (!bot) {
        return null;
    }

    const constantTags = {
        id: bot.id,
        space: getBotSpace(bot),
    };
    let changedRawTags: BotTags = {};
    let rawTags: ScriptTags = <ScriptTags>{
        ...bot.tags,
    };
    let rawMasks: BotTags = flattenTagMasks(bot.masks || {});
    let changedMasks: BotTagMasks = {};
    const tagsProxy = new Proxy(rawTags, {
        get(target, key: string, proxy) {
            if (key === 'toJSON') {
                return Reflect.get(target, key, proxy);
            } else if (key in constantTags) {
                return constantTags[<keyof typeof constantTags>key];
            }

            return manager.getValue(bot, key);
        },
        set(target, key: string, value, receiver) {
            if (key in constantTags) {
                return true;
            }
            const mode = manager.updateTag(bot, key, value);
            if (mode === RealtimeEditMode.Immediate) {
                rawTags[key] = value;
                changedRawTags[key] = value;
            } else if (mode === RealtimeEditMode.Delayed) {
                changedRawTags[key] = value;
            }
            return true;
        },
        deleteProperty(target, key: string) {
            if (key in constantTags) {
                return true;
            }
            const value = null as any;
            const mode = manager.updateTag(bot, key, value);
            if (mode === RealtimeEditMode.Immediate) {
                rawTags[key] = value;
                changedRawTags[key] = value;
            } else if (mode === RealtimeEditMode.Delayed) {
                changedRawTags[key] = value;
            }
            return true;
        },
        ownKeys(target) {
            const keys = Object.keys(bot.values);
            return keys;
        },
        getOwnPropertyDescriptor(target, property) {
            if (property === 'toJSON') {
                return Reflect.getOwnPropertyDescriptor(target, property);
            }

            return Reflect.getOwnPropertyDescriptor(bot.values, property);
        },
    });
    const rawProxy = new Proxy(rawTags, {
        get(target, key: string, proxy) {
            if (key in constantTags) {
                return constantTags[<keyof typeof constantTags>key];
            }
            return manager.getRawValue(bot, key);
        },
        set(target, key: string, value, receiver) {
            if (key in constantTags) {
                return true;
            }
            const mode = manager.updateTag(bot, key, value);
            if (mode === RealtimeEditMode.Immediate) {
                rawTags[key] = value;
                changedRawTags[key] = value;
            } else if (mode === RealtimeEditMode.Delayed) {
                changedRawTags[key] = value;
            }
            return true;
        },
        deleteProperty(target, key: string) {
            if (key in constantTags) {
                return true;
            }
            const value = null as any;
            const mode = manager.updateTag(bot, key, value);
            if (mode === RealtimeEditMode.Immediate) {
                rawTags[key] = value;
                changedRawTags[key] = value;
            } else if (mode === RealtimeEditMode.Delayed) {
                changedRawTags[key] = value;
            }
            return true;
        },
        ownKeys(target) {
            const keys = Object.keys(bot.tags);
            return keys;
        },
        getOwnPropertyDescriptor(target, property) {
            if (property === 'toJSON') {
                return Reflect.getOwnPropertyDescriptor(target, property);
            }

            return Reflect.getOwnPropertyDescriptor(bot.tags, property);
        },
    });

    const listenersProxy = new Proxy(bot.listeners, {
        get(target, key: string, proxy) {
            if (key in constantTags) {
                return null;
            }
            return manager.getListener(bot, key);
        },
    });

    const signaturesProxy = new Proxy(bot.signatures || {}, {
        get(target, key: string, proxy) {
            if (key in constantTags) {
                return constantTags[<keyof typeof constantTags>key];
            }
            return manager.getSignature(bot, key);
        },
        set(target, key: string, proxy) {
            return true;
        },
        deleteProperty(target: any, key: any) {
            return true;
        },
    });
    const maskProxy = new Proxy(rawMasks, {
        get(target, key: string, proxy) {
            return manager.getTagMask(bot, key);
        },
        set(target, key: string, value, proxy) {
            if (key in constantTags) {
                return true;
            }
            const spaces = hasValue(value)
                ? [DEFAULT_TAG_MASK_SPACE]
                : getTagMaskSpaces(bot, key);
            const mode = manager.updateTagMask(bot, key, spaces, value);
            if (mode === RealtimeEditMode.Immediate) {
                rawMasks[key] = value;
            }
            changeTagMask(key, value, spaces);
            return true;
        },
        deleteProperty(target: any, key: string) {
            if (key in constantTags) {
                return true;
            }
            const spaces = getTagMaskSpaces(bot, key);
            const mode = manager.updateTagMask(bot, key, spaces, null);
            if (mode === RealtimeEditMode.Immediate) {
                delete rawMasks[key];
            }
            changeTagMask(key, null, spaces);
            return true;
        },
        ownKeys(target) {
            const keys = Object.keys(flattenTagMasks(bot.masks));
            return keys;
        },
        getOwnPropertyDescriptor(target, property) {
            if (property === 'toJSON') {
                return Reflect.getOwnPropertyDescriptor(target, property);
            }

            const flat = flattenTagMasks(bot.masks);
            return Reflect.getOwnPropertyDescriptor(flat, property);
        },
    });

    // Define a toJSON() function but
    // make it not enumerable so it is not included
    // in Object.keys() and for..in expressions.
    Object.defineProperty(tagsProxy, 'toJSON', {
        value: () => bot.tags,
        writable: false,
        enumerable: false,

        // This is so the function can be wrapped with another proxy
        // if needed. (Like for VM2Sandbox)
        configurable: true,
    });

    let script: RuntimeBot = {
        id: bot.id,
        tags: tagsProxy,
        raw: rawProxy,
        masks: maskProxy,
        changes: changedRawTags,
        maskChanges: changedMasks,
        listeners: listenersProxy,
        signatures: signaturesProxy,
        [CLEAR_CHANGES_SYMBOL]: null,
        [SET_TAG_MASK_SYMBOL]: null,
        [CLEAR_TAG_MASKS_SYMBOL]: null,
    };

    Object.defineProperty(script, CLEAR_CHANGES_SYMBOL, {
        value: () => {
            changedRawTags = {};
            changedMasks = {};
            script.changes = changedRawTags;
            script.maskChanges = changedMasks;
        },
        configurable: false,
        enumerable: false,
        writable: false,
    });

    Object.defineProperty(script, SET_TAG_MASK_SYMBOL, {
        value: (key: string, value: any, space: string) => {
            if (key in constantTags) {
                return true;
            }
            const spaces = !hasValue(space)
                ? hasValue(value)
                    ? [DEFAULT_TAG_MASK_SPACE]
                    : getTagMaskSpaces(bot, key)
                : [space];
            const mode = manager.updateTagMask(bot, key, spaces, value);
            if (mode === RealtimeEditMode.Immediate) {
                rawMasks[key] = value;
            }
            changeTagMask(key, value, spaces);
            return value;
        },
        configurable: false,
        enumerable: false,
        writable: false,
    });

    Object.defineProperty(script, CLEAR_TAG_MASKS_SYMBOL, {
        value: (space: string) => {
            if (bot.masks) {
                let spaces = hasValue(space)
                    ? [space]
                    : TAG_MASK_SPACE_PRIORITIES;
                for (let space of spaces) {
                    const tags = bot.masks[space];
                    for (let tag in tags) {
                        script[SET_TAG_MASK_SYMBOL](tag, null, space);
                    }
                }
            }
        },
        configurable: false,
        enumerable: false,
        writable: false,
    });

    Object.defineProperty(script, 'toJSON', {
        value: () => {
            if ('space' in bot) {
                return {
                    id: bot.id,
                    space: bot.space,
                    tags: tagsProxy,
                };
            } else {
                return {
                    id: bot.id,
                    tags: tagsProxy,
                };
            }
        },
        writable: false,
        enumerable: false,

        // This is so the function can be wrapped with another proxy
        // if needed. (Like for VM2Sandbox)
        configurable: true,
    });

    if (BOT_SPACE_TAG in bot) {
        script.space = bot.space;
    }

    return script;

    function changeTagMask(tag: string, value: string, spaces: string[]) {
        for (let space of spaces) {
            if (!changedMasks[space]) {
                changedMasks[space] = {};
            }
            changedMasks[space][tag] = value;
        }
    }
}

/**
 * Defines an interface for an object that provides the API that script bots use for housekeeping.
 * T is the type of bots that the generated script bots are representing.
 */
export interface RuntimeBotInterface extends RuntimeBatcher {
    /**
     * Updates the tag of the given bot.
     * Returns the realtime edit mode that should be used for this particular assignment.
     * @param bot The bot.
     * @param tag The tag that should be updated.
     * @param newValue The new tag value.
     */
    updateTag(bot: CompiledBot, tag: string, newValue: any): RealtimeEditMode;

    /**
     * Updates the tag mask of the given bot.
     * @param bot The bot.
     * @param tag The tag that should be updated.
     * @param space The spaces that the tag mask should be applied in.
     * @param value The new tag value. If null, then the mask will be deleted.
     */
    updateTagMask(
        bot: CompiledBot,
        tag: string,
        spaces: string[],
        value: any
    ): RealtimeEditMode;

    /**
     * Gets the value for the given tag on the given bot.
     * @param bot The bot.
     * @param tag The tag.
     */
    getValue(bot: CompiledBot, tag: string): any;

    /**
     * Gets the raw value for the given tag on the given bot.
     * @param bot The bot.
     * @param tag The tag.
     */
    getRawValue(bot: CompiledBot, tag: string): any;

    /**
     * Gets the raw tag mask value for the given tag.
     * @param bot The bot.
     * @param tag The tag.
     * @param space The space.
     */
    getTagMask(bot: CompiledBot, tag: string): RealtimeEditMode;

    /**
     * Gets the listener for the given bot and tag, resolving any formulas that may be present.
     * Returns null if no listener is available.
     * @param bot The bot.
     * @param tag The tag.
     */
    getListener(bot: CompiledBot, tag: string): CompiledBotListener;

    /**
     * Gets whether the given signature on the bot is valid.
     * @param bot The bot.
     * @param signature The tag.
     */
    getSignature(bot: CompiledBot, signature: string): string;
}

/**
 * Defines an interface for an object that is able to manage the creation and destruction of script bots in the runtime.
 */
export interface RuntimeBotFactory {
    /**
     * Creates a new script bot from the given bot and adds it to the runtime.
     *
     * Returns null if a runtime bot could not be created for the given bot.
     * This can happen when a bot is being created in a space that doesn't support immediate realtime edits.
     *
     * @param bot The bot.
     */
    createRuntimeBot(bot: Bot): RuntimeBot;

    /**
     * Destroyes the given script bot and removes it from the runtime.
     * Returns the realtime edit mode that should apply for this operation.
     *
     * @param bot The bot.
     */
    destroyScriptBot(bot: RuntimeBot): RealtimeEditMode;
}

/**
 * Defines an interface for an object that is able to batch script results.
 */
export interface RuntimeBatcher {
    /**
     * Notifies the batcher that a change has happened and that it should schedule
     * a handler to grab the changes and apply them.
     */
    notifyChange(): void;
}

/**
 * The list of possible realtime edit modes.
 */
export enum RealtimeEditMode {
    /**
     * Specifies that bots in this edit mode cannot be edited.
     */
    None = 0,

    /**
     * Specifies that all changes to the bot will be accepted.
     * This allows the changes to be immediately used.
     */
    Immediate = 1,

    /**
     * Specifies that some changes to the bot may be rejected.
     * This requires that changes be delayed until the related
     * partition accepts/denies them.
     */
    Delayed = 2,
}
