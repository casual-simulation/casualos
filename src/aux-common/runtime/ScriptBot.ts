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
    manager: ScriptBotInterface<T>
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

/**
 * Defines an interface for an object that provides the API that script bots use for housekeeping.
 * T is the type of bots that the generated script bots are representing.
 */
export interface ScriptBotInterface<T extends PrecalculatedBot> {
    /**
     * Updates the tag of the given bot.
     * Returns whether the tag was able to be updated.
     * @param bot The bot.
     * @param tag The tag that should be updated.
     * @param newValue The new tag value.
     */
    updateTag(bot: T, tag: string, newValue: any): boolean;
}

/**
 * Defines an interface for an object that is able to create script bots.
 */
export interface ScriptBotFactory {
    createScriptBot(bot: Bot): ScriptBot;
}
