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
    MemoryPartition,
    AuxPartitionRealtimeStrategy,
} from './AuxPartition';
import type {
    PartitionConfig,
    MemoryPartitionStateConfig,
} from './AuxPartitionConfig';
import type {
    BotsState,
    BotAction,
    Bot,
    UpdatedBot,
    AddBotAction,
    RemoveBotAction,
    UpdateBotAction,
    StateUpdatedEvent,
    PartialBotsState,
    BotSpace,
} from '../bots';
import {
    hasValue,
    getActiveObjects,
    breakIntoIndividualEvents,
    stateUpdatedEvent,
} from '../bots';
import type { Observable } from 'rxjs';
import { BehaviorSubject, Subject } from 'rxjs';
import { startWith } from 'rxjs/operators';
import { flatMap, union } from 'lodash';
import { merge } from '../utils';
import type { TagEdit, TagEditOp } from '../bots';
import { applyTagEdit, edits, isTagEdit } from '../bots';
import { v4 as uuid } from 'uuid';
import {
    ensureBotIsSerializable,
    ensureTagIsSerializable,
} from './PartitionUtils';
import type { Action, CurrentVersion, StatusUpdate } from '../common';

/**
 * Attempts to create a MemoryPartition from the given config.
 * @param config The config.
 */
export function createMemoryPartition(
    config: PartitionConfig
): MemoryPartition {
    if (config.type === 'memory') {
        if ('initialState' in config) {
            return new MemoryPartitionImpl(config);
        } else {
            return config.partition;
        }
    }
    return undefined;
}

export class MemoryPartitionImpl implements MemoryPartition {
    private _onBotsAdded = new Subject<Bot[]>();
    private _onBotsRemoved = new Subject<string[]>();
    private _onBotsUpdated = new Subject<UpdatedBot[]>();
    private _onStateUpdated = new Subject<StateUpdatedEvent>();
    private _onVersionUpdated: BehaviorSubject<CurrentVersion>;
    private _onError = new Subject<any>();
    private _onEvents = new Subject<Action[]>();
    private _onStatusUpdated = new Subject<StatusUpdate>();
    private _siteId: string;
    private _remoteSite: string;
    private _updateCounter: number = 0;

    type = 'memory' as const;
    state: BotsState;
    private: boolean;
    space: string;

    /**
     * A function that returns the version that should be used for state updates.
     */
    getCurrentVersion: () => CurrentVersion;

    get realtimeStrategy(): AuxPartitionRealtimeStrategy {
        return 'immediate';
    }

    get onBotsAdded(): Observable<Bot[]> {
        return this._onBotsAdded.pipe(startWith(getActiveObjects(this.state)));
    }

    get onBotsRemoved(): Observable<string[]> {
        return this._onBotsRemoved;
    }

    get onBotsUpdated(): Observable<UpdatedBot[]> {
        return this._onBotsUpdated;
    }

    get onStateUpdated(): Observable<StateUpdatedEvent> {
        return this._onStateUpdated.pipe(
            startWith(
                stateUpdatedEvent(this.state, this._getCurrentVersion(null))
            )
        );
    }

    get onVersionUpdated(): Observable<CurrentVersion> {
        return this._onVersionUpdated;
    }

    get onError(): Observable<any> {
        return this._onError;
    }

    get onEvents(): Observable<Action[]> {
        return this._onEvents;
    }

    get onStatusUpdated(): Observable<StatusUpdate> {
        return this._onStatusUpdated;
    }

    constructor(config: MemoryPartitionStateConfig) {
        this._siteId = config.localSiteId ?? uuid();
        this._remoteSite = config.remoteSiteId ?? uuid();
        this.private = config.private || false;
        this.state = config.initialState;
        this._onVersionUpdated = new BehaviorSubject<CurrentVersion>({
            currentSite: this._siteId,
            remoteSite: this._remoteSite,
            vector: {},
        });
    }

    async applyEvents(events: BotAction[]): Promise<BotAction[]> {
        let finalEvents = flatMap(events, (e) => {
            if (e.type === 'apply_state') {
                return breakIntoIndividualEvents(this.state, e);
            } else if (
                e.type === 'add_bot' ||
                e.type === 'remove_bot' ||
                e.type === 'update_bot'
            ) {
                return [e] as const;
            } else {
                return [];
            }
        });

        this._applyEvents(finalEvents);

        return [];
    }

    connect(): void {
        if (this.space) {
            for (let id in this.state) {
                const bot = this.state[id];
                bot.space = this.space as BotSpace;
            }
        }

        this._onStatusUpdated.next({
            type: 'connection',
            connected: true,
        });

        this._onStatusUpdated.next({
            type: 'authentication',
            authenticated: true,
        });

        this._onStatusUpdated.next({
            type: 'authorization',
            authorized: true,
        });

        this._onStatusUpdated.next({
            type: 'sync',
            synced: true,
        });
    }

    unsubscribe(): void {
        this.closed = true;
    }
    closed: boolean;

    private _applyEvents(
        events: (AddBotAction | RemoveBotAction | UpdateBotAction)[]
    ) {
        let added = new Map<string, Bot>();
        let removed: string[] = [];
        let updated = new Map<string, UpdatedBot>();
        let updatedState = {} as PartialBotsState;
        let nextVersion: CurrentVersion;
        // Flag to record if we have already created a new state object
        // during the update.
        let createdNewState = false;
        for (let event of events) {
            if (event.type === 'add_bot') {
                // console.log('[MemoryPartition] Add bot', event.bot);
                let bot = {
                    ...ensureBotIsSerializable(event.bot),
                    space: this.space as BotSpace,
                };
                if (createdNewState) {
                    this.state[event.bot.id] = bot;
                } else {
                    this.state = Object.assign({}, this.state, {
                        [event.bot.id]: bot,
                    });
                    createdNewState = true;
                }
                updatedState[event.bot.id] = bot;
                added.set(event.bot.id, bot);
            } else if (event.type === 'remove_bot') {
                if (createdNewState) {
                    delete this.state[event.id];
                } else {
                    let { [event.id]: removedBot, ...state } = this.state;
                    this.state = state;
                    createdNewState = true;
                }
                if (!added.delete(event.id)) {
                    removed.push(event.id);
                }
                updatedState[event.id] = null;
            } else if (event.type === 'update_bot') {
                if (event.update.tags && this.state[event.id]) {
                    let newBot = Object.assign({}, this.state[event.id]);
                    let changedTags: string[] = [];
                    let lastBot = updatedState[event.id];
                    const updatedBot = (updatedState[event.id] = merge(
                        updatedState[event.id] || {},
                        event.update
                    ));
                    for (let tag of Object.keys(event.update.tags)) {
                        const newVal = ensureTagIsSerializable(
                            event.update.tags[tag]
                        );
                        const oldVal = newBot.tags[tag];

                        if (
                            (newVal !== oldVal &&
                                (hasValue(newVal) || hasValue(oldVal))) ||
                            Array.isArray(newVal)
                        ) {
                            changedTags.push(tag);
                        }

                        if (hasValue(newVal)) {
                            if (isTagEdit(newVal)) {
                                newBot.tags[tag] = applyTagEdit(
                                    newBot.tags[tag],
                                    newVal
                                );
                                nextVersion = this.getNextVersion(newVal);

                                let combinedEdits = [] as TagEditOp[][];
                                if (lastBot) {
                                    const lastVal = lastBot.tags[tag];
                                    if (
                                        lastVal !== oldVal &&
                                        isTagEdit(lastVal)
                                    ) {
                                        combinedEdits = lastVal.operations;
                                    }
                                }

                                updatedBot.tags[tag] = edits(
                                    nextVersion.vector,
                                    ...combinedEdits,
                                    ...newVal.operations
                                );
                            } else {
                                newBot.tags[tag] = newVal;
                                updatedBot.tags[tag] = newVal;
                            }

                            if (!hasValue(newBot.tags[tag])) {
                                delete newBot.tags[tag];
                            }
                        } else if (hasValue(oldVal)) {
                            delete newBot.tags[tag];
                            updatedBot.tags[tag] = null;
                        } else {
                            delete newBot.tags[tag];
                            delete updatedBot.tags[tag];
                        }
                    }

                    this.state[event.id] = newBot;

                    let update = updated.get(event.id);
                    if (update) {
                        update.bot = newBot;
                        update.tags = union(update.tags, changedTags);
                    } else if (changedTags.length > 0) {
                        updated.set(event.id, {
                            bot: newBot,
                            tags: changedTags,
                        });
                    } else if (!added.has(event.id)) {
                        delete updatedState[event.id];
                    }
                }

                if (event.update.masks && event.update.masks[this.space]) {
                    const tags = event.update.masks[this.space];
                    let newBot = Object.assign({}, this.state[event.id]);
                    if (!newBot.masks) {
                        newBot.masks = {};
                    }
                    if (!newBot.masks[this.space]) {
                        newBot.masks[this.space] = {};
                    }
                    let lastMasks = updatedState[event.id]?.masks?.[this.space];
                    const masks = newBot.masks[this.space];
                    const updatedBot = (updatedState[event.id] = merge(
                        updatedState[event.id] || {},
                        event.update
                    ));
                    let changedTags: string[] = [];
                    for (let tag in tags) {
                        const newVal = ensureTagIsSerializable(tags[tag]);
                        const oldVal = masks[tag];

                        if (newVal !== oldVal) {
                            changedTags.push(tag);
                        }

                        if (hasValue(newVal)) {
                            if (isTagEdit(newVal)) {
                                masks[tag] = applyTagEdit(masks[tag], newVal);
                                nextVersion = this.getNextVersion(newVal);

                                let combinedEdits = [] as TagEditOp[][];
                                if (lastMasks) {
                                    const lastVal = lastMasks[tag];
                                    if (
                                        lastVal !== oldVal &&
                                        isTagEdit(lastVal)
                                    ) {
                                        combinedEdits = lastVal.operations;
                                    }
                                }

                                updatedBot.masks[this.space][tag] = edits(
                                    nextVersion.vector,
                                    ...combinedEdits,
                                    ...newVal.operations
                                );
                            } else {
                                masks[tag] = newVal;

                                if (newVal !== tags[tag]) {
                                    updatedBot.masks[this.space][tag] = newVal;
                                }
                            }
                        } else {
                            delete masks[tag];
                            updatedBot.masks[this.space][tag] = null;
                        }
                    }

                    if (newBot.masks) {
                        for (let space in event.update.masks) {
                            for (let tag in event.update.masks[this.space]) {
                                if (newBot.masks[space][tag] === null) {
                                    delete newBot.masks[space][tag];
                                }
                            }
                            if (Object.keys(newBot.masks[space]).length <= 0) {
                                delete newBot.masks[space];
                            }
                        }
                        if (
                            !!newBot.masks &&
                            Object.keys(newBot.masks).length <= 0
                        ) {
                            delete newBot.masks;
                        }
                    }

                    this.state[event.id] = newBot;
                }

                const updatedBot = updatedState[event.id];
                if (
                    updatedBot?.tags &&
                    Object.keys(updatedBot.tags).length <= 0
                ) {
                    delete updatedBot.tags;
                }
            }
        }

        if (added.size > 0) {
            this._onBotsAdded.next([...added.values()]);
        }
        if (removed.length > 0) {
            this._onBotsRemoved.next(removed);
        }
        if (updated.size > 0) {
            this._onBotsUpdated.next([...updated.values()]);
        }
        const updateEvent = stateUpdatedEvent(
            updatedState,
            this._getCurrentVersion(nextVersion)
        );
        if (
            updateEvent.addedBots.length > 0 ||
            updateEvent.removedBots.length > 0 ||
            updateEvent.updatedBots.length > 0
        ) {
            this._onStateUpdated.next(updateEvent);
        }
        if (nextVersion) {
            this._onVersionUpdated.next(nextVersion);
        }
    }

    private _getCurrentVersion(nextVersion: CurrentVersion): CurrentVersion {
        return this.getCurrentVersion
            ? this.getCurrentVersion()
            : nextVersion ?? this._onVersionUpdated.value;
    }

    /**
     * Gets the version that should be used for the resulting edit when the given text edit is applied.
     */
    getNextVersion(textEdit: TagEdit): CurrentVersion {
        return {
            currentSite: this._onVersionUpdated.value.currentSite,
            remoteSite: this._onVersionUpdated.value.remoteSite,
            vector: {
                ...this._onVersionUpdated.value.vector,
                [textEdit.isRemote ? this._remoteSite : this._siteId]:
                    (this._updateCounter += 1),
            },
        };
    }
}
