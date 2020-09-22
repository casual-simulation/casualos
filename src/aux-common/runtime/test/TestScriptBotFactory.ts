import {
    PrecalculatedBot,
    BotTags,
    BotSpace,
    Bot,
    BotSignatures,
    botsFromShortIds,
    TAG_MASK_SPACE_PRIORITIES,
} from '../../bots';
import {
    createRuntimeBot,
    RuntimeBotInterface,
    RuntimeBotFactory,
    RuntimeBot,
    RealtimeEditMode,
} from '../RuntimeBot';
import {
    createCompiledBot,
    CompiledBotListener,
    CompiledBot,
} from '../CompiledBot';
import pickBy from 'lodash/pickBy';

export class TestScriptBotFactory implements RuntimeBotFactory {
    createRuntimeBot(bot: Bot): RuntimeBot {
        return createDummyRuntimeBot(bot.id, bot.tags, bot.space);
    }

    destroyScriptBot() {
        return RealtimeEditMode.Immediate;
    }
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
    space?: BotSpace,
    signatures?: BotSignatures
): RuntimeBot {
    let functions = pickBy(tags, (t: any) => typeof t === 'function');
    const precalc = createCompiledBot(
        id,
        tags,
        undefined,
        space,
        undefined,
        functions,
        signatures
    );
    return createRuntimeBot(precalc, testScriptBotInterface);
}

export const testScriptBotInterface: RuntimeBotInterface = {
    updateTag(bot: PrecalculatedBot, tag: string, newValue: any) {
        bot.tags[tag] = newValue;
        bot.values[tag] = newValue;
        return RealtimeEditMode.Immediate;
    },
    getValue(bot: PrecalculatedBot, tag: string) {
        return bot.values[tag];
    },
    getRawValue(bot: PrecalculatedBot, tag: string) {
        return bot.tags[tag];
    },
    getListener(bot: CompiledBot, tag: string) {
        return bot.listeners[tag];
    },
    getSignature(bot: PrecalculatedBot, signature: string): string {
        if (bot.signatures) {
            return bot.signatures[signature];
        } else {
            return undefined;
        }
    },
    notifyChange() {},
    getTagMask(bot: CompiledBot, tag: string): any {
        if (!bot.masks) {
            return undefined;
        }
        for (let space of TAG_MASK_SPACE_PRIORITIES) {
            if (!bot.masks[space]) {
                continue;
            }
            if (tag in bot.masks[space]) {
                return bot.masks[space][tag];
            }
        }
        return undefined;
    },
    updateTagMask(bot: CompiledBot, tag: string, spaces: string[], value: any) {
        if (!bot.masks) {
            bot.masks = {};
        }
        for (let space of spaces) {
            if (!bot.masks[space]) {
                bot.masks[space] = {};
            }
            bot.masks[space][tag] = value;
        }
        return RealtimeEditMode.Immediate;
    },
};
