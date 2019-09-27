import { Bot, BotsState } from './File';
import {
    calculateBotValue,
    getActiveObjects,
    calculateFormulaValue,
    isDestroyable,
} from './FileCalculations';
import { BotCalculationContext } from './FileCalculationContext';
import { ShoutAction, botRemoved, BotAction } from './FileEvents';
import {
    createCalculationContextFromState,
    createCalculationContext,
} from './FileCalculationContextFactories';
import {
    calculateFileActionEvents,
    getBotsForAction,
    formulaActions,
} from './FilesChannel';
import { SandboxFactory, SandboxLibrary } from '../Formulas/Sandbox';
import { values } from 'lodash';

/**
 * Executes the given formula on the given bot state and returns the results.
 * @param formula The formula to run.
 * @param state The bot state to use.
 * @param options The options.
 */
export function searchFileState(
    formula: string,
    state: BotsState,
    userId?: string,
    library?: SandboxLibrary,
    createSandbox?: SandboxFactory
) {
    const context = createCalculationContextFromState(
        state,
        userId,
        library,
        createSandbox
    );
    const result = calculateFormulaValue(context, formula);
    return result;
}

export function calculateActionResults(
    state: BotsState,
    action: ShoutAction,
    sandboxFactory?: SandboxFactory
): [BotAction[], any[]] {
    const allObjects = values(state);
    const calc = createCalculationContext(
        allObjects,
        action.userId,
        undefined,
        sandboxFactory
    );
    const { bots, objects } = getBotsForAction(state, action, calc);
    const context = createCalculationContext(
        objects,
        action.userId,
        undefined,
        sandboxFactory
    );

    const [fileEvents, results] = calculateFileActionEvents(
        state,
        action,
        context,
        bots
    );
    let events = [...fileEvents, ...context.sandbox.interface.getFileUpdates()];

    return [events, results];
}

/**
 * Calculates the set of events that should be run for the given action.
 * @param state The current bot state.
 * @param action The action to process.
 * @param context The calculation context to use.
 * @param sandboxFactory The sandbox factory to use.
 */
export function calculateActionEvents(
    state: BotsState,
    action: ShoutAction,
    sandboxFactory?: SandboxFactory,
    library?: SandboxLibrary
) {
    const allObjects = values(state);
    const calc = createCalculationContext(
        allObjects,
        action.userId,
        library,
        sandboxFactory
    );
    const { bots, objects } = getBotsForAction(state, action, calc);
    const context = createCalculationContext(
        objects,
        action.userId,
        library,
        sandboxFactory
    );

    const [fileEvents] = calculateFileActionEvents(
        state,
        action,
        context,
        bots
    );
    let events = [...fileEvents, ...context.sandbox.interface.getFileUpdates()];

    return {
        events,
        hasUserDefinedEvents: events.length > 0,
    };
}

/**
 * Calculates the set of events that should be run for the given formula.
 * @param state The current bot state.
 * @param formula The formula to run.
 * @param userId The ID of the user to run the script as.
 * @param argument The argument to include as the "that" variable.
 * @param sandboxFactory The factory that should be used for making sandboxes.
 * @param library The library that should be used for the calculation context.
 */
export function calculateFormulaEvents(
    state: BotsState,
    formula: string,
    userId: string = null,
    argument: any = null,
    sandboxFactory?: SandboxFactory,
    library?: SandboxLibrary
) {
    const objects = getActiveObjects(state);
    const context = createCalculationContext(
        objects,
        userId,
        library,
        sandboxFactory
    );

    let [fileEvents] = formulaActions(state, context, [], null, [formula]);

    return [...fileEvents, ...context.sandbox.interface.getFileUpdates()];
}

/**
 * Calculates the list of events needed to destroy the given bot and all of its decendents.
 * @param calc The bot calculation context.
 * @param bot The bot to destroy.
 */
export function calculateDestroyFileEvents(
    calc: BotCalculationContext,
    bot: Bot
): BotAction[] {
    if (!isDestroyable(calc, bot)) {
        return [];
    }
    let events: BotAction[] = [];
    let id: string;
    if (typeof bot === 'object') {
        id = bot.id;
    } else if (typeof bot === 'string') {
        id = bot;
    }

    if (id) {
        events.push(botRemoved(id));
    }

    destroyChildren(calc, events, id);

    return events;
}

function destroyChildren(
    calc: BotCalculationContext,
    events: BotAction[],
    id: string
) {
    const result = calc.objects.filter(
        o => calculateBotValue(calc, o, 'aux.creator') === id
    );

    result.forEach(child => {
        if (!isDestroyable(calc, child)) {
            return;
        }
        events.push(botRemoved(child.id));
        destroyChildren(calc, events, child.id);
    });
}
