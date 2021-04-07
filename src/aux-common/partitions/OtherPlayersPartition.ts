import {
    OtherPlayersClientPartitionConfig,
    OtherPlayersRepoPartitionConfig,
    RemoteCausalRepoPartitionConfig,
    PartitionConfig,
} from './AuxPartitionConfig';
import {
    User,
    StatusUpdate,
    Action,
    RemoteAction,
    WatchBranchEvent,
    DeviceInfo,
    USERNAME_CLAIM,
    SESSION_ID_CLAIM,
    RemoteActions,
} from '@casual-simulation/causal-trees';
import {
    CausalRepoClient,
    CurrentVersion,
} from '@casual-simulation/causal-trees/core2';
import {
    OtherPlayersPartition,
    AuxPartitionRealtimeStrategy,
    RemoteCausalRepoPartition,
} from './AuxPartition';
import {
    BotsState,
    getActiveObjects,
    UpdatedBot,
    Bot,
    BotAction,
    breakIntoIndividualEvents,
    AddBotAction,
    RemoveBotAction,
    UpdateBotAction,
    GetRemotesAction,
    asyncResult,
    action,
    ON_REMOTE_PLAYER_SUBSCRIBED_ACTION_NAME,
    ON_REMOTE_PLAYER_UNSUBSCRIBED_ACTION_NAME,
    StateUpdatedEvent,
    stateUpdatedEvent,
    applyUpdates,
    PrecalculatedBotsState,
    isBot,
    PartialBotsState,
    ON_REMOTE_JOINED_ACTION_NAME,
    ON_REMOTE_LEAVE_ACTION_NAME,
} from '../bots';
import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs';
import { skip, startWith } from 'rxjs/operators';
import { createCausalRepoClientPartition } from './RemoteCausalRepoPartition';
import { sortBy } from 'lodash';

export async function createOtherPlayersClientPartition(
    config: PartitionConfig,
    user: User
): Promise<OtherPlayersPartitionImpl> {
    if (config.type === 'other_players_client') {
        const partition = new OtherPlayersPartitionImpl(
            user,
            config.client,
            config
        );
        return partition;
    }
    return undefined;
}

/**
 * Defines a partition that watches for other players and loads their player partitions dynamically.
 */
export class OtherPlayersPartitionImpl implements OtherPlayersPartition {
    protected _onBotsAdded = new Subject<Bot[]>();
    protected _onBotsRemoved = new Subject<string[]>();
    protected _onBotsUpdated = new Subject<UpdatedBot[]>();
    protected _onStateUpdated = new Subject<StateUpdatedEvent>();
    private _onVersionUpdated = new BehaviorSubject<CurrentVersion>({
        currentSite: null,
        remoteSite: null,
        vector: {},
    });

    protected _onError = new Subject<any>();
    protected _onEvents = new Subject<Action[]>();
    protected _onStatusUpdated = new Subject<StatusUpdate>();
    protected _hasRegisteredSubs = false;
    private _sub = new Subscription();
    private _user: User;
    private _space: string;
    private _branch: string;
    private _state: BotsState;

    /**
     * The map of branch names to partitions.
     */
    private _partitions: Map<string, RemoteCausalRepoPartition>;

    /**
     * The map of session IDs to connected devices.
     */
    private _devices: Map<string, ConnectedDevice>;

    /**
     * The map of branch names to subscriptions.
     */
    private _partitionSubs: Map<string, Subscription>;

    /**
     * Whether the partition is watching the branch.
     */
    private _watchingBranch: boolean = false;

    private _client: CausalRepoClient;
    private _synced: boolean;

    private: boolean;
    get space(): string {
        return this._space;
    }

    set space(value: string) {
        this._space = value;
        for (let p of this._partitions.values()) {
            p.space = value;
        }
    }

    get realtimeStrategy(): AuxPartitionRealtimeStrategy {
        return 'delayed';
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

    unsubscribe() {
        this._sub.unsubscribe();
        for (let sub of this._partitionSubs.values()) {
            sub.unsubscribe();
        }
    }

    get closed(): boolean {
        return this._sub.closed;
    }

    get state() {
        return this._state;
    }

    type = 'other_players' as const;

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
            | OtherPlayersClientPartitionConfig
            | OtherPlayersRepoPartitionConfig
    ) {
        this._user = user;
        this._branch = config.branch;
        this._client = client;
        this._state = {};
        this._partitions = new Map();
        this._partitionSubs = new Map();
        this._devices = new Map();
        this._synced = false;
    }

    async applyEvents(events: BotAction[]): Promise<BotAction[]> {
        return [];
    }

    async sendRemoteEvents(events: RemoteActions[]): Promise<void> {
        for (let event of events) {
            if (event.type === 'remote' && event.event.type === 'get_remotes') {
                const action = <GetRemotesAction>event.event;
                const connectedDevices = [...this._devices.values()];
                const sessionIds = sortBy([
                    this._user.id,
                    ...connectedDevices.map(
                        (cd) => cd.deviceInfo.claims[SESSION_ID_CLAIM]
                    ),
                ]);
                this._onEvents.next([asyncResult(event.taskId, sessionIds)]);
            }
        }
    }

    async setUser(user: User): Promise<void> {
        for (let partition of this._partitions.values()) {
            if (partition.setUser) {
                await partition.setUser(user);
            }
        }
    }

    async setGrant(grant: string): Promise<void> {
        for (let partition of this._partitions.values()) {
            if (partition.setGrant) {
                await partition.setGrant(grant);
            }
        }
    }

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
            this._client.watchBranchDevices(this._branch).subscribe((event) => {
                if (!this._synced) {
                    this._updateSynced(true);
                }

                if (event.device.claims[SESSION_ID_CLAIM] === this._user.id) {
                    return;
                }

                if (event.type === 'repo/device_connected_to_branch') {
                    this._registerDevice(event.device);
                    this._tryLoadBranchForDevice(event.device);
                } else if (
                    event.type === 'repo/device_disconnected_from_branch'
                ) {
                    this._unregisterDevice(event.device);
                    this._tryUnloadBranchForDevice(event.device);
                }
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

    private _registerDevice(device: DeviceInfo) {
        if (this._devices.has(device.claims[SESSION_ID_CLAIM])) {
            let connected = this._devices.get(device.claims[SESSION_ID_CLAIM]);
            connected.connectionCount += 1;
        } else {
            const connected = {
                connectionCount: 1,
                deviceInfo: device,
            } as ConnectedDevice;
            this._devices.set(device.claims[SESSION_ID_CLAIM], connected);

            this._onEvents.next([
                action(ON_REMOTE_JOINED_ACTION_NAME, null, null, {
                    remoteId: device.claims[SESSION_ID_CLAIM],
                }),
                action(ON_REMOTE_PLAYER_SUBSCRIBED_ACTION_NAME, null, null, {
                    playerId: device.claims[SESSION_ID_CLAIM],
                }),
            ]);
        }
    }

    private _unregisterDevice(device: DeviceInfo) {
        if (this._devices.has(device.claims[SESSION_ID_CLAIM])) {
            let connected = this._devices.get(device.claims[SESSION_ID_CLAIM]);
            connected.connectionCount -= 1;
            if (connected.connectionCount <= 0) {
                this._devices.delete(device.claims[SESSION_ID_CLAIM]);
                this._onEvents.next([
                    action(ON_REMOTE_LEAVE_ACTION_NAME, null, null, {
                        remoteId: device.claims[SESSION_ID_CLAIM],
                    }),
                    action(
                        ON_REMOTE_PLAYER_UNSUBSCRIBED_ACTION_NAME,
                        null,
                        null,
                        {
                            playerId: device.claims[SESSION_ID_CLAIM],
                        }
                    ),
                ]);
            }
        }
    }

    /**
     * Attempts to load the player branch for the given device.
     * @param device The device.
     */
    private async _tryLoadBranchForDevice(device: DeviceInfo) {
        const branch = this._branchNameForDevice(device);
        if (!this._partitions.has(branch)) {
            console.log(
                `[OtherPlayersPartitionImpl] Loading partition for ${device.claims[SESSION_ID_CLAIM]}`
            );
            const sub = new Subscription();
            const partition = await createCausalRepoClientPartition(
                {
                    type: 'causal_repo_client',
                    branch: branch,
                    client: this._client,
                    temporary: true,
                    readOnly: true,
                },
                this._user
            );
            this._partitions.set(branch, partition);
            this._partitionSubs.set(branch, sub);
            sub.add(partition);

            sub.add(
                partition.onBotsAdded.subscribe(
                    (added) => {
                        this._onBotsAdded.next(added);
                    },
                    (err) => this._onBotsAdded.error(err)
                )
            );
            sub.add(
                partition.onBotsRemoved.subscribe(
                    (removed) => {
                        this._onBotsRemoved.next(removed);
                    },
                    (err) => this._onBotsRemoved.error(err)
                )
            );
            sub.add(
                partition.onBotsUpdated.subscribe(
                    (updated) => {
                        this._onBotsUpdated.next(updated);
                    },
                    (err) => this._onBotsUpdated.error(err)
                )
            );
            sub.add(partition.onError.subscribe(this._onError));
            sub.add(
                partition.onStateUpdated.pipe(skip(1)).subscribe(
                    (update) => {
                        this._state = applyUpdates(
                            this._state as PrecalculatedBotsState,
                            update
                        );
                        this._onStateUpdated.next(update);
                    },
                    (err) => this._onStateUpdated.error(err)
                )
            );

            partition.space = this.space;
            partition.connect();
        }
    }

    /**
     * Attempts to unload the player branch for the given device.
     * @param device The device.
     */
    private _tryUnloadBranchForDevice(device: DeviceInfo) {
        const branch = this._branchNameForDevice(device);
        if (this._partitions.has(branch)) {
            console.log(
                `[OtherPlayersPartitionImpl] Unloading partition for ${device.claims[SESSION_ID_CLAIM]}`
            );
            const partition = this._partitions.get(branch);
            this._partitions.delete(branch);
            const sub = this._partitionSubs.get(branch);
            this._partitionSubs.delete(branch);
            if (sub) {
                sub.unsubscribe();
            }

            let update = {} as PartialBotsState;
            const state = partition.state;
            const ids = Object.keys(state);
            let deleted = [] as string[];
            for (let id of ids) {
                const bot = this._state[id];
                if (bot.id) {
                    deleted.push(id);
                    update[id] = null;
                } else {
                    // Bot is partial, which means
                    // it was not created by this partition.
                    if (bot.masks) {
                        // Delete tag masks
                        const tags = bot.masks[this.space];
                        if (tags) {
                            for (let tag in tags) {
                                if (!update[id]) {
                                    update[id] = {};
                                }
                                const updatedBot = update[id];
                                if (!updatedBot.masks) {
                                    updatedBot.masks = {};
                                }
                                if (!updatedBot.masks[this.space]) {
                                    updatedBot.masks[this.space] = {};
                                }
                                updatedBot.masks[this.space][tag] = null;
                            }
                        }
                    }
                }
                delete this._state[id];
            }
            this._onBotsRemoved.next(deleted);
            const event = stateUpdatedEvent(update);
            if (
                event.addedBots.length > 0 ||
                event.removedBots.length > 0 ||
                event.updatedBots.length > 0
            ) {
                this._onStateUpdated.next(event);
            }
        }
    }

    private _branchNameForDevice(device: DeviceInfo) {
        return `${this._branch}-player-${device.claims[SESSION_ID_CLAIM]}`;
    }
}

interface ConnectedDevice {
    connectionCount: number;
    deviceInfo: DeviceInfo;
}
