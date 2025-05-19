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
import type {
    PrecalculatedBot,
    Bot,
    PrecalculatedTags,
    BotSpace,
    BotSignatures,
    CompiledBotListeners,
    RuntimeBot,
    CompiledBotModules,
    CompiledBotExports,
} from '@casual-simulation/aux-common/bots';
import { hasValue } from '@casual-simulation/aux-common/bots';
import { v4 as uuid } from 'uuid';
import type {
    Breakpoint,
    InterpreterAfterStop,
    InterpreterBeforeStop,
    InterpreterContinuation,
    InterpreterStop,
} from '@casual-simulation/js-interpreter';
import type { ScriptError } from './AuxResults';
import type { RuntimeActions } from './RuntimeEvents';

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
     * The modules that are defined by this bot.
     */
    modules: CompiledBotModules;

    /**
     * The exports that the compiled bot has.
     */
    exports: CompiledBotExports;

    /**
     * The script bot that the compiled bot has been setup to use.
     */
    script: RuntimeBot;

    /**
     * The tag values that were originally on the bot before an edit was applied.
     */
    originalTagEditValues: Bot['tags'];

    /**
     * The tag mask values that were originally on the bot before an edit was applied.
     */
    originalTagMaskEditValues: Bot['masks'];

    /**
     * The list of breakpoints that are registered on this bot.
     */
    breakpoints: RuntimeBreakpoint[];

    /**
     * The number of errors that have occurred on each tag in this bot.
     */
    errorCounts: TagErrorCounts;
}

interface TagErrorCounts {
    [tag: string]: number;
}

export type RuntimeGenerator = Generator<
    InterpreterStop,
    any,
    InterpreterContinuation
>;

export type RuntimeStop = RuntimeBeforeStop | RuntimeAfterStop;

export interface RuntimeStopBase {
    /**
     * The ID of the stop.
     */
    stopId: string | number;

    /**
     * The breakpoint that the runtime hit.
     */
    breakpoint: RuntimeBreakpoint;
}

export interface RuntimeBeforeStop
    extends Omit<InterpreterBeforeStop, 'breakpoint'>,
        RuntimeStopBase {}

export interface RuntimeAfterStop
    extends Omit<InterpreterAfterStop, 'breakpoint'>,
        RuntimeStopBase {}

/**
 * Defines an interface that represents the state that the runtime needs in order to resume a runtime stop.
 */
export interface RuntimeStopState {
    /**
     * The ID of this stop.
     */
    stopId: string | number;

    /**
     * The generator that was currently executing.
     */
    generator: RuntimeGenerator;

    /**
     * The current list of batched actions.
     */
    actions: RuntimeActions[];

    /**
     * The current list of batched errors.
     */
    errors: ScriptError[];

    resolve: (result: any | PromiseLike<any>) => void;
    reject: (result: any) => void;
}

/**
 * Defines an interface that represents a breakpoint that was set on a runtime.
 */
export interface RuntimeBreakpoint extends Omit<Breakpoint, 'func'> {
    /**
     * The ID of the bot that the breakpoint should be set on.
     */
    botId: string;

    /**
     * The name of the tag that the breakpoint should be set on.
     */
    tag: string;
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
 * @param modules The modules that the bot should have.
 */
export function createCompiledBot(
    id = uuid(),
    values: PrecalculatedTags = {},
    tags?: Bot['tags'],
    space?: BotSpace,
    listeners: CompiledBotListeners = {},
    signatures?: BotSignatures,
    modules: CompiledBotModules = {}
): CompiledBot {
    if (hasValue(space)) {
        return {
            id,
            space,
            precalculated: true,
            tags: tags || values,
            values,
            listeners: listeners,
            modules: modules,
            exports: {},
            signatures,
            script: null,
            originalTagEditValues: {},
            originalTagMaskEditValues: {},
            breakpoints: [],
            errorCounts: {},
        };
    }
    return {
        id,
        precalculated: true,
        tags: tags || values,
        values,
        listeners: listeners,
        modules: modules,
        exports: {},
        signatures,
        script: null,
        originalTagEditValues: {},
        originalTagMaskEditValues: {},
        breakpoints: [],
        errorCounts: {},
    };
}
