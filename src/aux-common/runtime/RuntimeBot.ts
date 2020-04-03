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
import { CompiledBot, CompiledBotListeners } from './CompiledBot';

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
    tags: ScriptTags;
    raw: BotTags;
    changes: BotTags;
    listeners: CompiledBotListeners;
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
            return bot.values[key];
        },
        set(target, key: string, value, receiver) {
            if (key in constantTags) {
                return true;
            }
            if (manager.updateTag(bot, key, value)) {
                rawTags[key] = value;
                changedRawTags[key] = value;
            }
            return true;
        },
        deleteProperty(target, key: string) {
            if (key in constantTags) {
                return true;
            }
            const value = null as any;
            if (manager.updateTag(bot, key, value)) {
                rawTags[key] = value;
                changedRawTags[key] = value;
            }
            return true;
        },
    });
    const rawProxy = new Proxy(rawTags, {
        get(target, key: string, proxy) {
            if (key in constantTags) {
                return constantTags[<keyof typeof constantTags>key];
            }
            return Reflect.get(target, key, proxy);
        },
        set(target, key: string, value, receiver) {
            if (key in constantTags) {
                return true;
            }
            if (manager.updateTag(bot, key, value)) {
                rawTags[key] = value;
                changedRawTags[key] = value;
            }
            return true;
        },
        deleteProperty(target, key: string) {
            if (key in constantTags) {
                return true;
            }
            const value = null as any;
            if (manager.updateTag(bot, key, value)) {
                rawTags[key] = value;
                changedRawTags[key] = value;
            }
            return true;
        },
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
        listeners: bot.listeners,
    };

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
     * Returns whether the tag was able to be updated.
     * @param bot The bot.
     * @param tag The tag that should be updated.
     * @param newValue The new tag value.
     */
    updateTag(bot: CompiledBot, tag: string, newValue: any): boolean;
}

/**
 * Defines an interface for an object that is able to manage the creation and destruction of script bots in the runtime.
 */
export interface RuntimeBotFactory {
    /**
     * Creates a new script bot from the given bot and adds it to the runtime.
     * @param bot The bot.
     */
    createRuntimeBot(bot: Bot): RuntimeBot;

    /**
     * Destroyes the given script bot and removes it from the runtime.
     * @param bot The bot.
     */
    destroyScriptBot(bot: RuntimeBot): void;
}
