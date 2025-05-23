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
import type { ClientError, SyncUpdatesEvent } from './InstRecordsClient';
import {
    InstRecordsClient,
    isClientError,
    isClientEvent,
    isClientUpdates,
    DEFAULT_BRANCH_NAME,
    isWatchBranchResult,
} from './InstRecordsClient';
import { MemoryConnectionClient } from './MemoryConnectionClient';
import { Subject } from 'rxjs';
import { waitAsync } from '../test/TestHelpers';
import type {
    AddUpdatesMessage,
    ConnectedToBranchMessage,
    ConnectionCountMessage,
    DisconnectedFromBranchMessage,
    RateLimitExceededMessage,
    ReceiveDeviceActionMessage,
    TimeSyncResponseMessage,
    UpdatesReceivedMessage,
    WatchBranchResultMessage,
} from './WebsocketEvents';
import { filter, map } from 'rxjs/operators';
import type {
    DeviceAction,
    DeviceActionResult,
    DeviceActionError,
} from '../common/RemoteActions';
import { device, remote } from '../common/RemoteActions';
import { connectionInfo } from '../common/ConnectionInfo';
import type { TimeSample } from '@casual-simulation/timesync';

describe('InstRecordsClient', () => {
    let client: InstRecordsClient;
    let connection: MemoryConnectionClient;

    beforeEach(() => {
        connection = new MemoryConnectionClient();
        client = new InstRecordsClient(connection);
    });

    describe('watchBranchUpdates()', () => {
        it('should send a watch branch event after connecting', async () => {
            client.watchBranchUpdates('abc').subscribe();

            expect(connection.sentMessages).toEqual([]);

            connection.connect();
            await waitAsync();

            expect(connection.sentMessages).toEqual([
                {
                    type: 'repo/watch_branch',
                    recordName: null,
                    inst: 'abc',
                    branch: DEFAULT_BRANCH_NAME,
                },
            ]);
        });

        it('should return an observable of updates for the branch', async () => {
            const addUpdates = new Subject<AddUpdatesMessage>();
            connection.events.set('repo/add_updates', addUpdates);

            let updates = [] as string[];
            connection.connect();
            client
                .watchBranchUpdates('abc')
                .pipe(
                    filter(isClientUpdates),
                    map((e) => e.updates)
                )
                .subscribe((a) => updates.push(...a));

            await waitAsync();

            addUpdates.next({
                type: 'repo/add_updates',
                recordName: null,
                inst: 'abc',
                branch: DEFAULT_BRANCH_NAME,
                updates: ['111', '222'],
                initial: true,
            });

            addUpdates.next({
                type: 'repo/add_updates',
                recordName: null,
                inst: 'other',
                branch: DEFAULT_BRANCH_NAME,
                updates: ['333', '444'],
            });

            await waitAsync();

            expect(updates).toEqual(['111', '222']);
        });

        it('should buffer add updates events until the intial event', async () => {
            const addUpdates = new Subject<AddUpdatesMessage>();
            connection.events.set('repo/add_updates', addUpdates);

            let updates = [] as string[];
            connection.connect();
            client
                .watchBranchUpdates('abc')
                .pipe(
                    filter(isClientUpdates),
                    map((e) => e.updates)
                )
                .subscribe((a) => updates.push(...a));

            await waitAsync();

            addUpdates.next({
                type: 'repo/add_updates',
                recordName: null,
                inst: 'abc',
                branch: DEFAULT_BRANCH_NAME,
                updates: ['111', '222'],
            });

            addUpdates.next({
                type: 'repo/add_updates',
                recordName: null,
                inst: 'abc',
                branch: DEFAULT_BRANCH_NAME,
                updates: ['333', '444'],
            });

            await waitAsync();
            expect(updates).toEqual([]);

            addUpdates.next({
                type: 'repo/add_updates',
                recordName: null,
                inst: 'abc',
                branch: DEFAULT_BRANCH_NAME,
                updates: ['555'],
                initial: true,
            });

            await waitAsync();

            expect(updates).toEqual(['111', '222', '333', '444', '555']);
        });

        it('should return an observable of events for the branch', async () => {
            const receiveEvent = new Subject<ReceiveDeviceActionMessage>();
            connection.events.set('repo/receive_action', receiveEvent);

            let events = [] as (
                | DeviceAction
                | DeviceActionResult
                | DeviceActionError
            )[];
            connection.connect();
            client
                .watchBranchUpdates('abc')
                .pipe(
                    filter(isClientEvent),
                    map((e) => e.action)
                )
                .subscribe((a) => events.push(a));

            await waitAsync();

            const info = connectionInfo('username', 'deviceId', 'sessionId');

            receiveEvent.next({
                type: 'repo/receive_action',
                recordName: null,
                inst: 'abc',
                branch: DEFAULT_BRANCH_NAME,
                action: device(info, {
                    type: 'abc',
                }),
            });

            receiveEvent.next({
                type: 'repo/receive_action',
                recordName: null,
                inst: 'other',
                branch: DEFAULT_BRANCH_NAME,
                action: device(info, {
                    type: 'wrong',
                }),
            });

            await waitAsync();

            expect(events).toEqual([
                device(info, {
                    type: 'abc',
                }),
            ]);
        });

        it('should send a watch branch event after disconnecting and reconnecting', async () => {
            connection.connect();
            client.watchBranchUpdates('abc').subscribe();

            await waitAsync();
            expect(connection.sentMessages).toEqual([
                {
                    type: 'repo/watch_branch',
                    recordName: null,
                    inst: 'abc',
                    branch: DEFAULT_BRANCH_NAME,
                },
            ]);

            connection.disconnect();
            await waitAsync();
            expect(connection.sentMessages).toEqual([
                {
                    type: 'repo/watch_branch',
                    recordName: null,
                    inst: 'abc',
                    branch: DEFAULT_BRANCH_NAME,
                },
            ]);

            connection.connect();
            await waitAsync();
            expect(connection.sentMessages).toEqual([
                {
                    type: 'repo/watch_branch',
                    recordName: null,
                    inst: 'abc',
                    branch: DEFAULT_BRANCH_NAME,
                },
                {
                    type: 'repo/watch_branch',
                    recordName: null,
                    inst: 'abc',
                    branch: DEFAULT_BRANCH_NAME,
                },
            ]);
        });

        it('should unwatch and then rewatch if a second connection event is sent', async () => {
            const onResult = new Subject<WatchBranchResultMessage>();
            connection.events.set('repo/watch_branch_result', onResult);

            connection.connect();
            client.watchBranchUpdates('abc').subscribe();

            await waitAsync();
            expect(connection.sentMessages).toEqual([
                {
                    type: 'repo/watch_branch',
                    recordName: null,
                    inst: 'abc',
                    branch: DEFAULT_BRANCH_NAME,
                },
            ]);

            onResult.next({
                type: 'repo/watch_branch_result',
                success: true,
                recordName: null,
                inst: 'abc',
                branch: DEFAULT_BRANCH_NAME,
            });

            await waitAsync();

            connection.connect();
            await waitAsync();
            expect(connection.sentMessages).toEqual([
                {
                    type: 'repo/watch_branch',
                    recordName: null,
                    inst: 'abc',
                    branch: DEFAULT_BRANCH_NAME,
                },
                {
                    type: 'repo/unwatch_branch',
                    recordName: null,
                    inst: 'abc',
                    branch: DEFAULT_BRANCH_NAME,
                },
                {
                    type: 'repo/watch_branch',
                    recordName: null,
                    inst: 'abc',
                    branch: DEFAULT_BRANCH_NAME,
                },
            ]);
        });

        it('should remember updates that were sent to the branch and resend them after reconnecting if they were not acknowledged', async () => {
            const updatesReceived = new Subject<UpdatesReceivedMessage>();
            connection.events.set('repo/updates_received', updatesReceived);

            const watchBranchResult = new Subject<WatchBranchResultMessage>();
            connection.events.set(
                'repo/watch_branch_result',
                watchBranchResult
            );

            connection.connect();
            client.watchBranchUpdates('abc').subscribe();

            watchBranchResult.next({
                type: 'repo/watch_branch_result',
                success: true,
                recordName: null,
                inst: 'abc',
                branch: DEFAULT_BRANCH_NAME,
            });

            client.addUpdates(null, 'abc', DEFAULT_BRANCH_NAME, ['111', '222']);

            connection.disconnect();
            await waitAsync();

            expect(connection.sentMessages).toEqual([
                {
                    type: 'repo/watch_branch',
                    recordName: null,
                    inst: 'abc',
                    branch: DEFAULT_BRANCH_NAME,
                },
                {
                    type: 'repo/add_updates',
                    recordName: null,
                    inst: 'abc',
                    branch: DEFAULT_BRANCH_NAME,
                    updates: ['111', '222'],
                    updateId: 1,
                },
            ]);

            connection.connect();
            await waitAsync();

            // should not send the updates until it gets a watch branch result
            expect(connection.sentMessages.slice(2)).toEqual([
                {
                    type: 'repo/unwatch_branch',
                    recordName: null,
                    inst: 'abc',
                    branch: DEFAULT_BRANCH_NAME,
                },
                {
                    type: 'repo/watch_branch',
                    recordName: null,
                    inst: 'abc',
                    branch: DEFAULT_BRANCH_NAME,
                },
            ]);

            watchBranchResult.next({
                type: 'repo/watch_branch_result',
                recordName: null,
                inst: 'abc',
                branch: DEFAULT_BRANCH_NAME,
                success: true,
            });

            await waitAsync();
            expect(connection.sentMessages.slice(4)).toEqual([
                {
                    type: 'repo/add_updates',
                    recordName: null,
                    inst: 'abc',
                    branch: DEFAULT_BRANCH_NAME,
                    updateId: 1,
                    updates: ['111', '222'],
                },
            ]);
        });

        it('should allow the first list of atoms even if it is empty', async () => {
            const addUpdates = new Subject<AddUpdatesMessage>();
            connection.events.set('repo/add_updates', addUpdates);

            let updates = [] as string[][];
            connection.connect();
            client
                .watchBranchUpdates('abc')
                .pipe(
                    filter(isClientUpdates),
                    map((e) => e.updates)
                )
                .subscribe((a) => updates.push(a));

            await waitAsync();

            addUpdates.next({
                type: 'repo/add_updates',
                recordName: null,
                inst: 'abc',
                branch: DEFAULT_BRANCH_NAME,
                updates: [],
                initial: true,
            });

            await waitAsync();

            expect(updates).toEqual([[]]);
        });

        it('should send a unwatch branch event when unsubscribed', async () => {
            const sub = client.watchBranchUpdates('abc').subscribe();

            connection.connect();
            await waitAsync();

            sub.unsubscribe();
            await waitAsync();

            expect(connection.sentMessages).toEqual([
                {
                    type: 'repo/watch_branch',
                    recordName: null,
                    inst: 'abc',
                    branch: DEFAULT_BRANCH_NAME,
                },
                {
                    type: 'repo/unwatch_branch',
                    recordName: null,
                    inst: 'abc',
                    branch: DEFAULT_BRANCH_NAME,
                },
            ]);
        });

        it('should not send a unwatch branch event when unsubscribing after being disconnected', async () => {
            const sub = client.watchBranchUpdates('abc').subscribe();

            connection.connect();
            await waitAsync();

            expect(connection.sentMessages).toEqual([
                {
                    type: 'repo/watch_branch',
                    recordName: null,
                    inst: 'abc',
                    branch: DEFAULT_BRANCH_NAME,
                },
            ]);

            connection.disconnect();
            await waitAsync();

            expect(connection.sentMessages.slice(1)).toEqual([]);

            sub.unsubscribe();
            await waitAsync();

            expect(connection.sentMessages.slice(1)).toEqual([]);
        });

        it('should allow connecting to temporary branches', async () => {
            const sub = client
                .watchBranchUpdates({
                    type: 'repo/watch_branch',
                    recordName: 'myRecord',
                    inst: 'abc',
                    branch: 'different',
                    temporary: true,
                })
                .subscribe();

            connection.connect();
            await waitAsync();

            sub.unsubscribe();
            await waitAsync();

            expect(connection.sentMessages).toEqual([
                {
                    type: 'repo/watch_branch',
                    recordName: 'myRecord',
                    inst: 'abc',
                    branch: 'different',
                    temporary: true,
                },
                {
                    type: 'repo/unwatch_branch',
                    recordName: 'myRecord',
                    inst: 'abc',
                    branch: 'different',
                },
            ]);
        });

        it('should resend all updates after connecting if the branch is temporary', async () => {
            const updatesReceived = new Subject<UpdatesReceivedMessage>();
            connection.events.set('repo/updates_received', updatesReceived);
            const watchBranchResult = new Subject<WatchBranchResultMessage>();
            connection.events.set(
                'repo/watch_branch_result',
                watchBranchResult
            );

            connection.connect();
            client
                .watchBranchUpdates({
                    type: 'repo/watch_branch',
                    recordName: 'myRecord',
                    inst: 'abc',
                    branch: 'different',
                    temporary: true,
                })
                .subscribe();

            watchBranchResult.next({
                type: 'repo/watch_branch_result',
                success: true,
                recordName: 'myRecord',
                inst: 'abc',
                branch: 'different',
            });

            client.addUpdates('myRecord', 'abc', 'different', ['111', '222']);
            client.addUpdates('myRecord', 'abc', 'different', ['333', '444']);

            updatesReceived.next({
                type: 'repo/updates_received',
                recordName: 'myRecord',
                inst: 'abc',
                branch: 'different',
                updateId: 1,
            });

            updatesReceived.next({
                type: 'repo/updates_received',
                recordName: 'myRecord',
                inst: 'abc',
                branch: 'different',
                updateId: 2,
            });

            connection.disconnect();
            await waitAsync();

            expect(connection.sentMessages).toEqual([
                {
                    type: 'repo/watch_branch',
                    recordName: 'myRecord',
                    inst: 'abc',
                    branch: 'different',
                    temporary: true,
                },
                {
                    type: 'repo/add_updates',
                    recordName: 'myRecord',
                    inst: 'abc',
                    branch: 'different',
                    updates: ['111', '222'],
                    updateId: 1,
                },
                {
                    type: 'repo/add_updates',
                    recordName: 'myRecord',
                    inst: 'abc',
                    branch: 'different',
                    updates: ['333', '444'],
                    updateId: 2,
                },
            ]);

            connection.connect();
            await waitAsync();

            // should not send the updates until it gets a watch branch result
            expect(connection.sentMessages.slice(3)).toEqual([
                {
                    type: 'repo/unwatch_branch',
                    recordName: 'myRecord',
                    inst: 'abc',
                    branch: 'different',
                },
                {
                    type: 'repo/watch_branch',
                    recordName: 'myRecord',
                    inst: 'abc',
                    branch: 'different',
                    temporary: true,
                },
            ]);

            watchBranchResult.next({
                type: 'repo/watch_branch_result',
                success: true,
                recordName: 'myRecord',
                inst: 'abc',
                branch: 'different',
            });

            await waitAsync();

            expect(connection.sentMessages.slice(5)).toEqual([
                {
                    type: 'repo/add_updates',
                    recordName: 'myRecord',
                    inst: 'abc',
                    branch: 'different',
                    updates: ['111', '222'],
                    updateId: 1,
                },
                {
                    type: 'repo/add_updates',
                    recordName: 'myRecord',
                    inst: 'abc',
                    branch: 'different',
                    updates: ['333', '444'],
                    updateId: 2,
                },
            ]);
        });

        it('should communicate when updates are rejected because of the max instance size', async () => {
            const updatesReceived = new Subject<UpdatesReceivedMessage>();
            connection.events.set('repo/updates_received', updatesReceived);
            connection.connect();
            let errors: ClientError[] = [];
            client
                .watchBranchUpdates('abc')
                .pipe(filter(isClientError))
                .subscribe((e) => errors.push(e));

            await waitAsync();

            client.addUpdates(null, 'abc', DEFAULT_BRANCH_NAME, ['111', '222']);

            await waitAsync();

            updatesReceived.next({
                type: 'repo/updates_received',
                recordName: null,
                inst: 'abc',
                branch: DEFAULT_BRANCH_NAME,
                updateId: 1,
                errorCode: 'max_size_reached',
                maxBranchSizeInBytes: 5,
                neededBranchSizeInBytes: 6,
            });

            await waitAsync();

            expect(errors).toEqual([
                {
                    type: 'error',
                    kind: 'max_size_reached',
                    maxBranchSizeInBytes: 5,
                    neededBranchSizeInBytes: 6,
                },
            ]);

            expect(connection.sentMessages).toEqual([
                {
                    type: 'repo/watch_branch',
                    recordName: null,
                    inst: 'abc',
                    branch: DEFAULT_BRANCH_NAME,
                },
                {
                    type: 'repo/add_updates',
                    recordName: null,
                    inst: 'abc',
                    branch: DEFAULT_BRANCH_NAME,
                    updateId: 1,
                    updates: ['111', '222'],
                },
            ]);
        });

        it('should relay watch_branch_result events that are for the branch', async () => {
            const onResult = new Subject<WatchBranchResultMessage>();
            connection.events.set('repo/watch_branch_result', onResult);

            let results = [] as WatchBranchResultMessage[];
            connection.connect();
            client
                .watchBranchUpdates('abc')
                .pipe(filter(isWatchBranchResult))
                .subscribe((a) => results.push(a));

            await waitAsync();

            onResult.next({
                type: 'repo/watch_branch_result',
                success: true,
                recordName: null,
                inst: 'abc',
                branch: DEFAULT_BRANCH_NAME,
            });

            onResult.next({
                type: 'repo/watch_branch_result',
                success: true,
                recordName: null,
                inst: 'other',
                branch: DEFAULT_BRANCH_NAME,
            });

            await waitAsync();

            expect(results).toEqual([
                {
                    type: 'repo/watch_branch_result',
                    success: true,
                    recordName: null,
                    inst: 'abc',
                    branch: DEFAULT_BRANCH_NAME,
                },
            ]);
        });

        it('should relay errors that are for the branch', async () => {
            const addUpdates = new Subject<AddUpdatesMessage>();
            connection.events.set('repo/add_updates', addUpdates);

            let errors = [] as ClientError[];
            connection.connect();
            client
                .watchBranchUpdates('abc')
                .pipe(filter(isClientError))
                .subscribe((a) => errors.push(a));

            await waitAsync();

            addUpdates.next({
                type: 'repo/add_updates',
                recordName: null,
                inst: 'abc',
                branch: DEFAULT_BRANCH_NAME,
                updates: ['111', '222'],
                initial: true,
            });

            addUpdates.next({
                type: 'repo/add_updates',
                recordName: null,
                inst: 'other',
                branch: DEFAULT_BRANCH_NAME,
                updates: ['333', '444'],
            });

            await waitAsync();

            expect(errors).toEqual([]);

            connection.onError.next({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'Not authorized',
                recordName: null,
                inst: 'abc',
                branch: DEFAULT_BRANCH_NAME,
            });

            await waitAsync();

            expect(errors).toEqual([
                {
                    type: 'error',
                    kind: 'error',
                    info: {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage: 'Not authorized',
                        recordName: null,
                        inst: 'abc',
                        branch: DEFAULT_BRANCH_NAME,
                    },
                },
            ]);
        });
    });

    describe('watchRateLimitExceeded()', () => {
        let rateLimitExceeded: Subject<RateLimitExceededMessage>;
        beforeEach(() => {
            rateLimitExceeded = new Subject();
            connection.events.set('rate_limit_exceeded', rateLimitExceeded);
        });

        it('should relay rate_limit_exceeded messages', async () => {
            let events = [] as RateLimitExceededMessage[];
            client.watchRateLimitExceeded().subscribe((e) => events.push(e));

            expect(connection.sentMessages).toEqual([]);

            connection.connect();
            await waitAsync();

            expect(connection.sentMessages).toEqual([]);

            rateLimitExceeded.next({
                type: 'rate_limit_exceeded',
                retryAfter: 123,
                totalHits: 999,
            });

            await waitAsync();

            expect(events).toEqual([
                {
                    type: 'rate_limit_exceeded',
                    retryAfter: 123,
                    totalHits: 999,
                },
            ]);
        });
    });

    describe('getBranchUpdates()', () => {
        it('should send a get updates event after connecting', async () => {
            client
                .getBranchUpdates('recordName', 'abc', 'different')
                .subscribe();

            expect(connection.sentMessages).toEqual([]);

            connection.connect();
            await waitAsync();

            expect(connection.sentMessages).toEqual([
                {
                    type: 'repo/get_updates',
                    recordName: 'recordName',
                    inst: 'abc',
                    branch: 'different',
                },
            ]);
        });

        it('should return an observable of updates for the branch', async () => {
            const addUpdates = new Subject<AddUpdatesMessage>();
            connection.events.set('repo/add_updates', addUpdates);

            let updates = [] as string[];
            let timestamps = [] as number[];
            connection.connect();
            client
                .getBranchUpdates('myRecord', 'abc', 'branch')
                .subscribe(({ updates: u, timestamps: t }) => {
                    updates.push(...u);
                    if (t) {
                        timestamps?.push(...t);
                    }
                });

            await waitAsync();

            addUpdates.next({
                type: 'repo/add_updates',
                recordName: 'myRecord',
                inst: 'abc',
                branch: 'branch',
                updates: ['111', '222'],
                timestamps: [123, 456],
            });

            addUpdates.next({
                type: 'repo/add_updates',
                recordName: 'myRecord',
                inst: 'abc',
                branch: 'wrong',
                updates: ['333', '444'],
            });

            await waitAsync();

            expect(updates).toEqual(['111', '222']);
            expect(timestamps).toEqual([123, 456]);
        });

        it('should finish after the first add updates event for the branch', async () => {
            const addUpdates = new Subject<AddUpdatesMessage>();
            connection.events.set('repo/add_updates', addUpdates);

            let updates = [] as string[];
            let finished = false;
            connection.connect();
            client.getBranchUpdates('myRecord', 'abc', 'branch').subscribe({
                next: ({ updates: u }) => updates.push(...u),
                error: (err) => {},
                complete: () => (finished = true),
            });

            await waitAsync();

            addUpdates.next({
                type: 'repo/add_updates',
                recordName: 'myRecord',
                inst: 'abc',
                branch: 'other',
                updates: ['111', '222'],
            });

            await waitAsync();

            expect(finished).toBe(false);

            addUpdates.next({
                type: 'repo/add_updates',
                recordName: 'myRecord',
                inst: 'abc',
                branch: 'branch',
                updates: ['333', '444'],
            });

            await waitAsync();

            expect(finished).toBe(true);

            addUpdates.next({
                type: 'repo/add_updates',
                recordName: 'myRecord',
                inst: 'abc',
                branch: 'branch',
                updates: ['555'],
            });

            await waitAsync();

            expect(updates).toEqual(['333', '444']);
        });
    });

    describe('sendAction()', () => {
        it('should send the given remote event on the given branch', () => {
            client.sendAction(
                'myRecord',
                'abc',
                'branch',
                remote(
                    {
                        type: 'def',
                    },
                    {
                        sessionId: 'session',
                    }
                )
            );

            expect(connection.sentMessages).toEqual([
                {
                    type: 'repo/send_action',
                    recordName: 'myRecord',
                    inst: 'abc',
                    branch: 'branch',
                    action: remote(
                        {
                            type: 'def',
                        },
                        {
                            sessionId: 'session',
                        }
                    ),
                },
            ]);
        });
    });

    describe('forcedOffline', () => {
        it('should disconnect when set set to true', async () => {
            let states = [] as boolean[];
            connection.connectionState.subscribe((state) =>
                states.push(state.connected)
            );

            connection.connect();
            client.forcedOffline = true;

            await waitAsync();

            expect(states).toEqual([false, true, false]);
        });

        it('should reconnect when set set back to false', async () => {
            let states = [] as boolean[];
            connection.connectionState.subscribe((state) =>
                states.push(state.connected)
            );

            connection.connect();
            client.forcedOffline = true;
            client.forcedOffline = false;

            await waitAsync();

            expect(states).toEqual([false, true, false, true]);
        });
    });

    describe('watchBranchDevices()', () => {
        it('should send a watch devices event after connecting', async () => {
            client.watchBranchDevices(null, 'inst', 'testBranch').subscribe();

            expect(connection.sentMessages).toEqual([]);

            connection.connect();
            await waitAsync();

            expect(connection.sentMessages).toEqual([
                {
                    type: 'repo/watch_branch_devices',
                    recordName: null,
                    inst: 'inst',
                    branch: 'testBranch',
                },
            ]);
        });

        it('should return an observable of connected/disconnected events', async () => {
            let connections: ConnectedToBranchMessage[] = [];
            let disconnections: DisconnectedFromBranchMessage[] = [];
            client
                .watchBranchDevices('myRecord', 'inst', 'testBranch')
                .subscribe((e) => {
                    if (e.type === 'repo/connected_to_branch') {
                        connections.push(e);
                    } else {
                        disconnections.push(e);
                    }
                });

            let connect = new Subject<ConnectedToBranchMessage>();
            let disconnect = new Subject<DisconnectedFromBranchMessage>();
            connection.events.set('repo/connected_to_branch', connect);
            connection.events.set('repo/disconnected_from_branch', disconnect);

            const device1 = connectionInfo('device1', 'device1', 'device1');
            const device2 = connectionInfo('device2', 'device2', 'device2');

            connection.connect();
            await waitAsync();

            connect.next({
                type: 'repo/connected_to_branch',
                broadcast: false,
                branch: {
                    type: 'repo/watch_branch',
                    recordName: 'myRecord',
                    inst: 'inst',
                    branch: 'testBranch',
                },
                connection: device1,
            });

            disconnect.next({
                type: 'repo/disconnected_from_branch',
                broadcast: false,
                recordName: 'myRecord',
                inst: 'inst',
                branch: 'testBranch',
                connection: device1,
            });
            await waitAsync();

            expect(connections).toEqual([
                {
                    type: 'repo/connected_to_branch',
                    broadcast: false,
                    branch: {
                        type: 'repo/watch_branch',
                        recordName: 'myRecord',
                        inst: 'inst',
                        branch: 'testBranch',
                    },
                    connection: device1,
                },
            ]);
            expect(disconnections).toEqual([
                {
                    type: 'repo/disconnected_from_branch',
                    broadcast: false,
                    recordName: 'myRecord',
                    inst: 'inst',
                    branch: 'testBranch',
                    connection: device1,
                },
            ]);
        });

        it('should send a unwatch devices event when unsubscribed', async () => {
            const sub = client
                .watchBranchDevices('recordName', 'inst', 'testBranch')
                .subscribe();

            connection.connect();
            await waitAsync();

            sub.unsubscribe();
            await waitAsync();

            expect(connection.sentMessages).toEqual([
                {
                    type: 'repo/watch_branch_devices',
                    recordName: 'recordName',
                    inst: 'inst',
                    branch: 'testBranch',
                },
                {
                    type: 'repo/unwatch_branch_devices',
                    recordName: 'recordName',
                    inst: 'inst',
                    branch: 'testBranch',
                },
            ]);
        });

        it('should not send a unwatch devices event when disconnected', async () => {
            const sub = client
                .watchBranchDevices('myRecord', 'inst', 'testBranch')
                .subscribe();

            connection.connect();
            await waitAsync();

            expect(connection.sentMessages).toEqual([
                {
                    type: 'repo/watch_branch_devices',
                    recordName: 'myRecord',
                    inst: 'inst',
                    branch: 'testBranch',
                },
            ]);

            connection.disconnect();

            await waitAsync();
            expect(connection.sentMessages.slice(1)).toEqual([]);

            sub.unsubscribe();
            await waitAsync();

            expect(connection.sentMessages.slice(1)).toEqual([]);
        });

        it('should unwatch and rewatch when a second connection event is sent', async () => {
            const sub = client
                .watchBranchDevices('myRecord', 'inst', 'testBranch')
                .subscribe();

            connection.connect();
            await waitAsync();

            expect(connection.sentMessages).toEqual([
                {
                    type: 'repo/watch_branch_devices',
                    recordName: 'myRecord',
                    inst: 'inst',
                    branch: 'testBranch',
                },
            ]);

            connection.connect();

            await waitAsync();

            expect(connection.sentMessages.slice(1)).toEqual([
                {
                    type: 'repo/unwatch_branch_devices',
                    recordName: 'myRecord',
                    inst: 'inst',
                    branch: 'testBranch',
                },
                {
                    type: 'repo/watch_branch_devices',
                    recordName: 'myRecord',
                    inst: 'inst',
                    branch: 'testBranch',
                },
            ]);
        });

        it('should send device disconnected events for all connected devices when the connection is lost', async () => {
            let connections: ConnectedToBranchMessage[] = [];
            let disconnections: DisconnectedFromBranchMessage[] = [];
            client
                .watchBranchDevices('myRecord', 'inst', 'testBranch')
                .subscribe((e) => {
                    if (e.type === 'repo/connected_to_branch') {
                        connections.push(e);
                    } else {
                        disconnections.push(e);
                    }
                });

            let connect = new Subject<ConnectedToBranchMessage>();
            let disconnect = new Subject<DisconnectedFromBranchMessage>();
            connection.events.set('repo/connected_to_branch', connect);
            connection.events.set('repo/disconnected_from_branch', disconnect);

            const device1 = connectionInfo('device1', 'device1', 'device1');
            const device2 = connectionInfo('device2', 'device2', 'device2');

            connection.connect();
            await waitAsync();

            connect.next({
                type: 'repo/connected_to_branch',
                broadcast: false,
                branch: {
                    type: 'repo/watch_branch',
                    recordName: 'myRecord',
                    inst: 'inst',
                    branch: 'testBranch',
                },
                connection: device1,
            });

            connect.next({
                type: 'repo/connected_to_branch',
                broadcast: false,
                branch: {
                    type: 'repo/watch_branch',
                    recordName: 'myRecord',
                    inst: 'inst',
                    branch: 'testBranch',
                },
                connection: device2,
            });

            await waitAsync();

            connection.disconnect();

            await waitAsync();

            expect(connections).toEqual([
                {
                    type: 'repo/connected_to_branch',
                    broadcast: false,
                    branch: {
                        type: 'repo/watch_branch',
                        recordName: 'myRecord',
                        inst: 'inst',
                        branch: 'testBranch',
                    },
                    connection: device1,
                },
                {
                    type: 'repo/connected_to_branch',
                    broadcast: false,
                    branch: {
                        type: 'repo/watch_branch',
                        recordName: 'myRecord',
                        inst: 'inst',
                        branch: 'testBranch',
                    },
                    connection: device2,
                },
            ]);
            expect(disconnections).toEqual([
                {
                    type: 'repo/disconnected_from_branch',
                    broadcast: false,
                    recordName: 'myRecord',
                    inst: 'inst',
                    branch: 'testBranch',
                    connection: device1,
                },
                {
                    type: 'repo/disconnected_from_branch',
                    broadcast: false,
                    recordName: 'myRecord',
                    inst: 'inst',
                    branch: 'testBranch',
                    connection: device2,
                },
            ]);
        });

        it('should ignore broadcast events', async () => {
            let connections: ConnectedToBranchMessage[] = [];
            let disconnections: DisconnectedFromBranchMessage[] = [];
            client
                .watchBranchDevices('recordName', 'inst', 'testBranch')
                .subscribe((e) => {
                    if (e.type === 'repo/connected_to_branch') {
                        connections.push(e);
                    } else {
                        disconnections.push(e);
                    }
                });

            let connect = new Subject<ConnectedToBranchMessage>();
            let disconnect = new Subject<DisconnectedFromBranchMessage>();
            connection.events.set('repo/connected_to_branch', connect);
            connection.events.set('repo/disconnected_from_branch', disconnect);

            const device1 = connectionInfo('device1', 'device1', 'device1');
            const device2 = connectionInfo('device2', 'device2', 'device2');

            connection.connect();
            await waitAsync();

            connect.next({
                type: 'repo/connected_to_branch',
                broadcast: true,
                branch: {
                    type: 'repo/watch_branch',
                    recordName: 'myRecord',
                    inst: 'inst',
                    branch: 'testBranch',
                },
                connection: device1,
            });

            disconnect.next({
                type: 'repo/disconnected_from_branch',
                broadcast: true,
                recordName: 'myRecord',
                inst: 'inst',
                branch: 'testBranch',
                connection: device2,
            });
            await waitAsync();

            expect(connections).toEqual([]);
            expect(disconnections).toEqual([]);
        });

        it('should ignore events for other branches', async () => {
            let connections: ConnectedToBranchMessage[] = [];
            let disconnections: DisconnectedFromBranchMessage[] = [];
            client
                .watchBranchDevices('myRecord', 'inst', 'testBranch')
                .subscribe((e) => {
                    if (e.type === 'repo/connected_to_branch') {
                        connections.push(e);
                    } else {
                        disconnections.push(e);
                    }
                });

            let connect = new Subject<ConnectedToBranchMessage>();
            let disconnect = new Subject<DisconnectedFromBranchMessage>();
            connection.events.set('repo/connected_to_branch', connect);
            connection.events.set('repo/disconnected_from_branch', disconnect);

            const device1 = connectionInfo('device1', 'device1', 'device1');
            const device2 = connectionInfo('device2', 'device2', 'device2');

            connection.connect();
            await waitAsync();

            connect.next({
                type: 'repo/connected_to_branch',
                broadcast: false,
                branch: {
                    type: 'repo/watch_branch',
                    recordName: 'myRecord',
                    inst: 'inst',
                    branch: 'otherBranch',
                },
                connection: device1,
            });

            disconnect.next({
                type: 'repo/disconnected_from_branch',
                broadcast: false,
                recordName: 'myRecord',
                inst: 'inst',
                branch: 'otherBranch',
                connection: device2,
            });
            await waitAsync();

            expect(connections).toEqual([]);
            expect(disconnections).toEqual([]);
        });

        it('should ignore duplicate connection events for a device', async () => {
            let connections: ConnectedToBranchMessage[] = [];
            let disconnections: DisconnectedFromBranchMessage[] = [];
            client
                .watchBranchDevices('myRecord', 'inst', 'testBranch')
                .subscribe((e) => {
                    if (e.type === 'repo/connected_to_branch') {
                        connections.push(e);
                    } else {
                        disconnections.push(e);
                    }
                });

            let connect = new Subject<ConnectedToBranchMessage>();
            let disconnect = new Subject<DisconnectedFromBranchMessage>();
            connection.events.set('repo/connected_to_branch', connect);
            connection.events.set('repo/disconnected_from_branch', disconnect);

            const device1 = connectionInfo('device1', 'device1', 'device1');
            const device2 = connectionInfo('device2', 'device2', 'device2');

            connection.connect();
            await waitAsync();

            connect.next({
                type: 'repo/connected_to_branch',
                broadcast: false,
                branch: {
                    type: 'repo/watch_branch',
                    recordName: 'myRecord',
                    inst: 'inst',
                    branch: 'testBranch',
                },
                connection: device1,
            });
            connect.next({
                type: 'repo/connected_to_branch',
                broadcast: false,
                branch: {
                    type: 'repo/watch_branch',
                    recordName: 'myRecord',
                    inst: 'inst',
                    branch: 'testBranch',
                },
                connection: device1,
            });
            connect.next({
                type: 'repo/connected_to_branch',
                broadcast: false,
                branch: {
                    type: 'repo/watch_branch',
                    recordName: 'myRecord',
                    inst: 'inst',
                    branch: 'testBranch',
                },
                connection: device1,
            });

            disconnect.next({
                type: 'repo/disconnected_from_branch',
                broadcast: false,
                recordName: 'myRecord',
                inst: 'inst',
                branch: 'testBranch',
                connection: device1,
            });
            await waitAsync();

            expect(connections).toEqual([
                {
                    type: 'repo/connected_to_branch',
                    broadcast: false,
                    branch: {
                        type: 'repo/watch_branch',
                        recordName: 'myRecord',
                        inst: 'inst',
                        branch: 'testBranch',
                    },
                    connection: device1,
                },
            ]);
            expect(disconnections).toEqual([
                {
                    type: 'repo/disconnected_from_branch',
                    broadcast: false,
                    recordName: 'myRecord',
                    inst: 'inst',
                    branch: 'testBranch',
                    connection: device1,
                },
            ]);
        });

        it('should ignore duplicate disconnection events for a device', async () => {
            let connections: ConnectedToBranchMessage[] = [];
            let disconnections: DisconnectedFromBranchMessage[] = [];
            client
                .watchBranchDevices('myRecord', 'inst', 'testBranch')
                .subscribe((e) => {
                    if (e.type === 'repo/connected_to_branch') {
                        connections.push(e);
                    } else {
                        disconnections.push(e);
                    }
                });

            let connect = new Subject<ConnectedToBranchMessage>();
            let disconnect = new Subject<DisconnectedFromBranchMessage>();
            connection.events.set('repo/connected_to_branch', connect);
            connection.events.set('repo/disconnected_from_branch', disconnect);

            const device1 = connectionInfo('device1', 'device1', 'device1');
            const device2 = connectionInfo('device2', 'device2', 'device2');

            connection.connect();
            await waitAsync();

            connect.next({
                type: 'repo/connected_to_branch',
                broadcast: false,
                branch: {
                    type: 'repo/watch_branch',
                    recordName: 'myRecord',
                    inst: 'inst',
                    branch: 'testBranch',
                },
                connection: device1,
            });

            disconnect.next({
                type: 'repo/disconnected_from_branch',
                broadcast: false,
                recordName: 'myRecord',
                inst: 'inst',
                branch: 'testBranch',
                connection: device1,
            });
            disconnect.next({
                type: 'repo/disconnected_from_branch',
                broadcast: false,
                recordName: 'myRecord',
                inst: 'inst',
                branch: 'testBranch',
                connection: device1,
            });
            disconnect.next({
                type: 'repo/disconnected_from_branch',
                broadcast: false,
                recordName: 'myRecord',
                inst: 'inst',
                branch: 'testBranch',
                connection: device1,
            });
            disconnect.next({
                type: 'repo/disconnected_from_branch',
                broadcast: false,
                recordName: 'myRecord',
                inst: 'inst',
                branch: 'testBranch',
                connection: device1,
            });
            await waitAsync();

            expect(connections).toEqual([
                {
                    type: 'repo/connected_to_branch',
                    broadcast: false,
                    branch: {
                        type: 'repo/watch_branch',
                        recordName: 'myRecord',
                        inst: 'inst',
                        branch: 'testBranch',
                    },
                    connection: device1,
                },
            ]);
            expect(disconnections).toEqual([
                {
                    type: 'repo/disconnected_from_branch',
                    broadcast: false,
                    recordName: 'myRecord',
                    inst: 'inst',
                    branch: 'testBranch',
                    connection: device1,
                },
            ]);
        });

        it('should ignore disconnection events for devices that were never connected', async () => {
            let connections: ConnectedToBranchMessage[] = [];
            let disconnections: DisconnectedFromBranchMessage[] = [];
            client
                .watchBranchDevices('myRecord', 'inst', 'testBranch')
                .subscribe((e) => {
                    if (e.type === 'repo/connected_to_branch') {
                        connections.push(e);
                    } else {
                        disconnections.push(e);
                    }
                });

            let connect = new Subject<ConnectedToBranchMessage>();
            let disconnect = new Subject<DisconnectedFromBranchMessage>();
            connection.events.set('repo/connected_to_branch', connect);
            connection.events.set('repo/disconnected_from_branch', disconnect);

            const device1 = connectionInfo('device1', 'device1', 'device1');
            const device2 = connectionInfo('device2', 'device2', 'device2');

            connection.connect();
            await waitAsync();
            disconnect.next({
                type: 'repo/disconnected_from_branch',
                broadcast: false,
                recordName: 'myRecord',
                inst: 'inst',
                branch: 'testBranch',
                connection: device1,
            });
            disconnect.next({
                type: 'repo/disconnected_from_branch',
                broadcast: false,
                recordName: 'myRecord',
                inst: 'inst',
                branch: 'testBranch',
                connection: device2,
            });
            await waitAsync();

            expect(connections).toEqual([]);
            expect(disconnections).toEqual([]);
        });

        it('should handle when two devices are connected and disconnected at the same time', async () => {
            let events: (
                | ConnectedToBranchMessage
                | DisconnectedFromBranchMessage
            )[] = [];
            client
                .watchBranchDevices('myRecord', 'inst', 'testBranch')
                .subscribe((e) => {
                    events.push(e);
                });

            let connect = new Subject<ConnectedToBranchMessage>();
            let disconnect = new Subject<DisconnectedFromBranchMessage>();
            connection.events.set('repo/connected_to_branch', connect);
            connection.events.set('repo/disconnected_from_branch', disconnect);

            const device1 = connectionInfo('device1', 'device1', 'device1');
            const device2 = connectionInfo('device2', 'device2', 'device2');

            connection.connect();
            await waitAsync();

            connect.next({
                type: 'repo/connected_to_branch',
                broadcast: false,
                branch: {
                    type: 'repo/watch_branch',
                    recordName: 'myRecord',
                    inst: 'inst',
                    branch: 'testBranch',
                },
                connection: device1,
            });
            connect.next({
                type: 'repo/connected_to_branch',
                broadcast: false,
                branch: {
                    type: 'repo/watch_branch',
                    recordName: 'myRecord',
                    inst: 'inst',
                    branch: 'testBranch',
                },
                connection: device2,
            });

            disconnect.next({
                type: 'repo/disconnected_from_branch',
                broadcast: false,
                recordName: 'myRecord',
                inst: 'inst',
                branch: 'testBranch',
                connection: device2,
            });
            disconnect.next({
                type: 'repo/disconnected_from_branch',
                broadcast: false,
                recordName: 'myRecord',
                inst: 'inst',
                branch: 'testBranch',
                connection: device1,
            });
            await waitAsync();

            expect(events).toEqual([
                {
                    type: 'repo/connected_to_branch',
                    broadcast: false,
                    branch: {
                        type: 'repo/watch_branch',
                        recordName: 'myRecord',
                        inst: 'inst',
                        branch: 'testBranch',
                    },
                    connection: device1,
                },
                {
                    type: 'repo/connected_to_branch',
                    broadcast: false,
                    branch: {
                        type: 'repo/watch_branch',
                        recordName: 'myRecord',
                        inst: 'inst',
                        branch: 'testBranch',
                    },
                    connection: device2,
                },
                {
                    type: 'repo/disconnected_from_branch',
                    broadcast: false,
                    recordName: 'myRecord',
                    inst: 'inst',
                    branch: 'testBranch',
                    connection: device2,
                },
                {
                    type: 'repo/disconnected_from_branch',
                    broadcast: false,
                    recordName: 'myRecord',
                    inst: 'inst',
                    branch: 'testBranch',
                    connection: device1,
                },
            ]);
        });
    });

    describe('sampleServerTime()', () => {
        let _old: typeof Date.now;
        let now: jest.Mock<number>;
        beforeEach(() => {
            _old = Date.now;
            Date.now = now = jest.fn();
        });

        afterEach(() => {
            Date.now = _old;
        });

        it('should send a sync/time event after connecting', async () => {
            client.sampleServerTime();

            expect(connection.sentMessages).toEqual([]);

            now.mockReturnValueOnce(123);
            connection.connect();
            await waitAsync();

            expect(connection.sentMessages).toEqual([
                {
                    type: 'sync/time',
                    id: 1,
                    clientRequestTime: 123,
                },
            ]);
        });

        it('should resolve with results from sync_time events', async () => {
            const syncTime = new Subject<TimeSyncResponseMessage>();
            connection.events.set('sync/time/response', syncTime);

            let responses = [] as TimeSample[];
            client.sampleServerTime().then((r) => responses.push(r));

            expect(connection.sentMessages).toEqual([]);

            now.mockReturnValueOnce(123);
            connection.connect();
            await waitAsync();

            expect(connection.sentMessages).toEqual([
                {
                    type: 'sync/time',
                    id: 1,
                    clientRequestTime: 123,
                },
            ]);

            now.mockReturnValueOnce(1000);
            syncTime.next({
                type: 'sync/time/response',
                id: 1,
                clientRequestTime: 123,
                serverReceiveTime: 456,
                serverTransmitTime: 789,
            });

            syncTime.next({
                type: 'sync/time/response',
                id: 1,
                clientRequestTime: 999,
                serverReceiveTime: 999,
                serverTransmitTime: 999,
            });

            await waitAsync();

            expect(responses).toEqual([
                {
                    clientRequestTime: 123,
                    serverReceiveTime: 456,
                    serverTransmitTime: 789,
                    currentTime: 1000,
                },
            ]);
        });
    });

    describe('connectionCount()', () => {
        it('should send a connection count event after connecting', async () => {
            client.connectionCount().subscribe();

            expect(connection.sentMessages).toEqual([]);

            connection.connect();
            await waitAsync();

            expect(connection.sentMessages).toEqual([
                {
                    type: 'repo/connection_count',
                    recordName: null,
                    inst: null,
                    branch: null,
                },
            ]);
        });

        it('should return an observable of device info', async () => {
            const connections = new Subject<ConnectionCountMessage>();
            connection.events.set('repo/connection_count', connections);

            let counts = [] as number[];
            client.connectionCount().subscribe((e) => counts.push(e));

            connection.connect();
            await waitAsync();

            connections.next({
                type: 'repo/connection_count',
                count: 2,
                recordName: null,
                inst: null,
                branch: null,
            });
            await waitAsync();

            connections.next({
                type: 'repo/connection_count',
                count: 1,
                recordName: null,
                inst: null,
                branch: null,
            });
            await waitAsync();

            expect(counts).toEqual([2]);
        });

        it('should send the given record, inst, and branch names', async () => {
            const devices = new Subject<ConnectionCountMessage>();
            connection.events.set('repo/connection_count', devices);

            client.connectionCount('haha', 'abc', 'def').subscribe();

            connection.connect();
            await waitAsync();

            expect(connection.sentMessages).toEqual([
                {
                    type: 'repo/connection_count',
                    recordName: 'haha',
                    inst: 'abc',
                    branch: 'def',
                },
            ]);
        });
    });

    describe('reliability', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('should resend updates that were not acknowledged after a set amount of time', async () => {
            // Set the resend time to 5 seconds.
            client.resendUpdatesAfterMs = 5000;
            client.resendUpdatesIntervalMs = 5000;

            const updatesReceived = new Subject<UpdatesReceivedMessage>();
            connection.events.set('repo/updates_received', updatesReceived);
            connection.connect();
            client.watchBranchUpdates('abc').subscribe();

            client.addUpdates(null, 'abc', DEFAULT_BRANCH_NAME, ['111', '222']);

            // connection.disconnect();
            // await waitAsync();
            jest.advanceTimersByTime(1000);

            expect(connection.sentMessages).toEqual([
                {
                    type: 'repo/watch_branch',
                    recordName: null,
                    inst: 'abc',
                    branch: DEFAULT_BRANCH_NAME,
                },
                {
                    type: 'repo/add_updates',
                    recordName: null,
                    inst: 'abc',
                    branch: DEFAULT_BRANCH_NAME,
                    updates: ['111', '222'],
                    updateId: 1,
                },
            ]);

            jest.advanceTimersByTime(3000);
            expect(connection.sentMessages.length).toEqual(2);

            // Shoult emit the updates again
            jest.advanceTimersByTime(1000);
            expect(connection.sentMessages.slice(2)).toEqual([
                {
                    type: 'repo/add_updates',
                    recordName: null,
                    inst: 'abc',
                    branch: DEFAULT_BRANCH_NAME,
                    updateId: 1,
                    updates: ['111', '222'],
                },
            ]);

            updatesReceived.next({
                type: 'repo/updates_received',
                recordName: null,
                inst: 'abc',
                branch: DEFAULT_BRANCH_NAME,
                updateId: 1,
            });

            jest.advanceTimersByTime(10000);
            expect(connection.sentMessages.slice(3)).toEqual([]);
        });

        it('should double the resend time up to a limit of 3 times the regular resend time', async () => {
            // Set the resend time to 5 seconds.
            client.resendUpdatesAfterMs = 5000;
            client.resendUpdatesIntervalMs = 5000;

            const updatesReceived = new Subject<UpdatesReceivedMessage>();
            connection.events.set('repo/updates_received', updatesReceived);
            connection.connect();
            client.watchBranchUpdates('abc').subscribe();

            client.addUpdates(null, 'abc', DEFAULT_BRANCH_NAME, ['111', '222']);

            // connection.disconnect();
            // await waitAsync();
            jest.advanceTimersByTime(1000);

            expect(connection.sentMessages).toEqual([
                {
                    type: 'repo/watch_branch',
                    recordName: null,
                    inst: 'abc',
                    branch: DEFAULT_BRANCH_NAME,
                },
                {
                    type: 'repo/add_updates',
                    recordName: null,
                    inst: 'abc',
                    branch: DEFAULT_BRANCH_NAME,
                    updates: ['111', '222'],
                    updateId: 1,
                },
            ]);

            jest.advanceTimersByTime(4000);

            // Shoult emit the updates again
            expect(connection.sentMessages.length).toEqual(3);

            jest.advanceTimersByTime(10000);

            expect(connection.sentMessages.length).toEqual(4);

            jest.advanceTimersByTime(20000);

            expect(connection.sentMessages.length).toEqual(5);

            jest.advanceTimersByTime(40000);

            expect(connection.sentMessages.length).toEqual(6);

            jest.advanceTimersByTime(80000);

            expect(connection.sentMessages.length).toEqual(8);

            updatesReceived.next({
                type: 'repo/updates_received',
                recordName: null,
                inst: 'abc',
                branch: DEFAULT_BRANCH_NAME,
                updateId: 1,
            });

            jest.advanceTimersByTime(100000);
            expect(connection.sentMessages.slice(8)).toEqual([]);
        });
    });

    describe('onSyncUpdatesEvent', () => {
        it('should send a syncing events that match whether the client has any unacknowledged updates left for the branch', async () => {
            const updatesReceived = new Subject<UpdatesReceivedMessage>();
            connection.events.set('repo/updates_received', updatesReceived);
            connection.connect();

            let syncEvents: SyncUpdatesEvent[] = [];
            client.onSyncUpdatesEvent.subscribe((event) =>
                syncEvents.push(event)
            );

            client
                .watchBranchUpdates({
                    type: 'repo/watch_branch',
                    recordName: 'record',
                    inst: 'abc',
                    branch: DEFAULT_BRANCH_NAME,
                })
                .subscribe();

            client.addUpdates('record', 'abc', DEFAULT_BRANCH_NAME, [
                '111',
                '222',
            ]);

            await waitAsync();

            expect(syncEvents).toEqual([
                {
                    type: 'syncing',
                    recordName: 'record',
                    inst: 'abc',
                    branch: DEFAULT_BRANCH_NAME,
                },
            ]);

            updatesReceived.next({
                type: 'repo/updates_received',
                recordName: 'record',
                inst: 'abc',
                branch: DEFAULT_BRANCH_NAME,
                updateId: 1,
            });

            await waitAsync();

            expect(syncEvents.slice(1)).toEqual([
                {
                    type: 'synced',
                    recordName: 'record',
                    inst: 'abc',
                    branch: DEFAULT_BRANCH_NAME,
                },
            ]);
        });
    });
});
