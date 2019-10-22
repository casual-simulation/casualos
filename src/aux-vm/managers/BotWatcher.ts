import {
    Bot,
    PrecalculatedBot,
    merge,
    BotIndex,
    BotIndexEvent,
} from '@casual-simulation/aux-common';
import { Subject, Observable, SubscriptionLike } from 'rxjs';
import {
    flatMap,
    filter,
    startWith,
    tap,
    takeUntil,
    first,
    endWith,
} from 'rxjs/operators';
import { values, omitBy, keys } from 'lodash';
import { StateUpdatedEvent } from './StateUpdatedEvent';
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
                        if (this._helper.botsState) {
                            let updatedState = omitBy(
                                merge(this._helper.botsState, update.state),
                                val => val === null
                            );

                            for (let id in update.state) {
                                let botUpdate: Partial<Bot> = update.state[id];
                                if (!botUpdate) {
                                    continue;
                                }
                                let bot = updatedState[id];
                                for (let tag in botUpdate.tags) {
                                    if (bot.tags[tag] === null) {
                                        delete bot.tags[tag];
                                        delete bot.values[tag];
                                    }
                                }
                            }

                            this._helper.botsState = updatedState;
                        } else {
                            this._helper.botsState = update.state;
                        }
                    })
                )
                .subscribe(
                    update => {
                        const added = update.addedBots.map(
                            id => this._helper.botsState[id]
                        );
                        const updated = update.updatedBots.map(
                            id => this._helper.botsState[id]
                        );
                        const tagUpdates = update.updatedBots.map(id => {
                            let u = update.state[id];
                            let tags = u && u.tags ? keys(u.tags) : [];
                            let valueTags = u && u.values ? keys(u.values) : [];
                            let bot = this._helper.botsState[id];
                            return {
                                bot,
                                tags: new Set([...tags, ...valueTags]),
                            };
                        });

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
        return this.botsUpdated.pipe(
            flatMap(bots => bots),
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
        return this.botTagsUpdated.pipe(
            flatMap(bots => bots),
            takeUntil(
                this.botsRemoved.pipe(
                    flatMap(botIds => botIds),
                    first(botId => botId === id)
                )
            ),
            filter(u => u.bot.id === id),
            startWith({
                bot,
                tags: new Set<string>(),
            }),
            filter(f => !!f),
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
