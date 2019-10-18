import {
    BotCalculationContext,
    Bot,
    BotIndex,
    calculateBotValue,
    parseBotConfigContexts,
    BotIndexEvent,
    isBotInContext,
    PrecalculatedBot,
} from '@casual-simulation/aux-common';
import { UpdatedBotInfo } from './BotWatcher';
import { Observable, Subject } from 'rxjs';
import { map, filter } from 'rxjs/operators';
import { BotHelper } from './BotHelper';
import { difference } from 'lodash';

/**
 * Defines a class that makes it easy to watch for updates to bots in contexts.
 */
export class BotContextManager {
    private _index: BotIndex;
    private _helper: BotHelper;

    constructor(helper: BotHelper, index: BotIndex) {
        this._helper = helper;
        this._index = index;
    }

    /**
     * Watches for changes to contexts defined in the given tags.
     * @param tags The tags to watch for contexts.
     */
    watchContexts(...tags: string[]): Observable<BotContextsUpdate> {
        let state: BotContextsState = null;
        return this._index.events.pipe(
            map(events => {
                const calc = this._helper.createContext();
                let [update, newState] = processIndexEvents(
                    state,
                    calc,
                    events,
                    this._index,
                    tags
                );
                state = newState;
                return update;
            })
        );
    }
}

export interface BotContextsUpdate {
    /**
     * The calculation context was used for the update.
     */
    calc: BotCalculationContext;

    contextEvents: BotContextEvent[];
    updatedBots: UpdatedBotInfo[];
}

export interface BotContextsState {
    /**
     * A map of context IDs to the bot Ids that define them.
     */
    contexts: Map<string, Set<string>>;

    /**
     * A map of context IDs to the Bot IDs that are in them.
     */
    botsInContexts: Map<string, Set<string>>;
}

export type BotContextEvent =
    | ContextAddedEvent
    | ContextRemovedEvent
    | BotAddedToContextEvent
    | BotRemovedFromContextEvent;

/**
 * Defines an event which indicates that a context was added to a bot.
 */
export interface ContextAddedEvent {
    type: 'context_added';
    contextTag: string;
    contextBot: Bot;
    context: string;
    existingBots: Bot[];
}

export interface ContextRemovedEvent {
    type: 'context_removed';
    contextTag: string;
    contextBot: Bot;
    context: string;
}

export interface BotAddedToContextEvent {
    type: 'bot_added_to_context';
    bot: Bot;
    context: string;
}

export interface BotRemovedFromContextEvent {
    type: 'bot_removed_from_context';
    bot: Bot;
    context: string;
}

export function processIndexEvents(
    prevState: BotContextsState,
    calc: BotCalculationContext,
    events: BotIndexEvent[],
    index: BotIndex,
    contextTags: string[]
): [BotContextsUpdate, BotContextsState] {
    if (!prevState) {
        prevState = {
            contexts: new Map(),
            botsInContexts: new Map(),
        };
    }
    let newState: BotContextsState = {
        contexts: new Map(prevState.contexts),
        botsInContexts: new Map(prevState.contexts),
    };

    let contextEvents = [] as BotContextEvent[];
    let updatedBots = new Map<Bot, string[]>();
    for (let event of events) {
        if (contextTags.indexOf(event.tag) >= 0) {
            if (event.type === 'bot_tag_added') {
                const contexts = calculateContexts(calc, event.bot, event.tag);

                for (let context of contexts) {
                    addContext(
                        newState,
                        index,
                        context,
                        calc,
                        contextEvents,
                        event.bot,
                        event.tag
                    );
                }
            } else {
                const previousContexts =
                    event.type === 'bot_tag_updated'
                        ? calculateContexts(calc, event.oldBot, event.tag)
                        : calculateContexts(calc, event.bot, event.tag);
                const currentContexts =
                    event.type === 'bot_tag_removed'
                        ? []
                        : calculateContexts(calc, event.bot, event.tag);

                const addedContexts = difference(
                    currentContexts,
                    previousContexts
                );
                const removedContexts = difference(
                    previousContexts,
                    currentContexts
                );

                for (let added of addedContexts) {
                    addContext(
                        newState,
                        index,
                        added,
                        calc,
                        contextEvents,
                        event.bot,
                        event.tag
                    );
                }

                for (let removed of removedContexts) {
                    removeContext(
                        newState,
                        removed,
                        contextEvents,
                        event.bot,
                        event.tag
                    );
                }
            }
        }

        let botsCreatingContext = getBotIdsDefiningContext(
            prevState,
            event.tag
        );
        if (botsCreatingContext.size > 0) {
            let botsInContext = getBotIdsInContext(prevState, event.tag);
            const wasInContext = botsInContext.has(event.bot.id);
            const isInContext =
                event.type === 'bot_tag_removed'
                    ? false
                    : isBotInContext(calc, event.bot, event.tag);

            if (wasInContext !== isInContext) {
                if (isInContext) {
                    contextEvents.push({
                        type: 'bot_added_to_context',
                        bot: event.bot,
                        context: event.tag,
                    });
                } else {
                    contextEvents.push({
                        type: 'bot_removed_from_context',
                        bot: event.bot,
                        context: event.tag,
                    });
                }
            }
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

    const update: BotContextsUpdate = {
        calc,
        contextEvents,
        updatedBots: updates,
    };

    return [update, newState];
}

function addContext(
    newState: BotContextsState,
    index: BotIndex,
    context: string,
    calc: BotCalculationContext,
    contextEvents: BotContextEvent[],
    bot: Bot,
    tag: string
) {
    let botsWithContextTag = index.findBotsWithTag(context);
    let botsInContext = botsWithContextTag.filter(b =>
        isBotInContext(calc, b, context)
    );
    contextEvents.push({
        type: 'context_added',
        context: context,
        contextBot: bot,
        contextTag: tag,
        existingBots: botsInContext,
    });
    let list = getBotIdsDefiningContext(newState, context);
    list.add(bot.id);

    let bots = getBotIdsInContext(newState, context);
    for (let bot of botsInContext) {
        bots.add(bot.id);
    }
}

function removeContext(
    newState: BotContextsState,
    context: string,
    contextEvents: BotContextEvent[],
    bot: Bot,
    tag: string
) {
    contextEvents.push({
        type: 'context_removed',
        context: context,
        contextBot: bot,
        contextTag: tag,
    });

    let list = getBotIdsDefiningContext(newState, context);
    list.delete(bot.id);

    if (list.size <= 0) {
        newState.contexts.delete(context);
        newState.botsInContexts.delete(context);
    }
}

function calculateContexts(calc: BotCalculationContext, bot: Bot, tag: string) {
    const val = calculateBotValue(calc, bot, tag);
    const contexts = parseBotConfigContexts(val);
    return contexts;
}

function getBotIdsDefiningContext(
    state: BotContextsState,
    context: string
): Set<string> {
    return lookupList(state.contexts, context);
}

function getBotIdsInContext(
    state: BotContextsState,
    context: string
): Set<string> {
    return lookupList(state.botsInContexts, context);
}

function lookupList(map: Map<string, Set<string>>, key: string): Set<string> {
    let list = map.get(key);
    if (!list) {
        list = new Set();
        map.set(key, list);
    }
    return list;
}
