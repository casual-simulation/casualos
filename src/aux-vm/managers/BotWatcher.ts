/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type {
    PrecalculatedBot,
    BotIndex,
    StateUpdatedEvent,
    BotTags,
} from '@casual-simulation/aux-common';
import {
    tagsOnBot,
    applyUpdates,
    hasValue,
} from '@casual-simulation/aux-common';
import type { Observable, SubscriptionLike } from 'rxjs';
import { Subject } from 'rxjs';
import {
    mergeMap,
    filter,
    startWith,
    tap,
    takeUntil,
    first,
    endWith,
    map,
    mergeWith,
} from 'rxjs/operators';
import { values } from 'lodash';
import type { BotHelper } from './BotHelper';
import type { TagEditOp } from '@casual-simulation/aux-common/bots';
import {
    isTagEdit,
    stateUpdatedEvent,
} from '@casual-simulation/aux-common/bots';
import type { VersionVector } from '@casual-simulation/aux-common';
import type { RuntimeStateVersion } from '@casual-simulation/aux-runtime/runtime/RuntimeStateVersion';
import { updateRuntimeVersion } from '@casual-simulation/aux-runtime/runtime/RuntimeStateVersion';

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
    private _botTagUpdatedObservables: Map<
        string,
        { tag: string; space: string; subject: Subject<BotTagChange> }[]
    >;
    private _lastVersion: RuntimeStateVersion;
    private _stateUpdated: Observable<StateUpdatedEvent>;

    closed: boolean = false;

    get stateUpdated(): Observable<StateUpdatedEvent> {
        return this._stateUpdated.pipe(
            startWith(stateUpdatedEvent(this._helper.botsState))
        );
    }

    /**
     * Gets an observable that resolves whenever a new bot is discovered.
     * That is, it was created or added by another user.
     */
    get botsDiscovered(): Observable<PrecalculatedBot[]> {
        const bots = values(this._helper.botsState);
        if (bots.length > 0) {
            return this._botsDiscoveredObservable.pipe(startWith(bots));
        } else {
            return this._botsDiscoveredObservable;
        }
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

    get latestVersion() {
        return this._lastVersion;
    }

    get localSites() {
        return this.latestVersion.localSites;
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
        stateUpdated: Observable<StateUpdatedEvent>,
        versionUpdated: Observable<RuntimeStateVersion>
    ) {
        this._stateUpdated = stateUpdated;
        this._helper = helper;
        this._index = index;
        this._botsDiscoveredObservable = new Subject<PrecalculatedBot[]>();
        this._botsRemovedObservable = new Subject<string[]>();
        this._botsUpdatedObservable = new Subject<PrecalculatedBot[]>();
        this._botTagsUpdatedObservable = new Subject<UpdatedBotInfo[]>();
        this._botTagUpdatedObservables = new Map();
        this._lastVersion = {
            localSites: {},
            vector: {},
        };

        this._subs.push(
            stateUpdated
                .pipe(
                    tap((update) => {
                        this._helper.botsState = applyUpdates(
                            this._helper.botsState,
                            update
                        );
                    })
                )
                .subscribe({
                    next: (update) => {
                        const added = update.addedBots.map(
                            (id) => this._helper.botsState[id]
                        );
                        const updated = update.updatedBots
                            .map((id) => this._helper.botsState[id])
                            .filter((u) => !!u);
                        const tagUpdates = update.updatedBots
                            .map((id) => {
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
                            .filter((u) => !!u.bot);

                        this._lastVersion = updateRuntimeVersion(
                            update.version,
                            this._lastVersion
                        );

                        if (added.length > 0) {
                            this._botsDiscoveredObservable.next(added);
                        }
                        if (update.removedBots.length > 0) {
                            this._botsRemovedObservable.next(
                                update.removedBots
                            );
                        }
                        if (updated.length > 0) {
                            this._botsUpdatedObservable.next(updated);
                        }
                        if (tagUpdates.length > 0) {
                            this._botTagsUpdatedObservable.next(tagUpdates);
                        }

                        let ids = [...update.addedBots, ...update.updatedBots];
                        for (let id of ids) {
                            if (!this._botTagUpdatedObservables.has(id)) {
                                continue;
                            }
                            let observers =
                                this._botTagUpdatedObservables.get(id);
                            if (observers.length <= 0) {
                                continue;
                            }
                            let u = update.state[id];
                            let bot = this._helper.botsState[id];

                            if (u.tags) {
                                sendTagChangeEventsForTags(
                                    observers,
                                    bot,
                                    u.tags,
                                    null,
                                    update.version &&
                                        hasValue(update.version.currentSite)
                                        ? update.version.vector
                                        : this._lastVersion.vector
                                );
                            }

                            if (u.masks) {
                                for (let space in u.masks) {
                                    let filtered = observers.filter(
                                        (o) => o.space === space
                                    );
                                    if (filtered.length <= 0) {
                                        continue;
                                    }
                                    sendTagChangeEventsForTags(
                                        filtered,
                                        bot,
                                        u.masks[space],
                                        space,
                                        update.version &&
                                            hasValue(update.version.currentSite)
                                            ? update.version.vector
                                            : this._lastVersion.vector
                                    );
                                }
                            }
                        }

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
                    error: (err) => console.error(err),
                }),
            versionUpdated.subscribe({
                next: (v) => {
                    this._lastVersion = v;
                },
                error: (err) => console.error(err),
            })
        );
    }

    /**
     * Creates an observable that resolves whenever the bot with the given ID changes.
     * @param bot The bot ID to watch.
     */
    botChanged(id: string): Observable<PrecalculatedBot> {
        const bot = this._helper.botsState ? this._helper.botsState[id] : null;
        const added = this._botsDiscoveredObservable.pipe(
            mergeMap((bots) => bots)
        );
        const updated = this.botsUpdated.pipe(mergeMap((bots) => bots));
        return updated.pipe(
            mergeWith(added),
            takeUntil(
                this.botsRemoved.pipe(
                    mergeMap((botIds) => botIds),
                    first((botId) => botId === id)
                )
            ),
            filter((u) => u.id === id),
            startWith(bot),
            filter((f) => !!f),
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
            mergeMap((bots) => bots),
            map((bot) => ({
                bot,
                tags: new Set(tagsOnBot(bot)),
            }))
        );
        const updated = this.botTagsUpdated.pipe(mergeMap((bots) => bots));
        return updated.pipe(
            mergeWith(added),
            takeUntil(
                this.botsRemoved.pipe(
                    mergeMap((botIds) => botIds),
                    first((botId) => botId === id)
                )
            ),
            filter((u) => u.bot.id === id),
            startWith({
                bot,
                tags: new Set(bot ? tagsOnBot(bot) : []),
            }),
            filter((f) => !!f && !!f.bot),
            endWith(null as UpdatedBotInfo)
        );
    }

    /**
     * Creates an observable that resolves whenever the given tag on the given bot changes.
     * @param id The ID of the bot.
     * @param tag The tag to watch.
     * @param space The space that the tag is in if it is a tag mask.
     */
    botTagChanged(
        id: string,
        tag: string,
        space: string = null
    ): Observable<BotTagChange> {
        const _this = this;
        let observers = this._botTagUpdatedObservables.get(id);
        let observer = observers?.find(
            (o) => o.tag === tag && o.space === space
        );
        if (observer) {
            return wrap(observer.subject);
        }

        observer = {
            tag: tag,
            space: space,
            subject: new Subject(),
        };

        if (!observers) {
            observers = [];
            this._botTagUpdatedObservables.set(id, observers);
        }
        observers.push(observer);
        return wrap(observer.subject);

        function wrap(subject: Subject<BotTagChange>) {
            const bot = _this._helper.botsState
                ? _this._helper.botsState[id] || null
                : null;

            return subject.pipe(
                takeUntil(
                    _this.botsRemoved.pipe(
                        mergeMap((botIds) => botIds),
                        first((botId) => botId === id)
                    )
                ),
                startWith({
                    type: 'update',
                    bot,
                    tag,
                    space,
                    version: _this._lastVersion.vector,
                } as BotTagChange),
                endWith(null as BotTagChange)
            );
        }
    }

    unsubscribe(): void {
        if (!this.closed) {
            this.closed = true;
            this._subs.forEach((s) => s.unsubscribe());
            this._subs = null;
        }
    }
}

function sendTagChangeEventsForTags(
    observers: BotTagObserver[],
    bot: PrecalculatedBot,
    tags: BotTags,
    space: string,
    latestVersion: VersionVector
) {
    for (let tag in tags) {
        let o = observers.find((a) => a.tag === tag && a.space === space);
        if (!o) {
            continue;
        }

        const val = tags[tag];
        if (isTagEdit(val)) {
            o.subject.next({
                type: 'edit',
                bot: bot,
                tag: tag,
                space: space,
                operations: val.operations,
                version: val.version,
            });
        } else {
            o.subject.next({
                type: 'update',
                bot: bot,
                tag: tag,
                space: space,
                version: latestVersion,
            });
        }
    }
}

interface BotTagObserver {
    tag: string;
    space: string;
    subject: Subject<BotTagChange>;
}

export type BotTagChange = BotTagEdit | BotTagUpdate;

/**
 * Defines an interface that represents an edit to a bot tag.
 */
export interface BotTagEdit {
    type: 'edit';
    /**
     * The updated bot.
     */
    bot: PrecalculatedBot;

    /**
     * The tag that was changed.
     */
    tag: string;

    /**
     * The space that the tag is saved in.
     * Null if a normal tag.
     * Set to a value if a tag mask.
     */
    space: string;

    /**
     * The version that the update occurred at.
     */
    version: VersionVector;

    /**
     * The edit operations.
     */
    operations: TagEditOp[][];
}

/**
 * Defines an interface that represents an update to a bot tag.
 */
export interface BotTagUpdate {
    type: 'update';

    /**
     * The updated bot.
     */
    bot: PrecalculatedBot;

    /**
     * The tag that was changed.
     */
    tag: string;

    /**
     * The version that the update occurred at.
     */
    version: VersionVector;

    /**
     * The space that the tag is saved in.
     * Null if a normal tag.
     * Set to a value if a tag mask.
     */
    space: string;
}
