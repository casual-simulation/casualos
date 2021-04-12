import { MemoryPartition, AuxPartitionRealtimeStrategy } from './AuxPartition';
import {
    PartitionConfig,
    MemoryPartitionStateConfig,
} from './AuxPartitionConfig';
import {
    BotsState,
    BotAction,
    Bot,
    UpdatedBot,
    tagsOnBot,
    hasValue,
    getActiveObjects,
    AddBotAction,
    RemoveBotAction,
    UpdateBotAction,
    breakIntoIndividualEvents,
    StateUpdatedEvent,
    stateUpdatedEvent,
    PartialBotsState,
    BotSpace,
} from '../bots';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import {
    StatusUpdate,
    Action,
    CurrentVersion,
} from '@casual-simulation/causal-trees';
import { startWith } from 'rxjs/operators';
import { flatMap, union } from 'lodash';
import { merge } from '../utils';
import { applyEdit, edits, isTagEdit, TagEdit } from '../aux-format-2';
import { v4 as uuid } from 'uuid';

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
    private _siteId: string = uuid();
    private _remoteSite: string = uuid();
    private _updateCounter: number = 0;

    type = 'memory' as const;
    state: BotsState;
    private: boolean;
    space: string;

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
            startWith(stateUpdatedEvent(this.state))
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

        return events;
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
                    ...event.bot,
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
                added.set(event.bot.id, event.bot);
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
                    const updatedBot = (updatedState[event.id] = merge(
                        updatedState[event.id] || {},
                        event.update
                    ));
                    for (let tag of Object.keys(event.update.tags)) {
                        const newVal = event.update.tags[tag];
                        const oldVal = newBot.tags[tag];

                        if (newVal !== oldVal) {
                            changedTags.push(tag);
                        }

                        if (hasValue(newVal)) {
                            if (isTagEdit(newVal)) {
                                newBot.tags[tag] = applyEdit(
                                    newBot.tags[tag],
                                    newVal
                                );
                                nextVersion = this.getNextVersion(newVal);

                                updatedBot.tags[tag] = edits(
                                    nextVersion.vector,
                                    ...newVal.operations
                                );
                            } else {
                                newBot.tags[tag] = newVal;
                                updatedBot.tags[tag] = newVal;
                            }
                        } else {
                            delete newBot.tags[tag];
                            updatedBot.tags[tag] = null;
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
                    const masks = newBot.masks[this.space];
                    const updatedBot = (updatedState[event.id] = merge(
                        updatedState[event.id] || {},
                        event.update
                    ));
                    let changedTags: string[] = [];
                    for (let tag in tags) {
                        const newVal = tags[tag];
                        const oldVal = masks[tag];

                        if (newVal !== oldVal) {
                            changedTags.push(tag);
                        }

                        if (hasValue(newVal)) {
                            if (isTagEdit(newVal)) {
                                masks[tag] = applyEdit(masks[tag], newVal);
                                nextVersion = {
                                    currentSite: this._onVersionUpdated.value
                                        .currentSite,
                                    remoteSite: this._onVersionUpdated.value
                                        .remoteSite,
                                    vector: {
                                        ...this._onVersionUpdated.value.vector,
                                        [newVal.isRemote
                                            ? this._remoteSite
                                            : this
                                                  ._siteId]: this._updateCounter += 1,
                                    },
                                };

                                updatedBot.masks[this.space][tag] = edits(
                                    nextVersion.vector,
                                    ...newVal.operations
                                );
                            } else {
                                masks[tag] = newVal;
                            }
                        } else {
                            delete masks[tag];
                            updatedBot.masks[this.space][tag] = null;
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
        const updateEvent = stateUpdatedEvent(updatedState);
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

    getNextVersion(textEdit: TagEdit): CurrentVersion {
        return {
            currentSite: this._onVersionUpdated.value.currentSite,
            remoteSite: this._onVersionUpdated.value.remoteSite,
            vector: {
                ...this._onVersionUpdated.value.vector,
                [textEdit.isRemote
                    ? this._remoteSite
                    : this._siteId]: this._updateCounter += 1,
            },
        };
    }
}
