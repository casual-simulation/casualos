import {
    ScriptBot,
    PrecalculatedBot,
    createPrecalculatedBot,
    BotTags,
    BotSpace,
    Bot,
} from '../../bots';
import {
    createScriptBot,
    ScriptBotInterface,
    ScriptBotFactory,
} from '../ScriptBot';
import { AuxGlobalContext } from '../AuxGlobalContext';

export class TestScriptBotFactory implements ScriptBotFactory {
    createScriptBot(bot: Bot): ScriptBot {
        return createDummyScriptBot(bot.id, bot.tags, bot.space);
    }
}

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
    const precalc = createPrecalculatedBot(id, tags, undefined, space);
    return createScriptBot(precalc, testScriptBotInterface);
}

export const testScriptBotInterface: ScriptBotInterface<PrecalculatedBot> = {
    updateTag(bot: PrecalculatedBot, tag: string, newValue: any) {
        bot.tags[tag] = newValue;
        bot.values[tag] = newValue;
        return true;
    },
};
