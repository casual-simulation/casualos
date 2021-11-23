import { upperFirst } from 'lodash';
import {
    applyTagEdit,
    edit,
    isTagEdit,
    mergeEdits,
    remoteEdit,
    TagEditOp,
} from '../aux-format-2';
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
    RuntimeBot,
    CLEAR_CHANGES_SYMBOL,
    SET_TAG_MASK_SYMBOL,
    CLEAR_TAG_MASKS_SYMBOL,
    CompiledBotListener,
    EDIT_TAG_SYMBOL,
    EDIT_TAG_MASK_SYMBOL,
    getOriginalObject,
    GET_TAG_MASKS_SYMBOL,
} from '../bots';
import { ORIGINAL_OBJECT } from '../bots/BotCalculations';
import { CompiledBot } from './CompiledBot';
import { RuntimeStateVersion } from './RuntimeStateVersion';

/**
 * Defines an interface that contains runtime bots state.
 * That is, a map of bot IDs to the runtime bot instances.
 */
export interface RuntimeBotsState {
    [id: string]: RuntimeBot;
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

    const arrayModifyMethods = new Set([
        'push',
        'shift',
        'unshift',
        'pop',
        'splice',
        'fill',
        'sort',
    ]);
    // const arrayModifyProperties = new Set(['length']);

    const wrapValue = (tag: string, value: any) => {
        if (Array.isArray(value)) {
            const isTagValue = () => value === manager.getRawValue(bot, tag);
            const isMaskValue = () => value === manager.getTagMask(bot, tag);
            const proxy = new Proxy(value, {
                get(target, key: string, proxy) {
                    if (arrayModifyMethods.has(key)) {
                        const func: Function = Reflect.get(target, key, proxy);
                        return function () {
                            const ret = func.apply(this, arguments);
                            if (isMaskValue()) {
                                updateTagMask(tag, value);
                            }
                            if (isTagValue()) {
                                updateTag(tag, value);
                            }
                            return ret;
                        };
                    }

                    return Reflect.get(target, key, proxy);
                },
                set(target, key: string, proxy) {
                    const ret = Reflect.set(target, key, proxy);
                    // if (arrayModifyProperties.has(key)) {
                    if (isMaskValue()) {
                        updateTagMask(tag, value);
                    }
                    if (isTagValue()) {
                        updateTag(tag, value);
                    }
                    // }
                    return ret;
                },
            });

            Object.defineProperty(proxy, ORIGINAL_OBJECT, {
                configurable: true,
                enumerable: false,
                writable: false,
                value: value,
            });

            return proxy;
        }
        return value;
    };

    const tagsProxy = new Proxy(rawTags, {
        get(target, key: string, proxy) {
            if (key === 'toJSON') {
                return Reflect.get(target, key, proxy);
            } else if (key in constantTags) {
                return constantTags[<keyof typeof constantTags>key];
            }

            return wrapValue(key, manager.getValue(bot, key));
        },
        set(target, key: string, value, receiver) {
            if (key in constantTags) {
                return true;
            }
            updateTag(key, getOriginalObject(value));
            // const mode = manager.updateTag(bot, key, value);
            // if (mode === RealtimeEditMode.Immediate) {
            //     rawTags[key] = value;
            //     changeTag(key, value);
            // } else if (mode === RealtimeEditMode.Delayed) {
            //     changeTag(key, value);
            // }
            return true;
        },
        deleteProperty(target, key: string) {
            if (key in constantTags) {
                return true;
            }
            const value = null as any;
            updateTag(key, value);
            // const mode = manager.updateTag(bot, key, value);
            // if (mode === RealtimeEditMode.Immediate) {
            //     rawTags[key] = value;
            //     changeTag(key, value);
            // } else if (mode === RealtimeEditMode.Delayed) {
            //     changeTag(key, value);
            // }
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
            updateTag(key, getOriginalObject(value));
            // const mode = manager.updateTag(bot, key, value);
            // if (mode === RealtimeEditMode.Immediate) {
            //     rawTags[key] = value;
            //     changeTag(key, value);
            // } else if (mode === RealtimeEditMode.Delayed) {
            //     changeTag(key, value);
            // }
            return true;
        },
        deleteProperty(target, key: string) {
            if (key in constantTags) {
                return true;
            }
            const value = null as any;
            updateTag(key, value);
            // const mode = manager.updateTag(bot, key, value);
            // if (mode === RealtimeEditMode.Immediate) {
            //     rawTags[key] = value;
            //     changeTag(key, value);
            // } else if (mode === RealtimeEditMode.Delayed) {
            //     changeTag(key, value);
            // }
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
            return wrapValue(key, manager.getTagMask(bot, key));
        },
        set(target, key: string, value, proxy) {
            if (key in constantTags) {
                return true;
            }
            updateTagMask(key, getOriginalObject(value));
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
        [GET_TAG_MASKS_SYMBOL]: null,
        [CLEAR_TAG_MASKS_SYMBOL]: null,
        [EDIT_TAG_SYMBOL]: null,
        [EDIT_TAG_MASK_SYMBOL]: null,
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
            const valueToSet = getOriginalObject(value);
            const mode = manager.updateTagMask(bot, key, spaces, valueToSet);
            if (mode === RealtimeEditMode.Immediate) {
                rawMasks[key] = valueToSet;
            }
            changeTagMask(key, valueToSet, spaces);
            return value;
        },
        configurable: false,
        enumerable: false,
        writable: false,
    });

    Object.defineProperty(script, GET_TAG_MASKS_SYMBOL, {
        value: () => {
            let masks = {} as BotTagMasks;
            if (bot.masks) {
                for (let space in bot.masks) {
                    let spaceMasks = {} as BotTags;
                    let hasSpaceMasks = false;
                    const botMasks = bot.masks[space];
                    for (let tag in botMasks) {
                        const val = botMasks[tag];
                        if (hasValue(val)) {
                            hasSpaceMasks = true;
                            spaceMasks[tag] = val;
                        }
                    }

                    if (hasSpaceMasks) {
                        masks[space] = spaceMasks;
                    }
                }
            }
            return masks;
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

    Object.defineProperty(script, EDIT_TAG_SYMBOL, {
        value: (tag: string, ops: TagEditOp[]) => {
            if (tag in constantTags) {
                return;
            }
            const e = remoteEdit(manager.currentVersion.vector, ...ops);
            script.tags[tag] = e;
        },
        configurable: false,
        enumerable: false,
        writable: false,
    });

    Object.defineProperty(script, EDIT_TAG_MASK_SYMBOL, {
        value: (tag: string, ops: TagEditOp[], space?: string) => {
            if (tag in constantTags) {
                return;
            }
            const e = remoteEdit(manager.currentVersion.vector, ...ops);
            if (!hasValue(space)) {
                const availableSpaces = getTagMaskSpaces(bot, tag);
                if (availableSpaces.length <= 0) {
                    space = DEFAULT_TAG_MASK_SPACE;
                } else {
                    for (let possibleSpace of TAG_MASK_SPACE_PRIORITIES) {
                        if (availableSpaces.indexOf(possibleSpace) >= 0) {
                            space = possibleSpace;
                            break;
                        }
                    }
                }
            }
            script[SET_TAG_MASK_SYMBOL](tag, e, space);
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

    function updateTag(tag: string, value: any) {
        const mode = manager.updateTag(bot, tag, value);
        if (mode === RealtimeEditMode.Immediate) {
            rawTags[tag] = value;
            changeTag(tag, value);
        } else if (mode === RealtimeEditMode.Delayed) {
            changeTag(tag, value);
        }
    }

    function updateTagMask(tag: string, value: any) {
        const spaces = hasValue(value)
            ? [DEFAULT_TAG_MASK_SPACE]
            : getTagMaskSpaces(bot, tag);
        const mode = manager.updateTagMask(bot, tag, spaces, value);
        if (mode === RealtimeEditMode.Immediate) {
            rawMasks[tag] = value;
        }
        changeTagMask(tag, value, spaces);
    }

    function changeTag(tag: string, value: any) {
        if (isTagEdit(value)) {
            const currentValue = changedRawTags[tag];
            if (isTagEdit(currentValue)) {
                value = mergeEdits(currentValue, value);
            } else if (hasValue(currentValue)) {
                value = applyTagEdit(currentValue, value);
            }
        }
        changedRawTags[tag] = value;
    }

    function changeTagMask(tag: string, value: any, spaces: string[]) {
        for (let space of spaces) {
            if (!changedMasks[space]) {
                changedMasks[space] = {};
            }
            if (isTagEdit(value)) {
                const currentValue = changedMasks[space][tag];
                if (isTagEdit(currentValue)) {
                    value = mergeEdits(currentValue, value);
                } else if (hasValue(currentValue)) {
                    value = applyTagEdit(currentValue, value);
                }
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
    getTagMask(bot: CompiledBot, tag: string): any;

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

    /**
     * Gets the current version that the interface is at.
     */
    currentVersion: RuntimeStateVersion;
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
