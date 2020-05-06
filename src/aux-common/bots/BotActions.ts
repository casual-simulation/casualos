import { Bot, BotsState } from './Bot';
import {
    calculateBotValue,
    getActiveObjects,
    isDestroyable,
    convertToCopiableValue,
} from './BotCalculations';
import { BotCalculationContext } from './BotCalculationContext';
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
import uniq from 'lodash/uniq';

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
