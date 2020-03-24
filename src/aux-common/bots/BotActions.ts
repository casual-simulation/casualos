import { Bot, BotsState } from './Bot';
import {
    calculateBotValue,
    getActiveObjects,
    calculateFormulaValue,
    isDestroyable,
    convertToCopiableValue,
} from './BotCalculations';
import {
    BotCalculationContext,
    BotSandboxContext,
} from './BotCalculationContext';
import {
    ShoutAction,
    botRemoved,
    BotAction,
    ApplyStateAction,
    BotActions,
    botAdded,
    botUpdated,
    AddBotAction,
    RemoveBotAction,
    UpdateBotAction,
} from './BotEvents';
import {
    createCalculationContextFromState,
    createCalculationContext,
} from './BotCalculationContextFactories';
import {
    calculateBotActionEvents,
    getBotsForAction,
    formulaActions,
    ActionResult,
} from './BotsChannel';
import { SandboxFactory, SandboxLibrary } from '../Formulas/Sandbox';
import values from 'lodash/values';
import uniq from 'lodash/uniq';

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
    return convertToCopiableValue(result);
}

/**
 * Calculates the results for the given action run with the given state.
 * @param state The state.
 * @param action The action.
 * @param sandboxFactory The factory that should be used to create a script sandbox.
 * @param library The library that should be used for sandbox scripts.
 * @param calc The calculation context.
 * @param executeOnShout Whether to run the onListen actions.
 */
export function calculateActionResults(
    state: BotsState,
    action: ShoutAction,
    sandboxFactory?: SandboxFactory,
    library?: SandboxLibrary,
    calc?: BotSandboxContext,
    executeOnShout?: boolean
): ActionResult {
    const allObjects = values(state);
    calc =
        calc ||
        createCalculationContext(
            allObjects,
            action.userId,
            library,
            sandboxFactory
        );
    const { bots, objects } = getBotsForAction(action, calc);
    const context = createCalculationContext(
        objects,
        action.userId,
        library,
        sandboxFactory
    );

    const result = calculateBotActionEvents(
        state,
        action,
        context,
        bots,
        executeOnShout
    );
    let events = [
        ...result.actions,
        ...context.sandbox.interface.getBotUpdates(),
    ];

    return {
        actions: events,
        errors: result.errors,
        results: result.results,
        listeners: result.listeners,
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
): BotAction[] {
    const objects = getActiveObjects(state);
    const context = createCalculationContext(
        objects,
        userId,
        library,
        sandboxFactory
    );

    let result = formulaActions(context, null, null, formula);

    return [...result.actions, ...context.sandbox.interface.getBotUpdates()];
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
        o => calculateBotValue(calc, o, 'auxCreator') === id
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

/**
 * Calculates the individual bot update events for the given event.
 * @param currentState The current state.
 * @param event The event.
 */
export function breakIntoIndividualEvents(
    currentState: BotsState,
    event: ApplyStateAction
): (AddBotAction | RemoveBotAction | UpdateBotAction)[] {
    let actions = [] as (AddBotAction | RemoveBotAction | UpdateBotAction)[];

    let update = event.state;
    for (let id in update) {
        const botUpdate = update[id];
        const currentBot = currentState[id];
        if (!currentBot && botUpdate) {
            // new bot
            actions.push(botAdded(botUpdate));
        } else if (currentBot && !botUpdate) {
            // deleted bot
            actions.push(botRemoved(id));
        } else if (currentBot && botUpdate) {
            // updated bot
            actions.push(botUpdated(id, botUpdate));
        }
    }

    return actions;
}
