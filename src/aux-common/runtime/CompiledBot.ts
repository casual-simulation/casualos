import {
    PrecalculatedBot,
    Bot,
    PrecalculatedTags,
    BotSpace,
    hasValue,
} from '../bots';
import uuid from 'uuid/v4';
import { RuntimeBot } from './RuntimeBot';

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
     * The tags that have been compiled.
     * Formulas and other tag values get stored here as an intermediate state.
     */
    compiledValues: CompiledBotValues;

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
 * An interface that maps tag names to compiled listener functions.
 */
export interface CompiledBotListeners {
    [tag: string]: CompiledBotListener;
}

/**
 * The type of a compiled bot listener.
 */
export type CompiledBotListener = (arg?: any) => any;

/**
 * An interface that maps tag names to the compiled values for a bot.
 * A compiled value is the parsed value that was stored in a tag.
 * For normal values like strings, numbers, booleans, this is the parsed value.
 * For formulas, this is a function that when executed returns the formula result.
 */
export interface CompiledBotValues {
    [tag: string]: CompiledBotFormula | any;
}

/**
 * The type of a compiled bot formula.
 */
export type CompiledBotFormula = () => any;

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
    compiledValues: CompiledBotValues = {},
    listeners: CompiledBotListeners = {}
): CompiledBot {
    if (hasValue(space)) {
        return {
            id,
            space,
            precalculated: true,
            tags: tags || values,
            values,
            compiledValues: {
                ...values,
                ...compiledValues,
            },
            listeners: listeners,
            script: null,
        };
    }
    return {
        id,
        precalculated: true,
        tags: tags || values,
        values,
        compiledValues: {
            ...values,
            ...compiledValues,
        },
        listeners: listeners,
        script: null,
    };
}
