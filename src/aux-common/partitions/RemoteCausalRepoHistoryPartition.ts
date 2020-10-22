import {
    User,
    StatusUpdate,
    RemoteAction,
    Action,
    RemoteActions,
} from '@casual-simulation/causal-trees';
import {
    CausalRepoClient,
    CausalRepoCommit,
    VersionVector,
} from '@casual-simulation/causal-trees/core2';
import { Observable, Subscription, Subject, BehaviorSubject } from 'rxjs';
import { startWith } from 'rxjs/operators';
import {
    BotAction,
    Bot,
    BotsState,
    UpdatedBot,
    getActiveObjects,
    createBot,
    RestoreHistoryMarkAction,
    BotSpace,
    asyncResult,
    hasValue,
    asyncError,
    StateUpdatedEvent,
    stateUpdatedEvent,
} from '../bots';
import {
    PartitionConfig,
    CausalRepoHistoryClientPartitionConfig,
} from './AuxPartitionConfig';
import {
    RemoteCausalRepoPartition,
    AuxPartitionRealtimeStrategy,
} from './AuxPartition';
import uuid from 'uuid/v5';
import reverse from 'lodash/reverse';

export const COMMIT_ID_NAMESPACE = 'b1a81255-568b-4f09-ab0b-4eeb607b82ed';

export async function createCausalRepoHistoryClientPartition(
    config: PartitionConfig,
    user: User
): Promise<RemoteCausalRepoPartition> {
    if (config.type === 'causal_repo_history_client') {
        const partition = new RemoteCausalRepoHistoryPartitionImpl(
            user,
            config.client,
            config
        );
        await partition.init();
        return partition;
    }
    return undefined;
}

export class RemoteCausalRepoHistoryPartitionImpl
    implements RemoteCausalRepoPartition {
    protected _onBotsAdded = new Subject<Bot[]>();
    protected _onBotsRemoved = new Subject<string[]>();
    protected _onBotsUpdated = new Subject<UpdatedBot[]>();
    protected _onStateUpdated = new Subject<StateUpdatedEvent>();
    private _onVersionUpdated = new BehaviorSubject<VersionVector>({});

    protected _onError = new Subject<any>();
    protected _onEvents = new Subject<Action[]>();
    protected _onStatusUpdated = new Subject<StatusUpdate>();
    protected _hasRegisteredSubs = false;
    private _sub = new Subscription();
    private _user: User;
    private _branch: string;
    private _readOnly: boolean;

    private _commits: CausalRepoCommit[] = [];
    private _state: BotsState = {};
    private _client: CausalRepoClient;
    private _synced: boolean;

    space: string;
    private: boolean;

    get realtimeStrategy(): AuxPartitionRealtimeStrategy {
        return 'delayed';
    }

    get onBotsAdded(): Observable<Bot[]> {
        return this._onBotsAdded.pipe(startWith(getActiveObjects(this._state)));
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

    get onVersionUpdated(): Observable<VersionVector> {
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

    unsubscribe() {
        return this._sub.unsubscribe();
    }

    get closed(): boolean {
        return this._sub.closed;
    }

    get state() {
        return this._state;
    }

    type = 'causal_repo' as const;

    get forcedOffline(): boolean {
        return this._client.forcedOffline;
    }

    set forcedOffline(value: boolean) {
        this._client.forcedOffline = value;
    }

    constructor(
        user: User,
        client: CausalRepoClient,
        config: CausalRepoHistoryClientPartitionConfig
    ) {
        this._user = user;
        this._branch = config.branch;
        this._client = client;
        this.private = config.private;
        this._readOnly = false;
        this._synced = false;
    }

    async sendRemoteEvents(events: RemoteActions[]): Promise<void> {
        if (this._readOnly) {
            return;
        }

        for (let event of events) {
            if (
                event.type === 'remote' &&
                event.event.type === 'restore_history_mark'
            ) {
                const restoreMark = <RestoreHistoryMarkAction>event.event;
                const bot = this.state[restoreMark.mark];
                if (!bot) {
                    continue;
                }
                const hash = bot.tags.markHash;
                this._client
                    .restore(restoreMark.story || this._branch, hash)
                    .subscribe(
                        () => {
                            if (hasValue(event.taskId)) {
                                this._onEvents.next([
                                    asyncResult(event.taskId, undefined),
                                ]);
                            }
                        },
                        (err) => {
                            if (hasValue(event.taskId)) {
                                this._onEvents.next([
                                    asyncError(event.taskId, err),
                                ]);
                            }
                        }
                    );
            }
        }
    }

    async applyEvents(events: BotAction[]): Promise<BotAction[]> {
        return [];
    }

    async init(): Promise<void> {}

    connect(): void {
        this._sub.add(
            this._client.connection.connectionState.subscribe((state) => {
                const connected = state.connected;
                this._onStatusUpdated.next({
                    type: 'connection',
                    connected: !!connected,
                });

                if (connected) {
                    this._onStatusUpdated.next({
                        type: 'authentication',
                        authenticated: true,
                        user: this._user,
                        info: state.info,
                    });

                    this._onStatusUpdated.next({
                        type: 'authorization',
                        authorized: true,
                    });
                } else {
                    this._updateSynced(false);
                }
            })
        );

        this._sub.add(
            this._client.watchCommits(this._branch).subscribe((event) => {
                if (!this._synced) {
                    this._updateSynced(true);
                }

                this._addCommits(event.commits);
            })
        );
    }

    private _updateSynced(synced: boolean) {
        this._synced = synced;
        this._onStatusUpdated.next({
            type: 'sync',
            synced: synced,
        });
    }

    private _addCommits(commits: CausalRepoCommit[]) {
        const newBots = commits.map((c) => this._makeBot(c));

        let nextState = {
            ...this._state,
        };
        let update = {} as BotsState;

        this._commits.push(...reverse(commits));
        for (let bot of newBots) {
            bot.tags.historyY = -this._commits.findIndex(
                (c) => c.hash === bot.tags.markHash
            );
            nextState[bot.id] = bot;
            update[bot.id] = bot;
        }

        this._state = nextState;

        if (newBots.length > 0) {
            this._onBotsAdded.next(newBots);
        }
        let event = stateUpdatedEvent(update);
        if (
            event.addedBots.length > 0 ||
            event.removedBots.length > 0 ||
            event.updatedBots.length > 0
        ) {
            this._onStateUpdated.next(event);
        }
    }

    private _makeBot(commit: CausalRepoCommit): Bot {
        return createBot(
            uuid(commit.hash, COMMIT_ID_NAMESPACE),
            {
                history: true,
                label: commit.message,
                labelSize: 0.25,
                scale: 0.8,
                scaleX: 2,
                markHash: commit.hash,
                previousMarkHash: commit.previousCommit,
                markTime: commit.time,
            },
            <BotSpace>this.space
        );
    }
}
