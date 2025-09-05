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
    BotCalculationContext,
    Bot,
    BotIndex,
    BotIndexEvent,
    PrecalculatedBot,
} from '@casual-simulation/aux-common';
import {
    isBotInDimension,
    calculateStringTagValue,
    calculateDimensions,
} from '@casual-simulation/aux-common';
import type { UpdatedBotInfo } from './BotWatcher';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { BotHelper } from './BotHelper';
import { difference, union } from 'es-toolkit/compat';

/**
 * Defines a class that makes it easy to watch for updates to bots in dimensions.
 */
export class BotDimensionManager {
    private _index: BotIndex;
    private _helper: BotHelper;

    constructor(helper: BotHelper, index: BotIndex) {
        this._helper = helper;
        this._index = index;
    }

    /**
     * Watches for changes to dimensions defined in the given tags.
     * @param tags The tags to watch for dimensions.
     * @param dimensionBotFilter The filter function that should be used to determine which bots are allowed to create/host dimensions.
     */
    watchDimensions(
        tags: string[],
        dimensionBotFilter: (bot: Bot) => boolean
    ): Observable<BotDimensionsUpdate> {
        let state: BotDimensionsState = null;
        return this._index.events.pipe(
            map((events) => {
                const calc = this._helper.createContext();
                let [update, newState] = processIndexEvents(
                    state,
                    calc,
                    events,
                    this._index,
                    tags,
                    dimensionBotFilter
                );
                state = newState;
                return update;
            })
        );
    }
}

export interface BotDimensionsUpdate {
    /**
     * The calculation context was used for the update.
     */
    calc: BotCalculationContext;

    events: BotDimensionEvent[];
    updatedBots: UpdatedBotInfo[];
}

export interface BotDimensionsState {
    /**
     * A map of dimension IDs to the bot Ids that define them.
     */
    dimensions: Map<string, Set<string>>;

    /**
     * A map of dimension IDs to the Bot IDs that are in them.
     */
    botsInDimensions: Map<string, Set<string>>;
}

export type BotDimensionEvent =
    | DimensionAddedEvent
    | DimensionRemovedEvent
    | BotAddedToDimensionEvent
    | BotRemovedFromDimensionEvent;

/**
 * Defines an event which indicates that a dimension was added to a bot.
 */
export interface DimensionAddedEvent {
    type: 'dimension_added';
    dimensionTag: string;
    dimensionBot: Bot;
    dimension: string;
    existingBots: Bot[];
}

export interface DimensionRemovedEvent {
    type: 'dimension_removed';
    dimensionTag: string;
    dimensionBot: Bot;
    dimension: string;
}

export interface BotAddedToDimensionEvent {
    type: 'bot_added_to_dimension';
    bot: Bot;
    dimension: string;
}

export interface BotRemovedFromDimensionEvent {
    type: 'bot_removed_from_dimension';
    bot: Bot;
    dimension: string;
}

export function processIndexEvents(
    prevState: BotDimensionsState,
    calc: BotCalculationContext,
    events: BotIndexEvent[],
    index: BotIndex,
    dimensionTags: string[],
    dimensionBotFilter: (bot: Bot) => boolean = () => true
): [BotDimensionsUpdate, BotDimensionsState] {
    if (!prevState) {
        prevState = {
            dimensions: new Map(),
            botsInDimensions: new Map(),
        };
    }
    let newState: BotDimensionsState = {
        dimensions: new Map(prevState.dimensions),
        botsInDimensions: new Map(prevState.botsInDimensions),
    };

    let dimensionEvents = [] as BotDimensionEvent[];
    let updatedBots = new Map<Bot, string[]>();
    for (let event of events) {
        // Check for new/removed dimensions
        if (
            dimensionTags.indexOf(event.tag) >= 0 &&
            dimensionBotFilter(event.bot)
        ) {
            if (event.type === 'bot_tag_added') {
                const dimensions = calculateDimensions(event.bot, event.tag);

                for (let dimension of dimensions) {
                    addDimension(
                        newState,
                        index,
                        dimension,
                        calc,
                        dimensionEvents,
                        event.bot,
                        event.tag
                    );
                }
            } else {
                const previousDimensions =
                    event.type === 'bot_tag_updated'
                        ? calculateDimensions(event.oldBot, event.tag)
                        : calculateDimensions(
                              event.oldBot || event.bot,
                              event.tag
                          );
                const currentDimensions =
                    event.type === 'bot_tag_removed'
                        ? []
                        : calculateDimensions(event.bot, event.tag);

                const addedDimensions = difference(
                    currentDimensions,
                    previousDimensions
                );
                const removedDimensions = difference(
                    previousDimensions,
                    currentDimensions
                );

                for (let added of addedDimensions) {
                    addDimension(
                        newState,
                        index,
                        added,
                        calc,
                        dimensionEvents,
                        event.bot,
                        event.tag
                    );
                }

                for (let removed of removedDimensions) {
                    removeDimension(
                        newState,
                        removed,
                        dimensionEvents,
                        event.bot,
                        event.tag
                    );
                }
            }
        }

        // Check for bots added to dimensions via tag
        let botsCreatingDimension = getBotIdsDefiningDimension(
            prevState,
            event.tag
        );
        if (botsCreatingDimension.size > 0) {
            let botsInDimension = getBotIdsInDimension(prevState, event.tag);
            const wasInDimension = botsInDimension.has(event.bot.id);
            const isInDimension = isEventInDimension(event, event.tag);

            if (wasInDimension !== isInDimension) {
                if (isInDimension) {
                    addToDimension(event.bot, event.tag);
                } else {
                    removeFromDimension(event.bot, event.tag);
                }
            }
        }

        // Check for user bots
        if (event.tag === 'gridPortal') {
            if (event.type === 'bot_tag_updated') {
                const currentDimension = calculateStringTagValue(
                    calc,
                    event.oldBot,
                    event.tag,
                    null
                );
                addOrRemoveFromDimension(currentDimension, event);
            }
            const newDimension = calculateStringTagValue(
                calc,
                event.bot,
                event.tag,
                null
            );
            addOrRemoveFromDimension(newDimension, event);
        }

        let tags = updatedBots.get(event.bot);
        if (!tags) {
            tags = [];
            updatedBots.set(event.bot, tags);
        }
        tags.push(event.tag);
    }

    let updates = [] as UpdatedBotInfo[];
    for (let [bot, tags] of updatedBots) {
        updates.push({
            bot: <PrecalculatedBot>bot,
            tags: new Set(tags),
        });
    }

    const update: BotDimensionsUpdate = {
        calc,
        events: dimensionEvents,
        updatedBots: updates,
    };

    return [update, newState];

    function addOrRemoveFromDimension(dimension: string, event: BotIndexEvent) {
        if (dimension) {
            // Check for bots added to dimensions via tag
            let botsCreatingDimension = getBotIdsDefiningDimension(
                prevState,
                dimension
            );
            if (botsCreatingDimension.size <= 0) {
                return;
            }

            let botsInDimension = getBotIdsInDimension(prevState, dimension);
            const wasInDimension = botsInDimension.has(event.bot.id);
            const isInDimension = isEventInDimension(event, dimension);
            if (wasInDimension !== isInDimension) {
                if (isInDimension) {
                    addToDimension(event.bot, dimension);
                } else {
                    removeFromDimension(event.bot, dimension);
                }
            }
        }
    }

    function isEventInDimension(event: BotIndexEvent, dimension: string) {
        return event.type === 'bot_tag_removed'
            ? false
            : isBotInDimension(calc, event.bot, dimension);
    }

    function addToDimension(bot: Bot, dimension: string) {
        dimensionEvents.push({
            type: 'bot_added_to_dimension',
            bot: bot,
            dimension: dimension,
        });
        let bots = getBotIdsInDimension(newState, dimension);
        bots.add(bot.id);
    }

    function removeFromDimension(bot: Bot, dimension: string) {
        dimensionEvents.push({
            type: 'bot_removed_from_dimension',
            bot: bot,
            dimension: dimension,
        });
        let bots = getBotIdsInDimension(newState, dimension);
        bots.delete(bot.id);
    }
}

function addDimension(
    newState: BotDimensionsState,
    index: BotIndex,
    dimension: string,
    calc: BotCalculationContext,
    dimensionEvents: BotDimensionEvent[],
    bot: Bot,
    tag: string
) {
    let botsWithDimensionTag = index.findBotsWithTag(dimension);
    let userBots = index.findBotsWithTag('gridPortal');
    let allBots = union(userBots, botsWithDimensionTag);
    let botsInDimension = allBots.filter((b) =>
        isBotInDimension(calc, b, dimension)
    );
    dimensionEvents.push({
        type: 'dimension_added',
        dimension: dimension,
        dimensionBot: bot,
        dimensionTag: tag,
        existingBots: botsInDimension,
    });
    let list = getBotIdsDefiningDimension(newState, dimension);
    list.add(bot.id);

    let bots = getBotIdsInDimension(newState, dimension);
    for (let bot of botsInDimension) {
        bots.add(bot.id);
    }
}

function removeDimension(
    newState: BotDimensionsState,
    dimension: string,
    dimensionEvents: BotDimensionEvent[],
    bot: Bot,
    tag: string
) {
    dimensionEvents.push({
        type: 'dimension_removed',
        dimension: dimension,
        dimensionBot: bot,
        dimensionTag: tag,
    });

    let list = getBotIdsDefiningDimension(newState, dimension);
    list.delete(bot.id);

    if (list.size <= 0) {
        newState.dimensions.delete(dimension);
        newState.botsInDimensions.delete(dimension);
    }
}

function getBotIdsDefiningDimension(
    state: BotDimensionsState,
    dimension: string
): Set<string> {
    return lookupList(state.dimensions, dimension);
}

function getBotIdsInDimension(
    state: BotDimensionsState,
    dimension: string
): Set<string> {
    return lookupList(state.botsInDimensions, dimension);
}

function lookupList(map: Map<string, Set<string>>, key: string): Set<string> {
    let list = map.get(key);
    if (!list) {
        list = new Set();
        map.set(key, list);
    }
    return list;
}
