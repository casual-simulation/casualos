import {
    BotSpace,
    ScriptBot,
    BotTags,
    Bot,
    ScriptTags,
    PrecalculatedBot,
    BOT_SPACE_TAG,
    getBotSpace,
    createPrecalculatedBot,
} from '../bots';
import { AuxGlobalContext } from './AuxGlobalContext';

/**
 * Creates a dummy script bot.
 * That is, a bot which uses the given values directly and does not marshall changes back to a runtime.
 * @param id The ID of the bot.
 * @param tags The tags the bot should have.
 * @param space The space of the bot.
 */
export function createDummyScriptBot(
    context: AuxGlobalContext,
    id: string,
    tags: BotTags = {},
    space?: BotSpace
): ScriptBot {
    const precalc = createPrecalculatedBot(id, tags, undefined, space);
    return createScriptBot(precalc, dummyScriptBotManager, context);
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
export function createScriptBot<T extends PrecalculatedBot>(
    bot: T,
    manager: ScriptBotManager<T>,
    context: AuxGlobalContext
): ScriptBot {
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
            if (key in constantTags || !context.allowsEditing) {
                return true;
            }
            rawTags[key] = value;
            changedRawTags[key] = value;
            manager.updateTag(bot, key, value);
            return true;
        },
        deleteProperty(target, key: string) {
            if (key in constantTags || !context.allowsEditing) {
                return true;
            }
            const value = null as any;
            rawTags[key] = value;
            changedRawTags[key] = value;
            manager.updateTag(bot, key, value);
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
            if (key in constantTags || !context.allowsEditing) {
                return true;
            }
            rawTags[key] = value;
            changedRawTags[key] = value;
            manager.updateTag(bot, key, value);
            return true;
        },
        deleteProperty(target, key: string) {
            if (key in constantTags || !context.allowsEditing) {
                return true;
            }
            const value = null as any;
            rawTags[key] = value;
            changedRawTags[key] = value;
            manager.updateTag(bot, key, value);
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

    let script: ScriptBot = {
        id: bot.id,
        tags: tagsProxy,
        raw: rawProxy,
        changes: changedRawTags,
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

export interface ScriptBotManager<T extends PrecalculatedBot> {
    updateTag(bot: T, tag: string, newValue: any): void;
}

/**
 * Defines a script bot manager that is useful for testing since it ignores
 * complicated interactions like formulas.
 */
export const dummyScriptBotManager: ScriptBotManager<PrecalculatedBot> = {
    updateTag(bot, tag, newValue) {
        bot.tags[tag] = newValue;
        bot.values[tag] = newValue;
    },
};
