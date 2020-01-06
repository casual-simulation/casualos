import { BotHelper } from '@casual-simulation/aux-vm';
import {
    Bot,
    doBotsAppearEqual,
    getDimensions,
    isWellKnownOrDimension,
    PrecalculatedBot,
    createPrecalculatedBot,
    BotTags,
    isBotTags,
} from '@casual-simulation/aux-common';
import { Subject, Observable } from 'rxjs';

/**
 * Defines a class that helps manage the current mod.
 */
export class RecentBotManager {
    private _helper: BotHelper;
    private _onUpdated: Subject<void>;

    /**
     * The most recently edited bot.
     */
    bot: PrecalculatedBot;

    /**
     * Whether the bot is currently selected.
     */
    isSelected: boolean = false;

    /**
     * Gets an observable that resolves whenever the bots list has been updated.
     */
    get onUpdated(): Observable<void> {
        return this._onUpdated;
    }

    /**
     * Creates a new RecentBotManager.
     * @param helper The bot helper.
     */
    constructor(helper: BotHelper) {
        this._helper = helper;
        this._onUpdated = new Subject<void>();
        this.bot = createPrecalculatedBot('empty');
    }

    /**
     * Adds the given bot to the recents list.
     * @param bot The bot to add.
     * @param updateTags Whether to update the diff tags.
     */
    addBotDiff(bot: Bot | BotTags, updateTags: boolean = false) {
        const calc = this._helper.createContext();
        const contexts = getDimensions(calc);

        let tags: BotTags;
        if (isBotTags(bot)) {
            tags = bot;
        } else {
            tags = bot.tags;
        }

        let finalTags: BotTags = {};
        let hasTag = false;
        for (let tag in tags) {
            if (!isWellKnownOrDimension(tag, contexts)) {
                finalTags[tag] = tags[tag];
                hasTag = true;
            }
        }

        const id = hasTag ? 'mod' : 'empty';
        const finalBot = createPrecalculatedBot(id, finalTags);

        this.bot = finalBot;
        this._onUpdated.next();
    }

    /**
     * Clears the bots list.
     */
    clear() {
        this.bot = createPrecalculatedBot('empty');
        this._onUpdated.next();
    }
}
