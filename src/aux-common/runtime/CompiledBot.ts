import {
    PrecalculatedBot,
    Bot,
    PrecalculatedTags,
    BotSpace,
    hasValue,
    BotSignatures,
    CompiledBotListeners,
    RuntimeBot,
} from '../bots';
import { v4 as uuid } from 'uuid';

// Types of bots
// 1. Raw bot - original data
// 2. Compiled bot - original data + parsed data + compiled scripts
// 3. Precalculated bot - final data
// 4. Script bot - original data + parsed data + compiled scripts + proxies

// Raw bot -> compiled bot -> precalculated bot
// Raw bot -> compiled bot -> script bot

/**
 * Defines bots state that contains compiled bots.
 */
export interface CompiledBotsState {
    [id: string]: CompiledBot;
}

/**
 * A bot that has been pre-compiled so that running tag listeners or formulas is quick.
 */
export interface CompiledBot extends PrecalculatedBot {
    /**
     * The tags that are listeners and have been compiled into functions.
     */
    listeners: CompiledBotListeners;

    /**
     * The script bot that the compiled bot has been setup to use.
     */
    script: RuntimeBot;
}

/**
 * Creates a new compiled bot with the given values.
 * Useful for testing.
 * @param id The ID of the bot.
 * @param values The values that the bot contains.
 * @param tags The tags that the bot contains.
 * @param space The space that the bot is in.
 * @param compiledValues The compiled values that the bot should use.
 * @param listeners The listeners that the bot should have.
 */
export function createCompiledBot(
    id = uuid(),
    values: PrecalculatedTags = {},
    tags?: Bot['tags'],
    space?: BotSpace,
    listeners: CompiledBotListeners = {},
    signatures?: BotSignatures
): CompiledBot {
    if (hasValue(space)) {
        return {
            id,
            space,
            precalculated: true,
            tags: tags || values,
            values,
            listeners: listeners,
            signatures,
            script: null,
        };
    }
    return {
        id,
        precalculated: true,
        tags: tags || values,
        values,
        listeners: listeners,
        signatures,
        script: null,
    };
}
