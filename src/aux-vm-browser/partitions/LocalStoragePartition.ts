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
} from '@casual-simulation/aux-common';
import { StatusUpdate, Action } from '@casual-simulation/causal-trees';
import {
    LocalStoragePartition,
    LocalStoragePartitionConfig,
} from '@casual-simulation/aux-vm';
import flatMap from 'lodash/flatMap';
import { Subject, Subscription, Observable, fromEventPattern } from 'rxjs';
import { startWith, filter, map } from 'rxjs/operators';
import pickBy from 'lodash/pickBy';
import union from 'lodash/union';

export class LocalStoragePartitionImpl implements LocalStoragePartition {
    protected _onBotsAdded = new Subject<Bot[]>();
    protected _onBotsRemoved = new Subject<string[]>();
    protected _onBotsUpdated = new Subject<UpdatedBot[]>();

    protected _onError = new Subject<any>();
    protected _onEvents = new Subject<Action[]>();
    protected _onStatusUpdated = new Subject<StatusUpdate>();
    protected _hasRegisteredSubs = false;
    private _state: BotsState = {};
    private _sub = new Subscription();

    get onBotsAdded(): Observable<Bot[]> {
        return this._onBotsAdded.pipe(startWith(getActiveObjects(this.state)));
    }

    get onBotsRemoved(): Observable<string[]> {
        return this._onBotsRemoved;
    }

    get onBotsUpdated(): Observable<UpdatedBot[]> {
        return this._onBotsUpdated;
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

    constructor(config: LocalStoragePartitionConfig) {
        this.private = config.private || false;
        this.namespace = config.namespace;
    }

    async applyEvents(events: BotAction[]): Promise<BotAction[]> {
        const finalEvents = flatMap(events, e => {
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
            storedBotUpdated(this.namespace).subscribe(event => {
                this._applyEvents([event], false);
            })
        );
    }

    private _loadExistingBots() {
        let events = [] as AddBotAction[];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(this.namespace)) {
                // it is a bot
                events.push(botAdded(getStoredBot(key)));
            }
        }
        this._applyEvents(events, false);
    }

    private _applyEvents(
        events: (AddBotAction | RemoveBotAction | UpdateBotAction)[],
        updateStorage: boolean
    ) {
        let addedBots = [] as Bot[];
        let removedBots = [] as string[];
        let updated = new Map<string, UpdatedBot>();

        for (let event of events) {
            if (event.type === 'add_bot') {
                const bot = event.bot;
                this._state = Object.assign({}, this._state, {
                    [event.bot.id]: event.bot,
                });
                addedBots.push(bot);
                if (updateStorage) {
                    const key = botKey(this.namespace, bot.id);
                    storeBot(key, bot);
                }
            } else if (event.type === 'remove_bot') {
                const id = event.id;
                let { [id]: removedBot, ...state } = this._state;
                this._state = state;
                removedBots.push(id);
                if (updateStorage) {
                    const key = botKey(this.namespace, id);
                    storeBot(key, null);
                }
            } else if (event.type === 'update_bot') {
                if (!event.update.tags) {
                    continue;
                }

                let newBot = Object.assign({}, this._state[event.id]);
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

                this._state = Object.assign({}, this._state, {
                    [event.id]: newBot,
                });

                let update = updated.get(event.id);
                if (update) {
                    update.bot = newBot;
                    update.tags = union(update.tags, changedTags);
                } else {
                    updated.set(event.id, {
                        bot: newBot,
                        tags: changedTags,
                    });
                }
            }
        }

        if (addedBots.length > 0) {
            this._onBotsAdded.next(addedBots);
        }
        if (removedBots.length > 0) {
            this._onBotsRemoved.next(removedBots);
        }
        if (updated.size > 0) {
            let updatedBots = [...updated.values()];
            if (updateStorage) {
                for (let updated of updatedBots) {
                    const key = botKey(this.namespace, updated.bot.id);
                    storeBot(key, updated.bot);
                }
            }
            this._onBotsUpdated.next(updatedBots);
        }
    }
}

function storedBotUpdated(
    namespace: string
): Observable<AddBotAction | RemoveBotAction | UpdateBotAction> {
    return storageUpdated().pipe(
        filter(e => e.key.startsWith(namespace)),
        map(e => {
            const newBot: Bot = JSON.parse(e.newValue) || null;
            const oldBot: Bot = JSON.parse(e.oldValue) || null;
            if (!oldBot && newBot) {
                return botAdded(newBot);
            } else if (!newBot && oldBot) {
                return botRemoved(oldBot.id);
            } else if (newBot && oldBot) {
                const differentTags = pickBy(
                    newBot.tags,
                    (val, tag) => oldBot.tags[tag] !== val
                );

                if (Object.keys(differentTags).length > 0) {
                    return botUpdated(oldBot.id, {
                        tags: differentTags,
                    });
                }
            }

            return null;
        }),
        filter(event => event !== null)
    );
}

function storageUpdated(): Observable<StorageEvent> {
    return fromEventPattern(
        h => window.addEventListener('storage', h),
        h => window.removeEventListener('storage', h)
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
