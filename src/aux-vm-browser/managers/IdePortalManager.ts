import {
    Subject,
    Observable,
    BehaviorSubject,
    merge,
    from,
    SubscriptionLike,
} from 'rxjs';
import { flatMap, tap, withLatestFrom, bufferTime } from 'rxjs/operators';
import { BotHelper, BotWatcher } from '@casual-simulation/aux-vm';
import {
    isBot,
    PrecalculatedBot,
    isPrecalculated,
    isExistingBot,
    createPrecalculatedBot,
    filterBotsBySelection,
    botsInDimension,
    SHEET_PORTAL,
    IDE_PORTAL,
    isPortalScript,
    DNA_TAG_PREFIX,
} from '@casual-simulation/aux-common';
import {
    PortalManager,
    UpdatedBotInfo,
} from '@casual-simulation/aux-vm/managers';
import { sortBy } from 'lodash';

export type IdeNode = IdeFolderNode | IdeTagNode;

export interface IdeFolderNode {
    type: 'folder';
    name: string;
    key: string;
    children: IdeNode[];
}

export interface IdeTagNode {
    type: 'tag';
    botId: string;
    tag: string;
    key: string;
    name: string;

    prefix?: string;
    isScript?: boolean;
    isFormula?: boolean;
}

export interface IdePortalUpdate {
    hasPortal: boolean;
    items: IdeNode[];
}

/**
 * Defines a class that manages the bot panel.
 */
export class IdePortalManager implements SubscriptionLike {
    private _helper: BotHelper;
    private _watcher: BotWatcher;
    private _buffer: boolean;

    private _itemsUpdated: BehaviorSubject<IdePortalUpdate>;

    private _subs: SubscriptionLike[] = [];
    closed: boolean = false;

    /**
     * Gets an observable that resolves whenever the list of selected bots is updated.
     */
    get itemsUpdated(): Observable<IdePortalUpdate> {
        return this._itemsUpdated;
    }

    /**
     * Creates a new bot panel manager.
     * @param watcher The bot watcher to use.
     * @param helper The bot helper to use.
     * @param bufferEvents Whether to buffer the update events.
     */
    constructor(
        watcher: BotWatcher,
        helper: BotHelper,
        bufferEvents: boolean = true
    ) {
        this._watcher = watcher;
        this._helper = helper;
        this._buffer = bufferEvents;
        this._itemsUpdated = new BehaviorSubject<IdePortalUpdate>({
            hasPortal: false,
            items: [],
        });

        this._subs.push(
            this._calculateItemsUpdated().subscribe(this._itemsUpdated)
        );
    }

    unsubscribe(): void {
        if (!this.closed) {
            this.closed = true;
            this._subs.forEach((s) => s.unsubscribe());
            this._subs = null;
        }
    }

    private _findMatchingItems(): IdePortalUpdate {
        if (!this._helper.userBot) {
            return {
                hasPortal: false,
                items: [],
            };
        }
        const prefix = this._helper.userBot.tags[IDE_PORTAL];
        if (prefix) {
            let items = [] as IdeNode[];
            for (let bot of this._helper.objects) {
                if (bot.id === this._helper.userId) {
                    continue;
                }
                for (let tag in bot.values) {
                    if (isPortalScript(prefix, bot.tags[tag])) {
                        let item: IdeTagNode = {
                            type: 'tag',
                            botId: bot.id,
                            tag: tag,
                            name: tag,
                            key: `${bot.id}.${tag}`,
                        };

                        if (prefix === '@') {
                            item.isScript = true;
                        } else if (prefix === DNA_TAG_PREFIX) {
                            item.isFormula = true;
                        } else {
                            item.prefix = prefix;
                        }

                        items.push(item);
                    }
                }
            }
            return {
                hasPortal: true,
                items: sortBy(items, (item) => item.key),
            };
        }

        return {
            hasPortal: false,
            items: [],
        };
    }

    private _calculateItemsUpdated(): Observable<IdePortalUpdate> {
        const allBotsSelectedUpdatedAddedAndRemoved = merge(
            this._watcher.botsDiscovered,
            this._watcher.botsUpdated,
            this._watcher.botsRemoved
        );
        const bufferedEvents: Observable<any> = this._buffer
            ? allBotsSelectedUpdatedAddedAndRemoved.pipe(bufferTime(10))
            : allBotsSelectedUpdatedAddedAndRemoved;
        return bufferedEvents.pipe(
            flatMap(async () => {
                const items = this._findMatchingItems();
                return items;
            })
        );
    }
}
