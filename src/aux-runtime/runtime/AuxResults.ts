/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type { Bot } from '@casual-simulation/aux-common/bots/Bot';
import type { RuntimeActions } from './RuntimeEvents';

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
    actions: RuntimeActions[];
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
    actions: RuntimeActions[];

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

export type ProcessActionResult = ActionResult | null;
