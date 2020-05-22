import {
    BotSpace,
    BotTags,
    Bot,
    ScriptTags,
    PrecalculatedBot,
    BOT_SPACE_TAG,
    getBotSpace,
    createPrecalculatedBot,
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
     * The changes that have been made to the bot.
     */
    changes: BotTags;

    /**
     * The calculated listener functions.
     * This lets you get the compiled listener functions.
     */
    listeners: CompiledBotListeners;

    /**
     * A function that can clear all the changes from the runtime bot.
     */
    [CLEAR_CHANGES_SYMBOL]: () => void;
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
            typeof bot.tags.toJSON === 'function' &&
            typeof bot.listeners === 'object' &&
            typeof bot.changes === 'object'
        );
    }
    return false;
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
        // set(target, key: string, value, receiver) {
        //     return true;
        // },
        // deleteProperty(target, key: string) {
        //     return true;
        // },
    });

    // Define a toJSON() function but
    // make it not enumerable so it is not included
    // in Object.keys() and for..in expressions.
    Object.defineProperty(tagsProxy, 'toJSON', {
        value: () => rawTags,
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
        changes: changedRawTags,
        listeners: listenersProxy,
        [CLEAR_CHANGES_SYMBOL]: null,
    };

    Object.defineProperty(script, CLEAR_CHANGES_SYMBOL, {
        value: () => {
            changedRawTags = {};
            script.changes = changedRawTags;
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
}

/**
 * Defines an interface for an object that provides the API that script bots use for housekeeping.
 * T is the type of bots that the generated script bots are representing.
 */
export interface RuntimeBotInterface {
    /**
     * Updates the tag of the given bot.
     * Returns the realtime edit mode that should be used for this particular assignment.
     * @param bot The bot.
     * @param tag The tag that should be updated.
     * @param newValue The new tag value.
     */
    updateTag(bot: CompiledBot, tag: string, newValue: any): RealtimeEditMode;

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
     * Gets the listener for the given bot and tag, resolving any formulas that may be present.
     * Returns null if no listener is available.
     * @param bot The bot.
     * @param tag The tag.
     */
    getListener(bot: CompiledBot, tag: string): CompiledBotListener;
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

/**
 * The default realtime edit mode.
 */
export const DEFAULT_REALTIME_EDIT_MODE: RealtimeEditMode =
    RealtimeEditMode.Immediate;

/**
 * A map between space types and the realtime edit modes they should use.
 */
export type SpaceRealtimeEditModeMap = Map<BotSpace, RealtimeEditMode>;

/**
 * The default map between bot spaces and realtime edit modes.
 */
export const DEFAULT_SPACE_REALTIME_EDIT_MODE_MAP: SpaceRealtimeEditModeMap = new Map(
    [
        ['shared', RealtimeEditMode.Immediate],
        ['local', RealtimeEditMode.Immediate],
        ['tempLocal', RealtimeEditMode.Immediate],
        ['history', RealtimeEditMode.Delayed],
        ['error', RealtimeEditMode.Delayed],
        ['admin', RealtimeEditMode.Delayed],
    ]
);

/**
 * Gets the realtime edit mode for the given space and map.
 * @param map The map.
 * @param space The space.
 */
export function getRealtimeEditMode(
    map: SpaceRealtimeEditModeMap,
    space: BotSpace
): RealtimeEditMode {
    return map.get(space) || DEFAULT_REALTIME_EDIT_MODE;
}
