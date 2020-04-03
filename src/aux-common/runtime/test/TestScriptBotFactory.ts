import { PrecalculatedBot, BotTags, BotSpace, Bot } from '../../bots';
import {
    createRuntimeBot,
    RuntimeBotInterface,
    RuntimeBotFactory,
    RuntimeBot,
} from '../RuntimeBot';
import { createCompiledBot } from '../CompiledBot';

export class TestScriptBotFactory implements RuntimeBotFactory {
    createRuntimeBot(bot: Bot): RuntimeBot {
        return createDummyRuntimeBot(bot.id, bot.tags, bot.space);
    }

    destroyScriptBot() {}
}

/**
 * Creates a dummy script bot.
 * That is, a bot which uses the given values directly and does not marshall changes back to a runtime.
 * @param id The ID of the bot.
 * @param tags The tags the bot should have.
 * @param space The space of the bot.
 */
export function createDummyRuntimeBot(
    id: string,
    tags: BotTags = {},
    space?: BotSpace
): RuntimeBot {
    const precalc = createCompiledBot(id, tags, undefined, space);
    return createRuntimeBot(precalc, testScriptBotInterface);
}

export const testScriptBotInterface: RuntimeBotInterface = {
    updateTag(bot: PrecalculatedBot, tag: string, newValue: any) {
        bot.tags[tag] = newValue;
        bot.values[tag] = newValue;
        return true;
    },
    getValue(bot: PrecalculatedBot, tag: string) {
        return bot.values[tag];
    },
};
