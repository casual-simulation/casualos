import {
    branchNamespace,
    WebsocketController,
    isEventForDevice,
    connectionInfo,
} from './WebsocketController';
import { MemoryUpdatesStore } from '@casual-simulation/causal-trees/core2';
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
    createYjsPartition,
    YjsPartitionImpl,
} from '@casual-simulation/aux-common/partitions/YjsPartition';
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
} from '../common/RemoteActions';
import { WebsocketEventTypes } from './WebsocketEvents';
import { createTestControllers, createTestUser } from '../TestUtils';
import { generateV1ConnectionToken } from '../AuthUtils';

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid');

console.log = jest.fn();
console.error = jest.fn();

const device1Info: DeviceConnection = {
    userId: 'device1',
    serverConnectionId: 'device1',
    clientConnectionId: 'client-device1',
    sessionId: 'test',
    token: 'device1',
};
const device2Info: DeviceConnection = {
    userId: 'device2',
    serverConnectionId: 'device2',
    clientConnectionId: 'client-device2',
    sessionId: 'test2',
    token: 'device2',
};
const device3Info: DeviceConnection = {
    userId: 'device3',
    serverConnectionId: 'device3',
    clientConnectionId: 'client-device3',
    sessionId: 'test3',
    token: 'device3',
};
const device4Info: DeviceConnection = {
    userId: 'device4',
    serverConnectionId: 'device4',
    clientConnectionId: 'client-device4',
    sessionId: 'test4',
    token: 'device4',
};

describe('WebsocketController', () => {
    let server: WebsocketController;
    let connectionStore: MemoryWebsocketConnectionStore;
    let messenger: MemoryWebsocketMessenger;
    let updateStore: MemoryUpdatesStore;
    let services: ReturnType<typeof createTestControllers>;

    let userId: string;
    let sessionKey: string;
    let sessionId: string;
    let connectionKey: string;
    let connectionToken: string;
    const serverConnectionId = 'serverConnection';
    const connectionId = 'connectionId';
    const inst = 'inst';
    const recordName = 'record';

    let user1Info: DeviceConnection;

    beforeEach(async () => {
        services = createTestControllers();
        connectionStore = new MemoryWebsocketConnectionStore();
        messenger = new MemoryWebsocketMessenger();
        updateStore = new MemoryUpdatesStore();
        server = new WebsocketController(
            connectionStore,
            messenger,
            updateStore,
            services.auth
        );

        uuidMock.mockReturnValueOnce('userId');
        const user = await createTestUser(services);

        userId = user.userId;
        sessionKey = user.sessionKey;
        connectionKey = user.connectionKey;
        sessionId = user.sessionId;

        connectionToken = generateV1ConnectionToken(
            connectionKey,
            connectionId,
            recordName,
            inst
        );

        user1Info = {
            serverConnectionId,
            clientConnectionId: connectionId,
            userId,
            sessionId,
            token: connectionToken,
        };
    });

    describe('login()', () => {
        it('should validate the token and update the connection info', async () => {
            await server.login(serverConnectionId, 1, {
                type: 'login',
                connectionToken,
            });

            const connection = await connectionStore.getConnection(
                serverConnectionId
            );

            expect(connection).toEqual({
                serverConnectionId: serverConnectionId,
                clientConnectionId: connectionId,
                token: connectionToken,
                userId: userId,
                sessionId: sessionId,
            });
        });

        it('should allow the connection when no token is specified', async () => {
            await server.login(serverConnectionId, 1, {
                type: 'login',
                connectionToken: null as any,
                clientConnectionId: connectionId,
            });

            const connection = await connectionStore.getConnection(
                serverConnectionId
            );

            expect(connection).toEqual({
                serverConnectionId: serverConnectionId,
                clientConnectionId: connectionId,
                token: null,
                userId: null,
                sessionId: null,
            });
        });

        it('should send a unacceptable_connection_token error if the token is wrong', async () => {
            await server.login(serverConnectionId, 1, {
                type: 'login',
                connectionToken: 'wrong token',
            });

            const events = messenger.getEvents(serverConnectionId);
            expect(events).toEqual([
                [
                    WebsocketEventTypes.Error,
                    1,
                    'unacceptable_connection_token',
                    'The given connection token is invalid. It must be a correctly formatted string.',
                ],
            ]);

            const connection = await connectionStore.getConnection(
                serverConnectionId
            );

            expect(connection).toBeFalsy();
        });
    });

    describe('disconnect()', () => {
        it('should remove the given connection', async () => {
            await connectionStore.saveConnection(user1Info);

            await server.disconnect('connectionId');

            const connection = await connectionStore.getConnection(
                'connectionId'
            );
            expect(connection).toBeUndefined();
        });

        it('should delete temporary updates when all devices have left the branch', async () => {
            await connectionStore.saveConnection(device1Info);
            await connectionStore.saveConnection(device2Info);

            await server.watchBranch(device1Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst: 'inst',
                branch: 'testBranch',
                temporary: true,
            });

            await server.watchBranch(device2Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst: 'inst',
                branch: 'testBranch',
                temporary: true,
            });

            await server.addUpdates(device2Info.serverConnectionId, {
                type: 'repo/add_updates',
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

    describe('repo/watch_branch', () => {
        describe('updates', () => {
            it('should load the given branch and send the current updates', async () => {
                await connectionStore.saveConnection(device1Info);

                await updateStore.addUpdates(branchNamespace('testBranch'), [
                    '123',
                    '456',
                ]);

                await server.watchBranch(device1Info.serverConnectionId, {
                    type: 'repo/watch_branch',
                    recordName: null,
                    inst: 'inst',
                    branch: 'testBranch',
                });

                expect(
                    messenger.getMessages(device1Info.serverConnectionId)
                ).toEqual([
                    {
                        type: 'repo/add_updates',
                        branch: 'testBranch',
                        updates: ['123', '456'],
                        initial: true, // should include whether this event includes the initial data.
                    },
                ]);
            });

            it('should create a new orphan branch if the branch name does not exist', async () => {
                await connectionStore.saveConnection(device1Info);

                await server.watchBranch(device1Info.serverConnectionId, {
                    type: 'repo/watch_branch',
                    recordName: null,
                    inst: 'inst',
                    branch: 'doesNotExist',
                });

                expect(
                    messenger.getMessages(device1Info.serverConnectionId)
                ).toEqual([
                    {
                        type: 'repo/add_updates',
                        branch: 'doesNotExist',
                        updates: [] as string[],
                        initial: true,
                    },
                ]);
            });

            describe('temp', () => {
                it('should load the branch like normal if the branch is temporary', async () => {
                    await connectionStore.saveConnection(device1Info);

                    await updateStore.addUpdates(
                        branchNamespace('testBranch'),
                        ['111', '222']
                    );

                    await server.watchBranch(device1Info.serverConnectionId, {
                        type: 'repo/watch_branch',
                        recordName: null,
                        inst: 'inst',
                        branch: 'testBranch',
                        temporary: true,
                    });

                    expect(
                        messenger.getMessages(device1Info.serverConnectionId)
                    ).toEqual([
                        {
                            type: 'repo/add_updates',
                            branch: 'testBranch',
                            updates: ['111', '222'],
                            initial: true,
                        },
                    ]);
                });

                it('should load the updates that were added to the branch by another device', async () => {
                    await connectionStore.saveConnection(device1Info);
                    await connectionStore.saveConnection(device2Info);
                    await connectionStore.saveConnection(device3Info);

                    await server.watchBranch(device1Info.serverConnectionId, {
                        type: 'repo/watch_branch',
                        recordName: null,
                        inst: 'inst',
                        branch: 'testBranch',
                        temporary: true,
                    });

                    await server.addUpdates(device1Info.serverConnectionId, {
                        type: 'repo/add_updates',
                        branch: 'testBranch',
                        updates: ['abc', 'def'],
                    });

                    await server.watchBranch(device3Info.serverConnectionId, {
                        type: 'repo/watch_branch',
                        recordName: null,
                        inst: 'inst',
                        branch: 'testBranch',
                        temporary: true,
                    });

                    expect(
                        messenger.getMessages(device3Info.serverConnectionId)
                    ).toEqual([
                        {
                            type: 'repo/add_updates',
                            branch: 'testBranch',
                            updates: ['abc', 'def'],
                            initial: true,
                        },
                    ]);
                });
            });
        });
    });

    describe('repo/unwatch_branch', () => {
        describe('updates', () => {
            it('should stop sending new atoms to devices that have left a branch', async () => {
                await connectionStore.saveConnection(device1Info);
                await connectionStore.saveConnection(device2Info);

                await server.watchBranch(device1Info.serverConnectionId, {
                    type: 'repo/watch_branch',
                    recordName: null,
                    inst: 'inst',
                    branch: 'testBranch',
                    protocol: 'updates',
                });

                await server.addUpdates(device2Info.serverConnectionId, {
                    type: 'repo/add_updates',
                    branch: 'testBranch',
                    updates: ['111', '222'],
                });

                await server.unwatchBranch(
                    device1Info.serverConnectionId,
                    'testBranch'
                );

                await server.addUpdates(device2Info.serverConnectionId, {
                    type: 'repo/add_updates',
                    branch: 'testBranch',
                    updates: ['333', '444'],
                });

                expect(
                    messenger.getMessages(device1Info.serverConnectionId)
                ).toEqual([
                    {
                        type: 'repo/add_updates',
                        branch: 'testBranch',
                        updates: [],
                        initial: true,
                    },
                    {
                        type: 'repo/add_updates',
                        branch: 'testBranch',
                        updates: ['111', '222'],
                    },
                ]);
            });

            it('should delete temporary updates when all devices have left the branch', async () => {
                await connectionStore.saveConnection(device1Info);
                await connectionStore.saveConnection(device2Info);

                await server.watchBranch(device1Info.serverConnectionId, {
                    type: 'repo/watch_branch',
                    recordName: null,
                    inst: 'inst',
                    branch: 'testBranch',
                    temporary: true,
                    protocol: 'updates',
                });

                await server.watchBranch(device2Info.serverConnectionId, {
                    type: 'repo/watch_branch',
                    recordName: null,
                    inst: 'inst',
                    branch: 'testBranch',
                    temporary: true,
                    protocol: 'updates',
                });

                await server.addUpdates(device2Info.serverConnectionId, {
                    type: 'repo/add_updates',
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

    describe('repo/get_updates', () => {
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
            await connectionStore.saveConnection(device1Info);

            mockedNow.mockReturnValue(100);
            await server.addUpdates(device1Info.serverConnectionId, {
                type: 'repo/add_updates',
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
                    type: 'repo/updates_received',
                    branch: 'testBranch',
                    updateId: 0,
                },

                {
                    type: 'repo/add_updates',
                    branch: 'testBranch',
                    updates: ['111', '222'],
                    timestamps: [100, 100],
                },
            ]);
        });

        it('should not send additional atoms that were added after the GET_UPDATES call', async () => {
            await connectionStore.saveConnection(device1Info);

            mockedNow.mockReturnValue(100);
            await server.addUpdates(device1Info.serverConnectionId, {
                type: 'repo/add_updates',
                branch: 'testBranch',
                updates: ['111', '222'],
                updateId: 0,
            });

            await server.getUpdates(
                device1Info.serverConnectionId,
                'testBranch'
            );

            await server.addUpdates(device1Info.serverConnectionId, {
                type: 'repo/add_updates',
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
                    type: 'repo/updates_received',
                    branch: 'testBranch',
                    updateId: 0,
                },

                {
                    type: 'repo/add_updates',
                    branch: 'testBranch',
                    updates: ['111', '222'],
                    timestamps: [100, 100],
                },

                // Server should send a atoms received event
                // back indicating which atoms it processed
                {
                    type: 'repo/updates_received',
                    branch: 'testBranch',
                    updateId: 1,
                },
            ]);
        });
    });

    describe('repo/add_updates', () => {
        it('should add the given updates to the given branch', async () => {
            await connectionStore.saveConnection(device1Info);

            await server.addUpdates(device1Info.serverConnectionId, {
                type: 'repo/add_updates',
                branch: 'testBranch',
                updates: ['111', '222'],
                updateId: 0,
            });

            await updateStore.addUpdates(branchNamespace('testBranch'), [
                '333',
            ]);

            await server.watchBranch(device1Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst: 'inst',
                branch: 'testBranch',
                protocol: 'updates',
            });

            expect(
                messenger.getMessages(device1Info.serverConnectionId)
            ).toEqual([
                // Server should send a atoms received event
                // back indicating which atoms it processed
                {
                    type: 'repo/updates_received',
                    branch: 'testBranch',
                    updateId: 0,
                },

                {
                    type: 'repo/add_updates',
                    branch: 'testBranch',
                    updates: ['111', '222', '333'],
                    initial: true,
                },
            ]);
        });

        it('should notify all other devices connected to the branch', async () => {
            await connectionStore.saveConnection(device1Info);
            await connectionStore.saveConnection(device2Info);
            await connectionStore.saveConnection(device3Info);

            await updateStore.addUpdates(branchNamespace('testBranch'), [
                '111',
                '222',
            ]);

            await server.watchBranch(device2Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst: 'inst',
                branch: 'testBranch',
                protocol: 'updates',
            });

            await server.watchBranch(device3Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst: 'inst',
                branch: 'testBranch',
                protocol: 'updates',
            });

            await server.addUpdates(device1Info.serverConnectionId, {
                type: 'repo/add_updates',
                branch: 'testBranch',
                updates: ['333'],
            });

            expect(
                messenger.getMessages(device2Info.serverConnectionId)
            ).toEqual([
                {
                    type: 'repo/add_updates',
                    branch: 'testBranch',
                    updates: ['111', '222'],
                    initial: true,
                },
                {
                    type: 'repo/add_updates',
                    branch: 'testBranch',
                    updates: ['333'],
                },
            ]);

            expect(
                messenger.getMessages(device3Info.serverConnectionId)
            ).toEqual([
                {
                    type: 'repo/add_updates',
                    branch: 'testBranch',
                    updates: ['111', '222'],
                    initial: true,
                },
                {
                    type: 'repo/add_updates',
                    branch: 'testBranch',
                    updates: ['333'],
                },
            ]);
        });

        it('should not notify the device that sent the new atoms', async () => {
            await connectionStore.saveConnection(device1Info);

            await updateStore.addUpdates(branchNamespace('testBranch'), [
                '111',
                '222',
            ]);

            await server.watchBranch(device1Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst: 'inst',
                branch: 'testBranch',
                protocol: 'updates',
            });

            await server.addUpdates(device1Info.serverConnectionId, {
                type: 'repo/add_updates',
                branch: 'testBranch',
                updates: ['333'],
                updateId: 0,
            });

            expect(
                messenger.getMessages(device1Info.serverConnectionId)
            ).toEqual([
                {
                    type: 'repo/add_updates',
                    branch: 'testBranch',
                    updates: ['111', '222'],
                    initial: true,
                },

                // Server should send a atoms received event
                // back indicating which atoms it processed
                {
                    type: 'repo/updates_received',
                    branch: 'testBranch',
                    updateId: 0,
                },
            ]);
        });

        it('should immediately store the added atoms', async () => {
            await connectionStore.saveConnection(device1Info);

            await server.addUpdates(device1Info.serverConnectionId, {
                type: 'repo/add_updates',
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
            await connectionStore.saveConnection(device1Info);

            await server.addUpdates(device1Info.serverConnectionId, {
                type: 'repo/add_updates',
                branch: null as any,
                updates: ['111'],
            });
        });

        it('should not crash if adding atoms to a branch that does not exist', async () => {
            await connectionStore.saveConnection(device1Info);

            await server.addUpdates(device1Info.serverConnectionId, {
                type: 'repo/add_updates',
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

            await connectionStore.saveConnection(device1Info);

            await server.addUpdates(device1Info.serverConnectionId, {
                type: 'repo/add_updates',
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
                    type: 'repo/updates_received',
                    branch: 'testBranch',
                    updateId: 0,
                    errorCode: 'max_size_reached',
                    maxBranchSizeInBytes: 5,
                    neededBranchSizeInBytes: 6,
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

            await connectionStore.saveConnection(device1Info);

            await server.addUpdates(device1Info.serverConnectionId, {
                type: 'repo/add_updates',
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
                type: 'repo/add_updates',
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
                    type: 'repo/updates_received',
                    branch: 'testBranch',
                    updateId: 0,
                },
                {
                    type: 'repo/updates_received',
                    branch: 'testBranch',
                    updateId: 1,
                },
            ]);
        });
    });

    describe('repo/send_event', () => {
        it('should notify the device that the event was sent to', async () => {
            await connectionStore.saveConnection(device1Info);
            await connectionStore.saveConnection(device2Info);
            await connectionStore.saveConnection(device3Info);

            await server.watchBranch(device2Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst: 'inst',
                branch: 'testBranch',
            });

            await server.watchBranch(device3Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst: 'inst',
                branch: 'testBranch',
            });

            await server.sendAction(device1Info.serverConnectionId, {
                type: 'repo/send_action',
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
                    type: 'repo/add_updates',
                    branch: 'testBranch',
                    updates: [],
                    initial: true,
                },
            ]);
            expect(
                messenger.getMessages(device3Info.serverConnectionId)
            ).toEqual([
                {
                    type: 'repo/add_updates',
                    branch: 'testBranch',
                    updates: [],
                    initial: true,
                },
                {
                    type: 'repo/receive_action',
                    branch: 'testBranch',
                    action: device(connectionInfo(device1Info), {
                        type: 'abc',
                    }),
                },
            ]);
        });

        it('should send remote events to a random device if none is specified', async () => {
            const originalRandom = Math.random;
            try {
                await connectionStore.saveConnection(device1Info);
                await connectionStore.saveConnection(device2Info);
                await connectionStore.saveConnection(device3Info);

                const randomMock = (Math.random = jest.fn());
                randomMock.mockReturnValueOnce(1 / 2);

                await server.watchBranch(device2Info.serverConnectionId, {
                    type: 'repo/watch_branch',
                    recordName: null,
                    inst: 'inst',
                    branch: 'testBranch',
                });

                await server.watchBranch(device3Info.serverConnectionId, {
                    type: 'repo/watch_branch',
                    recordName: null,
                    inst: 'inst',
                    branch: 'testBranch',
                });

                await server.sendAction(device1Info.serverConnectionId, {
                    type: 'repo/send_action',
                    branch: 'testBranch',
                    action: remote({
                        type: 'abc',
                    }),
                });

                expect(
                    messenger.getMessages(device2Info.serverConnectionId)
                ).toEqual([
                    {
                        type: 'repo/add_updates',
                        branch: 'testBranch',
                        updates: [],
                        initial: true,
                    },
                ]);
                expect(
                    messenger.getMessages(device3Info.serverConnectionId)
                ).toEqual([
                    {
                        type: 'repo/add_updates',
                        branch: 'testBranch',
                        updates: [],
                        initial: true,
                    },
                    {
                        type: 'repo/receive_action',
                        branch: 'testBranch',
                        action: device(connectionInfo(device1Info), {
                            type: 'abc',
                        }),
                    },
                ]);
            } finally {
                Math.random = originalRandom;
            }
        });

        it('should broadcast to all devices if broadcast is true', async () => {
            await connectionStore.saveConnection(device1Info);
            await connectionStore.saveConnection(device2Info);
            await connectionStore.saveConnection(device3Info);

            await server.watchBranch(device1Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst: 'inst',
                branch: 'testBranch',
            });

            await server.watchBranch(device3Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst: 'inst',
                branch: 'testBranch',
            });

            await server.sendAction(device1Info.serverConnectionId, {
                type: 'repo/send_action',
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
                    type: 'repo/add_updates',
                    branch: 'testBranch',
                    updates: [],
                    initial: true,
                },
                {
                    type: 'repo/receive_action',
                    branch: 'testBranch',
                    action: device(connectionInfo(device1Info), {
                        type: 'abc',
                    }),
                },
            ]);
            expect(
                messenger.getMessages(device2Info.serverConnectionId)
            ).toEqual([]);
            expect(
                messenger.getMessages(device3Info.serverConnectionId)
            ).toEqual([
                {
                    type: 'repo/add_updates',
                    branch: 'testBranch',
                    updates: [],
                    initial: true,
                },
                {
                    type: 'repo/receive_action',
                    branch: 'testBranch',
                    action: device(connectionInfo(device1Info), {
                        type: 'abc',
                    }),
                },
            ]);
        });

        it('should relay the task ID from the remote action to the device action', async () => {
            await connectionStore.saveConnection(device1Info);
            await connectionStore.saveConnection(device2Info);
            await connectionStore.saveConnection(device3Info);

            await server.watchBranch(device2Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst: 'inst',
                branch: 'testBranch',
            });

            await server.watchBranch(device3Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst: 'inst',
                branch: 'testBranch',
            });

            await server.sendAction(device1Info.serverConnectionId, {
                type: 'repo/send_action',
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
                    type: 'repo/add_updates',
                    branch: 'testBranch',
                    updates: [],
                    initial: true,
                },
            ]);

            expect(
                messenger.getMessages(device3Info.serverConnectionId)
            ).toEqual([
                {
                    type: 'repo/add_updates',
                    branch: 'testBranch',
                    updates: [],
                    initial: true,
                },
                {
                    type: 'repo/receive_action',
                    branch: 'testBranch',
                    action: device(
                        connectionInfo(device1Info),
                        {
                            type: 'abc',
                        },
                        'task1'
                    ),
                },
            ]);
        });

        it('should convert a remote action result to a device action result', async () => {
            await connectionStore.saveConnection(device1Info);
            await connectionStore.saveConnection(device2Info);
            await connectionStore.saveConnection(device3Info);

            await server.watchBranch(device2Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst: 'inst',
                branch: 'testBranch',
            });

            await server.watchBranch(device3Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst: 'inst',
                branch: 'testBranch',
            });

            await server.sendAction(device1Info.serverConnectionId, {
                type: 'repo/send_action',
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
                    type: 'repo/add_updates',
                    branch: 'testBranch',
                    updates: [],
                    initial: true,
                },
            ]);
            expect(
                messenger.getMessages(device3Info.serverConnectionId)
            ).toEqual([
                {
                    type: 'repo/add_updates',
                    branch: 'testBranch',
                    updates: [],
                    initial: true,
                },
                {
                    type: 'repo/receive_action',
                    branch: 'testBranch',
                    action: deviceResult(
                        connectionInfo(device1Info),
                        'data',
                        'task1'
                    ),
                },
            ]);
        });

        it('should convert a remote action error to a device action error', async () => {
            await connectionStore.saveConnection(device1Info);
            await connectionStore.saveConnection(device2Info);
            await connectionStore.saveConnection(device3Info);

            await server.watchBranch(device2Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst: 'inst',
                branch: 'testBranch',
            });

            await server.watchBranch(device3Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst: 'inst',
                branch: 'testBranch',
            });

            await server.sendAction(device1Info.serverConnectionId, {
                type: 'repo/send_action',
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
                    type: 'repo/add_updates',
                    branch: 'testBranch',
                    updates: [],
                    initial: true,
                },
            ]);
            expect(
                messenger.getMessages(device3Info.serverConnectionId)
            ).toEqual([
                {
                    type: 'repo/add_updates',
                    branch: 'testBranch',
                    updates: [],
                    initial: true,
                },
                {
                    type: 'repo/receive_action',
                    branch: 'testBranch',
                    action: deviceError(
                        connectionInfo(device1Info),
                        'data',
                        'task1'
                    ),
                },
            ]);
        });
    });

    describe('repo/watch_branch_connections', () => {
        it('should send an event when a device connects to a branch', async () => {
            await connectionStore.saveConnection(device1Info);
            await connectionStore.saveConnection(device2Info);

            await server.watchBranchDevices(
                device1Info.serverConnectionId,
                'testBranch'
            );

            await server.watchBranch(device2Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst: 'inst',
                branch: 'testBranch',
            });

            expect(
                messenger.getMessages(device1Info.serverConnectionId)
            ).toEqual([
                {
                    type: 'repo/connected_to_branch',
                    broadcast: false,
                    branch: {
                        type: 'repo/watch_branch',
                        branch: 'testBranch',
                    },
                    connection: connectionInfo(device2Info),
                },
            ]);
        });

        it('should send an event when a device unwatches a branch', async () => {
            await connectionStore.saveConnection(device1Info);
            await connectionStore.saveConnection(device2Info);

            await server.watchBranchDevices(
                device1Info.serverConnectionId,
                'testBranch'
            );

            await server.watchBranch(device2Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst: 'inst',
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
                    type: 'repo/connected_to_branch',
                    broadcast: false,
                    branch: {
                        type: 'repo/watch_branch',
                        branch: 'testBranch',
                    },
                    connection: connectionInfo(device2Info),
                },
                {
                    type: 'repo/disconnected_from_branch',
                    broadcast: false,
                    branch: 'testBranch',
                    connection: connectionInfo(device2Info),
                },
            ]);
        });

        it('should send an event when a device disconnects', async () => {
            await connectionStore.saveConnection(device1Info);
            await connectionStore.saveConnection(device2Info);

            await server.watchBranchDevices(
                device1Info.serverConnectionId,
                'testBranch'
            );

            await server.watchBranch(device2Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst: 'inst',
                branch: 'testBranch',
            });

            await server.disconnect(device2Info.serverConnectionId);

            expect(
                messenger.getMessages(device1Info.serverConnectionId)
            ).toEqual([
                {
                    type: 'repo/connected_to_branch',
                    broadcast: false,
                    branch: {
                        type: 'repo/watch_branch',
                        branch: 'testBranch',
                    },
                    connection: connectionInfo(device2Info),
                },
                {
                    type: 'repo/disconnected_from_branch',
                    broadcast: false,
                    branch: 'testBranch',
                    connection: connectionInfo(device2Info),
                },
            ]);
        });

        it('should send events for all the currently connected devices only for the specified branch', async () => {
            await connectionStore.saveConnection(device1Info);
            await connectionStore.saveConnection(device2Info);
            await connectionStore.saveConnection(device3Info);
            await connectionStore.saveConnection(device4Info);

            await server.watchBranch(device2Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst: 'inst',
                branch: 'testBranch',
            });

            await server.watchBranch(device3Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst: 'inst',
                branch: 'testBranch',
            });

            await server.watchBranch(device4Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst: 'inst',
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
                    type: 'repo/connected_to_branch',
                    broadcast: false,
                    branch: {
                        type: 'repo/watch_branch',
                        branch: 'testBranch',
                        temporary: false,
                    },
                    connection: connectionInfo(device2Info),
                },
                {
                    type: 'repo/connected_to_branch',
                    broadcast: false,
                    branch: {
                        type: 'repo/watch_branch',
                        branch: 'testBranch',
                        temporary: false,
                    },
                    connection: connectionInfo(device3Info),
                },
            ]);
        });

        it('should include whether the branch is temporary when a device connects', async () => {
            await connectionStore.saveConnection(device1Info);
            await connectionStore.saveConnection(device2Info);

            await server.watchBranchDevices(
                device1Info.serverConnectionId,
                'testBranch'
            );

            await server.watchBranch(device2Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst: 'inst',
                branch: 'testBranch',
                temporary: true,
            });

            expect(
                messenger.getMessages(device1Info.serverConnectionId)
            ).toEqual([
                {
                    type: 'repo/connected_to_branch',
                    broadcast: false,
                    branch: {
                        type: 'repo/watch_branch',
                        branch: 'testBranch',
                        temporary: true,
                    },
                    connection: connectionInfo(device2Info),
                },
            ]);
        });
    });

    describe('repo/unwatch_branch_connections', () => {
        it('should not send an event when stopped watching', async () => {
            await connectionStore.saveConnection(device1Info);
            await connectionStore.saveConnection(device2Info);

            await server.watchBranchDevices(
                device1Info.serverConnectionId,
                'testBranch'
            );
            await server.unwatchBranchDevices(
                device1Info.serverConnectionId,
                'testBranch'
            );

            await server.watchBranch(device2Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst: 'inst',
                branch: 'testBranch',
            });

            expect(
                messenger.getMessages(device1Info.serverConnectionId)
            ).toEqual([]);
        });

        it('should stop watching when the device disconnects', async () => {
            await connectionStore.saveConnection(device1Info);
            await connectionStore.saveConnection(device2Info);

            await server.watchBranchDevices(
                device1Info.serverConnectionId,
                'testBranch'
            );

            await server.disconnect(device1Info.serverConnectionId);

            await connectionStore.saveConnection(device1Info);

            await server.watchBranch(device2Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst: 'inst',
                branch: 'testBranch',
            });

            expect(
                messenger.getMessages(device1Info.serverConnectionId)
            ).toEqual([]);
        });
    });

    describe('repo/connection_count', () => {
        it('should send a response with the number of devices', async () => {
            await connectionStore.saveConnection(device1Info);
            await connectionStore.saveConnection(device2Info);

            await server.deviceCount(device1Info.serverConnectionId, null);

            expect(
                messenger.getMessages(device1Info.serverConnectionId)
            ).toEqual([
                {
                    type: 'repo/connection_count',
                    branch: null,
                    count: 2,
                },
            ]);
        });

        it('should send a response with the number of devices that are connected to the given branch', async () => {
            await connectionStore.saveConnection(device1Info);
            await connectionStore.saveConnection(device2Info);
            await connectionStore.saveConnection(device3Info);

            await server.watchBranch(device2Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst: 'inst',
                branch: 'testBranch',
            });
            await server.watchBranch(device3Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst: 'inst',
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
                    type: 'repo/connection_count',
                    branch: 'testBranch',
                    count: 2,
                },
            ]);
        });
    });

    describe('sync/time', () => {
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
            await connectionStore.saveConnection(device1Info);
            await connectionStore.saveConnection(device2Info);

            now.mockReturnValueOnce(1000).mockReturnValueOnce(2000);

            await server.syncTime(
                device1Info.serverConnectionId,
                {
                    type: 'sync/time',
                    id: 1,
                    clientRequestTime: 123,
                },
                500
            );

            expect(
                messenger.getMessages(device1Info.serverConnectionId)
            ).toEqual([
                {
                    type: 'sync/time/response',
                    id: 1,
                    clientRequestTime: 123,
                    serverReceiveTime: 500,
                    serverTransmitTime: 1000,
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
            const originalRandom = Math.random;
            try {
                const randomMock = (Math.random = jest.fn());
                randomMock.mockReturnValueOnce(0);

                await connectionStore.saveConnection(device1Info);

                await server.watchBranch(device1Info.serverConnectionId, {
                    type: 'repo/watch_branch',
                    recordName: null,
                    inst: 'inst',
                    branch: 'testBranch',
                });

                await updateStore.addUpdates(branchNamespace('testBranch'), [
                    'abc',
                ]);

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
                    messenger
                        .getMessages(device1Info.serverConnectionId)
                        .slice(1)
                ).toEqual([
                    {
                        type: 'repo/receive_action',
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
                ]);
            } finally {
                Math.random = originalRandom;
            }
        });

        it('should return 404 if there are no updates in the branch', async () => {
            const originalRandom = Math.random;
            try {
                const randomMock = (Math.random = jest.fn());
                randomMock.mockReturnValueOnce(0);

                await connectionStore.saveConnection(device1Info);

                await server.watchBranch(device1Info.serverConnectionId, {
                    type: 'repo/watch_branch',
                    recordName: null,
                    inst: 'inst',
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
                        type: 'repo/add_updates',
                        branch: 'testBranch',
                        updates: [],
                        initial: true,
                    },
                ]);
            } finally {
                Math.random = originalRandom;
            }
        });

        it('should return 503 if there are no connected devices', async () => {
            const originalRandom = Math.random;
            try {
                const randomMock = (Math.random = jest.fn());
                randomMock.mockReturnValueOnce(0);

                await connectionStore.saveConnection(device1Info);

                await updateStore.addUpdates(branchNamespace('testBranch'), [
                    'abc',
                ]);

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
            } finally {
                Math.random = originalRandom;
            }
        });
    });

    describe('isEventForDevice()', () => {
        const usernameCases = [
            [true, 'matches', 'username', 'username'] as const,
            [false, 'does not match', 'username', 'no match'] as const,
        ];

        it.each(usernameCases)(
            'should return %s if the user ID %s',
            (expected, desc, deviceUserId, eventUserId) => {
                let device: DeviceConnection = {
                    serverConnectionId: 'connection',
                    clientConnectionId: 'connectionId',
                    userId: deviceUserId,
                    sessionId: 'test',
                    token: 'abc',
                };

                expect(
                    isEventForDevice(
                        <any>{
                            type: 'remote',
                            event: null,
                            userId: eventUserId,
                        },
                        device
                    )
                ).toBe(expected);
            }
        );

        const connectionIdCases = [
            [true, 'matches', 'connectionId', 'connectionId'] as const,
            [false, 'does not match', 'connectionId', 'no match'] as const,
        ];

        it.each(connectionIdCases)(
            'should return %s if the connection ID %s',
            (expected, desc, deviceConnectionId, eventConnectionId) => {
                let device: DeviceConnection = {
                    serverConnectionId: 'connection',
                    clientConnectionId: deviceConnectionId,
                    userId: 'username',
                    sessionId: 'test',
                    token: 'abc',
                };

                expect(
                    isEventForDevice(
                        <any>{
                            type: 'remote',
                            event: null,
                            connectionId: eventConnectionId,
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
                    sessionId: 'test',
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
                sessionId: 'test',
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
                    type: RATE_LIMIT_EXCEEDED,
                    retryAfter: 1000,
                    totalHits: 10,
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
                    type: RATE_LIMIT_EXCEEDED,
                    retryAfter: 1000,
                    totalHits: 10,
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

    describe('uploadRequest()', () => {
        it('should get a message upload URL send an upload response to the connection', async () => {
            messenger.messageUploadUrl = 'upload_url';

            await server.uploadRequest(device1Info.serverConnectionId, 1);

            const events = messenger.getEvents(device1Info.serverConnectionId);
            expect(events).toEqual([
                [
                    WebsocketEventTypes.UploadResponse,
                    1,
                    'upload_url',
                    'POST',
                    {},
                ],
            ]);
        });

        it('should send a not_supported error if the upload URL is null', async () => {
            messenger.messageUploadUrl = null as any;

            await server.uploadRequest(device1Info.serverConnectionId, 1);

            const events = messenger.getEvents(device1Info.serverConnectionId);
            expect(events).toEqual([
                [
                    WebsocketEventTypes.Error,
                    1,
                    'not_supported',
                    'Upload requests are not supported.',
                ],
            ]);
        });
    });

    describe('downloadRequest()', () => {
        it('should try to download the message and return it', async () => {
            messenger.uploadedMessages = new Map([
                ['download_url', 'my message'],
            ]);

            const response = await server.downloadRequest(
                device1Info.serverConnectionId,
                1,
                'download_url',
                'GET',
                {}
            );

            expect(response).toEqual({
                success: true,
                requestId: 1,
                message: 'my message',
            });
            const events = messenger.getEvents(device1Info.serverConnectionId);
            expect(events).toEqual([]);
        });

        it('should return a not_supported error if the messenger does not support it', async () => {
            messenger.uploadedMessages = null as any;

            const response = await server.downloadRequest(
                device1Info.serverConnectionId,
                1,
                'download_url',
                'GET',
                {}
            );

            expect(response).toEqual({
                success: false,
                requestId: 1,
                errorCode: 'not_supported',
                errorMessage: 'Download requests are not supported.',
            });
            const events = messenger.getEvents(device1Info.serverConnectionId);
            expect(events).toEqual([]);
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
