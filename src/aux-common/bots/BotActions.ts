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
import type { Bot, BotsState } from './Bot';
import { calculateBotValue, isDestroyable } from './BotCalculations';
import type { BotCalculationContext } from './BotCalculationContext';
import type {
    BotAction,
    ApplyStateAction,
    AddBotAction,
    RemoveBotAction,
    UpdateBotAction,
} from './BotEvents';
import { botRemoved, botAdded, botUpdated } from './BotEvents';
import { uniq } from 'es-toolkit/compat';

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

    destroyChildren(calc, events, id, new Set([id]));

    return events;
}

function destroyChildren(
    calc: BotCalculationContext,
    events: BotAction[],
    id: string,
    destroyedIds: Set<string>
) {
    const result = calc.objects.filter(
        (o) => calculateBotValue(calc, o, 'creator') === id
    );

    result.forEach((child) => {
        if (!isDestroyable(calc, child)) {
            return;
        }
        if (!destroyedIds.has(child.id)) {
            events.push(botRemoved(child.id));
            destroyedIds.add(child.id);
            destroyChildren(calc, events, child.id, destroyedIds);
        }
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
            for (let a of action.actions) {
                rejections.add(<BotAction>a);
            }
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
