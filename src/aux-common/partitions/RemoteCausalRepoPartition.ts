import {
    User,
    StatusUpdate,
    RemoteAction,
    Action,
    USERNAME_CLAIM,
    remote,
    SESSION_ID_CLAIM,
    device,
    RemoteActions,
} from '@casual-simulation/causal-trees';
import {
    Atom,
    addedAtoms,
    removedAtoms,
    CausalRepoClient,
} from '@casual-simulation/causal-trees/core2';
import {
    AuxCausalTree,
    auxTree,
    applyEvents,
    BotStateUpdates,
    applyAtoms,
} from '../aux-format-2';
import { Observable, Subscription, Subject } from 'rxjs';
import { startWith } from 'rxjs/operators';
import {
    BotAction,
    Bot,
    UpdatedBot,
    getActiveObjects,
    AddBotAction,
    RemoveBotAction,
    UpdateBotAction,
    breakIntoIndividualEvents,
    MarkHistoryAction,
    loadSpace,
    asyncError,
    asyncResult,
    GetPlayerCountAction,
    GetStoriesAction,
    action,
    ShoutAction,
    ON_REMOTE_WHISPER_ACTION_NAME,
    hasValue,
    AsyncAction,
} from '../bots';
import flatMap from 'lodash/flatMap';
import {
    PartitionConfig,
    RemoteCausalRepoPartitionConfig,
    CausalRepoClientPartitionConfig,
    CausalRepoHistoryClientPartitionConfig,
} from './AuxPartitionConfig';
import {
    RemoteCausalRepoPartition,
    AuxPartitionRealtimeStrategy,
} from './AuxPartition';

export async function createCausalRepoClientPartition(
    config: PartitionConfig,
    user: User
): Promise<RemoteCausalRepoPartition> {
    if (config.type === 'causal_repo_client') {
        const partition = new RemoteCausalRepoPartitionImpl(
            user,
            config.client,
            config
        );
        await partition.init();
        return partition;
    }
    return undefined;
}

export class RemoteCausalRepoPartitionImpl
    implements RemoteCausalRepoPartition {
    protected _onBotsAdded = new Subject<Bot[]>();
    protected _onBotsRemoved = new Subject<string[]>();
    protected _onBotsUpdated = new Subject<UpdatedBot[]>();

    protected _onError = new Subject<any>();
    protected _onEvents = new Subject<Action[]>();
    protected _onStatusUpdated = new Subject<StatusUpdate>();
    protected _hasRegisteredSubs = false;
    private _sub = new Subscription();
    private _user: User;
    private _branch: string;
    private _readOnly: boolean;
    private _static: boolean;
    private _temporary: boolean;
    private _remoteEvents: boolean;

    /**
     * Whether the partition is watching the branch.
     */
    private _watchingBranch: boolean = false;

    private _tree: AuxCausalTree = auxTree();
    private _client: CausalRepoClient;
    private _synced: boolean;

    private: boolean;

    get tree() {
        return this._tree;
    }

    get realtimeStrategy(): AuxPartitionRealtimeStrategy {
        return this._static ? 'delayed' : 'immediate';
    }

    get onBotsAdded(): Observable<Bot[]> {
        return this._onBotsAdded.pipe(
            startWith(getActiveObjects(this._tree.state))
        );
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
        return this._tree.state;
    }

    type = 'causal_repo' as const;
    space: string;

    get forcedOffline(): boolean {
        return this._client.forcedOffline;
    }

    set forcedOffline(value: boolean) {
        this._client.forcedOffline = value;
    }

    constructor(
        user: User,
        client: CausalRepoClient,
        config:
            | RemoteCausalRepoPartitionConfig
            | CausalRepoClientPartitionConfig
    ) {
        this._user = user;
        this._branch = config.branch;
        this._client = client;
        this.private = config.private;
        this._static = config.static || false;
        this._temporary = config.temporary;
        this._remoteEvents =
            'remoteEvents' in config ? config.remoteEvents : true;

        // static implies read only
        this._readOnly = config.readOnly || this._static || false;

        this._synced = false;
    }

    async sendRemoteEvents(events: RemoteActions[]): Promise<void> {
        if (this._readOnly || !this._remoteEvents) {
            return;
        }
        for (let event of events) {
            if (event.type === 'remote') {
                if (event.event.type === 'mark_history') {
                    const markHistory = <MarkHistoryAction>event.event;
                    this._client
                        .commit(this._branch, markHistory.message)
                        .subscribe(
                            () => {
                                if (hasValue(event.taskId)) {
                                    this._onEvents.next([
                                        asyncResult(event.taskId, undefined),
                                    ]);
                                }
                            },
                            err => {
                                if (hasValue(event.taskId)) {
                                    this._onEvents.next([
                                        asyncError(event.taskId, err),
                                    ]);
                                }
                            }
                        );
                } else if (event.event.type === 'browse_history') {
                    this._onEvents.next([
                        loadSpace(
                            'history',
                            <CausalRepoHistoryClientPartitionConfig>{
                                type: 'causal_repo_history_client',
                                branch: this._branch,
                                client: this._client,
                            },
                            event.taskId
                        ),
                    ]);
                } else if (event.event.type === 'get_player_count') {
                    const action = <GetPlayerCountAction>event.event;
                    this._client.devices(action.story).subscribe(
                        e => {
                            const devices = e.devices.filter(
                                d => d.claims[USERNAME_CLAIM] !== 'Server'
                            );
                            this._onEvents.next([
                                asyncResult(event.taskId, devices.length),
                            ]);
                        },
                        err => {
                            this._onEvents.next([
                                asyncError(event.taskId, err),
                            ]);
                        }
                    );
                } else if (event.event.type === 'get_stories') {
                    const action = <GetStoriesAction>event.event;
                    if (action.includeStatuses) {
                        this._client.branchesStatus().subscribe(
                            e => {
                                this._onEvents.next([
                                    asyncResult(
                                        event.taskId,
                                        e.branches
                                            .filter(
                                                b => !b.branch.startsWith('$')
                                            )
                                            .map(b => ({
                                                story: b.branch,
                                                lastUpdateTime:
                                                    b.lastUpdateTime,
                                            }))
                                    ),
                                ]);
                            },
                            err => {
                                this._onEvents.next([
                                    asyncError(event.taskId, err),
                                ]);
                            }
                        );
                    } else {
                        this._client.branches().subscribe(
                            e => {
                                this._onEvents.next([
                                    asyncResult(
                                        event.taskId,
                                        e.branches.filter(
                                            b => !b.startsWith('$')
                                        )
                                    ),
                                ]);
                            },
                            err => {
                                this._onEvents.next([
                                    asyncError(event.taskId, err),
                                ]);
                            }
                        );
                    }
                } else if (event.event.type === 'get_players') {
                    // Do nothing for get_players since it will be handled by the OtherPlayersPartition.
                    // TODO: Make this mechanism more extensible so that we don't have to hardcode for each time
                    //       we do this type of logic.
                } else {
                    this._client.sendEvent(this._branch, event);
                }
            } else {
                this._client.sendEvent(this._branch, event);
            }
        }
    }

    async applyEvents(events: BotAction[]): Promise<BotAction[]> {
        if (this._static) {
            for (let i = 0; i < events.length; i++) {
                const event = events[i];
                if (event.type === 'unlock_space') {
                    if (this._unlockSpace(event.password)) {
                        const extraEvents = await this.applyEvents(
                            events.slice(i + 1)
                        );

                        // Resolve the unlock_space task
                        this._onEvents.next([
                            asyncResult(event.taskId, undefined),
                        ]);

                        return extraEvents;
                    } else {
                        // Reject the unlock_space task
                        this._onEvents.next([
                            asyncError(
                                event.taskId,
                                new Error(
                                    'Unable to unlock the space because the passcode is incorrect.'
                                )
                            ),
                        ]);
                    }
                }
            }
            return [];
        }

        let finalEvents = [] as (
            | AddBotAction
            | RemoveBotAction
            | UpdateBotAction)[];
        for (let e of events) {
            if (e.type === 'apply_state') {
                finalEvents.push(...breakIntoIndividualEvents(this.state, e));
            } else if (
                e.type === 'add_bot' ||
                e.type === 'remove_bot' ||
                e.type === 'update_bot'
            ) {
                finalEvents.push(e);
            } else if (e.type === 'unlock_space') {
                // Resolve the unlock_space task
                this._onEvents.next([asyncResult(e.taskId, undefined)]);
            }
        }

        this._applyEvents(finalEvents);

        return [];
    }

    private _unlockSpace(password: string) {
        // TODO: Improve with a better mechanism
        if (password !== '3342') {
            return false;
        }
        this._static = false;
        this._readOnly = false;
        if (this._synced) {
            this._watchBranch();
        }
        return true;
    }

    async init(): Promise<void> {}

    connect(): void {
        if (this._static) {
            this._requestBranch();
        } else {
            this._watchBranch();
        }
    }

    /**
     * Requests the current state from the configured branch.
     */
    private _requestBranch() {
        this._client.getBranch(this._branch).subscribe(
            atoms => {
                this._onStatusUpdated.next({
                    type: 'connection',
                    connected: true,
                });
                this._onStatusUpdated.next({
                    type: 'authentication',
                    authenticated: true,
                    user: this._user,
                });
                this._onStatusUpdated.next({
                    type: 'authorization',
                    authorized: true,
                });

                this._updateSynced(true);
                this._applyAtoms(atoms, []);

                if (!this._static) {
                    // the partition has been unlocked while getting the branch
                    this._watchBranch();
                }
            },
            err => this._onError.next(err)
        );
    }

    /**
     * Subscribes to the configured branch for persistent updates.
     */
    private _watchBranch() {
        if (this._watchingBranch) {
            return;
        }
        this._watchingBranch = true;
        this._sub.add(
            this._client.connection.connectionState.subscribe(
                state => {
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
                },
                err => this._onError.next(err)
            )
        );
        this._sub.add(
            this._client
                .watchBranch({
                    branch: this._branch,
                    temporary: this._temporary,
                    siteId: this._tree.site.id,
                })
                .subscribe(
                    event => {
                        if (!this._synced) {
                            this._updateSynced(true);
                        }
                        if (event.type === 'atoms') {
                            this._applyAtoms(event.atoms, event.removedAtoms);
                        } else if (event.type === 'event') {
                            if (event.action.type === 'device') {
                                if (event.action.event.type === 'action') {
                                    const remoteAction = event.action
                                        .event as ShoutAction;
                                    this._onEvents.next([
                                        action(
                                            ON_REMOTE_WHISPER_ACTION_NAME,
                                            null,
                                            null,
                                            {
                                                name: remoteAction.eventName,
                                                that: remoteAction.argument,
                                                playerId:
                                                    event.action.device.claims[
                                                        SESSION_ID_CLAIM
                                                    ],
                                            }
                                        ),
                                    ]);
                                } else if (hasValue(event.action.taskId)) {
                                    const newEvent = device(
                                        event.action.device,
                                        {
                                            ...event.action.event,
                                            taskId: event.action.taskId,
                                            playerId:
                                                event.action.device.claims[
                                                    SESSION_ID_CLAIM
                                                ],
                                        } as AsyncAction,
                                        event.action.taskId
                                    );
                                    this._onEvents.next([newEvent]);
                                } else {
                                    this._onEvents.next([event.action]);
                                }
                            } else {
                                this._onEvents.next([event.action]);
                            }
                        }
                    },
                    err => this._onError.next(err)
                )
        );
    }

    private _updateSynced(synced: boolean) {
        this._synced = synced;
        this._onStatusUpdated.next({
            type: 'sync',
            synced: synced,
        });
    }

    private _applyAtoms(atoms: Atom<any>[], removedAtoms: string[]) {
        if (this._tree.weave.roots.length === 0 && atoms) {
            console.log(
                `[RemoteCausalRepoPartition] Got ${atoms.length} atoms!`
            );
        }
        let { tree, updates } = applyAtoms(
            this._tree,
            atoms,
            removedAtoms,
            this.space
        );
        this._tree = tree;
        this._sendUpdates(updates);
    }

    private _applyEvents(
        events: (AddBotAction | RemoveBotAction | UpdateBotAction)[]
    ) {
        let { tree, updates, result } = applyEvents(
            this._tree,
            events,
            this.space
        );
        this._tree = tree;

        this._sendUpdates(updates);

        if (this._readOnly) {
            return;
        }

        const atoms = addedAtoms(result.results);
        const removed = removedAtoms(result.results);
        if (atoms.length > 0 || removed.length > 0) {
            this._client.addAtoms(this._branch, atoms, removed);
        }
    }

    private _sendUpdates(updates: BotStateUpdates) {
        if (updates.addedBots.length > 0) {
            this._onBotsAdded.next(updates.addedBots);
        }
        if (updates.removedBots.length > 0) {
            this._onBotsRemoved.next(updates.removedBots);
        }
        if (updates.updatedBots.length > 0) {
            this._onBotsUpdated.next(
                updates.updatedBots.map(u => ({
                    bot: <any>u.bot,
                    tags: [...u.tags.values()],
                }))
            );
        }
    }
}
