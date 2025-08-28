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
    OtherPlayersClientPartitionConfig,
    OtherPlayersRepoPartitionConfig,
    PartitionConfig,
} from './AuxPartitionConfig';
import type {
    OtherPlayersPartition,
    AuxPartitionRealtimeStrategy,
    AuxPartition,
} from './AuxPartition';
import type {
    BotsState,
    UpdatedBot,
    Bot,
    BotAction,
    GetRemotesAction,
    StateUpdatedEvent,
    PrecalculatedBotsState,
    PartialBotsState,
} from '../bots';
import {
    getActiveObjects,
    asyncResult,
    action,
    ON_REMOTE_PLAYER_SUBSCRIBED_ACTION_NAME,
    ON_REMOTE_PLAYER_UNSUBSCRIBED_ACTION_NAME,
    stateUpdatedEvent,
    applyUpdates,
    ON_REMOTE_JOINED_ACTION_NAME,
    ON_REMOTE_LEAVE_ACTION_NAME,
} from '../bots';
import type { Observable } from 'rxjs';
import { BehaviorSubject, Subject, Subscription, firstValueFrom } from 'rxjs';
import { filter, skip, startWith } from 'rxjs/operators';
import { sortBy } from 'es-toolkit/compat';
import { createRemoteClientYjsPartition } from './RemoteYjsPartition';
import type { InstRecordsClient } from '../websockets';
import type {
    Action,
    ConnectionInfo,
    CurrentVersion,
    RemoteActions,
    StatusUpdate,
} from '../common';
import { getConnectionId } from '../common';
import type { PartitionAuthSource } from './PartitionAuthSource';

export async function createOtherPlayersClientPartition(
    config: PartitionConfig,
    authSource: PartitionAuthSource
): Promise<OtherPlayersPartitionImpl> {
    if (config.type === 'other_players_client') {
        const partition = new OtherPlayersPartitionImpl(
            config.client,
            authSource,
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
    private _space: string;
    private _recordName: string;
    private _inst: string;
    private _branch: string;
    private _state: BotsState;
    private _skipInitialLoad: boolean;
    private _authSource: PartitionAuthSource;

    /**
     * The map of branch names to partitions.
     */
    private _partitions: Map<string, AuxPartition>;

    /**
     * The map of branch names to promises that resolve when the partition is ready.
     */
    private _partitionPromises: Map<string, Promise<AuxPartition>>;

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

    private _client: InstRecordsClient;
    private _synced: boolean;

    private: boolean;
    private _childParitionType: OtherPlayersClientPartitionConfig['childPartitionType'];

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
            startWith(
                stateUpdatedEvent(this.state, this._onVersionUpdated.value)
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
        client: InstRecordsClient,
        authSource: PartitionAuthSource,
        config:
            | OtherPlayersClientPartitionConfig
            | OtherPlayersRepoPartitionConfig
    ) {
        this._recordName = config.recordName;
        this._inst = config.inst;
        this._branch = config.branch;
        this._client = client;
        this._authSource = authSource;
        this._childParitionType = config.childPartitionType ?? 'yjs_client';
        this._state = {};
        this._partitions = new Map();
        this._partitionPromises = new Map();
        this._partitionSubs = new Map();
        this._devices = new Map();
        this._synced = false;
        this._skipInitialLoad = config.skipInitialLoad;
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
                    this._client.connection.info.connectionId,
                    ...connectedDevices.map((cd) => cd.deviceInfo.connectionId),
                ]);
                this._onEvents.next([asyncResult(event.taskId, sessionIds)]);
            }
        }
    }

    connect(): void {
        if (this._skipInitialLoad) {
            this._loadWithoutConnecting();
        } else {
            this._watchDevices();
        }
    }

    async enableCollaboration(): Promise<void> {
        this._skipInitialLoad = false;
        this._synced = false;
        const promise = firstValueFrom(
            this._onStatusUpdated.pipe(
                filter((u) => u.type === 'sync' && u.synced)
            )
        );
        this._watchDevices();
        await promise;
    }

    private _loadWithoutConnecting() {
        this._onStatusUpdated.next({
            type: 'connection',
            connected: true,
        });
        const indicator = this._client.connection.indicator;
        const connectionId = indicator
            ? getConnectionId(indicator)
            : 'missing-connection-id';
        this._onStatusUpdated.next({
            type: 'authentication',
            authenticated: true,
            info: this._client.connection.info ?? {
                connectionId: connectionId,
                sessionId: null,
                userId: null,
            },
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

    private _watchDevices() {
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
            this._client
                .watchBranchDevices(this._recordName, this._inst, this._branch)
                .subscribe((event) => {
                    if (!this._synced) {
                        this._updateSynced(true);
                    }

                    if (
                        event.connection.connectionId ===
                        this._client.connection.info?.connectionId
                    ) {
                        return;
                    }

                    if (event.type === 'repo/connected_to_branch') {
                        this._registerDevice(event.connection);
                        this._tryLoadBranchForDevice(event.connection);
                    } else if (event.type === 'repo/disconnected_from_branch') {
                        this._unregisterDevice(event.connection);
                        this._tryUnloadBranchForDevice(event.connection);
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

    private _registerDevice(device: ConnectionInfo) {
        if (this._devices.has(device.connectionId)) {
            let connected = this._devices.get(device.connectionId);
            connected.connectionCount += 1;
        } else {
            const connected = {
                connectionCount: 1,
                deviceInfo: device,
            } as ConnectedDevice;
            this._devices.set(device.connectionId, connected);

            this._onEvents.next([
                action(ON_REMOTE_JOINED_ACTION_NAME, null, null, {
                    remoteId: device.connectionId,
                }),
                action(ON_REMOTE_PLAYER_SUBSCRIBED_ACTION_NAME, null, null, {
                    playerId: device.connectionId,
                }),
            ]);
        }
    }

    private _unregisterDevice(device: ConnectionInfo) {
        if (this._devices.has(device.connectionId)) {
            let connected = this._devices.get(device.connectionId);
            connected.connectionCount -= 1;
            if (connected.connectionCount <= 0) {
                this._devices.delete(device.connectionId);
                this._onEvents.next([
                    action(ON_REMOTE_LEAVE_ACTION_NAME, null, null, {
                        remoteId: device.connectionId,
                    }),
                    action(
                        ON_REMOTE_PLAYER_UNSUBSCRIBED_ACTION_NAME,
                        null,
                        null,
                        {
                            playerId: device.connectionId,
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
    private async _tryLoadBranchForDevice(device: ConnectionInfo) {
        const branch = this._branchNameForDevice(device);
        if (!this._partitionPromises.has(branch)) {
            const promise = this._loadPartition(branch, device);
            this._partitionPromises.set(branch, promise);
            await promise;
        }
    }

    private async _loadPartition(
        branch: string,
        device: ConnectionInfo
    ): Promise<AuxPartition> {
        console.log(
            `[OtherPlayersPartitionImpl] Loading partition for ${device.connectionId}`
        );
        const sub = new Subscription();
        const promise =
            this._childParitionType === 'yjs_client'
                ? createRemoteClientYjsPartition(
                      {
                          type: 'yjs_client',
                          recordName: this._recordName,
                          inst: this._inst,
                          branch: branch,
                          client: this._client,
                          temporary: true,
                          readOnly: true,
                      },
                      this._authSource
                  )
                : createRemoteClientYjsPartition(
                      {
                          type: 'yjs_client',
                          recordName: this._recordName,
                          inst: this._inst,
                          branch: branch,
                          client: this._client,
                          temporary: true,
                          readOnly: true,
                      },
                      this._authSource
                  );
        const partition = await promise;
        this._partitions.set(branch, partition);
        this._partitionSubs.set(branch, sub);
        sub.add(partition);

        sub.add(
            partition.onBotsAdded.subscribe({
                next: (added) => {
                    this._onBotsAdded.next(added);
                },
                error: (err) => this._onBotsAdded.error(err),
            })
        );
        sub.add(
            partition.onBotsRemoved.subscribe({
                next: (removed) => {
                    this._onBotsRemoved.next(removed);
                },
                error: (err) => this._onBotsRemoved.error(err),
            })
        );
        sub.add(
            partition.onBotsUpdated.subscribe({
                next: (updated) => {
                    this._onBotsUpdated.next(updated);
                },
                error: (err) => this._onBotsUpdated.error(err),
            })
        );
        sub.add(partition.onError.subscribe(this._onError));
        sub.add(
            partition.onStateUpdated.pipe(skip(1)).subscribe({
                next: (update) => {
                    this._state = applyUpdates(
                        this._state as PrecalculatedBotsState,
                        update
                    );
                    this._onStateUpdated.next({
                        ...update,
                        version: null,
                    });
                },
                error: (err) => this._onStateUpdated.error(err),
            })
        );

        partition.space = this.space;
        partition.connect();

        return partition;
    }

    /**
     * Attempts to unload the player branch for the given device.
     * @param device The device.
     */
    private async _tryUnloadBranchForDevice(device: ConnectionInfo) {
        const branch = this._branchNameForDevice(device);
        if (this._partitionPromises.has(branch)) {
            console.log(
                `[OtherPlayersPartitionImpl] Unloading partition for ${device.connectionId}`
            );
            const partition = await this._partitionPromises.get(branch);
            this._partitions.delete(branch);
            this._partitionPromises.delete(branch);
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
            const event = stateUpdatedEvent(update, null);
            if (
                event.addedBots.length > 0 ||
                event.removedBots.length > 0 ||
                event.updatedBots.length > 0
            ) {
                this._onStateUpdated.next(event);
            }
        }
    }

    private _branchNameForDevice(device: ConnectionInfo) {
        return `${this._branch}-player-${device.connectionId}`;
    }
}

interface ConnectedDevice {
    connectionCount: number;
    deviceInfo: ConnectionInfo;
}
