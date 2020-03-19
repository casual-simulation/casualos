import {
    BotsState,
    Bot,
    ON_ANY_SHOUT_ACTION_NAME,
    ON_SHOUT_ACTION_NAME,
} from './Bot';
import { ShoutAction, BotAction, action } from './BotEvents';
import { BotSandboxContext } from './BotCalculationContext';
import {
    getActiveObjects,
    calculateBotValue,
    isBotListening,
    DEFAULT_ENERGY,
    hasValue,
    getCreatorVariable,
    getScriptBot,
    isBot,
    isScript,
    parseScript,
    getConfigVariable,
    getConfigTagVariable,
    ORIGINAL_OBJECT,
} from './BotCalculations';
import {
    getActions,
    getCalculationContext,
    getUserId,
    setActions,
    setCalculationContext,
    getEnergy,
    setEnergy,
    getCurrentBot,
    setCurrentBot,
} from '../Formulas/formula-lib-globals';
import sortBy from 'lodash/sortBy';
import transform from 'lodash/transform';

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
    const { bots, objects } = getBotsForAction(action, context);
    const [events, results] = calculateBotActionEvents(
        state,
        action,
        context,
        bots,
        executeOnShout
    );

    return [events, results];
}

export function getBotsForAction(action: ShoutAction, calc: BotSandboxContext) {
    const objects = calc.sandbox.interface.objects.map(b =>
        calc.sandbox.interface.unwrapBot(b)
    );
    const state = calc.sandbox.interface.state;
    let bots = !!action.botIds
        ? action.botIds.map(id => calc.sandbox.interface.unwrapBot(state[id]))
        : objects;

    bots = action.sortBotIds ? sortBy(bots, f => (!f ? '' : f.id)) : bots;

    for (let i = bots.length - 1; i >= 0; i--) {
        const bot = bots[i];
        if (!bot || isBotListening(calc, bot) == false) {
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
    context: BotSandboxContext,
    bot: Bot,
    eventName: string,
    argument: any
): [BotAction[], any[], boolean] {
    if (bot === undefined) {
        return;
    }

    const rawScript = calculateBotValue(context, bot, eventName);
    const parsed = parseScript(rawScript);
    if (!hasValue(parsed)) {
        return [[], [], false];
    }
    const final = `(function() { \n${parsed.toString()}\n }).call(this)`;

    const [events, results] = formulaActions(
        context,
        bot,
        argument,
        final,
        eventName
    );

    return [events, results, true];
}

export function formulaActions(
    context: BotSandboxContext,
    thisObject: Bot,
    arg: any,
    script: string,
    tag?: string
): [BotAction[], any[]] {
    let previous = getActions();
    let prevContext = getCalculationContext();
    let prevUserId = getUserId();
    let prevEnergy = getEnergy();
    let prevBot = getCurrentBot();
    let actions: BotAction[] = [];
    let vars: {
        [key: string]: any;
    } = {};
    setActions(actions);
    setCalculationContext(context);

    const scriptBot = getScriptBot(context, thisObject);

    // TODO: Allow configuring energy per action
    setEnergy(DEFAULT_ENERGY);
    setCurrentBot(scriptBot);

    let results: any[] = [];
    if ((scriptBot && thisObject) || (!scriptBot && !thisObject)) {
        arg = mapBotsToScriptBots(context, arg);

        vars['that'] = arg;
        vars['data'] = arg;
        vars['bot'] = scriptBot;
        vars['tags'] = scriptBot ? scriptBot.tags : null;
        vars['raw'] = scriptBot ? scriptBot.raw : null;
        vars['tagName'] = tag || null;
        vars['creator'] = getCreatorVariable(context, scriptBot);
        const config = (vars['config'] = getConfigVariable(context, scriptBot));
        vars['configTag'] = getConfigTagVariable(
            context,
            scriptBot,
            tag,
            config
        );

        const result = context.sandbox.run(script, {}, scriptBot, vars);
        if (result.error && result.error instanceof RanOutOfEnergyError) {
            throw result.error;
        } else if (result.error) {
            console.error(result.error);
        }
        results.push(result.result);
    }
    setActions(previous);
    setCalculationContext(prevContext);
    setEnergy(prevEnergy);
    setCurrentBot(prevBot);
    return [actions, results];
}

/**
 * Maps the given value to a new value where bots are replaced with script bots.
 * This makes it easy to modify other bot values in listeners. If the value is not convertable,
 * then it is returned unaffected. Only objects and arrays are convertable.
 *
 * Works by making a copy of the value where every bot value is replaced with a reference
 * to a script bot instance for the bot. The copy has a reference to the original value in the ORIGINAL_OBJECT symbol property.
 * We use this property in action.reject() to resolve the original action value so that doing a action.reject() in a onUniverseAction works properly.
 *
 * @param context The sandbox context.
 * @param value The value that should be converted.
 */
function mapBotsToScriptBots(context: BotSandboxContext, value: any): any {
    if (isBot(value)) {
        return getScriptBot(context, value);
    } else if (Array.isArray(value) && value.some(isBot)) {
        let arr = value.map(b => (isBot(b) ? getScriptBot(context, b) : b));
        (<any>arr)[ORIGINAL_OBJECT] = value;
        return arr;
    } else if (
        hasValue(value) &&
        !Array.isArray(value) &&
        !(value instanceof ArrayBuffer) &&
        typeof value === 'object'
    ) {
        return transform(
            value,
            (result, value, key) =>
                transformBotsToScriptBots(context, result, value, key),
            { [ORIGINAL_OBJECT]: value }
        );
    }

    return value;
}

function transformBotsToScriptBots(
    context: BotSandboxContext,
    result: any,
    value: any,
    key: any
) {
    result[key] = mapBotsToScriptBots(context, value);
}

export class RanOutOfEnergyError extends Error {
    constructor() {
        super('Ran out of energy');
    }
}
