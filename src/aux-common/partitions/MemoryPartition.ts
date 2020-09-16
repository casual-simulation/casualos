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
import { Observable, Subject } from 'rxjs';
import { StatusUpdate, Action } from '@casual-simulation/causal-trees';
import { startWith } from 'rxjs/operators';
import flatMap from 'lodash/flatMap';
import union from 'lodash/union';
import { merge } from '../utils';

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

class MemoryPartitionImpl implements MemoryPartition {
    private _onBotsAdded = new Subject<Bot[]>();
    private _onBotsRemoved = new Subject<string[]>();
    private _onBotsUpdated = new Subject<UpdatedBot[]>();
    private _onStateUpdated = new Subject<StateUpdatedEvent>();
    private _onError = new Subject<any>();
    private _onEvents = new Subject<Action[]>();
    private _onStatusUpdated = new Subject<StatusUpdate>();

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
        for (let event of events) {
            if (event.type === 'add_bot') {
                // console.log('[MemoryPartition] Add bot', event.bot);
                let bot = {
                    ...event.bot,
                    space: this.space as BotSpace,
                };
                this.state = Object.assign({}, this.state, {
                    [event.bot.id]: bot,
                });
                updatedState[event.bot.id] = bot;
                added.set(event.bot.id, event.bot);
            } else if (event.type === 'remove_bot') {
                let { [event.id]: removedBot, ...state } = this.state;
                this.state = state;
                if (!added.delete(event.id)) {
                    removed.push(event.id);
                }
                updatedState[event.id] = null;
            } else if (event.type === 'update_bot') {
                if (event.update.tags && this.state[event.id]) {
                    let newBot = Object.assign({}, this.state[event.id]);
                    let changedTags: string[] = [];
                    for (let tag of tagsOnBot(event.update)) {
                        const newVal = event.update.tags[tag];
                        const oldVal = newBot.tags[tag];

                        if (newVal !== oldVal) {
                            changedTags.push(tag);
                        }

                        if (hasValue(newVal)) {
                            newBot.tags[tag] = newVal;
                        } else {
                            delete newBot.tags[tag];
                        }
                    }

                    this.state[event.id] = newBot;
                    updatedState[event.id] = merge(
                        updatedState[event.id] || {},
                        event.update
                    );

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
                    let changedTags: string[] = [];
                    for (let tag in tags) {
                        const newVal = tags[tag];
                        const oldVal = masks[tag];

                        if (newVal !== oldVal) {
                            changedTags.push(tag);
                        }

                        if (hasValue(newVal)) {
                            masks[tag] = newVal;
                        } else {
                            delete masks[tag];
                        }
                    }

                    this.state[event.id] = newBot;
                    updatedState[event.id] = merge(
                        updatedState[event.id] || {},
                        event.update
                    );
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
    }
}
