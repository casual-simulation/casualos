import {
    Bot,
    UpdatedBot,
    BotAction,
    createBot,
    AddBotAction,
    RemoveBotAction,
    UpdateBotAction,
    botAdded,
    botRemoved,
    botUpdated,
} from '@casual-simulation/aux-common';
import { DeviceAction, StatusUpdate } from '@casual-simulation/causal-trees';
import {
    LocalStoragePartition,
    LocalStoragePartitionConfig,
} from '@casual-simulation/aux-vm';
import flatMap from 'lodash/flatMap';
import { Subject, Subscription, Observable, fromEventPattern } from 'rxjs';
import { startWith, filter, map } from 'rxjs/operators';
import { pickBy } from 'lodash';

export class LocalStoragePartitionImpl implements LocalStoragePartition {
    protected _onBotsAdded = new Subject<Bot[]>();
    protected _onBotsRemoved = new Subject<string[]>();
    protected _onBotsUpdated = new Subject<UpdatedBot[]>();

    protected _onError = new Subject<any>();
    protected _onEvents = new Subject<DeviceAction[]>();
    protected _onStatusUpdated = new Subject<StatusUpdate>();
    protected _hasRegisteredSubs = false;
    private _sub = new Subscription();

    get onBotsAdded(): Observable<Bot[]> {
        return this._onBotsAdded
            .pipe
            // startWith(getActiveObjects(this._tree.state))
            ();
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

    get onEvents(): Observable<DeviceAction[]> {
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
        // return this._tree.state;
        return {};
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

        this._applyEvents(finalEvents);

        return [];
    }

    async init(): Promise<void> {}

    connect(): void {
        this._sub.add(
            storageUpdated().pipe(
                filter(e => e.key.indexOf(this.namespace) === 0)
            )
        );

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

    private _applyEvents(
        events: (AddBotAction | RemoveBotAction | UpdateBotAction)[]
    ) {
        // let { tree, updates } = applyEvents(this._tree, events);
        // this._tree = tree;
        // if (updates.addedBots.length > 0) {
        //     this._onBotsAdded.next(updates.addedBots);
        // }
        // if (updates.removedBots.length > 0) {
        //     this._onBotsRemoved.next(updates.removedBots);
        // }
        // if (updates.updatedBots.length > 0) {
        //     this._onBotsUpdated.next(
        //         updates.updatedBots.map(u => ({
        //             bot: <any>u.bot,
        //             tags: [...u.tags.values()],
        //         }))
        //     );
        // }
    }
}

function storedBotUpdated(
    namespace: string
): Observable<AddBotAction | RemoveBotAction | UpdateBotAction> {
    return storageUpdated().pipe(
        filter(e => e.key.indexOf(namespace) === 0),
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
