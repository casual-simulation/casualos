import {
    branchNamespace,
    ApiaryCausalRepoServer,
    isEventForDevice,
    connectionInfo,
} from './WebsocketController';
import {
    ADD_ATOMS,
    atom,
    atomId,
    atomMatchesHash,
    ATOMS_RECEIVED,
    DEVICE_CONNECTED_TO_BRANCH,
    DEVICE_DISCONNECTED_FROM_BRANCH,
    GET_UPDATES,
    RECEIVE_EVENT,
    SEND_EVENT,
    UNWATCH_BRANCH,
    UNWATCH_BRANCH_DEVICES,
    WATCH_BRANCH,
    WATCH_BRANCH_DEVICES,
    MemoryUpdatesStore,
} from '@casual-simulation/causal-trees/core2';
import { MemoryWebsocketConnectionStore } from './MemoryWebsocketConnectionStore';
import { DeviceConnection } from './WebsocketConnectionStore';
import { MemoryWebsocketMessenger } from './MemoryWebsocketMessenger';
import { RATE_LIMIT_EXCEEDED } from '@casual-simulation/causal-trees';
import {
    action,
    botAdded,
    setupServer,
    ON_WEBHOOK_ACTION_NAME,
    botRemoved,
} from '@casual-simulation/aux-common/bots';
import { createBot } from '@casual-simulation/aux-common/bots/BotCalculations';
import { v4 as uuid } from 'uuid';
import {
    bot,
    tag,
    updates,
    value,
} from '@casual-simulation/aux-common/aux-format-2';
import {
    createYjsPartition,
    YjsPartitionImpl,
} from '@casual-simulation/aux-common/partitions/YjsPartition';
import { CONNECTION_COUNT } from './WebsocketMessenger';
import { ADD_UPDATES, UPDATES_RECEIVED, SYNC_TIME } from './ExtraEvents';
import { encodeStateAsUpdate } from 'yjs';
import { fromByteArray } from 'base64-js';
import { getStateFromUpdates } from '@casual-simulation/aux-common/partitions/PartitionUtils';
import {
    device,
    deviceError,
    deviceResult,
    remote,
    remoteError,
    remoteResult,
} from './Events';

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid');

console.log = jest.fn();
console.error = jest.fn();

const device1Info: DeviceConnection = {
    userId: 'device1',
    serverConnectionId: 'device1',
    clientConnectionId: 'client-device1',
    token: 'device1',
};
const device2Info: DeviceConnection = {
    userId: 'device2',
    serverConnectionId: 'device2',
    clientConnectionId: 'client-device2',
    token: 'device2',
};
const device3Info: DeviceConnection = {
    userId: 'device3',
    serverConnectionId: 'device3',
    clientConnectionId: 'client-device3',
    token: 'device3',
};
const device4Info: DeviceConnection = {
    userId: 'device4',
    serverConnectionId: 'device4',
    clientConnectionId: 'client-device4',
    token: 'device4',
};

describe('ApiaryCausalRepoServer', () => {
    let server: ApiaryCausalRepoServer;
    let connectionStore: MemoryWebsocketConnectionStore;
    let messenger: MemoryWebsocketMessenger;
    let updateStore: MemoryUpdatesStore;

    beforeEach(() => {
        connectionStore.reset();
        messenger.reset();
        updateStore.reset();
    });

    // We initialize the server once for all the tests
    // because it should only rely on the stores for cross-request data.
    beforeAll(() => {
        connectionStore = new MemoryWebsocketConnectionStore();
        messenger = new MemoryWebsocketMessenger();
        updateStore = new MemoryUpdatesStore();
        server = new ApiaryCausalRepoServer(
            connectionStore,
            messenger,
            updateStore
        );
    });

    describe('connect()', () => {
        it('should save the given connection', async () => {
            await server.connect(device1Info);

            const connection = await connectionStore.getConnection(
                device1Info.serverConnectionId
            );
            expect(connection).toEqual(device1Info);
        });
    });

    describe('disconnect()', () => {
        it('should remove the given connection', async () => {
            await server.connect(device1Info);

            await server.disconnect('connectionId');

            const connection = await connectionStore.getConnection(
                'connectionId'
            );
            expect(connection).toBeUndefined();
        });

        it('should delete temporary updates when all devices have left the branch', async () => {
            await server.connect(device1Info);
            await server.connect(device2Info);

            await server.watchBranch(device1Info.serverConnectionId, {
                branch: 'testBranch',
                protocol: 'updates',
                temporary: true,
            });

            await server.watchBranch(device2Info.serverConnectionId, {
                branch: 'testBranch',
                protocol: 'updates',
                temporary: true,
            });

            await server.addUpdates(device2Info.serverConnectionId, {
                branch: 'testBranch',
                updates: ['111', '222'],
            });

            await server.unwatchBranch(
                device1Info.serverConnectionId,
                'testBranch'
            );

            expect(
                await updateStore.getUpdates(branchNamespace('testBranch'))
            ).toEqual({
                updates: ['111', '222'],
                timestamps: [expect.any(Number), expect.any(Number)],
            });

            await server.disconnect(device2Info.serverConnectionId);

            expect(
                await updateStore.getUpdates(branchNamespace('testBranch'))
            ).toEqual({
                updates: [],
                timestamps: [],
            });
        });
    });

    describe(WATCH_BRANCH, () => {
        describe('updates', () => {
            it('should load the given branch and send the current updates', async () => {
                await server.connect(device1Info);

                await updateStore.addUpdates(branchNamespace('testBranch'), [
                    '123',
                    '456',
                ]);

                await server.watchBranch(device1Info.serverConnectionId, {
                    branch: 'testBranch',
                    protocol: 'updates',
                });

                expect(
                    messenger.getMessages(device1Info.serverConnectionId)
                ).toEqual([
                    {
                        name: ADD_UPDATES,
                        data: {
                            branch: 'testBranch',
                            updates: ['123', '456'],
                            initial: true, // should include whether this event includes the initial data.
                        },
                    },
                ]);
            });

            it('should create a new orphan branch if the branch name does not exist', async () => {
                await server.connect(device1Info);

                await server.watchBranch(device1Info.serverConnectionId, {
                    branch: 'doesNotExist',
                    protocol: 'updates',
                });

                expect(
                    messenger.getMessages(device1Info.serverConnectionId)
                ).toEqual([
                    {
                        name: ADD_UPDATES,
                        data: {
                            branch: 'doesNotExist',
                            updates: [] as string[],
                            initial: true,
                        },
                    },
                ]);
            });

            describe('temp', () => {
                it('should load the branch like normal if the branch is temporary', async () => {
                    await server.connect(device1Info);

                    await updateStore.addUpdates(
                        branchNamespace('testBranch'),
                        ['111', '222']
                    );

                    await server.watchBranch(device1Info.serverConnectionId, {
                        branch: 'testBranch',
                        temporary: true,
                        protocol: 'updates',
                    });

                    expect(
                        messenger.getMessages(device1Info.serverConnectionId)
                    ).toEqual([
                        {
                            name: ADD_UPDATES,
                            data: {
                                branch: 'testBranch',
                                updates: ['111', '222'],
                                initial: true,
                            },
                        },
                    ]);
                });

                it('should load the updates that were added to the branch by another device', async () => {
                    await server.connect(device1Info);
                    await server.connect(device2Info);
                    await server.connect(device3Info);

                    await server.watchBranch(device1Info.serverConnectionId, {
                        branch: 'testBranch',
                        protocol: 'updates',
                        temporary: true,
                    });

                    await server.addUpdates(device1Info.serverConnectionId, {
                        branch: 'testBranch',
                        updates: ['abc', 'def'],
                    });

                    await server.watchBranch(device3Info.serverConnectionId, {
                        branch: 'testBranch',
                        protocol: 'updates',
                        temporary: true,
                    });

                    expect(
                        messenger.getMessages(device3Info.serverConnectionId)
                    ).toEqual([
                        {
                            name: ADD_UPDATES,
                            data: {
                                branch: 'testBranch',
                                updates: ['abc', 'def'],
                                initial: true,
                            },
                        },
                    ]);
                });
            });
        });
    });

    describe(UNWATCH_BRANCH, () => {
        describe('updates', () => {
            it('should stop sending new atoms to devices that have left a branch', async () => {
                await server.connect(device1Info);
                await server.connect(device2Info);

                await server.watchBranch(device1Info.serverConnectionId, {
                    branch: 'testBranch',
                    protocol: 'updates',
                });

                await server.addUpdates(device2Info.serverConnectionId, {
                    branch: 'testBranch',
                    updates: ['111', '222'],
                });

                await server.unwatchBranch(
                    device1Info.serverConnectionId,
                    'testBranch'
                );

                await server.addUpdates(device2Info.serverConnectionId, {
                    branch: 'testBranch',
                    updates: ['333', '444'],
                });

                expect(
                    messenger.getMessages(device1Info.serverConnectionId)
                ).toEqual([
                    {
                        name: ADD_UPDATES,
                        data: {
                            branch: 'testBranch',
                            updates: [],
                            initial: true,
                        },
                    },
                    {
                        name: ADD_UPDATES,
                        data: {
                            branch: 'testBranch',
                            updates: ['111', '222'],
                        },
                    },
                ]);
            });

            it('should delete temporary updates when all devices have left the branch', async () => {
                await server.connect(device1Info);
                await server.connect(device2Info);

                await server.watchBranch(device1Info.serverConnectionId, {
                    branch: 'testBranch',
                    temporary: true,
                    protocol: 'updates',
                });

                await server.watchBranch(device2Info.serverConnectionId, {
                    branch: 'testBranch',
                    temporary: true,
                    protocol: 'updates',
                });

                await server.addUpdates(device2Info.serverConnectionId, {
                    branch: 'testBranch',
                    updates: ['111', '222'],
                });

                await server.unwatchBranch(
                    device1Info.serverConnectionId,
                    'testBranch'
                );

                expect(
                    await updateStore.getUpdates(branchNamespace('testBranch'))
                ).toEqual({
                    updates: ['111', '222'],
                    timestamps: [expect.any(Number), expect.any(Number)],
                });

                await server.unwatchBranch(
                    device2Info.serverConnectionId,
                    'testBranch'
                );

                expect(
                    await updateStore.getUpdates(branchNamespace('testBranch'))
                ).toEqual({
                    updates: [],
                    timestamps: [],
                });
            });
        });
    });

    describe(GET_UPDATES, () => {
        let originalNow: any;
        let mockedNow: jest.Mock<number>;

        beforeEach(() => {
            originalNow = Date.now;
            Date.now = mockedNow = jest.fn();
        });

        afterEach(() => {
            Date.now = originalNow;
        });

        it('should load the given branch and send the current updates', async () => {
            await server.connect(device1Info);

            mockedNow.mockReturnValue(100);
            await server.addUpdates(device1Info.serverConnectionId, {
                branch: 'testBranch',
                updates: ['111', '222'],
                updateId: 0,
            });

            await server.getUpdates(
                device1Info.serverConnectionId,
                'testBranch'
            );

            expect(
                messenger.getMessages(device1Info.serverConnectionId)
            ).toEqual([
                // Server should send a atoms received event
                // back indicating which atoms it processed
                {
                    name: UPDATES_RECEIVED,
                    data: {
                        branch: 'testBranch',
                        updateId: 0,
                    },
                },

                {
                    name: ADD_UPDATES,
                    data: {
                        branch: 'testBranch',
                        updates: ['111', '222'],
                        timestamps: [100, 100],
                    },
                },
            ]);
        });

        it('should not send additional atoms that were added after the GET_UPDATES call', async () => {
            await server.connect(device1Info);

            mockedNow.mockReturnValue(100);
            await server.addUpdates(device1Info.serverConnectionId, {
                branch: 'testBranch',
                updates: ['111', '222'],
                updateId: 0,
            });

            await server.getUpdates(
                device1Info.serverConnectionId,
                'testBranch'
            );

            await server.addUpdates(device1Info.serverConnectionId, {
                branch: 'testBranch',
                updates: ['333'],
                updateId: 1,
            });

            expect(
                messenger.getMessages(device1Info.serverConnectionId)
            ).toEqual([
                // Server should send a atoms received event
                // back indicating which atoms it processed
                {
                    name: UPDATES_RECEIVED,
                    data: {
                        branch: 'testBranch',
                        updateId: 0,
                    },
                },

                {
                    name: ADD_UPDATES,
                    data: {
                        branch: 'testBranch',
                        updates: ['111', '222'],
                        timestamps: [100, 100],
                    },
                },

                // Server should send a atoms received event
                // back indicating which atoms it processed
                {
                    name: UPDATES_RECEIVED,
                    data: {
                        branch: 'testBranch',
                        updateId: 1,
                    },
                },
            ]);
        });
    });

    describe(ADD_UPDATES, () => {
        it('should add the given updates to the given branch', async () => {
            await server.connect(device1Info);

            await server.addUpdates(device1Info.serverConnectionId, {
                branch: 'testBranch',
                updates: ['111', '222'],
                updateId: 0,
            });

            await updateStore.addUpdates(branchNamespace('testBranch'), [
                '333',
            ]);

            await server.watchBranch(device1Info.serverConnectionId, {
                branch: 'testBranch',
                protocol: 'updates',
            });

            expect(
                messenger.getMessages(device1Info.serverConnectionId)
            ).toEqual([
                // Server should send a atoms received event
                // back indicating which atoms it processed
                {
                    name: UPDATES_RECEIVED,
                    data: {
                        branch: 'testBranch',
                        updateId: 0,
                    },
                },

                {
                    name: ADD_UPDATES,
                    data: {
                        branch: 'testBranch',
                        updates: ['111', '222', '333'],
                        initial: true,
                    },
                },
            ]);
        });

        it('should notify all other devices connected to the branch', async () => {
            await server.connect(device1Info);
            await server.connect(device2Info);
            await server.connect(device3Info);

            await updateStore.addUpdates(branchNamespace('testBranch'), [
                '111',
                '222',
            ]);

            await server.watchBranch(device2Info.serverConnectionId, {
                branch: 'testBranch',
                protocol: 'updates',
            });

            await server.watchBranch(device3Info.serverConnectionId, {
                branch: 'testBranch',
                protocol: 'updates',
            });

            await server.addUpdates(device1Info.serverConnectionId, {
                branch: 'testBranch',
                updates: ['333'],
            });

            expect(
                messenger.getMessages(device2Info.serverConnectionId)
            ).toEqual([
                {
                    name: ADD_UPDATES,
                    data: {
                        branch: 'testBranch',
                        updates: ['111', '222'],
                        initial: true,
                    },
                },
                {
                    name: ADD_UPDATES,
                    data: {
                        branch: 'testBranch',
                        updates: ['333'],
                    },
                },
            ]);

            expect(
                messenger.getMessages(device3Info.serverConnectionId)
            ).toEqual([
                {
                    name: ADD_UPDATES,
                    data: {
                        branch: 'testBranch',
                        updates: ['111', '222'],
                        initial: true,
                    },
                },
                {
                    name: ADD_UPDATES,
                    data: {
                        branch: 'testBranch',
                        updates: ['333'],
                    },
                },
            ]);
        });

        it('should not notify the device that sent the new atoms', async () => {
            await server.connect(device1Info);

            await updateStore.addUpdates(branchNamespace('testBranch'), [
                '111',
                '222',
            ]);

            await server.watchBranch(device1Info.serverConnectionId, {
                branch: 'testBranch',
                protocol: 'updates',
            });

            await server.addUpdates(device1Info.serverConnectionId, {
                branch: 'testBranch',
                updates: ['333'],
                updateId: 0,
            });

            expect(
                messenger.getMessages(device1Info.serverConnectionId)
            ).toEqual([
                {
                    name: ADD_UPDATES,
                    data: {
                        branch: 'testBranch',
                        updates: ['111', '222'],
                        initial: true,
                    },
                },

                // Server should send a atoms received event
                // back indicating which atoms it processed
                {
                    name: UPDATES_RECEIVED,
                    data: {
                        branch: 'testBranch',
                        updateId: 0,
                    },
                },
            ]);
        });

        it('should immediately store the added atoms', async () => {
            await server.connect(device1Info);

            await server.addUpdates(device1Info.serverConnectionId, {
                branch: 'testBranch',
                updates: ['111', '222'],
                updateId: 0,
            });

            const updates = await updateStore.getUpdates(
                branchNamespace('testBranch')
            );

            expect(updates).toEqual({
                updates: ['111', '222'],
                timestamps: [expect.any(Number), expect.any(Number)],
            });
        });

        it('should ignore when given an event with a null branch', async () => {
            await server.connect(device1Info);

            await server.addUpdates(device1Info.serverConnectionId, {
                branch: null as any,
                updates: ['111'],
            });
        });

        it('should not crash if adding atoms to a branch that does not exist', async () => {
            await server.connect(device1Info);

            await server.addUpdates(device1Info.serverConnectionId, {
                branch: 'abc',
                updates: ['111'],
            });

            expect(
                await updateStore.getUpdates(branchNamespace('abc'))
            ).toEqual({
                updates: ['111'],
                timestamps: [expect.any(Number)],
            });
        });

        it('should notify the sender if the updates were rejected because of a max inst size', async () => {
            updateStore.maxAllowedInstSize = 5;

            await server.connect(device1Info);

            await server.addUpdates(device1Info.serverConnectionId, {
                branch: 'testBranch',
                updates: ['111', '222'],
                updateId: 0,
            });

            const updates = await updateStore.getUpdates(
                branchNamespace('testBranch')
            );

            expect(updates).toEqual({
                updates: [],
                timestamps: [],
            });

            const messages = messenger.getMessages(
                device1Info.serverConnectionId
            );
            expect(messages).toEqual([
                {
                    name: UPDATES_RECEIVED,
                    data: {
                        branch: 'testBranch',
                        updateId: 0,
                        errorCode: 'max_size_reached',
                        maxBranchSizeInBytes: 5,
                        neededBranchSizeInBytes: 6,
                    },
                },
            ]);
        });

        it('should merge updates when the max size was exceeded if configured', async () => {
            updateStore.maxAllowedInstSize = 150;
            server.mergeUpdatesOnMaxSizeExceeded = true;

            let createdUpdates = [] as string[];
            let p = new YjsPartitionImpl({
                type: 'yjs',
            });

            p.doc.clientID = 9999;
            p.doc.on('update', (update: Uint8Array) => {
                createdUpdates.push(fromByteArray(update));
            });

            await p.applyEvents([
                botAdded(
                    createBot('test', {
                        abc: 'def',
                    })
                ),
                botAdded(
                    createBot('test2', {
                        abc: 'def',
                    })
                ),
                botAdded(
                    createBot('test3', {
                        abc: 'def',
                    })
                ),
            ]);
            const update = createdUpdates[0];

            console.warn(update.length);

            await server.connect(device1Info);

            await server.addUpdates(device1Info.serverConnectionId, {
                branch: 'testBranch',
                updates: [update],
                updateId: 0,
            });

            await p.applyEvents([botRemoved('test3')]);
            const update2 = createdUpdates[1];

            expect(p.state).toEqual({
                test: createBot('test', {
                    abc: 'def',
                }),
                test2: createBot('test2', {
                    abc: 'def',
                }),
            });

            const state2 = getStateFromUpdates({
                type: 'get_inst_state_from_updates',
                updates: [
                    {
                        id: 0,
                        timestamp: 0,
                        update: update,
                    },
                    {
                        id: 0,
                        timestamp: 0,
                        update: update2,
                    },
                ],
            });

            expect(state2).toEqual({
                test: createBot('test', {
                    abc: 'def',
                }),
                test2: createBot('test2', {
                    abc: 'def',
                }),
            });

            await server.addUpdates(device1Info.serverConnectionId, {
                branch: 'testBranch',
                updates: [update2],
                updateId: 1,
            });

            const updates = await updateStore.getUpdates(
                branchNamespace('testBranch')
            );

            expect(updates).toEqual({
                updates: [expect.any(String)],
                timestamps: [expect.any(Number)],
            });

            const state = getStateFromUpdates({
                type: 'get_inst_state_from_updates',
                updates: [
                    {
                        id: 0,
                        timestamp:
                            updates.timestamps[updates.timestamps.length - 1],
                        update: updates.updates[updates.updates.length - 1],
                    },
                ],
            });

            expect(state).toEqual({
                test: createBot('test', {
                    abc: 'def',
                }),
                test2: createBot('test2', {
                    abc: 'def',
                }),
            });

            const messages = messenger.getMessages(
                device1Info.serverConnectionId
            );
            expect(messages).toEqual([
                {
                    name: UPDATES_RECEIVED,
                    data: {
                        branch: 'testBranch',
                        updateId: 0,
                    },
                },
                {
                    name: UPDATES_RECEIVED,
                    data: {
                        branch: 'testBranch',
                        updateId: 1,
                    },
                },
            ]);
        });
    });

    describe(SEND_EVENT, () => {
        it('should notify the device that the event was sent to', async () => {
            await server.connect(device1Info);
            await server.connect(device2Info);
            await server.connect(device3Info);

            await server.watchBranch(device2Info.serverConnectionId, {
                branch: 'testBranch',
            });

            await server.watchBranch(device3Info.serverConnectionId, {
                branch: 'testBranch',
            });

            await server.sendEvent(device1Info.serverConnectionId, {
                branch: 'testBranch',
                action: remote(
                    {
                        type: 'abc',
                    },
                    {
                        connectionId: device3Info.clientConnectionId,
                    }
                ),
            });

            expect(
                messenger.getMessages(device2Info.serverConnectionId)
            ).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [],
                        initial: true,
                    },
                },
            ]);
            expect(
                messenger.getMessages(device3Info.serverConnectionId)
            ).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [],
                        initial: true,
                    },
                },
                {
                    name: RECEIVE_EVENT,
                    data: {
                        branch: 'testBranch',
                        action: device(connectionInfo(device1Info), {
                            type: 'abc',
                        }),
                    },
                },
            ]);
        });

        it('should send remote events to a random device if none is specified', async () => {
            await server.connect(device1Info);
            await server.connect(device2Info);
            await server.connect(device3Info);

            const randomMock = (Math.random = jest.fn());
            randomMock.mockReturnValueOnce(1 / 2);

            await server.watchBranch(device2Info.serverConnectionId, {
                branch: 'testBranch',
            });

            await server.watchBranch(device3Info.serverConnectionId, {
                branch: 'testBranch',
            });

            await server.sendEvent(device1Info.serverConnectionId, {
                branch: 'testBranch',
                action: remote({
                    type: 'abc',
                }),
            });

            expect(
                messenger.getMessages(device2Info.serverConnectionId)
            ).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [],
                        initial: true,
                    },
                },
            ]);
            expect(
                messenger.getMessages(device3Info.serverConnectionId)
            ).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [],
                        initial: true,
                    },
                },
                {
                    name: RECEIVE_EVENT,
                    data: {
                        branch: 'testBranch',
                        action: device(connectionInfo(device1Info), {
                            type: 'abc',
                        }),
                    },
                },
            ]);
        });

        it('should broadcast to all devices if broadcast is true', async () => {
            await server.connect(device1Info);
            await server.connect(device2Info);
            await server.connect(device3Info);

            await server.watchBranch(device1Info.serverConnectionId, {
                branch: 'testBranch',
            });

            await server.watchBranch(device3Info.serverConnectionId, {
                branch: 'testBranch',
            });

            await server.sendEvent(device1Info.serverConnectionId, {
                branch: 'testBranch',
                action: remote(
                    {
                        type: 'abc',
                    },
                    {
                        broadcast: true,
                    }
                ),
            });

            expect(
                messenger.getMessages(device1Info.serverConnectionId)
            ).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [],
                        initial: true,
                    },
                },
                {
                    name: RECEIVE_EVENT,
                    data: {
                        branch: 'testBranch',
                        action: device(connectionInfo(device1Info), {
                            type: 'abc',
                        }),
                    },
                },
            ]);
            expect(
                messenger.getMessages(device2Info.serverConnectionId)
            ).toEqual([]);
            expect(
                messenger.getMessages(device3Info.serverConnectionId)
            ).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [],
                        initial: true,
                    },
                },
                {
                    name: RECEIVE_EVENT,
                    data: {
                        branch: 'testBranch',
                        action: device(connectionInfo(device1Info), {
                            type: 'abc',
                        }),
                    },
                },
            ]);
        });

        it('should relay the task ID from the remote action to the device action', async () => {
            await server.connect(device1Info);
            await server.connect(device2Info);
            await server.connect(device3Info);

            await server.watchBranch(device2Info.serverConnectionId, {
                branch: 'testBranch',
            });

            await server.watchBranch(device3Info.serverConnectionId, {
                branch: 'testBranch',
            });

            await server.sendEvent(device1Info.serverConnectionId, {
                branch: 'testBranch',
                action: remote(
                    {
                        type: 'abc',
                    },
                    {
                        connectionId: device3Info.clientConnectionId,
                    },
                    undefined,
                    'task1'
                ),
            });

            expect(
                messenger.getMessages(device2Info.serverConnectionId)
            ).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [],
                        initial: true,
                    },
                },
            ]);

            expect(
                messenger.getMessages(device3Info.serverConnectionId)
            ).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [],
                        initial: true,
                    },
                },
                {
                    name: RECEIVE_EVENT,
                    data: {
                        branch: 'testBranch',
                        action: device(
                            connectionInfo(device1Info),
                            {
                                type: 'abc',
                            },
                            'task1'
                        ),
                    },
                },
            ]);
        });

        it('should convert a remote action result to a device action result', async () => {
            await server.connect(device1Info);
            await server.connect(device2Info);
            await server.connect(device3Info);

            await server.watchBranch(device2Info.serverConnectionId, {
                branch: 'testBranch',
            });

            await server.watchBranch(device3Info.serverConnectionId, {
                branch: 'testBranch',
            });

            await server.sendEvent(device1Info.serverConnectionId, {
                branch: 'testBranch',
                action: remoteResult(
                    'data',
                    {
                        connectionId: device3Info.clientConnectionId,
                    },
                    'task1'
                ),
            });

            expect(
                messenger.getMessages(device2Info.serverConnectionId)
            ).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [],
                        initial: true,
                    },
                },
            ]);
            expect(
                messenger.getMessages(device3Info.serverConnectionId)
            ).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [],
                        initial: true,
                    },
                },
                {
                    name: RECEIVE_EVENT,
                    data: {
                        branch: 'testBranch',
                        action: deviceResult(
                            connectionInfo(device1Info),
                            'data',
                            'task1'
                        ),
                    },
                },
            ]);
        });

        it('should convert a remote action error to a device action error', async () => {
            await server.connect(device1Info);
            await server.connect(device2Info);
            await server.connect(device3Info);

            await server.watchBranch(device2Info.serverConnectionId, {
                branch: 'testBranch',
            });

            await server.watchBranch(device3Info.serverConnectionId, {
                branch: 'testBranch',
            });

            await server.sendEvent(device1Info.serverConnectionId, {
                branch: 'testBranch',
                action: remoteError(
                    'data',
                    {
                        connectionId: device3Info.clientConnectionId,
                    },
                    'task1'
                ),
            });

            expect(
                messenger.getMessages(device2Info.serverConnectionId)
            ).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [],
                        initial: true,
                    },
                },
            ]);
            expect(
                messenger.getMessages(device3Info.serverConnectionId)
            ).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [],
                        initial: true,
                    },
                },
                {
                    name: RECEIVE_EVENT,
                    data: {
                        branch: 'testBranch',
                        action: deviceError(
                            connectionInfo(device1Info),
                            'data',
                            'task1'
                        ),
                    },
                },
            ]);
        });
    });

    describe(WATCH_BRANCH_DEVICES, () => {
        it('should send an event when a device connects to a branch', async () => {
            await server.connect(device1Info);
            await server.connect(device2Info);

            await server.watchBranchDevices(
                device1Info.serverConnectionId,
                'testBranch'
            );

            await server.watchBranch(device2Info.serverConnectionId, {
                branch: 'testBranch',
            });

            expect(
                messenger.getMessages(device1Info.serverConnectionId)
            ).toEqual([
                {
                    name: DEVICE_CONNECTED_TO_BRANCH,
                    data: {
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: connectionInfo(device2Info),
                    },
                },
            ]);
        });

        it('should send an event when a device unwatches a branch', async () => {
            await server.connect(device1Info);
            await server.connect(device2Info);

            await server.watchBranchDevices(
                device1Info.serverConnectionId,
                'testBranch'
            );

            await server.watchBranch(device2Info.serverConnectionId, {
                branch: 'testBranch',
            });

            await server.unwatchBranch(
                device2Info.serverConnectionId,
                'testBranch'
            );

            expect(
                messenger.getMessages(device1Info.serverConnectionId)
            ).toEqual([
                {
                    name: DEVICE_CONNECTED_TO_BRANCH,
                    data: {
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: connectionInfo(device2Info),
                    },
                },
                {
                    name: DEVICE_DISCONNECTED_FROM_BRANCH,
                    data: {
                        broadcast: false,
                        branch: 'testBranch',
                        device: connectionInfo(device2Info),
                    },
                },
            ]);
        });

        it('should send an event when a device disconnects', async () => {
            await server.connect(device1Info);
            await server.connect(device2Info);

            await server.watchBranchDevices(
                device1Info.serverConnectionId,
                'testBranch'
            );

            await server.watchBranch(device2Info.serverConnectionId, {
                branch: 'testBranch',
            });

            await server.disconnect(device2Info.serverConnectionId);

            expect(
                messenger.getMessages(device1Info.serverConnectionId)
            ).toEqual([
                {
                    name: DEVICE_CONNECTED_TO_BRANCH,
                    data: {
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: connectionInfo(device2Info),
                    },
                },
                {
                    name: DEVICE_DISCONNECTED_FROM_BRANCH,
                    data: {
                        broadcast: false,
                        branch: 'testBranch',
                        device: connectionInfo(device2Info),
                    },
                },
            ]);
        });

        it('should send events for all the currently connected devices only for the specified branch', async () => {
            await server.connect(device1Info);
            await server.connect(device2Info);
            await server.connect(device3Info);
            await server.connect(device4Info);

            await server.watchBranch(device2Info.serverConnectionId, {
                branch: 'testBranch',
            });

            await server.watchBranch(device3Info.serverConnectionId, {
                branch: 'testBranch',
            });

            await server.watchBranch(device4Info.serverConnectionId, {
                branch: 'testBranch2',
            });

            await server.watchBranchDevices(
                device1Info.serverConnectionId,
                'testBranch'
            );

            expect(
                messenger.getMessages(device1Info.serverConnectionId)
            ).toEqual([
                {
                    name: DEVICE_CONNECTED_TO_BRANCH,
                    data: {
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                            temporary: false,
                        },
                        device: connectionInfo(device2Info),
                    },
                },
                {
                    name: DEVICE_CONNECTED_TO_BRANCH,
                    data: {
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                            temporary: false,
                        },
                        device: connectionInfo(device3Info),
                    },
                },
            ]);
        });

        it('should include whether the branch is temporary when a device connects', async () => {
            await server.connect(device1Info);
            await server.connect(device2Info);

            await server.watchBranchDevices(
                device1Info.serverConnectionId,
                'testBranch'
            );

            await server.watchBranch(device2Info.serverConnectionId, {
                branch: 'testBranch',
                temporary: true,
            });

            expect(
                messenger.getMessages(device1Info.serverConnectionId)
            ).toEqual([
                {
                    name: DEVICE_CONNECTED_TO_BRANCH,
                    data: {
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                            temporary: true,
                        },
                        device: connectionInfo(device2Info),
                    },
                },
            ]);
        });
    });

    describe(UNWATCH_BRANCH_DEVICES, () => {
        it('should not send an event when stopped watching', async () => {
            await server.connect(device1Info);
            await server.connect(device2Info);

            await server.watchBranchDevices(
                device1Info.serverConnectionId,
                'testBranch'
            );
            await server.unwatchBranchDevices(
                device1Info.serverConnectionId,
                'testBranch'
            );

            await server.watchBranch(device2Info.serverConnectionId, {
                branch: 'testBranch',
            });

            expect(
                messenger.getMessages(device1Info.serverConnectionId)
            ).toEqual([]);
        });

        it('should stop watching when the device disconnects', async () => {
            await server.connect(device1Info);
            await server.connect(device2Info);

            await server.watchBranchDevices(
                device1Info.serverConnectionId,
                'testBranch'
            );

            await server.disconnect(device1Info.serverConnectionId);

            await server.connect(device1Info);

            await server.watchBranch(device2Info.serverConnectionId, {
                branch: 'testBranch',
            });

            expect(
                messenger.getMessages(device1Info.serverConnectionId)
            ).toEqual([]);
        });
    });

    describe(CONNECTION_COUNT, () => {
        it('should send a response with the number of devices', async () => {
            await server.connect(device1Info);
            await server.connect(device2Info);

            await server.deviceCount(device1Info.serverConnectionId, null);

            expect(
                messenger.getMessages(device1Info.serverConnectionId)
            ).toEqual([
                {
                    name: CONNECTION_COUNT,
                    data: {
                        branch: null,
                        count: 2,
                    },
                },
            ]);
        });

        it('should send a response with the number of devices that are connected to the given branch', async () => {
            await server.connect(device1Info);
            await server.connect(device2Info);
            await server.connect(device3Info);

            await server.watchBranch(device2Info.serverConnectionId, {
                branch: 'testBranch',
            });
            await server.watchBranch(device3Info.serverConnectionId, {
                branch: 'testBranch',
            });

            await server.deviceCount(
                device1Info.serverConnectionId,
                'testBranch'
            );

            expect(
                messenger.getMessages(device1Info.serverConnectionId)
            ).toEqual([
                {
                    name: CONNECTION_COUNT,
                    data: {
                        branch: 'testBranch',
                        count: 2,
                    },
                },
            ]);
        });
    });

    describe(SYNC_TIME, () => {
        let oldNow: typeof Date.now;
        let now: jest.Mock<number>;

        beforeEach(() => {
            oldNow = Date.now;
            Date.now = now = jest.fn();
        });

        afterEach(() => {
            Date.now = oldNow;
        });

        it('should send a response with current time', async () => {
            await server.connect(device1Info);
            await server.connect(device2Info);

            now.mockReturnValueOnce(1000).mockReturnValueOnce(2000);

            await server.syncTime(
                device1Info.serverConnectionId,
                {
                    id: 1,
                    clientRequestTime: 123,
                },
                500
            );

            expect(
                messenger.getMessages(device1Info.serverConnectionId)
            ).toEqual([
                {
                    name: SYNC_TIME,
                    data: {
                        id: 1,
                        clientRequestTime: 123,
                        serverReceiveTime: 500,
                        serverTransmitTime: 1000,
                    },
                },
            ]);
        });
    });

    describe('getBranchData()', () => {
        it('should return an empty AUX if there is no branch updates', async () => {
            const data = await server.getBranchData('testBranch');

            expect(data).toEqual({
                version: 1,
                state: {},
            });
        });

        it('should return the aux file for the given branch', async () => {
            const partition = createYjsPartition({
                type: 'yjs',
            });

            await partition.applyEvents([
                botAdded(
                    createBot('test1', {
                        abc: 'def',
                        ghi: 123,
                    })
                ),
            ]);

            const updateBytes = encodeStateAsUpdate(
                (partition as YjsPartitionImpl).doc
            );
            const updateBase64 = fromByteArray(updateBytes);

            await updateStore.addUpdates(branchNamespace('testBranch'), [
                updateBase64,
            ]);

            const data = await server.getBranchData('testBranch');

            expect(data).toEqual({
                version: 1,
                state: {
                    test1: createBot('test1', {
                        abc: 'def',
                        ghi: 123,
                    }),
                },
            });
        });
    });

    describe('webhook()', () => {
        it('should return 200 if the webhook is handled', async () => {
            const randomMock = (Math.random = jest.fn());
            randomMock.mockReturnValueOnce(0);

            await server.connect(device1Info);

            await server.watchBranch(device1Info.serverConnectionId, {
                branch: 'testBranch',
            });

            const result = await server.webhook(
                'testBranch',
                'method',
                'url',
                {
                    'Content-Type': 'application/json',
                },
                {
                    value: 'anything',
                }
            );

            expect(result).toEqual(200);
            expect(
                messenger.getMessages(device1Info.serverConnectionId)
            ).toEqual([
                {
                    name: RECEIVE_EVENT,
                    data: {
                        branch: 'testBranch',
                        action: action(ON_WEBHOOK_ACTION_NAME, null, null, {
                            method: 'method',
                            url: 'url',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            data: {
                                value: 'anything',
                            },
                        }),
                    },
                },
            ]);
        });

        it('should return 404 if there are no atoms in the branch', async () => {
            const randomMock = (Math.random = jest.fn());
            randomMock.mockReturnValueOnce(0);

            await server.connect(device1Info);

            await server.watchBranch(device1Info.serverConnectionId, {
                branch: 'testBranch',
            });

            const result = await server.webhook(
                'testBranch',
                'method',
                'url',
                {
                    'Content-Type': 'application/json',
                },
                {
                    value: 'anything',
                }
            );

            expect(result).toEqual(404);
            expect(
                messenger.getMessages(device1Info.serverConnectionId)
            ).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [],
                        initial: true,
                    },
                },
            ]);
        });

        it('should return 503 if there are no connected devices', async () => {
            const randomMock = (Math.random = jest.fn());
            randomMock.mockReturnValueOnce(0);

            await server.connect(device1Info);

            const result = await server.webhook(
                'testBranch',
                'method',
                'url',
                {
                    'Content-Type': 'application/json',
                },
                {
                    value: 'anything',
                }
            );

            expect(result).toEqual(503);
            expect(
                messenger.getMessages(device1Info.serverConnectionId)
            ).toEqual([]);
        });
    });

    describe('isEventForDevice()', () => {
        const usernameCases = [
            [true, 'matches', 'username', 'username'] as const,
            [false, 'does not match', 'username', 'no match'] as const,
        ];

        it.each(usernameCases)(
            'should return %s if the username %s',
            (expected, desc, deviceUsername, eventUsername) => {
                let device: DeviceConnection = {
                    serverConnectionId: 'connection',
                    clientConnectionId: 'sessionId',
                    userId: deviceUsername,
                    token: 'abc',
                };

                expect(
                    isEventForDevice(
                        <any>{
                            type: 'remote',
                            event: null,
                            username: eventUsername,
                        },
                        device
                    )
                ).toBe(expected);
            }
        );

        const sessionIdCases = [
            [true, 'matches', 'sessionId', 'sessionId'] as const,
            [false, 'does not match', 'sessionId', 'no match'] as const,
        ];

        it.each(sessionIdCases)(
            'should return %s if the session ID %s',
            (expected, desc, deviceSessionId, eventSessionId) => {
                let device: DeviceConnection = {
                    serverConnectionId: 'connection',
                    clientConnectionId: deviceSessionId,
                    userId: 'username',
                    token: 'abc',
                };

                expect(
                    isEventForDevice(
                        <any>{
                            type: 'remote',
                            event: null,
                            sessionId: eventSessionId,
                        },
                        device
                    )
                ).toBe(expected);
            }
        );

        const deviceIdCases = [
            [true, 'matches', 'deviceId', 'deviceId'] as const,
            [false, 'does not match', 'deviceId', 'no match'] as const,
        ];

        it.each(deviceIdCases)(
            'should return %s if the device ID %s',
            (expected, desc, deviceId, eventDeviceId) => {
                let device: DeviceConnection = {
                    serverConnectionId: 'connection',
                    clientConnectionId: 'sessionId',
                    userId: deviceId,
                    token: 'abc',
                };

                expect(
                    isEventForDevice(
                        <any>{
                            type: 'remote',
                            event: null,
                            deviceId: eventDeviceId,
                        },
                        device
                    )
                ).toBe(expected);
            }
        );

        it('should return true if broadcast is true', () => {
            let device: DeviceConnection = {
                serverConnectionId: 'connection',
                clientConnectionId: 'sessionId',
                userId: 'username',
                token: 'abc',
            };
            expect(
                isEventForDevice(
                    <any>{
                        type: 'remote',
                        event: null,
                        broadcast: true,
                    },
                    device
                )
            ).toBe(true);
        });
    });

    describe('rateLimitExceeded()', () => {
        it('should send a message to the device', async () => {
            await server.rateLimitExceeded(
                device1Info.serverConnectionId,
                1000,
                10,
                123
            );
            expect(
                messenger.getMessages(device1Info.serverConnectionId)
            ).toEqual([
                {
                    name: RATE_LIMIT_EXCEEDED,
                    data: {
                        retryAfter: 1000,
                        totalHits: 10,
                    },
                },
            ]);

            // Should store the last time the rate limit was exceeded by the connection
            const time =
                await connectionStore.getConnectionRateLimitExceededTime(
                    device1Info.serverConnectionId
                );

            expect(time).toBe(123);
        });

        it('should not send a message if the rate limit was recently exceeded', async () => {
            await connectionStore.setConnectionRateLimitExceededTime(
                device1Info.serverConnectionId,
                123
            );

            await server.rateLimitExceeded(
                device1Info.serverConnectionId,
                1000,
                10,
                200
            );
            expect(
                messenger.getMessages(device1Info.serverConnectionId)
            ).toEqual([]);

            // Should store the last time the rate limit was exceeded by the connection
            const time =
                await connectionStore.getConnectionRateLimitExceededTime(
                    device1Info.serverConnectionId
                );

            expect(time).toBe(200);
        });

        it('should send a message if it has been a second since the last time the limit was exceeded', async () => {
            await connectionStore.setConnectionRateLimitExceededTime(
                device1Info.serverConnectionId,
                1000
            );

            await server.rateLimitExceeded(
                device1Info.serverConnectionId,
                1000,
                10,
                2000
            );
            expect(
                messenger.getMessages(device1Info.serverConnectionId)
            ).toEqual([
                {
                    name: RATE_LIMIT_EXCEEDED,
                    data: {
                        retryAfter: 1000,
                        totalHits: 10,
                    },
                },
            ]);

            // Should store the last time the rate limit was exceeded by the connection
            const time =
                await connectionStore.getConnectionRateLimitExceededTime(
                    device1Info.serverConnectionId
                );

            expect(time).toBe(2000);
        });
    });
});

describe('branchNamespace()', () => {
    it('should use the default namespace for branches', () => {
        expect(branchNamespace('testBranch')).toMatchInlineSnapshot(
            `"/branch/testBranch"`
        );
    });
});