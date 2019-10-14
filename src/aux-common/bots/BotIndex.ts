import { Bot } from './Bot';
import { tagsOnBot, hasValue } from './BotCalculations';

/**
 * Defines an index that is optimized for looking up bots by their tags.
 */
export class BotIndex {
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
        }
    }

    /**
     * Updates the given bot in the index by adding new tags and removing old tags.
     * @param bot The bot that was updated.
     * @param tags The tags that were updated on the bot.
     */
    updateBot(bot: Bot, tags: string[]) {
        this._botMap.set(bot.id, bot);

        for (let tag of tags) {
            let list = this._botList(tag);
            let val = bot.tags[tag];
            if (hasValue(val)) {
                list.add(bot.id);
            } else {
                list.delete(bot.id);
            }
        }
    }

    /**
     * Removes the given bot from the index.
     * @param bot The bot that was removed.
     */
    removeBot(bot: Bot) {
        this._botMap.delete(bot.id);

        const tags = tagsOnBot(bot);
        for (let tag of tags) {
            let list = this._botList(tag);
            list.delete(bot.id);
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
