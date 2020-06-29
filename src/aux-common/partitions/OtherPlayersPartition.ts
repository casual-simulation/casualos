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
} from '@casual-simulation/causal-trees';
import { CausalRepoClient } from '@casual-simulation/causal-trees/core2';
import {
    OtherPlayersPartition,
    AuxPartitionRealtimeStrategy,
    RemoteCausalRepoPartition,
    getPartitionState,
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
    GetPlayersAction,
    asyncResult,
} from '../bots';
import { Observable, Subject, Subscription } from 'rxjs';
import { startWith } from 'rxjs/operators';
import { createCausalRepoClientPartition } from './RemoteCausalRepoPartition';
import sortBy from 'lodash/sortBy';

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

    async sendRemoteEvents(events: RemoteAction[]): Promise<void> {
        for (let event of events) {
            if (event.event.type === 'get_players') {
                const action = <GetPlayersAction>event.event;
                const connectedDevices = [...this._devices.values()];
                const sessionIds = sortBy([
                    this._user.id,
                    ...connectedDevices.map(
                        cd => cd.deviceInfo.claims[SESSION_ID_CLAIM]
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
            this._client.connection.connectionState.subscribe(state => {
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
            this._client.watchBranchDevices(this._branch).subscribe(event => {
                if (!this._synced) {
                    this._updateSynced(true);
                }

                if (
                    event.device.claims[SESSION_ID_CLAIM] === this._user.id ||
                    event.device.claims[SESSION_ID_CLAIM] === 'server'
                ) {
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
        }
    }

    private _unregisterDevice(device: DeviceInfo) {
        if (this._devices.has(device.claims[SESSION_ID_CLAIM])) {
            let connected = this._devices.get(device.claims[SESSION_ID_CLAIM]);
            connected.connectionCount -= 1;
            if (connected.connectionCount <= 0) {
                this._devices.delete(device.claims[SESSION_ID_CLAIM]);
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
                `[OtherPlayersPartitionImpl] Loading partition for ${
                    device.claims[SESSION_ID_CLAIM]
                }`
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
                    added => {
                        this._state = Object.assign({}, this._state);
                        for (let bot of added) {
                            if (bot) {
                                this._state[bot.id] = bot;
                            }
                        }
                        this._onBotsAdded.next(added);
                    },
                    err => this._onBotsAdded.error(err)
                )
            );
            sub.add(
                partition.onBotsRemoved.subscribe(
                    removed => {
                        this._state = Object.assign({}, this._state);
                        for (let id of removed) {
                            delete this._state[id];
                        }
                        this._onBotsRemoved.next(removed);
                    },
                    err => this._onBotsRemoved.error(err)
                )
            );
            sub.add(
                partition.onBotsUpdated.subscribe(
                    updated => {
                        this._state = Object.assign({}, this._state);
                        for (let update of updated) {
                            this._state[update.bot.id] = update.bot;
                        }
                        this._onBotsUpdated.next(updated);
                    },
                    err => this._onBotsUpdated.error(err)
                )
            );
            sub.add(partition.onError.subscribe(this._onError));

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
                `[OtherPlayersPartitionImpl] Unloading partition for ${
                    device.claims[SESSION_ID_CLAIM]
                }`
            );
            const partition = this._partitions.get(branch);
            this._partitions.delete(branch);
            const sub = this._partitionSubs.get(branch);
            this._partitionSubs.delete(branch);
            if (sub) {
                sub.unsubscribe();
            }

            const state = partition.state;
            const ids = Object.keys(state);
            for (let id of ids) {
                delete this._state[id];
            }
            this._onBotsRemoved.next(ids);
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
