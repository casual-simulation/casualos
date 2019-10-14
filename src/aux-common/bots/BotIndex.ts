import { Bot } from './Bot';
import { tagsOnBot, hasValue } from './BotCalculations';
import { Subject } from 'rxjs';
import { filter } from 'rxjs/operators';

/**
 * Defines a union type for bot index events.
 */
export type BotIndexEvent = BotTagAddedEvent | BotTagRemovedEvent;

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
 * Defines an index that is optimized for looking up bots by their tags.
 */
export class BotIndex {
    /**
     * The index events.
     */
    private _events = new Subject<BotIndexEvent>();

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
     * Adds the given bot to the index.
     * @param bot The bot to add.
     */
    addBot(bot: Bot) {
        this._botMap.set(bot.id, bot);

        const tags = tagsOnBot(bot);
        for (let tag of tags) {
            let list = this._botList(tag);
            list.add(bot.id);

            this._events.next({
                type: 'bot_tag_added',
                bot: bot,
                tag: tag,
            });
        }
    }

    /**
     * Updates the given bot in the index by adding new tags and removing old tags.
     * @param bot The bot that was updated.
     * @param tags The tags that were updated on the bot.
     */
    updateBot(bot: Bot, tags: IterableIterator<string> | string[]) {
        this._botMap.set(bot.id, bot);

        for (let tag of tags) {
            let list = this._botList(tag);
            let val = bot.tags[tag];
            if (hasValue(val)) {
                if (!list.has(bot.id)) {
                    list.add(bot.id);
                    this._events.next({
                        type: 'bot_tag_added',
                        bot: bot,
                        tag: tag,
                    });
                }
            } else {
                list.delete(bot.id);
                this._events.next({
                    type: 'bot_tag_removed',
                    bot: bot,
                    tag: tag,
                });
            }
        }
    }

    /**
     * Removes the given bot from the index.
     * @param bot The bot that was removed.
     */
    removeBot(botId: string) {
        const bot = this._botMap.get(botId);
        if (!bot) {
            return;
        }
        this._botMap.delete(bot.id);

        const tags = tagsOnBot(bot);
        for (let tag of tags) {
            let list = this._botList(tag);
            list.delete(bot.id);

            this._events.next({
                type: 'bot_tag_removed',
                bot: bot,
                tag: tag,
            });
        }
    }

    watchTag(tag: string) {
        return this._events.pipe(filter(e => e.tag === tag));
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
