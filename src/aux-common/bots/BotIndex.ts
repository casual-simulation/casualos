import { Bot } from './Bot';
import { tagsOnBot, hasValue } from './BotCalculations';
import { Subject } from 'rxjs';
import { filter, startWith, map } from 'rxjs/operators';

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
 * Defines an event that indicatese a bot has removed the value for a tag.
 */
export interface BotTagRemovedEvent {
    type: 'bot_tag_removed';
    bot: Bot;
    tag: string;
}

/**
 * Defines an event that indicatese a bot has updated the value for a tag.
 */
export interface BotTagUpdatedEvent {
    type: 'bot_tag_updated';
    bot: Bot;
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
        return [...list.values()].map(id => this._botMap.get(id));
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

        if (events.length > 0) {
            this._events.next(events);
        }
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
            this._botMap.set(bot.id, bot);

            for (let tag of tags) {
                let list = this._botList(tag);
                let val = bot.tags[tag];
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
                            tag: tag,
                        });
                    }
                } else {
                    list.delete(bot.id);
                    events.push({
                        type: 'bot_tag_removed',
                        bot: bot,
                        tag: tag,
                    });
                }
            }
        }

        if (events.length > 0) {
            this._events.next(events);
        }
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
                return;
            }
            this._botMap.delete(bot.id);

            const tags = tagsOnBot(bot);
            for (let tag of tags) {
                let list = this._botList(tag);
                list.delete(bot.id);

                events.push({
                    type: 'bot_tag_removed',
                    bot: bot,
                    tag: tag,
                });
            }
        }

        if (events.length > 0) {
            this._events.next(events);
        }
        return events;
    }

    watchTag(tag: string) {
        return this._events.pipe(
            map(events => events.filter(e => e.tag === tag)),
            filter(events => events.length > 0),
            startWith(
                this.findBotsWithTag(tag).map(
                    bot =>
                        <BotIndexEvent>{
                            type: 'bot_tag_added',
                            bot: bot,
                            tag: tag,
                        }
                )
            )
        );
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
