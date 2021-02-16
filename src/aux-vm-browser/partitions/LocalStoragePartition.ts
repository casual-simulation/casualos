import {
    Bot,
    UpdatedBot,
    BotAction,
    AddBotAction,
    RemoveBotAction,
    UpdateBotAction,
    botAdded,
    botRemoved,
    botUpdated,
    breakIntoIndividualEvents,
    BotsState,
    getActiveObjects,
    tagsOnBot,
    hasValue,
    LocalStoragePartition,
    LocalStoragePartitionConfig,
    AuxPartitionRealtimeStrategy,
    stateUpdatedEvent,
    StateUpdatedEvent,
    PartialBotsState,
    BotSpace,
    merge,
    BotTagMasks,
    BotTags,
} from '@casual-simulation/aux-common';
import {
    StatusUpdate,
    Action,
    CurrentVersion,
} from '@casual-simulation/causal-trees';
import { flatMap, union } from 'lodash';
import {
    Subject,
    Subscription,
    Observable,
    fromEventPattern,
    BehaviorSubject,
} from 'rxjs';
import { startWith, filter, map } from 'rxjs/operators';
import {
    applyEdit,
    isTagEdit,
} from '@casual-simulation/aux-common/aux-format-2';
import { v4 as uuid } from 'uuid';

export class LocalStoragePartitionImpl implements LocalStoragePartition {
    protected _onBotsAdded = new Subject<Bot[]>();
    protected _onBotsRemoved = new Subject<string[]>();
    protected _onBotsUpdated = new Subject<UpdatedBot[]>();
    protected _onStateUpdated = new Subject<StateUpdatedEvent>();
    protected _onVersionUpdated: Subject<CurrentVersion>;

    protected _onError = new Subject<any>();
    protected _onEvents = new Subject<Action[]>();
    protected _onStatusUpdated = new Subject<StatusUpdate>();
    protected _hasRegisteredSubs = false;
    private _state: BotsState = {};
    private _sub = new Subscription();
    private _siteId: string = uuid();

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

    get onVersionUpdated(): Observable<CurrentVersion> {
        return this._onVersionUpdated;
    }

    unsubscribe() {
        return this._sub.unsubscribe();
    }

    get closed(): boolean {
        return this._sub.closed;
    }

    get state() {
        return this._state;
    }

    type = 'local_storage' as const;
    private: boolean;
    namespace: string;
    space: string;

    constructor(config: LocalStoragePartitionConfig) {
        this.private = config.private || false;
        this.namespace = config.namespace;
        this._onVersionUpdated = new BehaviorSubject<CurrentVersion>({
            currentSite: this._siteId,
            vector: {},
        });
    }

    async applyEvents(events: BotAction[]): Promise<BotAction[]> {
        const finalEvents = flatMap(events, (e) => {
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

        this._applyEvents(finalEvents, true);

        return [];
    }

    async init(): Promise<void> {}

    connect(): void {
        this._watchLocalStorage();
        this._loadExistingBots();

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

    private _watchLocalStorage() {
        this._sub.add(
            storedBotUpdated(this.namespace, this.space).subscribe((event) => {
                this._applyEvents([event], false);
            })
        );
    }

    private _loadExistingBots() {
        let events = [] as (AddBotAction | UpdateBotAction)[];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(this.namespace + '/')) {
                // it is a bot
                const stored = getStoredBot(key);
                if (stored.id) {
                    events.push(botAdded(stored));
                } else {
                    const id = key.substring(this.namespace.length + 1);
                    events.push(botUpdated(id, stored));
                }
            }
        }
        this._applyEvents(events, false);
    }

    private _applyEvents(
        events: (AddBotAction | RemoveBotAction | UpdateBotAction)[],
        updateStorage: boolean
    ) {
        let addedBots = new Map<string, Bot>();
        let removedBots = [] as string[];
        let updated = new Map<string, UpdatedBot>();
        let updatedState = {} as PartialBotsState;
        // Flag to record if we have already created a new state object
        // during the update.
        let createdNewState = false;
        for (let event of events) {
            if (event.type === 'add_bot') {
                let bot = {
                    ...event.bot,
                    space: this.space as BotSpace,
                };
                if (createdNewState) {
                    this._state[event.bot.id] = bot;
                } else {
                    this._state = Object.assign({}, this._state, {
                        [event.bot.id]: bot,
                    });
                    createdNewState = true;
                }
                updatedState[event.bot.id] = bot;
                addedBots.set(event.bot.id, bot);
                if (updateStorage) {
                    const key = botKey(this.namespace, bot.id);
                    storeBot(key, bot);
                }
            } else if (event.type === 'remove_bot') {
                const id = event.id;
                if (createdNewState) {
                    delete this._state[id];
                } else {
                    let { [id]: removedBot, ...state } = this._state;
                    this._state = state;
                    createdNewState = true;
                }
                if (!addedBots.delete(event.id)) {
                    removedBots.push(event.id);
                }
                if (updateStorage) {
                    const key = botKey(this.namespace, id);
                    storeBot(key, null);
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
                        if (!newBot.tags) {
                            newBot.tags = {};
                        }
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
                            } else {
                                newBot.tags[tag] = newVal;
                            }
                            updatedBot.tags[tag] = newVal;
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

        if (addedBots.size > 0) {
            this._onBotsAdded.next([...addedBots.values()]);
        }
        if (removedBots.length > 0) {
            this._onBotsRemoved.next(removedBots);
        }
        if (updated.size > 0) {
            let updatedBots = [...updated.values()];
            this._onBotsUpdated.next(updatedBots);
        }
        const updateEvent = stateUpdatedEvent(updatedState);
        if (
            updateEvent.addedBots.length > 0 ||
            updateEvent.removedBots.length > 0 ||
            updateEvent.updatedBots.length > 0
        ) {
            if (updateStorage && updateEvent.updatedBots.length > 0) {
                for (let id of updateEvent.updatedBots) {
                    let bot = this.state[id];
                    const key = botKey(this.namespace, id);
                    storeBot(key, bot);
                }
            }

            this._onStateUpdated.next(updateEvent);
        }
    }
}

function storedBotUpdated(
    namespace: string,
    space: string
): Observable<AddBotAction | RemoveBotAction | UpdateBotAction> {
    return storageUpdated().pipe(
        filter((e) => e.key.startsWith(namespace + '/')),
        map((e) => {
            const newBot: Bot = JSON.parse(e.newValue) || null;
            const oldBot: Bot = JSON.parse(e.oldValue) || null;
            const id = e.key.substring(namespace.length + 1);
            if (!oldBot && newBot && newBot.id) {
                return botAdded(newBot);
            } else if (!newBot && oldBot && oldBot.id) {
                return botRemoved(id);
            } else if (newBot) {
                let differentTags = calculateDifferentTags(
                    newBot.tags,
                    oldBot?.tags
                );
                let differentMasks = null as BotTagMasks;
                if (newBot.masks) {
                    if (newBot.masks[space]) {
                        differentMasks = {
                            [space]: calculateDifferentTags(
                                newBot.masks[space],
                                oldBot?.masks?.[space]
                            ),
                        };
                    }
                }

                let update = {} as Partial<Bot>;
                if (Object.keys(differentTags).length > 0) {
                    update.tags = differentTags;
                }
                if (differentMasks !== null) {
                    update.masks = differentMasks;
                }
                return botUpdated(id, update);
            }

            return null;
        }),
        filter((event) => event !== null)
    );
}

function storageUpdated(): Observable<StorageEvent> {
    return fromEventPattern(
        (h) => globalThis.addEventListener('storage', h),
        (h) => globalThis.removeEventListener('storage', h)
    );
}

function botKey(namespace: string, id: string): string {
    return `${namespace}/${id}`;
}

function getStoredBot(key: string): Bot {
    const json = localStorage.getItem(key);
    if (json) {
        const bot: Bot = JSON.parse(json);
        return bot;
    } else {
        return null;
    }
}

function storeBot(key: string, bot: Bot) {
    if (bot) {
        const json = JSON.stringify(bot);
        localStorage.setItem(key, json);
    } else {
        localStorage.removeItem(key);
    }
}

function calculateDifferentTags(newTags: BotTags, oldTags: BotTags) {
    const allTags = union(
        Object.keys(newTags || {}),
        Object.keys(oldTags || {})
    );
    let differentTags = {} as BotTags;
    for (let t of allTags) {
        const newTag = newTags?.[t];
        if (newTag !== oldTags?.[t]) {
            differentTags[t] = newTag;
        }
    }
    return differentTags;
}
