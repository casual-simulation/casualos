import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import {
    applyUpdate,
    Doc,
    encodeStateAsUpdate,
    Map as YMap,
    Text as YText,
} from 'yjs';
import { testPartitionImplementation } from './test/PartitionTests';
import { fromByteArray, toByteArray } from 'base64-js';
import { RemoteYjsPartitionImpl } from './RemoteYjsPartition';
import {
    action,
    applyUpdatesToInst,
    AsyncAction,
    asyncError,
    asyncResult,
    Bot,
    botAdded,
    botUpdated,
    createBot,
    createInitializationUpdate,
    getInstStateFromUpdates,
    InstUpdate,
    listInstUpdates,
    ON_SPACE_RATE_LIMIT_EXCEEDED_ACTION_NAME,
    ON_REMOTE_DATA_ACTION_NAME,
    ON_REMOTE_WHISPER_ACTION_NAME,
    ON_SPACE_MAX_SIZE_REACHED,
    stateUpdatedEvent,
    StateUpdatedEvent,
    unlockSpace,
    UpdatedBot,
    getCurrentInstUpdate,
} from '../bots';
import { RemoteYjsPartitionConfig } from './AuxPartitionConfig';
import { wait, waitAsync } from '../test/TestHelpers';
import { del, edit, insert, preserve } from '../bots';
import { createDocFromUpdates, getUpdates } from '../test/YjsTestHelpers';
import { flatMap } from 'lodash';
import { YjsPartitionImpl } from './YjsPartition';
import {
    AddUpdatesMessage,
    InstRecordsClient,
    MemoryConnectionClient,
    RateLimitExceededMessage,
    ReceiveDeviceActionMessage,
    UpdatesReceivedMessage,
} from '../websockets';
import {
    Action,
    CurrentVersion,
    StatusUpdate,
    connectionInfo,
    device,
    remote,
} from '../common';

console.log = jest.fn();

describe('RemoteYjsPartition', () => {
    const recordNameCases = [[null as any] as const, ['testRecord'] as const];

    describe.each(recordNameCases)('record name: %s', (recordName) => {
        testPartitionImplementation(
            async () => {
                let update: Uint8Array | null = null;

                const doc = new Doc();
                const map = doc.getMap('__test');

                doc.on('update', (u: Uint8Array) => {
                    update = u;
                });
                doc.transact(() => {
                    map.set('abc', 123);
                });

                if (!update) {
                    throw new Error('Unable to get update!');
                }

                const connection = new MemoryConnectionClient();
                const addAtoms = new BehaviorSubject<AddUpdatesMessage>({
                    type: 'repo/add_updates',
                    recordName: recordName,
                    inst: 'inst',
                    branch: 'testBranch',
                    updates: [fromByteArray(update)],
                    initial: true,
                });
                connection.events.set('repo/add_updates', addAtoms);

                const client = new InstRecordsClient(connection);
                connection.connect();

                return new RemoteYjsPartitionImpl(client, {
                    type: 'remote_yjs',
                    recordName: recordName,
                    inst: 'inst',
                    branch: 'testBranch',
                    host: 'testHost',
                });
            },
            true,
            true
        );

        describe('connection', () => {
            let connection: MemoryConnectionClient;
            let client: InstRecordsClient;
            let partition: RemoteYjsPartitionImpl;
            let receiveEvent: Subject<ReceiveDeviceActionMessage>;
            let addAtoms: Subject<AddUpdatesMessage>;
            let updatesReceived: Subject<UpdatesReceivedMessage>;
            let added: Bot[];
            let removed: string[];
            let updated: UpdatedBot[];
            let states: StateUpdatedEvent[];
            let errors: any[];
            let version: CurrentVersion;
            let sub: Subscription;

            beforeEach(async () => {
                connection = new MemoryConnectionClient();
                receiveEvent = new Subject<ReceiveDeviceActionMessage>();
                addAtoms = new Subject<AddUpdatesMessage>();
                updatesReceived = new Subject<UpdatesReceivedMessage>();
                connection.events.set('repo/receive_action', receiveEvent);
                connection.events.set('repo/add_updates', addAtoms);
                connection.events.set('repo/updates_received', updatesReceived);
                client = new InstRecordsClient(connection);
                connection.connect();
                sub = new Subscription();

                added = [];
                removed = [];
                updated = [];
                states = [];
                errors = [];

                setupPartition({
                    type: 'remote_yjs',
                    recordName: recordName,
                    inst: 'inst',
                    branch: 'testBranch',
                    host: 'testHost',
                });
            });

            afterEach(() => {
                sub.unsubscribe();
            });

            it('should return immediate for the realtimeStrategy if the partition is not static', () => {
                expect(partition.realtimeStrategy).toEqual('immediate');
            });

            it('should return delayed for the realtimeStrategy if the partition is static', () => {
                setupPartition({
                    type: 'remote_yjs',
                    recordName: recordName,
                    inst: 'inst',
                    branch: 'testBranch',
                    host: 'testHost',
                    static: true,
                });
                expect(partition.realtimeStrategy).toEqual('delayed');
            });

            it('should use the given space for bot events', async () => {
                partition.space = 'test';
                partition.connect();

                await partition.applyEvents([
                    botAdded(
                        createBot(
                            'test1',
                            {
                                abc: 'def',
                            },
                            <any>'other'
                        )
                    ),
                ]);

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
            });

            it('should use the given space for new updates', async () => {
                partition.space = 'test';
                partition.connect();

                const updates = getUpdates((doc, bots) => {
                    bots.set('bot1', new YMap([['tag1', 'abc']]));
                });

                addAtoms.next({
                    type: 'repo/add_updates',
                    recordName: recordName,
                    inst: 'inst',
                    branch: 'testBranch',
                    updates,
                    initial: true,
                });

                await waitAsync();

                expect(added).toEqual([
                    createBot(
                        'bot1',
                        {
                            tag1: 'abc',
                        },
                        <any>'test'
                    ),
                ]);
            });

            it('should send a WATCH_BRANCH event to the server', async () => {
                setupPartition({
                    type: 'remote_yjs',
                    recordName: recordName,
                    inst: 'inst',
                    branch: 'testBranch',
                    host: 'testHost',
                });

                partition.connect();

                expect(connection.sentMessages).toEqual([
                    {
                        type: 'repo/watch_branch',
                        recordName: recordName,
                        inst: 'inst',
                        branch: 'testBranch',
                    },
                ]);
            });

            describe('remote events', () => {
                it('should send the remote event to the server', async () => {
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

                    expect(connection.sentMessages).toEqual([
                        {
                            type: 'repo/send_action',
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch',
                            action: remote(
                                {
                                    type: 'def',
                                },
                                {
                                    connectionId: 'device',
                                }
                            ),
                        },
                    ]);
                });

                it('should not send the remote event if remote events are disabled', async () => {
                    setupPartition({
                        type: 'remote_yjs',
                        recordName: recordName,
                        inst: 'inst',
                        branch: 'testBranch',
                        host: 'testHost',
                        remoteEvents: false,
                    });

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

                it('should listen for device events from the connection', async () => {
                    let events = [] as Action[];
                    partition.onEvents.subscribe((e) => events.push(...e));

                    const action = device(
                        connectionInfo('username', 'device', 'session'),
                        {
                            type: 'abc',
                        }
                    );
                    partition.connect();

                    receiveEvent.next({
                        type: 'repo/receive_action',
                        recordName: recordName,
                        inst: 'inst',
                        branch: 'testBranch',
                        action: action,
                    });

                    await waitAsync();

                    expect(events).toEqual([action]);
                });

                it('should not send events when in readOnly mode', async () => {
                    setupPartition({
                        type: 'remote_yjs',
                        recordName: recordName,
                        inst: 'inst',
                        branch: 'testBranch',
                        host: 'testHost',
                        readOnly: true,
                    });

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

                it('should not send events when in static mode', async () => {
                    setupPartition({
                        type: 'remote_yjs',
                        recordName: recordName,
                        inst: 'inst',
                        branch: 'testBranch',
                        host: 'testHost',
                        static: true,
                    });

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

                it('should not become synced when an event is received', async () => {
                    let events = [] as Action[];
                    partition.onEvents.subscribe((e) => events.push(...e));

                    const action = device(
                        connectionInfo('username', 'device', 'session'),
                        {
                            type: 'abc',
                        }
                    );

                    let statuses: StatusUpdate[] = [];
                    sub.add(
                        partition.onStatusUpdated.subscribe((update) =>
                            statuses.push(update)
                        )
                    );

                    partition.connect();

                    receiveEvent.next({
                        type: 'repo/receive_action',
                        recordName: recordName,
                        inst: 'inst',
                        branch: 'testBranch',
                        action: action,
                    });

                    await waitAsync();

                    expect(statuses).toEqual([
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
                    ]);
                });

                describe('device', () => {
                    it('should set the playerId and taskId on the inner event', async () => {
                        let events = [] as Action[];
                        partition.onEvents.subscribe((e) => events.push(...e));

                        const action = device(
                            connectionInfo('username', 'device', 'session'),
                            {
                                type: 'abc',
                            },
                            'task1'
                        );
                        partition.connect();

                        receiveEvent.next({
                            type: 'repo/receive_action',
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch',
                            action: action,
                        });

                        await waitAsync();

                        expect(events).not.toEqual([action]);
                        expect(events).toEqual([
                            device(
                                connectionInfo('username', 'device', 'session'),
                                {
                                    type: 'abc',
                                    taskId: 'task1',
                                    playerId: 'session',
                                } as AsyncAction,
                                'task1'
                            ),
                        ]);
                    });
                });

                describe('action', () => {
                    it('should translate a remote shout to a onRemoteWhisper event', async () => {
                        let events = [] as Action[];
                        partition.onEvents.subscribe((e) => events.push(...e));

                        partition.connect();

                        const info1 = connectionInfo(
                            'info1Username',
                            'info1DeviceId',
                            'info1SessionId'
                        );
                        receiveEvent.next({
                            type: 'repo/receive_action',
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch',
                            action: {
                                type: 'device',
                                connection: info1,
                                event: action('eventName', null, null, {
                                    abc: 'def',
                                }),
                            },
                        });

                        await waitAsync();

                        expect(events).toEqual([
                            action(ON_REMOTE_DATA_ACTION_NAME, null, null, {
                                name: 'eventName',
                                that: { abc: 'def' },
                                remoteId: 'info1SessionId',
                            }),
                            action(ON_REMOTE_WHISPER_ACTION_NAME, null, null, {
                                name: 'eventName',
                                that: { abc: 'def' },
                                playerId: 'info1SessionId',
                            }),
                        ]);
                    });

                    it('should ignore the bot IDs and userId', async () => {
                        let events = [] as Action[];
                        partition.onEvents.subscribe((e) => events.push(...e));

                        partition.connect();

                        const info1 = connectionInfo(
                            'info1Username',
                            'info1DeviceId',
                            'info1SessionId'
                        );
                        receiveEvent.next({
                            type: 'repo/receive_action',
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch',
                            action: {
                                type: 'device',
                                connection: info1,
                                event: action('eventName', ['abc'], 'userId', {
                                    abc: 'def',
                                }),
                            },
                        });

                        await waitAsync();

                        expect(events).toEqual([
                            action(ON_REMOTE_DATA_ACTION_NAME, null, null, {
                                name: 'eventName',
                                that: { abc: 'def' },
                                remoteId: 'info1SessionId',
                            }),
                            action(ON_REMOTE_WHISPER_ACTION_NAME, null, null, {
                                name: 'eventName',
                                that: { abc: 'def' },
                                playerId: 'info1SessionId',
                            }),
                        ]);
                    });
                });

                describe('list_inst_updates', () => {
                    it('should send a list_inst_updates event to the server', async () => {
                        setupPartition({
                            type: 'remote_yjs',
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch',
                            host: 'testHost',
                        });
                        const addUpdates = new Subject<AddUpdatesMessage>();
                        connection.events.set('repo/add_updates', addUpdates);

                        partition.connect();

                        await waitAsync();

                        await partition.sendRemoteEvents([
                            remote(
                                listInstUpdates(),
                                undefined,
                                undefined,
                                'task1'
                            ),
                        ]);

                        await waitAsync();

                        const events = [] as Action[];
                        partition.onEvents.subscribe((e) => events.push(...e));

                        expect(connection.sentMessages).toContainEqual({
                            type: 'repo/get_updates',
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch',
                        });

                        addUpdates.next({
                            type: 'repo/add_updates',
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch',
                            updates: ['abc', 'def'],
                        });

                        await waitAsync();

                        expect(events).toEqual([
                            asyncResult('task1', [
                                {
                                    id: 0,
                                    update: 'abc',
                                },
                                {
                                    id: 1,
                                    update: 'def',
                                },
                            ]),
                        ]);
                    });
                });

                describe('get_inst_state_from_updates', () => {
                    it('should return the state matching the given updates', async () => {
                        setupPartition({
                            type: 'remote_yjs',
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch',
                            host: 'testHost',
                        });

                        partition.connect();

                        await partition.applyEvents([
                            botAdded(
                                createBot('test1', {
                                    abc: 'def',
                                    num: 123,
                                })
                            ),
                        ]);

                        await partition.applyEvents([
                            botUpdated('test1', {
                                tags: {
                                    num: 456,
                                },
                            }),
                        ]);

                        await waitAsync();

                        const updates = connection.sentMessages.filter(
                            (message) => message.type === 'repo/add_updates'
                        );
                        expect(updates).toHaveLength(2);

                        const instUpdates = flatMap(
                            updates,
                            (u) => (u as AddUpdatesMessage).updates
                        ).map((u, i) => ({
                            id: i,
                            update: u,
                        }));

                        const instTimestamps = flatMap(
                            updates,
                            (u) => (u as AddUpdatesMessage).timestamps ?? []
                        );

                        const finalUpdates = instUpdates.map((u) => ({
                            id: u.id,
                            update: u.update,
                            timestamp: instTimestamps[u.id],
                        }));

                        expect(instUpdates).toHaveLength(2);

                        const events = [] as Action[];
                        partition.onEvents.subscribe((e) => events.push(...e));

                        await partition.sendRemoteEvents([
                            remote(
                                getInstStateFromUpdates(
                                    finalUpdates.slice(0, 1)
                                ),
                                undefined,
                                undefined,
                                'task1'
                            ),
                            remote(
                                getInstStateFromUpdates(finalUpdates),
                                undefined,
                                undefined,
                                'task2'
                            ),
                        ]);

                        await waitAsync();

                        expect(events).toEqual([
                            asyncResult(
                                'task1',
                                {
                                    test1: createBot('test1', {
                                        abc: 'def',
                                        num: 123,
                                    }),
                                },
                                false
                            ),
                            asyncResult(
                                'task2',
                                {
                                    test1: createBot('test1', {
                                        abc: 'def',
                                        num: 456,
                                    }),
                                },
                                false
                            ),
                        ]);
                    });
                });

                describe('create_initialization_update', () => {
                    it('should return an update that represents the bots', async () => {
                        setupPartition({
                            type: 'remote_yjs',
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch',
                            host: 'testHost',
                        });

                        partition.connect();

                        const events = [] as Action[];
                        partition.onEvents.subscribe((e) => events.push(...e));

                        await waitAsync();

                        await partition.sendRemoteEvents([
                            remote(
                                createInitializationUpdate([
                                    createBot('test1', {
                                        abc: 'def',
                                    }),
                                    createBot('test2', {
                                        num: 123,
                                    }),
                                ]),
                                undefined,
                                undefined,
                                'task1'
                            ),
                        ]);

                        await waitAsync();

                        expect(events).toEqual([
                            asyncResult(
                                'task1',
                                {
                                    id: 0,
                                    timestamp: expect.any(Number),
                                    update: expect.any(String),
                                },
                                false
                            ),
                        ]);

                        const event = events[0] as any;
                        const update = event.result.update;

                        const validationPartition = new YjsPartitionImpl({
                            type: 'yjs',
                        });
                        applyUpdate(
                            validationPartition.doc,
                            toByteArray(update)
                        );

                        expect(validationPartition.state).toEqual({
                            test1: createBot('test1', {
                                abc: 'def',
                            }),
                            test2: createBot('test2', {
                                num: 123,
                            }),
                        });
                    });
                });

                describe('apply_updates_to_inst', () => {
                    it('should add the update to the inst', async () => {
                        setupPartition({
                            type: 'remote_yjs',
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch',
                            host: 'testHost',
                        });

                        partition.connect();

                        const events = [] as Action[];
                        partition.onEvents.subscribe((e) => events.push(...e));

                        const testPartition = new YjsPartitionImpl({
                            type: 'yjs',
                        });
                        const updates = [] as InstUpdate[];

                        testPartition.doc.on('update', (update: Uint8Array) => {
                            updates.push({
                                id: updates.length,
                                timestamp: Date.now(),
                                update: fromByteArray(update),
                            });
                        });

                        testPartition.applyEvents([
                            botAdded(
                                createBot('test1', {
                                    abc: 'def',
                                })
                            ),
                            botAdded(
                                createBot('test2', {
                                    num: 124,
                                })
                            ),
                        ]);

                        await waitAsync();

                        expect(updates).not.toEqual([]);

                        await partition.sendRemoteEvents([
                            remote(
                                applyUpdatesToInst([...updates]),
                                undefined,
                                undefined,
                                'task1'
                            ),
                        ]);

                        await waitAsync();

                        expect(events).toEqual([
                            asyncResult('task1', null, false),
                        ]);

                        expect(partition.state).toEqual({
                            test1: createBot('test1', {
                                abc: 'def',
                            }),
                            test2: createBot('test2', {
                                num: 124,
                            }),
                        });

                        const addedAtoms = connection.sentMessages.filter(
                            (m) => m.type === 'repo/add_updates'
                        );
                        expect(addedAtoms).toEqual([
                            {
                                type: 'repo/add_updates',
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                                updates: updates.map((u) => u.update),
                                updateId: 1,
                            },
                        ]);
                    });

                    it('should support updates from v13.5.24 of yjs', async () => {
                        setupPartition({
                            type: 'remote_yjs',
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch',
                            host: 'testHost',
                        });

                        partition.connect();

                        const events = [] as Action[];
                        partition.onEvents.subscribe((e) => events.push(...e));

                        await waitAsync();

                        await partition.sendRemoteEvents([
                            remote(
                                applyUpdatesToInst([
                                    {
                                        id: 0,
                                        timestamp: 0,
                                        update: 'AQLNrtWDBQAnAQRib3RzBGJvdDEBKADNrtWDBQAEdGFnMQF3A2FiYwA=',
                                    },
                                ]),
                                undefined,
                                undefined,
                                'task1'
                            ),
                        ]);

                        await waitAsync();

                        expect(events).toEqual([
                            asyncResult('task1', null, false),
                        ]);

                        expect(partition.state).toEqual({
                            bot1: createBot('bot1', {
                                tag1: 'abc',
                            }),
                        });
                    });
                });

                describe('get_current_inst_update', () => {
                    it('should return the current doc state as an update', async () => {
                        setupPartition({
                            type: 'remote_yjs',
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch',
                            host: 'testHost',
                        });

                        partition.connect();

                        await partition.applyEvents([
                            botAdded(
                                createBot('test1', {
                                    abc: 'def',
                                })
                            ),
                            botAdded(
                                createBot('test2', {
                                    num: 124,
                                })
                            ),
                        ]);

                        await waitAsync();

                        const events = [] as Action[];
                        partition.onEvents.subscribe((e) => events.push(...e));

                        await partition.sendRemoteEvents([
                            remote(
                                getCurrentInstUpdate(),
                                undefined,
                                undefined,
                                'task1'
                            ),
                        ]);

                        await waitAsync();

                        const expectedUpdate = fromByteArray(
                            encodeStateAsUpdate(partition.doc)
                        );

                        expect(events).toEqual([
                            asyncResult(
                                'task1',
                                {
                                    id: 0,
                                    timestamp: expect.any(Number),
                                    update: expectedUpdate,
                                },
                                false
                            ),
                        ]);
                    });
                });

                describe('rate_limit_exceeded', () => {
                    it('should emit a shout when the event is recieved', async () => {
                        setupPartition({
                            type: 'remote_yjs',
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch',
                            host: 'testHost',
                        });

                        partition.space = 'test';
                        const rateLimitExceeded =
                            new Subject<RateLimitExceededMessage>();
                        connection.events.set(
                            'rate_limit_exceeded',
                            rateLimitExceeded
                        );

                        partition.connect();

                        const events = [] as Action[];
                        partition.onEvents.subscribe((e) => events.push(...e));

                        await waitAsync();

                        rateLimitExceeded.next({
                            type: 'rate_limit_exceeded',
                            retryAfter: 123,
                            totalHits: 999,
                        });

                        await waitAsync();

                        expect(events).toEqual([
                            action(
                                ON_SPACE_RATE_LIMIT_EXCEEDED_ACTION_NAME,
                                undefined,
                                undefined,
                                {
                                    space: 'test',
                                }
                            ),
                        ]);
                    });
                });
            });

            describe('remote updates', () => {
                it('should add the given updates to the tree and update the state', async () => {
                    partition.connect();

                    const updates = getUpdates((doc, bots) => {
                        bots.set('bot1', new YMap([['tag1', 'abc']]));
                    });

                    addAtoms.next({
                        type: 'repo/add_updates',
                        recordName: recordName,
                        inst: 'inst',
                        branch: 'testBranch',
                        updates,
                        initial: true,
                    });
                    await waitAsync();

                    expect(added).toEqual([
                        createBot('bot1', {
                            tag1: 'abc',
                        }),
                    ]);
                });
            });

            describe('updates', () => {
                it('should not send new updates to the server if in readOnly mode', async () => {
                    setupPartition({
                        type: 'remote_yjs',
                        recordName: recordName,
                        inst: 'inst',
                        branch: 'testBranch',
                        host: 'testHost',
                        readOnly: true,
                    });

                    partition.connect();

                    await partition.applyEvents([botAdded(createBot('bot1'))]);
                    await waitAsync();

                    expect(connection.sentMessages.slice(1)).toEqual([]);
                });

                it('should not send new updates to the server if in static mode', async () => {
                    setupPartition({
                        type: 'remote_yjs',
                        recordName: recordName,
                        inst: 'inst',
                        branch: 'testBranch',
                        host: 'testHost',
                        static: true,
                    });

                    partition.connect();

                    await partition.applyEvents([botAdded(createBot('bot1'))]);
                    await waitAsync();

                    expect(connection.sentMessages.slice(1)).toEqual([]);
                });

                it('should handle an ADD_UPDATES event without any updates', async () => {
                    setupPartition({
                        type: 'remote_yjs',
                        recordName: recordName,
                        inst: 'inst',
                        branch: 'testBranch',
                        host: 'testHost',
                        static: true,
                    });

                    partition.connect();

                    addAtoms.next({
                        type: 'repo/add_updates',
                        recordName: recordName,
                        inst: 'inst',
                        branch: 'testBranch',
                        updates: [],
                    });
                    await waitAsync();

                    expect(errors).toEqual([]);
                });

                it('should send new updates to the server', async () => {
                    setupPartition({
                        type: 'remote_yjs',
                        recordName: recordName,
                        inst: 'inst',
                        branch: 'testBranch',
                        host: 'testHost',
                    });

                    partition.connect();

                    await partition.applyEvents([
                        botAdded(
                            createBot('test1', {
                                abc: 123,
                            })
                        ),
                    ]);
                    await waitAsync();

                    expect(connection.sentMessages.slice(1).length).toBe(1);

                    const addUpdatesMessage = connection.sentMessages[1];
                    expect(addUpdatesMessage.type).toEqual('repo/add_updates');
                    expect((addUpdatesMessage as any).branch).toEqual(
                        'testBranch'
                    );

                    const doc = createDocFromUpdates(
                        (addUpdatesMessage as any).updates
                    );
                    const bots = doc.getMap('bots');
                    expect(bots.size).toBe(1);

                    const bot: any = bots.get('test1');
                    expect(bot).not.toBeUndefined();
                    expect(bot.size).toBe(1);
                    expect(bot.get('abc')).toBe(123);
                });

                it('should not store null values on new bots', async () => {
                    setupPartition({
                        type: 'remote_yjs',
                        recordName: recordName,
                        inst: 'inst',
                        branch: 'testBranch',
                        host: 'testHost',
                    });

                    partition.connect();

                    await partition.applyEvents([
                        botAdded(
                            createBot('test1', {
                                abc: null,
                                def: 123,
                            })
                        ),
                    ]);
                    await waitAsync();

                    expect(connection.sentMessages.slice(1).length).toBe(1);

                    const addUpdatesMessage = connection.sentMessages[1];
                    expect(addUpdatesMessage.type).toEqual('repo/add_updates');
                    expect((addUpdatesMessage as any).branch).toEqual(
                        'testBranch'
                    );

                    const doc = createDocFromUpdates(
                        (addUpdatesMessage as any).updates
                    );
                    const bots = doc.getMap('bots');
                    expect(bots.size).toBe(1);

                    const bot: any = bots.get('test1');
                    expect(bot).not.toBeUndefined();
                    expect(bot.size).toBe(1);
                    expect(bot.has('abc')).toBe(false);
                    expect(bot.get('def')).toBe(123);
                });

                it('should be able to load existing bots', async () => {
                    setupPartition({
                        type: 'remote_yjs',
                        recordName: recordName,
                        inst: 'inst',
                        branch: 'testBranch',
                        host: 'testHost',
                    });

                    partition.connect();

                    const updates = getUpdates((doc, bots) => {
                        bots.set(
                            'bot1',
                            new YMap([
                                ['string', 'abc'],
                                ['number', 123],
                                ['boolean', true],
                                [
                                    'object',
                                    {
                                        abc: 'def',
                                    },
                                ],
                                ['array', [123, true]],
                                ['null', null],
                                ['undefined', undefined],
                                ['empty', ''],
                            ])
                        );
                        bots.set(
                            'bot2',
                            new YMap([
                                ['string', 'abc'],
                                ['number', 123],
                                ['boolean', true],
                                [
                                    'object',
                                    {
                                        abc: 'def',
                                    },
                                ],
                                ['array', [123, true]],
                                ['null', null],
                                ['undefined', undefined],
                                ['empty', ''],
                            ])
                        );
                    });

                    addAtoms.next({
                        type: 'repo/add_updates',
                        recordName: recordName,
                        inst: 'inst',
                        branch: 'testBranch',
                        updates,
                        initial: true,
                    });

                    await waitAsync();

                    expect(partition.state).toEqual({
                        bot1: createBot('bot1', {
                            string: 'abc',
                            number: 123,
                            boolean: true,
                            object: {
                                abc: 'def',
                            },
                            array: [123, true],
                        }),
                        bot2: createBot('bot2', {
                            string: 'abc',
                            number: 123,
                            boolean: true,
                            object: {
                                abc: 'def',
                            },
                            array: [123, true],
                        }),
                    });
                });

                it('should not load null values from existing bots', async () => {
                    setupPartition({
                        type: 'remote_yjs',
                        recordName: recordName,
                        inst: 'inst',
                        branch: 'testBranch',
                        host: 'testHost',
                    });

                    partition.connect();

                    const updates = getUpdates((doc, bots) => {
                        bots.set('bot1', new YMap([['tag1', null]]));
                    });

                    addAtoms.next({
                        type: 'repo/add_updates',
                        recordName: recordName,
                        inst: 'inst',
                        branch: 'testBranch',
                        updates,
                        initial: true,
                    });

                    await waitAsync();

                    expect(partition.state).toEqual({
                        bot1: createBot('bot1', {}),
                    });
                });

                it('should not try to send remote updates to the server', async () => {
                    setupPartition({
                        type: 'remote_yjs',
                        recordName: recordName,
                        inst: 'inst',
                        branch: 'testBranch',
                        host: 'testHost',
                    });

                    partition.connect();

                    const updates = getUpdates((doc, bots) => {
                        bots.set('bot1', new YMap([['tag1', 'abc']]));
                    });

                    addAtoms.next({
                        type: 'repo/add_updates',
                        recordName: recordName,
                        inst: 'inst',
                        branch: 'testBranch',
                        updates,
                        initial: true,
                    });

                    await waitAsync();

                    expect(connection.sentMessages.slice(1).length).toBe(0);
                });

                it('should treat remote tag edits as remote', async () => {
                    partition.connect();

                    addAtoms.next({
                        type: 'repo/add_updates',
                        recordName: recordName,
                        inst: 'inst',
                        branch: 'testBranch',
                        updates: [],
                        initial: true,
                    });

                    const partitionUpdates = [] as string[];
                    partition.onUpdates.subscribe((u) =>
                        partitionUpdates.push(...u)
                    );

                    await partition.applyEvents([
                        botAdded(
                            createBot('test1', {
                                abc: 'a',
                            })
                        ),
                    ]);

                    await waitAsync();

                    partition.onStateUpdated.subscribe((s) => states.push(s));

                    const doc = createDocFromUpdates(partitionUpdates);
                    let update: Uint8Array = new Uint8Array();
                    doc.on('update', (u: Uint8Array) => {
                        update = u;
                    });

                    doc.transact(() => {
                        const bots = doc.getMap('bots');
                        const bot: any = bots.get('test1');
                        const tagText: YText = bot.get('abc');
                        tagText.insert(1, 'bc');
                    });

                    addAtoms.next({
                        type: 'repo/add_updates',
                        recordName: recordName,
                        inst: 'inst',
                        branch: 'testBranch',
                        updates: [fromByteArray(update)],
                    });

                    await waitAsync();

                    expect(states.slice(1)).toEqual([
                        stateUpdatedEvent(
                            {
                                test1: {
                                    tags: {
                                        abc: edit(
                                            {
                                                [doc.clientID.toString()]:
                                                    expect.any(Number),
                                            },
                                            preserve(1),
                                            insert('bc')
                                        ),
                                    },
                                },
                            },
                            version
                        ),
                    ]);
                });

                it('should use 0 for the edit version when the site has no changes', async () => {
                    setupPartition({
                        type: 'remote_yjs',
                        recordName: recordName,
                        inst: 'inst',
                        branch: 'testBranch',
                        host: 'testHost',
                    });

                    partition.connect();

                    const updates = getUpdates((doc, bots) => {
                        bots.set(
                            'bot1',
                            new YMap([['tag1', new YText('abc')]])
                        );
                    });

                    addAtoms.next({
                        type: 'repo/add_updates',
                        recordName: recordName,
                        inst: 'inst',
                        branch: 'testBranch',
                        updates,
                        initial: true,
                    });

                    await waitAsync();

                    let version: CurrentVersion | null = null;
                    sub.add(
                        partition.onVersionUpdated.subscribe(
                            (v) => (version = v)
                        )
                    );
                    partition.onStateUpdated.subscribe((s) => states.push(s));

                    // @ts-ignore
                    const editVersion = { ...version.vector };
                    await partition.applyEvents([
                        botUpdated('bot1', {
                            tags: {
                                tag1: edit(editVersion, del(1)),
                            },
                        }),
                    ]);

                    await waitAsync();

                    expect(partition.state).toEqual({
                        bot1: createBot('bot1', {
                            tag1: 'bc',
                        }),
                    });

                    // @ts-ignore
                    expect(states[1].state.bot1.tags.tag1.version).toEqual({
                        // @ts-ignore
                        [version.currentSite]: 0,
                    });
                });
            });

            describe('errors', () => {
                describe('max_size_reached', () => {
                    it('should emit a onSpaceMaxSizeReached shout', async () => {
                        let events = [] as Action[];
                        partition.onEvents.subscribe((e) => events.push(...e));
                        partition.space = 'shared';

                        partition.connect();

                        updatesReceived.next({
                            type: 'repo/updates_received',
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch',
                            updateId: 1,
                            errorCode: 'max_size_reached',
                            maxBranchSizeInBytes: 10,
                            neededBranchSizeInBytes: 11,
                        });
                        await waitAsync();

                        expect(events).toEqual([
                            action(ON_SPACE_MAX_SIZE_REACHED, null, null, {
                                space: 'shared',
                                maxSizeInBytes: 10,
                                neededSizeInBytes: 11,
                            }),
                        ]);
                    });

                    it('should only emit the onSpaceMaxSizeReached shout once', async () => {
                        let events = [] as Action[];
                        partition.onEvents.subscribe((e) => events.push(...e));
                        partition.space = 'shared';

                        partition.connect();

                        updatesReceived.next({
                            type: 'repo/updates_received',
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch',
                            updateId: 1,
                            errorCode: 'max_size_reached',
                            maxBranchSizeInBytes: 10,
                            neededBranchSizeInBytes: 11,
                        });
                        await waitAsync();

                        updatesReceived.next({
                            type: 'repo/updates_received',
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch',
                            updateId: 2,
                            errorCode: 'max_size_reached',
                            maxBranchSizeInBytes: 25,
                            neededBranchSizeInBytes: 99,
                        });

                        await waitAsync();

                        expect(events).toEqual([
                            action(ON_SPACE_MAX_SIZE_REACHED, null, null, {
                                space: 'shared',
                                maxSizeInBytes: 10,
                                neededSizeInBytes: 11,
                            }),
                        ]);
                    });
                });
            });

            describe('static mode', () => {
                it('should send a GET_UPDATES event when in static mode', async () => {
                    setupPartition({
                        type: 'remote_yjs',
                        recordName: recordName,
                        inst: 'inst',
                        branch: 'testBranch',
                        host: 'testHost',
                        static: true,
                    });

                    expect(connection.sentMessages).toEqual([]);
                    partition.connect();

                    await waitAsync();

                    expect(connection.sentMessages).toEqual([
                        {
                            type: 'repo/get_updates',
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch',
                        },
                    ]);
                });

                it('should not apply updates to the causal tree', async () => {
                    setupPartition({
                        type: 'remote_yjs',
                        recordName: recordName,
                        inst: 'inst',
                        branch: 'testBranch',
                        host: 'testHost',
                        static: true,
                    });

                    expect(connection.sentMessages).toEqual([]);
                    partition.connect();

                    const ret = await partition.applyEvents([
                        botAdded(
                            createBot('test', {
                                abc: 'def',
                            })
                        ),
                    ]);

                    expect(ret).toEqual([]);
                    expect(partition.state).toEqual({});
                });

                it('should load the initial state properly', async () => {
                    setupPartition({
                        type: 'remote_yjs',
                        recordName: recordName,
                        inst: 'inst',
                        branch: 'testBranch',
                        host: 'testHost',
                        static: true,
                    });

                    const updates = getUpdates((doc, bots) => {
                        bots.set('bot1', new YMap([['tag1', 'abc']]));
                    });

                    partition.connect();

                    addAtoms.next({
                        type: 'repo/add_updates',
                        recordName: recordName,
                        inst: 'inst',
                        branch: 'testBranch',
                        updates,
                    });

                    expect(partition.state).toEqual({
                        bot1: createBot('bot1', {
                            tag1: 'abc',
                        }),
                    });
                });

                it('should not try to connect if it is not already connected', async () => {
                    setupPartition({
                        type: 'remote_yjs',
                        recordName: recordName,
                        inst: 'inst',
                        branch: 'testBranch',
                        host: 'testHost',
                        static: true,
                        readOnly: true,
                    });

                    await partition.applyEvents([unlockSpace('admin', '3342')]);

                    expect(
                        connection.sentMessages.filter(
                            (e) => e.type === 'repo/watch_branch'
                        ).length
                    ).toEqual(0);
                });
            });

            describe('temporary', () => {
                it('should load the given branch as temporary', async () => {
                    setupPartition({
                        type: 'remote_yjs',
                        recordName: recordName,
                        inst: 'inst',
                        branch: 'testBranch',
                        host: 'testHost',
                        temporary: true,
                    });

                    partition.connect();

                    await waitAsync();

                    expect(connection.sentMessages).toEqual([
                        {
                            type: 'repo/watch_branch',
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch',
                            temporary: true,
                        },
                    ]);
                });
            });

            function setupPartition(config: RemoteYjsPartitionConfig) {
                partition = new RemoteYjsPartitionImpl(client, config);

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
                sub.add(partition.onError.subscribe((e) => errors.push(e)));
                sub.add(
                    partition.onVersionUpdated.subscribe((v) => (version = v))
                );
            }
        });
    });
});
