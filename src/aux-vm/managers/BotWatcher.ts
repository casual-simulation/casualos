import {
    Bot,
    PrecalculatedBot,
    merge,
    BotIndex,
    BotIndexEvent,
    tagsOnBot,
    StateUpdatedEvent,
    applyUpdates,
} from '@casual-simulation/aux-common';
import { Subject, Observable, SubscriptionLike, never } from 'rxjs';
import {
    flatMap,
    filter,
    startWith,
    tap,
    takeUntil,
    first,
    endWith,
    merge as rxMerge,
    map,
} from 'rxjs/operators';
import values from 'lodash/values';
import omitBy from 'lodash/omitBy';
import { BotHelper } from './BotHelper';

/**
 * Defines an interface that contains information about an updated bot.
 */
export interface UpdatedBotInfo {
    /**
     * The bot that was updated.
     */
    bot: PrecalculatedBot;

    /**
     * The tags that were updated on the bot.
     */
    tags: Set<string>;
}

/**
 * Defines a class that can watch a realtime causal tree.
 */
export class BotWatcher implements SubscriptionLike {
    private _botsDiscoveredObservable: Subject<PrecalculatedBot[]>;
    private _botsRemovedObservable: Subject<string[]>;
    private _botsUpdatedObservable: Subject<PrecalculatedBot[]>;
    private _botTagsUpdatedObservable: Subject<UpdatedBotInfo[]>;
    private _subs: SubscriptionLike[] = [];
    private _helper: BotHelper;
    private _index: BotIndex;

    closed: boolean = false;

    /**
     * Gets an observable that resolves whenever a new bot is discovered.
     * That is, it was created or added by another user.
     */
    get botsDiscovered(): Observable<PrecalculatedBot[]> {
        return this._botsDiscoveredObservable.pipe(
            startWith(values(this._helper.botsState))
        );
    }

    /**
     * Gets an observable that resolves whenever a bot is removed.
     * That is, it was deleted from the working directory either by checking out a
     * branch that does not contain the bot or by deleting it.
     */
    get botsRemoved(): Observable<string[]> {
        return this._botsRemovedObservable;
    }

    /**
     * Gets an observable that resolves whenever a bot is updated.
     */
    get botsUpdated(): Observable<PrecalculatedBot[]> {
        return this._botsUpdatedObservable;
    }

    /**
     * Gets an observable that resolves whenever a bot is updated.
     */
    get botTagsUpdated(): Observable<UpdatedBotInfo[]> {
        return this._botTagsUpdatedObservable;
    }

    /**
     * Creates a new bot watcher.
     * @param helper The bot helper.
     * @param index The bot index.
     * @param stateUpdated The observable that resolves whenever the bot state is updated.
     */
    constructor(
        helper: BotHelper,
        index: BotIndex,
        stateUpdated: Observable<StateUpdatedEvent>
    ) {
        this._helper = helper;
        this._index = index;
        this._botsDiscoveredObservable = new Subject<PrecalculatedBot[]>();
        this._botsRemovedObservable = new Subject<string[]>();
        this._botsUpdatedObservable = new Subject<PrecalculatedBot[]>();
        this._botTagsUpdatedObservable = new Subject<UpdatedBotInfo[]>();

        this._subs.push(
            stateUpdated
                .pipe(
                    tap(update => {
                        this._helper.botsState = applyUpdates(
                            this._helper.botsState,
                            update
                        );
                    })
                )
                .subscribe(
                    update => {
                        const added = update.addedBots.map(
                            id => this._helper.botsState[id]
                        );
                        const updated = update.updatedBots
                            .map(id => this._helper.botsState[id])
                            .filter(u => !!u);
                        const tagUpdates = update.updatedBots
                            .map(id => {
                                let u = update.state[id];
                                let tags =
                                    u && u.tags ? Object.keys(u.tags) : [];
                                let valueTags =
                                    u && u.values ? Object.keys(u.values) : [];
                                let bot = this._helper.botsState[id];
                                return {
                                    bot,
                                    tags: new Set([...tags, ...valueTags]),
                                };
                            })
                            .filter(u => !!u.bot);

                        this._botsDiscoveredObservable.next(added);
                        this._botsRemovedObservable.next(update.removedBots);
                        this._botsUpdatedObservable.next(updated);
                        this._botTagsUpdatedObservable.next(tagUpdates);

                        this._index.batch(() => {
                            if (added.length > 0) {
                                this._index.addBots(added);
                            }
                            if (update.removedBots.length > 0) {
                                this._index.removeBots(update.removedBots);
                            }
                            if (tagUpdates.length > 0) {
                                this._index.updateBots(tagUpdates);
                            }
                        });
                    },
                    err => console.error(err)
                )
        );
    }

    /**
     * Creates an observable that resolves whenever the bot with the given ID changes.
     * @param bot The bot ID to watch.
     */
    botChanged(id: string): Observable<PrecalculatedBot> {
        const bot = this._helper.botsState ? this._helper.botsState[id] : null;
        const added = this._botsDiscoveredObservable.pipe(
            flatMap(bots => bots)
        );
        const updated = this.botsUpdated.pipe(flatMap(bots => bots));
        return updated.pipe(
            rxMerge(added),
            takeUntil(
                this.botsRemoved.pipe(
                    flatMap(botIds => botIds),
                    first(botId => botId === id)
                )
            ),
            filter(u => u.id === id),
            startWith(bot),
            filter(f => !!f),
            endWith(null)
        );
    }

    /**
     * Creates an observable that resolves whenever the bot with the given ID changes.
     * @param id The bot ID to watch.
     */
    botTagsChanged(id: string): Observable<UpdatedBotInfo> {
        const bot = this._helper.botsState ? this._helper.botsState[id] : null;
        const added = this._botsDiscoveredObservable.pipe(
            flatMap(bots => bots),
            map(bot => ({
                bot,
                tags: new Set(tagsOnBot(bot)),
            }))
        );
        const updated = this.botTagsUpdated.pipe(flatMap(bots => bots));
        return updated.pipe(
            rxMerge(added),
            takeUntil(
                this.botsRemoved.pipe(
                    flatMap(botIds => botIds),
                    first(botId => botId === id)
                )
            ),
            filter(u => u.bot.id === id),
            startWith({
                bot,
                tags: new Set(bot ? tagsOnBot(bot) : []),
            }),
            filter(f => !!f && !!f.bot),
            endWith(null)
        );
    }

    unsubscribe(): void {
        if (!this.closed) {
            this.closed = true;
            this._subs.forEach(s => s.unsubscribe());
            this._subs = null;
        }
    }
}
