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
import { OtherPlayersPartitionImpl } from './OtherPlayersPartition';
import { Subject, Subscription, firstValueFrom } from 'rxjs';
import type { Bot, UpdatedBot, StateUpdatedEvent } from '../bots';
import {
    createBot,
    botAdded,
    getRemotes,
    asyncResult,
    action,
    ON_REMOTE_PLAYER_SUBSCRIBED_ACTION_NAME,
    ON_REMOTE_PLAYER_UNSUBSCRIBED_ACTION_NAME,
    ON_REMOTE_JOINED_ACTION_NAME,
    ON_REMOTE_LEAVE_ACTION_NAME,
    botRemoved,
    botUpdated,
} from '../bots';
import type { OtherPlayersRepoPartitionConfig } from './AuxPartitionConfig';
import { waitAsync } from '../test/TestHelpers';
import { takeWhile, bufferCount, skip } from 'rxjs/operators';
import { YjsPartitionImpl } from './YjsPartition';
import { encodeStateAsUpdate } from 'yjs';
import { fromByteArray } from 'base64-js';
import { cloneDeep } from 'es-toolkit/compat';
import type { Action } from '../common';
import { connectionInfo, remote } from '../common';
import type {
    AddUpdatesMessage,
    ConnectedToBranchMessage,
    DisconnectedFromBranchMessage,
    ReceiveDeviceActionMessage,
} from '../websockets';
import { InstRecordsClient, MemoryConnectionClient } from '../websockets';
import { PartitionAuthSource } from './PartitionAuthSource';

console.log = jest.fn();

describe('OtherPlayersPartition', () => {
    let connection: MemoryConnectionClient;
    let client: InstRecordsClient;
    let partition: OtherPlayersPartitionImpl;
    let receiveEvent: Subject<ReceiveDeviceActionMessage>;
    let deviceConnected: Subject<ConnectedToBranchMessage>;
    let deviceDisconnected: Subject<DisconnectedFromBranchMessage>;
    let added: Bot[];
    let removed: string[];
    let updated: UpdatedBot[];
    let updates: StateUpdatedEvent[];
    let sub: Subscription;
    let authSource: PartitionAuthSource;

    let testDevice = connectionInfo('test', 'test', 'test');
    let device1 = connectionInfo('device1', 'device1Id', 'device1SessionId');
    let device2 = connectionInfo('device2', 'device2Id', 'device2SessionId');
    let device3 = connectionInfo('device3', 'device3Id', 'device3SessionId');

    const recordNameCases = [
        ['no record name', null as any] as const,
        ['record name', 'testRecordName'] as const,
    ];

    describe.each(recordNameCases)('%s', (_name, record) => {
        const recordName = record;

        describe('connection', () => {
            describe('yjs_client', () => {
                let addUpdates: Subject<AddUpdatesMessage>;
                let tempPartition: YjsPartitionImpl;

                beforeEach(async () => {
                    connection = new MemoryConnectionClient(testDevice);
                    receiveEvent = new Subject<ReceiveDeviceActionMessage>();
                    addUpdates = new Subject<AddUpdatesMessage>();
                    deviceConnected = new Subject();
                    deviceDisconnected = new Subject();
                    connection.events.set('repo/receive_action', receiveEvent);
                    connection.events.set('repo/add_updates', addUpdates);
                    connection.events.set(
                        'repo/connected_to_branch',
                        deviceConnected
                    );
                    connection.events.set(
                        'repo/disconnected_from_branch',
                        deviceDisconnected
                    );
                    client = new InstRecordsClient(connection);
                    connection.connect();
                    sub = new Subscription();
                    authSource = new PartitionAuthSource();

                    added = [];
                    removed = [];
                    updated = [];
                    updates = [];

                    setupPartition({
                        type: 'other_players_repo',
                        recordName: recordName,
                        inst: 'inst',
                        branch: 'testBranch',
                        host: 'testHost',
                        childPartitionType: 'yjs_client',
                    });

                    tempPartition = new YjsPartitionImpl({
                        type: 'yjs',
                    });
                });

                afterEach(() => {
                    sub.unsubscribe();
                });

                it('should return delayed for the realtimeStrategy', () => {
                    expect(partition.realtimeStrategy).toEqual('delayed');
                });

                it('should issue connection, authentication, authorization, and sync events in that order', async () => {
                    const promise = firstValueFrom(
                        partition.onStatusUpdated.pipe(
                            takeWhile((update) => update.type !== 'sync', true),
                            bufferCount(4)
                        )
                    );

                    partition.connect();

                    deviceConnected.next({
                        type: 'repo/connected_to_branch',
                        broadcast: false,
                        branch: {
                            type: 'repo/watch_branch',
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch',
                        },
                        connection: device1,
                    });

                    const update = await promise;

                    expect(update).toEqual([
                        {
                            type: 'connection',
                            connected: true,
                        },
                        expect.objectContaining({
                            type: 'authentication',
                            authenticated: true,
                        }),
                        expect.objectContaining({
                            type: 'authorization',
                            authorized: true,
                        }),
                        {
                            type: 'sync',
                            synced: true,
                        },
                    ]);
                });

                describe('remote events', () => {
                    it('should not send the remote event to the server', async () => {
                        await partition.sendRemoteEvents([
                            remote(
                                {
                                    type: 'def',
                                },
                                {
                                    connectionId: 'device',
                                }
                            ),
                        ]);

                        expect(connection.sentMessages).toEqual([]);
                    });

                    describe('get_remotes', () => {
                        it(`should send an async result with the player list`, async () => {
                            setupPartition({
                                type: 'other_players_repo',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                                host: 'testHost',
                            });
                            partition.connect();

                            await waitAsync();

                            const events = [] as Action[];
                            partition.onEvents.subscribe((e) =>
                                events.push(...e)
                            );

                            const info1 = connectionInfo(
                                'info1Username',
                                'info1Device',
                                'info1Session'
                            );
                            const info2 = connectionInfo(
                                'info2Username',
                                'info2Device',
                                'info2Session'
                            );
                            deviceConnected.next({
                                type: 'repo/connected_to_branch',
                                broadcast: false,
                                branch: {
                                    type: 'repo/watch_branch',
                                    recordName: recordName,
                                    inst: 'inst',
                                    branch: 'testBranch',
                                },
                                connection: info1,
                            });
                            deviceConnected.next({
                                type: 'repo/connected_to_branch',
                                broadcast: false,
                                branch: {
                                    type: 'repo/watch_branch',
                                    recordName: recordName,
                                    inst: 'inst',
                                    branch: 'testBranch',
                                },
                                connection: info2,
                            });

                            await waitAsync();

                            await partition.sendRemoteEvents([
                                remote(
                                    getRemotes(),
                                    undefined,
                                    undefined,
                                    'task1'
                                ),
                            ]);

                            expect(events.slice(4)).toEqual([
                                asyncResult('task1', [
                                    'info1Session',
                                    'info2Session',
                                    // Should include the current player
                                    'test',
                                ]),
                            ]);
                        });

                        it(`should return only the players that are currently connected`, async () => {
                            setupPartition({
                                type: 'other_players_repo',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                                host: 'testHost',
                            });
                            partition.connect();

                            await waitAsync();

                            const events = [] as Action[];
                            partition.onEvents.subscribe((e) =>
                                events.push(...e)
                            );

                            const info1 = connectionInfo(
                                'info1Username',
                                'info1Device',
                                'info1Session'
                            );
                            const info2 = connectionInfo(
                                'info2Username',
                                'info2Device',
                                'info2Session'
                            );
                            deviceConnected.next({
                                type: 'repo/connected_to_branch',
                                broadcast: false,
                                branch: {
                                    type: 'repo/watch_branch',
                                    recordName: recordName,
                                    inst: 'inst',
                                    branch: 'testBranch',
                                },
                                connection: info1,
                            });
                            deviceConnected.next({
                                type: 'repo/connected_to_branch',
                                broadcast: false,
                                branch: {
                                    type: 'repo/watch_branch',
                                    recordName: recordName,
                                    inst: 'inst',
                                    branch: 'testBranch',
                                },
                                connection: info2,
                            });

                            await waitAsync();

                            deviceDisconnected.next({
                                type: 'repo/disconnected_from_branch',
                                broadcast: false,
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                                connection: info2,
                            });

                            await partition.sendRemoteEvents([
                                remote(
                                    getRemotes(),
                                    undefined,
                                    undefined,
                                    'task1'
                                ),
                            ]);

                            expect(events.slice(6)).toEqual([
                                asyncResult('task1', [
                                    'info1Session',
                                    // Should include the current player
                                    'test',
                                ]),
                            ]);
                        });

                        it(`should return only the current player if not connected`, async () => {
                            setupPartition({
                                type: 'other_players_repo',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                                host: 'testHost',
                            });

                            await waitAsync();

                            const events = [] as Action[];
                            partition.onEvents.subscribe((e) =>
                                events.push(...e)
                            );

                            const info1 = connectionInfo(
                                'info1Username',
                                'info1Device',
                                'info1Session'
                            );
                            const info2 = connectionInfo(
                                'info2Username',
                                'info2Device',
                                'info2Session'
                            );
                            deviceConnected.next({
                                type: 'repo/connected_to_branch',
                                broadcast: false,
                                branch: {
                                    type: 'repo/watch_branch',
                                    recordName: recordName,
                                    inst: 'inst',
                                    branch: 'testBranch',
                                },
                                connection: info1,
                            });
                            deviceConnected.next({
                                type: 'repo/connected_to_branch',
                                broadcast: false,
                                branch: {
                                    type: 'repo/watch_branch',
                                    recordName: recordName,
                                    inst: 'inst',
                                    branch: 'testBranch',
                                },
                                connection: info2,
                            });

                            await waitAsync();

                            deviceDisconnected.next({
                                type: 'repo/disconnected_from_branch',
                                broadcast: false,
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                                connection: info2,
                            });

                            await partition.sendRemoteEvents([
                                remote(
                                    getRemotes(),
                                    undefined,
                                    undefined,
                                    'task1'
                                ),
                            ]);

                            expect(events).toEqual([
                                asyncResult('task1', [
                                    // Should include the current player
                                    'test',
                                ]),
                            ]);
                        });
                    });
                });

                describe('rapid refresh handling - BUG FIX VERIFICATION', () => {
                    it('should not register self as a remote device when connection state updates', async () => {
                        partition.connect();
                        await waitAsync();

                        const events = [] as Action[];
                        partition.onEvents.subscribe((e) => events.push(...e));
                        const selfConnection = connectionInfo(
                            'testUser',
                            'testDevice',
                            'test'
                        );

                        deviceConnected.next({
                            type: 'repo/connected_to_branch',
                            broadcast: false,
                            branch: {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                            },
                            connection: selfConnection,
                        });

                        await waitAsync();
                        const joinEvents = events.filter(
                            (e) =>
                                e.type === ON_REMOTE_JOINED_ACTION_NAME ||
                                e.type ===
                                    ON_REMOTE_PLAYER_SUBSCRIBED_ACTION_NAME
                        );

                        expect(joinEvents).toEqual([]);
                        await partition.sendRemoteEvents([
                            remote(
                                getRemotes(),
                                undefined,
                                undefined,
                                'self-test'
                            ),
                        ]);

                        const result = events.find(
                            (e) =>
                                e.type === 'async_result' &&
                                (e as any).taskId === 'self-test'
                        ) as any;

                        expect(result.result).toEqual(['test']);
                    });

                    it('should handle rapid browser refresh without creating ghost connections', async () => {
                        partition.connect();
                        await waitAsync();

                        const events = [] as Action[];
                        partition.onEvents.subscribe((e) => events.push(...e));

                        const originalTab = connectionInfo(
                            'user1',
                            'browser-tab',
                            'session-v1'
                        );
                        deviceConnected.next({
                            type: 'repo/connected_to_branch',
                            broadcast: false,
                            branch: {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                            },
                            connection: originalTab,
                        });

                        await waitAsync();

                        const refreshedTab = connectionInfo(
                            'user1',
                            'browser-tab',
                            'session-v2'
                        );
                        deviceConnected.next({
                            type: 'repo/connected_to_branch',
                            broadcast: false,
                            branch: {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                            },
                            connection: refreshedTab,
                        });

                        await waitAsync();

                        deviceDisconnected.next({
                            type: 'repo/disconnected_from_branch',
                            broadcast: false,
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch',
                            connection: originalTab,
                        });

                        await waitAsync();
                        await partition.sendRemoteEvents([
                            remote(
                                getRemotes(),
                                undefined,
                                undefined,
                                'refresh-check'
                            ),
                        ]);

                        const result = events.find(
                            (e) =>
                                e.type === 'async_result' &&
                                (e as any).taskId === 'refresh-check'
                        ) as any;

                        expect(result).toBeDefined();
                        expect(result.result.sort()).toEqual(
                            ['session-v2', 'test'].sort()
                        );
                        expect(result.result).not.toContain('session-v1');
                    });

                    it('should handle multiple rapid refreshes in succession', async () => {
                        partition.connect();
                        await waitAsync();

                        const events = [] as Action[];
                        partition.onEvents.subscribe((e) => events.push(...e));

                        const sessions = [];
                        for (let i = 1; i <= 5; i++) {
                            const session = connectionInfo(
                                'user1',
                                'tab',
                                `session-${i}`
                            );
                            sessions.push(session);

                            deviceConnected.next({
                                type: 'repo/connected_to_branch',
                                broadcast: false,
                                branch: {
                                    type: 'repo/watch_branch',
                                    recordName: recordName,
                                    inst: 'inst',
                                    branch: 'testBranch',
                                },
                                connection: session,
                            });

                            await waitAsync();

                            if (i > 1) {
                                deviceDisconnected.next({
                                    type: 'repo/disconnected_from_branch',
                                    broadcast: false,
                                    recordName: recordName,
                                    inst: 'inst',
                                    branch: 'testBranch',
                                    connection: sessions[i - 2],
                                });
                            }
                        }

                        await waitAsync();
                        await partition.sendRemoteEvents([
                            remote(
                                getRemotes(),
                                undefined,
                                undefined,
                                'multi-refresh'
                            ),
                        ]);

                        const result = events.find(
                            (e) =>
                                e.type === 'async_result' &&
                                (e as any).taskId === 'multi-refresh'
                        ) as any;

                        expect(result.result.sort()).toEqual(
                            ['session-5', 'test'].sort()
                        );

                        for (let i = 1; i < 5; i++) {
                            expect(result.result).not.toContain(`session-${i}`);
                        }
                    });
                });

                describe('other_players', () => {
                    it('should watch for other devices', async () => {
                        partition.connect();

                        await waitAsync();

                        expect(connection.sentMessages).toEqual([
                            {
                                type: 'repo/watch_branch_devices',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                            },
                        ]);
                    });

                    it('should watch the branch for the given player', async () => {
                        partition.connect();

                        await waitAsync();

                        deviceConnected.next({
                            type: 'repo/connected_to_branch',
                            broadcast: false,
                            branch: {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                            },
                            connection: device1,
                        });

                        await waitAsync();

                        expect(connection.sentMessages.slice(1)).toEqual([
                            {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch-player-device1SessionId',
                                temporary: true,
                            },
                        ]);
                    });

                    it('should add bots from the new players branch', async () => {
                        partition.connect();

                        await waitAsync();

                        deviceConnected.next({
                            type: 'repo/connected_to_branch',
                            broadcast: false,
                            branch: {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                            },
                            connection: device1,
                        });

                        await waitAsync();

                        const state = partition.state;

                        await tempPartition.applyEvents([
                            botAdded(
                                createBot('test1', {
                                    abc: 'def',
                                })
                            ),
                        ]);

                        const update = fromByteArray(
                            encodeStateAsUpdate(tempPartition.doc)
                        );

                        addUpdates.next({
                            type: 'repo/add_updates',
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch-player-device1SessionId',
                            updates: [update],
                            initial: true,
                        });

                        await waitAsync();

                        expect(added).toEqual([
                            createBot('test1', {
                                abc: 'def',
                            }),
                        ]);
                        expect(partition.state).toEqual({
                            test1: createBot('test1', {
                                abc: 'def',
                            }),
                        });

                        // Should make a new state object on updates.
                        // This is because AuxHelper expects this in order for its caching to work properly.
                        expect(partition.state).not.toBe(state);
                        expect(updates).toEqual([
                            {
                                state: {
                                    test1: createBot('test1', {
                                        abc: 'def',
                                    }),
                                },
                                addedBots: ['test1'],
                                removedBots: [],
                                updatedBots: [],
                                version: null,
                            },
                        ]);
                    });

                    it('should remove bots from the new players branch', async () => {
                        partition.connect();

                        await waitAsync();

                        deviceConnected.next({
                            type: 'repo/connected_to_branch',
                            broadcast: false,
                            branch: {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                            },
                            connection: device1,
                        });

                        await waitAsync();

                        const state = partition.state;

                        await tempPartition.applyEvents([
                            botAdded(
                                createBot('test1', {
                                    abc: 'def',
                                })
                            ),
                        ]);

                        let update = fromByteArray(
                            encodeStateAsUpdate(tempPartition.doc)
                        );

                        addUpdates.next({
                            type: 'repo/add_updates',
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch-player-device1SessionId',
                            updates: [update],
                            initial: true,
                        });

                        await waitAsync();

                        await tempPartition.applyEvents([botRemoved('test1')]);

                        update = fromByteArray(
                            encodeStateAsUpdate(tempPartition.doc)
                        );

                        addUpdates.next({
                            type: 'repo/add_updates',
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch-player-device1SessionId',
                            updates: [update],
                        });

                        expect(removed).toEqual(['test1']);
                        expect(partition.state).toEqual({});

                        // Should make a new state object on updates.
                        // This is because AuxHelper expects this in order for its caching to work properly.
                        expect(partition.state).not.toBe(state);

                        expect(updates).toEqual([
                            {
                                state: {
                                    test1: createBot('test1', {
                                        abc: 'def',
                                    }),
                                },
                                addedBots: ['test1'],
                                removedBots: [],
                                updatedBots: [],
                                version: null,
                            },
                            {
                                state: {
                                    test1: null,
                                },
                                addedBots: [],
                                removedBots: ['test1'],
                                updatedBots: [],
                                version: null,
                            },
                        ]);
                    });

                    it('should update bots on the new players branch', async () => {
                        partition.connect();

                        await waitAsync();

                        deviceConnected.next({
                            type: 'repo/connected_to_branch',
                            broadcast: false,
                            branch: {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                            },
                            connection: device1,
                        });

                        await waitAsync();

                        const state = partition.state;

                        await tempPartition.applyEvents([
                            botAdded(
                                createBot('test1', {
                                    abc: 'def',
                                })
                            ),
                        ]);

                        await waitAsync();

                        let update = fromByteArray(
                            encodeStateAsUpdate(tempPartition.doc)
                        );

                        addUpdates.next({
                            type: 'repo/add_updates',
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch-player-device1SessionId',
                            updates: [update],
                            initial: true,
                        });

                        await waitAsync();

                        await tempPartition.applyEvents([
                            botUpdated('test1', {
                                tags: {
                                    abc: 'ghi',
                                },
                            }),
                        ]);

                        await waitAsync();

                        update = fromByteArray(
                            encodeStateAsUpdate(tempPartition.doc)
                        );

                        addUpdates.next({
                            type: 'repo/add_updates',
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch-player-device1SessionId',
                            updates: [update],
                        });

                        await waitAsync();

                        expect(updated).toEqual([
                            {
                                bot: createBot('test1', {
                                    abc: 'ghi',
                                }),
                                tags: ['abc'],
                            },
                        ]);
                        expect(partition.state).toEqual({
                            test1: createBot('test1', {
                                abc: 'ghi',
                            }),
                        });

                        // Should make a new state object on updates.
                        // This is because AuxHelper expects this in order for its caching to work properly.
                        expect(partition.state).not.toBe(state);

                        expect(updates).toEqual([
                            {
                                state: {
                                    test1: createBot('test1', {
                                        abc: 'def',
                                    }),
                                },
                                addedBots: ['test1'],
                                removedBots: [],
                                updatedBots: [],
                                version: null,
                            },
                            {
                                state: {
                                    test1: {
                                        tags: {
                                            abc: 'ghi',
                                        },
                                    },
                                },
                                addedBots: [],
                                removedBots: [],
                                updatedBots: ['test1'],
                                version: null,
                            },
                        ]);
                    });

                    it('should add tag masks from other players', async () => {
                        tempPartition.space = partition.space = 'testSpace';
                        partition.connect();

                        await waitAsync();

                        deviceConnected.next({
                            type: 'repo/connected_to_branch',
                            broadcast: false,
                            branch: {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                            },
                            connection: device1,
                        });

                        await waitAsync();

                        const state = partition.state;

                        await tempPartition.applyEvents([
                            botUpdated('test1', {
                                masks: {
                                    [partition.space]: {
                                        abc: 'def',
                                    },
                                },
                            }),
                        ]);

                        let update = fromByteArray(
                            encodeStateAsUpdate(tempPartition.doc)
                        );

                        addUpdates.next({
                            type: 'repo/add_updates',
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch-player-device1SessionId',
                            updates: [update],
                            initial: true,
                        });

                        await waitAsync();

                        await tempPartition.applyEvents([
                            botUpdated('test1', {
                                masks: {
                                    [partition.space]: {
                                        abc: 'ghi',
                                    },
                                },
                            }),
                        ]);

                        update = fromByteArray(
                            encodeStateAsUpdate(tempPartition.doc)
                        );

                        addUpdates.next({
                            type: 'repo/add_updates',
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch-player-device1SessionId',
                            updates: [update],
                        });

                        await waitAsync();

                        expect(updated).toEqual([]);
                        expect(partition.state).toEqual({
                            test1: {
                                masks: {
                                    [partition.space]: {
                                        abc: 'ghi',
                                    },
                                },
                            },
                        });

                        // Should make a new state object on updates.
                        // This is because AuxHelper expects this in order for its caching to work properly.
                        expect(partition.state).not.toBe(state);

                        expect(updates).toEqual([
                            {
                                state: {
                                    test1: {
                                        masks: {
                                            [partition.space]: {
                                                abc: 'def',
                                            },
                                        },
                                    },
                                },
                                addedBots: [],
                                removedBots: [],
                                updatedBots: ['test1'],
                                version: null,
                            },
                            {
                                state: {
                                    test1: {
                                        masks: {
                                            [partition.space]: {
                                                abc: 'ghi',
                                            },
                                        },
                                    },
                                },
                                addedBots: [],
                                removedBots: [],
                                updatedBots: ['test1'],
                                version: null,
                            },
                        ]);
                    });

                    it('should stop watching the player branch when the device disconnects', async () => {
                        partition.connect();

                        await waitAsync();

                        deviceConnected.next({
                            type: 'repo/connected_to_branch',
                            broadcast: false,
                            branch: {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                            },
                            connection: device1,
                        });

                        await waitAsync();

                        deviceDisconnected.next({
                            type: 'repo/disconnected_from_branch',
                            broadcast: false,
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch',
                            connection: device1,
                        });

                        await waitAsync();

                        expect(connection.sentMessages.slice(1)).toEqual([
                            {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch-player-device1SessionId',
                                temporary: true,
                            },
                            {
                                type: 'repo/unwatch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch-player-device1SessionId',
                            },
                        ]);
                    });

                    it('should remove all the bots that were part of the player branch when the device disconnects', async () => {
                        partition.connect();

                        await waitAsync();

                        deviceConnected.next({
                            type: 'repo/connected_to_branch',
                            broadcast: false,
                            branch: {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                            },
                            connection: device1,
                        });

                        await waitAsync();

                        await tempPartition.applyEvents([
                            botAdded(
                                createBot('test1', {
                                    abc: 'def',
                                })
                            ),
                        ]);

                        let update = fromByteArray(
                            encodeStateAsUpdate(tempPartition.doc)
                        );

                        addUpdates.next({
                            type: 'repo/add_updates',
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch-player-device1SessionId',
                            updates: [update],
                            initial: true,
                        });

                        await waitAsync();

                        deviceDisconnected.next({
                            type: 'repo/disconnected_from_branch',
                            broadcast: false,
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch',
                            connection: device1,
                        });

                        await waitAsync();

                        expect(removed).toEqual(['test1']);
                        expect(partition.state).toEqual({});
                        expect(updates).toEqual([
                            {
                                state: {
                                    test1: createBot('test1', {
                                        abc: 'def',
                                    }),
                                },
                                addedBots: ['test1'],
                                removedBots: [],
                                updatedBots: [],
                                version: null,
                            },
                            {
                                state: {
                                    test1: null,
                                },
                                addedBots: [],
                                removedBots: ['test1'],
                                updatedBots: [],
                                version: null,
                            },
                        ]);
                    });

                    it('should remove the tag masks that were part of the player branch when the device disconnects', async () => {
                        partition.space = 'testSpace';
                        tempPartition.space = 'testSpace';
                        partition.connect();

                        await waitAsync();

                        deviceConnected.next({
                            type: 'repo/connected_to_branch',
                            broadcast: false,
                            branch: {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                            },
                            connection: device1,
                        });

                        await tempPartition.applyEvents([
                            botUpdated('test1', {
                                masks: {
                                    [partition.space]: {
                                        abc: 'def',
                                    },
                                },
                            }),
                        ]);

                        let update = fromByteArray(
                            encodeStateAsUpdate(tempPartition.doc)
                        );

                        await waitAsync();

                        addUpdates.next({
                            type: 'repo/add_updates',
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch-player-device1SessionId',
                            updates: [update],
                            initial: true,
                        });

                        await waitAsync();

                        deviceDisconnected.next({
                            type: 'repo/disconnected_from_branch',
                            broadcast: false,
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch',
                            connection: device1,
                        });

                        await waitAsync();

                        expect(removed).toEqual([]);
                        expect(partition.state).toEqual({});
                        expect(updates).toEqual([
                            {
                                state: {
                                    test1: {
                                        masks: {
                                            [partition.space]: {
                                                abc: 'def',
                                            },
                                        },
                                    },
                                },
                                addedBots: [],
                                removedBots: [],
                                updatedBots: ['test1'],
                                version: null,
                            },
                            {
                                state: {
                                    test1: {
                                        masks: {
                                            [partition.space]: {
                                                abc: null,
                                            },
                                        },
                                    },
                                },
                                addedBots: [],
                                removedBots: [],
                                updatedBots: ['test1'],
                                version: null,
                            },
                        ]);
                    });

                    it('should do nothing when given a bot event', async () => {
                        partition.connect();

                        await waitAsync();

                        deviceConnected.next({
                            type: 'repo/connected_to_branch',
                            broadcast: false,
                            branch: {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                            },
                            connection: device1,
                        });

                        await waitAsync();

                        const extra = await partition.applyEvents([
                            botAdded(
                                createBot('test1', {
                                    abc: 'def',
                                })
                            ),
                        ]);

                        await waitAsync();

                        expect(extra).toEqual([]);
                        expect(added).toEqual([]);
                        expect(partition.state).toEqual({});
                    });

                    it('should ignore devices that are the same user as the partition', async () => {
                        partition.connect();

                        await waitAsync();
                        const userDevice = connectionInfo(
                            'username',
                            'username',
                            'test'
                        );

                        deviceConnected.next({
                            type: 'repo/connected_to_branch',
                            broadcast: false,
                            branch: {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                            },
                            connection: userDevice,
                        });

                        await waitAsync();

                        expect(connection.sentMessages.slice(1)).toEqual([]);
                    });

                    it('should not ignore the server user', async () => {
                        partition.connect();

                        await waitAsync();
                        const serverDevice = connectionInfo(
                            'Server',
                            'Server',
                            'server'
                        );

                        deviceConnected.next({
                            type: 'repo/connected_to_branch',
                            broadcast: false,
                            branch: {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                            },
                            connection: serverDevice,
                        });

                        await waitAsync();

                        expect(connection.sentMessages.slice(1)).toEqual([
                            {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch-player-server',
                                temporary: true,
                            },
                        ]);
                    });

                    it('should handle when two connected events are recieved from the same device', async () => {
                        partition.connect();

                        await waitAsync();

                        deviceConnected.next({
                            type: 'repo/connected_to_branch',
                            broadcast: false,
                            branch: {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                            },
                            connection: device1,
                        });

                        deviceConnected.next({
                            type: 'repo/connected_to_branch',
                            broadcast: false,
                            branch: {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                            },
                            connection: device1,
                        });

                        await waitAsync();

                        expect(connection.sentMessages.slice(1)).toEqual([
                            {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch-player-device1SessionId',
                                temporary: true,
                            },
                        ]);

                        const state = partition.state;

                        await tempPartition.applyEvents([
                            botAdded(
                                createBot('test1', {
                                    abc: 'def',
                                })
                            ),
                        ]);

                        const update = fromByteArray(
                            encodeStateAsUpdate(tempPartition.doc)
                        );

                        addUpdates.next({
                            type: 'repo/add_updates',
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch-player-device1SessionId',
                            updates: [update],
                            initial: true,
                        });

                        await waitAsync();

                        expect(added).toEqual([
                            createBot('test1', {
                                abc: 'def',
                            }),
                        ]);
                        expect(partition.state).toEqual({
                            test1: createBot('test1', {
                                abc: 'def',
                            }),
                        });

                        // Should make a new state object on updates.
                        // This is because AuxHelper expects this in order for its caching to work properly.
                        expect(partition.state).not.toBe(state);
                        expect(updates).toEqual([
                            {
                                state: {
                                    test1: createBot('test1', {
                                        abc: 'def',
                                    }),
                                },
                                addedBots: ['test1'],
                                removedBots: [],
                                updatedBots: [],
                                version: null,
                            },
                        ]);
                    });

                    it('should handle when two disconnected events are recieved from the same device', async () => {
                        partition.connect();

                        await waitAsync();

                        deviceDisconnected.next({
                            type: 'repo/disconnected_from_branch',
                            broadcast: false,
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch',
                            connection: device1,
                        });

                        deviceDisconnected.next({
                            type: 'repo/disconnected_from_branch',
                            broadcast: false,
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch',
                            connection: device1,
                        });

                        await waitAsync();

                        expect(connection.sentMessages.slice(1)).toEqual([]);
                        expect(partition.state).toEqual({});
                    });

                    it('should handle when a device is connected and disconnected at the same time', async () => {
                        partition.connect();

                        await waitAsync();

                        deviceConnected.next({
                            type: 'repo/connected_to_branch',
                            broadcast: false,
                            branch: {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                            },
                            connection: device1,
                        });

                        deviceDisconnected.next({
                            type: 'repo/disconnected_from_branch',
                            broadcast: false,
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch',
                            connection: device1,
                        });

                        await waitAsync();

                        expect(connection.sentMessages.slice(1)).toEqual([
                            {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch-player-device1SessionId',
                                temporary: true,
                            },
                            {
                                type: 'repo/unwatch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch-player-device1SessionId',
                            },
                        ]);

                        const state = partition.state;

                        await tempPartition.applyEvents([
                            botAdded(
                                createBot('test1', {
                                    abc: 'def',
                                })
                            ),
                        ]);

                        const update = fromByteArray(
                            encodeStateAsUpdate(tempPartition.doc)
                        );

                        addUpdates.next({
                            type: 'repo/add_updates',
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch-player-device1SessionId',
                            updates: [update],
                            initial: true,
                        });

                        await waitAsync();

                        expect(added).toEqual([]);
                        expect(partition.state).toEqual({});

                        // Should make a new state object on updates.
                        // This is because AuxHelper expects this in order for its caching to work properly.
                        expect(partition.state).toBe(state);
                        expect(updates).toEqual([]);
                    });

                    it('should handle when multiple devices disconnect at the same time', async () => {
                        partition.connect();

                        await waitAsync();

                        deviceConnected.next({
                            type: 'repo/connected_to_branch',
                            broadcast: false,
                            branch: {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                            },
                            connection: device1,
                        });

                        deviceConnected.next({
                            type: 'repo/connected_to_branch',
                            broadcast: false,
                            branch: {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                            },
                            connection: device2,
                        });

                        deviceConnected.next({
                            type: 'repo/connected_to_branch',
                            broadcast: false,
                            branch: {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                            },
                            connection: device3,
                        });

                        await waitAsync();

                        expect(connection.sentMessages.slice(1)).toEqual([
                            {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch-player-device1SessionId',
                                temporary: true,
                            },
                            {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch-player-device2SessionId',
                                temporary: true,
                            },
                            {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch-player-device3SessionId',
                                temporary: true,
                            },
                        ]);

                        deviceDisconnected.next({
                            type: 'repo/disconnected_from_branch',
                            broadcast: false,
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch',
                            connection: device2,
                        });

                        deviceDisconnected.next({
                            type: 'repo/disconnected_from_branch',
                            broadcast: false,
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch',
                            connection: device1,
                        });

                        deviceDisconnected.next({
                            type: 'repo/disconnected_from_branch',
                            broadcast: false,
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch',
                            connection: device3,
                        });

                        await waitAsync();

                        expect(connection.sentMessages.slice(4)).toEqual([
                            {
                                type: 'repo/unwatch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch-player-device2SessionId',
                            },
                            {
                                type: 'repo/unwatch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch-player-device1SessionId',
                            },
                            {
                                type: 'repo/unwatch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch-player-device3SessionId',
                            },
                        ]);
                    });

                    it('should not send unwatch events when the connection is lost', async () => {
                        partition.connect();

                        await waitAsync();

                        deviceConnected.next({
                            type: 'repo/connected_to_branch',
                            broadcast: false,
                            branch: {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                            },
                            connection: device1,
                        });

                        deviceConnected.next({
                            type: 'repo/connected_to_branch',
                            broadcast: false,
                            branch: {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                            },
                            connection: device2,
                        });

                        deviceConnected.next({
                            type: 'repo/connected_to_branch',
                            broadcast: false,
                            branch: {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                            },
                            connection: device3,
                        });

                        await waitAsync();

                        expect(connection.sentMessages.slice(1)).toEqual([
                            {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch-player-device1SessionId',
                                temporary: true,
                            },
                            {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch-player-device2SessionId',
                                temporary: true,
                            },
                            {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch-player-device3SessionId',
                                temporary: true,
                            },
                        ]);

                        connection.disconnect();

                        await waitAsync();

                        expect(connection.sentMessages.slice(4)).toEqual([]);
                    });

                    it('should handle when the connection is disconnected and then reconnected at the same time', async () => {
                        partition.connect();

                        let events = [] as Action[];
                        partition.onEvents.subscribe((e) => events.push(...e));

                        await waitAsync();

                        deviceConnected.next({
                            type: 'repo/connected_to_branch',
                            broadcast: false,
                            branch: {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                            },
                            connection: device1,
                        });

                        deviceConnected.next({
                            type: 'repo/connected_to_branch',
                            broadcast: false,
                            branch: {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                            },
                            connection: device2,
                        });

                        deviceConnected.next({
                            type: 'repo/connected_to_branch',
                            broadcast: false,
                            branch: {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                            },
                            connection: device3,
                        });

                        await waitAsync();

                        expect(connection.sentMessages.slice(1)).toEqual([
                            {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch-player-device1SessionId',
                                temporary: true,
                            },
                            {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch-player-device2SessionId',
                                temporary: true,
                            },
                            {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch-player-device3SessionId',
                                temporary: true,
                            },
                        ]);

                        expect(events).toEqual([
                            action(ON_REMOTE_JOINED_ACTION_NAME, null, null, {
                                remoteId: 'device1SessionId',
                            }),
                            action(
                                ON_REMOTE_PLAYER_SUBSCRIBED_ACTION_NAME,
                                null,
                                null,
                                {
                                    playerId: 'device1SessionId',
                                }
                            ),
                            action(ON_REMOTE_JOINED_ACTION_NAME, null, null, {
                                remoteId: 'device2SessionId',
                            }),
                            action(
                                ON_REMOTE_PLAYER_SUBSCRIBED_ACTION_NAME,
                                null,
                                null,
                                {
                                    playerId: 'device2SessionId',
                                }
                            ),
                            action(ON_REMOTE_JOINED_ACTION_NAME, null, null, {
                                remoteId: 'device3SessionId',
                            }),
                            action(
                                ON_REMOTE_PLAYER_SUBSCRIBED_ACTION_NAME,
                                null,
                                null,
                                {
                                    playerId: 'device3SessionId',
                                }
                            ),
                        ]);

                        events = [];

                        connection.disconnect();

                        await waitAsync();

                        expect(events).toEqual([
                            action(ON_REMOTE_LEAVE_ACTION_NAME, null, null, {
                                remoteId: 'device1SessionId',
                            }),
                            action(
                                ON_REMOTE_PLAYER_UNSUBSCRIBED_ACTION_NAME,
                                null,
                                null,
                                {
                                    playerId: 'device1SessionId',
                                }
                            ),
                            action(ON_REMOTE_LEAVE_ACTION_NAME, null, null, {
                                remoteId: 'device2SessionId',
                            }),
                            action(
                                ON_REMOTE_PLAYER_UNSUBSCRIBED_ACTION_NAME,
                                null,
                                null,
                                {
                                    playerId: 'device2SessionId',
                                }
                            ),
                            action(ON_REMOTE_LEAVE_ACTION_NAME, null, null, {
                                remoteId: 'device3SessionId',
                            }),
                            action(
                                ON_REMOTE_PLAYER_UNSUBSCRIBED_ACTION_NAME,
                                null,
                                null,
                                {
                                    playerId: 'device3SessionId',
                                }
                            ),
                        ]);

                        connection.connect();

                        await waitAsync();

                        expect(connection.sentMessages.slice(4)).toEqual([
                            {
                                type: 'repo/watch_branch_devices',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                            },
                        ]);
                    });

                    it('should use the specified space', async () => {
                        tempPartition.space = partition.space = 'test';
                        partition.connect();

                        await waitAsync();

                        deviceConnected.next({
                            type: 'repo/connected_to_branch',
                            broadcast: false,
                            branch: {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                            },
                            connection: device1,
                        });

                        await waitAsync();

                        const state = partition.state;

                        await tempPartition.applyEvents([
                            botAdded(
                                createBot('test1', {
                                    abc: 'def',
                                })
                            ),
                        ]);

                        let update = fromByteArray(
                            encodeStateAsUpdate(tempPartition.doc)
                        );

                        addUpdates.next({
                            type: 'repo/add_updates',
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch-player-device1SessionId',
                            updates: [update],
                            initial: true,
                        });

                        await waitAsync();

                        expect(added).toEqual([
                            createBot(
                                'test1',
                                {
                                    abc: 'def',
                                },
                                <any>'test'
                            ),
                        ]);
                        expect(partition.state).toEqual({
                            test1: createBot(
                                'test1',
                                {
                                    abc: 'def',
                                },
                                <any>'test'
                            ),
                        });

                        // Should make a new state object on updates.
                        // This is because AuxHelper expects this in order for its caching to work properly.
                        expect(partition.state).not.toBe(state);

                        expect(updates).toEqual([
                            {
                                state: {
                                    test1: createBot(
                                        'test1',
                                        {
                                            abc: 'def',
                                        },
                                        <any>'test'
                                    ),
                                },
                                addedBots: ['test1'],
                                removedBots: [],
                                updatedBots: [],
                                version: null,
                            },
                        ]);
                    });

                    it('should send a onRemotePlayerSubscribed shout', async () => {
                        partition.connect();

                        await waitAsync();
                        const device1 = connectionInfo(
                            'device1Username',
                            'device1DeviceId',
                            'device1SessionId'
                        );

                        let events = [] as Action[];
                        partition.onEvents.subscribe((e) => events.push(...e));

                        deviceConnected.next({
                            type: 'repo/connected_to_branch',
                            broadcast: false,
                            branch: {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                            },
                            connection: device1,
                        });

                        await waitAsync();

                        expect(events).toEqual([
                            action(ON_REMOTE_JOINED_ACTION_NAME, null, null, {
                                remoteId: 'device1SessionId',
                            }),
                            action(
                                ON_REMOTE_PLAYER_SUBSCRIBED_ACTION_NAME,
                                null,
                                null,
                                {
                                    playerId: 'device1SessionId',
                                }
                            ),
                        ]);
                    });

                    it('should send a onRemotePlayerUnsubscribed shout', async () => {
                        partition.connect();

                        await waitAsync();
                        const device1 = connectionInfo(
                            'device1Username',
                            'device1DeviceId',
                            'device1SessionId'
                        );

                        let events = [] as Action[];
                        partition.onEvents.subscribe((e) => events.push(...e));

                        deviceConnected.next({
                            type: 'repo/connected_to_branch',
                            broadcast: false,
                            branch: {
                                type: 'repo/watch_branch',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                            },
                            connection: device1,
                        });

                        await waitAsync();

                        deviceDisconnected.next({
                            type: 'repo/disconnected_from_branch',
                            broadcast: false,
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch',
                            connection: device1,
                        });

                        await waitAsync();

                        expect(events).toEqual([
                            action(ON_REMOTE_JOINED_ACTION_NAME, null, null, {
                                remoteId: 'device1SessionId',
                            }),
                            action(
                                ON_REMOTE_PLAYER_SUBSCRIBED_ACTION_NAME,
                                null,
                                null,
                                {
                                    playerId: 'device1SessionId',
                                }
                            ),
                            action(ON_REMOTE_LEAVE_ACTION_NAME, null, null, {
                                remoteId: 'device1SessionId',
                            }),
                            action(
                                ON_REMOTE_PLAYER_UNSUBSCRIBED_ACTION_NAME,
                                null,
                                null,
                                {
                                    playerId: 'device1SessionId',
                                }
                            ),
                        ]);
                    });
                });

                describe('skip initial load', () => {
                    it('should not try to connect when loaded', async () => {
                        setupPartition({
                            type: 'other_players_repo',
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch',
                            host: 'testHost',
                            childPartitionType: 'yjs_client',
                            skipInitialLoad: true,
                        });

                        const promise = firstValueFrom(
                            partition.onStatusUpdated.pipe(
                                takeWhile(
                                    (update) => update.type !== 'sync',
                                    true
                                ),
                                bufferCount(4)
                            )
                        );

                        partition.connect();

                        const update = await promise;

                        expect(update).toEqual([
                            {
                                type: 'connection',
                                connected: true,
                            },
                            expect.objectContaining({
                                type: 'authentication',
                                authenticated: true,
                            }),
                            expect.objectContaining({
                                type: 'authorization',
                                authorized: true,
                            }),
                            {
                                type: 'sync',
                                synced: true,
                            },
                        ]);

                        expect(connection.sentMessages).toEqual([]);
                    });

                    it('should connect to the branch if enableCollaboration() is called', async () => {
                        setupPartition({
                            type: 'other_players_repo',
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch',
                            host: 'testHost',
                            childPartitionType: 'yjs_client',
                            skipInitialLoad: true,
                        });

                        partition.connect();

                        await waitAsync();

                        let resolved: boolean = false;
                        partition
                            .enableCollaboration()
                            .then(() => (resolved = true));

                        await waitAsync();

                        expect(connection.sentMessages).toEqual([
                            {
                                type: 'repo/watch_branch_devices',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                            },
                        ]);

                        deviceConnected.next({
                            type: 'repo/connected_to_branch',
                            branch: {
                                type: 'repo/watch_branch',
                                recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                            },
                            broadcast: false,
                            connection: device1,
                        });

                        await waitAsync();

                        expect(resolved).toBe(true);
                    });
                });
            });

            function setupPartition(config: OtherPlayersRepoPartitionConfig) {
                partition = new OtherPlayersPartitionImpl(
                    client,
                    authSource,
                    config
                );

                sub.add(partition);
                sub.add(
                    partition.onBotsAdded.subscribe((b) => added.push(...b))
                );
                sub.add(
                    partition.onBotsRemoved.subscribe((b) => removed.push(...b))
                );
                sub.add(
                    partition.onBotsUpdated.subscribe((b) => updated.push(...b))
                );
                sub.add(
                    partition.onStateUpdated
                        .pipe(skip(1))
                        .subscribe((b) => updates.push(cloneDeep(b)))
                );
            }
        });
    });
});
