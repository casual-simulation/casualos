import {
    WebsocketController,
    isEventForDevice,
    connectionInfo,
} from './WebsocketController';
import { MemoryWebsocketConnectionStore } from './MemoryWebsocketConnectionStore';
import { DeviceConnection } from './WebsocketConnectionStore';
import { MemoryWebsocketMessenger } from './MemoryWebsocketMessenger';
import {
    action,
    botAdded,
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
import {
    device,
    deviceError,
    deviceResult,
    remote,
    remoteError,
    remoteResult,
} from '@casual-simulation/aux-common/common/RemoteActions';
import { WebsocketEventTypes } from '@casual-simulation/aux-common/websockets/WebsocketEvents';
import { createTestControllers, createTestUser } from '../TestUtils';
import { generateV1ConnectionToken } from '../AuthUtils';
import { SplitInstRecordsStore } from './SplitInstRecordsStore';
import { TemporaryInstRecordsStore } from './TemporaryInstRecordsStore';
import { MemoryInstRecordsStore } from './MemoryInstRecordsStore';
import { MemoryTempInstRecordsStore } from './MemoryTempInstRecordsStore';
import { PUBLIC_READ_MARKER, PUBLIC_WRITE_MARKER } from '../PolicyPermissions';

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
    let instStore: SplitInstRecordsStore;
    let tempUpdatesStore: TemporaryInstRecordsStore;
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
        tempUpdatesStore = new MemoryTempInstRecordsStore();
        instStore = new SplitInstRecordsStore(
            new MemoryTempInstRecordsStore(),
            new MemoryInstRecordsStore()
        );
        server = new WebsocketController(
            connectionStore,
            messenger,
            instStore,
            tempUpdatesStore,
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

            expect(messenger.getMessages(serverConnectionId)).toEqual([
                {
                    type: 'login_result',
                    info: {
                        userId: userId,
                        sessionId: sessionId,
                        connectionId: connectionId,
                    },
                },
            ]);
        });

        it('should allow the connection when no token is specified', async () => {
            await server.login(serverConnectionId, 1, {
                type: 'login',
                connectionToken: null as any,
                connectionId: connectionId,
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

            expect(messenger.getMessages(serverConnectionId)).toEqual([
                {
                    type: 'login_result',
                    info: {
                        userId: null,
                        sessionId: null,
                        connectionId: connectionId,
                    },
                },
            ]);
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
                    null,
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
            expect(connection).toBeNull();
        });

        it('should delete temporary updates when all devices have left the branch', async () => {
            await connectionStore.saveConnection(device1Info);
            await connectionStore.saveConnection(device2Info);

            await server.watchBranch(device1Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst,
                branch: 'testBranch',
                temporary: true,
            });

            await server.watchBranch(device2Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst,
                branch: 'testBranch',
                temporary: true,
            });

            await server.addUpdates(device2Info.serverConnectionId, {
                type: 'repo/add_updates',
                recordName: null,
                inst,
                branch: 'testBranch',
                updates: ['111', '222'],
            });

            await server.unwatchBranch(
                device1Info.serverConnectionId,
                null,
                inst,
                'testBranch'
            );

            expect(
                await tempUpdatesStore.getUpdates(null, inst, 'testBranch')
            ).toEqual({
                updates: ['111', '222'],
                timestamps: [expect.any(Number), expect.any(Number)],
                instSizeInBytes: 6,
                branchSizeInBytes: 6,
            });

            await server.disconnect(device2Info.serverConnectionId);

            expect(
                await tempUpdatesStore.getUpdates(null, inst, 'testBranch')
            ).toEqual(null);
        });
    });

    describe('repo/watch_branch', () => {
        describe('updates', () => {
            it('should load the given branch and send the current updates', async () => {
                await connectionStore.saveConnection(device1Info);

                await instStore.addUpdates(
                    null,
                    inst,
                    'testBranch',
                    ['123', '456'],
                    6
                );

                await server.watchBranch(device1Info.serverConnectionId, {
                    type: 'repo/watch_branch',
                    recordName: null,
                    inst,
                    branch: 'testBranch',
                });

                expect(
                    messenger.getMessages(device1Info.serverConnectionId)
                ).toEqual([
                    {
                        type: 'repo/add_updates',
                        recordName: null,
                        inst,
                        branch: 'testBranch',
                        updates: ['123', '456'],
                        initial: true, // should include whether this event includes the initial data.
                    },
                ]);

                expect(
                    await instStore.getBranchByName(null, inst, 'testBranch')
                ).toEqual({
                    recordName: null,
                    inst,
                    branch: 'testBranch',
                    temporary: false,
                    linkedInst: null,
                });
                // Should not create an inst when the record name is null.
                expect(await instStore.getInstByName(null, inst)).toBe(null);
            });

            it('should create a new orphan branch if the branch name does not exist', async () => {
                await connectionStore.saveConnection(device1Info);

                await server.watchBranch(device1Info.serverConnectionId, {
                    type: 'repo/watch_branch',
                    recordName: null,
                    inst,
                    branch: 'doesNotExist',
                });

                expect(
                    messenger.getMessages(device1Info.serverConnectionId)
                ).toEqual([
                    {
                        type: 'repo/add_updates',
                        recordName: null,
                        inst,
                        branch: 'doesNotExist',
                        updates: [] as string[],
                        initial: true,
                    },
                ]);

                expect(
                    await instStore.getBranchByName(null, inst, 'doesNotExist')
                ).toEqual({
                    recordName: null,
                    inst,
                    branch: 'doesNotExist',
                    temporary: false,
                    linkedInst: null,
                });
                // Should not create an inst when the record name is null.
                expect(await instStore.getInstByName(null, inst)).toBe(null);
            });

            describe('temp', () => {
                it('should load the branch like normal if the branch is temporary', async () => {
                    await connectionStore.saveConnection(device1Info);

                    await tempUpdatesStore.addUpdates(
                        null,
                        inst,
                        'testBranch',
                        ['111', '222'],
                        6
                    );

                    await server.watchBranch(device1Info.serverConnectionId, {
                        type: 'repo/watch_branch',
                        recordName: null,
                        inst,
                        branch: 'testBranch',
                        temporary: true,
                    });

                    expect(
                        messenger.getMessages(device1Info.serverConnectionId)
                    ).toEqual([
                        {
                            type: 'repo/add_updates',
                            recordName: null,
                            inst,
                            branch: 'testBranch',
                            updates: ['111', '222'],
                            initial: true,
                        },
                    ]);

                    expect(
                        await instStore.getBranchByName(
                            null,
                            inst,
                            'testBranch'
                        )
                    ).toEqual({
                        recordName: null,
                        inst,
                        branch: 'testBranch',
                        temporary: true,
                        linkedInst: null,
                    });
                    // Should not create an inst when the record name is null.
                    expect(await instStore.getInstByName(null, inst)).toBe(
                        null
                    );
                });

                it('should load the updates that were added to the branch by another device', async () => {
                    await connectionStore.saveConnection(device1Info);
                    await connectionStore.saveConnection(device2Info);
                    await connectionStore.saveConnection(device3Info);

                    await server.watchBranch(device1Info.serverConnectionId, {
                        type: 'repo/watch_branch',
                        recordName: null,
                        inst,
                        branch: 'testBranch',
                        temporary: true,
                    });

                    await server.addUpdates(device1Info.serverConnectionId, {
                        type: 'repo/add_updates',
                        recordName: null,
                        inst,
                        branch: 'testBranch',
                        updates: ['abc', 'def'],
                    });

                    await server.watchBranch(device3Info.serverConnectionId, {
                        type: 'repo/watch_branch',
                        recordName: null,
                        inst,
                        branch: 'testBranch',
                        temporary: true,
                    });

                    expect(
                        messenger.getMessages(device3Info.serverConnectionId)
                    ).toEqual([
                        {
                            type: 'repo/add_updates',
                            recordName: null,
                            inst,
                            branch: 'testBranch',
                            updates: ['abc', 'def'],
                            initial: true,
                        },
                    ]);

                    expect(
                        await instStore.getBranchByName(
                            null,
                            inst,
                            'testBranch'
                        )
                    ).toEqual({
                        recordName: null,
                        inst,
                        branch: 'testBranch',
                        temporary: true,
                        linkedInst: null,
                    });

                    // Should not create an inst when the record name is null.
                    expect(await instStore.getInstByName(null, inst)).toBe(
                        null
                    );
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
                    inst,
                    branch: 'testBranch',
                    protocol: 'updates',
                });

                await server.addUpdates(device2Info.serverConnectionId, {
                    type: 'repo/add_updates',
                    recordName: null,
                    inst,
                    branch: 'testBranch',
                    updates: ['111', '222'],
                });

                await server.unwatchBranch(
                    device1Info.serverConnectionId,
                    null,
                    inst,
                    'testBranch'
                );

                await server.addUpdates(device2Info.serverConnectionId, {
                    type: 'repo/add_updates',
                    recordName: null,
                    inst,
                    branch: 'testBranch',
                    updates: ['333', '444'],
                });

                expect(
                    messenger.getMessages(device1Info.serverConnectionId)
                ).toEqual([
                    {
                        type: 'repo/add_updates',
                        recordName: null,
                        inst,
                        branch: 'testBranch',
                        updates: [],
                        initial: true,
                    },
                    {
                        type: 'repo/add_updates',
                        recordName: null,
                        inst,
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
                    inst,
                    branch: 'testBranch',
                    temporary: true,
                    protocol: 'updates',
                });

                await server.watchBranch(device2Info.serverConnectionId, {
                    type: 'repo/watch_branch',
                    recordName: null,
                    inst,
                    branch: 'testBranch',
                    temporary: true,
                    protocol: 'updates',
                });

                await server.addUpdates(device2Info.serverConnectionId, {
                    type: 'repo/add_updates',
                    recordName: null,
                    inst,
                    branch: 'testBranch',
                    updates: ['111', '222'],
                });

                await server.unwatchBranch(
                    device1Info.serverConnectionId,
                    null,
                    inst,
                    'testBranch'
                );

                expect(
                    await tempUpdatesStore.getUpdates(null, inst, 'testBranch')
                ).toEqual({
                    updates: ['111', '222'],
                    timestamps: [expect.any(Number), expect.any(Number)],
                    instSizeInBytes: 6,
                    branchSizeInBytes: 6,
                });

                await server.unwatchBranch(
                    device2Info.serverConnectionId,
                    null,
                    inst,
                    'testBranch'
                );

                expect(
                    await tempUpdatesStore.getUpdates(null, inst, 'testBranch')
                ).toEqual(null);
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
                recordName: null,
                inst,
                branch: 'testBranch',
                updates: ['111', '222'],
                updateId: 0,
            });

            await server.getUpdates(
                device1Info.serverConnectionId,
                null,
                inst,
                'testBranch'
            );

            expect(
                messenger.getMessages(device1Info.serverConnectionId)
            ).toEqual([
                // Server should send a atoms received event
                // back indicating which atoms it processed
                {
                    type: 'repo/updates_received',
                    recordName: null,
                    inst,
                    branch: 'testBranch',
                    updateId: 0,
                },

                {
                    type: 'repo/add_updates',
                    recordName: null,
                    inst,
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
                recordName: null,
                inst,
                branch: 'testBranch',
                updates: ['111', '222'],
                updateId: 0,
            });

            await server.getUpdates(
                device1Info.serverConnectionId,
                null,
                inst,
                'testBranch'
            );

            await server.addUpdates(device1Info.serverConnectionId, {
                type: 'repo/add_updates',
                recordName: null,
                inst,
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
                    recordName: null,
                    inst,
                    branch: 'testBranch',
                    updateId: 0,
                },

                {
                    type: 'repo/add_updates',
                    recordName: null,
                    inst,
                    branch: 'testBranch',
                    updates: ['111', '222'],
                    timestamps: [100, 100],
                },

                // Server should send a atoms received event
                // back indicating which atoms it processed
                {
                    type: 'repo/updates_received',
                    recordName: null,
                    inst,
                    branch: 'testBranch',
                    updateId: 1,
                },
            ]);
        });
    });

    describe('repo/add_updates', () => {
        it('should create the branch if it does not exist', async () => {
            await connectionStore.saveConnection(device1Info);

            await server.addUpdates(device1Info.serverConnectionId, {
                type: 'repo/add_updates',
                recordName: null,
                inst,
                branch: 'testBranch',
                updates: ['111', '222'],
                updateId: 0,
            });

            await instStore.addUpdates(null, inst, 'testBranch', ['333'], 3);

            await server.watchBranch(device1Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst,
                branch: 'testBranch',
                protocol: 'updates',
            });

            expect(
                await instStore.getBranchByName(null, inst, 'testBranch')
            ).toEqual({
                recordName: null,
                inst,
                branch: 'testBranch',
                temporary: false,
                linkedInst: null,
            });
            expect(
                messenger.getMessages(device1Info.serverConnectionId)
            ).toEqual([
                // Server should send a atoms received event
                // back indicating which atoms it processed
                {
                    type: 'repo/updates_received',
                    recordName: null,
                    inst,
                    branch: 'testBranch',
                    updateId: 0,
                },

                {
                    type: 'repo/add_updates',
                    recordName: null,
                    inst,
                    branch: 'testBranch',
                    updates: ['111', '222', '333'],
                    initial: true,
                },
            ]);
        });

        it('should add the given updates to the given branch', async () => {
            await connectionStore.saveConnection(device1Info);

            await server.addUpdates(device1Info.serverConnectionId, {
                type: 'repo/add_updates',
                recordName: null,
                inst,
                branch: 'testBranch',
                updates: ['111', '222'],
                updateId: 0,
            });

            await instStore.addUpdates(null, inst, 'testBranch', ['333'], 3);

            await server.watchBranch(device1Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst,
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
                    recordName: null,
                    inst,
                    branch: 'testBranch',
                    updateId: 0,
                },

                {
                    type: 'repo/add_updates',
                    recordName: null,
                    inst,
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

            await instStore.addUpdates(
                null,
                inst,
                'testBranch',
                ['111', '222'],
                6
            );

            await server.watchBranch(device2Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst,
                branch: 'testBranch',
                protocol: 'updates',
            });

            await server.watchBranch(device3Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst,
                branch: 'testBranch',
                protocol: 'updates',
            });

            await server.addUpdates(device1Info.serverConnectionId, {
                type: 'repo/add_updates',
                recordName: null,
                inst,
                branch: 'testBranch',
                updates: ['333'],
            });

            expect(
                messenger.getMessages(device2Info.serverConnectionId)
            ).toEqual([
                {
                    type: 'repo/add_updates',
                    recordName: null,
                    inst,
                    branch: 'testBranch',
                    updates: ['111', '222'],
                    initial: true,
                },
                {
                    type: 'repo/add_updates',
                    recordName: null,
                    inst,
                    branch: 'testBranch',
                    updates: ['333'],
                },
            ]);

            expect(
                messenger.getMessages(device3Info.serverConnectionId)
            ).toEqual([
                {
                    type: 'repo/add_updates',
                    recordName: null,
                    inst,
                    branch: 'testBranch',
                    updates: ['111', '222'],
                    initial: true,
                },
                {
                    type: 'repo/add_updates',
                    recordName: null,
                    inst,
                    branch: 'testBranch',
                    updates: ['333'],
                },
            ]);
        });

        it('should not notify the device that sent the new atoms', async () => {
            await connectionStore.saveConnection(device1Info);

            await instStore.addUpdates(
                null,
                inst,
                'testBranch',
                ['111', '222'],
                6
            );

            await server.watchBranch(device1Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst,
                branch: 'testBranch',
                protocol: 'updates',
            });

            await server.addUpdates(device1Info.serverConnectionId, {
                type: 'repo/add_updates',
                recordName: null,
                inst,
                branch: 'testBranch',
                updates: ['333'],
                updateId: 0,
            });

            expect(
                messenger.getMessages(device1Info.serverConnectionId)
            ).toEqual([
                {
                    type: 'repo/add_updates',
                    recordName: null,
                    inst,
                    branch: 'testBranch',
                    updates: ['111', '222'],
                    initial: true,
                },

                // Server should send a atoms received event
                // back indicating which atoms it processed
                {
                    type: 'repo/updates_received',
                    recordName: null,
                    inst,
                    branch: 'testBranch',
                    updateId: 0,
                },
            ]);
        });

        it('should immediately store the added atoms', async () => {
            await connectionStore.saveConnection(device1Info);

            await server.addUpdates(device1Info.serverConnectionId, {
                type: 'repo/add_updates',
                recordName: null,
                inst,
                branch: 'testBranch',
                updates: ['111', '222'],
                updateId: 0,
            });

            const updates = await instStore.getCurrentUpdates(
                null,
                inst,
                'testBranch'
            );

            expect(updates).toEqual({
                updates: ['111', '222'],
                timestamps: [expect.any(Number), expect.any(Number)],
                instSizeInBytes: 6,
            });
        });

        it('should ignore when given an event with a null branch', async () => {
            await connectionStore.saveConnection(device1Info);

            await server.addUpdates(device1Info.serverConnectionId, {
                type: 'repo/add_updates',
                recordName: null,
                inst,
                branch: null as any,
                updates: ['111'],
            });
        });

        it('should not crash if adding atoms to a branch that does not exist', async () => {
            await connectionStore.saveConnection(device1Info);

            await server.addUpdates(device1Info.serverConnectionId, {
                type: 'repo/add_updates',
                recordName: null,
                inst,
                branch: 'abc',
                updates: ['111'],
            });

            expect(
                await instStore.getCurrentUpdates(null, inst, 'abc')
            ).toEqual({
                updates: ['111'],
                timestamps: [expect.any(Number)],
                instSizeInBytes: 3,
            });
        });

        // it('should notify the sender if the updates were rejected because of a max inst size', async () => {
        //     updateStore.maxAllowedInstSize = 5;

        //     await connectionStore.saveConnection(device1Info);

        //     await server.addUpdates(device1Info.serverConnectionId, {
        //         type: 'repo/add_updates',
        //         recordName: null,
        //         inst,
        //         branch: 'testBranch',
        //         updates: ['111', '222'],
        //         updateId: 0,
        //     });

        //     const updates = await updateStore.getUpdates(
        //         branchNamespace(null, inst, 'testBranch')
        //     );

        //     expect(updates).toEqual({
        //         updates: [],
        //         timestamps: [],
        //     });

        //     const messages = messenger.getMessages(
        //         device1Info.serverConnectionId
        //     );
        //     expect(messages).toEqual([
        //         {
        //             type: 'repo/updates_received',
        //             recordName: null,
        //             inst,
        //             branch: 'testBranch',
        //             updateId: 0,
        //             errorCode: 'max_size_reached',
        //             maxBranchSizeInBytes: 5,
        //             neededBranchSizeInBytes: 6,
        //         },
        //     ]);
        // });

        // it('should merge updates when the max size was exceeded if configured', async () => {
        //     updateStore.maxAllowedInstSize = 150;
        //     server.mergeUpdatesOnMaxSizeExceeded = true;

        //     let createdUpdates = [] as string[];
        //     let p = new YjsPartitionImpl({
        //         type: 'yjs',
        //     });

        //     p.doc.clientID = 9999;
        //     p.doc.on('update', (update: Uint8Array) => {
        //         createdUpdates.push(fromByteArray(update));
        //     });

        //     await p.applyEvents([
        //         botAdded(
        //             createBot('test', {
        //                 abc: 'def',
        //             })
        //         ),
        //         botAdded(
        //             createBot('test2', {
        //                 abc: 'def',
        //             })
        //         ),
        //         botAdded(
        //             createBot('test3', {
        //                 abc: 'def',
        //             })
        //         ),
        //     ]);
        //     const update = createdUpdates[0];

        //     console.warn(update.length);

        //     await connectionStore.saveConnection(device1Info);

        //     await server.addUpdates(device1Info.serverConnectionId, {
        //         type: 'repo/add_updates',
        //         recordName: null,
        //         inst,
        //         branch: 'testBranch',
        //         updates: [update],
        //         updateId: 0,
        //     });

        //     await p.applyEvents([botRemoved('test3')]);
        //     const update2 = createdUpdates[1];

        //     expect(p.state).toEqual({
        //         test: createBot('test', {
        //             abc: 'def',
        //         }),
        //         test2: createBot('test2', {
        //             abc: 'def',
        //         }),
        //     });

        //     const state2 = getStateFromUpdates({
        //         type: 'get_inst_state_from_updates',
        //         updates: [
        //             {
        //                 id: 0,
        //                 timestamp: 0,
        //                 update: update,
        //             },
        //             {
        //                 id: 0,
        //                 timestamp: 0,
        //                 update: update2,
        //             },
        //         ],
        //     });

        //     expect(state2).toEqual({
        //         test: createBot('test', {
        //             abc: 'def',
        //         }),
        //         test2: createBot('test2', {
        //             abc: 'def',
        //         }),
        //     });

        //     await server.addUpdates(device1Info.serverConnectionId, {
        //         type: 'repo/add_updates',
        //         recordName: null,
        //         inst,
        //         branch: 'testBranch',
        //         updates: [update2],
        //         updateId: 1,
        //     });

        //     const updates = await updateStore.getUpdates(
        //         branchNamespace(null, inst, 'testBranch')
        //     );

        //     expect(updates).toEqual({
        //         updates: [expect.any(String)],
        //         timestamps: [expect.any(Number)],
        //     });

        //     const state = getStateFromUpdates({
        //         type: 'get_inst_state_from_updates',
        //         updates: [
        //             {
        //                 id: 0,
        //                 timestamp:
        //                     updates.timestamps[updates.timestamps.length - 1],
        //                 update: updates.updates[updates.updates.length - 1],
        //             },
        //         ],
        //     });

        //     expect(state).toEqual({
        //         test: createBot('test', {
        //             abc: 'def',
        //         }),
        //         test2: createBot('test2', {
        //             abc: 'def',
        //         }),
        //     });

        //     const messages = messenger.getMessages(
        //         device1Info.serverConnectionId
        //     );
        //     expect(messages).toEqual([
        //         {
        //             type: 'repo/updates_received',
        //             recordName: null,
        //             inst,
        //             branch: 'testBranch',
        //             updateId: 0,
        //         },
        //         {
        //             type: 'repo/updates_received',
        //             recordName: null,
        //             inst,
        //             branch: 'testBranch',
        //             updateId: 1,
        //         },
        //     ]);
        // });
    });

    describe('repo/send_event', () => {
        it('should notify the device that the event was sent to', async () => {
            await connectionStore.saveConnection(device1Info);
            await connectionStore.saveConnection(device2Info);
            await connectionStore.saveConnection(device3Info);

            await server.watchBranch(device2Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst,
                branch: 'testBranch',
            });

            await server.watchBranch(device3Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst,
                branch: 'testBranch',
            });

            await server.sendAction(device1Info.serverConnectionId, {
                type: 'repo/send_action',
                recordName: null,
                inst,
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
                    recordName: null,
                    inst,
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
                    recordName: null,
                    inst,
                    branch: 'testBranch',
                    updates: [],
                    initial: true,
                },
                {
                    type: 'repo/receive_action',
                    recordName: null,
                    inst,
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
                    inst,
                    branch: 'testBranch',
                });

                await server.watchBranch(device3Info.serverConnectionId, {
                    type: 'repo/watch_branch',
                    recordName: null,
                    inst,
                    branch: 'testBranch',
                });

                await server.sendAction(device1Info.serverConnectionId, {
                    type: 'repo/send_action',
                    recordName: null,
                    inst,
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
                        recordName: null,
                        inst,
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
                        recordName: null,
                        inst,
                        branch: 'testBranch',
                        updates: [],
                        initial: true,
                    },
                    {
                        type: 'repo/receive_action',
                        recordName: null,
                        inst,
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
                inst,
                branch: 'testBranch',
            });

            await server.watchBranch(device3Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst,
                branch: 'testBranch',
            });

            await server.sendAction(device1Info.serverConnectionId, {
                type: 'repo/send_action',
                recordName: null,
                inst,
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
                    recordName: null,
                    inst,
                    branch: 'testBranch',
                    updates: [],
                    initial: true,
                },
                {
                    type: 'repo/receive_action',
                    recordName: null,
                    inst,
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
                    recordName: null,
                    inst,
                    branch: 'testBranch',
                    updates: [],
                    initial: true,
                },
                {
                    type: 'repo/receive_action',
                    recordName: null,
                    inst,
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
                inst,
                branch: 'testBranch',
            });

            await server.watchBranch(device3Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst,
                branch: 'testBranch',
            });

            await server.sendAction(device1Info.serverConnectionId, {
                type: 'repo/send_action',
                recordName: null,
                inst,
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
                    recordName: null,
                    inst,
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
                    recordName: null,
                    inst,
                    branch: 'testBranch',
                    updates: [],
                    initial: true,
                },
                {
                    type: 'repo/receive_action',
                    recordName: null,
                    inst,
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
                inst,
                branch: 'testBranch',
            });

            await server.watchBranch(device3Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst,
                branch: 'testBranch',
            });

            await server.sendAction(device1Info.serverConnectionId, {
                type: 'repo/send_action',
                recordName: null,
                inst,
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
                    recordName: null,
                    inst,
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
                    recordName: null,
                    inst,
                    branch: 'testBranch',
                    updates: [],
                    initial: true,
                },
                {
                    type: 'repo/receive_action',
                    recordName: null,
                    inst,
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
                inst,
                branch: 'testBranch',
            });

            await server.watchBranch(device3Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst,
                branch: 'testBranch',
            });

            await server.sendAction(device1Info.serverConnectionId, {
                type: 'repo/send_action',
                recordName: null,
                inst,
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
                    recordName: null,
                    inst,
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
                    recordName: null,
                    inst,
                    branch: 'testBranch',
                    updates: [],
                    initial: true,
                },
                {
                    type: 'repo/receive_action',
                    recordName: null,
                    inst,
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
                null,
                inst,
                'testBranch'
            );

            await server.watchBranch(device2Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst,
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
                        recordName: null,
                        inst,
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
                null,
                inst,
                'testBranch'
            );

            await server.watchBranch(device2Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst,
                branch: 'testBranch',
            });

            await server.unwatchBranch(
                device2Info.serverConnectionId,
                null,
                inst,
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
                        recordName: null,
                        inst,
                        branch: 'testBranch',
                    },
                    connection: connectionInfo(device2Info),
                },
                {
                    type: 'repo/disconnected_from_branch',
                    broadcast: false,
                    recordName: null,
                    inst,
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
                null,
                inst,
                'testBranch'
            );

            await server.watchBranch(device2Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst,
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
                        recordName: null,
                        inst,
                        branch: 'testBranch',
                    },
                    connection: connectionInfo(device2Info),
                },
                {
                    type: 'repo/disconnected_from_branch',
                    broadcast: false,
                    recordName: null,
                    inst,
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
                inst,
                branch: 'testBranch',
            });

            await server.watchBranch(device3Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst,
                branch: 'testBranch',
            });

            await server.watchBranch(device4Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst,
                branch: 'testBranch2',
            });

            await server.watchBranchDevices(
                device1Info.serverConnectionId,
                null,
                inst,
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
                        recordName: null,
                        inst,
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
                        recordName: null,
                        inst,
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
                null,
                inst,
                'testBranch'
            );

            await server.watchBranch(device2Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst,
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
                        recordName: null,
                        inst,
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
                null,
                inst,
                'testBranch'
            );
            await server.unwatchBranchDevices(
                device1Info.serverConnectionId,
                null,
                inst,
                'testBranch'
            );

            await server.watchBranch(device2Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst,
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
                null,
                inst,
                'testBranch'
            );

            await server.disconnect(device1Info.serverConnectionId);

            await connectionStore.saveConnection(device1Info);

            await server.watchBranch(device2Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst,
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

            await server.deviceCount(
                device1Info.serverConnectionId,
                null,
                null,
                null
            );

            expect(
                messenger.getMessages(device1Info.serverConnectionId)
            ).toEqual([
                {
                    type: 'repo/connection_count',
                    recordName: null,
                    inst: null,
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
                inst,
                branch: 'testBranch',
            });
            await server.watchBranch(device3Info.serverConnectionId, {
                type: 'repo/watch_branch',
                recordName: null,
                inst,
                branch: 'testBranch',
            });

            await server.deviceCount(
                device1Info.serverConnectionId,
                null,
                inst,
                'testBranch'
            );

            expect(
                messenger.getMessages(device1Info.serverConnectionId)
            ).toEqual([
                {
                    type: 'repo/connection_count',
                    recordName: null,
                    inst,
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
            const data = await server.getBranchData(null, inst, 'testBranch');

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

            await instStore.addUpdates(
                null,
                inst,
                'testBranch',
                [updateBase64],
                updateBase64.length
            );

            const data = await server.getBranchData(null, inst, 'testBranch');

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
                    inst,
                    branch: 'testBranch',
                });

                await instStore.addUpdates(
                    null,
                    inst,
                    'testBranch',
                    ['abc'],
                    3
                );

                const result = await server.webhook(
                    null,
                    inst,
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
                        recordName: null,
                        inst,
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

        it('should return 404 if there is no branch', async () => {
            const originalRandom = Math.random;
            try {
                const randomMock = (Math.random = jest.fn());
                randomMock.mockReturnValueOnce(0);

                await connectionStore.saveConnection(device1Info);

                const result = await server.webhook(
                    null,
                    inst,
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
                ).toEqual([]);
            } finally {
                Math.random = originalRandom;
            }
        });

        it('should return 404 if there are no connected devices', async () => {
            const originalRandom = Math.random;
            try {
                const randomMock = (Math.random = jest.fn());
                randomMock.mockReturnValueOnce(0);

                await connectionStore.saveConnection(device1Info);

                await instStore.addUpdates(
                    null,
                    inst,
                    'testBranch',
                    ['abc'],
                    3
                );

                const result = await server.webhook(
                    null,
                    inst,
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

        const sessionIdCases = [
            [true, 'matches', 'sessionId', 'sessionId'] as const,
            [false, 'does not match', 'sessionId', 'no match'] as const,
        ];

        it.each(sessionIdCases)(
            'should return %s if the session ID %s',
            (expected, desc, sessionId, eventSessionId) => {
                let device: DeviceConnection = {
                    serverConnectionId: 'connection',
                    clientConnectionId: 'sessionId',
                    userId: 'userId',
                    sessionId: sessionId,
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
                    type: 'rate_limit_exceeded',
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
                    type: 'rate_limit_exceeded',
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
                    null,
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
