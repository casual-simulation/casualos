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
    ConnectionClient,
    ClientConnectionState,
} from './ConnectionClient';
import {
    filter,
    map,
    switchMap,
    tap,
    finalize,
    first,
    scan,
} from 'rxjs/operators';
import type { Observable } from 'rxjs';
import { merge, of, Subject } from 'rxjs';
import type {
    AddUpdatesMessage,
    ConnectedToBranchMessage,
    DisconnectedFromBranchMessage,
    WatchBranchMessage,
    WatchBranchResultMessage,
    WebsocketErrorInfo,
} from './WebsocketEvents';
import type {
    DeviceAction,
    DeviceActionResult,
    DeviceActionError,
    RemoteActions,
} from '../common/RemoteActions';
import type { ConnectionInfo } from '../common/ConnectionInfo';
import type { TimeSample } from '@casual-simulation/timesync';

export const DEFAULT_BRANCH_NAME = 'default';

/**
 * Defines a client for inst records.
 */
export class InstRecordsClient {
    private _client: ConnectionClient;
    private _sentUpdates: Map<string, Map<number, SentUpdates>>;
    private _updateCounter: number = 0;
    private _watchedBranches: Set<string>;
    private _connectedBranches: Set<string>;
    private _connectedDevices: Map<string, Map<string, ConnectionInfo>>;
    private _connectedDeviceBranches: Set<string>;
    private _forcedOffline: boolean;
    private _timeSyncCounter: number = 0;
    private _resendUpdatesAfter: number = null;
    private _resendUpdatesInterval: number = null;
    private _resendUpdatesIntervalId: number = null;

    private _onSyncUpdatesEvent: Subject<SyncUpdatesEvent> = new Subject();

    get onSyncUpdatesEvent(): Observable<SyncUpdatesEvent> {
        return this._onSyncUpdatesEvent;
    }

    /**
     * Gets the amount of time in miliseconds that the client should wait before resending updates that were never acknowledged.
     * If null, then the client will never resend updates based on time.
     */
    get resendUpdatesAfterMs(): number | null {
        return this._resendUpdatesAfter;
    }

    /**
     * Sets the amount of time in miliseconds that the client should wait before resending updates that were never acknowledged.
     * If null, then the client will never resend updates based on time.
     */
    set resendUpdatesAfterMs(value: number | null) {
        this._resendUpdatesAfter = value;
    }

    get resendUpdatesIntervalMs(): number | null {
        return this._resendUpdatesInterval;
    }

    set resendUpdatesIntervalMs(value: number | null) {
        this._resendUpdatesInterval = value;

        if (this._resendUpdatesInterval) {
            this._startResendUpdatesInterval();
        } else {
            this._stopResendUpdatesInterval();
        }
    }

    private _stopResendUpdatesInterval() {
        if (this._resendUpdatesIntervalId) {
            clearInterval(this._resendUpdatesIntervalId);
        }
    }

    private _startResendUpdatesInterval() {
        this._stopResendUpdatesInterval();
        this._resendUpdatesIntervalId = setInterval(() => {
            this._resendUpdates();
        }, this._resendUpdatesInterval) as unknown as number;
    }

    private _resendUpdates() {
        for (let [branchKey, updates] of this._sentUpdates) {
            for (let [updateId, sentUpdate] of updates) {
                const lastTryTime = sentUpdate.lastTryTimeMs;
                const retryAfter =
                    this._resendUpdatesAfter *
                    Math.pow(2, Math.min(sentUpdate.tryCount - 1, 3));

                const now = Date.now();
                if (lastTryTime + retryAfter <= now) {
                    sentUpdate.tryCount += 1;
                    sentUpdate.lastTryTimeMs = now;
                    let [recordName, inst, branch] = branchKey.split('/');
                    if (!recordName) {
                        recordName = null;
                    }
                    this._sendAddUpdates(
                        recordName,
                        inst,
                        branch,
                        sentUpdate.updates,
                        updateId
                    );
                }
            }
        }
    }

    constructor(connection: ConnectionClient) {
        this._client = connection;
        this._forcedOffline = false;
        this._sentUpdates = new Map();
        this._connectedDevices = new Map();
        this._watchedBranches = new Set();
        this._connectedBranches = new Set();
        this._connectedDeviceBranches = new Set();
    }

    /**
     * Gets the connection that this client is using.
     */
    get connection() {
        return this._client;
    }

    get onError() {
        return this._client.onError;
    }

    /**
     * Gets whether the client is forcing the connection to be offline or not.
     */
    public get forcedOffline() {
        return this._forcedOffline;
    }

    /**
     * Sets whether the client is forcing the connection to be offline or not.
     */
    public set forcedOffline(value: boolean) {
        if (value === this._forcedOffline) {
            return;
        }
        this._forcedOffline = value;
        if (this._forcedOffline) {
            this._client.disconnect();
        } else {
            this._client.connect();
        }
    }

    /**
     * Starts watching the given branch.
     * @param name The name of the branch to watch.
     */
    watchBranchUpdates(nameOrEvent: string | WatchBranchMessage) {
        let branchEvent: WatchBranchMessage;
        if (typeof nameOrEvent === 'string') {
            branchEvent = {
                type: 'repo/watch_branch',
                recordName: null,
                inst: nameOrEvent,
                branch: DEFAULT_BRANCH_NAME,
            };
        } else {
            branchEvent = {
                ...nameOrEvent,
            };
        }
        const recordName = branchEvent.recordName ?? null;
        const inst = branchEvent.inst;
        const branch = branchEvent.branch;
        const watchedBranchKey = branchKey(recordName, inst, branch);
        this._watchedBranches.add(watchedBranchKey);
        return this._whenConnected().pipe(
            tap((connected) => {
                if (
                    connected &&
                    this._connectedBranches.has(watchedBranchKey)
                ) {
                    this._connectedBranches.delete(watchedBranchKey);
                    this._client.send({
                        type: 'repo/unwatch_branch',
                        recordName,
                        inst,
                        branch,
                    });
                }

                this._client.send(branchEvent);
            }),
            switchMap((connected) =>
                merge(
                    this._client.event('repo/watch_branch_result').pipe(
                        filter(
                            (event) =>
                                event.recordName === recordName &&
                                event.inst === inst &&
                                event.branch === branch
                        ),
                        tap((e) => {
                            this._connectedBranches.add(watchedBranchKey);

                            if (e.success) {
                                let list = this._getSentUpdates(
                                    recordName,
                                    inst,
                                    branch
                                );

                                for (let [key, value] of list) {
                                    this._sendAddUpdates(
                                        recordName,
                                        inst,
                                        branch,
                                        value.updates,
                                        key
                                    );
                                }
                            }
                        })
                    ),
                    this._client.event('repo/add_updates').pipe(
                        filter(
                            (event) =>
                                event.recordName === recordName &&
                                event.inst === inst &&
                                event.branch === branch
                        ),
                        scan(
                            (acc, event) => {
                                // This is the first event
                                if (acc[0] === null) {
                                    // first event is initial event,
                                    // skip to processing events
                                    if (event.initial) {
                                        return ['event', event] as [
                                            'event',
                                            AddUpdatesMessage
                                        ];
                                    } else {
                                        // first event is not initial.
                                        // store it for later.
                                        return ['waiting', [event]] as [
                                            'waiting',
                                            AddUpdatesMessage[]
                                        ];
                                    }
                                } else if (acc[0] === 'waiting') {
                                    // This event is happening while we are waiting for the initial event.
                                    const events =
                                        acc[1] as AddUpdatesMessage[];
                                    if (event.initial) {
                                        // current event is initial event,
                                        // merge events.
                                        const allEvents = events;
                                        const allUpdates = allEvents.flatMap(
                                            (e) => e.updates ?? []
                                        );

                                        return [
                                            'event',
                                            {
                                                branch: event.branch,
                                                updates: [
                                                    ...allUpdates,
                                                    ...event.updates,
                                                ],
                                            } as AddUpdatesMessage,
                                        ] as ['event', AddUpdatesMessage];
                                    } else {
                                        // current event is not initial,
                                        // store event
                                        return [
                                            'waiting',
                                            [...events, event],
                                        ] as ['waiting', AddUpdatesMessage[]];
                                    }
                                } else {
                                    // This event is happening after we have got the initial event
                                    return ['event', event] as [
                                        'event',
                                        AddUpdatesMessage
                                    ];
                                }
                            },
                            [null] as
                                | [null]
                                | ['waiting', AddUpdatesMessage[]]
                                | ['event', AddUpdatesMessage]
                        ),
                        filter(([type, event]) => type === 'event'),
                        map(([type, event]) => event as AddUpdatesMessage),
                        map(
                            (e) =>
                                ({
                                    type: 'updates',
                                    updates: e.updates,
                                } as ClientUpdates)
                        )
                    ),
                    this._client.event('repo/updates_received').pipe(
                        filter(
                            (event) =>
                                event.recordName === recordName &&
                                event.inst === inst &&
                                event.branch === branch
                        ),
                        tap((event) => {
                            if (branchEvent.temporary) {
                                return;
                            }

                            // TODO: Decide whether to mark off the updates
                            // as saved or not when an error occurs.
                            // Right now, if the the updates are not stored on the server
                            // because too much space is used, then they will never be sent back to the server again.
                            let list = this._getSentUpdates(
                                recordName,
                                inst,
                                branch
                            );
                            list.delete(event.updateId);
                            if (list.size === 0) {
                                this._onSyncUpdatesEvent.next({
                                    type: 'synced',
                                    recordName,
                                    inst,
                                    branch,
                                });
                            }
                        }),
                        map((event) => {
                            if (event.errorCode === 'max_size_reached') {
                                return {
                                    type: 'error',
                                    kind: event.errorCode,
                                    maxBranchSizeInBytes:
                                        event.maxBranchSizeInBytes,
                                    neededBranchSizeInBytes:
                                        event.neededBranchSizeInBytes,
                                } as MaxInstSizeReachedClientError;
                            }
                            return {
                                type: 'updates_received',
                            } as ClientUpdatesReceived;
                        })
                    ),
                    this._client.event('repo/receive_action').pipe(
                        filter(
                            (event) =>
                                event.recordName === recordName &&
                                event.inst === inst &&
                                event.branch === branch
                        ),
                        map(
                            (event) =>
                                ({
                                    type: 'event',
                                    action: event.action,
                                } as ClientEvent)
                        )
                    ),
                    this._client.onError.pipe(
                        filter(
                            (error) =>
                                error.recordName === recordName &&
                                error.inst === inst &&
                                error.branch === branch
                        ),
                        map(
                            (error) =>
                                ({
                                    type: 'error',
                                    kind: 'error',
                                    info: error,
                                } as WebsocketClientError)
                        )
                    )
                ).pipe(filter(isClientUpdatesOrEvents))
            ),
            finalize(() => {
                this._watchedBranches.delete(watchedBranchKey);
                this._connectedBranches.delete(watchedBranchKey);

                if (this._client.isConnected) {
                    this._client.send({
                        type: 'repo/unwatch_branch',
                        recordName,
                        inst,
                        branch,
                    });
                }
            })
        );
    }

    /**
     * Watches for rate limit exceeded events.
     */
    watchRateLimitExceeded() {
        return this._whenConnected().pipe(
            switchMap(() => this._client.event('rate_limit_exceeded'))
        );
    }

    /**
     * Gets the updates stored on the given branch.
     * @param recordName The name of the record.
     * @param inst The name of the inst.
     * @param name The name of the branch to get.
     */
    getBranchUpdates(
        recordName: string | null,
        inst: string,
        branch: string
    ): Observable<{ updates: string[]; timestamps?: number[] }> {
        return this._whenConnected().pipe(
            first((connected) => connected),
            tap((connected) => {
                this._client.send({
                    type: 'repo/get_updates',
                    recordName,
                    inst,
                    branch,
                });
            }),
            switchMap((connected) =>
                this._client
                    .event('repo/add_updates')
                    .pipe(
                        first(
                            (event) =>
                                event.recordName === recordName &&
                                event.inst === inst &&
                                event.branch === branch
                        )
                    )
            )
        );
    }

    /**
     * Watches for device connection/disconnection events on the given branch.
     * @param branch The branch to watch.
     */
    watchBranchDevices(
        recordName: string | null,
        inst: string,
        branch: string
    ) {
        return this._whenConnected(false).pipe(
            switchMap((connected) =>
                // Grab all of the currently connected devices
                // and send disconnected events for them
                !connected
                    ? this._disconnectDevices(recordName, inst, branch)
                    : this._watchConnectedDevices(recordName, inst, branch)
            )
        );
    }

    private _disconnectDevices(
        recordName: string | null,
        inst: string,
        branch: string
    ) {
        return of(
            ...[
                ...this._getConnectedDevices(recordName, inst, branch).values(),
            ].map(
                (device) =>
                    ({
                        type: 'repo/disconnected_from_branch',
                        broadcast: false,
                        recordName,
                        inst,
                        branch: branch,
                        connection: device,
                    } as DisconnectedFromBranchMessage)
            )
        );
    }

    private _watchConnectedDevices(
        recordName: string | null,
        inst: string,
        branch: string
    ) {
        const watchedBranchKey = branchKey(recordName, inst, branch);
        return of(true).pipe(
            tap((connected) => {
                if (
                    connected &&
                    this._connectedDeviceBranches.has(watchedBranchKey)
                ) {
                    this._client.send({
                        type: 'repo/unwatch_branch_devices',
                        recordName,
                        inst,
                        branch,
                    });
                }
                this._connectedDeviceBranches.add(watchedBranchKey);
                this._client.send({
                    type: 'repo/watch_branch_devices',
                    recordName,
                    inst,
                    branch,
                });
            }),
            switchMap((connected) =>
                merge(
                    this._client.event('repo/connected_to_branch').pipe(
                        filter(
                            (e) =>
                                e.broadcast === false &&
                                e.branch.recordName === recordName &&
                                e.branch.inst === inst &&
                                e.branch.branch === branch &&
                                !this._isDeviceConnected(
                                    recordName,
                                    inst,
                                    branch,
                                    e.connection
                                )
                        ),
                        tap((e) => {
                            const devices = this._getConnectedDevices(
                                recordName,
                                inst,
                                branch
                            );
                            devices.set(
                                e.connection.connectionId,
                                e.connection
                            );
                        }),
                        map(
                            (e) =>
                                ({
                                    type: 'repo/connected_to_branch',
                                    ...e,
                                } as ConnectedToBranchMessage)
                        )
                    ),
                    this._client.event('repo/disconnected_from_branch').pipe(
                        filter(
                            (e) =>
                                e.broadcast === false &&
                                e.recordName === recordName &&
                                e.inst === inst &&
                                e.branch === branch &&
                                this._isDeviceConnected(
                                    recordName,
                                    inst,
                                    branch,
                                    e.connection
                                )
                        ),
                        tap((e) => {
                            const devices = this._getConnectedDevices(
                                recordName,
                                inst,
                                branch
                            );
                            devices.delete(e.connection.connectionId);
                        }),
                        map(
                            (e) =>
                                ({
                                    type: 'repo/disconnected_from_branch',
                                    ...e,
                                } as DisconnectedFromBranchMessage)
                        )
                    )
                )
            ),
            finalize(() => {
                this._connectedDeviceBranches.delete(watchedBranchKey);
                if (this._client.isConnected) {
                    this._client.send({
                        type: 'repo/unwatch_branch_devices',
                        recordName,
                        inst,
                        branch,
                    });
                }
            })
        );
    }

    /**
     * Adds the given updates to the given branch.
     * @param recordName The name of the record.
     * @param inst The name of the inst.
     * @param branch The name of the branch.
     * @param updates The updates.
     */
    addUpdates(
        recordName: string | null,
        inst: string,
        branch: string,
        updates: string[]
    ) {
        if (updates.length <= 0) {
            return;
        }

        let list = this._getSentUpdates(recordName, inst, branch);

        this._updateCounter += 1;
        list.set(this._updateCounter, {
            updates,
            updateId: this._updateCounter,
            sentTimeMs: Date.now(),
            lastTryTimeMs: Date.now(),
            tryCount: 1,
        });
        this._sendAddUpdates(
            recordName,
            inst,
            branch,
            updates,
            this._updateCounter
        );
        if (list.size === 1) {
            this._onSyncUpdatesEvent.next({
                type: 'syncing',
                recordName,
                inst,
                branch,
            });
        }
    }

    /**
     * Sends the given action to devices on the given branch.
     * @param branch The branch.
     * @param action The action.
     */
    sendAction(
        recordName: string | null,
        inst: string,
        branch: string,
        action: RemoteActions
    ) {
        this._client.send({
            type: 'repo/send_action',
            recordName,
            inst,
            branch,
            action,
        });
    }

    /**
     * Sends a SyncTimeRequest to the server.
     */
    sampleServerTime(): Promise<TimeSample> {
        let count = this._timeSyncCounter + 1;
        this._timeSyncCounter = count;
        const observable = this._whenConnected().pipe(
            first((c) => c),
            tap((connected) => {
                this._client.send({
                    type: 'sync/time',
                    id: count,
                    clientRequestTime: Date.now(),
                });
            }),
            switchMap((connected) =>
                this._client.event('sync/time/response').pipe(
                    first((event) => event.id === count),
                    map(
                        (r) =>
                            ({
                                clientRequestTime: r.clientRequestTime,
                                currentTime: Date.now(),
                                serverReceiveTime: r.serverReceiveTime,
                                serverTransmitTime: r.serverTransmitTime,
                            } as TimeSample)
                    )
                )
            )
        );

        return new Promise<TimeSample>((resolve, reject) => {
            observable.subscribe({
                next: (o) => resolve(o),
                error: (err) => reject(err),
            });
        });
    }

    /**
     * Requests the number of devices that are currently connected.
     * @param branch The branch that the devices should be counted on.
     */
    connectionCount(
        recordName: string = null,
        inst: string = null,
        branch: string = null
    ) {
        recordName = recordName ?? null;
        inst = inst ?? null;
        branch = branch ?? null;
        return this._whenConnected().pipe(
            tap((connected) => {
                this._client.send({
                    type: 'repo/connection_count',
                    recordName,
                    inst,
                    branch,
                });
            }),
            switchMap((connected) =>
                merge(
                    this._client
                        .event('repo/connection_count')
                        .pipe(
                            first(
                                (e) =>
                                    e.recordName === recordName &&
                                    e.inst === inst &&
                                    e.branch === branch
                            )
                        )
                )
            ),
            map((e) => e.count)
        );
    }

    private _whenConnected(filter: boolean = true) {
        return whenConnected(this._client.connectionState, filter);
    }

    private _sendAddUpdates(
        recordName: string | null,
        inst: string,
        branch: string,
        updates: string[],
        updateId: number
    ) {
        if (this._watchedBranches.has(branch) && !this.connection.isConnected) {
            // Skip sending the atoms because we're watching the branch and we're not connected.
            // This means that the new atoms are saved in the sent atoms list so they will be resent
            // when we reconnect.
            return;
        }
        this._client.send({
            type: 'repo/add_updates',
            recordName,
            inst,
            branch,
            updates,
            updateId,
        });
    }

    private _getSentUpdates(
        recordName: string | null,
        inst: string,
        branch: string
    ) {
        const key = branchKey(recordName, inst, branch);
        let map = this._sentUpdates.get(key);
        if (!map) {
            map = new Map();
            this._sentUpdates.set(key, map);
        }
        return map;
    }

    private _getConnectedDevices(
        recordName: string | null,
        inst: string,
        branch: string
    ) {
        const key = branchKey(recordName, inst, branch);
        let map = this._connectedDevices.get(key);
        if (!map) {
            map = new Map();
            this._connectedDevices.set(key, map);
        }
        return map;
    }

    private _isDeviceConnected(
        recordName: string | null,
        inst: string,
        branch: string,
        device: ConnectionInfo
    ): boolean {
        const map = this._getConnectedDevices(recordName, inst, branch);
        return map.has(device.connectionId);
    }
}

export interface ClientUpdates {
    type: 'updates';
    updates: string[];
}

export interface ClientUpdatesReceived {
    type: 'updates_received';
}

export interface ClientAtomsReceived {
    type: 'atoms_received';
}

export interface ClientEvent {
    type: 'event';
    action: DeviceAction | DeviceActionResult | DeviceActionError;
}

export interface BaseClientError {
    type: 'error';
    kind: string;
}

export type ClientError = MaxInstSizeReachedClientError | WebsocketClientError;
export interface MaxInstSizeReachedClientError extends BaseClientError {
    kind: 'max_size_reached';
    maxBranchSizeInBytes: number;
    neededBranchSizeInBytes: number;
}

export interface WebsocketClientError extends BaseClientError {
    kind: 'error';
    info: WebsocketErrorInfo;
}

export type ClientWatchBranchMessages = ClientAtomsReceived | ClientEvent;

export type ClientWatchBranchUpdatesEvents =
    | ClientUpdates
    | ClientUpdatesReceived
    | ClientEvent
    | ClientError
    | WatchBranchResultMessage;

export type ClientUpdatesOrEvent =
    | ClientUpdates
    | ClientEvent
    | ClientError
    | WatchBranchResultMessage;

export function isClientEvent(
    event: ClientWatchBranchMessages | ClientWatchBranchUpdatesEvents
): event is ClientEvent {
    return event.type === 'event';
}

export function isClientUpdates(
    event: ClientWatchBranchUpdatesEvents
): event is ClientUpdates {
    return event.type === 'updates';
}

export function isClientUpdatesOrEvents(
    event: ClientWatchBranchUpdatesEvents
): event is ClientUpdatesOrEvent {
    return (
        event.type === 'updates' ||
        event.type === 'event' ||
        event.type === 'error' ||
        event.type === 'repo/watch_branch_result'
    );
}

export function isClientError(
    event: ClientWatchBranchUpdatesEvents
): event is ClientError {
    return event.type === 'error';
}

export function isWatchBranchResult(
    event: ClientWatchBranchUpdatesEvents
): event is WatchBranchResultMessage {
    return event.type === 'repo/watch_branch_result';
}

function whenConnected(
    observable: Observable<ClientConnectionState>,
    filterConnected: boolean = true
): Observable<boolean> {
    return observable.pipe(
        map((s) => s.connected),
        filterConnected ? filter((connected) => connected) : (a) => a
    );
}

function branchKey(
    recordName: string | null,
    inst: string,
    branch: string
): string {
    return `${recordName ?? ''}/${inst}/${branch}`;
}

interface SentUpdates {
    updates: string[];
    updateId: number;
    sentTimeMs: number;
    lastTryTimeMs: number;
    tryCount: number;
}

export type SyncUpdatesEvent = SyncingUpdatesEvent | SyncedUpdatesEvent;

export interface SyncingUpdatesEvent {
    type: 'syncing';
    recordName: string | null;
    inst: string;
    branch: string;
}

export interface SyncedUpdatesEvent {
    type: 'synced';
    recordName: string | null;
    inst: string;
    branch: string;
}
