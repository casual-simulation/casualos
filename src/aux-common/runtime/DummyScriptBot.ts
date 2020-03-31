import { BotSpace, ScriptBot, BotTags } from '../bots';

/**
 * Creates a dummy script bot.
 * That is, a bot which uses the given values directly and does not marshall changes back to a runtime.
 * @param id The ID of the bot.
 * @param tags The tags the bot should have.
 * @param space The space of the bot.
 */
export function createDummyScriptBot(
    id: string,
    tags: BotTags = {},
    space?: BotSpace
): ScriptBot {
    space = space || 'shared';
    tags = {
        ...tags,
    };

    Object.defineProperty(tags, 'space', {
        get: () => space,
        set: (val: any) => (space = val),
        enumerable: false,
        configurable: true,
    });

    return {
        id,
        tags: <any>tags,
        raw: tags,
        changes: {},
        space: space,
    };
}
