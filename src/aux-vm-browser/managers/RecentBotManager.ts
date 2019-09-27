import { BotHelper } from '@casual-simulation/aux-vm';
import {
    Bot,
    doBotsAppearEqual,
    isDiff,
    getContexts,
    isWellKnownOrContext,
    PrecalculatedBot,
    createPrecalculatedBot,
    FileTags,
} from '@casual-simulation/aux-common';
import { Subject, Observable } from 'rxjs';

/**
 * Defines a class that helps manage recent bots.
 */
export class RecentBotManager {
    private _helper: BotHelper;
    private _onUpdated: Subject<void>;
    private _selectedRecentFile: PrecalculatedBot = null;

    /**
     * The bots that have been stored in the recent bots manager.
     */
    bots: PrecalculatedBot[];

    /**
     * The maximum number of bots that the recents list can contain.
     */
    maxNumberOfFiles: number = 1;

    /**
     * Gets an observable that resolves whenever the bots list has been updated.
     */
    get onUpdated(): Observable<void> {
        return this._onUpdated;
    }

    /**
     * Gets the bot that was selected from the recents list.
     */
    get selectedRecentBot() {
        return this._selectedRecentFile;
    }

    /**
     * Sets the bot that was selected from the recents list.
     */
    set selectedRecentBot(bot: PrecalculatedBot) {
        this._selectedRecentFile = bot;
        this._onUpdated.next();
    }

    /**
     * Creates a new RecentBotManager.
     * @param helper The bot helper.
     */
    constructor(helper: BotHelper) {
        this._helper = helper;
        this._onUpdated = new Subject<void>();
        this.bots = [createPrecalculatedBot('empty')];
    }

    /**
     * Adds a diffball that represents the given bot ID, tag, and value.
     * @param botId The ID of the bot that the diff represents.
     * @param tag The tag that the diff contains.
     * @param value The value that the diff contains.
     */
    addTagDiff(botId: string, tag: string, value: any) {
        this._cleanBots(botId);
        let tags = {
            [tag]: value,
            'aux.mod': true,
            'aux.mod.mergeTags': [tag],
        };
        this.bots.unshift({
            id: botId,
            precalculated: true,
            tags: tags,
            values: tags,
        });
        this._trimList();
        this._updateSelectedRecentBot();
        this._onUpdated.next();
    }

    /**
     * Adds the given bot to the recents list.
     * @param bot The bot to add.
     * @param updateTags Whether to update the diff tags.
     */
    addBotDiff(bot: Bot, updateTags: boolean = false) {
        const calc = this._helper.createContext();
        const contexts = getContexts(calc);
        let id: string;
        if (isDiff(null, bot) && bot.id.indexOf('mod-') === 0) {
            id = bot.id;
        } else {
            id = `mod-${bot.id}`;
        }
        this._cleanBots(id, bot);

        let {
            'aux.mod': diff,
            'aux.mod.mergeTags': modTags,
            ...others
        } = bot.tags;

        let tagsObj: FileTags = {};
        let diffTags: string[] = [];
        if (updateTags || !modTags) {
            for (let tag in others) {
                if (!isWellKnownOrContext(tag, contexts)) {
                    tagsObj[tag] = others[tag];
                    diffTags.push(tag);
                }
            }
        } else {
            for (let tag of <string[]>modTags) {
                tagsObj[tag] = bot.tags[tag];
                diffTags.push(tag);
            }
        }

        // let diffTags: string[] =
        //     updateTags || !modTags
        //         ? keys(others).filter(t => !isWellKnownOrContext(t, contexts))
        //         : <string[]>modTags;

        let tags =
            diffTags.length > 0
                ? {
                      'aux.mod': true,
                      'aux.mod.mergeTags': diffTags,
                      ...tagsObj,
                  }
                : {};
        const f =
            diffTags.length > 0
                ? {
                      id: id,
                      precalculated: true as const,
                      tags: tags,
                      values: tags,
                  }
                : createPrecalculatedBot('empty');
        this.bots.unshift(f);
        this._trimList();
        this._updateSelectedRecentBot();
        this._onUpdated.next();
    }

    private _updateSelectedRecentBot() {
        if (this.selectedRecentBot) {
            let bot = this.bots.find(f => f.id === this.selectedRecentBot.id);
            this.selectedRecentBot = bot || null;
        }
    }

    /**
     * Clears the bots list.
     */
    clear() {
        this.bots = [createPrecalculatedBot('empty')];
        this._onUpdated.next();
    }

    private _cleanBots(botId: string, bot?: Bot) {
        for (let i = this.bots.length - 1; i >= 0; i--) {
            let f = this.bots[i];

            if (f.id === botId || (bot && doBotsAppearEqual(bot, f))) {
                this.bots.splice(i, 1);
            }
        }
    }

    private _trimList() {
        if (this.bots.length > this.maxNumberOfFiles) {
            this.bots.length = this.maxNumberOfFiles;
        }
    }
}
