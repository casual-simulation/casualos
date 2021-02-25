import { Bot } from './Bot';
import { tagsOnBot, hasValue, calculateBotValue } from './BotCalculations';
import { Subject, Observable } from 'rxjs';
import { filter, startWith, map } from 'rxjs/operators';
import { flatMap } from 'lodash';

/**
 * Defines a union type for bot index events.
 */
export type BotIndexEvent =
    | BotTagAddedEvent
    | BotTagRemovedEvent
    | BotTagUpdatedEvent;

/**
 * Defines an event that indicates a bot has added a value for a tag.
 */
export interface BotTagAddedEvent {
    type: 'bot_tag_added';
    bot: Bot;
    tag: string;
}

/**
 * Defines an event that indicates a bot has removed the value for a tag.
 */
export interface BotTagRemovedEvent {
    type: 'bot_tag_removed';
    bot: Bot;
    oldBot?: Bot;
    tag: string;
}

/**
 * Defines an event that indicates a bot has updated the value for a tag.
 */
export interface BotTagUpdatedEvent {
    type: 'bot_tag_updated';
    bot: Bot;
    oldBot: Bot;
    tag: string;
}

/**
 * Defines an index that is optimized for looking up bots by their tags.
 */
export class BotIndex {
    /**
     * The index events.
     */
    private _events = new Subject<BotIndexEvent[]>();

    /**
     * A map of tags to bot IDs.
     */
    private _tagMap: Map<string, Set<string>>;

    /**
     * A map of Bot IDs to bots.
     */
    private _botMap: Map<string, Bot>;

    private _batch: BotIndexEvent[] = null;

    get events(): Observable<BotIndexEvent[]> {
        let events = this.initialEvents();
        return this._events.pipe(
            startWith(events),
            filter((e) => e.length > 0)
        );
    }

    initialEvents() {
        let bots = [...this._botMap.values()];
        let events = flatMap(bots, (b) =>
            tagsOnBot(b).map(
                (t) =>
                    ({
                        type: 'bot_tag_added',
                        bot: b,
                        tag: t,
                    } as BotTagAddedEvent)
            )
        );
        return events;
    }

    constructor() {
        this._botMap = new Map();
        this._tagMap = new Map();
    }

    /**
     * Finds a list of bots that have the given tag.
     * @param tag The tag.
     */
    findBotsWithTag(tag: string): Bot[] {
        const list = this._botList(tag);
        return [...list.values()].map((id) => this._botMap.get(id));
    }

    /**
     * Batches all the index events during the given function.
     * @param func The function.
     */
    batch(func: Function) {
        let batch = [] as BotIndexEvent[];
        this._batch = batch;
        func();
        if (batch.length > 0) {
            this._events.next(batch);
        }
        this._batch = null;
        return batch;
    }

    /**
     * Adds the given bots to the index.
     * @param bots The bots to add.
     */
    addBots(bots: Bot[]) {
        let events = [] as BotIndexEvent[];

        for (let bot of bots) {
            this._botMap.set(bot.id, bot);

            const tags = tagsOnBot(bot);
            for (let tag of tags) {
                let list = this._botList(tag);
                list.add(bot.id);

                events.push({
                    type: 'bot_tag_added',
                    bot: bot,
                    tag: tag,
                });
            }
        }

        this._issueEvents(events);
        return events;
    }

    /**
     * Updates the given bots in the index by adding new tags and removing old tags.
     * @param bots The bot that were updated.
     */
    updateBots(bots: BotIndexUpdate[]) {
        let events = [] as BotIndexEvent[];
        for (let update of bots) {
            const bot = update.bot;
            const tags = update.tags;
            if (!bot || !tags) {
                continue;
            }
            let oldBot = this._botMap.get(bot.id);
            this._botMap.set(bot.id, bot);

            for (let tag of tags) {
                let list = this._botList(tag);
                let val = calculateBotValue(null, bot, tag);
                if (hasValue(val)) {
                    if (!list.has(bot.id)) {
                        list.add(bot.id);
                        events.push({
                            type: 'bot_tag_added',
                            bot: bot,
                            tag: tag,
                        });
                    } else {
                        events.push({
                            type: 'bot_tag_updated',
                            bot: bot,
                            oldBot: oldBot,
                            tag: tag,
                        });
                    }
                } else {
                    list.delete(bot.id);
                    events.push({
                        type: 'bot_tag_removed',
                        bot: bot,
                        oldBot: oldBot,
                        tag: tag,
                    });
                }
            }
        }

        this._issueEvents(events);
        return events;
    }

    /**
     * Removes the given bots from the index.
     * @param botIds The bots that were removed.
     */
    removeBots(botIds: string[]) {
        let events = [] as BotIndexEvent[];
        for (let botId of botIds) {
            const bot = this._botMap.get(botId);
            if (!bot) {
                continue;
            }
            this._botMap.delete(bot.id);

            const tags = tagsOnBot(bot);
            for (let tag of tags) {
                let list = this._botList(tag);
                list.delete(bot.id);

                events.push({
                    type: 'bot_tag_removed',
                    bot: bot,
                    oldBot: bot,
                    tag: tag,
                });
            }
        }

        this._issueEvents(events);
        return events;
    }

    /**
     * Watches the given tag for changes.
     * @param tag The tag to watch.
     */
    watchTag(tag: string) {
        return this._events.pipe(
            map((events) => events.filter((e) => e.tag === tag)),
            filter((events) => events.length > 0),
            startWith(
                this.findBotsWithTag(tag).map(
                    (bot) =>
                        <BotIndexEvent>{
                            type: 'bot_tag_added',
                            bot: bot,
                            tag: tag,
                        }
                )
            )
        );
    }

    private _issueEvents(events: BotIndexEvent[]) {
        if (events.length > 0) {
            if (this._batch !== null) {
                this._batch.push(...events);
            } else {
                this._events.next(events);
            }
        }
    }

    private _botList(tag: string): Set<string> {
        let list = this._tagMap.get(tag);
        if (!list) {
            list = new Set<string>();
            this._tagMap.set(tag, list);
        }
        return list;
    }
}

export interface BotIndexUpdate {
    bot: Bot;
    tags: Set<string>;
}
