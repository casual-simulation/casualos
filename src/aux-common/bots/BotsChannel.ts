import { BotsState, Bot } from './Bot';
import { ShoutAction, BotAction, action } from './BotEvents';
import { BotSandboxContext } from './BotCalculationContext';
import {
    getActiveObjects,
    filtersMatchingArguments,
    calculateBotValue,
    isBotListening,
    DEFAULT_ENERGY,
    hasValue,
    COMBINE_ACTION_NAME,
    ON_ANY_SHOUT_ACTION_NAME,
    ON_SHOUT_ACTION_NAME,
} from './BotCalculations';
import {
    getActions,
    getCalculationContext,
    getBotState,
    getUserId,
    setActions,
    setBotState,
    setCalculationContext,
    getEnergy,
    setEnergy,
} from '../Formulas/formula-lib-globals';
import { flatMap, sortBy } from 'lodash';

/**
 * Calculates the set of events that should be run as the result of the given action using the given context.
 * The returned events are only events that were added directly from the scripts and not any events that were added via setTag() calls.
 */
export function calculateActionEventsUsingContext(
    state: BotsState,
    action: ShoutAction,
    context: BotSandboxContext
): BotAction[] {
    let [events] = calculateActionResultsUsingContext(state, action, context);
    return events;
}

/**
 * Calculates the results of the given action run against the given state in the given context.
 * @param state The current bots state that the action should use.
 * @param action The action to run.
 * @param context The context that the action should be run in.
 * @param executeOnShout Whether to execute the onAnyListen() callback for this action.
 */
export function calculateActionResultsUsingContext(
    state: BotsState,
    action: ShoutAction,
    context: BotSandboxContext,
    executeOnShout?: boolean
): [BotAction[], any[]] {
    const { bots, objects } = getBotsForAction(state, action, context);
    const [events, results] = calculateBotActionEvents(
        state,
        action,
        context,
        bots,
        executeOnShout
    );

    return [events, results];
}

export function getBotsForAction(
    state: BotsState,
    action: ShoutAction,
    calc: BotSandboxContext
) {
    //here

    const objects = getActiveObjects(state);
    let bots = !!action.botIds ? action.botIds.map(id => state[id]) : objects;

    bots = action.sortBotIds ? sortBy(bots, f => f.id) : bots;

    for (let i = bots.length - 1; i >= 0; i--) {
        if (isBotListening(calc, bots[i]) == false) {
            bots.splice(i, 1);
        }
    }

    return { bots, objects };
}

export function calculateBotActionEvents(
    state: BotsState,
    event: ShoutAction,
    context: BotSandboxContext,
    bots: Bot[],
    executeOnShout: boolean = true
): [BotAction[], any[], Bot[]] {
    let events: BotAction[] = [];
    let results: any[] = [];
    let listeners: Bot[] = [];

    for (let f of bots) {
        const [e, r, valid] = eventActions(
            state,
            bots,
            context,
            f,
            event.eventName,
            event.argument
        );
        events.push(...e);
        results.push(...r);

        if (valid) {
            listeners.push(f);
        }
    }

    if (executeOnShout) {
        let argument = {
            that: event.argument,
            name: event.eventName,
            targets: bots,
            listeners: listeners,
            responses: results,
        };

        const [extraEvents] = calculateActionResultsUsingContext(
            state,
            action(
                ON_SHOUT_ACTION_NAME,
                bots.map(b => b.id),
                event.userId,
                argument
            ),
            context,
            false
        );

        const [anyExtraEvents] = calculateActionResultsUsingContext(
            state,
            action(ON_ANY_SHOUT_ACTION_NAME, null, event.userId, argument),
            context,
            false
        );

        events.push(...extraEvents, ...anyExtraEvents);
    }

    return [events, results, listeners];
}

function eventActions(
    state: BotsState,
    objects: Bot[],
    context: BotSandboxContext,
    bot: Bot,
    eventName: string,
    argument: any
): [BotAction[], any[], boolean] {
    if (bot === undefined) {
        return;
    }
    const otherObjects = objects.filter(o => o !== bot);
    const sortedObjects = sortBy(objects, o => o !== bot);

    const filters = filtersMatchingArguments(
        context,
        bot,
        eventName,
        otherObjects
    );

    // Workaround for combining bots with custom arguments
    if (eventName === COMBINE_ACTION_NAME) {
        if (typeof argument === 'object') {
            argument = {
                ...argument,
                bot: otherObjects[0],
            };
        } else {
            argument = {
                bot: otherObjects[0],
            };
        }
    }

    const scripts = filters
        .map(f => {
            const result = calculateBotValue(context, bot, f.tag);
            if (result) {
                return `(function() { \n${result.toString()}\n }).call(this)`;
            } else {
                return result;
            }
        })
        .filter(r => hasValue(r));

    const [events, results] = formulaActions(
        state,
        context,
        sortedObjects,
        argument,
        scripts
    );

    return [events, results, scripts.length > 0];
}

export function formulaActions(
    state: BotsState,
    context: BotSandboxContext,
    sortedObjects: Bot[],
    argument: any,
    scripts: string[]
): [BotAction[], any[]] {
    let previous = getActions();
    let prevContext = getCalculationContext();
    let prevState = getBotState();
    let prevUserId = getUserId();
    let prevEnergy = getEnergy();
    let actions: BotAction[] = [];
    let vars: {
        [key: string]: any;
    } = {};
    setActions(actions);
    setBotState(state);
    setCalculationContext(context);

    // TODO: Allow configuring energy per action
    setEnergy(DEFAULT_ENERGY);

    if (typeof argument === 'undefined') {
        sortedObjects.forEach((obj, index) => {
            if (index === 1) {
                vars['that'] = obj;
            }
            vars[`arg${index}`] = obj;
        });
    } else {
        vars['that'] = argument;
    }

    let results: any[] = [];
    for (let script of scripts) {
        const result = context.sandbox.run(script, {}, sortedObjects[0], vars);
        if (result.error) {
            throw result.error;
        }
        results.push(result.result);
    }
    setActions(previous);
    setBotState(prevState);
    setCalculationContext(prevContext);
    setEnergy(prevEnergy);
    return [actions, results];
}
