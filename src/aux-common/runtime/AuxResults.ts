import { Bot } from '../bots/Bot';
import { BotAction } from '../bots/BotEvents';

export class RanOutOfEnergyError extends Error {
    constructor() {
        super('Ran out of energy');
    }
}

/**
 * Defines the result of a script.
 */
export interface ScriptResult {
    /**
     * The actions that the script queued.
     */
    actions: BotAction[];
    /**
     * The value that the script returned.
     */
    result: any;

    /**
     * The error that the script ran into.
     */
    error: ScriptError;
}

/**
 * Defines an error that a script ran into,
 */
export interface ScriptError {
    /**
     * The error.
     */
    error: Error;

    /**
     * The bot that ran into the error.
     * Null if the script was not attached to a bot.
     */
    bot: Bot;

    /**
     * The tag that ran into the error.
     * Null if the script was not attached to a bot.
     */
    tag: string;

    /**
     * The line number that the error occurred at.
     */
    line?: number;

    /**
     * The column number that the error occurred at.
     */
    column?: number;

    /**
     * The script that caused the error.
     * Only set if the script was unable to be compiled.
     */
    script?: string;
}

/**
 * Defines the result of running an action.
 */
export interface ActionResult {
    /**
     * The actions that were queued.
     */
    actions: BotAction[];

    /**
     * The results from the scripts that were run.
     */
    results: any[];

    /**
     * The errors that occurred.
     */
    errors: ScriptError[];

    /**
     * The bots that ran a script for the action.
     */
    listeners: Bot[];
}
