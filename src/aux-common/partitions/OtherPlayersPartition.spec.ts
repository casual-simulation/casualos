import { testPartitionImplementation } from './test/PartitionTests';
import { OtherPlayersPartitionImpl } from './OtherPlayersPartition';
import {
    MemoryConnectionClient,
    ADD_ATOMS,
    AddAtomsEvent,
    atom,
    atomId,
    ReceiveDeviceActionEvent,
    RECEIVE_EVENT,
    remote,
    SEND_EVENT,
    WATCH_BRANCH_DEVICES,
    ConnectedToBranchEvent,
    DisconnectedFromBranchEvent,
    DEVICE_CONNECTED_TO_BRANCH,
    DEVICE_DISCONNECTED_FROM_BRANCH,
    deviceInfo,
    WATCH_BRANCH,
    UNWATCH_BRANCH,
    Action,
    AddUpdatesEvent,
    ADD_UPDATES,
} from '@casual-simulation/causal-trees';
import {
    CausalRepoClient,
    CurrentVersion,
} from '@casual-simulation/causal-trees/core2';
import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import {
    Bot,
    UpdatedBot,
    createBot,
    botAdded,
    getRemotes,
    asyncResult,
    action,
    ON_REMOTE_PLAYER_SUBSCRIBED_ACTION_NAME,
    ON_REMOTE_PLAYER_UNSUBSCRIBED_ACTION_NAME,
    StateUpdatedEvent,
    ON_REMOTE_JOINED_ACTION_NAME,
    ON_REMOTE_LEAVE_ACTION_NAME,
    botRemoved,
    botUpdated,
} from '../bots';
import { OtherPlayersRepoPartitionConfig } from './AuxPartitionConfig';
import { bot, tag, value, deleteOp, tagMask } from '../aux-format-2';
import { waitAsync, wait } from '../test/TestHelpers';
import { takeWhile, bufferCount, skip } from 'rxjs/operators';
import { createDocFromUpdates, getUpdates } from '../test/YjsTestHelpers';
import { YjsPartitionImpl } from './YjsPartition';
import { encodeStateAsUpdate } from 'yjs';
import { fromByteArray } from 'base64-js';
import { cloneDeep } from 'lodash';

console.log = jest.fn();

describe('OtherPlayersPartition', () => {
    let connection: MemoryConnectionClient;
    let client: CausalRepoClient;
    let partition: OtherPlayersPartitionImpl;
    let receiveEvent: Subject<ReceiveDeviceActionEvent>;
    let deviceConnected: Subject<ConnectedToBranchEvent>;
    let deviceDisconnected: Subject<DisconnectedFromBranchEvent>;
    let added: Bot[];
    let removed: string[];
    let updated: UpdatedBot[];
    let updates: StateUpdatedEvent[];
    let sub: Subscription;

    let device1 = deviceInfo('device1', 'device1Id', 'device1SessionId');
    let device2 = deviceInfo('device2', 'device2Id', 'device2SessionId');
    let device3 = deviceInfo('device3', 'device3Id', 'device3SessionId');

    describe('connection', () => {
        describe('causal_repo_client', () => {
            let addAtoms: Subject<AddAtomsEvent>;

            beforeEach(async () => {
                connection = new MemoryConnectionClient();
                receiveEvent = new Subject<ReceiveDeviceActionEvent>();
                addAtoms = new Subject<AddAtomsEvent>();
                deviceConnected = new Subject();
                deviceDisconnected = new Subject();
                connection.events.set(RECEIVE_EVENT, receiveEvent);
                connection.events.set(ADD_ATOMS, addAtoms);
                connection.events.set(
                    DEVICE_CONNECTED_TO_BRANCH,
                    deviceConnected
                );
                connection.events.set(
                    DEVICE_DISCONNECTED_FROM_BRANCH,
                    deviceDisconnected
                );
                client = new CausalRepoClient(connection);
                connection.connect();
                sub = new Subscription();

                added = [];
                removed = [];
                updated = [];
                updates = [];

                setupPartition({
                    type: 'other_players_repo',
                    branch: 'testBranch',
                    host: 'testHost',
                });
            });

            afterEach(() => {
                sub.unsubscribe();
            });

            it('should return delayed for the realtimeStrategy', () => {
                expect(partition.realtimeStrategy).toEqual('delayed');
            });

            it('should issue connection, authentication, authorization, and sync events in that order', async () => {
                const promise = partition.onStatusUpdated
                    .pipe(
                        takeWhile((update) => update.type !== 'sync', true),
                        bufferCount(4)
                    )
                    .toPromise();

                partition.connect();

                deviceConnected.next({
                    broadcast: false,
                    branch: {
                        branch: 'testBranch',
                    },
                    device: device1,
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
                                deviceId: 'device',
                            }
                        ),
                    ]);

                    expect(connection.sentMessages).toEqual([]);
                });

                describe('get_remotes', () => {
                    it(`should send an async result with the player list`, async () => {
                        setupPartition({
                            type: 'other_players_repo',
                            branch: 'testBranch',
                            host: 'testHost',
                        });
                        partition.connect();

                        await waitAsync();

                        const events = [] as Action[];
                        partition.onEvents.subscribe((e) => events.push(...e));

                        const info1 = deviceInfo(
                            'info1Username',
                            'info1Device',
                            'info1Session'
                        );
                        const info2 = deviceInfo(
                            'info2Username',
                            'info2Device',
                            'info2Session'
                        );
                        deviceConnected.next({
                            broadcast: false,
                            branch: {
                                branch: 'testBranch',
                            },
                            device: info1,
                        });
                        deviceConnected.next({
                            broadcast: false,
                            branch: {
                                branch: 'testBranch',
                            },
                            device: info2,
                        });

                        await waitAsync();

                        await partition.sendRemoteEvents([
                            remote(getRemotes(), undefined, undefined, 'task1'),
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
                            branch: 'testBranch',
                            host: 'testHost',
                        });
                        partition.connect();

                        await waitAsync();

                        const events = [] as Action[];
                        partition.onEvents.subscribe((e) => events.push(...e));

                        const info1 = deviceInfo(
                            'info1Username',
                            'info1Device',
                            'info1Session'
                        );
                        const info2 = deviceInfo(
                            'info2Username',
                            'info2Device',
                            'info2Session'
                        );
                        deviceConnected.next({
                            broadcast: false,
                            branch: {
                                branch: 'testBranch',
                            },
                            device: info1,
                        });
                        deviceConnected.next({
                            broadcast: false,
                            branch: {
                                branch: 'testBranch',
                            },
                            device: info2,
                        });

                        await waitAsync();

                        deviceDisconnected.next({
                            broadcast: false,
                            branch: 'testBranch',
                            device: info2,
                        });

                        await partition.sendRemoteEvents([
                            remote(getRemotes(), undefined, undefined, 'task1'),
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
                            branch: 'testBranch',
                            host: 'testHost',
                        });

                        await waitAsync();

                        const events = [] as Action[];
                        partition.onEvents.subscribe((e) => events.push(...e));

                        const info1 = deviceInfo(
                            'info1Username',
                            'info1Device',
                            'info1Session'
                        );
                        const info2 = deviceInfo(
                            'info2Username',
                            'info2Device',
                            'info2Session'
                        );
                        deviceConnected.next({
                            broadcast: false,
                            branch: {
                                branch: 'testBranch',
                            },
                            device: info1,
                        });
                        deviceConnected.next({
                            broadcast: false,
                            branch: {
                                branch: 'testBranch',
                            },
                            device: info2,
                        });

                        await waitAsync();

                        deviceDisconnected.next({
                            broadcast: false,
                            branch: 'testBranch',
                            device: info2,
                        });

                        await partition.sendRemoteEvents([
                            remote(getRemotes(), undefined, undefined, 'task1'),
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

            describe('other_players', () => {
                it('should watch for other devices', async () => {
                    partition.connect();

                    await waitAsync();

                    expect(connection.sentMessages).toEqual([
                        {
                            name: WATCH_BRANCH_DEVICES,
                            data: 'testBranch',
                        },
                    ]);
                });

                it('should watch the branch for the given player', async () => {
                    partition.connect();

                    await waitAsync();

                    deviceConnected.next({
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: device1,
                    });

                    await waitAsync();

                    expect(connection.sentMessages.slice(1)).toEqual([
                        {
                            name: WATCH_BRANCH,
                            data: {
                                branch: 'testBranch-player-device1SessionId',
                                temporary: true,
                                siteId: expect.any(String),
                            },
                        },
                    ]);
                });

                it('should add bots from the new players branch', async () => {
                    partition.connect();

                    await waitAsync();

                    deviceConnected.next({
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: device1,
                    });

                    await waitAsync();

                    const state = partition.state;

                    const bot1 = atom(atomId('device1', 1), null, bot('test1'));
                    const tag1 = atom(atomId('device1', 2), bot1, tag('abc'));
                    const value1 = atom(
                        atomId('device1', 3),
                        tag1,
                        value('def')
                    );

                    addAtoms.next({
                        branch: 'testBranch-player-device1SessionId',
                        atoms: [bot1, tag1, value1],
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
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: device1,
                    });

                    await waitAsync();

                    const state = partition.state;

                    const bot1 = atom(atomId('device1', 1), null, bot('test1'));
                    const tag1 = atom(atomId('device1', 2), bot1, tag('abc'));
                    const value1 = atom(
                        atomId('device1', 3),
                        tag1,
                        value('def')
                    );
                    const del1 = atom(atomId('device1', 4), bot1, deleteOp());

                    addAtoms.next({
                        branch: 'testBranch-player-device1SessionId',
                        atoms: [bot1, tag1, value1],
                        initial: true,
                    });

                    await waitAsync();

                    addAtoms.next({
                        branch: 'testBranch-player-device1SessionId',
                        atoms: [del1],
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
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: device1,
                    });

                    await waitAsync();

                    const state = partition.state;

                    const bot1 = atom(atomId('device1', 1), null, bot('test1'));
                    const tag1 = atom(atomId('device1', 2), bot1, tag('abc'));
                    const value1 = atom(
                        atomId('device1', 3),
                        tag1,
                        value('def')
                    );
                    const value2 = atom(
                        atomId('device1', 4),
                        tag1,
                        value('ghi')
                    );

                    addAtoms.next({
                        branch: 'testBranch-player-device1SessionId',
                        atoms: [bot1, tag1, value1],
                        initial: true,
                    });

                    await waitAsync();

                    addAtoms.next({
                        branch: 'testBranch-player-device1SessionId',
                        atoms: [value2],
                    });

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
                    partition.space = 'testSpace';
                    partition.connect();

                    await waitAsync();

                    deviceConnected.next({
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: device1,
                    });

                    await waitAsync();

                    const state = partition.state;

                    const tag1 = atom(
                        atomId('device1', 2),
                        null,
                        tagMask('test1', 'abc')
                    );
                    const value1 = atom(
                        atomId('device1', 3),
                        tag1,
                        value('def')
                    );
                    const value2 = atom(
                        atomId('device1', 4),
                        tag1,
                        value('ghi')
                    );

                    addAtoms.next({
                        branch: 'testBranch-player-device1SessionId',
                        atoms: [tag1, value1],
                        initial: true,
                    });

                    await waitAsync();

                    addAtoms.next({
                        branch: 'testBranch-player-device1SessionId',
                        atoms: [value2],
                    });

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
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: device1,
                    });

                    await waitAsync();

                    deviceDisconnected.next({
                        broadcast: false,
                        branch: 'testBranch',
                        device: device1,
                    });

                    await waitAsync();

                    expect(connection.sentMessages.slice(1)).toEqual([
                        {
                            name: WATCH_BRANCH,
                            data: {
                                branch: 'testBranch-player-device1SessionId',
                                temporary: true,
                                siteId: expect.any(String),
                            },
                        },
                        {
                            name: UNWATCH_BRANCH,
                            data: 'testBranch-player-device1SessionId',
                        },
                    ]);
                });

                it('should remove all the bots that were part of the player branch when the device disconnects', async () => {
                    partition.connect();

                    await waitAsync();

                    deviceConnected.next({
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: device1,
                    });

                    await waitAsync();

                    const bot1 = atom(atomId('device1', 1), null, bot('test1'));
                    const tag1 = atom(atomId('device1', 2), bot1, tag('abc'));
                    const value1 = atom(
                        atomId('device1', 3),
                        tag1,
                        value('def')
                    );

                    addAtoms.next({
                        branch: 'testBranch-player-device1SessionId',
                        atoms: [bot1, tag1, value1],
                        initial: true,
                    });

                    await waitAsync();

                    deviceDisconnected.next({
                        broadcast: false,
                        branch: 'testBranch',
                        device: device1,
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
                    partition.connect();

                    await waitAsync();

                    deviceConnected.next({
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: device1,
                    });

                    await waitAsync();

                    const tag1 = atom(
                        atomId('device1', 2),
                        null,
                        tagMask('test1', 'abc')
                    );
                    const value1 = atom(
                        atomId('device1', 3),
                        tag1,
                        value('def')
                    );

                    addAtoms.next({
                        branch: 'testBranch-player-device1SessionId',
                        atoms: [tag1, value1],
                        initial: true,
                    });

                    await waitAsync();

                    deviceDisconnected.next({
                        broadcast: false,
                        branch: 'testBranch',
                        device: device1,
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
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: device1,
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
                    const userDevice = deviceInfo(
                        'username',
                        'username',
                        'test'
                    );

                    deviceConnected.next({
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: userDevice,
                    });

                    await waitAsync();

                    expect(connection.sentMessages.slice(1)).toEqual([]);
                });

                it('should not ignore the server user', async () => {
                    partition.connect();

                    await waitAsync();
                    const serverDevice = deviceInfo(
                        'Server',
                        'Server',
                        'server'
                    );

                    deviceConnected.next({
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: serverDevice,
                    });

                    await waitAsync();

                    expect(connection.sentMessages.slice(1)).toEqual([
                        {
                            name: WATCH_BRANCH,
                            data: {
                                branch: 'testBranch-player-server',
                                temporary: true,
                                siteId: expect.any(String),
                            },
                        },
                    ]);
                });

                it('should use the specified space', async () => {
                    partition.space = 'test';
                    partition.connect();

                    await waitAsync();

                    deviceConnected.next({
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: device1,
                    });

                    await waitAsync();

                    const state = partition.state;

                    const bot1 = atom(atomId('device1', 1), null, bot('test1'));
                    const tag1 = atom(atomId('device1', 2), bot1, tag('abc'));
                    const value1 = atom(
                        atomId('device1', 3),
                        tag1,
                        value('def')
                    );

                    addAtoms.next({
                        branch: 'testBranch-player-device1SessionId',
                        atoms: [bot1, tag1, value1],
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
                    const device1 = deviceInfo(
                        'device1Username',
                        'device1DeviceId',
                        'device1SessionId'
                    );

                    let events = [] as Action[];
                    partition.onEvents.subscribe((e) => events.push(...e));

                    deviceConnected.next({
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: device1,
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
                    const device1 = deviceInfo(
                        'device1Username',
                        'device1DeviceId',
                        'device1SessionId'
                    );

                    let events = [] as Action[];
                    partition.onEvents.subscribe((e) => events.push(...e));

                    deviceConnected.next({
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: device1,
                    });

                    await waitAsync();

                    deviceDisconnected.next({
                        broadcast: false,
                        branch: 'testBranch',
                        device: device1,
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
        });

        describe('yjs_client', () => {
            let addUpdates: Subject<AddUpdatesEvent>;
            let tempPartition: YjsPartitionImpl;

            beforeEach(async () => {
                connection = new MemoryConnectionClient();
                receiveEvent = new Subject<ReceiveDeviceActionEvent>();
                addUpdates = new Subject<AddUpdatesEvent>();
                deviceConnected = new Subject();
                deviceDisconnected = new Subject();
                connection.events.set(RECEIVE_EVENT, receiveEvent);
                connection.events.set(ADD_UPDATES, addUpdates);
                connection.events.set(
                    DEVICE_CONNECTED_TO_BRANCH,
                    deviceConnected
                );
                connection.events.set(
                    DEVICE_DISCONNECTED_FROM_BRANCH,
                    deviceDisconnected
                );
                client = new CausalRepoClient(connection);
                connection.connect();
                sub = new Subscription();

                added = [];
                removed = [];
                updated = [];
                updates = [];

                setupPartition({
                    type: 'other_players_repo',
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
                const promise = partition.onStatusUpdated
                    .pipe(
                        takeWhile((update) => update.type !== 'sync', true),
                        bufferCount(4)
                    )
                    .toPromise();

                partition.connect();

                deviceConnected.next({
                    broadcast: false,
                    branch: {
                        branch: 'testBranch',
                    },
                    device: device1,
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
                                deviceId: 'device',
                            }
                        ),
                    ]);

                    expect(connection.sentMessages).toEqual([]);
                });

                describe('get_remotes', () => {
                    it(`should send an async result with the player list`, async () => {
                        setupPartition({
                            type: 'other_players_repo',
                            branch: 'testBranch',
                            host: 'testHost',
                        });
                        partition.connect();

                        await waitAsync();

                        const events = [] as Action[];
                        partition.onEvents.subscribe((e) => events.push(...e));

                        const info1 = deviceInfo(
                            'info1Username',
                            'info1Device',
                            'info1Session'
                        );
                        const info2 = deviceInfo(
                            'info2Username',
                            'info2Device',
                            'info2Session'
                        );
                        deviceConnected.next({
                            broadcast: false,
                            branch: {
                                branch: 'testBranch',
                                protocol: 'updates',
                            },
                            device: info1,
                        });
                        deviceConnected.next({
                            broadcast: false,
                            branch: {
                                branch: 'testBranch',
                                protocol: 'updates',
                            },
                            device: info2,
                        });

                        await waitAsync();

                        await partition.sendRemoteEvents([
                            remote(getRemotes(), undefined, undefined, 'task1'),
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
                            branch: 'testBranch',
                            host: 'testHost',
                        });
                        partition.connect();

                        await waitAsync();

                        const events = [] as Action[];
                        partition.onEvents.subscribe((e) => events.push(...e));

                        const info1 = deviceInfo(
                            'info1Username',
                            'info1Device',
                            'info1Session'
                        );
                        const info2 = deviceInfo(
                            'info2Username',
                            'info2Device',
                            'info2Session'
                        );
                        deviceConnected.next({
                            broadcast: false,
                            branch: {
                                branch: 'testBranch',
                                protocol: 'updates',
                            },
                            device: info1,
                        });
                        deviceConnected.next({
                            broadcast: false,
                            branch: {
                                branch: 'testBranch',
                                protocol: 'updates',
                            },
                            device: info2,
                        });

                        await waitAsync();

                        deviceDisconnected.next({
                            broadcast: false,
                            branch: 'testBranch',
                            device: info2,
                        });

                        await partition.sendRemoteEvents([
                            remote(getRemotes(), undefined, undefined, 'task1'),
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
                            branch: 'testBranch',
                            host: 'testHost',
                        });

                        await waitAsync();

                        const events = [] as Action[];
                        partition.onEvents.subscribe((e) => events.push(...e));

                        const info1 = deviceInfo(
                            'info1Username',
                            'info1Device',
                            'info1Session'
                        );
                        const info2 = deviceInfo(
                            'info2Username',
                            'info2Device',
                            'info2Session'
                        );
                        deviceConnected.next({
                            broadcast: false,
                            branch: {
                                branch: 'testBranch',
                                protocol: 'updates',
                            },
                            device: info1,
                        });
                        deviceConnected.next({
                            broadcast: false,
                            branch: {
                                branch: 'testBranch',
                                protocol: 'updates',
                            },
                            device: info2,
                        });

                        await waitAsync();

                        deviceDisconnected.next({
                            broadcast: false,
                            branch: 'testBranch',
                            device: info2,
                        });

                        await partition.sendRemoteEvents([
                            remote(getRemotes(), undefined, undefined, 'task1'),
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

            describe('other_players', () => {
                it('should watch for other devices', async () => {
                    partition.connect();

                    await waitAsync();

                    expect(connection.sentMessages).toEqual([
                        {
                            name: WATCH_BRANCH_DEVICES,
                            data: 'testBranch',
                        },
                    ]);
                });

                it('should watch the branch for the given player', async () => {
                    partition.connect();

                    await waitAsync();

                    deviceConnected.next({
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                            protocol: 'updates',
                        },
                        device: device1,
                    });

                    await waitAsync();

                    expect(connection.sentMessages.slice(1)).toEqual([
                        {
                            name: WATCH_BRANCH,
                            data: {
                                branch: 'testBranch-player-device1SessionId',
                                temporary: true,
                                siteId: expect.any(String),
                                protocol: 'updates',
                            },
                        },
                    ]);
                });

                it('should add bots from the new players branch', async () => {
                    partition.connect();

                    await waitAsync();

                    deviceConnected.next({
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: device1,
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
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: device1,
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
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                            protocol: 'updates',
                        },
                        device: device1,
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
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                            protocol: 'updates',
                        },
                        device: device1,
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
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: device1,
                    });

                    await waitAsync();

                    deviceDisconnected.next({
                        broadcast: false,
                        branch: 'testBranch',
                        device: device1,
                    });

                    await waitAsync();

                    expect(connection.sentMessages.slice(1)).toEqual([
                        {
                            name: WATCH_BRANCH,
                            data: {
                                branch: 'testBranch-player-device1SessionId',
                                temporary: true,
                                protocol: 'updates',
                                siteId: expect.any(String),
                            },
                        },
                        {
                            name: UNWATCH_BRANCH,
                            data: 'testBranch-player-device1SessionId',
                        },
                    ]);
                });

                it('should remove all the bots that were part of the player branch when the device disconnects', async () => {
                    partition.connect();

                    await waitAsync();

                    deviceConnected.next({
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: device1,
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
                        branch: 'testBranch-player-device1SessionId',
                        updates: [update],
                        initial: true,
                    });

                    await waitAsync();

                    deviceDisconnected.next({
                        broadcast: false,
                        branch: 'testBranch',
                        device: device1,
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
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                            protocol: 'updates',
                        },
                        device: device1,
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

                    const tag1 = atom(
                        atomId('device1', 2),
                        null,
                        tagMask('test1', 'abc')
                    );
                    const value1 = atom(
                        atomId('device1', 3),
                        tag1,
                        value('def')
                    );

                    addUpdates.next({
                        branch: 'testBranch-player-device1SessionId',
                        updates: [update],
                        initial: true,
                    });

                    await waitAsync();

                    deviceDisconnected.next({
                        broadcast: false,
                        branch: 'testBranch',
                        device: device1,
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
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: device1,
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
                    const userDevice = deviceInfo(
                        'username',
                        'username',
                        'test'
                    );

                    deviceConnected.next({
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: userDevice,
                    });

                    await waitAsync();

                    expect(connection.sentMessages.slice(1)).toEqual([]);
                });

                it('should not ignore the server user', async () => {
                    partition.connect();

                    await waitAsync();
                    const serverDevice = deviceInfo(
                        'Server',
                        'Server',
                        'server'
                    );

                    deviceConnected.next({
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                            protocol: 'updates',
                        },
                        device: serverDevice,
                    });

                    await waitAsync();

                    expect(connection.sentMessages.slice(1)).toEqual([
                        {
                            name: WATCH_BRANCH,
                            data: {
                                branch: 'testBranch-player-server',
                                temporary: true,
                                protocol: 'updates',
                                siteId: expect.any(String),
                            },
                        },
                    ]);
                });

                it('should handle when two connected events are recieved from the same device', async () => {
                    partition.connect();

                    await waitAsync();

                    deviceConnected.next({
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: device1,
                    });

                    deviceConnected.next({
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: device1,
                    });

                    await waitAsync();

                    expect(connection.sentMessages.slice(1)).toEqual([
                        {
                            name: WATCH_BRANCH,
                            data: {
                                branch: 'testBranch-player-device1SessionId',
                                temporary: true,
                                siteId: expect.any(String),
                                protocol: 'updates',
                            },
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
                        broadcast: false,
                        branch: 'testBranch',
                        device: device1,
                    });

                    deviceDisconnected.next({
                        broadcast: false,
                        branch: 'testBranch',
                        device: device1,
                    });

                    await waitAsync();

                    expect(connection.sentMessages.slice(1)).toEqual([]);
                    expect(partition.state).toEqual({});
                });

                it('should handle when a device is connected and disconnected at the same time', async () => {
                    partition.connect();

                    await waitAsync();

                    deviceConnected.next({
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: device1,
                    });

                    deviceDisconnected.next({
                        broadcast: false,
                        branch: 'testBranch',
                        device: device1,
                    });

                    await waitAsync();

                    expect(connection.sentMessages.slice(1)).toEqual([
                        {
                            name: WATCH_BRANCH,
                            data: {
                                branch: 'testBranch-player-device1SessionId',
                                temporary: true,
                                siteId: expect.any(String),
                                protocol: 'updates',
                            },
                        },
                        {
                            name: UNWATCH_BRANCH,
                            data: 'testBranch-player-device1SessionId',
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
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: device1,
                    });

                    deviceConnected.next({
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: device2,
                    });

                    deviceConnected.next({
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: device3,
                    });

                    await waitAsync();

                    expect(connection.sentMessages.slice(1)).toEqual([
                        {
                            name: WATCH_BRANCH,
                            data: {
                                branch: 'testBranch-player-device1SessionId',
                                temporary: true,
                                siteId: expect.any(String),
                                protocol: 'updates',
                            },
                        },
                        {
                            name: WATCH_BRANCH,
                            data: {
                                branch: 'testBranch-player-device2SessionId',
                                temporary: true,
                                siteId: expect.any(String),
                                protocol: 'updates',
                            },
                        },
                        {
                            name: WATCH_BRANCH,
                            data: {
                                branch: 'testBranch-player-device3SessionId',
                                temporary: true,
                                siteId: expect.any(String),
                                protocol: 'updates',
                            },
                        },
                    ]);

                    deviceDisconnected.next({
                        broadcast: false,
                        branch: 'testBranch',
                        device: device2,
                    });

                    deviceDisconnected.next({
                        broadcast: false,
                        branch: 'testBranch',
                        device: device1,
                    });

                    deviceDisconnected.next({
                        broadcast: false,
                        branch: 'testBranch',
                        device: device3,
                    });

                    await waitAsync();

                    expect(connection.sentMessages.slice(4)).toEqual([
                        {
                            name: UNWATCH_BRANCH,
                            data: 'testBranch-player-device2SessionId',
                        },
                        {
                            name: UNWATCH_BRANCH,
                            data: 'testBranch-player-device1SessionId',
                        },
                        {
                            name: UNWATCH_BRANCH,
                            data: 'testBranch-player-device3SessionId',
                        },
                    ]);
                });

                it('should not send unwatch events when the connection is lost', async () => {
                    partition.connect();

                    await waitAsync();

                    deviceConnected.next({
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: device1,
                    });

                    deviceConnected.next({
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: device2,
                    });

                    deviceConnected.next({
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: device3,
                    });

                    await waitAsync();

                    expect(connection.sentMessages.slice(1)).toEqual([
                        {
                            name: WATCH_BRANCH,
                            data: {
                                branch: 'testBranch-player-device1SessionId',
                                temporary: true,
                                siteId: expect.any(String),
                                protocol: 'updates',
                            },
                        },
                        {
                            name: WATCH_BRANCH,
                            data: {
                                branch: 'testBranch-player-device2SessionId',
                                temporary: true,
                                siteId: expect.any(String),
                                protocol: 'updates',
                            },
                        },
                        {
                            name: WATCH_BRANCH,
                            data: {
                                branch: 'testBranch-player-device3SessionId',
                                temporary: true,
                                siteId: expect.any(String),
                                protocol: 'updates',
                            },
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
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: device1,
                    });

                    deviceConnected.next({
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: device2,
                    });

                    deviceConnected.next({
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: device3,
                    });

                    await waitAsync();

                    expect(connection.sentMessages.slice(1)).toEqual([
                        {
                            name: WATCH_BRANCH,
                            data: {
                                branch: 'testBranch-player-device1SessionId',
                                temporary: true,
                                siteId: expect.any(String),
                                protocol: 'updates',
                            },
                        },
                        {
                            name: WATCH_BRANCH,
                            data: {
                                branch: 'testBranch-player-device2SessionId',
                                temporary: true,
                                siteId: expect.any(String),
                                protocol: 'updates',
                            },
                        },
                        {
                            name: WATCH_BRANCH,
                            data: {
                                branch: 'testBranch-player-device3SessionId',
                                temporary: true,
                                siteId: expect.any(String),
                                protocol: 'updates',
                            },
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
                            name: WATCH_BRANCH_DEVICES,
                            data: 'testBranch',
                        },
                    ]);
                });

                it('should use the specified space', async () => {
                    tempPartition.space = partition.space = 'test';
                    partition.connect();

                    await waitAsync();

                    deviceConnected.next({
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                            protocol: 'updates',
                        },
                        device: device1,
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
                    const device1 = deviceInfo(
                        'device1Username',
                        'device1DeviceId',
                        'device1SessionId'
                    );

                    let events = [] as Action[];
                    partition.onEvents.subscribe((e) => events.push(...e));

                    deviceConnected.next({
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: device1,
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
                    const device1 = deviceInfo(
                        'device1Username',
                        'device1DeviceId',
                        'device1SessionId'
                    );

                    let events = [] as Action[];
                    partition.onEvents.subscribe((e) => events.push(...e));

                    deviceConnected.next({
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: device1,
                    });

                    await waitAsync();

                    deviceDisconnected.next({
                        broadcast: false,
                        branch: 'testBranch',
                        device: device1,
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
        });

        function setupPartition(config: OtherPlayersRepoPartitionConfig) {
            partition = new OtherPlayersPartitionImpl(
                {
                    id: 'test',
                    name: 'name',
                    token: 'token',
                    username: 'username',
                },
                client,
                config
            );

            sub.add(partition);
            sub.add(partition.onBotsAdded.subscribe((b) => added.push(...b)));
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
