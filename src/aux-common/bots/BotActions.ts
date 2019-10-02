import { Bot, BotsState } from './Bot';
import {
    calculateBotValue,
    getActiveObjects,
    calculateFormulaValue,
    isDestroyable,
} from './BotCalculations';
import {
    BotCalculationContext,
    BotSandboxContext,
} from './BotCalculationContext';
import { ShoutAction, botRemoved, BotAction } from './BotEvents';
import {
    createCalculationContextFromState,
    createCalculationContext,
} from './BotCalculationContextFactories';
import {
    calculateBotActionEvents,
    getBotsForAction,
    formulaActions,
} from './BotsChannel';
import { SandboxFactory, SandboxLibrary } from '../Formulas/Sandbox';
import { values, uniq } from 'lodash';

/**
 * Executes the given formula on the given bot state and returns the results.
 * @param formula The formula to run.
 * @param state The bot state to use.
 * @param options The options.
 */
export function searchBotState(
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
    sandboxFactory?: SandboxFactory,
    calc?: BotSandboxContext,
    executeOnShout?: boolean
): [BotAction[], any[]] {
    const allObjects = values(state);
    calc =
        calc ||
        createCalculationContext(
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

    const [botEvents, results] = calculateBotActionEvents(
        state,
        action,
        context,
        bots,
        executeOnShout
    );
    let events = [...botEvents, ...context.sandbox.interface.getBotUpdates()];

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

    const [botEvents] = calculateBotActionEvents(state, action, context, bots);
    let events = [...botEvents, ...context.sandbox.interface.getBotUpdates()];

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

    let [botEvents] = formulaActions(state, context, [], null, [formula]);

    return [...botEvents, ...context.sandbox.interface.getBotUpdates()];
}

/**
 * Calculates the list of events needed to destroy the given bot and all of its decendents.
 * @param calc The bot calculation context.
 * @param bot The bot to destroy.
 */
export function calculateDestroyBotEvents(
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

/**
 * Filters the given array of rejected actions.
 *
 * @param actions The actions to filter.
 */
export function resolveRejectedActions(actions: BotAction[]): BotAction[] {
    let rejections: Set<BotAction> = new Set();
    let final: BotAction[] = [];

    for (let i = actions.length - 1; i >= 0; i--) {
        const action = actions[i];

        if (rejections.has(action)) {
            rejections.delete(action);
        } else if (action.type === 'reject') {
            rejections.add(<BotAction>action.action);
        } else {
            final.unshift(action);
        }
    }

    return uniq(final);
}
