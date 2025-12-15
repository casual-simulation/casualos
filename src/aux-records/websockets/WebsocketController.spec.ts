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
import {
    WebsocketController,
    isEventForDevice,
    connectionInfo,
    SAVE_PERMANENT_BRANCHES_LOCK,
} from './WebsocketController';
import { MemoryWebsocketConnectionStore } from './MemoryWebsocketConnectionStore';
import type { DeviceConnection } from './WebsocketConnectionStore';
import { MemoryWebsocketMessenger } from './MemoryWebsocketMessenger';
import type { StoredAux } from '@casual-simulation/aux-common/bots';
import {
    action,
    botAdded,
    ON_WEBHOOK_ACTION_NAME,
    getInstStateFromUpdates,
    createInitializationUpdate,
} from '@casual-simulation/aux-common/bots';
import { createBot } from '@casual-simulation/aux-common/bots/BotCalculations';
import { v4 as uuid, v7 as uuidv7 } from 'uuid';
import type { YjsPartitionImpl } from '@casual-simulation/aux-common/partitions/YjsPartition';
import { createYjsPartition } from '@casual-simulation/aux-common/partitions/YjsPartition';
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
import type { RequestMissingPermissionResponseSuccessMessage } from '@casual-simulation/aux-common/websockets/WebsocketEvents';
import { WebsocketEventTypes } from '@casual-simulation/aux-common/websockets/WebsocketEvents';
import {
    createTestControllers,
    createTestRecordKey,
    createTestUser,
} from '../TestUtils';
import { SplitInstRecordsStore } from './SplitInstRecordsStore';
import type { TemporaryInstRecordsStore } from './TemporaryInstRecordsStore';
import { MemoryTempInstRecordsStore } from './MemoryTempInstRecordsStore';
import type { ConnectionInfo } from '@casual-simulation/aux-common';
import {
    ACCOUNT_MARKER,
    ADMIN_ROLE_NAME,
    DEFAULT_BRANCH_NAME,
    PRIVATE_MARKER,
    PUBLIC_READ_MARKER,
    PUBLIC_WRITE_MARKER,
    constructInitializationUpdate,
} from '@casual-simulation/aux-common';
import { getStateFromUpdates } from '@casual-simulation/aux-common';
import type { MemoryStore } from '../MemoryStore';
import type { SubscriptionConfiguration } from '../SubscriptionConfiguration';

import { buildSubscriptionConfig } from '../SubscriptionConfigBuilder';
import type { PackageRecordVersionKey } from '../packages/version';
import { version } from '../packages/version';
import { getHash } from '@casual-simulation/crypto';
import {
    formatInstId,
    generateV1ConnectionToken,
} from '@casual-simulation/aux-common';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';

const uuidMock: jest.Mock = <any>uuid;
const uuidv7Mock: jest.Mock = <any>uuidv7;
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
    beforeEach(() => {
        uuidMock.mockReset();
        uuidv7Mock.mockReset();
    });

    const subCases: [string, SubscriptionConfiguration | null | undefined][] = [
        ['subscription config', undefined],
        ['no subscription config', null],
    ];

    describe.each(subCases)('%s', (desc, subConfig) => {
        let server: WebsocketController;
        let connectionStore: MemoryWebsocketConnectionStore;
        let messenger: MemoryWebsocketMessenger;
        let instStore: SplitInstRecordsStore;
        let tempUpdatesStore: TemporaryInstRecordsStore;
        let services: ReturnType<typeof createTestControllers>;
        let store: MemoryStore;

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
            services = createTestControllers(subConfig);
            store = services.store;
            connectionStore = new MemoryWebsocketConnectionStore();
            messenger = new MemoryWebsocketMessenger();
            tempUpdatesStore = new MemoryTempInstRecordsStore();
            instStore = new SplitInstRecordsStore(
                new MemoryTempInstRecordsStore(),
                services.store
            );
            server = new WebsocketController(
                connectionStore,
                messenger,
                instStore,
                tempUpdatesStore,
                services.auth,
                services.policies,
                services.configStore,
                services.store,
                services.store,
                services.packageVersions
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
                        success: true,
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
                        success: true,
                        info: {
                            userId: null,
                            sessionId: null,
                            connectionId: connectionId,
                        },
                    },
                ]);
            });

            it('should send a unacceptable_connection_id error if none is provided in the message', async () => {
                await server.login(serverConnectionId, 1, {
                    type: 'login',
                });

                expect(messenger.getMessages(serverConnectionId)).toEqual([
                    {
                        type: 'login_result',
                        success: false,
                        errorCode: 'unacceptable_connection_id',
                        errorMessage:
                            'A connection ID must be specified when logging in without a connection token.',
                    },
                ]);

                const events = messenger.getEvents(serverConnectionId);
                expect(events).toEqual([]);

                const connection = await connectionStore.getConnection(
                    serverConnectionId
                );

                expect(connection).toBeFalsy();
            });

            it('should send a unacceptable_connection_token error if the token is wrong', async () => {
                await server.login(serverConnectionId, 1, {
                    type: 'login',
                    connectionToken: 'wrong token',
                });

                expect(messenger.getMessages(serverConnectionId)).toEqual([
                    {
                        type: 'login_result',
                        success: false,
                        errorCode: 'unacceptable_connection_token',
                        errorMessage:
                            'The given connection token is invalid. It must be a correctly formatted string.',
                    },
                ]);

                const events = messenger.getEvents(serverConnectionId);
                expect(events).toEqual([]);

                const connection = await connectionStore.getConnection(
                    serverConnectionId
                );

                expect(connection).toBeFalsy();
            });

            it('should add the recordName and inst to the list of authorized insts for the connection', async () => {
                await server.login(serverConnectionId, 1, {
                    type: 'login',
                    connectionToken,
                });

                const authorized = await connectionStore.isAuthorizedInst(
                    serverConnectionId,
                    recordName,
                    inst,
                    'token'
                );

                expect(authorized).toBe(true);
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
                        {
                            type: 'repo/watch_branch_result',
                            success: true,
                            recordName: null,
                            inst,
                            branch: 'testBranch',
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
                        temporary: false,
                        linkedInst: null,
                    });
                    // Should not create an inst when the record name is null.
                    expect(await instStore.getInstByName(null, inst)).toBe(
                        null
                    );
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
                        {
                            type: 'repo/watch_branch_result',
                            success: true,
                            recordName: null,
                            inst,
                            branch: 'doesNotExist',
                        },
                    ]);

                    expect(
                        await instStore.getBranchByName(
                            null,
                            inst,
                            'doesNotExist'
                        )
                    ).toEqual({
                        recordName: null,
                        inst,
                        branch: 'doesNotExist',
                        temporary: false,
                        linkedInst: null,
                    });
                    // Should not create an inst when the record name is null.
                    expect(await instStore.getInstByName(null, inst)).toBe(
                        null
                    );
                });

                it('should return a not_authorized error if recordless insts are not allowed', async () => {
                    store.subscriptionConfiguration = buildSubscriptionConfig(
                        (config) =>
                            config.withPublicInsts({
                                allowed: false,
                            })
                    );

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
                            type: 'repo/watch_branch_result',
                            success: false,
                            recordName: null,
                            inst,
                            branch: 'doesNotExist',
                            errorCode: 'not_authorized',
                            errorMessage: 'Temporary insts are not allowed.',
                        },
                    ]);

                    expect(
                        messenger.getEvents(device1Info.serverConnectionId)
                    ).toEqual([]);

                    expect(
                        await instStore.getBranchByName(
                            null,
                            inst,
                            'doesNotExist'
                        )
                    ).toEqual(null);
                    // Should not create an inst when the record name is null.
                    expect(await instStore.getInstByName(null, inst)).toBe(
                        null
                    );
                });

                it('should return a not_authorized error if the user is not allowed to access public insts based on their privacy features', async () => {
                    const user = await store.findUser(userId);
                    await store.saveUser({
                        ...user,
                        privacyFeatures: {
                            allowAI: true,
                            allowPublicData: true,
                            publishData: true,
                            allowPublicInsts: false,
                        },
                    });

                    await connectionStore.saveConnection(user1Info);

                    await server.watchBranch(user1Info.serverConnectionId, {
                        type: 'repo/watch_branch',
                        recordName: null,
                        inst,
                        branch: 'doesNotExist',
                    });

                    expect(
                        messenger.getMessages(user1Info.serverConnectionId)
                    ).toEqual([
                        {
                            type: 'repo/watch_branch_result',
                            success: false,
                            recordName: null,
                            inst,
                            branch: 'doesNotExist',
                            errorCode: 'not_authorized',
                            errorMessage: 'Public insts are not allowed.',
                        },
                    ]);

                    expect(
                        messenger.getEvents(user1Info.serverConnectionId)
                    ).toEqual([]);

                    expect(
                        await instStore.getBranchByName(
                            null,
                            inst,
                            'doesNotExist'
                        )
                    ).toEqual(null);
                    // Should not create an inst when the record name is null.
                    expect(await instStore.getInstByName(null, inst)).toBe(
                        null
                    );
                });

                it('should return a not_logged_in error if the user is not logged in and privo is configured to deny public insts by default', async () => {
                    store.privoConfiguration = {
                        gatewayEndpoint: 'endpoint',
                        featureIds: {
                            adultPrivoSSO: 'adultAccount',
                            childPrivoSSO: 'childAccount',
                            joinAndCollaborate: 'joinAndCollaborate',
                            publishProjects: 'publish',
                            projectDevelopment: 'dev',
                            buildAIEggs: 'buildaieggs',
                        },
                        clientId: 'clientId',
                        clientSecret: 'clientSecret',
                        publicEndpoint: 'publicEndpoint',
                        roleIds: {
                            child: 'childRole',
                            adult: 'adultRole',
                            parent: 'parentRole',
                        },
                        clientTokenScopes: 'scope1 scope2',
                        userTokenScopes: 'scope1 scope2',
                        redirectUri: 'redirectUri',
                        ageOfConsent: 18,
                    };
                    user1Info = {
                        serverConnectionId,
                        clientConnectionId: connectionId,
                        userId: null,
                        sessionId: null,
                        token: null,
                    };

                    await connectionStore.saveConnection(user1Info);

                    await server.watchBranch(user1Info.serverConnectionId, {
                        type: 'repo/watch_branch',
                        recordName: null,
                        inst,
                        branch: 'doesNotExist',
                    });

                    expect(
                        messenger.getMessages(user1Info.serverConnectionId)
                    ).toEqual([
                        {
                            type: 'repo/watch_branch_result',
                            success: false,
                            recordName: null,
                            inst,
                            branch: 'doesNotExist',
                            errorCode: 'not_logged_in',
                            errorMessage:
                                'Please log in to access public insts.',
                        },
                    ]);

                    expect(
                        messenger.getEvents(user1Info.serverConnectionId)
                    ).toEqual([]);

                    expect(
                        await instStore.getBranchByName(
                            null,
                            inst,
                            'doesNotExist'
                        )
                    ).toEqual(null);
                    // Should not create an inst when the record name is null.
                    expect(await instStore.getInstByName(null, inst)).toBe(
                        null
                    );
                });

                it('should return a not_authorized error if the maximum number of connections for recordless insts is reached', async () => {
                    store.subscriptionConfiguration = buildSubscriptionConfig(
                        (config) =>
                            config.withPublicInsts({
                                allowed: true,
                                maxActiveConnectionsPerInst: 1,
                            })
                    );

                    await connectionStore.saveConnection(device1Info);
                    await connectionStore.saveConnection(device2Info);

                    await server.watchBranch(device1Info.serverConnectionId, {
                        type: 'repo/watch_branch',
                        recordName: null,
                        inst,
                        branch: 'doesNotExist',
                    });

                    expect(
                        messenger.getEvents(device1Info.serverConnectionId)
                    ).toEqual([]);

                    await server.watchBranch(device2Info.serverConnectionId, {
                        type: 'repo/watch_branch',
                        recordName: null,
                        inst,
                        branch: 'doesNotExist',
                    });

                    expect(
                        messenger.getMessages(device2Info.serverConnectionId)
                    ).toEqual([
                        {
                            type: 'repo/watch_branch_result',
                            success: false,
                            recordName: null,
                            inst,
                            branch: 'doesNotExist',
                            errorCode: 'not_authorized',
                            errorMessage:
                                'The maximum number of active connections to this inst has been reached.',
                        },
                    ]);

                    expect(
                        messenger.getEvents(device2Info.serverConnectionId)
                    ).toEqual([]);
                });

                it('should return a invalid_connection_state error if the connection cannot be found in Redis', async () => {
                    await server.watchBranch(device1Info.serverConnectionId, {
                        type: 'repo/watch_branch',
                        recordName: null,
                        inst,
                        branch: 'testBranch',
                    });

                    expect(
                        messenger.getEvents(device1Info.serverConnectionId)
                    ).toEqual([
                        [
                            WebsocketEventTypes.Error,
                            -1,
                            {
                                success: false,
                                errorCode: 'invalid_connection_state',
                                errorMessage: `A server error occurred. (namespace: null/${inst}/${'testBranch'}, connectionId: ${
                                    device1Info.serverConnectionId
                                })`,
                                recordName: null,
                                inst: inst,
                                branch: 'testBranch',
                            },
                        ],
                    ]);
                    expect(
                        messenger.isDisconnected(device1Info.serverConnectionId)
                    ).toBe(true);
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

                        await server.watchBranch(
                            device1Info.serverConnectionId,
                            {
                                type: 'repo/watch_branch',
                                recordName: null,
                                inst,
                                branch: 'testBranch',
                                temporary: true,
                            }
                        );

                        expect(
                            messenger.getMessages(
                                device1Info.serverConnectionId
                            )
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
                                type: 'repo/watch_branch_result',
                                success: true,
                                recordName: null,
                                inst,
                                branch: 'testBranch',
                            },
                        ]);

                        expect(
                            await tempUpdatesStore.getBranchByName(
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
                            branchSizeInBytes: 6,
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

                        await server.watchBranch(
                            device1Info.serverConnectionId,
                            {
                                type: 'repo/watch_branch',
                                recordName: null,
                                inst,
                                branch: 'testBranch',
                                temporary: true,
                            }
                        );

                        await server.addUpdates(
                            device1Info.serverConnectionId,
                            {
                                type: 'repo/add_updates',
                                recordName: null,
                                inst,
                                branch: 'testBranch',
                                updates: ['abc', 'def'],
                            }
                        );

                        await server.watchBranch(
                            device3Info.serverConnectionId,
                            {
                                type: 'repo/watch_branch',
                                recordName: null,
                                inst,
                                branch: 'testBranch',
                                temporary: true,
                            }
                        );

                        expect(
                            messenger.getMessages(
                                device3Info.serverConnectionId
                            )
                        ).toEqual([
                            {
                                type: 'repo/add_updates',
                                recordName: null,
                                inst,
                                branch: 'testBranch',
                                updates: ['abc', 'def'],
                                initial: true,
                            },
                            {
                                type: 'repo/watch_branch_result',
                                success: true,
                                recordName: null,
                                inst,
                                branch: 'testBranch',
                            },
                        ]);

                        expect(
                            await tempUpdatesStore.getBranchByName(
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
                            branchSizeInBytes: 6,
                        });

                        // Should not create an inst when the record name is null.
                        expect(await instStore.getInstByName(null, inst)).toBe(
                            null
                        );
                    });
                });
            });

            describe('records', () => {
                it('should return a record_not_found error if the record does not exist', async () => {
                    await server.login(serverConnectionId, 1, {
                        type: 'login',
                        connectionToken,
                    });

                    await server.watchBranch(serverConnectionId, {
                        type: 'repo/watch_branch',
                        recordName,
                        inst,
                        branch: 'test',
                    });

                    expect(
                        messenger.getMessages(serverConnectionId).slice(1)
                    ).toEqual([
                        {
                            type: 'repo/watch_branch_result',
                            success: false,
                            recordName,
                            inst,
                            branch: 'test',
                            errorCode: 'record_not_found',
                            errorMessage: 'Record not found.',
                        },
                    ]);

                    expect(messenger.getEvents(serverConnectionId)).toEqual([]);
                });

                describe('private', () => {
                    beforeEach(async () => {
                        await services.records.createRecord({
                            userId,
                            recordName,
                            ownerId: userId,
                        });
                    });

                    describe('anonymous', () => {
                        it('should return a not_authorized error if the user is trying to create an inst in a record they do not have access to', async () => {
                            await server.login(serverConnectionId, 1, {
                                type: 'login',
                                connectionId,
                            });

                            await server.watchBranch(serverConnectionId, {
                                type: 'repo/watch_branch',
                                recordName,
                                inst,
                                branch: 'testBranch',
                            });

                            expect(
                                messenger
                                    .getMessages(serverConnectionId)
                                    .slice(1)
                            ).toEqual([
                                {
                                    type: 'repo/watch_branch_result',
                                    success: false,
                                    errorCode: 'not_logged_in',
                                    errorMessage:
                                        'The user must be logged in. Please provide a sessionKey or a recordKey.',
                                    recordName,
                                    inst,
                                    branch: 'testBranch',
                                },
                            ]);
                            expect(
                                messenger.getEvents(serverConnectionId)
                            ).toEqual([]);
                        });

                        it('should return a not_authorized error if the user is trying to read an inst in a record they do not have access to', async () => {
                            await instStore.saveInst({
                                recordName,
                                inst,
                                markers: [PRIVATE_MARKER],
                            });

                            await server.login(serverConnectionId, 1, {
                                type: 'login',
                                connectionId,
                            });

                            await server.watchBranch(serverConnectionId, {
                                type: 'repo/watch_branch',
                                recordName,
                                inst,
                                branch: 'testBranch',
                            });

                            expect(
                                messenger
                                    .getMessages(serverConnectionId)
                                    .slice(1)
                            ).toEqual([
                                {
                                    type: 'repo/watch_branch_result',
                                    success: false,
                                    errorCode: 'not_logged_in',
                                    errorMessage:
                                        'The user must be logged in. Please provide a sessionKey or a recordKey.',
                                    recordName,
                                    inst,
                                    branch: 'testBranch',
                                },
                            ]);
                            expect(
                                messenger.getEvents(serverConnectionId)
                            ).toEqual([]);
                        });
                    });

                    describe('token', () => {
                        const otherUserConnectionId = 'otherConnectionId';
                        let otherUserId: string;
                        let otherUserConnectionKey: string;
                        let otherUserToken: string;

                        beforeEach(async () => {
                            uuidMock.mockReturnValueOnce('otherUserId');
                            const otherUser = await createTestUser(
                                services,
                                'other@example.com'
                            );
                            otherUserToken = generateV1ConnectionToken(
                                otherUser.connectionKey,
                                otherUserConnectionId,
                                recordName,
                                inst
                            );
                            otherUserId = otherUser.userId;
                            otherUserConnectionKey = otherUser.connectionKey;
                        });

                        describe('creation', () => {
                            it('should return a not_authorized error if the user is trying to create an inst in a record they do not have access to', async () => {
                                await server.login(serverConnectionId, 1, {
                                    type: 'login',
                                    connectionToken: otherUserToken,
                                });

                                await server.watchBranch(serverConnectionId, {
                                    type: 'repo/watch_branch',
                                    recordName,
                                    inst,
                                    branch: 'testBranch',
                                });

                                expect(
                                    messenger
                                        .getMessages(serverConnectionId)
                                        .slice(1)
                                ).toEqual([
                                    {
                                        type: 'repo/watch_branch_result',
                                        success: false,
                                        errorCode: 'not_authorized',
                                        errorMessage:
                                            'You are not authorized to perform this action.',
                                        reason: {
                                            type: 'missing_permission',
                                            recordName,
                                            resourceKind: 'inst',
                                            resourceId: inst,
                                            action: 'create',
                                            subjectType: 'user',
                                            subjectId: otherUserId,
                                        },
                                        recordName,
                                        inst,
                                        branch: 'testBranch',
                                    },
                                ]);

                                expect(
                                    messenger.getEvents(serverConnectionId)
                                ).toEqual([]);
                            });

                            it('should return a not_authorized error if the user is trying to create an inst in a record they do not have read access to', async () => {
                                await services.policyStore.assignPermissionToSubjectAndMarker(
                                    recordName,
                                    'role',
                                    'developer',
                                    'inst',
                                    PRIVATE_MARKER,
                                    'create',
                                    {},
                                    null
                                );
                                await services.policyStore.assignPermissionToSubjectAndMarker(
                                    recordName,
                                    'role',
                                    'developer',
                                    'marker',
                                    ACCOUNT_MARKER,
                                    'assign',
                                    {},
                                    null
                                );

                                services.store.roles[recordName] = {
                                    [otherUserId]: new Set(['developer']),
                                };

                                await server.login(serverConnectionId, 1, {
                                    type: 'login',
                                    connectionToken: otherUserToken,
                                });

                                await server.watchBranch(serverConnectionId, {
                                    type: 'repo/watch_branch',
                                    recordName,
                                    inst,
                                    branch: 'testBranch',
                                });

                                expect(
                                    messenger
                                        .getMessages(serverConnectionId)
                                        .slice(1)
                                ).toEqual([
                                    {
                                        type: 'repo/watch_branch_result',
                                        success: false,
                                        errorCode: 'not_authorized',
                                        errorMessage:
                                            'You are not authorized to perform this action.',
                                        reason: {
                                            type: 'missing_permission',
                                            recordName,
                                            resourceKind: 'inst',
                                            resourceId: inst,
                                            action: 'read',
                                            subjectType: 'user',
                                            subjectId: otherUserId,
                                        },
                                        recordName,
                                        inst,
                                        branch: 'testBranch',
                                    },
                                ]);
                                expect(
                                    messenger.getEvents(serverConnectionId)
                                ).toEqual([]);
                            });

                            it('should create the inst if the user is the owner of the record', async () => {
                                await server.login(serverConnectionId, 1, {
                                    type: 'login',
                                    connectionToken: connectionToken,
                                });

                                await server.watchBranch(serverConnectionId, {
                                    type: 'repo/watch_branch',
                                    recordName,
                                    inst,
                                    branch: 'testBranch',
                                });

                                expect(
                                    messenger.getEvents(serverConnectionId)
                                ).toEqual([]);

                                expect(
                                    await instStore.getInstByName(
                                        recordName,
                                        inst
                                    )
                                ).toEqual({
                                    recordName,
                                    inst,
                                    markers: [PRIVATE_MARKER],
                                });
                            });

                            it('should support record keys', async () => {
                                const { recordKey } = await createTestRecordKey(
                                    services,
                                    userId,
                                    recordName,
                                    'subjectfull'
                                );

                                await server.login(serverConnectionId, 1, {
                                    type: 'login',
                                    connectionToken: connectionToken,
                                });

                                await server.watchBranch(serverConnectionId, {
                                    type: 'repo/watch_branch',
                                    recordName: recordKey,
                                    inst,
                                    branch: 'testBranch',
                                });

                                expect(
                                    messenger.getEvents(serverConnectionId)
                                ).toEqual([]);

                                expect(
                                    messenger
                                        .getMessages(serverConnectionId)
                                        .slice(1)
                                ).toEqual([
                                    {
                                        type: 'repo/add_updates',
                                        recordName,
                                        inst,
                                        branch: 'testBranch',
                                        updates: [],
                                        initial: true,
                                    },
                                    {
                                        type: 'repo/watch_branch_result',
                                        success: true,
                                        recordName,
                                        inst,
                                        branch: 'testBranch',
                                    },
                                ]);

                                expect(
                                    await instStore.getInstByName(
                                        recordName,
                                        inst
                                    )
                                ).toEqual({
                                    recordName,
                                    inst,
                                    markers: [PRIVATE_MARKER],
                                });
                            });

                            it('should not error if given a record key and connection token that matches the record key', async () => {
                                const { recordKey } = await createTestRecordKey(
                                    services,
                                    userId,
                                    recordName,
                                    'subjectfull'
                                );
                                connectionToken = generateV1ConnectionToken(
                                    connectionKey,
                                    connectionId,
                                    recordKey,
                                    inst
                                );

                                await server.login(serverConnectionId, 1, {
                                    type: 'login',
                                    connectionToken: connectionToken,
                                });

                                await server.watchBranch(serverConnectionId, {
                                    type: 'repo/watch_branch',
                                    recordName: recordKey,
                                    inst,
                                    branch: 'testBranch',
                                });

                                expect(
                                    messenger.getEvents(serverConnectionId)
                                ).toEqual([]);

                                expect(
                                    messenger
                                        .getMessages(serverConnectionId)
                                        .slice(1)
                                ).toEqual([
                                    {
                                        type: 'repo/add_updates',
                                        recordName,
                                        inst,
                                        branch: 'testBranch',
                                        updates: [],
                                        initial: true,
                                    },
                                    {
                                        type: 'repo/watch_branch_result',
                                        success: true,
                                        recordName,
                                        inst,
                                        branch: 'testBranch',
                                    },
                                ]);

                                expect(
                                    await instStore.getInstByName(
                                        recordName,
                                        inst
                                    )
                                ).toEqual({
                                    recordName,
                                    inst,
                                    markers: [PRIVATE_MARKER],
                                });
                            });

                            it('should create the inst if the user has been granted permission', async () => {
                                await services.policyStore.assignPermissionToSubjectAndMarker(
                                    recordName,
                                    'role',
                                    'developer',
                                    'inst',
                                    PRIVATE_MARKER,
                                    'create',
                                    {},
                                    null
                                );
                                await services.policyStore.assignPermissionToSubjectAndMarker(
                                    recordName,
                                    'role',
                                    'developer',
                                    'inst',
                                    PRIVATE_MARKER,
                                    'read',
                                    {},
                                    null
                                );
                                await services.policyStore.assignPermissionToSubjectAndMarker(
                                    recordName,
                                    'role',
                                    'developer',
                                    'marker',
                                    ACCOUNT_MARKER,
                                    'assign',
                                    {},
                                    null
                                );

                                services.store.roles[recordName] = {
                                    [otherUserId]: new Set(['developer']),
                                };

                                await server.login(serverConnectionId, 1, {
                                    type: 'login',
                                    connectionToken: otherUserToken,
                                });

                                await server.watchBranch(serverConnectionId, {
                                    type: 'repo/watch_branch',
                                    recordName,
                                    inst,
                                    branch: 'testBranch',
                                });

                                expect(
                                    messenger.getEvents(serverConnectionId)
                                ).toEqual([]);

                                expect(
                                    await instStore.getInstByName(
                                        recordName,
                                        inst
                                    )
                                ).toEqual({
                                    recordName,
                                    inst,
                                    markers: [PRIVATE_MARKER],
                                });
                            });

                            it('should return a not_authorized error if insts are not allowed', async () => {
                                store.subscriptionConfiguration =
                                    buildSubscriptionConfig((config) =>
                                        config.addSubscription('sub1', (sub) =>
                                            sub
                                                .withTier('tier1')
                                                .withAllDefaultFeatures()
                                                .withInsts({
                                                    allowed: false,
                                                })
                                        )
                                    );

                                await store.saveUser({
                                    id: userId,
                                    allSessionRevokeTimeMs: null,
                                    currentLoginRequestId: null,
                                    email: 'test@example.com',
                                    phoneNumber: null,
                                    subscriptionId: 'sub1',
                                    subscriptionStatus: 'active',
                                });

                                await server.login(serverConnectionId, 1, {
                                    type: 'login',
                                    connectionToken,
                                });

                                await server.watchBranch(serverConnectionId, {
                                    type: 'repo/watch_branch',
                                    recordName,
                                    inst,
                                    branch: 'test',
                                });

                                expect(
                                    messenger
                                        .getMessages(serverConnectionId)
                                        .slice(1)
                                ).toEqual([
                                    {
                                        type: 'repo/watch_branch_result',
                                        success: false,
                                        errorCode: 'not_authorized',
                                        errorMessage:
                                            'Insts are not allowed for this subscription.',
                                        recordName,
                                        inst,
                                        branch: 'test',
                                    },
                                ]);

                                expect(
                                    messenger.getEvents(serverConnectionId)
                                ).toEqual([]);
                            });

                            it('should return a subscription_limit_reached error the subscription has reached the maximum number of insts', async () => {
                                store.subscriptionConfiguration =
                                    buildSubscriptionConfig((config) =>
                                        config.addSubscription('sub1', (sub) =>
                                            sub
                                                .withTier('tier1')
                                                .withAllDefaultFeatures()
                                                .withInsts()
                                                .withMaxInsts(1)
                                        )
                                    );

                                await store.saveUser({
                                    id: userId,
                                    allSessionRevokeTimeMs: null,
                                    currentLoginRequestId: null,
                                    email: 'test@example.com',
                                    phoneNumber: null,
                                    subscriptionId: 'sub1',
                                    subscriptionStatus: 'active',
                                });

                                await instStore.saveInst({
                                    recordName,
                                    inst: 'otherInst',
                                    markers: [PRIVATE_MARKER],
                                });

                                await server.login(serverConnectionId, 1, {
                                    type: 'login',
                                    connectionToken,
                                });

                                await server.watchBranch(serverConnectionId, {
                                    type: 'repo/watch_branch',
                                    recordName,
                                    inst,
                                    branch: 'test',
                                });

                                expect(
                                    messenger
                                        .getMessages(serverConnectionId)
                                        .slice(1)
                                ).toEqual([
                                    {
                                        type: 'repo/watch_branch_result',
                                        success: false,
                                        errorCode: 'subscription_limit_reached',
                                        errorMessage:
                                            'The maximum number of insts has been reached.',
                                        recordName,
                                        inst,
                                        branch: 'test',
                                    },
                                ]);

                                expect(
                                    messenger.getEvents(serverConnectionId)
                                ).toEqual([]);
                            });

                            it('should return a invalid_connection_state error if the connection cannot be found', async () => {
                                await server.watchBranch(
                                    device1Info.serverConnectionId,
                                    {
                                        type: 'repo/watch_branch',
                                        recordName,
                                        inst,
                                        branch: 'testBranch',
                                    }
                                );

                                expect(
                                    messenger.getEvents(
                                        device1Info.serverConnectionId
                                    )
                                ).toEqual([
                                    [
                                        WebsocketEventTypes.Error,
                                        -1,
                                        {
                                            success: false,
                                            errorCode:
                                                'invalid_connection_state',
                                            errorMessage: `A server error occurred. (namespace: ${recordName}/${inst}/${'testBranch'}, connectionId: ${
                                                device1Info.serverConnectionId
                                            })`,
                                            recordName,
                                            inst: inst,
                                            branch: 'testBranch',
                                        },
                                    ],
                                ]);
                                // Should disconnect the connection
                                expect(
                                    messenger.isDisconnected(
                                        device1Info.serverConnectionId
                                    )
                                ).toBe(true);
                            });
                        });

                        describe('read', () => {
                            beforeEach(async () => {
                                await instStore.saveInst({
                                    recordName,
                                    inst,
                                    markers: [PRIVATE_MARKER],
                                });
                            });

                            it('should return a not_authorized error if the user is trying to read an inst in a record they do not have access to', async () => {
                                await server.login(serverConnectionId, 1, {
                                    type: 'login',
                                    connectionToken: otherUserToken,
                                });

                                await server.watchBranch(serverConnectionId, {
                                    type: 'repo/watch_branch',
                                    recordName,
                                    inst,
                                    branch: 'testBranch',
                                });

                                expect(
                                    messenger
                                        .getMessages(serverConnectionId)
                                        .slice(1)
                                ).toEqual([
                                    {
                                        type: 'repo/watch_branch_result',
                                        success: false,
                                        errorCode: 'not_authorized',
                                        errorMessage:
                                            'You are not authorized to perform this action.',
                                        reason: {
                                            type: 'missing_permission',
                                            recordName,
                                            resourceKind: 'inst',
                                            resourceId: inst,
                                            action: 'read',
                                            subjectType: 'user',
                                            subjectId: otherUserId,
                                        },
                                        recordName,
                                        inst,
                                        branch: 'testBranch',
                                    },
                                ]);

                                expect(
                                    messenger.getEvents(serverConnectionId)
                                ).toEqual([]);
                            });

                            it('should return a not_authorized error if the user is trying to read an inst they have access to but their token does not grant', async () => {
                                await instStore.saveInst({
                                    recordName,
                                    inst: 'otherInst',
                                    markers: [PRIVATE_MARKER],
                                });

                                await services.policyStore.assignPermissionToSubjectAndMarker(
                                    recordName,
                                    'role',
                                    'developer',
                                    'inst',
                                    PRIVATE_MARKER,
                                    'read',
                                    {},
                                    null
                                );

                                services.store.roles[recordName] = {
                                    [otherUserId]: new Set(['developer']),
                                };

                                await server.login(serverConnectionId, 1, {
                                    type: 'login',
                                    connectionToken: otherUserToken,
                                });

                                await server.watchBranch(serverConnectionId, {
                                    type: 'repo/watch_branch',
                                    recordName,
                                    inst: 'otherInst',
                                    branch: 'testBranch',
                                });

                                expect(
                                    messenger
                                        .getMessages(serverConnectionId)
                                        .slice(1)
                                ).toEqual([
                                    {
                                        type: 'repo/watch_branch_result',
                                        success: false,
                                        errorCode: 'not_authorized',
                                        errorMessage:
                                            'You are not authorized to access this inst.',
                                        recordName,
                                        inst: 'otherInst',
                                        branch: 'testBranch',
                                        reason: {
                                            type: 'invalid_token',
                                        },
                                    },
                                ]);

                                expect(
                                    messenger.getEvents(serverConnectionId)
                                ).toEqual([]);
                            });

                            it('should succeed if the user is the record owner', async () => {
                                await server.login(serverConnectionId, 1, {
                                    type: 'login',
                                    connectionToken: connectionToken,
                                });

                                await server.watchBranch(serverConnectionId, {
                                    type: 'repo/watch_branch',
                                    recordName,
                                    inst,
                                    branch: 'testBranch',
                                });

                                expect(
                                    messenger.getEvents(serverConnectionId)
                                ).toEqual([]);
                            });

                            it('should succeed if the user has been granted permission', async () => {
                                await services.policyStore.assignPermissionToSubjectAndMarker(
                                    recordName,
                                    'role',
                                    'developer',
                                    'inst',
                                    PRIVATE_MARKER,
                                    'read',
                                    {},
                                    null
                                );

                                services.store.roles[recordName] = {
                                    [otherUserId]: new Set(['developer']),
                                };

                                await server.login(serverConnectionId, 1, {
                                    type: 'login',
                                    connectionToken: otherUserToken,
                                });

                                await server.watchBranch(serverConnectionId, {
                                    type: 'repo/watch_branch',
                                    recordName,
                                    inst,
                                    branch: 'testBranch',
                                });

                                expect(
                                    messenger.getEvents(serverConnectionId)
                                ).toEqual([]);
                            });

                            it('should return a not_authorized error if insts are not allowed', async () => {
                                store.subscriptionConfiguration =
                                    buildSubscriptionConfig((config) =>
                                        config.addSubscription('sub1', (sub) =>
                                            sub
                                                .withTier('tier1')
                                                .withAllDefaultFeatures()
                                                .withInsts({
                                                    allowed: false,
                                                })
                                        )
                                    );

                                await store.saveUser({
                                    id: userId,
                                    allSessionRevokeTimeMs: null,
                                    currentLoginRequestId: null,
                                    email: 'test@example.com',
                                    phoneNumber: null,
                                    subscriptionId: 'sub1',
                                    subscriptionStatus: 'active',
                                });

                                await server.login(serverConnectionId, 1, {
                                    type: 'login',
                                    connectionToken,
                                });

                                await server.watchBranch(serverConnectionId, {
                                    type: 'repo/watch_branch',
                                    recordName,
                                    inst,
                                    branch: 'test',
                                });

                                expect(
                                    messenger
                                        .getMessages(serverConnectionId)
                                        .slice(1)
                                ).toEqual([
                                    {
                                        type: 'repo/watch_branch_result',
                                        success: false,
                                        errorCode: 'not_authorized',
                                        errorMessage:
                                            'Insts are not allowed for this subscription.',
                                        recordName,
                                        inst,
                                        branch: 'test',
                                    },
                                ]);

                                expect(
                                    messenger.getEvents(serverConnectionId)
                                ).toEqual([]);
                            });

                            it('should return a subscription_limit_reached error the subscription has reached the maximum connections to a branch', async () => {
                                store.subscriptionConfiguration =
                                    buildSubscriptionConfig((config) =>
                                        config.addSubscription('sub1', (sub) =>
                                            sub
                                                .withTier('tier1')
                                                .withAllDefaultFeatures()
                                                .withInsts()
                                                .withMaxActiveConnectionsPerInst(
                                                    1
                                                )
                                        )
                                    );

                                await store.saveUser({
                                    id: userId,
                                    allSessionRevokeTimeMs: null,
                                    currentLoginRequestId: null,
                                    email: 'test@example.com',
                                    phoneNumber: null,
                                    subscriptionId: 'sub1',
                                    subscriptionStatus: 'active',
                                });

                                await instStore.saveInst({
                                    recordName,
                                    inst: 'otherInst',
                                    markers: [PRIVATE_MARKER],
                                });

                                await server.login(serverConnectionId, 1, {
                                    type: 'login',
                                    connectionToken,
                                });

                                await server.watchBranch(serverConnectionId, {
                                    type: 'repo/watch_branch',
                                    recordName,
                                    inst,
                                    branch: 'test',
                                });

                                expect(
                                    messenger.getEvents(serverConnectionId)
                                ).toEqual([]);

                                const otherConnectionToken =
                                    generateV1ConnectionToken(
                                        connectionKey,
                                        'otherConnectionId',
                                        recordName,
                                        inst
                                    );

                                const otherServerConnectionId =
                                    'otherServerConnectionId';

                                await server.login(otherServerConnectionId, 1, {
                                    type: 'login',
                                    connectionToken: otherConnectionToken,
                                });

                                await server.watchBranch(
                                    otherServerConnectionId,
                                    {
                                        type: 'repo/watch_branch',
                                        recordName,
                                        inst,
                                        branch: 'test',
                                    }
                                );

                                expect(
                                    messenger
                                        .getMessages(otherServerConnectionId)
                                        .slice(1)
                                ).toEqual([
                                    {
                                        type: 'repo/watch_branch_result',
                                        success: false,
                                        errorCode: 'subscription_limit_reached',
                                        errorMessage:
                                            'The maximum number of active connections to this inst has been reached.',
                                        recordName,
                                        inst,
                                        branch: 'test',
                                    },
                                ]);

                                expect(
                                    messenger.getEvents(otherServerConnectionId)
                                ).toEqual([]);
                            });
                        });
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
                            type: 'repo/watch_branch_result',
                            success: true,
                            recordName: null,
                            inst,
                            branch: 'testBranch',
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
                        await tempUpdatesStore.getUpdates(
                            null,
                            inst,
                            'testBranch'
                        )
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
                        await tempUpdatesStore.getUpdates(
                            null,
                            inst,
                            'testBranch'
                        )
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

            it('should return a invalid_connection_state error if the connection cannot be found in Redis', async () => {
                await server.getUpdates(
                    device1Info.serverConnectionId,
                    null,
                    inst,
                    'testBranch'
                );
                expect(
                    messenger.getEvents(device1Info.serverConnectionId)
                ).toEqual([
                    [
                        WebsocketEventTypes.Error,
                        -1,
                        {
                            success: false,
                            errorCode: 'invalid_connection_state',
                            errorMessage: `A server error occurred. (namespace: null/${inst}/${'testBranch'}, connectionId: ${
                                device1Info.serverConnectionId
                            })`,
                            recordName: null,
                            inst: inst,
                            branch: 'testBranch',
                        },
                    ],
                ]);
                expect(
                    messenger.isDisconnected(device1Info.serverConnectionId)
                ).toBe(true);
            });

            describe('records', () => {
                it('should return a inst_not_found error if the record does not exist', async () => {
                    await server.login(serverConnectionId, 1, {
                        type: 'login',
                        connectionToken,
                    });

                    await server.getUpdates(
                        serverConnectionId,
                        recordName,
                        inst,
                        'test'
                    );

                    expect(messenger.getEvents(serverConnectionId)).toEqual([
                        [
                            WebsocketEventTypes.Error,
                            -1,
                            {
                                success: false,
                                errorCode: 'inst_not_found',
                                errorMessage: 'The inst was not found.',
                                recordName,
                                inst,
                                branch: 'test',
                            },
                        ],
                    ]);
                });

                describe('private', () => {
                    beforeEach(async () => {
                        await services.records.createRecord({
                            userId,
                            recordName,
                            ownerId: userId,
                        });
                    });

                    it('should return a inst_not_found error if the inst does not exist', async () => {
                        await server.login(serverConnectionId, 1, {
                            type: 'login',
                            connectionToken,
                        });

                        await server.getUpdates(
                            serverConnectionId,
                            recordName,
                            inst,
                            'test'
                        );

                        expect(messenger.getEvents(serverConnectionId)).toEqual(
                            [
                                [
                                    WebsocketEventTypes.Error,
                                    -1,
                                    {
                                        success: false,
                                        errorCode: 'inst_not_found',
                                        errorMessage: 'The inst was not found.',
                                        recordName,
                                        inst,
                                        branch: 'test',
                                    },
                                ],
                            ]
                        );
                    });

                    describe('token', () => {
                        const otherUserConnectionId = 'otherConnectionId';
                        let otherUserId: string;
                        let otherUserConnectionKey: string;
                        let otherUserToken: string;

                        beforeEach(async () => {
                            uuidMock.mockReturnValueOnce('otherUserId');
                            const otherUser = await createTestUser(
                                services,
                                'other@example.com'
                            );
                            otherUserToken = generateV1ConnectionToken(
                                otherUser.connectionKey,
                                otherUserConnectionId,
                                recordName,
                                inst
                            );
                            otherUserId = otherUser.userId;
                            otherUserConnectionKey = otherUser.connectionKey;

                            await instStore.saveInst({
                                recordName,
                                inst,
                                markers: [PRIVATE_MARKER],
                            });
                        });

                        it('should return a not_authorized error if the user is trying to read an inst in a record they do not have access to', async () => {
                            await server.login(serverConnectionId, 1, {
                                type: 'login',
                                connectionToken: otherUserToken,
                            });

                            await server.getUpdates(
                                serverConnectionId,
                                recordName,
                                inst,
                                'test'
                            );

                            expect(
                                messenger.getEvents(serverConnectionId)
                            ).toEqual([
                                [
                                    WebsocketEventTypes.Error,
                                    -1,
                                    {
                                        success: false,
                                        errorCode: 'not_authorized',
                                        errorMessage:
                                            'You are not authorized to perform this action.',
                                        recordName,
                                        inst,
                                        branch: 'test',
                                        reason: {
                                            type: 'missing_permission',
                                            recordName,
                                            resourceKind: 'inst',
                                            resourceId: inst,
                                            action: 'read',
                                            subjectType: 'user',
                                            subjectId: otherUserId,
                                        },
                                    },
                                ],
                            ]);
                        });

                        it('should return a not_authorized error if the user token doesnt match the inst', async () => {
                            await instStore.saveInst({
                                recordName,
                                inst: 'otherInst',
                                markers: [PRIVATE_MARKER],
                            });

                            await services.store.assignPermissionToSubjectAndMarker(
                                recordName,
                                'role',
                                'developer',
                                'inst',
                                PRIVATE_MARKER,
                                'read',
                                {},
                                null
                            );

                            services.store.roles[recordName] = {
                                [otherUserId]: new Set(['developer']),
                            };

                            await server.login(serverConnectionId, 1, {
                                type: 'login',
                                connectionToken: otherUserToken,
                            });

                            await server.getUpdates(
                                serverConnectionId,
                                recordName,
                                'otherInst',
                                'test'
                            );

                            expect(
                                messenger.getEvents(serverConnectionId)
                            ).toEqual([
                                [
                                    WebsocketEventTypes.Error,
                                    -1,
                                    {
                                        success: false,
                                        errorCode: 'not_authorized',
                                        errorMessage:
                                            'You are not authorized to access this inst.',
                                        recordName,
                                        inst: 'otherInst',
                                        branch: 'test',
                                        reason: {
                                            type: 'invalid_token',
                                        },
                                    },
                                ],
                            ]);
                        });

                        it('should succeed if the user is the record owner', async () => {
                            await server.login(serverConnectionId, 1, {
                                type: 'login',
                                connectionToken: connectionToken,
                            });

                            await server.getUpdates(
                                serverConnectionId,
                                recordName,
                                inst,
                                'test'
                            );

                            expect(
                                messenger.getEvents(serverConnectionId)
                            ).toEqual([]);
                            expect(
                                messenger
                                    .getMessages(serverConnectionId)
                                    .slice(1)
                            ).toEqual([
                                {
                                    type: 'repo/add_updates',
                                    recordName,
                                    inst,
                                    branch: 'test',
                                    updates: [],
                                    timestamps: [],
                                },
                            ]);
                        });

                        it('should succeed if the user has been granted access', async () => {
                            await services.policyStore.assignPermissionToSubjectAndMarker(
                                recordName,
                                'role',
                                'developer',
                                'inst',
                                PRIVATE_MARKER,
                                'read',
                                {},
                                null
                            );

                            services.store.roles[recordName] = {
                                [otherUserId]: new Set(['developer']),
                            };

                            await server.login(serverConnectionId, 1, {
                                type: 'login',
                                connectionToken: otherUserToken,
                            });

                            await server.getUpdates(
                                serverConnectionId,
                                recordName,
                                inst,
                                'test'
                            );

                            expect(
                                messenger.getEvents(serverConnectionId)
                            ).toEqual([]);
                            expect(
                                messenger
                                    .getMessages(serverConnectionId)
                                    .slice(1)
                            ).toEqual([
                                {
                                    type: 'repo/add_updates',
                                    recordName,
                                    inst,
                                    branch: 'test',
                                    updates: [],
                                    timestamps: [],
                                },
                            ]);
                        });

                        it('should return a not_authorized error if insts are not allowed', async () => {
                            store.subscriptionConfiguration =
                                buildSubscriptionConfig((config) =>
                                    config.addSubscription('sub1', (sub) =>
                                        sub
                                            .withTier('tier1')
                                            .withAllDefaultFeatures()
                                            .withInsts({
                                                allowed: false,
                                            })
                                    )
                                );

                            await store.saveUser({
                                id: userId,
                                allSessionRevokeTimeMs: null,
                                currentLoginRequestId: null,
                                email: 'test@example.com',
                                phoneNumber: null,
                                subscriptionId: 'sub1',
                                subscriptionStatus: 'active',
                            });

                            await server.login(serverConnectionId, 1, {
                                type: 'login',
                                connectionToken: otherUserToken,
                            });

                            await server.getUpdates(
                                serverConnectionId,
                                recordName,
                                inst,
                                'test'
                            );

                            expect(
                                messenger.getEvents(serverConnectionId)
                            ).toEqual([
                                [
                                    WebsocketEventTypes.Error,
                                    -1,
                                    {
                                        success: false,
                                        errorCode: 'not_authorized',
                                        errorMessage:
                                            'Insts are not allowed for this subscription.',
                                        recordName,
                                        inst,
                                        branch: 'test',
                                    },
                                ],
                            ]);
                            expect(
                                messenger
                                    .getMessages(serverConnectionId)
                                    .slice(1)
                            ).toEqual([]);
                        });
                    });
                });
            });
        });

        describe('repo/add_updates', () => {
            describe('no record', () => {
                const recordName: string | null = null;

                it('should create the branch if it does not exist', async () => {
                    await connectionStore.saveConnection(device1Info);

                    await server.addUpdates(device1Info.serverConnectionId, {
                        type: 'repo/add_updates',
                        recordName: recordName,
                        inst,
                        branch: 'testBranch',
                        updates: ['111', '222'],
                        updateId: 0,
                    });

                    await instStore.addUpdates(
                        recordName,
                        inst,
                        'testBranch',
                        ['333'],
                        3
                    );

                    await server.watchBranch(device1Info.serverConnectionId, {
                        type: 'repo/watch_branch',
                        recordName: recordName,
                        inst,
                        branch: 'testBranch',
                        protocol: 'updates',
                    });

                    expect(
                        await instStore.getBranchByName(
                            recordName,
                            inst,
                            'testBranch'
                        )
                    ).toEqual({
                        recordName: recordName,
                        inst,
                        branch: 'testBranch',
                        temporary: false,
                        linkedInst: !recordName
                            ? null
                            : {
                                  recordName,
                                  inst,
                                  markers: [PUBLIC_WRITE_MARKER],
                              },
                    });
                    expect(
                        messenger.getMessages(device1Info.serverConnectionId)
                    ).toEqual([
                        // Server should send a atoms received event
                        // back indicating which atoms it processed
                        {
                            type: 'repo/updates_received',
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            updateId: 0,
                        },

                        {
                            type: 'repo/add_updates',
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            updates: ['111', '222', '333'],
                            initial: true,
                        },

                        {
                            type: 'repo/watch_branch_result',
                            success: true,
                            inst,
                            branch: 'testBranch',
                            recordName: recordName,
                        },
                    ]);
                });

                it('should add the given updates to the given branch', async () => {
                    await connectionStore.saveConnection(device1Info);

                    await server.addUpdates(device1Info.serverConnectionId, {
                        type: 'repo/add_updates',
                        recordName: recordName,
                        inst,
                        branch: 'testBranch',
                        updates: ['111', '222'],
                        updateId: 0,
                    });

                    await instStore.addUpdates(
                        recordName,
                        inst,
                        'testBranch',
                        ['333'],
                        3
                    );

                    await server.watchBranch(device1Info.serverConnectionId, {
                        type: 'repo/watch_branch',
                        recordName: recordName,
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
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            updateId: 0,
                        },

                        {
                            type: 'repo/add_updates',
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            updates: ['111', '222', '333'],
                            initial: true,
                        },

                        {
                            type: 'repo/watch_branch_result',
                            success: true,
                            inst,
                            branch: 'testBranch',
                            recordName: recordName,
                        },
                    ]);

                    const updates = await instStore.getCurrentUpdates(
                        recordName,
                        inst,
                        'testBranch'
                    );

                    expect(updates).toEqual({
                        updates: ['111', '222', '333'],
                        timestamps: [
                            expect.any(Number),
                            expect.any(Number),
                            expect.any(Number),
                        ],
                        instSizeInBytes: 9,
                    });

                    const dirtyBranches =
                        await instStore.temp.listDirtyBranches();

                    // Should not record the branch as dirty if it doesn't have a record name
                    if (!recordName) {
                        expect(dirtyBranches).toEqual([]);
                    } else {
                        expect(dirtyBranches).toEqual([
                            {
                                recordName: recordName,
                                inst,
                                branch: 'testBranch',
                            },
                        ]);
                    }
                });

                it('should notify all other devices connected to the branch', async () => {
                    await connectionStore.saveConnection(device1Info);
                    await connectionStore.saveConnection(device2Info);
                    await connectionStore.saveConnection(device3Info);

                    await instStore.addUpdates(
                        recordName,
                        inst,
                        'testBranch',
                        ['111', '222'],
                        6
                    );

                    await server.watchBranch(device2Info.serverConnectionId, {
                        type: 'repo/watch_branch',
                        recordName: recordName,
                        inst,
                        branch: 'testBranch',
                        protocol: 'updates',
                    });

                    await server.watchBranch(device3Info.serverConnectionId, {
                        type: 'repo/watch_branch',
                        recordName: recordName,
                        inst,
                        branch: 'testBranch',
                        protocol: 'updates',
                    });

                    await server.addUpdates(device1Info.serverConnectionId, {
                        type: 'repo/add_updates',
                        recordName: recordName,
                        inst,
                        branch: 'testBranch',
                        updates: ['333'],
                    });

                    expect(
                        messenger.getMessages(device2Info.serverConnectionId)
                    ).toEqual([
                        {
                            type: 'repo/add_updates',
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            updates: ['111', '222'],
                            initial: true,
                        },
                        {
                            type: 'repo/watch_branch_result',
                            success: true,
                            inst,
                            branch: 'testBranch',
                            recordName: recordName,
                        },
                        {
                            type: 'repo/add_updates',
                            recordName: recordName,
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
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            updates: ['111', '222'],
                            initial: true,
                        },
                        {
                            type: 'repo/watch_branch_result',
                            success: true,
                            inst,
                            branch: 'testBranch',
                            recordName: recordName,
                        },

                        {
                            type: 'repo/add_updates',
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            updates: ['333'],
                        },
                    ]);
                });

                it('should not notify the device that sent the new atoms', async () => {
                    await connectionStore.saveConnection(device1Info);

                    await instStore.addUpdates(
                        recordName,
                        inst,
                        'testBranch',
                        ['111', '222'],
                        6
                    );

                    await server.watchBranch(device1Info.serverConnectionId, {
                        type: 'repo/watch_branch',
                        recordName: recordName,
                        inst,
                        branch: 'testBranch',
                        protocol: 'updates',
                    });

                    await server.addUpdates(device1Info.serverConnectionId, {
                        type: 'repo/add_updates',
                        recordName: recordName,
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
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            updates: ['111', '222'],
                            initial: true,
                        },
                        {
                            type: 'repo/watch_branch_result',
                            success: true,
                            inst,
                            branch: 'testBranch',
                            recordName: recordName,
                        },

                        // Server should send a atoms received event
                        // back indicating which atoms it processed
                        {
                            type: 'repo/updates_received',
                            recordName: recordName,
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
                        recordName: recordName,
                        inst,
                        branch: 'testBranch',
                        updates: ['111', '222'],
                        updateId: 0,
                    });

                    const updates = await instStore.getCurrentUpdates(
                        recordName,
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
                        recordName: recordName,
                        inst,
                        branch: null as any,
                        updates: ['111'],
                    });
                });

                it('should not crash if adding atoms to a branch that does not exist', async () => {
                    await connectionStore.saveConnection(device1Info);

                    await server.addUpdates(device1Info.serverConnectionId, {
                        type: 'repo/add_updates',
                        recordName: recordName,
                        inst,
                        branch: 'abc',
                        updates: ['111'],
                    });

                    expect(
                        await instStore.getCurrentUpdates(
                            recordName,
                            inst,
                            'abc'
                        )
                    ).toEqual({
                        updates: ['111'],
                        timestamps: [expect.any(Number)],
                        instSizeInBytes: 3,
                    });
                });

                it('should return a not_authorized error if recordless insts are not allowed', async () => {
                    store.subscriptionConfiguration = buildSubscriptionConfig(
                        (config) =>
                            config.withPublicInsts({
                                allowed: false,
                            })
                    );

                    await connectionStore.saveConnection(device1Info);

                    await server.addUpdates(device1Info.serverConnectionId, {
                        type: 'repo/add_updates',
                        recordName: null,
                        inst,
                        branch: 'doesNotExist',
                        updates: ['111', '222'],
                        updateId: 0,
                    });

                    expect(
                        messenger.getEvents(device1Info.serverConnectionId)
                    ).toEqual([
                        [
                            WebsocketEventTypes.Error,
                            -1,
                            {
                                success: false,
                                errorCode: 'not_authorized',
                                errorMessage:
                                    'Temporary insts are not allowed.',
                                recordName,
                                inst,
                                branch: 'doesNotExist',
                            },
                        ],
                    ]);

                    expect(
                        await instStore.getBranchByName(
                            null,
                            inst,
                            'doesNotExist'
                        )
                    ).toEqual(null);
                    // Should not create an inst when the record name is null.
                    expect(await instStore.getInstByName(null, inst)).toBe(
                        null
                    );
                });

                it('should return a max_size_reached error if it would exceed the maximum inst size for recordless insts', async () => {
                    store.subscriptionConfiguration = buildSubscriptionConfig(
                        (config) =>
                            config.withPublicInsts({
                                allowed: true,
                                maxBytesPerInst: 1,
                            })
                    );

                    await connectionStore.saveConnection(device1Info);

                    await server.addUpdates(device1Info.serverConnectionId, {
                        type: 'repo/add_updates',
                        recordName: null,
                        inst,
                        branch: 'doesNotExist',
                        updates: ['111', '222'],
                        updateId: 0,
                    });

                    expect(
                        messenger.getMessages(device1Info.serverConnectionId)
                    ).toEqual([
                        {
                            type: 'repo/updates_received',
                            recordName,
                            inst,
                            branch: 'doesNotExist',
                            updateId: 0,
                            errorCode: 'max_size_reached',
                            maxBranchSizeInBytes: 1,
                            neededBranchSizeInBytes: 6,
                        },
                    ]);
                });

                it('should return a invalid_connection_state error if the connection is not stored in the connection store', async () => {
                    await server.addUpdates(device1Info.serverConnectionId, {
                        type: 'repo/add_updates',
                        recordName: recordName,
                        inst,
                        branch: 'testBranch',
                        updates: ['111', '222'],
                        updateId: 0,
                    });

                    expect(
                        messenger.getEvents(device1Info.serverConnectionId)
                    ).toEqual([
                        [
                            WebsocketEventTypes.Error,
                            -1,
                            {
                                success: false,
                                errorCode: 'invalid_connection_state',
                                errorMessage: `A server error occurred. (namespace: ${recordName}/${inst}/${'testBranch'}, connectionId: ${
                                    device1Info.serverConnectionId
                                })`,
                                recordName: recordName,
                                inst: inst,
                                branch: 'testBranch',
                            },
                        ],
                    ]);
                    expect(
                        messenger.isDisconnected(device1Info.serverConnectionId)
                    ).toBe(true);
                });
            });

            describe('records', () => {
                beforeEach(async () => {
                    await services.records.createRecord({
                        userId,
                        recordName,
                        ownerId: userId,
                    });
                });

                it('should return a inst_not_found error if the record does not exist', async () => {
                    connectionToken = generateV1ConnectionToken(
                        connectionKey,
                        connectionId,
                        'otherRecord',
                        inst
                    );
                    await server.login(serverConnectionId, 1, {
                        type: 'login',
                        connectionToken,
                    });

                    await server.addUpdates(serverConnectionId, {
                        type: 'repo/add_updates',
                        recordName: 'otherRecord',
                        inst,
                        branch: 'testBranch',
                        updates: ['111', '222'],
                        updateId: 0,
                    });

                    expect(messenger.getEvents(serverConnectionId)).toEqual([
                        [
                            WebsocketEventTypes.Error,
                            -1,
                            {
                                success: false,
                                errorCode: 'record_not_found',
                                errorMessage: 'Record not found.',
                                recordName: 'otherRecord',
                                inst,
                                branch: 'testBranch',
                            },
                        ],
                    ]);
                    expect(
                        messenger.getMessages(serverConnectionId).slice(1)
                    ).toEqual([]);
                });

                describe('owner', () => {
                    it('should create the inst if it does not exist', async () => {
                        await server.login(serverConnectionId, 1, {
                            type: 'login',
                            connectionToken,
                        });

                        await server.addUpdates(serverConnectionId, {
                            type: 'repo/add_updates',
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            updates: ['111', '222'],
                            updateId: 0,
                        });

                        await instStore.addUpdates(
                            recordName,
                            inst,
                            'testBranch',
                            ['333'],
                            3
                        );

                        await server.watchBranch(serverConnectionId, {
                            type: 'repo/watch_branch',
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            protocol: 'updates',
                        });

                        expect(
                            await instStore.getBranchByName(
                                recordName,
                                inst,
                                'testBranch'
                            )
                        ).toEqual({
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            temporary: false,
                            linkedInst: {
                                recordName,
                                inst,
                                markers: [PRIVATE_MARKER],
                            },
                        });
                        expect(
                            messenger.getMessages(serverConnectionId).slice(1)
                        ).toEqual([
                            // Server should send a atoms received event
                            // back indicating which atoms it processed
                            {
                                type: 'repo/updates_received',
                                recordName: recordName,
                                inst,
                                branch: 'testBranch',
                                updateId: 0,
                            },

                            {
                                type: 'repo/add_updates',
                                recordName: recordName,
                                inst,
                                branch: 'testBranch',
                                updates: ['111', '222', '333'],
                                initial: true,
                            },

                            {
                                type: 'repo/watch_branch_result',
                                success: true,
                                inst,
                                branch: 'testBranch',
                                recordName: recordName,
                            },
                        ]);
                        expect(messenger.getEvents(serverConnectionId)).toEqual(
                            []
                        );
                    });

                    it('should create the record if it matches the user ID', async () => {
                        const recordName = userId;
                        connectionToken = generateV1ConnectionToken(
                            connectionKey,
                            connectionId,
                            recordName,
                            inst
                        );
                        await server.login(serverConnectionId, 1, {
                            type: 'login',
                            connectionToken,
                        });

                        await server.addUpdates(serverConnectionId, {
                            type: 'repo/add_updates',
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            updates: ['111', '222'],
                            updateId: 0,
                        });

                        await instStore.addUpdates(
                            recordName,
                            inst,
                            'testBranch',
                            ['333'],
                            3
                        );

                        expect(messenger.getEvents(serverConnectionId)).toEqual(
                            []
                        );

                        await server.watchBranch(serverConnectionId, {
                            type: 'repo/watch_branch',
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            protocol: 'updates',
                        });

                        expect(
                            await instStore.getBranchByName(
                                recordName,
                                inst,
                                'testBranch'
                            )
                        ).toEqual({
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            temporary: false,
                            linkedInst: {
                                recordName,
                                inst,
                                markers: [PRIVATE_MARKER],
                            },
                        });
                        expect(
                            messenger.getMessages(serverConnectionId).slice(1)
                        ).toEqual([
                            // Server should send a atoms received event
                            // back indicating which atoms it processed
                            {
                                type: 'repo/updates_received',
                                recordName: recordName,
                                inst,
                                branch: 'testBranch',
                                updateId: 0,
                            },

                            {
                                type: 'repo/add_updates',
                                recordName: recordName,
                                inst,
                                branch: 'testBranch',
                                updates: ['111', '222', '333'],
                                initial: true,
                            },

                            {
                                type: 'repo/watch_branch_result',
                                success: true,
                                inst,
                                branch: 'testBranch',
                                recordName: recordName,
                            },
                        ]);
                    });

                    it('should add the given updates to the given branch', async () => {
                        await server.login(serverConnectionId, 1, {
                            type: 'login',
                            connectionToken,
                        });

                        await server.addUpdates(serverConnectionId, {
                            type: 'repo/add_updates',
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            updates: ['111', '222'],
                            updateId: 0,
                        });

                        await instStore.addUpdates(
                            recordName,
                            inst,
                            'testBranch',
                            ['333'],
                            3
                        );

                        await server.watchBranch(serverConnectionId, {
                            type: 'repo/watch_branch',
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            protocol: 'updates',
                        });

                        expect(
                            messenger.getMessages(serverConnectionId).slice(1)
                        ).toEqual([
                            // Server should send a atoms received event
                            // back indicating which atoms it processed
                            {
                                type: 'repo/updates_received',
                                recordName: recordName,
                                inst,
                                branch: 'testBranch',
                                updateId: 0,
                            },

                            {
                                type: 'repo/add_updates',
                                recordName: recordName,
                                inst,
                                branch: 'testBranch',
                                updates: ['111', '222', '333'],
                                initial: true,
                            },

                            {
                                type: 'repo/watch_branch_result',
                                success: true,
                                inst,
                                branch: 'testBranch',
                                recordName: recordName,
                            },
                        ]);

                        const updates = await instStore.getCurrentUpdates(
                            recordName,
                            inst,
                            'testBranch'
                        );

                        expect(updates).toEqual({
                            updates: ['111', '222', '333'],
                            timestamps: [
                                expect.any(Number),
                                expect.any(Number),
                                expect.any(Number),
                            ],
                            instSizeInBytes: 9,
                        });

                        const dirtyBranches =
                            await instStore.temp.listDirtyBranches();

                        // Should not record the branch as dirty if it doesn't have a record name
                        if (!recordName) {
                            expect(dirtyBranches).toEqual([]);
                        } else {
                            expect(dirtyBranches).toEqual([
                                {
                                    recordName: recordName,
                                    inst,
                                    branch: 'testBranch',
                                },
                            ]);
                        }
                        expect(messenger.getEvents(serverConnectionId)).toEqual(
                            []
                        );
                    });

                    it('should notify all other devices connected to the branch', async () => {
                        await server.login(serverConnectionId, 1, {
                            type: 'login',
                            connectionToken,
                        });
                        await connectionStore.saveConnection(device2Info);
                        await connectionStore.saveConnection(device3Info);
                        await connectionStore.saveBranchConnection({
                            mode: 'branch',
                            ...device2Info,
                            recordName,
                            inst,
                            branch: 'testBranch',
                            temporary: false,
                        });
                        await connectionStore.saveBranchConnection({
                            mode: 'branch',
                            ...device3Info,
                            recordName,
                            inst,
                            branch: 'testBranch',
                            temporary: false,
                        });

                        await instStore.addUpdates(
                            recordName,
                            inst,
                            'testBranch',
                            ['111', '222'],
                            6
                        );

                        await server.addUpdates(serverConnectionId, {
                            type: 'repo/add_updates',
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            updates: ['333'],
                        });

                        expect(
                            messenger.getMessages(
                                device2Info.serverConnectionId
                            )
                        ).toEqual([
                            {
                                type: 'repo/add_updates',
                                recordName: recordName,
                                inst,
                                branch: 'testBranch',
                                updates: ['333'],
                            },
                        ]);

                        expect(
                            messenger.getMessages(
                                device3Info.serverConnectionId
                            )
                        ).toEqual([
                            {
                                type: 'repo/add_updates',
                                recordName: recordName,
                                inst,
                                branch: 'testBranch',
                                updates: ['333'],
                            },
                        ]);
                        expect(messenger.getEvents(serverConnectionId)).toEqual(
                            []
                        );
                    });

                    it('should not notify the device that sent the new atoms', async () => {
                        await server.login(serverConnectionId, 1, {
                            type: 'login',
                            connectionToken,
                        });

                        await instStore.addUpdates(
                            recordName,
                            inst,
                            'testBranch',
                            ['111', '222'],
                            6
                        );

                        await server.watchBranch(serverConnectionId, {
                            type: 'repo/watch_branch',
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            protocol: 'updates',
                        });

                        await server.addUpdates(serverConnectionId, {
                            type: 'repo/add_updates',
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            updates: ['333'],
                            updateId: 0,
                        });

                        expect(
                            messenger.getMessages(serverConnectionId).slice(1)
                        ).toEqual([
                            {
                                type: 'repo/add_updates',
                                recordName: recordName,
                                inst,
                                branch: 'testBranch',
                                updates: ['111', '222'],
                                initial: true,
                            },

                            {
                                type: 'repo/watch_branch_result',
                                success: true,
                                inst,
                                branch: 'testBranch',
                                recordName: recordName,
                            },

                            // Server should send a atoms received event
                            // back indicating which atoms it processed
                            {
                                type: 'repo/updates_received',
                                recordName: recordName,
                                inst,
                                branch: 'testBranch',
                                updateId: 0,
                            },
                        ]);
                        expect(messenger.getEvents(serverConnectionId)).toEqual(
                            []
                        );
                    });

                    it('should immediately store the added atoms', async () => {
                        await server.login(serverConnectionId, 1, {
                            type: 'login',
                            connectionToken,
                        });

                        await server.addUpdates(serverConnectionId, {
                            type: 'repo/add_updates',
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            updates: ['111', '222'],
                            updateId: 0,
                        });

                        const updates = await instStore.getCurrentUpdates(
                            recordName,
                            inst,
                            'testBranch'
                        );

                        expect(updates).toEqual({
                            updates: ['111', '222'],
                            timestamps: [
                                expect.any(Number),
                                expect.any(Number),
                            ],
                            instSizeInBytes: 6,
                        });
                        expect(messenger.getEvents(serverConnectionId)).toEqual(
                            []
                        );
                    });

                    it('should ignore when given an event with a null branch', async () => {
                        await server.login(serverConnectionId, 1, {
                            type: 'login',
                            connectionToken,
                        });

                        await server.addUpdates(serverConnectionId, {
                            type: 'repo/add_updates',
                            recordName: recordName,
                            inst,
                            branch: null as any,
                            updates: ['111'],
                        });
                        expect(messenger.getEvents(serverConnectionId)).toEqual(
                            []
                        );
                    });

                    it('should not crash if adding atoms to a branch that does not exist', async () => {
                        await server.login(serverConnectionId, 1, {
                            type: 'login',
                            connectionToken,
                        });

                        await server.addUpdates(serverConnectionId, {
                            type: 'repo/add_updates',
                            recordName: recordName,
                            inst,
                            branch: 'abc',
                            updates: ['111'],
                        });

                        expect(
                            await instStore.getCurrentUpdates(
                                recordName,
                                inst,
                                'abc'
                            )
                        ).toEqual({
                            updates: ['111'],
                            timestamps: [expect.any(Number)],
                            instSizeInBytes: 3,
                        });
                        expect(messenger.getEvents(serverConnectionId)).toEqual(
                            []
                        );
                    });

                    it('should return a not_authorized error if insts are not allowed', async () => {
                        store.subscriptionConfiguration =
                            buildSubscriptionConfig((config) =>
                                config.addSubscription('sub1', (sub) =>
                                    sub
                                        .withTier('tier1')
                                        .withAllDefaultFeatures()
                                        .withInsts({
                                            allowed: false,
                                        })
                                )
                            );

                        await store.saveUser({
                            id: userId,
                            allSessionRevokeTimeMs: null,
                            currentLoginRequestId: null,
                            email: 'test@example.com',
                            phoneNumber: null,
                            subscriptionId: 'sub1',
                            subscriptionStatus: 'active',
                        });

                        await server.login(serverConnectionId, 1, {
                            type: 'login',
                            connectionToken,
                        });

                        await server.addUpdates(serverConnectionId, {
                            type: 'repo/add_updates',
                            recordName,
                            inst,
                            branch: 'testBranch',
                            updates: ['111', '222'],
                            updateId: 0,
                        });

                        expect(messenger.getEvents(serverConnectionId)).toEqual(
                            [
                                [
                                    WebsocketEventTypes.Error,
                                    -1,
                                    {
                                        success: false,
                                        errorCode: 'not_authorized',
                                        errorMessage:
                                            'Insts are not allowed for this subscription.',
                                        recordName,
                                        inst,
                                        branch: 'testBranch',
                                    },
                                ],
                            ]
                        );
                        expect(
                            messenger.getMessages(serverConnectionId).slice(1)
                        ).toEqual([]);
                    });

                    it('should return a subscription_limit_reached error if creating the inst would exceed the allowed max insts', async () => {
                        store.subscriptionConfiguration =
                            buildSubscriptionConfig((config) =>
                                config.addSubscription('sub1', (sub) =>
                                    sub
                                        .withTier('tier1')
                                        .withAllDefaultFeatures()
                                        .withInsts()
                                        .withMaxInsts(1)
                                )
                            );

                        await store.saveUser({
                            id: userId,
                            allSessionRevokeTimeMs: null,
                            currentLoginRequestId: null,
                            email: 'test@example.com',
                            phoneNumber: null,
                            subscriptionId: 'sub1',
                            subscriptionStatus: 'active',
                        });

                        await instStore.saveInst({
                            recordName,
                            inst: 'otherInst',
                            markers: [PRIVATE_MARKER],
                        });

                        await server.login(serverConnectionId, 1, {
                            type: 'login',
                            connectionToken,
                        });

                        await server.addUpdates(serverConnectionId, {
                            type: 'repo/add_updates',
                            recordName,
                            inst,
                            branch: 'testBranch',
                            updates: ['111', '222'],
                            updateId: 0,
                        });

                        expect(messenger.getEvents(serverConnectionId)).toEqual(
                            [
                                [
                                    WebsocketEventTypes.Error,
                                    -1,
                                    {
                                        success: false,
                                        errorCode: 'subscription_limit_reached',
                                        errorMessage:
                                            'The maximum number of insts has been reached.',
                                        recordName,
                                        inst,
                                        branch: 'testBranch',
                                    },
                                ],
                            ]
                        );
                        expect(
                            messenger.getMessages(serverConnectionId).slice(1)
                        ).toEqual([]);
                    });

                    it('should return a max_size_reached error if adding the updates to a new inst would exceed the allowed inst size', async () => {
                        store.subscriptionConfiguration =
                            buildSubscriptionConfig((config) =>
                                config.addSubscription('sub1', (sub) =>
                                    sub
                                        .withTier('tier1')
                                        .withAllDefaultFeatures()
                                        .withInsts()
                                        .withMaxBytesPerInst(1)
                                )
                            );

                        await store.saveUser({
                            id: userId,
                            allSessionRevokeTimeMs: null,
                            currentLoginRequestId: null,
                            email: 'test@example.com',
                            phoneNumber: null,
                            subscriptionId: 'sub1',
                            subscriptionStatus: 'active',
                        });

                        await server.login(serverConnectionId, 1, {
                            type: 'login',
                            connectionToken,
                        });

                        await server.addUpdates(serverConnectionId, {
                            type: 'repo/add_updates',
                            recordName,
                            inst,
                            branch: 'testBranch',
                            updates: ['111', '222'],
                            updateId: 0,
                        });

                        expect(
                            messenger.getMessages(serverConnectionId).slice(1)
                        ).toEqual([
                            {
                                type: 'repo/updates_received',
                                recordName,
                                inst,
                                branch: 'testBranch',
                                updateId: 0,
                                errorCode: 'max_size_reached',
                                maxBranchSizeInBytes: 1,
                                neededBranchSizeInBytes: 6,
                            },
                        ]);
                    });

                    it('should return a subscription_limit_reached error if adding the updates to an existing inst would exceed the allowed inst size', async () => {
                        store.subscriptionConfiguration =
                            buildSubscriptionConfig((config) =>
                                config.addSubscription('sub1', (sub) =>
                                    sub
                                        .withTier('tier1')
                                        .withAllDefaultFeatures()
                                        .withInsts()
                                        .withMaxBytesPerInst(100)
                                )
                            );

                        await store.saveUser({
                            id: userId,
                            allSessionRevokeTimeMs: null,
                            currentLoginRequestId: null,
                            email: 'test@example.com',
                            phoneNumber: null,
                            subscriptionId: 'sub1',
                            subscriptionStatus: 'active',
                        });

                        await instStore.saveInst({
                            recordName,
                            inst,
                            markers: [PRIVATE_MARKER],
                        });

                        await instStore.saveBranch({
                            recordName,
                            inst,
                            branch: 'testBranch',
                            temporary: false,
                        });

                        await instStore.addUpdates(
                            recordName,
                            inst,
                            'testBranch',
                            ['abc', 'def'],
                            99
                        );

                        await server.login(serverConnectionId, 1, {
                            type: 'login',
                            connectionToken,
                        });

                        await server.addUpdates(serverConnectionId, {
                            type: 'repo/add_updates',
                            recordName,
                            inst,
                            branch: 'testBranch',
                            updates: ['111', '222'],
                            updateId: 0,
                        });

                        expect(
                            messenger.getMessages(serverConnectionId).slice(1)
                        ).toEqual([
                            {
                                type: 'repo/updates_received',
                                recordName,
                                inst,
                                branch: 'testBranch',
                                updateId: 0,
                                errorCode: 'max_size_reached',
                                maxBranchSizeInBytes: 100,
                                neededBranchSizeInBytes: 105,
                            },
                        ]);
                    });
                });

                describe('guest', () => {
                    const otherUserConnectionId = 'otherConnectionId';
                    let otherUserId: string;
                    let otherUserConnectionKey: string;
                    let otherUserToken: string;

                    beforeEach(async () => {
                        uuidMock.mockReturnValueOnce('otherUserId');
                        const otherUser = await createTestUser(
                            services,
                            'other@example.com'
                        );
                        otherUserToken = generateV1ConnectionToken(
                            otherUser.connectionKey,
                            otherUserConnectionId,
                            recordName,
                            inst
                        );
                        otherUserId = otherUser.userId;
                        otherUserConnectionKey = otherUser.connectionKey;
                    });

                    it('should send a not_authorized error if the user is not authorized to create insts', async () => {
                        await server.login(serverConnectionId, 1, {
                            type: 'login',
                            connectionToken: otherUserToken,
                        });

                        await server.addUpdates(serverConnectionId, {
                            type: 'repo/add_updates',
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            updates: ['111', '222'],
                            updateId: 0,
                        });

                        expect(messenger.getEvents(serverConnectionId)).toEqual(
                            [
                                [
                                    WebsocketEventTypes.Error,
                                    -1,
                                    {
                                        success: false,
                                        errorCode: 'not_authorized',
                                        errorMessage:
                                            'You are not authorized to perform this action.',
                                        recordName,
                                        inst,
                                        branch: 'testBranch',
                                        reason: {
                                            type: 'missing_permission',
                                            recordName,
                                            resourceKind: 'inst',
                                            resourceId: inst,
                                            subjectType: 'user',
                                            subjectId: otherUserId,
                                            action: 'create',
                                        },
                                    },
                                ],
                            ]
                        );

                        expect(
                            await instStore.getBranchByName(
                                recordName,
                                inst,
                                'testBranch'
                            )
                        ).toEqual(null);
                        expect(
                            messenger.getMessages(serverConnectionId).slice(1)
                        ).toEqual([]);
                    });

                    describe('no branch', () => {
                        beforeEach(async () => {
                            await instStore.saveInst({
                                recordName,
                                inst,
                                markers: [PRIVATE_MARKER],
                            });

                            await server.login(serverConnectionId, 1, {
                                type: 'login',
                                connectionToken: otherUserToken,
                            });
                        });

                        it('should send a not_authorized error if the user is not authorized to read insts', async () => {
                            await server.addUpdates(serverConnectionId, {
                                type: 'repo/add_updates',
                                recordName: recordName,
                                inst,
                                branch: 'testBranch',
                                updates: ['111', '222'],
                                updateId: 0,
                            });

                            expect(
                                messenger.getEvents(serverConnectionId)
                            ).toEqual([
                                [
                                    WebsocketEventTypes.Error,
                                    -1,
                                    {
                                        success: false,
                                        errorCode: 'not_authorized',
                                        errorMessage:
                                            'You are not authorized to perform this action.',
                                        recordName,
                                        inst,
                                        branch: 'testBranch',
                                        reason: {
                                            type: 'missing_permission',
                                            recordName,
                                            resourceKind: 'inst',
                                            resourceId: inst,
                                            subjectType: 'user',
                                            subjectId: otherUserId,
                                            action: 'read',
                                        },
                                    },
                                ],
                            ]);

                            expect(
                                await instStore.getBranchByName(
                                    recordName,
                                    inst,
                                    'testBranch'
                                )
                            ).toEqual(null);
                            expect(
                                messenger
                                    .getMessages(serverConnectionId)
                                    .slice(1)
                            ).toEqual([]);
                        });

                        it('should send a not_authorized error if the user is not authorized to update inst data', async () => {
                            await services.policyStore.assignPermissionToSubjectAndMarker(
                                recordName,
                                'role',
                                'developer',
                                'inst',
                                PRIVATE_MARKER,
                                'read',
                                {},
                                null
                            );

                            services.policyStore.roles[recordName] = {
                                [otherUserId]: new Set(['developer']),
                            };

                            await server.addUpdates(serverConnectionId, {
                                type: 'repo/add_updates',
                                recordName: recordName,
                                inst,
                                branch: 'testBranch',
                                updates: ['111', '222'],
                                updateId: 0,
                            });

                            expect(
                                messenger.getEvents(serverConnectionId)
                            ).toEqual([
                                [
                                    WebsocketEventTypes.Error,
                                    -1,
                                    {
                                        success: false,
                                        errorCode: 'not_authorized',
                                        errorMessage:
                                            'You are not authorized to perform this action.',
                                        recordName,
                                        inst,
                                        branch: 'testBranch',
                                        reason: {
                                            type: 'missing_permission',
                                            recordName,
                                            resourceKind: 'inst',
                                            resourceId: inst,
                                            subjectType: 'user',
                                            subjectId: otherUserId,
                                            action: 'updateData',
                                        },
                                    },
                                ],
                            ]);

                            expect(
                                await instStore.getBranchByName(
                                    recordName,
                                    inst,
                                    'testBranch'
                                )
                            ).toEqual(null);
                            expect(
                                messenger
                                    .getMessages(serverConnectionId)
                                    .slice(1)
                            ).toEqual([]);
                        });
                    });

                    describe('branch', () => {
                        beforeEach(async () => {
                            await instStore.saveInst({
                                recordName,
                                inst,
                                markers: [PRIVATE_MARKER],
                            });

                            await instStore.saveBranch({
                                recordName,
                                inst,
                                branch: 'testBranch',
                                temporary: false,
                            });

                            await server.login(serverConnectionId, 1, {
                                type: 'login',
                                connectionToken: otherUserToken,
                            });
                        });

                        it('should send a not_authorized error if the user is not authorized to read insts', async () => {
                            await server.addUpdates(serverConnectionId, {
                                type: 'repo/add_updates',
                                recordName: recordName,
                                inst,
                                branch: 'testBranch',
                                updates: ['111', '222'],
                                updateId: 0,
                            });

                            expect(
                                messenger.getEvents(serverConnectionId)
                            ).toEqual([
                                [
                                    WebsocketEventTypes.Error,
                                    -1,
                                    {
                                        success: false,
                                        errorCode: 'not_authorized',
                                        errorMessage:
                                            'You are not authorized to perform this action.',
                                        recordName,
                                        inst,
                                        branch: 'testBranch',
                                        reason: {
                                            type: 'missing_permission',
                                            recordName,
                                            resourceKind: 'inst',
                                            resourceId: inst,
                                            subjectType: 'user',
                                            subjectId: otherUserId,
                                            action: 'read',
                                        },
                                    },
                                ],
                            ]);

                            expect(
                                messenger
                                    .getMessages(serverConnectionId)
                                    .slice(1)
                            ).toEqual([]);
                        });

                        it('should send a not_authorized error if the user is not authorized to update inst data', async () => {
                            await services.policyStore.assignPermissionToSubjectAndMarker(
                                recordName,
                                'role',
                                'developer',
                                'inst',
                                PRIVATE_MARKER,
                                'read',
                                {},
                                null
                            );

                            services.policyStore.roles[recordName] = {
                                [otherUserId]: new Set(['developer']),
                            };

                            await server.addUpdates(serverConnectionId, {
                                type: 'repo/add_updates',
                                recordName: recordName,
                                inst,
                                branch: 'testBranch',
                                updates: ['111', '222'],
                                updateId: 0,
                            });

                            expect(
                                messenger.getEvents(serverConnectionId)
                            ).toEqual([
                                [
                                    WebsocketEventTypes.Error,
                                    -1,
                                    {
                                        success: false,
                                        errorCode: 'not_authorized',
                                        errorMessage:
                                            'You are not authorized to perform this action.',
                                        recordName,
                                        inst,
                                        branch: 'testBranch',
                                        reason: {
                                            type: 'missing_permission',
                                            recordName,
                                            resourceKind: 'inst',
                                            resourceId: inst,
                                            subjectType: 'user',
                                            subjectId: otherUserId,
                                            action: 'updateData',
                                        },
                                    },
                                ],
                            ]);

                            expect(
                                messenger
                                    .getMessages(serverConnectionId)
                                    .slice(1)
                            ).toEqual([]);
                        });

                        it('should add the updates if the user is authorized to update the inst data', async () => {
                            expect(
                                await connectionStore.isAuthorizedInst(
                                    serverConnectionId,
                                    recordName,
                                    inst,
                                    'updateData'
                                )
                            ).toBe(false);
                            await services.policyStore.assignPermissionToSubjectAndMarker(
                                recordName,
                                'role',
                                'developer',
                                'inst',
                                PRIVATE_MARKER,
                                'read',
                                {},
                                null
                            );
                            await services.policyStore.assignPermissionToSubjectAndMarker(
                                recordName,
                                'role',
                                'developer',
                                'inst',
                                PRIVATE_MARKER,
                                'updateData',
                                {},
                                null
                            );

                            services.policyStore.roles[recordName] = {
                                [otherUserId]: new Set(['developer']),
                            };

                            await server.addUpdates(serverConnectionId, {
                                type: 'repo/add_updates',
                                recordName: recordName,
                                inst,
                                branch: 'testBranch',
                                updates: ['111', '222'],
                                updateId: 0,
                            });

                            expect(
                                messenger.getEvents(serverConnectionId)
                            ).toEqual([]);

                            expect(
                                messenger
                                    .getMessages(serverConnectionId)
                                    .slice(1)
                            ).toEqual([
                                {
                                    type: 'repo/updates_received',
                                    recordName,
                                    inst,
                                    branch: 'testBranch',
                                    updateId: 0,
                                },
                            ]);

                            expect(
                                await connectionStore.isAuthorizedInst(
                                    serverConnectionId,
                                    recordName,
                                    inst,
                                    'updateData'
                                )
                            ).toBe(true);
                        });

                        it('should not query the policy store if the connection is authorized', async () => {
                            expect(
                                await connectionStore.isAuthorizedInst(
                                    serverConnectionId,
                                    recordName,
                                    inst,
                                    'updateData'
                                )
                            ).toBe(false);
                            await connectionStore.saveAuthorizedInst(
                                serverConnectionId,
                                recordName,
                                inst,
                                'updateData'
                            );

                            await server.addUpdates(serverConnectionId, {
                                type: 'repo/add_updates',
                                recordName: recordName,
                                inst,
                                branch: 'testBranch',
                                updates: ['111', '222'],
                                updateId: 0,
                            });

                            expect(
                                messenger.getEvents(serverConnectionId)
                            ).toEqual([]);

                            expect(
                                messenger
                                    .getMessages(serverConnectionId)
                                    .slice(1)
                            ).toEqual([
                                {
                                    type: 'repo/updates_received',
                                    recordName,
                                    inst,
                                    branch: 'testBranch',
                                    updateId: 0,
                                },
                            ]);

                            expect(
                                await connectionStore.isAuthorizedInst(
                                    serverConnectionId,
                                    recordName,
                                    inst,
                                    'updateData'
                                )
                            ).toBe(true);
                        });
                    });

                    it('should create the inst if the user is authorized to create it and update data', async () => {
                        await server.login(serverConnectionId, 1, {
                            type: 'login',
                            connectionToken: otherUserToken,
                        });

                        await services.policyStore.assignPermissionToSubjectAndMarker(
                            recordName,
                            'role',
                            'developer',
                            'inst',
                            PRIVATE_MARKER,
                            'create',
                            {},
                            null
                        );
                        await services.policyStore.assignPermissionToSubjectAndMarker(
                            recordName,
                            'role',
                            'developer',
                            'inst',
                            PRIVATE_MARKER,
                            'read',
                            {},
                            null
                        );
                        await services.policyStore.assignPermissionToSubjectAndMarker(
                            recordName,
                            'role',
                            'developer',
                            'marker',
                            ACCOUNT_MARKER,
                            'assign',
                            {},
                            null
                        );
                        await services.policyStore.assignPermissionToSubjectAndMarker(
                            recordName,
                            'role',
                            'developer',
                            'inst',
                            PRIVATE_MARKER,
                            'updateData',
                            {},
                            null
                        );

                        services.policyStore.roles[recordName] = {
                            [otherUserId]: new Set(['developer']),
                        };

                        await server.addUpdates(serverConnectionId, {
                            type: 'repo/add_updates',
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            updates: ['111', '222'],
                            updateId: 0,
                        });

                        expect(messenger.getEvents(serverConnectionId)).toEqual(
                            []
                        );

                        expect(
                            await instStore.getBranchByName(
                                recordName,
                                inst,
                                'testBranch'
                            )
                        ).toEqual({
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            temporary: false,
                            linkedInst: {
                                recordName,
                                inst,
                                markers: [PRIVATE_MARKER],
                            },
                        });
                        expect(
                            messenger.getMessages(serverConnectionId).slice(1)
                        ).toEqual([
                            // Server should send a atoms received event
                            // back indicating which atoms it processed
                            {
                                type: 'repo/updates_received',
                                recordName: recordName,
                                inst,
                                branch: 'testBranch',
                                updateId: 0,
                            },
                        ]);
                    });

                    it('should return not_authorized if insts are not allowed', async () => {
                        store.subscriptionConfiguration =
                            buildSubscriptionConfig((config) =>
                                config.addSubscription('sub1', (sub) =>
                                    sub
                                        .withTier('tier1')
                                        .withAllDefaultFeatures()
                                        .withInsts({
                                            allowed: false,
                                        })
                                )
                            );

                        await store.saveUser({
                            id: userId,
                            allSessionRevokeTimeMs: null,
                            currentLoginRequestId: null,
                            email: 'test@example.com',
                            phoneNumber: null,
                            subscriptionId: 'sub1',
                            subscriptionStatus: 'active',
                        });

                        await server.login(serverConnectionId, 1, {
                            type: 'login',
                            connectionToken: otherUserToken,
                        });

                        await services.policyStore.assignPermissionToSubjectAndMarker(
                            recordName,
                            'role',
                            'developer',
                            'inst',
                            PRIVATE_MARKER,
                            'create',
                            {},
                            null
                        );
                        await services.policyStore.assignPermissionToSubjectAndMarker(
                            recordName,
                            'role',
                            'developer',
                            'inst',
                            PRIVATE_MARKER,
                            'read',
                            {},
                            null
                        );
                        await services.policyStore.assignPermissionToSubjectAndMarker(
                            recordName,
                            'role',
                            'developer',
                            'marker',
                            ACCOUNT_MARKER,
                            'assign',
                            {},
                            null
                        );
                        await services.policyStore.assignPermissionToSubjectAndMarker(
                            recordName,
                            'role',
                            'developer',
                            'inst',
                            PRIVATE_MARKER,
                            'updateData',
                            {},
                            null
                        );

                        services.policyStore.roles[recordName] = {
                            [otherUserId]: new Set(['developer']),
                        };

                        await server.addUpdates(serverConnectionId, {
                            type: 'repo/add_updates',
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            updates: ['111', '222'],
                            updateId: 0,
                        });

                        expect(messenger.getEvents(serverConnectionId)).toEqual(
                            [
                                [
                                    WebsocketEventTypes.Error,
                                    -1,
                                    {
                                        success: false,
                                        errorCode: 'not_authorized',
                                        errorMessage:
                                            'Insts are not allowed for this subscription.',
                                        recordName,
                                        inst,
                                        branch: 'testBranch',
                                    },
                                ],
                            ]
                        );
                        expect(
                            messenger.getMessages(serverConnectionId).slice(1)
                        ).toEqual([]);
                    });

                    it('should return subscription_limit_reached if creating the inst would exceed the allowed max insts', async () => {
                        store.subscriptionConfiguration =
                            buildSubscriptionConfig((config) =>
                                config.addSubscription('sub1', (sub) =>
                                    sub
                                        .withTier('tier1')
                                        .withAllDefaultFeatures()
                                        .withInsts()
                                        .withMaxInsts(1)
                                )
                            );

                        await store.saveUser({
                            id: userId,
                            allSessionRevokeTimeMs: null,
                            currentLoginRequestId: null,
                            email: 'test@example.com',
                            phoneNumber: null,
                            subscriptionId: 'sub1',
                            subscriptionStatus: 'active',
                        });

                        await instStore.saveInst({
                            recordName,
                            inst: 'otherInst',
                            markers: [PRIVATE_MARKER],
                        });

                        await server.login(serverConnectionId, 1, {
                            type: 'login',
                            connectionToken: otherUserToken,
                        });

                        await services.policyStore.assignPermissionToSubjectAndMarker(
                            recordName,
                            'role',
                            'developer',
                            'inst',
                            PRIVATE_MARKER,
                            'create',
                            {},
                            null
                        );
                        await services.policyStore.assignPermissionToSubjectAndMarker(
                            recordName,
                            'role',
                            'developer',
                            'inst',
                            PRIVATE_MARKER,
                            'read',
                            {},
                            null
                        );
                        await services.policyStore.assignPermissionToSubjectAndMarker(
                            recordName,
                            'role',
                            'developer',
                            'inst',
                            PRIVATE_MARKER,
                            'updateData',
                            {},
                            null
                        );
                        await services.policyStore.assignPermissionToSubjectAndMarker(
                            recordName,
                            'role',
                            'developer',
                            'marker',
                            ACCOUNT_MARKER,
                            'assign',
                            {},
                            null
                        );

                        services.policyStore.roles[recordName] = {
                            [otherUserId]: new Set(['developer']),
                        };

                        await server.addUpdates(serverConnectionId, {
                            type: 'repo/add_updates',
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            updates: ['111', '222'],
                            updateId: 0,
                        });

                        expect(messenger.getEvents(serverConnectionId)).toEqual(
                            [
                                [
                                    WebsocketEventTypes.Error,
                                    -1,
                                    {
                                        success: false,
                                        errorCode: 'subscription_limit_reached',
                                        errorMessage:
                                            'The maximum number of insts has been reached.',
                                        recordName,
                                        inst,
                                        branch: 'testBranch',
                                    },
                                ],
                            ]
                        );
                        expect(
                            messenger.getMessages(serverConnectionId).slice(1)
                        ).toEqual([]);
                    });
                });
            });
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

        describe('addUserUpdates()', () => {
            describe('no record', () => {
                const recordName: string | null = null;

                it('should create the branch if it does not exist', async () => {
                    const result = await server.addUserUpdates({
                        userId: device1Info.userId,
                        recordName: recordName,
                        inst,
                        branch: 'testBranch',
                        updates: ['111', '222'],
                    });

                    expect(result).toEqual({
                        success: true,
                    });

                    await instStore.addUpdates(
                        recordName,
                        inst,
                        'testBranch',
                        ['333'],
                        3
                    );

                    await connectionStore.saveConnection(device1Info);
                    await server.watchBranch(device1Info.serverConnectionId, {
                        type: 'repo/watch_branch',
                        recordName: recordName,
                        inst,
                        branch: 'testBranch',
                        protocol: 'updates',
                    });

                    await waitAsync();

                    expect(
                        await instStore.getBranchByName(
                            recordName,
                            inst,
                            'testBranch'
                        )
                    ).toEqual({
                        recordName: recordName,
                        inst,
                        branch: 'testBranch',
                        temporary: false,
                        linkedInst: !recordName
                            ? null
                            : {
                                  recordName,
                                  inst,
                                  markers: [PUBLIC_WRITE_MARKER],
                              },
                    });
                    expect(
                        messenger.getMessages(device1Info.serverConnectionId)
                    ).toEqual([
                        {
                            type: 'repo/add_updates',
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            updates: ['111', '222', '333'],
                            initial: true,
                        },

                        {
                            type: 'repo/watch_branch_result',
                            success: true,
                            inst,
                            branch: 'testBranch',
                            recordName: recordName,
                        },
                    ]);
                });

                it('should add the given updates to the given branch', async () => {
                    const result = await server.addUserUpdates({
                        userId: device1Info.userId,
                        recordName: recordName,
                        inst,
                        branch: 'testBranch',
                        updates: ['111', '222'],
                    });

                    expect(result).toEqual({
                        success: true,
                    });

                    await instStore.addUpdates(
                        recordName,
                        inst,
                        'testBranch',
                        ['333'],
                        3
                    );

                    await connectionStore.saveConnection(device1Info);
                    await server.watchBranch(device1Info.serverConnectionId, {
                        type: 'repo/watch_branch',
                        recordName: recordName,
                        inst,
                        branch: 'testBranch',
                        protocol: 'updates',
                    });

                    expect(
                        messenger.getMessages(device1Info.serverConnectionId)
                    ).toEqual([
                        {
                            type: 'repo/add_updates',
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            updates: ['111', '222', '333'],
                            initial: true,
                        },

                        {
                            type: 'repo/watch_branch_result',
                            success: true,
                            inst,
                            branch: 'testBranch',
                            recordName: recordName,
                        },
                    ]);

                    const updates = await instStore.getCurrentUpdates(
                        recordName,
                        inst,
                        'testBranch'
                    );

                    expect(updates).toEqual({
                        updates: ['111', '222', '333'],
                        timestamps: [
                            expect.any(Number),
                            expect.any(Number),
                            expect.any(Number),
                        ],
                        instSizeInBytes: 9,
                    });

                    const dirtyBranches =
                        await instStore.temp.listDirtyBranches();

                    // Should not record the branch as dirty if it doesn't have a record name
                    if (!recordName) {
                        expect(dirtyBranches).toEqual([]);
                    } else {
                        expect(dirtyBranches).toEqual([
                            {
                                recordName: recordName,
                                inst,
                                branch: 'testBranch',
                            },
                        ]);
                    }
                });

                it('should still work if the user id is null', async () => {
                    const result = await server.addUserUpdates({
                        userId: null,
                        recordName: recordName,
                        inst,
                        branch: 'testBranch',
                        updates: ['111', '222'],
                    });

                    expect(result).toEqual({
                        success: true,
                    });

                    await instStore.addUpdates(
                        recordName,
                        inst,
                        'testBranch',
                        ['333'],
                        3
                    );

                    await connectionStore.saveConnection(device1Info);
                    await server.watchBranch(device1Info.serverConnectionId, {
                        type: 'repo/watch_branch',
                        recordName: recordName,
                        inst,
                        branch: 'testBranch',
                        protocol: 'updates',
                    });

                    expect(
                        messenger.getMessages(device1Info.serverConnectionId)
                    ).toEqual([
                        {
                            type: 'repo/add_updates',
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            updates: ['111', '222', '333'],
                            initial: true,
                        },

                        {
                            type: 'repo/watch_branch_result',
                            success: true,
                            inst,
                            branch: 'testBranch',
                            recordName: recordName,
                        },
                    ]);

                    const updates = await instStore.getCurrentUpdates(
                        recordName,
                        inst,
                        'testBranch'
                    );

                    expect(updates).toEqual({
                        updates: ['111', '222', '333'],
                        timestamps: [
                            expect.any(Number),
                            expect.any(Number),
                            expect.any(Number),
                        ],
                        instSizeInBytes: 9,
                    });

                    const dirtyBranches =
                        await instStore.temp.listDirtyBranches();

                    // Should not record the branch as dirty if it doesn't have a record name
                    if (!recordName) {
                        expect(dirtyBranches).toEqual([]);
                    } else {
                        expect(dirtyBranches).toEqual([
                            {
                                recordName: recordName,
                                inst,
                                branch: 'testBranch',
                            },
                        ]);
                    }
                });

                it('should notify all other devices connected to the branch', async () => {
                    await connectionStore.saveConnection(device1Info);
                    await connectionStore.saveConnection(device2Info);
                    await connectionStore.saveConnection(device3Info);

                    await instStore.addUpdates(
                        recordName,
                        inst,
                        'testBranch',
                        ['111', '222'],
                        6
                    );

                    await server.watchBranch(device2Info.serverConnectionId, {
                        type: 'repo/watch_branch',
                        recordName: recordName,
                        inst,
                        branch: 'testBranch',
                        protocol: 'updates',
                    });

                    await server.watchBranch(device3Info.serverConnectionId, {
                        type: 'repo/watch_branch',
                        recordName: recordName,
                        inst,
                        branch: 'testBranch',
                        protocol: 'updates',
                    });

                    const result = await server.addUserUpdates({
                        userId: device1Info.userId,
                        recordName: recordName,
                        inst,
                        branch: 'testBranch',
                        updates: ['333'],
                    });

                    expect(result).toEqual({
                        success: true,
                    });

                    expect(
                        messenger.getMessages(device2Info.serverConnectionId)
                    ).toEqual([
                        {
                            type: 'repo/add_updates',
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            updates: ['111', '222'],
                            initial: true,
                        },
                        {
                            type: 'repo/watch_branch_result',
                            success: true,
                            inst,
                            branch: 'testBranch',
                            recordName: recordName,
                        },
                        {
                            type: 'repo/add_updates',
                            recordName: recordName,
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
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            updates: ['111', '222'],
                            initial: true,
                        },
                        {
                            type: 'repo/watch_branch_result',
                            success: true,
                            inst,
                            branch: 'testBranch',
                            recordName: recordName,
                        },

                        {
                            type: 'repo/add_updates',
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            updates: ['333'],
                        },
                    ]);
                });

                it('should immediately store the added atoms', async () => {
                    await connectionStore.saveConnection(device1Info);

                    const result = await server.addUserUpdates({
                        userId: device1Info.userId,
                        recordName: recordName,
                        inst,
                        branch: 'testBranch',
                        updates: ['111', '222'],
                    });

                    expect(result).toEqual({
                        success: true,
                    });

                    const updates = await instStore.getCurrentUpdates(
                        recordName,
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

                    const result = await server.addUserUpdates({
                        userId: device1Info.userId,
                        recordName: recordName,
                        inst,
                        branch: null as any,
                        updates: ['111'],
                    });

                    expect(result).toEqual({
                        success: true,
                    });
                });

                it('should not crash if adding atoms to a branch that does not exist', async () => {
                    await connectionStore.saveConnection(device1Info);

                    const result = await server.addUserUpdates({
                        userId: device1Info.userId,
                        recordName: recordName,
                        inst,
                        branch: 'abc',
                        updates: ['111'],
                    });

                    expect(result).toEqual({
                        success: true,
                    });

                    expect(
                        await instStore.getCurrentUpdates(
                            recordName,
                            inst,
                            'abc'
                        )
                    ).toEqual({
                        updates: ['111'],
                        timestamps: [expect.any(Number)],
                        instSizeInBytes: 3,
                    });
                });

                it('should return a not_authorized error if recordless insts are not allowed', async () => {
                    store.subscriptionConfiguration = buildSubscriptionConfig(
                        (config) =>
                            config.withPublicInsts({
                                allowed: false,
                            })
                    );

                    await connectionStore.saveConnection(device1Info);

                    const result = await server.addUserUpdates({
                        userId: device1Info.userId,
                        recordName: null,
                        inst,
                        branch: 'doesNotExist',
                        updates: ['111', '222'],
                    });

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage: 'Temporary insts are not allowed.',
                    });

                    expect(
                        await instStore.getBranchByName(
                            null,
                            inst,
                            'doesNotExist'
                        )
                    ).toEqual(null);
                    // Should not create an inst when the record name is null.
                    expect(await instStore.getInstByName(null, inst)).toBe(
                        null
                    );
                });

                it('should return a subscription_limit_reached error if it would exceed the maximum inst size for recordless insts', async () => {
                    store.subscriptionConfiguration = buildSubscriptionConfig(
                        (config) =>
                            config.withPublicInsts({
                                allowed: true,
                                maxBytesPerInst: 1,
                            })
                    );

                    await connectionStore.saveConnection(device1Info);

                    const result = await server.addUserUpdates({
                        userId: device1Info.userId,
                        recordName: null,
                        inst,
                        branch: 'doesNotExist',
                        updates: ['111', '222'],
                    });

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'subscription_limit_reached',
                        errorMessage: 'The inst has reached its maximum size.',
                    });
                });
            });

            describe('records', () => {
                beforeEach(async () => {
                    await services.records.createRecord({
                        userId,
                        recordName,
                        ownerId: userId,
                    });
                });

                it('should return a record_not_found error if the record does not exist', async () => {
                    connectionToken = generateV1ConnectionToken(
                        connectionKey,
                        connectionId,
                        'otherRecord',
                        inst
                    );
                    await server.login(serverConnectionId, 1, {
                        type: 'login',
                        connectionToken,
                    });

                    const result = await server.addUserUpdates({
                        userId: userId,
                        recordName: 'otherRecord',
                        inst,
                        branch: 'testBranch',
                        updates: ['111', '222'],
                    });

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'record_not_found',
                        errorMessage: 'Record not found.',
                    });

                    // expect(messenger.getEvents(serverConnectionId)).toEqual([
                    //     [
                    //         WebsocketEventTypes.Error,
                    //         -1,
                    //         {
                    //             success: false,
                    //             errorCode: 'record_not_found',
                    //             errorMessage: 'Record not found.',
                    //             recordName: 'otherRecord',
                    //             inst,
                    //             branch: 'testBranch',
                    //         },
                    //     ],
                    // ]);
                    expect(
                        messenger.getMessages(serverConnectionId).slice(1)
                    ).toEqual([]);
                });

                describe('owner', () => {
                    it('should create the inst if it does not exist', async () => {
                        await server.login(serverConnectionId, 1, {
                            type: 'login',
                            connectionToken,
                        });

                        const result = await server.addUserUpdates({
                            userId,
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            updates: ['111', '222'],
                        });

                        expect(result).toEqual({
                            success: true,
                        });

                        await instStore.addUpdates(
                            recordName,
                            inst,
                            'testBranch',
                            ['333'],
                            3
                        );

                        await server.watchBranch(serverConnectionId, {
                            type: 'repo/watch_branch',
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            protocol: 'updates',
                        });

                        expect(
                            await instStore.getBranchByName(
                                recordName,
                                inst,
                                'testBranch'
                            )
                        ).toEqual({
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            temporary: false,
                            linkedInst: {
                                recordName,
                                inst,
                                markers: [PRIVATE_MARKER],
                            },
                        });
                        expect(
                            messenger.getMessages(serverConnectionId).slice(1)
                        ).toEqual([
                            {
                                type: 'repo/add_updates',
                                recordName: recordName,
                                inst,
                                branch: 'testBranch',
                                updates: ['111', '222', '333'],
                                initial: true,
                            },

                            {
                                type: 'repo/watch_branch_result',
                                success: true,
                                inst,
                                branch: 'testBranch',
                                recordName: recordName,
                            },
                        ]);
                        expect(messenger.getEvents(serverConnectionId)).toEqual(
                            []
                        );
                    });

                    it('should create the record if it matches the user ID', async () => {
                        const recordName = userId;
                        connectionToken = generateV1ConnectionToken(
                            connectionKey,
                            connectionId,
                            recordName,
                            inst
                        );

                        const result = await server.addUserUpdates({
                            userId,
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            updates: ['111', '222'],
                        });

                        expect(result).toEqual({
                            success: true,
                        });

                        await server.login(serverConnectionId, 1, {
                            type: 'login',
                            connectionToken,
                        });

                        await instStore.addUpdates(
                            recordName,
                            inst,
                            'testBranch',
                            ['333'],
                            3
                        );

                        expect(messenger.getEvents(serverConnectionId)).toEqual(
                            []
                        );

                        await server.watchBranch(serverConnectionId, {
                            type: 'repo/watch_branch',
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            protocol: 'updates',
                        });

                        expect(
                            await instStore.getBranchByName(
                                recordName,
                                inst,
                                'testBranch'
                            )
                        ).toEqual({
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            temporary: false,
                            linkedInst: {
                                recordName,
                                inst,
                                markers: [PRIVATE_MARKER],
                            },
                        });
                        expect(
                            messenger.getMessages(serverConnectionId).slice(1)
                        ).toEqual([
                            {
                                type: 'repo/add_updates',
                                recordName: recordName,
                                inst,
                                branch: 'testBranch',
                                updates: ['111', '222', '333'],
                                initial: true,
                            },

                            {
                                type: 'repo/watch_branch_result',
                                success: true,
                                inst,
                                branch: 'testBranch',
                                recordName: recordName,
                            },
                        ]);
                    });

                    it('should add the given updates to the given branch', async () => {
                        const result = await server.addUserUpdates({
                            userId,
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            updates: ['111', '222'],
                        });

                        expect(result).toEqual({
                            success: true,
                        });

                        await server.login(serverConnectionId, 1, {
                            type: 'login',
                            connectionToken,
                        });

                        await instStore.addUpdates(
                            recordName,
                            inst,
                            'testBranch',
                            ['333'],
                            3
                        );

                        await server.watchBranch(serverConnectionId, {
                            type: 'repo/watch_branch',
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            protocol: 'updates',
                        });

                        expect(
                            messenger.getMessages(serverConnectionId).slice(1)
                        ).toEqual([
                            {
                                type: 'repo/add_updates',
                                recordName: recordName,
                                inst,
                                branch: 'testBranch',
                                updates: ['111', '222', '333'],
                                initial: true,
                            },

                            {
                                type: 'repo/watch_branch_result',
                                success: true,
                                inst,
                                branch: 'testBranch',
                                recordName: recordName,
                            },
                        ]);

                        const updates = await instStore.getCurrentUpdates(
                            recordName,
                            inst,
                            'testBranch'
                        );

                        expect(updates).toEqual({
                            updates: ['111', '222', '333'],
                            timestamps: [
                                expect.any(Number),
                                expect.any(Number),
                                expect.any(Number),
                            ],
                            instSizeInBytes: 9,
                        });

                        const dirtyBranches =
                            await instStore.temp.listDirtyBranches();

                        // Should not record the branch as dirty if it doesn't have a record name
                        if (!recordName) {
                            expect(dirtyBranches).toEqual([]);
                        } else {
                            expect(dirtyBranches).toEqual([
                                {
                                    recordName: recordName,
                                    inst,
                                    branch: 'testBranch',
                                },
                            ]);
                        }
                    });

                    it('should notify all other devices connected to the branch', async () => {
                        await connectionStore.saveConnection(device2Info);
                        await connectionStore.saveConnection(device3Info);
                        await connectionStore.saveBranchConnection({
                            mode: 'branch',
                            ...device2Info,
                            recordName,
                            inst,
                            branch: 'testBranch',
                            temporary: false,
                        });
                        await connectionStore.saveBranchConnection({
                            mode: 'branch',
                            ...device3Info,
                            recordName,
                            inst,
                            branch: 'testBranch',
                            temporary: false,
                        });

                        await instStore.addUpdates(
                            recordName,
                            inst,
                            'testBranch',
                            ['111', '222'],
                            6
                        );

                        const result = await server.addUserUpdates({
                            userId,
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            updates: ['333'],
                        });

                        expect(result).toEqual({
                            success: true,
                        });

                        expect(
                            messenger.getMessages(
                                device2Info.serverConnectionId
                            )
                        ).toEqual([
                            {
                                type: 'repo/add_updates',
                                recordName: recordName,
                                inst,
                                branch: 'testBranch',
                                updates: ['333'],
                            },
                        ]);

                        expect(
                            messenger.getMessages(
                                device3Info.serverConnectionId
                            )
                        ).toEqual([
                            {
                                type: 'repo/add_updates',
                                recordName: recordName,
                                inst,
                                branch: 'testBranch',
                                updates: ['333'],
                            },
                        ]);
                    });

                    it('should immediately store the added atoms', async () => {
                        const result = await server.addUserUpdates({
                            userId,
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            updates: ['111', '222'],
                        });

                        expect(result).toEqual({
                            success: true,
                        });

                        const updates = await instStore.getCurrentUpdates(
                            recordName,
                            inst,
                            'testBranch'
                        );

                        expect(updates).toEqual({
                            updates: ['111', '222'],
                            timestamps: [
                                expect.any(Number),
                                expect.any(Number),
                            ],
                            instSizeInBytes: 6,
                        });
                    });

                    it('should ignore when given an event with a null branch', async () => {
                        const result = await server.addUserUpdates({
                            userId,
                            recordName: recordName,
                            inst,
                            branch: null as any,
                            updates: ['111'],
                        });

                        expect(result).toEqual({
                            success: true,
                        });
                    });

                    it('should not crash if adding atoms to a branch that does not exist', async () => {
                        const result = await server.addUserUpdates({
                            userId,
                            recordName: recordName,
                            inst,
                            branch: 'abc',
                            updates: ['111'],
                        });

                        expect(result).toEqual({
                            success: true,
                        });

                        expect(
                            await instStore.getCurrentUpdates(
                                recordName,
                                inst,
                                'abc'
                            )
                        ).toEqual({
                            updates: ['111'],
                            timestamps: [expect.any(Number)],
                            instSizeInBytes: 3,
                        });
                    });

                    it('should return a not_authorized error if insts are not allowed', async () => {
                        store.subscriptionConfiguration =
                            buildSubscriptionConfig((config) =>
                                config.addSubscription('sub1', (sub) =>
                                    sub
                                        .withTier('tier1')
                                        .withAllDefaultFeatures()
                                        .withInsts({
                                            allowed: false,
                                        })
                                )
                            );

                        await store.saveUser({
                            id: userId,
                            allSessionRevokeTimeMs: null,
                            currentLoginRequestId: null,
                            email: 'test@example.com',
                            phoneNumber: null,
                            subscriptionId: 'sub1',
                            subscriptionStatus: 'active',
                        });

                        const result = await server.addUserUpdates({
                            userId,
                            recordName,
                            inst,
                            branch: 'testBranch',
                            updates: ['111', '222'],
                        });

                        expect(result).toEqual({
                            success: false,
                            errorCode: 'not_authorized',
                            errorMessage:
                                'Insts are not allowed for this subscription.',
                        });
                    });

                    it('should return a subscription_limit_reached error if creating the inst would exceed the allowed max insts', async () => {
                        store.subscriptionConfiguration =
                            buildSubscriptionConfig((config) =>
                                config.addSubscription('sub1', (sub) =>
                                    sub
                                        .withTier('tier1')
                                        .withAllDefaultFeatures()
                                        .withInsts()
                                        .withMaxInsts(1)
                                )
                            );

                        await store.saveUser({
                            id: userId,
                            allSessionRevokeTimeMs: null,
                            currentLoginRequestId: null,
                            email: 'test@example.com',
                            phoneNumber: null,
                            subscriptionId: 'sub1',
                            subscriptionStatus: 'active',
                        });

                        await instStore.saveInst({
                            recordName,
                            inst: 'otherInst',
                            markers: [PRIVATE_MARKER],
                        });

                        const result = await server.addUserUpdates({
                            userId,
                            recordName,
                            inst,
                            branch: 'testBranch',
                            updates: ['111', '222'],
                        });

                        expect(result).toEqual({
                            success: false,
                            errorCode: 'subscription_limit_reached',
                            errorMessage:
                                'The maximum number of insts has been reached.',
                        });
                    });

                    it('should return a subscription_limit_reached error if adding the updates to a new inst would exceed the allowed inst size', async () => {
                        store.subscriptionConfiguration =
                            buildSubscriptionConfig((config) =>
                                config.addSubscription('sub1', (sub) =>
                                    sub
                                        .withTier('tier1')
                                        .withAllDefaultFeatures()
                                        .withInsts()
                                        .withMaxBytesPerInst(1)
                                )
                            );

                        await store.saveUser({
                            id: userId,
                            allSessionRevokeTimeMs: null,
                            currentLoginRequestId: null,
                            email: 'test@example.com',
                            phoneNumber: null,
                            subscriptionId: 'sub1',
                            subscriptionStatus: 'active',
                        });

                        const result = await server.addUserUpdates({
                            userId,
                            recordName,
                            inst,
                            branch: 'testBranch',
                            updates: ['111', '222'],
                        });

                        expect(result).toEqual({
                            success: false,
                            errorCode: 'subscription_limit_reached',
                            errorMessage:
                                'The inst has reached its maximum size.',
                        });
                    });

                    it('should return a subscription_limit_reached error if adding the updates to an existing inst would exceed the allowed inst size', async () => {
                        store.subscriptionConfiguration =
                            buildSubscriptionConfig((config) =>
                                config.addSubscription('sub1', (sub) =>
                                    sub
                                        .withTier('tier1')
                                        .withAllDefaultFeatures()
                                        .withInsts()
                                        .withMaxBytesPerInst(100)
                                )
                            );

                        await store.saveUser({
                            id: userId,
                            allSessionRevokeTimeMs: null,
                            currentLoginRequestId: null,
                            email: 'test@example.com',
                            phoneNumber: null,
                            subscriptionId: 'sub1',
                            subscriptionStatus: 'active',
                        });

                        await instStore.saveInst({
                            recordName,
                            inst,
                            markers: [PRIVATE_MARKER],
                        });

                        await instStore.saveBranch({
                            recordName,
                            inst,
                            branch: 'testBranch',
                            temporary: false,
                        });

                        await instStore.addUpdates(
                            recordName,
                            inst,
                            'testBranch',
                            ['abc', 'def'],
                            99
                        );

                        const result = await server.addUserUpdates({
                            userId,
                            recordName,
                            inst,
                            branch: 'testBranch',
                            updates: ['111', '222'],
                        });

                        expect(result).toEqual({
                            success: false,
                            errorCode: 'subscription_limit_reached',
                            errorMessage:
                                'The inst has reached its maximum size.',
                        });
                    });
                });

                describe('guest', () => {
                    const otherUserConnectionId = 'otherConnectionId';
                    let otherUserId: string;
                    let otherUserConnectionKey: string;
                    let otherUserToken: string;

                    beforeEach(async () => {
                        uuidMock.mockReturnValueOnce('otherUserId');
                        const otherUser = await createTestUser(
                            services,
                            'other@example.com'
                        );
                        otherUserToken = generateV1ConnectionToken(
                            otherUser.connectionKey,
                            otherUserConnectionId,
                            recordName,
                            inst
                        );
                        otherUserId = otherUser.userId;
                        otherUserConnectionKey = otherUser.connectionKey;
                    });

                    it('should send a not_authorized error if the user is not authorized to create insts', async () => {
                        const result = await server.addUserUpdates({
                            userId: otherUserId,
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            updates: ['111', '222'],
                        });

                        expect(result).toEqual({
                            success: false,
                            errorCode: 'not_authorized',
                            errorMessage:
                                'You are not authorized to perform this action.',
                            reason: {
                                type: 'missing_permission',
                                recordName,
                                resourceKind: 'inst',
                                resourceId: inst,
                                subjectType: 'user',
                                subjectId: otherUserId,
                                action: 'create',
                            },
                        });

                        expect(
                            await instStore.getBranchByName(
                                recordName,
                                inst,
                                'testBranch'
                            )
                        ).toEqual(null);
                    });

                    describe('no branch', () => {
                        beforeEach(async () => {
                            await instStore.saveInst({
                                recordName,
                                inst,
                                markers: [PRIVATE_MARKER],
                            });
                        });

                        it('should send a not_authorized error if the user is not authorized to read insts', async () => {
                            const result = await server.addUserUpdates({
                                userId: otherUserId,
                                recordName: recordName,
                                inst,
                                branch: 'testBranch',
                                updates: ['111', '222'],
                            });

                            expect(result).toEqual({
                                success: false,
                                errorCode: 'not_authorized',
                                errorMessage:
                                    'You are not authorized to perform this action.',
                                reason: {
                                    type: 'missing_permission',
                                    recordName,
                                    resourceKind: 'inst',
                                    resourceId: inst,
                                    subjectType: 'user',
                                    subjectId: otherUserId,
                                    action: 'read',
                                },
                            });

                            expect(
                                await instStore.getBranchByName(
                                    recordName,
                                    inst,
                                    'testBranch'
                                )
                            ).toEqual(null);
                        });

                        it('should send a not_authorized error if the user is not authorized to update inst data', async () => {
                            await services.policyStore.assignPermissionToSubjectAndMarker(
                                recordName,
                                'role',
                                'developer',
                                'inst',
                                PRIVATE_MARKER,
                                'read',
                                {},
                                null
                            );

                            services.policyStore.roles[recordName] = {
                                [otherUserId]: new Set(['developer']),
                            };

                            const result = await server.addUserUpdates({
                                userId: otherUserId,
                                recordName: recordName,
                                inst,
                                branch: 'testBranch',
                                updates: ['111', '222'],
                            });

                            expect(result).toEqual({
                                success: false,
                                errorCode: 'not_authorized',
                                errorMessage:
                                    'You are not authorized to perform this action.',
                                reason: {
                                    type: 'missing_permission',
                                    recordName,
                                    resourceKind: 'inst',
                                    resourceId: inst,
                                    subjectType: 'user',
                                    subjectId: otherUserId,
                                    action: 'updateData',
                                },
                            });

                            expect(
                                await instStore.getBranchByName(
                                    recordName,
                                    inst,
                                    'testBranch'
                                )
                            ).toEqual(null);
                        });
                    });

                    describe('branch', () => {
                        beforeEach(async () => {
                            await instStore.saveInst({
                                recordName,
                                inst,
                                markers: [PRIVATE_MARKER],
                            });

                            await instStore.saveBranch({
                                recordName,
                                inst,
                                branch: 'testBranch',
                                temporary: false,
                            });
                        });

                        it('should send a not_authorized error if the user is not authorized to read insts', async () => {
                            const result = await server.addUserUpdates({
                                userId: otherUserId,
                                recordName: recordName,
                                inst,
                                branch: 'testBranch',
                                updates: ['111', '222'],
                            });

                            expect(result).toEqual({
                                success: false,
                                errorCode: 'not_authorized',
                                errorMessage:
                                    'You are not authorized to perform this action.',
                                reason: {
                                    type: 'missing_permission',
                                    recordName,
                                    resourceKind: 'inst',
                                    resourceId: inst,
                                    subjectType: 'user',
                                    subjectId: otherUserId,
                                    action: 'read',
                                },
                            });
                        });

                        it('should send a not_authorized error if the user is not authorized to update inst data', async () => {
                            await services.policyStore.assignPermissionToSubjectAndMarker(
                                recordName,
                                'role',
                                'developer',
                                'inst',
                                PRIVATE_MARKER,
                                'read',
                                {},
                                null
                            );

                            services.policyStore.roles[recordName] = {
                                [otherUserId]: new Set(['developer']),
                            };

                            const result = await server.addUserUpdates({
                                userId: otherUserId,
                                recordName: recordName,
                                inst,
                                branch: 'testBranch',
                                updates: ['111', '222'],
                            });

                            expect(result).toEqual({
                                success: false,
                                errorCode: 'not_authorized',
                                errorMessage:
                                    'You are not authorized to perform this action.',
                                reason: {
                                    type: 'missing_permission',
                                    recordName,
                                    resourceKind: 'inst',
                                    resourceId: inst,
                                    subjectType: 'user',
                                    subjectId: otherUserId,
                                    action: 'updateData',
                                },
                            });
                        });

                        it('should add the updates if the user is authorized to update the inst data', async () => {
                            expect(
                                await connectionStore.isAuthorizedInst(
                                    serverConnectionId,
                                    recordName,
                                    inst,
                                    'updateData'
                                )
                            ).toBe(false);
                            await services.policyStore.assignPermissionToSubjectAndMarker(
                                recordName,
                                'role',
                                'developer',
                                'inst',
                                PRIVATE_MARKER,
                                'read',
                                {},
                                null
                            );
                            await services.policyStore.assignPermissionToSubjectAndMarker(
                                recordName,
                                'role',
                                'developer',
                                'inst',
                                PRIVATE_MARKER,
                                'updateData',
                                {},
                                null
                            );

                            services.policyStore.roles[recordName] = {
                                [otherUserId]: new Set(['developer']),
                            };

                            const result = await server.addUserUpdates({
                                userId: otherUserId,
                                recordName: recordName,
                                inst,
                                branch: 'testBranch',
                                updates: ['111', '222'],
                            });

                            expect(result).toEqual({
                                success: true,
                            });

                            const updates = await instStore.getCurrentUpdates(
                                recordName,
                                inst,
                                'testBranch'
                            );

                            expect(updates).toEqual({
                                updates: ['111', '222'],
                                timestamps: [
                                    expect.any(Number),
                                    expect.any(Number),
                                ],
                                instSizeInBytes: 6,
                            });
                        });
                    });

                    it('should create the inst if the user is authorized to create it and update data', async () => {
                        await services.policyStore.assignPermissionToSubjectAndMarker(
                            recordName,
                            'role',
                            'developer',
                            'inst',
                            PRIVATE_MARKER,
                            'create',
                            {},
                            null
                        );
                        await services.policyStore.assignPermissionToSubjectAndMarker(
                            recordName,
                            'role',
                            'developer',
                            'inst',
                            PRIVATE_MARKER,
                            'read',
                            {},
                            null
                        );
                        await services.policyStore.assignPermissionToSubjectAndMarker(
                            recordName,
                            'role',
                            'developer',
                            'marker',
                            ACCOUNT_MARKER,
                            'assign',
                            {},
                            null
                        );
                        await services.policyStore.assignPermissionToSubjectAndMarker(
                            recordName,
                            'role',
                            'developer',
                            'inst',
                            PRIVATE_MARKER,
                            'updateData',
                            {},
                            null
                        );

                        services.policyStore.roles[recordName] = {
                            [otherUserId]: new Set(['developer']),
                        };

                        const result = await server.addUserUpdates({
                            userId: otherUserId,
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            updates: ['111', '222'],
                        });

                        expect(result).toEqual({
                            success: true,
                        });

                        expect(
                            await instStore.getBranchByName(
                                recordName,
                                inst,
                                'testBranch'
                            )
                        ).toEqual({
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            temporary: false,
                            linkedInst: {
                                recordName,
                                inst,
                                markers: [PRIVATE_MARKER],
                            },
                        });
                    });

                    it('should return not_authorized if insts are not allowed', async () => {
                        store.subscriptionConfiguration =
                            buildSubscriptionConfig((config) =>
                                config.addSubscription('sub1', (sub) =>
                                    sub
                                        .withTier('tier1')
                                        .withAllDefaultFeatures()
                                        .withInsts({
                                            allowed: false,
                                        })
                                )
                            );

                        await store.saveUser({
                            id: userId,
                            allSessionRevokeTimeMs: null,
                            currentLoginRequestId: null,
                            email: 'test@example.com',
                            phoneNumber: null,
                            subscriptionId: 'sub1',
                            subscriptionStatus: 'active',
                        });

                        await services.policyStore.assignPermissionToSubjectAndMarker(
                            recordName,
                            'role',
                            'developer',
                            'inst',
                            PRIVATE_MARKER,
                            'create',
                            {},
                            null
                        );
                        await services.policyStore.assignPermissionToSubjectAndMarker(
                            recordName,
                            'role',
                            'developer',
                            'inst',
                            PRIVATE_MARKER,
                            'read',
                            {},
                            null
                        );
                        await services.policyStore.assignPermissionToSubjectAndMarker(
                            recordName,
                            'role',
                            'developer',
                            'marker',
                            ACCOUNT_MARKER,
                            'assign',
                            {},
                            null
                        );
                        await services.policyStore.assignPermissionToSubjectAndMarker(
                            recordName,
                            'role',
                            'developer',
                            'inst',
                            PRIVATE_MARKER,
                            'updateData',
                            {},
                            null
                        );

                        services.policyStore.roles[recordName] = {
                            [otherUserId]: new Set(['developer']),
                        };

                        const result = await server.addUserUpdates({
                            userId: otherUserId,
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            updates: ['111', '222'],
                        });

                        expect(result).toEqual({
                            success: false,
                            errorCode: 'not_authorized',
                            errorMessage:
                                'Insts are not allowed for this subscription.',
                        });
                    });

                    it('should return subscription_limit_reached if creating the inst would exceed the allowed max insts', async () => {
                        store.subscriptionConfiguration =
                            buildSubscriptionConfig((config) =>
                                config.addSubscription('sub1', (sub) =>
                                    sub
                                        .withTier('tier1')
                                        .withAllDefaultFeatures()
                                        .withInsts()
                                        .withMaxInsts(1)
                                )
                            );

                        await store.saveUser({
                            id: userId,
                            allSessionRevokeTimeMs: null,
                            currentLoginRequestId: null,
                            email: 'test@example.com',
                            phoneNumber: null,
                            subscriptionId: 'sub1',
                            subscriptionStatus: 'active',
                        });

                        await instStore.saveInst({
                            recordName,
                            inst: 'otherInst',
                            markers: [PRIVATE_MARKER],
                        });

                        await services.policyStore.assignPermissionToSubjectAndMarker(
                            recordName,
                            'role',
                            'developer',
                            'inst',
                            PRIVATE_MARKER,
                            'create',
                            {},
                            null
                        );
                        await services.policyStore.assignPermissionToSubjectAndMarker(
                            recordName,
                            'role',
                            'developer',
                            'inst',
                            PRIVATE_MARKER,
                            'read',
                            {},
                            null
                        );
                        await services.policyStore.assignPermissionToSubjectAndMarker(
                            recordName,
                            'role',
                            'developer',
                            'inst',
                            PRIVATE_MARKER,
                            'updateData',
                            {},
                            null
                        );
                        await services.policyStore.assignPermissionToSubjectAndMarker(
                            recordName,
                            'role',
                            'developer',
                            'marker',
                            ACCOUNT_MARKER,
                            'assign',
                            {},
                            null
                        );

                        services.policyStore.roles[recordName] = {
                            [otherUserId]: new Set(['developer']),
                        };

                        const result = await server.addUserUpdates({
                            userId: otherUserId,
                            recordName: recordName,
                            inst,
                            branch: 'testBranch',
                            updates: ['111', '222'],
                        });

                        expect(result).toEqual({
                            success: false,
                            errorCode: 'subscription_limit_reached',
                            errorMessage:
                                'The maximum number of insts has been reached.',
                        });
                    });
                });
            });
        });

        describe('repo/send_action', () => {
            describe('no record', () => {
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
                        messenger
                            .getMessages(device2Info.serverConnectionId)
                            .slice(2)
                    ).toEqual([]);
                    expect(
                        messenger
                            .getMessages(device3Info.serverConnectionId)
                            .slice(2)
                    ).toEqual([
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

                        await server.watchBranch(
                            device2Info.serverConnectionId,
                            {
                                type: 'repo/watch_branch',
                                recordName: null,
                                inst,
                                branch: 'testBranch',
                            }
                        );

                        await server.watchBranch(
                            device3Info.serverConnectionId,
                            {
                                type: 'repo/watch_branch',
                                recordName: null,
                                inst,
                                branch: 'testBranch',
                            }
                        );

                        await server.sendAction(
                            device1Info.serverConnectionId,
                            {
                                type: 'repo/send_action',
                                recordName: null,
                                inst,
                                branch: 'testBranch',
                                action: remote({
                                    type: 'abc',
                                }),
                            }
                        );

                        expect(
                            messenger
                                .getMessages(device2Info.serverConnectionId)
                                .slice(2)
                        ).toEqual([]);
                        expect(
                            messenger
                                .getMessages(device3Info.serverConnectionId)
                                .slice(2)
                        ).toEqual([
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
                        messenger
                            .getMessages(device1Info.serverConnectionId)
                            .slice(2)
                    ).toEqual([
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
                        messenger
                            .getMessages(device3Info.serverConnectionId)
                            .slice(2)
                    ).toEqual([
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
                        messenger
                            .getMessages(device2Info.serverConnectionId)
                            .slice(2)
                    ).toEqual([]);

                    expect(
                        messenger
                            .getMessages(device3Info.serverConnectionId)
                            .slice(2)
                    ).toEqual([
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
                        messenger
                            .getMessages(device2Info.serverConnectionId)
                            .slice(2)
                    ).toEqual([]);
                    expect(
                        messenger
                            .getMessages(device3Info.serverConnectionId)
                            .slice(2)
                    ).toEqual([
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
                        messenger
                            .getMessages(device2Info.serverConnectionId)
                            .slice(2)
                    ).toEqual([]);
                    expect(
                        messenger
                            .getMessages(device3Info.serverConnectionId)
                            .slice(2)
                    ).toEqual([
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

            describe('records', () => {
                beforeEach(async () => {
                    await services.records.createRecord({
                        userId,
                        recordName,
                        ownerId: userId,
                    });
                });

                it('should return a inst_not_found error if the record does not exist', async () => {
                    const token = generateV1ConnectionToken(
                        connectionKey,
                        connectionId,
                        'otherRecord',
                        inst
                    );

                    await server.login(serverConnectionId, 1, {
                        type: 'login',
                        connectionToken: token,
                    });

                    await server.sendAction(serverConnectionId, {
                        type: 'repo/send_action',
                        recordName: 'otherRecord',
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

                    expect(messenger.getEvents(serverConnectionId)).toEqual([
                        [
                            WebsocketEventTypes.Error,
                            -1,
                            {
                                success: false,
                                errorCode: 'inst_not_found',
                                errorMessage: 'The inst was not found.',
                            },
                        ],
                    ]);
                    expect(
                        messenger.getMessages(serverConnectionId).slice(1)
                    ).toEqual([]);
                });

                it('should return a inst_not_found error if the inst does not exist', async () => {
                    const token = generateV1ConnectionToken(
                        connectionKey,
                        connectionId,
                        recordName,
                        'otherInst'
                    );

                    await server.login(serverConnectionId, 1, {
                        type: 'login',
                        connectionToken: token,
                    });

                    await server.sendAction(serverConnectionId, {
                        type: 'repo/send_action',
                        recordName,
                        inst: 'otherInst',
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

                    expect(messenger.getEvents(serverConnectionId)).toEqual([
                        [
                            WebsocketEventTypes.Error,
                            -1,
                            {
                                success: false,
                                errorCode: 'inst_not_found',
                                errorMessage: 'The inst was not found.',
                            },
                        ],
                    ]);
                    expect(
                        messenger.getMessages(serverConnectionId).slice(1)
                    ).toEqual([]);
                });

                it('should return not_authorized if the record name doesnt match the connection token', async () => {
                    await server.login(serverConnectionId, 1, {
                        type: 'login',
                        connectionToken,
                    });

                    await server.sendAction(serverConnectionId, {
                        type: 'repo/send_action',
                        recordName: 'otherRecord',
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

                    expect(messenger.getEvents(serverConnectionId)).toEqual([
                        [
                            WebsocketEventTypes.Error,
                            -1,
                            {
                                success: false,
                                errorCode: 'not_authorized',
                                errorMessage:
                                    'You are not authorized to access this inst.',
                                recordName: 'otherRecord',
                                inst,
                                branch: 'testBranch',
                                reason: {
                                    type: 'invalid_token',
                                },
                            },
                        ],
                    ]);
                    expect(
                        messenger.getMessages(serverConnectionId).slice(1)
                    ).toEqual([]);
                });

                it('should return not_authorized if the inst name doesnt match the connection token', async () => {
                    await server.login(serverConnectionId, 1, {
                        type: 'login',
                        connectionToken,
                    });

                    await server.sendAction(serverConnectionId, {
                        type: 'repo/send_action',
                        recordName,
                        inst: 'otherInst',
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

                    expect(messenger.getEvents(serverConnectionId)).toEqual([
                        [
                            WebsocketEventTypes.Error,
                            -1,
                            {
                                success: false,
                                errorCode: 'not_authorized',
                                errorMessage:
                                    'You are not authorized to access this inst.',
                                recordName,
                                inst: 'otherInst',
                                branch: 'testBranch',
                                reason: {
                                    type: 'invalid_token',
                                },
                            },
                        ],
                    ]);
                    expect(
                        messenger.getMessages(serverConnectionId).slice(1)
                    ).toEqual([]);
                });

                describe('owner', () => {
                    let connectionInfo: ConnectionInfo;
                    let otherConnection1: ConnectionInfo;
                    let otherConnection2: ConnectionInfo;
                    const otherUserConnectionId = 'otherConnectionId';
                    const otherUserConnectionId2 = 'otherConnectionId2';
                    const otherServerConnectionId = 'otherServerConnectionId';
                    const otherServerConnectionId2 = 'otherServerConnectionId2';
                    let otherUserId: string;
                    let otherUserConnectionKey: string;
                    let otherUserToken: string;
                    let otherUserToken2: string;

                    beforeEach(async () => {
                        await instStore.saveInst({
                            recordName,
                            inst,
                            markers: [PRIVATE_MARKER],
                        });

                        uuidMock.mockReturnValueOnce('otherUserId');
                        const otherUser = await createTestUser(
                            services,
                            'other@example.com'
                        );
                        otherUserToken = generateV1ConnectionToken(
                            otherUser.connectionKey,
                            otherUserConnectionId,
                            recordName,
                            inst
                        );
                        otherUserToken2 = generateV1ConnectionToken(
                            otherUser.connectionKey,
                            otherUserConnectionId2,
                            recordName,
                            inst
                        );
                        otherUserId = otherUser.userId;
                        otherUserConnectionKey = otherUser.connectionKey;

                        otherConnection1 = {
                            connectionId: otherUserConnectionId,
                            userId: otherUserId,
                            sessionId: otherUser.sessionId,
                        };
                        otherConnection2 = {
                            connectionId: otherUserConnectionId2,
                            userId: otherUserId,
                            sessionId: otherUser.sessionId,
                        };
                        connectionInfo = {
                            connectionId,
                            sessionId,
                            userId,
                        };

                        await server.login(otherServerConnectionId, 1, {
                            type: 'login',
                            connectionToken: otherUserToken,
                        });

                        await server.login(otherServerConnectionId2, 1, {
                            type: 'login',
                            connectionToken: otherUserToken2,
                        });

                        await server.login(serverConnectionId, 1, {
                            type: 'login',
                            connectionToken,
                        });

                        await services.policyStore.assignPermissionToSubjectAndMarker(
                            recordName,
                            'role',
                            'developer',
                            'inst',
                            PRIVATE_MARKER,
                            'read',
                            {},
                            null
                        );
                        services.policyStore.roles[recordName] = {
                            [otherUserId]: new Set(['developer']),
                        };
                    });

                    it('should notify the device that the event was sent to', async () => {
                        await server.watchBranch(otherServerConnectionId, {
                            type: 'repo/watch_branch',
                            recordName,
                            inst,
                            branch: 'testBranch',
                        });

                        await server.watchBranch(otherServerConnectionId2, {
                            type: 'repo/watch_branch',
                            recordName,
                            inst,
                            branch: 'testBranch',
                        });

                        await server.sendAction(serverConnectionId, {
                            type: 'repo/send_action',
                            recordName,
                            inst,
                            branch: 'testBranch',
                            action: remote(
                                {
                                    type: 'abc',
                                },
                                {
                                    connectionId: otherConnection1.connectionId,
                                }
                            ),
                        });

                        expect(
                            messenger
                                .getMessages(otherServerConnectionId)
                                .slice(3)
                        ).toEqual([
                            {
                                type: 'repo/receive_action',
                                recordName,
                                inst,
                                branch: 'testBranch',
                                action: device(connectionInfo, {
                                    type: 'abc',
                                }),
                            },
                        ]);
                        expect(
                            messenger
                                .getMessages(otherServerConnectionId2)
                                .slice(3)
                        ).toEqual([]);
                    });

                    it('should send remote events to a random device if none is specified', async () => {
                        const originalRandom = Math.random;
                        try {
                            const randomMock = (Math.random = jest.fn());
                            randomMock.mockReturnValueOnce(0);

                            await server.watchBranch(serverConnectionId, {
                                type: 'repo/watch_branch',
                                recordName,
                                inst,
                                branch: 'testBranch',
                            });

                            await server.watchBranch(otherServerConnectionId2, {
                                type: 'repo/watch_branch',
                                recordName,
                                inst,
                                branch: 'testBranch',
                            });

                            await server.sendAction(serverConnectionId, {
                                type: 'repo/send_action',
                                recordName,
                                inst,
                                branch: 'testBranch',
                                action: remote({
                                    type: 'abc',
                                }),
                            });

                            expect(
                                messenger
                                    .getMessages(serverConnectionId)
                                    .slice(3)
                            ).toEqual([]);
                            expect(
                                messenger
                                    .getMessages(otherServerConnectionId2)
                                    .slice(3)
                            ).toEqual([
                                {
                                    type: 'repo/receive_action',
                                    recordName,
                                    inst,
                                    branch: 'testBranch',
                                    action: device(connectionInfo, {
                                        type: 'abc',
                                    }),
                                },
                            ]);
                        } finally {
                            Math.random = originalRandom;
                        }
                    });

                    it('should broadcast to all devices if broadcast is true', async () => {
                        await server.watchBranch(serverConnectionId, {
                            type: 'repo/watch_branch',
                            recordName,
                            inst,
                            branch: 'testBranch',
                        });

                        await server.watchBranch(otherServerConnectionId2, {
                            type: 'repo/watch_branch',
                            recordName,
                            inst,
                            branch: 'testBranch',
                        });

                        await server.sendAction(serverConnectionId, {
                            type: 'repo/send_action',
                            recordName,
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
                            messenger.getMessages(serverConnectionId).slice(3)
                        ).toEqual([
                            {
                                type: 'repo/receive_action',
                                recordName,
                                inst,
                                branch: 'testBranch',
                                action: device(connectionInfo, {
                                    type: 'abc',
                                }),
                            },
                        ]);
                        expect(
                            messenger
                                .getMessages(otherServerConnectionId)
                                .slice(1)
                        ).toEqual([]);
                        expect(
                            messenger
                                .getMessages(otherServerConnectionId2)
                                .slice(3)
                        ).toEqual([
                            {
                                type: 'repo/receive_action',
                                recordName,
                                inst,
                                branch: 'testBranch',
                                action: device(connectionInfo, {
                                    type: 'abc',
                                }),
                            },
                        ]);
                    });

                    it('should relay the task ID from the remote action to the device action', async () => {
                        await server.watchBranch(otherServerConnectionId, {
                            type: 'repo/watch_branch',
                            recordName,
                            inst,
                            branch: 'testBranch',
                        });

                        await server.watchBranch(otherServerConnectionId2, {
                            type: 'repo/watch_branch',
                            recordName,
                            inst,
                            branch: 'testBranch',
                        });

                        await server.sendAction(serverConnectionId, {
                            type: 'repo/send_action',
                            recordName,
                            inst,
                            branch: 'testBranch',
                            action: remote(
                                {
                                    type: 'abc',
                                },
                                {
                                    connectionId: otherConnection2.connectionId,
                                },
                                undefined,
                                'task1'
                            ),
                        });

                        expect(
                            messenger
                                .getMessages(otherServerConnectionId)
                                .slice(3)
                        ).toEqual([]);

                        expect(
                            messenger
                                .getMessages(otherServerConnectionId2)
                                .slice(3)
                        ).toEqual([
                            {
                                type: 'repo/receive_action',
                                recordName,
                                inst,
                                branch: 'testBranch',
                                action: device(
                                    connectionInfo,
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

                        await server.watchBranch(otherServerConnectionId, {
                            type: 'repo/watch_branch',
                            recordName,
                            inst,
                            branch: 'testBranch',
                        });

                        await server.watchBranch(otherServerConnectionId2, {
                            type: 'repo/watch_branch',
                            recordName,
                            inst,
                            branch: 'testBranch',
                        });

                        await server.sendAction(serverConnectionId, {
                            type: 'repo/send_action',
                            recordName,
                            inst,
                            branch: 'testBranch',
                            action: remoteResult(
                                'data',
                                {
                                    connectionId: otherConnection2.connectionId,
                                },
                                'task1'
                            ),
                        });

                        expect(
                            messenger
                                .getMessages(otherServerConnectionId)
                                .slice(3)
                        ).toEqual([]);
                        expect(
                            messenger
                                .getMessages(otherServerConnectionId2)
                                .slice(3)
                        ).toEqual([
                            {
                                type: 'repo/receive_action',
                                recordName,
                                inst,
                                branch: 'testBranch',
                                action: deviceResult(
                                    connectionInfo,
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

                        await server.watchBranch(otherServerConnectionId, {
                            type: 'repo/watch_branch',
                            recordName,
                            inst,
                            branch: 'testBranch',
                        });

                        await server.watchBranch(otherServerConnectionId2, {
                            type: 'repo/watch_branch',
                            recordName,
                            inst,
                            branch: 'testBranch',
                        });

                        await server.sendAction(serverConnectionId, {
                            type: 'repo/send_action',
                            recordName,
                            inst,
                            branch: 'testBranch',
                            action: remoteError(
                                'data',
                                {
                                    connectionId: otherConnection2.connectionId,
                                },
                                'task1'
                            ),
                        });

                        expect(
                            messenger
                                .getMessages(otherServerConnectionId)
                                .slice(3)
                        ).toEqual([]);
                        expect(
                            messenger
                                .getMessages(otherServerConnectionId2)
                                .slice(3)
                        ).toEqual([
                            {
                                type: 'repo/receive_action',
                                recordName,
                                inst,
                                branch: 'testBranch',
                                action: deviceError(
                                    connectionInfo,
                                    'data',
                                    'task1'
                                ),
                            },
                        ]);
                    });

                    it('should return a not_authorized error if insts are not allowed', async () => {
                        store.subscriptionConfiguration =
                            buildSubscriptionConfig((config) =>
                                config.addSubscription('sub1', (sub) =>
                                    sub
                                        .withTier('tier1')
                                        .withAllDefaultFeatures()
                                        .withInsts({
                                            allowed: false,
                                        })
                                )
                            );

                        await store.saveUser({
                            id: userId,
                            allSessionRevokeTimeMs: null,
                            currentLoginRequestId: null,
                            email: 'test@example.com',
                            phoneNumber: null,
                            subscriptionId: 'sub1',
                            subscriptionStatus: 'active',
                        });

                        await server.sendAction(serverConnectionId, {
                            type: 'repo/send_action',
                            recordName,
                            inst,
                            branch: 'testBranch',
                            action: remote(
                                {
                                    type: 'abc',
                                },
                                {
                                    connectionId: otherConnection1.connectionId,
                                }
                            ),
                        });

                        expect(messenger.getEvents(serverConnectionId)).toEqual(
                            [
                                [
                                    WebsocketEventTypes.Error,
                                    -1,
                                    {
                                        success: false,
                                        errorCode: 'not_authorized',
                                        errorMessage:
                                            'Insts are not allowed for this subscription.',
                                    },
                                ],
                            ]
                        );
                        expect(
                            messenger.getMessages(serverConnectionId).slice(2)
                        ).toEqual([]);
                    });
                });

                describe('guest', () => {
                    let connectionInfo: ConnectionInfo;
                    let otherConnection1: ConnectionInfo;
                    let otherConnection2: ConnectionInfo;
                    const otherUserConnectionId = 'otherConnectionId';
                    const otherUserConnectionId2 = 'otherConnectionId2';
                    const otherServerConnectionId = 'otherServerConnectionId';
                    const otherServerConnectionId2 = 'otherServerConnectionId2';
                    let otherUserId: string;
                    let otherUserConnectionKey: string;
                    let otherUserToken: string;
                    let otherUserToken2: string;

                    beforeEach(async () => {
                        await instStore.saveInst({
                            recordName,
                            inst,
                            markers: [PRIVATE_MARKER],
                        });

                        uuidMock.mockReturnValueOnce('otherUserId');
                        const otherUser = await createTestUser(
                            services,
                            'other@example.com'
                        );
                        otherUserToken = generateV1ConnectionToken(
                            otherUser.connectionKey,
                            otherUserConnectionId,
                            recordName,
                            inst
                        );
                        otherUserToken2 = generateV1ConnectionToken(
                            otherUser.connectionKey,
                            otherUserConnectionId2,
                            recordName,
                            inst
                        );
                        otherUserId = otherUser.userId;
                        otherUserConnectionKey = otherUser.connectionKey;

                        otherConnection1 = {
                            connectionId: otherUserConnectionId,
                            userId: otherUserId,
                            sessionId: otherUser.sessionId,
                        };
                        otherConnection2 = {
                            connectionId: otherUserConnectionId2,
                            userId: otherUserId,
                            sessionId: otherUser.sessionId,
                        };
                        connectionInfo = {
                            connectionId,
                            sessionId,
                            userId,
                        };

                        await server.login(otherServerConnectionId, 1, {
                            type: 'login',
                            connectionToken: otherUserToken,
                        });

                        await server.login(otherServerConnectionId2, 1, {
                            type: 'login',
                            connectionToken: otherUserToken2,
                        });

                        await server.login(serverConnectionId, 1, {
                            type: 'login',
                            connectionToken,
                        });
                    });

                    it('should return a not_authorized error if the user does not have the inst.read permission', async () => {
                        await server.watchBranch(serverConnectionId, {
                            type: 'repo/watch_branch',
                            recordName,
                            inst,
                            branch: 'testBranch',
                        });

                        await server.sendAction(otherServerConnectionId, {
                            type: 'repo/send_action',
                            recordName,
                            inst,
                            branch: 'testBranch',
                            action: remote(
                                {
                                    type: 'abc',
                                },
                                {
                                    connectionId: connectionId,
                                }
                            ),
                        });

                        expect(
                            messenger.getEvents(otherServerConnectionId)
                        ).toEqual([
                            [
                                WebsocketEventTypes.Error,
                                -1,
                                {
                                    success: false,
                                    errorCode: 'not_authorized',
                                    errorMessage:
                                        'You are not authorized to perform this action.',
                                    reason: {
                                        type: 'missing_permission',
                                        recordName,
                                        resourceKind: 'inst',
                                        resourceId: inst,
                                        subjectType: 'user',
                                        subjectId: otherUserId,
                                        action: 'read',
                                    },
                                },
                            ],
                        ]);
                        expect(
                            messenger.getMessages(serverConnectionId).slice(3)
                        ).toEqual([]);
                    });

                    it('should return a not_authorized error if the user does not have the inst.sendAction permission', async () => {
                        await services.policyStore.assignPermissionToSubjectAndMarker(
                            recordName,
                            'role',
                            'developer',
                            'inst',
                            PRIVATE_MARKER,
                            'read',
                            {},
                            null
                        );

                        services.policyStore.roles[recordName] = {
                            [otherUserId]: new Set(['developer']),
                        };

                        await server.watchBranch(serverConnectionId, {
                            type: 'repo/watch_branch',
                            recordName,
                            inst,
                            branch: 'testBranch',
                        });

                        await server.sendAction(otherServerConnectionId, {
                            type: 'repo/send_action',
                            recordName,
                            inst,
                            branch: 'testBranch',
                            action: remote(
                                {
                                    type: 'abc',
                                },
                                {
                                    connectionId: connectionId,
                                }
                            ),
                        });

                        expect(
                            messenger.getEvents(otherServerConnectionId)
                        ).toEqual([
                            [
                                WebsocketEventTypes.Error,
                                -1,
                                {
                                    success: false,
                                    errorCode: 'not_authorized',
                                    errorMessage:
                                        'You are not authorized to perform this action.',
                                    reason: {
                                        type: 'missing_permission',
                                        recordName,
                                        resourceKind: 'inst',
                                        resourceId: inst,
                                        subjectType: 'user',
                                        subjectId: otherUserId,
                                        action: 'sendAction',
                                    },
                                },
                            ],
                        ]);
                        expect(
                            messenger.getMessages(serverConnectionId).slice(3)
                        ).toEqual([]);
                    });

                    it('should send the action if the user has inst.read and inst.sendAction permissions', async () => {
                        await services.policyStore.assignPermissionToSubjectAndMarker(
                            recordName,
                            'role',
                            'developer',
                            'inst',
                            PRIVATE_MARKER,
                            'read',
                            {},
                            null
                        );
                        await services.policyStore.assignPermissionToSubjectAndMarker(
                            recordName,
                            'role',
                            'developer',
                            'inst',
                            PRIVATE_MARKER,
                            'sendAction',
                            {},
                            null
                        );

                        services.policyStore.roles[recordName] = {
                            [otherUserId]: new Set(['developer']),
                        };

                        await server.watchBranch(serverConnectionId, {
                            type: 'repo/watch_branch',
                            recordName,
                            inst,
                            branch: 'testBranch',
                        });

                        await server.sendAction(otherServerConnectionId, {
                            type: 'repo/send_action',
                            recordName,
                            inst,
                            branch: 'testBranch',
                            action: remote(
                                {
                                    type: 'abc',
                                },
                                {
                                    connectionId: connectionId,
                                }
                            ),
                        });

                        expect(
                            messenger.getEvents(otherServerConnectionId)
                        ).toEqual([]);
                        expect(
                            messenger.getMessages(serverConnectionId).slice(3)
                        ).toEqual([
                            {
                                type: 'repo/receive_action',
                                recordName,
                                inst,
                                branch: 'testBranch',
                                action: device(otherConnection1, {
                                    type: 'abc',
                                }),
                            },
                        ]);
                    });

                    it('should return a not_authorized error if insts are not allowed', async () => {
                        store.subscriptionConfiguration =
                            buildSubscriptionConfig((config) =>
                                config.addSubscription('sub1', (sub) =>
                                    sub
                                        .withTier('tier1')
                                        .withAllDefaultFeatures()
                                        .withInsts({
                                            allowed: false,
                                        })
                                )
                            );

                        await store.saveUser({
                            id: userId,
                            allSessionRevokeTimeMs: null,
                            currentLoginRequestId: null,
                            email: 'test@example.com',
                            phoneNumber: null,
                            subscriptionId: 'sub1',
                            subscriptionStatus: 'active',
                        });

                        await services.policyStore.assignPermissionToSubjectAndMarker(
                            recordName,
                            'role',
                            'developer',
                            'inst',
                            PRIVATE_MARKER,
                            'read',
                            {},
                            null
                        );
                        await services.policyStore.assignPermissionToSubjectAndMarker(
                            recordName,
                            'role',
                            'developer',
                            'inst',
                            PRIVATE_MARKER,
                            'sendAction',
                            {},
                            null
                        );

                        services.policyStore.roles[recordName] = {
                            [otherUserId]: new Set(['developer']),
                        };

                        await server.watchBranch(serverConnectionId, {
                            type: 'repo/watch_branch',
                            recordName,
                            inst,
                            branch: 'testBranch',
                        });

                        await server.sendAction(otherServerConnectionId, {
                            type: 'repo/send_action',
                            recordName,
                            inst,
                            branch: 'testBranch',
                            action: remote(
                                {
                                    type: 'abc',
                                },
                                {
                                    connectionId: connectionId,
                                }
                            ),
                        });

                        expect(
                            messenger.getEvents(otherServerConnectionId)
                        ).toEqual([
                            [
                                WebsocketEventTypes.Error,
                                -1,
                                {
                                    success: false,
                                    errorCode: 'not_authorized',
                                    errorMessage:
                                        'Insts are not allowed for this subscription.',
                                },
                            ],
                        ]);
                        expect(
                            messenger.getMessages(serverConnectionId).slice(2)
                        ).toEqual([]);
                    });
                });
            });
        });

        describe('repo/watch_branch_connections', () => {
            describe('no record', () => {
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

                it('should return a invalid_connection_state error if the connection cannot be found in Redis', async () => {
                    await server.watchBranchDevices(
                        device1Info.serverConnectionId,
                        null,
                        inst,
                        'testBranch'
                    );
                    expect(
                        messenger.getEvents(device1Info.serverConnectionId)
                    ).toEqual([
                        [
                            WebsocketEventTypes.Error,
                            -1,
                            {
                                success: false,
                                errorCode: 'invalid_connection_state',
                                errorMessage: `A server error occurred. (namespace: null/${inst}/${'testBranch'}, connectionId: ${
                                    device1Info.serverConnectionId
                                })`,
                                recordName: null,
                                inst: inst,
                                branch: 'testBranch',
                            },
                        ],
                    ]);
                    expect(
                        messenger.isDisconnected(device1Info.serverConnectionId)
                    ).toBe(true);
                });
            });

            describe('records', () => {
                beforeEach(async () => {
                    await services.records.createRecord({
                        userId,
                        recordName,
                        ownerId: userId,
                    });
                });

                describe('owner', () => {
                    beforeEach(async () => {
                        await instStore.saveInst({
                            recordName,
                            inst,
                            markers: [PUBLIC_WRITE_MARKER],
                        });

                        await server.login(serverConnectionId, 1, {
                            type: 'login',
                            connectionToken,
                        });

                        await connectionStore.saveAuthorizedInst(
                            device2Info.serverConnectionId,
                            recordName,
                            inst,
                            'token'
                        );
                        await connectionStore.saveAuthorizedInst(
                            device3Info.serverConnectionId,
                            recordName,
                            inst,
                            'token'
                        );
                        await connectionStore.saveAuthorizedInst(
                            device4Info.serverConnectionId,
                            recordName,
                            inst,
                            'token'
                        );
                    });

                    it('should send an event when a device connects to a branch', async () => {
                        await connectionStore.saveConnection(device2Info);

                        await server.watchBranchDevices(
                            serverConnectionId,
                            recordName,
                            inst,
                            'testBranch'
                        );

                        await server.watchBranch(
                            device2Info.serverConnectionId,
                            {
                                type: 'repo/watch_branch',
                                recordName,
                                inst,
                                branch: 'testBranch',
                            }
                        );

                        expect(
                            messenger.getMessages(serverConnectionId).slice(1)
                        ).toEqual([
                            {
                                type: 'repo/connected_to_branch',
                                broadcast: false,
                                branch: {
                                    type: 'repo/watch_branch',
                                    recordName,
                                    inst,
                                    branch: 'testBranch',
                                },
                                connection: connectionInfo(device2Info),
                            },
                        ]);
                    });

                    it('should send an event when a device unwatches a branch', async () => {
                        await connectionStore.saveConnection(device2Info);

                        await server.watchBranchDevices(
                            serverConnectionId,
                            recordName,
                            inst,
                            'testBranch'
                        );

                        await server.watchBranch(
                            device2Info.serverConnectionId,
                            {
                                type: 'repo/watch_branch',
                                recordName,
                                inst,
                                branch: 'testBranch',
                            }
                        );

                        await server.unwatchBranch(
                            device2Info.serverConnectionId,
                            recordName,
                            inst,
                            'testBranch'
                        );

                        expect(
                            messenger.getMessages(serverConnectionId).slice(1)
                        ).toEqual([
                            {
                                type: 'repo/connected_to_branch',
                                broadcast: false,
                                branch: {
                                    type: 'repo/watch_branch',
                                    recordName,
                                    inst,
                                    branch: 'testBranch',
                                },
                                connection: connectionInfo(device2Info),
                            },
                            {
                                type: 'repo/disconnected_from_branch',
                                broadcast: false,
                                recordName,
                                inst,
                                branch: 'testBranch',
                                connection: connectionInfo(device2Info),
                            },
                        ]);
                    });

                    it('should send an event when a device disconnects', async () => {
                        await connectionStore.saveConnection(device2Info);

                        await server.watchBranchDevices(
                            serverConnectionId,
                            recordName,
                            inst,
                            'testBranch'
                        );

                        await server.watchBranch(
                            device2Info.serverConnectionId,
                            {
                                type: 'repo/watch_branch',
                                recordName,
                                inst,
                                branch: 'testBranch',
                            }
                        );

                        await server.disconnect(device2Info.serverConnectionId);

                        expect(
                            messenger.getMessages(serverConnectionId).slice(1)
                        ).toEqual([
                            {
                                type: 'repo/connected_to_branch',
                                broadcast: false,
                                branch: {
                                    type: 'repo/watch_branch',
                                    recordName,
                                    inst,
                                    branch: 'testBranch',
                                },
                                connection: connectionInfo(device2Info),
                            },
                            {
                                type: 'repo/disconnected_from_branch',
                                broadcast: false,
                                recordName,
                                inst,
                                branch: 'testBranch',
                                connection: connectionInfo(device2Info),
                            },
                        ]);
                    });

                    it('should send events for all the currently connected devices only for the specified branch', async () => {
                        await connectionStore.saveConnection(device2Info);
                        await connectionStore.saveConnection(device3Info);
                        await connectionStore.saveConnection(device4Info);

                        await server.watchBranch(
                            device2Info.serverConnectionId,
                            {
                                type: 'repo/watch_branch',
                                recordName,
                                inst,
                                branch: 'testBranch',
                            }
                        );

                        await server.watchBranch(
                            device3Info.serverConnectionId,
                            {
                                type: 'repo/watch_branch',
                                recordName,
                                inst,
                                branch: 'testBranch',
                            }
                        );

                        await server.watchBranch(
                            device4Info.serverConnectionId,
                            {
                                type: 'repo/watch_branch',
                                recordName,
                                inst,
                                branch: 'testBranch2',
                            }
                        );

                        await server.watchBranchDevices(
                            serverConnectionId,
                            recordName,
                            inst,
                            'testBranch'
                        );

                        expect(
                            messenger.getMessages(serverConnectionId).slice(1)
                        ).toEqual([
                            {
                                type: 'repo/connected_to_branch',
                                broadcast: false,
                                branch: {
                                    type: 'repo/watch_branch',
                                    recordName,
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
                                    recordName,
                                    inst,
                                    branch: 'testBranch',
                                    temporary: false,
                                },
                                connection: connectionInfo(device3Info),
                            },
                        ]);
                    });

                    it('should include whether the branch is temporary when a device connects', async () => {
                        await connectionStore.saveConnection(device2Info);

                        await server.watchBranchDevices(
                            serverConnectionId,
                            recordName,
                            inst,
                            'testBranch'
                        );

                        await server.watchBranch(
                            device2Info.serverConnectionId,
                            {
                                type: 'repo/watch_branch',
                                recordName,
                                inst,
                                branch: 'testBranch',
                                temporary: true,
                            }
                        );

                        expect(
                            messenger.getMessages(serverConnectionId).slice(1)
                        ).toEqual([
                            {
                                type: 'repo/connected_to_branch',
                                broadcast: false,
                                branch: {
                                    type: 'repo/watch_branch',
                                    recordName,
                                    inst,
                                    branch: 'testBranch',
                                    temporary: true,
                                },
                                connection: connectionInfo(device2Info),
                            },
                        ]);
                    });

                    it('should return a not_authorized error if the record name doesnt match the connection token', async () => {
                        await server.watchBranchDevices(
                            serverConnectionId,
                            'wrong',
                            inst,
                            'testBranch'
                        );

                        expect(messenger.getEvents(serverConnectionId)).toEqual(
                            [
                                [
                                    WebsocketEventTypes.Error,
                                    -1,
                                    {
                                        success: false,
                                        errorCode: 'not_authorized',
                                        errorMessage:
                                            'You are not authorized to access this inst.',
                                        recordName: 'wrong',
                                        inst,
                                        branch: 'testBranch',
                                        reason: {
                                            type: 'invalid_token',
                                        },
                                    },
                                ],
                            ]
                        );
                    });

                    it('should return a not_authorized error if the inst name doesnt match the connection token', async () => {
                        await instStore.saveInst({
                            recordName,
                            inst: 'wrong',
                            markers: [PUBLIC_WRITE_MARKER],
                        });

                        await server.watchBranchDevices(
                            serverConnectionId,
                            recordName,
                            'wrong',
                            'testBranch'
                        );

                        expect(messenger.getEvents(serverConnectionId)).toEqual(
                            [
                                [
                                    WebsocketEventTypes.Error,
                                    -1,
                                    {
                                        success: false,
                                        errorCode: 'not_authorized',
                                        errorMessage:
                                            'You are not authorized to access this inst.',
                                        recordName,
                                        inst: 'wrong',
                                        branch: 'testBranch',
                                        reason: {
                                            type: 'invalid_token',
                                        },
                                    },
                                ],
                            ]
                        );
                    });
                });

                describe('guest', () => {
                    const otherUserConnectionId = 'otherConnectionId';
                    let otherUserId: string;
                    let otherUserConnectionKey: string;
                    let otherUserToken: string;

                    beforeEach(async () => {
                        await instStore.saveInst({
                            recordName,
                            inst,
                            markers: [PRIVATE_MARKER],
                        });

                        await connectionStore.saveAuthorizedInst(
                            device2Info.serverConnectionId,
                            recordName,
                            inst,
                            'token'
                        );
                        await connectionStore.saveAuthorizedInst(
                            device3Info.serverConnectionId,
                            recordName,
                            inst,
                            'token'
                        );
                        await connectionStore.saveAuthorizedInst(
                            device4Info.serverConnectionId,
                            recordName,
                            inst,
                            'token'
                        );

                        uuidMock.mockReturnValueOnce('otherUserId');
                        const otherUser = await createTestUser(
                            services,
                            'other@example.com'
                        );
                        otherUserToken = generateV1ConnectionToken(
                            otherUser.connectionKey,
                            otherUserConnectionId,
                            recordName,
                            inst
                        );
                        otherUserId = otherUser.userId;
                        otherUserConnectionKey = otherUser.connectionKey;

                        await server.login(serverConnectionId, 1, {
                            type: 'login',
                            connectionToken: otherUserToken,
                        });
                    });

                    it('should return a not_authorized error if the user is not authorized to read the inst', async () => {
                        await server.watchBranchDevices(
                            serverConnectionId,
                            recordName,
                            inst,
                            'testBranch'
                        );

                        expect(messenger.getEvents(serverConnectionId)).toEqual(
                            [
                                [
                                    WebsocketEventTypes.Error,
                                    -1,
                                    {
                                        success: false,
                                        errorCode: 'not_authorized',
                                        errorMessage:
                                            'You are not authorized to perform this action.',
                                        reason: {
                                            type: 'missing_permission',
                                            recordName,
                                            resourceKind: 'inst',
                                            resourceId: inst,
                                            subjectType: 'user',
                                            subjectId: otherUserId,
                                            action: 'read',
                                        },
                                    },
                                ],
                            ]
                        );
                    });

                    it('should work if the user is allowed to read the inst', async () => {
                        await services.policyStore.assignPermissionToSubjectAndMarker(
                            recordName,
                            'role',
                            'developer',
                            'inst',
                            PRIVATE_MARKER,
                            'read',
                            {},
                            null
                        );

                        services.policyStore.roles[recordName] = {
                            [otherUserId]: new Set(['developer']),
                        };

                        await server.watchBranchDevices(
                            serverConnectionId,
                            recordName,
                            inst,
                            'testBranch'
                        );

                        expect(messenger.getEvents(serverConnectionId)).toEqual(
                            []
                        );
                    });
                });
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
            describe('no record', () => {
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

            describe('record', () => {
                beforeEach(async () => {
                    await services.records.createRecord({
                        userId,
                        recordName,
                        ownerId: userId,
                    });
                });

                it('should send a inst_not_found result if the inst does not exist', async () => {
                    await server.deviceCount(
                        serverConnectionId,
                        recordName,
                        inst,
                        'testBranch'
                    );

                    expect(messenger.getEvents(serverConnectionId)).toEqual([
                        [
                            WebsocketEventTypes.Error,
                            -1,
                            {
                                success: false,
                                errorCode: 'inst_not_found',
                                errorMessage: 'The inst was not found.',
                            },
                        ],
                    ]);
                });

                describe('owner', () => {
                    beforeEach(async () => {
                        await instStore.saveInst({
                            recordName,
                            inst,
                            markers: [PRIVATE_MARKER],
                        });

                        await server.login(serverConnectionId, 1, {
                            type: 'login',
                            connectionToken,
                        });
                    });

                    it('should send a response with the number of devices', async () => {
                        await connectionStore.saveBranchConnection({
                            ...device1Info,
                            mode: 'branch',
                            recordName,
                            inst,
                            branch: 'testBranch',
                            temporary: false,
                        });
                        await connectionStore.saveBranchConnection({
                            ...device2Info,
                            mode: 'branch',
                            recordName,
                            inst,
                            branch: 'testBranch',
                            temporary: false,
                        });

                        await server.deviceCount(
                            serverConnectionId,
                            recordName,
                            inst,
                            'testBranch'
                        );

                        expect(messenger.getEvents(serverConnectionId)).toEqual(
                            []
                        );
                        expect(
                            messenger.getMessages(serverConnectionId).slice(1)
                        ).toEqual([
                            {
                                type: 'repo/connection_count',
                                recordName,
                                inst,
                                branch: 'testBranch',
                                count: 2,
                            },
                        ]);
                    });

                    it('should return a not_authorized error if the record name doesnt match the connection token', async () => {
                        await services.records.createRecord({
                            userId,
                            recordName: 'wrong',
                            ownerId: userId,
                        });

                        await instStore.saveInst({
                            recordName: 'wrong',
                            inst,
                            markers: [PRIVATE_MARKER],
                        });

                        await connectionStore.saveBranchConnection({
                            ...device1Info,
                            mode: 'branch',
                            recordName: 'wrong',
                            inst,
                            branch: 'testBranch',
                            temporary: false,
                        });
                        await connectionStore.saveBranchConnection({
                            ...device2Info,
                            mode: 'branch',
                            recordName: 'wrong',
                            inst,
                            branch: 'testBranch',
                            temporary: false,
                        });

                        await server.deviceCount(
                            serverConnectionId,
                            'wrong',
                            inst,
                            'testBranch'
                        );

                        expect(messenger.getEvents(serverConnectionId)).toEqual(
                            [
                                [
                                    WebsocketEventTypes.Error,
                                    -1,
                                    {
                                        success: false,
                                        errorCode: 'not_authorized',
                                        errorMessage:
                                            'You are not authorized to access this inst.',
                                        recordName: 'wrong',
                                        inst,
                                        branch: 'testBranch',
                                        reason: {
                                            type: 'invalid_token',
                                        },
                                    },
                                ],
                            ]
                        );
                        expect(
                            messenger.getMessages(serverConnectionId).slice(1)
                        ).toEqual([]);
                    });

                    it('should return a not_authorized error if the inst name doesnt match the connection token', async () => {
                        await services.records.createRecord({
                            userId,
                            recordName,
                            ownerId: userId,
                        });

                        await instStore.saveInst({
                            recordName,
                            inst: 'wrong',
                            markers: [PRIVATE_MARKER],
                        });

                        await connectionStore.saveBranchConnection({
                            ...device1Info,
                            mode: 'branch',
                            recordName,
                            inst: 'wrong',
                            branch: 'testBranch',
                            temporary: false,
                        });
                        await connectionStore.saveBranchConnection({
                            ...device2Info,
                            mode: 'branch',
                            recordName,
                            inst: 'wrong',
                            branch: 'testBranch',
                            temporary: false,
                        });

                        await server.deviceCount(
                            serverConnectionId,
                            recordName,
                            'wrong',
                            'testBranch'
                        );

                        expect(messenger.getEvents(serverConnectionId)).toEqual(
                            [
                                [
                                    WebsocketEventTypes.Error,
                                    -1,
                                    {
                                        success: false,
                                        errorCode: 'not_authorized',
                                        errorMessage:
                                            'You are not authorized to access this inst.',
                                        recordName,
                                        inst: 'wrong',
                                        branch: 'testBranch',
                                        reason: {
                                            type: 'invalid_token',
                                        },
                                    },
                                ],
                            ]
                        );
                        expect(
                            messenger.getMessages(serverConnectionId).slice(1)
                        ).toEqual([]);
                    });
                });

                describe('guest', () => {
                    const otherUserConnectionId = 'otherConnectionId';
                    let otherUserId: string;
                    let otherUserConnectionKey: string;
                    let otherUserToken: string;

                    beforeEach(async () => {
                        await instStore.saveInst({
                            recordName,
                            inst,
                            markers: [PRIVATE_MARKER],
                        });

                        uuidMock.mockReturnValueOnce('otherUserId');
                        const otherUser = await createTestUser(
                            services,
                            'other@example.com'
                        );
                        otherUserToken = generateV1ConnectionToken(
                            otherUser.connectionKey,
                            otherUserConnectionId,
                            recordName,
                            inst
                        );
                        otherUserId = otherUser.userId;
                        otherUserConnectionKey = otherUser.connectionKey;

                        await server.login(serverConnectionId, 1, {
                            type: 'login',
                            connectionToken: otherUserToken,
                        });
                    });

                    it('should return a not_authorized error if the user is not authorized to read the inst', async () => {
                        await server.deviceCount(
                            serverConnectionId,
                            recordName,
                            inst,
                            'testBranch'
                        );

                        expect(messenger.getEvents(serverConnectionId)).toEqual(
                            [
                                [
                                    WebsocketEventTypes.Error,
                                    -1,
                                    {
                                        success: false,
                                        errorCode: 'not_authorized',
                                        errorMessage:
                                            'You are not authorized to perform this action.',
                                        reason: {
                                            type: 'missing_permission',
                                            recordName,
                                            resourceKind: 'inst',
                                            resourceId: inst,
                                            subjectType: 'user',
                                            subjectId: otherUserId,
                                            action: 'read',
                                        },
                                    },
                                ],
                            ]
                        );
                    });

                    it('should work if the user has the inst.read permission', async () => {
                        await services.policyStore.assignPermissionToSubjectAndMarker(
                            recordName,
                            'role',
                            'developer',
                            'inst',
                            PRIVATE_MARKER,
                            'read',
                            {},
                            null
                        );

                        services.policyStore.roles[recordName] = {
                            [otherUserId]: new Set(['developer']),
                        };

                        await server.deviceCount(
                            serverConnectionId,
                            recordName,
                            inst,
                            'testBranch'
                        );

                        expect(messenger.getEvents(serverConnectionId)).toEqual(
                            []
                        );
                        expect(
                            messenger.getMessages(serverConnectionId).slice(1)
                        ).toEqual([
                            {
                                type: 'repo/connection_count',
                                recordName,
                                inst,
                                branch: 'testBranch',
                                count: 0,
                            },
                        ]);
                    });
                });
            });
        });

        describe('installPackage()', () => {
            async function recordPackage(
                recordName: string,
                address: string,
                markers: string[],
                key: PackageRecordVersionKey,
                aux: StoredAux
            ) {
                const r = await services.recordsStore.getRecordByName(
                    recordName
                );
                if (!r) {
                    await services.records.createRecord({
                        recordName,
                        userId,
                        ownerId: userId,
                    });
                }
                await services.packagesStore.createItem(recordName, {
                    id: address,
                    address: address,
                    markers,
                });

                const json = JSON.stringify(aux);
                const sha256 = getHash(json);

                uuidv7Mock.mockReturnValueOnce(
                    `${address}@${key.major}.${key.minor}.${key.patch}`
                );
                const result = await services.packageVersions.recordItem({
                    recordKeyOrRecordName: recordName,
                    userId: userId,
                    item: {
                        address,
                        key,
                        description: '',
                        entitlements: [],
                        auxFileRequest: {
                            fileSha256Hex: sha256,
                            fileByteLength: json.length,
                            fileDescription: 'aux.json',
                            fileMimeType: 'application/json',
                            headers: {},
                        },
                    },
                    instances: [],
                });
                uuidv7Mock.mockReset();

                if (!result.success) {
                    console.error(result);
                    throw new Error('Failed to record package');
                }

                if (!result.auxFileResult.success) {
                    console.error(result.auxFileResult);
                    throw new Error('Failed to record file');
                }

                files.set(result.auxFileResult.uploadUrl, json);
            }

            let originalFetch: typeof fetch;
            let fetchMock: jest.Mock;
            let files: Map<string, string>;

            beforeEach(async () => {
                files = new Map();

                originalFetch = global.fetch;
                fetchMock = global.fetch = jest.fn(async (request) => {
                    const url =
                        typeof request === 'string'
                            ? request
                            : request instanceof URL
                            ? request.href
                            : request.url;

                    const text = files.get(url);
                    return {
                        status: text ? 200 : 404,
                        text: async () => text,
                    } as Response;
                });

                await recordPackage(
                    recordName,
                    'public',
                    [PUBLIC_READ_MARKER],
                    version(1),
                    {
                        version: 1,
                        state: {
                            test: createBot('test', {
                                abc: 'def',
                            }),
                        },
                    }
                );
            });

            afterEach(() => {
                global.fetch = originalFetch;
            });

            it('should load the package into the default branch of the inst', async () => {
                uuidv7Mock.mockReturnValueOnce('packageId');

                const result = await server.installPackage({
                    userId: userId,
                    userRole: 'none',
                    recordName,
                    inst,
                    package: {
                        recordName,
                        address: 'public',
                        key: version(1),
                    },
                });

                expect(result).toEqual({
                    success: true,
                    packageLoadId: 'packageId',
                    package: {
                        id: 'public@1.0.0',
                        packageId: 'public',
                        address: 'public',
                        key: version(1),
                        entitlements: [],
                        description: '',
                        markers: [PUBLIC_READ_MARKER],
                        createdAtMs: expect.any(Number),
                        sha256: expect.any(String),
                        auxSha256: expect.any(String),
                        auxFileName: expect.any(String),
                        createdFile: true,
                        requiresReview: false,
                        sizeInBytes: expect.any(Number),
                        approved: true,
                        approvalType: 'normal',
                    },
                });

                const updates = await instStore.getCurrentUpdates(
                    recordName,
                    inst,
                    DEFAULT_BRANCH_NAME
                );
                const state = getStateFromUpdates(
                    getInstStateFromUpdates(
                        updates.updates.map((u, index) => ({
                            id: index,
                            update: u,
                            timestamp: 123,
                        }))
                    )
                );

                expect(state).toEqual({
                    test: createBot('test', {
                        abc: 'def',
                    }),
                });

                expect(
                    await instStore.listLoadedPackages(recordName, inst)
                ).toEqual([
                    {
                        id: 'packageId',
                        recordName,
                        inst,
                        branch: DEFAULT_BRANCH_NAME,
                        packageId: 'public',
                        packageVersionId: 'public@1.0.0',
                        userId: userId,
                    },
                ]);
            });

            it('should load the package into a public inst', async () => {
                uuidv7Mock.mockReturnValueOnce('packageId');

                const result = await server.installPackage({
                    userId: userId,
                    userRole: 'none',
                    recordName: null,
                    inst,
                    package: {
                        recordName,
                        address: 'public',
                        key: version(1),
                    },
                });

                expect(result).toEqual({
                    success: true,
                    packageLoadId: 'packageId',
                    package: {
                        id: 'public@1.0.0',
                        packageId: 'public',
                        address: 'public',
                        key: version(1),
                        entitlements: [],
                        description: '',
                        markers: [PUBLIC_READ_MARKER],
                        createdAtMs: expect.any(Number),
                        sha256: expect.any(String),
                        auxSha256: expect.any(String),
                        auxFileName: expect.any(String),
                        createdFile: true,
                        requiresReview: false,
                        sizeInBytes: expect.any(Number),
                        approved: true,
                        approvalType: 'normal',
                    },
                });

                const updates = await instStore.getCurrentUpdates(
                    null,
                    inst,
                    DEFAULT_BRANCH_NAME
                );
                const state = getStateFromUpdates(
                    getInstStateFromUpdates(
                        updates.updates.map((u, index) => ({
                            id: index,
                            update: u,
                            timestamp: 123,
                        }))
                    )
                );

                expect(state).toEqual({
                    test: createBot('test', {
                        abc: 'def',
                    }),
                });

                expect(await instStore.listLoadedPackages(null, inst)).toEqual([
                    {
                        id: 'packageId',
                        recordName: null,
                        inst,
                        branch: DEFAULT_BRANCH_NAME,
                        packageId: 'public',
                        packageVersionId: 'public@1.0.0',
                        userId: userId,
                    },
                ]);
            });

            it('should allow anonymous users to install packages into public insts', async () => {
                uuidv7Mock.mockReturnValueOnce('packageId');

                const result = await server.installPackage({
                    userId: null,
                    userRole: null,
                    recordName: null,
                    inst,
                    package: {
                        recordName,
                        address: 'public',
                        key: version(1),
                    },
                });

                expect(result).toEqual({
                    success: true,
                    packageLoadId: 'packageId',
                    package: {
                        id: 'public@1.0.0',
                        packageId: 'public',
                        address: 'public',
                        key: version(1),
                        entitlements: [],
                        description: '',
                        markers: [PUBLIC_READ_MARKER],
                        createdAtMs: expect.any(Number),
                        sha256: expect.any(String),
                        auxSha256: expect.any(String),
                        auxFileName: expect.any(String),
                        createdFile: true,
                        requiresReview: false,
                        sizeInBytes: expect.any(Number),
                        approved: true,
                        approvalType: 'normal',
                    },
                });

                const updates = await instStore.getCurrentUpdates(
                    null,
                    inst,
                    DEFAULT_BRANCH_NAME
                );
                const state = getStateFromUpdates(
                    getInstStateFromUpdates(
                        updates.updates.map((u, index) => ({
                            id: index,
                            update: u,
                            timestamp: 123,
                        }))
                    )
                );

                expect(state).toEqual({
                    test: createBot('test', {
                        abc: 'def',
                    }),
                });

                expect(await instStore.listLoadedPackages(null, inst)).toEqual([
                    {
                        id: 'packageId',
                        recordName: null,
                        inst,
                        branch: DEFAULT_BRANCH_NAME,
                        packageId: 'public',
                        packageVersionId: 'public@1.0.0',
                        userId: null,
                    },
                ]);
            });

            it('should load the package into the specified branch of the inst', async () => {
                uuidv7Mock.mockReturnValueOnce('packageId');

                const result = await server.installPackage({
                    userId: userId,
                    userRole: 'none',
                    recordName,
                    inst,
                    branch: 'test',
                    package: {
                        recordName,
                        address: 'public',
                        key: version(1),
                    },
                });

                expect(result).toEqual({
                    success: true,
                    packageLoadId: 'packageId',
                    package: {
                        id: 'public@1.0.0',
                        packageId: 'public',
                        address: 'public',
                        key: version(1),
                        entitlements: [],
                        description: '',
                        markers: [PUBLIC_READ_MARKER],
                        createdAtMs: expect.any(Number),
                        sha256: expect.any(String),
                        auxSha256: expect.any(String),
                        auxFileName: expect.any(String),
                        createdFile: true,
                        requiresReview: false,
                        sizeInBytes: expect.any(Number),
                        approved: true,
                        approvalType: 'normal',
                    },
                });

                const updates = await instStore.getCurrentUpdates(
                    recordName,
                    inst,
                    'test'
                );
                const state = getStateFromUpdates(
                    getInstStateFromUpdates(
                        updates.updates.map((u, index) => ({
                            id: index,
                            update: u,
                            timestamp: 123,
                        }))
                    )
                );

                expect(state).toEqual({
                    test: createBot('test', {
                        abc: 'def',
                    }),
                });

                expect(
                    await instStore.listLoadedPackages(recordName, inst)
                ).toEqual([
                    {
                        id: 'packageId',
                        recordName,
                        inst,
                        branch: 'test',
                        packageId: 'public',
                        packageVersionId: 'public@1.0.0',
                        userId: userId,
                    },
                ]);
            });

            it('should do nothing if the exact package version is already loaded', async () => {
                uuidv7Mock.mockReturnValueOnce('packageId');

                const result = await server.installPackage({
                    userId,
                    userRole: 'none',
                    recordName,
                    inst,
                    package: {
                        recordName,
                        address: 'public',
                        key: version(1),
                    },
                });

                expect(result).toEqual({
                    success: true,
                    packageLoadId: 'packageId',
                    package: {
                        id: 'public@1.0.0',
                        packageId: 'public',
                        address: 'public',
                        key: version(1),
                        entitlements: [],
                        description: '',
                        markers: [PUBLIC_READ_MARKER],
                        createdAtMs: expect.any(Number),
                        sha256: expect.any(String),
                        auxSha256: expect.any(String),
                        auxFileName: expect.any(String),
                        createdFile: true,
                        requiresReview: false,
                        sizeInBytes: expect.any(Number),
                        approved: true,
                        approvalType: 'normal',
                    },
                });

                const addUpdatesResult = await server.addUserUpdates({
                    userId,
                    recordName,
                    inst,
                    branch: DEFAULT_BRANCH_NAME,
                    updates: ['abc'],
                });

                expect(addUpdatesResult).toEqual({
                    success: true,
                });

                const result2 = await server.installPackage({
                    userId,
                    userRole: 'none',
                    recordName,
                    inst,
                    package: {
                        recordName,
                        address: 'public',
                        key: version(1),
                    },
                });

                expect(result2).toEqual({
                    success: true,
                    packageLoadId: 'packageId',
                    package: {
                        id: 'public@1.0.0',
                        packageId: 'public',
                        address: 'public',
                        key: version(1),
                        entitlements: [],
                        description: '',
                        markers: [PUBLIC_READ_MARKER],
                        createdAtMs: expect.any(Number),
                        sha256: expect.any(String),
                        auxSha256: expect.any(String),
                        auxFileName: expect.any(String),
                        createdFile: true,
                        requiresReview: false,
                        sizeInBytes: expect.any(Number),
                        approved: true,
                        approvalType: 'normal',
                    },
                });

                const updates = await instStore.getCurrentUpdates(
                    recordName,
                    inst,
                    DEFAULT_BRANCH_NAME
                );
                expect(updates.updates).toEqual([expect.any(String), 'abc']);

                expect(
                    await instStore.listLoadedPackages(recordName, inst)
                ).toEqual([
                    {
                        id: 'packageId',
                        recordName,
                        inst,
                        branch: DEFAULT_BRANCH_NAME,
                        packageId: 'public',
                        packageVersionId: 'public@1.0.0',
                        userId: userId,
                    },
                ]);
            });

            it('should upgrade the package if a new version is installed', async () => {
                await recordPackage(
                    recordName,
                    'upgradable',
                    [PUBLIC_READ_MARKER],
                    version(1),
                    {
                        version: 2,
                        updates: [
                            constructInitializationUpdate(
                                createInitializationUpdate([
                                    createBot('test', {
                                        abc: 'def',
                                        num: 123,
                                    }),
                                    createBot('test2', {
                                        ghi: 'jfk',
                                        value: true,
                                    }),
                                ])
                            ),
                        ],
                    }
                );

                await recordPackage(
                    recordName,
                    'upgradable',
                    [PUBLIC_READ_MARKER],
                    version(2),
                    {
                        version: 2,
                        updates: [
                            constructInitializationUpdate(
                                createInitializationUpdate([
                                    createBot('test', {
                                        num: 123,
                                    }),
                                    createBot('test3', {
                                        ghi: 'jfk',
                                    }),
                                ])
                            ),
                        ],
                    }
                );

                uuidv7Mock.mockReturnValueOnce('packageId');

                const result = await server.installPackage({
                    userId,
                    userRole: 'none',
                    recordName,
                    inst,
                    package: {
                        recordName,
                        address: 'upgradable',
                        key: version(1),
                    },
                });

                expect(result).toEqual({
                    success: true,
                    packageLoadId: 'packageId',
                    package: {
                        id: 'upgradable@1.0.0',
                        packageId: 'upgradable',
                        address: 'upgradable',
                        key: version(1),
                        entitlements: [],
                        description: '',
                        markers: [PUBLIC_READ_MARKER],
                        createdAtMs: expect.any(Number),
                        sha256: expect.any(String),
                        auxSha256: expect.any(String),
                        auxFileName: expect.any(String),
                        createdFile: true,
                        requiresReview: false,
                        sizeInBytes: expect.any(Number),
                        approved: true,
                        approvalType: 'normal',
                    },
                });

                const result2 = await server.installPackage({
                    userId,
                    userRole: 'none',
                    recordName,
                    inst,
                    package: {
                        recordName,
                        address: 'upgradable',
                        key: version(2),
                    },
                });

                expect(result2).toEqual({
                    success: true,
                    packageLoadId: 'packageId',
                    package: {
                        id: 'upgradable@2.0.0',
                        packageId: 'upgradable',
                        address: 'upgradable',
                        key: version(2),
                        entitlements: [],
                        description: '',
                        markers: [PUBLIC_READ_MARKER],
                        createdAtMs: expect.any(Number),
                        sha256: expect.any(String),
                        auxSha256: expect.any(String),
                        auxFileName: expect.any(String),
                        createdFile: true,
                        requiresReview: false,
                        sizeInBytes: expect.any(Number),
                        approved: true,
                        approvalType: 'normal',
                    },
                });

                const updates = await instStore.getCurrentUpdates(
                    recordName,
                    inst,
                    DEFAULT_BRANCH_NAME
                );
                expect(updates.updates).toEqual([
                    expect.any(String),
                    expect.any(String),
                ]);

                expect(
                    await instStore.listLoadedPackages(recordName, inst)
                ).toEqual([
                    {
                        id: 'packageId',
                        recordName,
                        inst,
                        branch: DEFAULT_BRANCH_NAME,
                        packageId: 'upgradable',
                        packageVersionId: 'upgradable@2.0.0',
                        userId: userId,
                    },
                ]);

                const state = getStateFromUpdates(
                    getInstStateFromUpdates(
                        updates.updates.map((u, i) => ({
                            id: i,
                            timestamp: 0,
                            update: u,
                        }))
                    )
                );

                expect(state).toEqual({
                    test: createBot('test', {
                        num: 123,
                    }),
                    test3: createBot('test3', {
                        ghi: 'jfk',
                    }),
                });
            });

            it('should refuse to downgrade packages by default', async () => {
                await recordPackage(
                    recordName,
                    'upgradable',
                    [PUBLIC_READ_MARKER],
                    version(1),
                    {
                        version: 2,
                        updates: [
                            constructInitializationUpdate(
                                createInitializationUpdate([
                                    createBot('test', {
                                        abc: 'def',
                                        num: 123,
                                    }),
                                    createBot('test2', {
                                        ghi: 'jfk',
                                        value: true,
                                    }),
                                ])
                            ),
                        ],
                    }
                );

                await recordPackage(
                    recordName,
                    'upgradable',
                    [PUBLIC_READ_MARKER],
                    version(2),
                    {
                        version: 2,
                        updates: [
                            constructInitializationUpdate(
                                createInitializationUpdate([
                                    createBot('test', {
                                        num: 123,
                                    }),
                                    createBot('test3', {
                                        ghi: 'jfk',
                                    }),
                                ])
                            ),
                        ],
                    }
                );

                uuidv7Mock.mockReturnValueOnce('packageId');

                const result = await server.installPackage({
                    userId,
                    userRole: 'none',
                    recordName,
                    inst,
                    package: {
                        recordName,
                        address: 'upgradable',
                        key: version(2),
                    },
                });

                expect(result).toEqual({
                    success: true,
                    packageLoadId: 'packageId',
                    package: {
                        id: 'upgradable@2.0.0',
                        packageId: 'upgradable',
                        address: 'upgradable',
                        key: version(2),
                        entitlements: [],
                        description: '',
                        markers: [PUBLIC_READ_MARKER],
                        createdAtMs: expect.any(Number),
                        sha256: expect.any(String),
                        auxSha256: expect.any(String),
                        auxFileName: expect.any(String),
                        createdFile: true,
                        requiresReview: false,
                        sizeInBytes: expect.any(Number),
                        approved: true,
                        approvalType: 'normal',
                    },
                });

                const result2 = await server.installPackage({
                    userId,
                    userRole: 'none',
                    recordName,
                    inst,
                    package: {
                        recordName,
                        address: 'upgradable',
                        key: version(1),
                    },
                });

                expect(result2).toEqual({
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage:
                        'Cannot install version 1.0.0 because a newer version (2.0.0) of this package is already installed. If you want to downgrade the package, you must set the downgrade option to true.',
                });

                const updates = await instStore.getCurrentUpdates(
                    recordName,
                    inst,
                    DEFAULT_BRANCH_NAME
                );
                expect(updates.updates).toEqual([expect.any(String)]);

                expect(
                    await instStore.listLoadedPackages(recordName, inst)
                ).toEqual([
                    {
                        id: 'packageId',
                        recordName,
                        inst,
                        branch: DEFAULT_BRANCH_NAME,
                        packageId: 'upgradable',
                        packageVersionId: 'upgradable@2.0.0',
                        userId: userId,
                    },
                ]);

                const state = getStateFromUpdates(
                    getInstStateFromUpdates(
                        updates.updates.map((u, i) => ({
                            id: i,
                            timestamp: 0,
                            update: u,
                        }))
                    )
                );

                expect(state).toEqual({
                    test: createBot('test', {
                        num: 123,
                    }),
                    test3: createBot('test3', {
                        ghi: 'jfk',
                    }),
                });
            });

            it('should be able to downgrade if an old version is installed', async () => {
                await recordPackage(
                    recordName,
                    'upgradable',
                    [PUBLIC_READ_MARKER],
                    version(1),
                    {
                        version: 2,
                        updates: [
                            constructInitializationUpdate(
                                createInitializationUpdate([
                                    createBot('test', {
                                        abc: 'def',
                                        num: 123,
                                    }),
                                    createBot('test2', {
                                        ghi: 'jfk',
                                        value: true,
                                    }),
                                ])
                            ),
                        ],
                    }
                );

                await recordPackage(
                    recordName,
                    'upgradable',
                    [PUBLIC_READ_MARKER],
                    version(2),
                    {
                        version: 2,
                        updates: [
                            constructInitializationUpdate(
                                createInitializationUpdate([
                                    createBot('test', {
                                        num: 123,
                                    }),
                                    createBot('test3', {
                                        ghi: 'jfk',
                                    }),
                                ])
                            ),
                        ],
                    }
                );

                uuidv7Mock.mockReturnValueOnce('packageId');

                const result = await server.installPackage({
                    userId,
                    userRole: 'none',
                    recordName,
                    inst,
                    package: {
                        recordName,
                        address: 'upgradable',
                        key: version(2),
                    },
                });

                expect(result).toEqual({
                    success: true,
                    packageLoadId: 'packageId',
                    package: {
                        id: 'upgradable@2.0.0',
                        packageId: 'upgradable',
                        address: 'upgradable',
                        key: version(2),
                        entitlements: [],
                        description: '',
                        markers: [PUBLIC_READ_MARKER],
                        createdAtMs: expect.any(Number),
                        sha256: expect.any(String),
                        auxSha256: expect.any(String),
                        auxFileName: expect.any(String),
                        createdFile: true,
                        requiresReview: false,
                        sizeInBytes: expect.any(Number),
                        approved: true,
                        approvalType: 'normal',
                    },
                });

                const result2 = await server.installPackage({
                    userId,
                    userRole: 'none',
                    recordName,
                    inst,
                    package: {
                        recordName,
                        address: 'upgradable',
                        key: version(1),
                    },
                    downgrade: true,
                });

                expect(result2).toEqual({
                    success: true,
                    packageLoadId: 'packageId',
                    package: {
                        id: 'upgradable@1.0.0',
                        packageId: 'upgradable',
                        address: 'upgradable',
                        key: version(1),
                        entitlements: [],
                        description: '',
                        markers: [PUBLIC_READ_MARKER],
                        createdAtMs: expect.any(Number),
                        sha256: expect.any(String),
                        auxSha256: expect.any(String),
                        auxFileName: expect.any(String),
                        createdFile: true,
                        requiresReview: false,
                        sizeInBytes: expect.any(Number),
                        approved: true,
                        approvalType: 'normal',
                    },
                });

                const updates = await instStore.getCurrentUpdates(
                    recordName,
                    inst,
                    DEFAULT_BRANCH_NAME
                );
                expect(updates.updates).toEqual([
                    expect.any(String),
                    expect.any(String),
                ]);

                expect(
                    await instStore.listLoadedPackages(recordName, inst)
                ).toEqual([
                    {
                        id: 'packageId',
                        recordName,
                        inst,
                        branch: DEFAULT_BRANCH_NAME,
                        packageId: 'upgradable',
                        packageVersionId: 'upgradable@1.0.0',
                        userId: userId,
                    },
                ]);

                const state = getStateFromUpdates(
                    getInstStateFromUpdates(
                        updates.updates.map((u, i) => ({
                            id: i,
                            timestamp: 0,
                            update: u,
                        }))
                    )
                );

                expect(state).toEqual({
                    test: createBot('test', {
                        abc: 'def',
                        num: 123,
                    }),
                    test2: createBot('test2', {
                        ghi: 'jfk',
                        value: true,
                    }),
                });
            });

            it('should be able to load multiple packages', async () => {
                await recordPackage(
                    recordName,
                    'public2',
                    [PUBLIC_READ_MARKER],
                    version(1),
                    {
                        version: 1,
                        state: {
                            test2: createBot('test2', {
                                value: 123,
                            }),
                        },
                    }
                );

                uuidv7Mock
                    .mockReturnValueOnce('packageId')
                    .mockReturnValueOnce('packageId2');

                const result = await server.installPackage({
                    userId,
                    userRole: 'none',
                    recordName,
                    inst,
                    package: {
                        recordName,
                        address: 'public',
                        key: version(1),
                    },
                });

                const result2 = await server.installPackage({
                    userId,
                    userRole: 'none',
                    recordName,
                    inst,
                    package: {
                        recordName,
                        address: 'public2',
                        key: version(1),
                    },
                });

                expect(result).toEqual({
                    success: true,
                    packageLoadId: 'packageId',
                    package: {
                        id: 'public@1.0.0',
                        packageId: 'public',
                        address: 'public',
                        key: version(1),
                        entitlements: [],
                        description: '',
                        markers: [PUBLIC_READ_MARKER],
                        createdAtMs: expect.any(Number),
                        sha256: expect.any(String),
                        auxSha256: expect.any(String),
                        auxFileName: expect.any(String),
                        createdFile: true,
                        requiresReview: false,
                        sizeInBytes: expect.any(Number),
                        approved: true,
                        approvalType: 'normal',
                    },
                });

                expect(result2).toEqual({
                    success: true,
                    packageLoadId: 'packageId2',
                    package: {
                        id: 'public2@1.0.0',
                        packageId: 'public2',
                        address: 'public2',
                        key: version(1),
                        entitlements: [],
                        description: '',
                        markers: [PUBLIC_READ_MARKER],
                        createdAtMs: expect.any(Number),
                        sha256: expect.any(String),
                        auxSha256: expect.any(String),
                        auxFileName: expect.any(String),
                        createdFile: true,
                        requiresReview: false,
                        sizeInBytes: expect.any(Number),
                        approved: true,
                        approvalType: 'normal',
                    },
                });

                const updates = await instStore.getCurrentUpdates(
                    recordName,
                    inst,
                    DEFAULT_BRANCH_NAME
                );
                const state = getStateFromUpdates(
                    getInstStateFromUpdates(
                        updates.updates.map((u, index) => ({
                            id: index,
                            update: u,
                            timestamp: 123,
                        }))
                    )
                );

                expect(state).toEqual({
                    test: createBot('test', {
                        abc: 'def',
                    }),
                    test2: createBot('test2', {
                        value: 123,
                    }),
                });

                expect(
                    await instStore.listLoadedPackages(recordName, inst)
                ).toEqual([
                    {
                        id: 'packageId',
                        recordName,
                        inst,
                        branch: DEFAULT_BRANCH_NAME,
                        packageId: 'public',
                        packageVersionId: 'public@1.0.0',
                        userId: userId,
                    },
                    {
                        id: 'packageId2',
                        recordName,
                        inst,
                        branch: DEFAULT_BRANCH_NAME,
                        packageId: 'public2',
                        packageVersionId: 'public2@1.0.0',
                        userId: userId,
                    },
                ]);
            });

            it('should support version 2 states', async () => {
                const updates = [
                    constructInitializationUpdate(
                        createInitializationUpdate([
                            createBot('test', {
                                abc: 'test123',
                            }),
                        ])
                    ),
                ];
                await recordPackage(
                    recordName,
                    'public2',
                    [PUBLIC_READ_MARKER],
                    version(1),
                    {
                        version: 2,
                        updates,
                    }
                );

                uuidv7Mock.mockReturnValueOnce('packageId');

                const result = await server.installPackage({
                    userId,
                    recordName,
                    inst,
                    package: {
                        recordName,
                        address: 'public2',
                        key: version(1),
                    },
                });

                expect(result).toEqual({
                    success: true,
                    packageLoadId: 'packageId',
                    package: {
                        id: 'public2@1.0.0',
                        packageId: 'public2',
                        address: 'public2',
                        key: version(1),
                        entitlements: [],
                        description: '',
                        markers: [PUBLIC_READ_MARKER],
                        createdAtMs: expect.any(Number),
                        sha256: expect.any(String),
                        auxSha256: expect.any(String),
                        auxFileName: expect.any(String),
                        createdFile: true,
                        requiresReview: false,
                        sizeInBytes: expect.any(Number),
                        approved: true,
                        approvalType: 'normal',
                    },
                });

                const instUpdates = await instStore.getCurrentUpdates(
                    recordName,
                    inst,
                    DEFAULT_BRANCH_NAME
                );
                const state = getStateFromUpdates(
                    getInstStateFromUpdates(
                        instUpdates.updates.map((u, index) => ({
                            id: index,
                            update: u,
                            timestamp: 123,
                        }))
                    )
                );

                expect(state).toEqual({
                    test: createBot('test', {
                        abc: 'test123',
                    }),
                });

                expect(instUpdates.updates).toEqual(
                    updates.map((u) => u.update)
                );

                expect(
                    await instStore.listLoadedPackages(recordName, inst)
                ).toEqual([
                    {
                        id: 'packageId',
                        recordName,
                        inst,
                        branch: DEFAULT_BRANCH_NAME,
                        packageId: 'public2',
                        packageVersionId: 'public2@1.0.0',
                        userId: userId,
                    },
                ]);
            });

            it('should load the package as the current user', async () => {
                await recordPackage(
                    recordName,
                    'private',
                    [PRIVATE_MARKER],
                    version(1),
                    {
                        version: 1,
                        state: {
                            test: createBot('test', {
                                abc: 'def',
                            }),
                        },
                    }
                );

                store.roles[recordName] = {
                    [formatInstId(recordName, inst)]: new Set([
                        ADMIN_ROLE_NAME,
                    ]),
                };

                uuidv7Mock.mockReturnValueOnce('packageId');

                const result = await server.installPackage({
                    userId,
                    recordName,
                    inst,
                    package: {
                        recordName,
                        address: 'private',
                        key: version(1),
                    },
                });

                expect(result).toEqual({
                    success: true,
                    packageLoadId: 'packageId',
                    package: {
                        id: 'private@1.0.0',
                        packageId: 'private',
                        address: 'private',
                        key: version(1),
                        entitlements: [],
                        description: '',
                        markers: [PRIVATE_MARKER],
                        createdAtMs: expect.any(Number),
                        sha256: expect.any(String),
                        auxSha256: expect.any(String),
                        auxFileName: expect.any(String),
                        createdFile: true,
                        requiresReview: false,
                        sizeInBytes: expect.any(Number),
                        approved: true,
                        approvalType: 'normal',
                    },
                });

                const instUpdates = await instStore.getCurrentUpdates(
                    recordName,
                    inst,
                    DEFAULT_BRANCH_NAME
                );
                const state = getStateFromUpdates(
                    getInstStateFromUpdates(
                        instUpdates.updates.map((u, index) => ({
                            id: index,
                            update: u,
                            timestamp: 123,
                        }))
                    )
                );

                expect(state).toEqual({
                    test: createBot('test', {
                        abc: 'def',
                    }),
                });

                expect(
                    await instStore.listLoadedPackages(recordName, inst)
                ).toEqual([
                    {
                        id: 'packageId',
                        recordName,
                        inst,
                        branch: DEFAULT_BRANCH_NAME,
                        packageId: 'private',
                        packageVersionId: 'private@1.0.0',
                        userId: userId,
                    },
                ]);
            });

            it('should return not_authorized if the user is not authorized to read the package', async () => {
                await recordPackage(
                    recordName,
                    'private',
                    [PRIVATE_MARKER],
                    version(1),
                    {
                        version: 1,
                        state: {
                            test: createBot('test', {
                                abc: 'def',
                            }),
                        },
                    }
                );

                const result = await server.installPackage({
                    userId: device1Info.userId,
                    recordName,
                    inst,
                    package: {
                        recordName,
                        address: 'private',
                        key: version(1),
                    },
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'package.version',
                        resourceId: 'private',
                        subjectType: 'user',
                        subjectId: device1Info.userId,
                        action: 'read',
                    },
                });

                const instUpdates = await instStore.getCurrentUpdates(
                    recordName,
                    inst,
                    DEFAULT_BRANCH_NAME
                );
                expect(instUpdates?.updates ?? []).toEqual([]);

                expect(
                    await instStore.listLoadedPackages(recordName, inst)
                ).toEqual([]);
            });

            it('should return not_authorized if the inst is not authorized to read the package', async () => {
                await recordPackage(
                    device1Info.userId,
                    'private',
                    [PRIVATE_MARKER],
                    version(1),
                    {
                        version: 1,
                        state: {
                            test: createBot('test', {
                                abc: 'def',
                            }),
                        },
                    }
                );

                const result = await server.installPackage({
                    userId: device1Info.userId,
                    recordName,
                    inst,
                    package: {
                        recordName: device1Info.userId,
                        address: 'private',
                        key: version(1),
                    },
                    instances: [formatInstId(null, 'otherInst')],
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName: device1Info.userId,
                        resourceKind: 'package.version',
                        resourceId: 'private',
                        subjectType: 'inst',
                        subjectId: formatInstId(null, 'otherInst'),
                        action: 'read',
                    },
                });

                const instUpdates = await instStore.getCurrentUpdates(
                    recordName,
                    inst,
                    DEFAULT_BRANCH_NAME
                );
                expect(instUpdates?.updates ?? []).toEqual([]);

                expect(
                    await instStore.listLoadedPackages(recordName, inst)
                ).toEqual([]);
            });

            it('should return not_authorized if the target inst is not authorized to run the package', async () => {
                await recordPackage(
                    device1Info.userId,
                    'private',
                    [PRIVATE_MARKER],
                    version(1),
                    {
                        version: 1,
                        state: {
                            test: createBot('test', {
                                abc: 'def',
                            }),
                        },
                    }
                );

                store.roles[recordName] = {
                    [device1Info.userId]: new Set([ADMIN_ROLE_NAME]),
                };

                await store.assignPermissionToSubjectAndMarker(
                    device1Info.userId,
                    'inst',
                    formatInstId(null, 'otherInst'),
                    'package.version',
                    PRIVATE_MARKER,
                    'read',
                    {},
                    null
                );
                await store.assignPermissionToSubjectAndMarker(
                    recordName,
                    'inst',
                    formatInstId(null, 'otherInst'),
                    'package.version',
                    PRIVATE_MARKER,
                    'read',
                    {},
                    null
                );

                const result = await server.installPackage({
                    userId: device1Info.userId,
                    recordName,
                    inst,
                    package: {
                        recordName: device1Info.userId,
                        address: 'private',
                        key: version(1),
                    },
                    instances: [formatInstId(null, 'otherInst')],
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName: device1Info.userId,
                        resourceKind: 'package.version',
                        resourceId: 'private',
                        subjectType: 'inst',
                        subjectId: formatInstId(recordName, inst),
                        action: 'run',
                    },
                });

                const instUpdates = await instStore.getCurrentUpdates(
                    recordName,
                    inst,
                    DEFAULT_BRANCH_NAME
                );
                expect(instUpdates?.updates ?? []).toEqual([]);

                expect(
                    await instStore.listLoadedPackages(recordName, inst)
                ).toEqual([]);
            });

            it('should load the package if both the originating and target insts are allowed to access the package', async () => {
                await recordPackage(
                    device1Info.userId,
                    'private',
                    [PRIVATE_MARKER],
                    version(1),
                    {
                        version: 1,
                        state: {
                            test: createBot('test', {
                                abc: 'def',
                            }),
                        },
                    }
                );

                // /otherInst needs access to read the package from the device1Info.userId record
                await store.assignPermissionToSubjectAndMarker(
                    device1Info.userId,
                    'inst',
                    formatInstId(null, 'otherInst'),
                    'package.version',
                    PRIVATE_MARKER,
                    'read',
                    {},
                    null
                );

                // recordName/inst needs access to run the package from the device1Info.userId record
                await store.assignPermissionToSubjectAndMarker(
                    device1Info.userId,
                    'inst',
                    formatInstId(recordName, inst),
                    'package.version',
                    PRIVATE_MARKER,
                    'run',
                    {},
                    null
                );

                // The user needs the ability to create the inst in recordName
                store.roles[recordName] = {
                    [device1Info.userId]: new Set([ADMIN_ROLE_NAME]),
                };

                uuidv7Mock.mockReturnValueOnce('packageId');

                const result = await server.installPackage({
                    userId: device1Info.userId,
                    recordName,
                    inst,
                    package: {
                        recordName: device1Info.userId,
                        address: 'private',
                        key: version(1),
                    },
                    instances: [formatInstId(null, 'otherInst')],
                });

                expect(result).toEqual({
                    success: true,
                    packageLoadId: 'packageId',
                    package: {
                        id: 'private@1.0.0',
                        packageId: 'private',
                        address: 'private',
                        key: version(1),
                        entitlements: [],
                        description: '',
                        markers: [PRIVATE_MARKER],
                        createdAtMs: expect.any(Number),
                        sha256: expect.any(String),
                        auxSha256: expect.any(String),
                        auxFileName: expect.any(String),
                        createdFile: true,
                        requiresReview: false,
                        sizeInBytes: expect.any(Number),
                        approved: true,
                        approvalType: 'normal',
                    },
                });

                const instUpdates = await instStore.getCurrentUpdates(
                    recordName,
                    inst,
                    DEFAULT_BRANCH_NAME
                );
                const state = getStateFromUpdates(
                    getInstStateFromUpdates(
                        instUpdates.updates.map((u, index) => ({
                            id: index,
                            update: u,
                            timestamp: 123,
                        }))
                    )
                );

                expect(state).toEqual({
                    test: createBot('test', {
                        abc: 'def',
                    }),
                });

                expect(
                    await instStore.listLoadedPackages(recordName, inst)
                ).toEqual([
                    {
                        id: 'packageId',
                        recordName,
                        inst,
                        branch: DEFAULT_BRANCH_NAME,
                        packageId: 'private',
                        packageVersionId: 'private@1.0.0',
                        userId: device1Info.userId,
                    },
                ]);
            });

            it('should be able to install the latest version of a package', async () => {
                await recordPackage(
                    recordName,
                    'public',
                    [PUBLIC_READ_MARKER],
                    version(2),
                    {
                        version: 1,
                        state: {
                            test: createBot('test', {
                                abc: 'ghi',
                            }),
                        },
                    }
                );
                uuidv7Mock.mockReturnValueOnce('packageId');

                const result = await server.installPackage({
                    userId: userId,
                    userRole: 'none',
                    recordName,
                    inst,
                    package: {
                        recordName,
                        address: 'public',
                    },
                });

                expect(result).toEqual({
                    success: true,
                    packageLoadId: 'packageId',
                    package: {
                        id: 'public@2.0.0',
                        packageId: 'public',
                        address: 'public',
                        key: version(2),
                        entitlements: [],
                        description: '',
                        markers: [PUBLIC_READ_MARKER],
                        createdAtMs: expect.any(Number),
                        sha256: expect.any(String),
                        auxSha256: expect.any(String),
                        auxFileName: expect.any(String),
                        createdFile: true,
                        requiresReview: false,
                        sizeInBytes: expect.any(Number),
                        approved: true,
                        approvalType: 'normal',
                    },
                });

                const updates = await instStore.getCurrentUpdates(
                    recordName,
                    inst,
                    DEFAULT_BRANCH_NAME
                );
                const state = getStateFromUpdates(
                    getInstStateFromUpdates(
                        updates.updates.map((u, index) => ({
                            id: index,
                            update: u,
                            timestamp: 123,
                        }))
                    )
                );

                expect(state).toEqual({
                    test: createBot('test', {
                        abc: 'ghi',
                    }),
                });

                expect(
                    await instStore.listLoadedPackages(recordName, inst)
                ).toEqual([
                    {
                        id: 'packageId',
                        recordName,
                        inst,
                        branch: DEFAULT_BRANCH_NAME,
                        packageId: 'public',
                        packageVersionId: 'public@2.0.0',
                        userId: userId,
                    },
                ]);
            });

            it('should be able to install a package based on the sha256', async () => {
                await recordPackage(
                    recordName,
                    'public',
                    [PUBLIC_READ_MARKER],
                    version(2),
                    {
                        version: 1,
                        state: {
                            test: createBot('test', {
                                abc: 'ghi',
                            }),
                        },
                    }
                );

                const info = await services.packageVersionStore.getItemByKey(
                    recordName,
                    'public',
                    version(2)
                );
                uuidv7Mock.mockReturnValueOnce('packageId');

                const result = await server.installPackage({
                    userId: userId,
                    userRole: 'none',
                    recordName,
                    inst,
                    package: {
                        recordName,
                        address: 'public',
                        key: {
                            sha256: info.item?.sha256,
                        },
                    },
                });

                expect(result).toEqual({
                    success: true,
                    packageLoadId: 'packageId',
                    package: {
                        id: 'public@2.0.0',
                        packageId: 'public',
                        address: 'public',
                        key: version(2),
                        entitlements: [],
                        description: '',
                        markers: [PUBLIC_READ_MARKER],
                        createdAtMs: expect.any(Number),
                        sha256: expect.any(String),
                        auxSha256: expect.any(String),
                        auxFileName: expect.any(String),
                        createdFile: true,
                        requiresReview: false,
                        sizeInBytes: expect.any(Number),
                        approved: true,
                        approvalType: 'normal',
                    },
                });

                const updates = await instStore.getCurrentUpdates(
                    recordName,
                    inst,
                    DEFAULT_BRANCH_NAME
                );
                const state = getStateFromUpdates(
                    getInstStateFromUpdates(
                        updates.updates.map((u, index) => ({
                            id: index,
                            update: u,
                            timestamp: 123,
                        }))
                    )
                );

                expect(state).toEqual({
                    test: createBot('test', {
                        abc: 'ghi',
                    }),
                });

                expect(
                    await instStore.listLoadedPackages(recordName, inst)
                ).toEqual([
                    {
                        id: 'packageId',
                        recordName,
                        inst,
                        branch: DEFAULT_BRANCH_NAME,
                        packageId: 'public',
                        packageVersionId: 'public@2.0.0',
                        userId: userId,
                    },
                ]);
            });
        });

        describe('listInstalledPackages()', () => {
            beforeEach(async () => {
                const r = await services.recordsStore.getRecordByName(
                    recordName
                );
                if (!r) {
                    await services.records.createRecord({
                        recordName,
                        userId,
                        ownerId: userId,
                    });
                }

                await store.saveInst({
                    recordName,
                    inst,
                    markers: [PRIVATE_MARKER],
                });

                await instStore.saveLoadedPackage({
                    id: 'loadedPackageId',
                    recordName,
                    inst,
                    branch: DEFAULT_BRANCH_NAME,
                    packageId: 'public',
                    packageVersionId: 'public@1.0.0',
                    userId: userId,
                });

                await instStore.saveLoadedPackage({
                    id: 'loadedPackageId2',
                    recordName,
                    inst,
                    branch: DEFAULT_BRANCH_NAME,
                    packageId: 'private',
                    packageVersionId: 'private@1.0.0',
                    userId: userId,
                });

                await instStore.saveLoadedPackage({
                    id: 'loadedPackageId3',
                    recordName: null,
                    inst,
                    branch: DEFAULT_BRANCH_NAME,
                    packageId: 'public',
                    packageVersionId: 'public@1.0.0',
                    userId: userId,
                });

                await instStore.saveLoadedPackage({
                    id: 'loadedPackageId4',
                    recordName: null,
                    inst,
                    branch: DEFAULT_BRANCH_NAME,
                    packageId: 'private',
                    packageVersionId: 'private@1.0.0',
                    userId: userId,
                });
            });

            it('should return the list of loaded packages for the private inst', async () => {
                const result = await server.listInstalledPackages({
                    userId,
                    recordName,
                    inst,
                });

                expect(result).toEqual({
                    success: true,
                    packages: [
                        {
                            id: 'loadedPackageId',
                            recordName,
                            inst,
                            branch: DEFAULT_BRANCH_NAME,
                            packageId: 'public',
                            packageVersionId: 'public@1.0.0',
                            userId: userId,
                        },
                        {
                            id: 'loadedPackageId2',
                            recordName,
                            inst,
                            branch: DEFAULT_BRANCH_NAME,
                            packageId: 'private',
                            packageVersionId: 'private@1.0.0',
                            userId: userId,
                        },
                    ],
                });
            });

            it('should return an empty list if there are no packages installed in the inst', async () => {
                await instStore.saveInst({
                    recordName,
                    inst: 'otherInst',
                    markers: [PRIVATE_MARKER],
                });

                const result = await server.listInstalledPackages({
                    userId,
                    recordName,
                    inst: 'otherInst',
                });

                expect(result).toEqual({
                    success: true,
                    packages: [],
                });
            });

            it('should return the list of loaded packages for the public inst', async () => {
                const result = await server.listInstalledPackages({
                    userId,
                    recordName: null,
                    inst,
                });

                expect(result).toEqual({
                    success: true,
                    packages: [
                        {
                            id: 'loadedPackageId3',
                            recordName: null,
                            inst,
                            branch: DEFAULT_BRANCH_NAME,
                            packageId: 'public',
                            packageVersionId: 'public@1.0.0',
                            userId: userId,
                        },
                        {
                            id: 'loadedPackageId4',
                            recordName: null,
                            inst,
                            branch: DEFAULT_BRANCH_NAME,
                            packageId: 'private',
                            packageVersionId: 'private@1.0.0',
                            userId: userId,
                        },
                    ],
                });
            });

            it('should return not_logged_in if the inst is non-public and the user isnt logged in', async () => {
                const result = await server.listInstalledPackages({
                    userId: null,
                    recordName,
                    inst,
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in. Please provide a sessionKey or a recordKey.',
                });
            });

            it('should return not_authorized if the user doesnt have access to the inst', async () => {
                await store.saveUser({
                    id: 'otherUserId',
                    email: 'other@example.com',
                    phoneNumber: null,
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                });

                const result = await server.listInstalledPackages({
                    userId: 'otherUserId',
                    recordName,
                    inst,
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'inst',
                        resourceId: inst,
                        subjectType: 'user',
                        subjectId: 'otherUserId',
                        action: 'read',
                    },
                });
            });

            it('should return not_authorized if the current inst doesnt have access to the inst', async () => {
                const result = await server.listInstalledPackages({
                    userId,
                    recordName,
                    inst,
                    instances: [formatInstId(null, 'otherInst')],
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'inst',
                        resourceId: inst,
                        subjectType: 'inst',
                        subjectId: formatInstId(null, 'otherInst'),
                        action: 'read',
                    },
                });
            });

            it('should return inst_not_found if the inst does not exist', async () => {
                const result = await server.listInstalledPackages({
                    userId,
                    recordName,
                    inst: 'missing',
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'inst_not_found',
                    errorMessage: 'The inst was not found.',
                });
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

        describe('permission/request/missing', () => {
            beforeEach(async () => {
                await services.records.createRecord({
                    userId,
                    recordName,
                    ownerId: userId,
                });

                await server.login(serverConnectionId, 1, {
                    type: 'login',
                    connectionToken,
                });

                await store.saveUser({
                    id: device1Info.userId,
                    name: 'test user',
                    email: 'device1@example.com',
                    phoneNumber: null,
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                });
            });

            it('should relay the request to all users that are watching the default branch on the inst', async () => {
                await connectionStore.saveConnection(device1Info);

                await server.watchBranch(serverConnectionId, {
                    type: 'repo/watch_branch',
                    recordName,
                    inst,
                    branch: DEFAULT_BRANCH_NAME,
                });

                await server.requestMissingPermission(
                    device1Info.serverConnectionId,
                    {
                        type: 'permission/request/missing',
                        reason: {
                            type: 'missing_permission',
                            recordName,
                            resourceKind: 'inst',
                            resourceId: inst,
                            action: 'read',
                            subjectType: 'user',
                            subjectId: device1Info.userId,
                        },
                    }
                );

                expect(
                    messenger.getMessages(serverConnectionId).slice(3)
                ).toEqual([
                    {
                        type: 'permission/request/missing',
                        reason: {
                            type: 'missing_permission',
                            recordName,
                            resourceKind: 'inst',
                            resourceId: inst,
                            action: 'read',
                            subjectType: 'user',
                            subjectId: device1Info.userId,
                        },
                        connection: connectionInfo(device1Info),
                        user: {
                            userId: device1Info.userId,
                            name: 'test user',
                            displayName: null,
                            email: 'device1@example.com',
                        },
                    },
                ]);

                const connection = await connectionStore.getBranchConnection(
                    device1Info.serverConnectionId,
                    'missing_permission',
                    recordName,
                    `${'inst'}/${inst}`,
                    `${'user'}/${device1Info.userId}`
                );
                expect(connection).toEqual({
                    mode: 'missing_permission',
                    ...device1Info,
                    recordName,
                    inst: `${'inst'}/${inst}`,
                    branch: `${'user'}/${device1Info.userId}`,
                    temporary: true,
                });
            });

            it('should return a unsucessful result if the request is for the wrong user', async () => {
                await connectionStore.saveConnection(device1Info);

                await server.watchBranch(serverConnectionId, {
                    type: 'repo/watch_branch',
                    recordName,
                    inst,
                    branch: DEFAULT_BRANCH_NAME,
                });

                await server.requestMissingPermission(
                    device1Info.serverConnectionId,
                    {
                        type: 'permission/request/missing',
                        reason: {
                            type: 'missing_permission',
                            recordName,
                            resourceKind: 'inst',
                            resourceId: inst,
                            action: 'read',
                            subjectType: 'user',
                            subjectId: 'wrongUserId',
                        },
                    }
                );

                expect(
                    messenger.getMessages(device1Info.serverConnectionId)
                ).toEqual([
                    {
                        type: 'permission/request/missing/response',
                        success: false,
                        errorCode: 'unacceptable_request',
                        errorMessage:
                            'Permissions can only be requested for the current user.',
                        recordName,
                        resourceKind: 'inst',
                        resourceId: inst,
                        subjectType: 'user',
                        subjectId: 'wrongUserId',
                    },
                ]);
                expect(
                    messenger.getMessages(serverConnectionId).slice(3)
                ).toEqual([]);
            });

            it('should return a unsucessful result if the request is for the wrong resource kind', async () => {
                await connectionStore.saveConnection(device1Info);

                await server.watchBranch(serverConnectionId, {
                    type: 'repo/watch_branch',
                    recordName,
                    inst,
                    branch: DEFAULT_BRANCH_NAME,
                });

                await server.requestMissingPermission(
                    device1Info.serverConnectionId,
                    {
                        type: 'permission/request/missing',
                        reason: {
                            type: 'missing_permission',
                            recordName,
                            resourceKind: 'data',
                            resourceId: inst,
                            action: 'read',
                            subjectType: 'user',
                            subjectId: device1Info.userId,
                        },
                    }
                );

                expect(
                    messenger.getMessages(device1Info.serverConnectionId)
                ).toEqual([
                    {
                        type: 'permission/request/missing/response',
                        success: false,
                        errorCode: 'unacceptable_request',
                        errorMessage:
                            'Permissions can only be requested to access insts.',
                        recordName,
                        resourceKind: 'data',
                        resourceId: inst,
                        subjectType: 'user',
                        subjectId: device1Info.userId,
                    },
                ]);
                expect(
                    messenger.getMessages(serverConnectionId).slice(3)
                ).toEqual([]);
            });

            it('should return a unsucessful result if there are no users that can grant access to the inst', async () => {
                await connectionStore.saveConnection(device1Info);

                await server.requestMissingPermission(
                    device1Info.serverConnectionId,
                    {
                        type: 'permission/request/missing',
                        reason: {
                            type: 'missing_permission',
                            recordName,
                            resourceKind: 'inst',
                            resourceId: inst,
                            action: 'read',
                            subjectType: 'user',
                            subjectId: device1Info.userId,
                        },
                    }
                );

                expect(
                    messenger.getMessages(device1Info.serverConnectionId)
                ).toEqual([
                    {
                        type: 'permission/request/missing/response',
                        success: false,
                        errorCode: 'unacceptable_request',
                        errorMessage:
                            'There are no currently no users available that can grant access to the inst.',
                        recordName,
                        resourceKind: 'inst',
                        resourceId: inst,
                        subjectType: 'user',
                        subjectId: device1Info.userId,
                    },
                ]);
                expect(
                    messenger.getMessages(serverConnectionId).slice(3)
                ).toEqual([]);
            });

            it('should return a invalid_connection_state error if the connection cannot be found in Redis', async () => {
                await server.requestMissingPermission(
                    device1Info.serverConnectionId,
                    {
                        type: 'permission/request/missing',
                        reason: {
                            type: 'missing_permission',
                            recordName,
                            resourceKind: 'inst',
                            resourceId: inst,
                            action: 'read',
                            subjectType: 'user',
                            subjectId: device1Info.userId,
                        },
                    }
                );
                expect(
                    messenger.getEvents(device1Info.serverConnectionId)
                ).toEqual([
                    [
                        WebsocketEventTypes.Error,
                        -1,
                        {
                            success: false,
                            errorCode: 'invalid_connection_state',
                            errorMessage: `A server error occurred. (connectionId: ${device1Info.serverConnectionId})`,
                        },
                    ],
                ]);
                expect(
                    messenger.isDisconnected(device1Info.serverConnectionId)
                ).toBe(true);
            });
        });

        describe('permission/request/missing/response', () => {
            beforeEach(async () => {
                await services.records.createRecord({
                    userId,
                    recordName,
                    ownerId: userId,
                });

                await server.login(serverConnectionId, 1, {
                    type: 'login',
                    connectionToken,
                });
            });

            it('should relay the request back to the connection that originally requested it', async () => {
                await connectionStore.saveConnection(device1Info);

                await connectionStore.saveBranchConnection({
                    ...device1Info,
                    mode: 'missing_permission',
                    recordName,
                    inst: `${'inst'}/${inst}`,
                    branch: `${'user'}/${device1Info.userId}`,
                    temporary: false,
                });

                await server.respondToPermissionRequest(serverConnectionId, {
                    type: 'permission/request/missing/response',
                    success: true,
                    recordName: recordName,
                    resourceKind: 'inst',
                    resourceId: inst,
                    subjectType: 'user',
                    subjectId: device1Info.userId,
                } as RequestMissingPermissionResponseSuccessMessage);

                expect(
                    messenger.getMessages(device1Info.serverConnectionId)
                ).toEqual([
                    {
                        type: 'permission/request/missing/response',
                        success: true,
                        recordName: recordName,
                        resourceKind: 'inst',
                        resourceId: inst,
                        subjectType: 'user',
                        subjectId: device1Info.userId,
                        connection: connectionInfo(user1Info),
                    },
                ]);

                const connection = await connectionStore.getBranchConnection(
                    device1Info.serverConnectionId,
                    'missing_permission',
                    recordName,
                    `${'inst'}/${inst}`,
                    `${'user'}/${device1Info.userId}`
                );
                expect(connection).toBeUndefined();
            });

            it('should return a invalid_connection_state error if the connection cannot be found in Redis', async () => {
                await server.respondToPermissionRequest(
                    device1Info.serverConnectionId,
                    {
                        type: 'permission/request/missing/response',
                        success: true,
                        recordName: recordName,
                        resourceKind: 'inst',
                        resourceId: inst,
                        subjectType: 'user',
                        subjectId: device1Info.userId,
                    } as RequestMissingPermissionResponseSuccessMessage
                );

                expect(
                    messenger.getEvents(device1Info.serverConnectionId)
                ).toEqual([
                    [
                        WebsocketEventTypes.Error,
                        -1,
                        {
                            success: false,
                            errorCode: 'invalid_connection_state',
                            errorMessage: `A server error occurred. (connectionId: ${device1Info.serverConnectionId})`,
                        },
                    ],
                ]);
                expect(
                    messenger.isDisconnected(device1Info.serverConnectionId)
                ).toBe(true);
            });
        });

        describe('getBranchData()', () => {
            describe('no record', () => {
                it('should return an empty AUX if there is no branch updates', async () => {
                    const data = await server.getBranchData(
                        null,
                        null,
                        inst,
                        'testBranch'
                    );

                    expect(data).toEqual({
                        success: true,
                        data: {
                            version: 1,
                            state: {},
                        },
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

                    const data = await server.getBranchData(
                        null,
                        null,
                        inst,
                        'testBranch'
                    );

                    expect(data).toEqual({
                        success: true,
                        data: {
                            version: 1,
                            state: {
                                test1: createBot('test1', {
                                    abc: 'def',
                                    ghi: 123,
                                }),
                            },
                        },
                    });
                });

                it('should return the updates for the given branch if version 2 is requested', async () => {
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

                    const data = await server.getBranchData(
                        null,
                        null,
                        inst,
                        'testBranch',
                        2
                    );

                    expect(data).toEqual({
                        success: true,
                        data: {
                            version: 2,
                            updates: [
                                {
                                    id: 0,
                                    update: updateBase64,
                                    timestamp: expect.any(Number),
                                },
                            ],
                        },
                    });
                });
            });

            describe('records', () => {
                beforeEach(async () => {
                    await services.records.createRecord({
                        userId,
                        recordName,
                        ownerId: userId,
                    });
                });

                it('should return inst_not_found if the inst does not exist', async () => {
                    const data = await server.getBranchData(
                        'wrongUserId',
                        recordName,
                        inst,
                        'testBranch'
                    );

                    expect(data).toEqual({
                        success: false,
                        errorCode: 'inst_not_found',
                        errorMessage: 'The inst was not found.',
                    });
                });

                it('should return not_authorized if the user is not authorized to read the inst', async () => {
                    await instStore.saveInst({
                        recordName,
                        inst,
                        markers: [PRIVATE_MARKER],
                    });

                    const data = await server.getBranchData(
                        'wrongUserId',
                        recordName,
                        inst,
                        'testBranch'
                    );

                    expect(data).toEqual({
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'You are not authorized to perform this action.',
                        reason: {
                            type: 'missing_permission',
                            recordName,
                            resourceKind: 'inst',
                            resourceId: inst,
                            subjectType: 'user',
                            subjectId: 'wrongUserId',
                            action: 'read',
                        },
                    });
                });

                it('should return not_logged_in if the user does not give an ID', async () => {
                    await instStore.saveInst({
                        recordName,
                        inst,
                        markers: [PRIVATE_MARKER],
                    });

                    const data = await server.getBranchData(
                        null,
                        recordName,
                        inst,
                        'testBranch'
                    );

                    expect(data).toEqual({
                        success: false,
                        errorCode: 'not_logged_in',
                        errorMessage:
                            'The user must be logged in. Please provide a sessionKey or a recordKey.',
                    });
                });

                it('should return the data if the user is the owner', async () => {
                    await instStore.saveInst({
                        recordName,
                        inst,
                        markers: [PRIVATE_MARKER],
                    });

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
                        recordName,
                        inst,
                        'testBranch',
                        [updateBase64],
                        updateBase64.length
                    );

                    const data = await server.getBranchData(
                        userId,
                        recordName,
                        inst,
                        'testBranch'
                    );

                    expect(data).toEqual({
                        success: true,
                        data: {
                            version: 1,
                            state: {
                                test1: createBot('test1', {
                                    abc: 'def',
                                    ghi: 123,
                                }),
                            },
                        },
                    });
                });

                it('should return the updates if aux version 2 is requested', async () => {
                    await instStore.saveInst({
                        recordName,
                        inst,
                        markers: [PRIVATE_MARKER],
                    });

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
                        recordName,
                        inst,
                        'testBranch',
                        [updateBase64],
                        updateBase64.length
                    );

                    const data = await server.getBranchData(
                        userId,
                        recordName,
                        inst,
                        'testBranch',
                        2
                    );

                    expect(data).toEqual({
                        success: true,
                        data: {
                            version: 2,
                            updates: [
                                {
                                    id: 0,
                                    update: updateBase64,
                                    timestamp: expect.any(Number),
                                },
                            ],
                        },
                    });
                });

                it('should return the data if the user has the inst.read permission', async () => {
                    await instStore.saveInst({
                        recordName,
                        inst,
                        markers: [PRIVATE_MARKER],
                    });

                    await services.policyStore.assignPermissionToSubjectAndMarker(
                        recordName,
                        'role',
                        'developer',
                        'inst',
                        PRIVATE_MARKER,
                        'read',
                        {},
                        null
                    );

                    services.policyStore.roles[recordName] = {
                        ['guestUserId']: new Set(['developer']),
                    };

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
                        recordName,
                        inst,
                        'testBranch',
                        [updateBase64],
                        updateBase64.length
                    );

                    const data = await server.getBranchData(
                        'guestUserId',
                        recordName,
                        inst,
                        'testBranch'
                    );

                    expect(data).toEqual({
                        success: true,
                        data: {
                            version: 1,
                            state: {
                                test1: createBot('test1', {
                                    abc: 'def',
                                    ghi: 123,
                                }),
                            },
                        },
                    });
                });

                it('should return a not_authorized error if insts are not allowed', async () => {
                    await instStore.saveInst({
                        recordName,
                        inst,
                        markers: [PRIVATE_MARKER],
                    });

                    store.subscriptionConfiguration = buildSubscriptionConfig(
                        (config) =>
                            config.addSubscription('sub1', (sub) =>
                                sub
                                    .withTier('tier1')
                                    .withAllDefaultFeatures()
                                    .withInsts({
                                        allowed: false,
                                    })
                            )
                    );

                    await store.saveUser({
                        id: userId,
                        allSessionRevokeTimeMs: null,
                        currentLoginRequestId: null,
                        email: 'test@example.com',
                        phoneNumber: null,
                        subscriptionId: 'sub1',
                        subscriptionStatus: 'active',
                    });

                    const result = await server.getBranchData(
                        userId,
                        recordName,
                        inst,
                        'test'
                    );

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'Insts are not allowed for this subscription.',
                    });
                });
            });
        });

        describe('listInsts()', () => {
            it('should return an empty list when given a null record name', async () => {
                const result = await server.listInsts(null, userId, null);

                expect(result).toEqual({
                    success: true,
                    insts: [],
                    totalCount: 0,
                });
            });

            it('should return an record_not_found result if the record is missing', async () => {
                const result = await server.listInsts('missing', userId, null);

                expect(result).toEqual({
                    success: false,
                    errorCode: 'record_not_found',
                    errorMessage: 'Record not found.',
                });
            });

            it('should be able to list if the user is an admin', async () => {
                await services.records.createRecord({
                    userId,
                    recordName,
                    ownerId: userId,
                });

                await instStore.saveInst({
                    recordName,
                    inst,
                    markers: [PRIVATE_MARKER],
                });

                await instStore.saveInst({
                    recordName,
                    inst: 'otherInst',
                    markers: [PRIVATE_MARKER],
                });
                await instStore.saveInst({
                    recordName,
                    inst: 'otherInst2',
                    markers: [PRIVATE_MARKER],
                });
                await instStore.saveInst({
                    recordName,
                    inst: 'otherInst3',
                    markers: [PRIVATE_MARKER],
                });

                const result = await server.listInsts(recordName, userId, null);

                expect(result).toEqual({
                    success: true,
                    insts: [
                        {
                            recordName,
                            inst,
                            markers: [PRIVATE_MARKER],
                        },
                        {
                            recordName,
                            inst: 'otherInst',
                            markers: [PRIVATE_MARKER],
                        },
                        {
                            recordName,
                            inst: 'otherInst2',
                            markers: [PRIVATE_MARKER],
                        },
                        {
                            recordName,
                            inst: 'otherInst3',
                            markers: [PRIVATE_MARKER],
                        },
                    ],
                    totalCount: 4,
                });
            });

            it('should return not_authorized if the user is not an admin', async () => {
                const otherUserId: string = 'otherUserId';
                await services.authStore.saveUser({
                    id: otherUserId,
                    email: 'other@example.com',
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                    phoneNumber: null,
                });

                const user = await createTestUser(
                    services,
                    'other@example.com'
                );

                services.policyStore.roles[recordName] = {
                    [user.userId]: new Set(['developer']),
                };

                await services.records.createRecord({
                    userId,
                    recordName,
                    ownerId: userId,
                });

                await instStore.saveInst({
                    recordName,
                    inst,
                    markers: ['test'],
                });

                await instStore.saveInst({
                    recordName,
                    inst: 'otherInst',
                    markers: [PRIVATE_MARKER],
                });
                await instStore.saveInst({
                    recordName,
                    inst: 'otherInst2',
                    markers: ['test'],
                });
                await instStore.saveInst({
                    recordName,
                    inst: 'otherInst3',
                    markers: ['test'],
                });

                const result = await server.listInsts(
                    recordName,
                    user.userId,
                    null
                );

                expect(result).toEqual({
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'inst',
                        action: 'list',
                        subjectType: 'user',
                        subjectId: user.userId,
                    },
                });
            });

            it('should return not_authorized when insts are disabled', async () => {
                store.subscriptionConfiguration = buildSubscriptionConfig(
                    (config) =>
                        config.addSubscription('sub1', (sub) =>
                            sub
                                .withTier('tier1')
                                .withAllDefaultFeatures()
                                .withInsts({
                                    allowed: false,
                                })
                        )
                );

                await store.saveUser({
                    id: userId,
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                    email: 'test@example.com',
                    phoneNumber: null,
                    subscriptionId: 'sub1',
                    subscriptionStatus: 'active',
                });

                await services.records.createRecord({
                    userId,
                    recordName,
                    ownerId: userId,
                });

                await instStore.saveInst({
                    recordName,
                    inst,
                    markers: [PRIVATE_MARKER],
                });

                await instStore.saveInst({
                    recordName,
                    inst: 'otherInst',
                    markers: [PRIVATE_MARKER],
                });
                await instStore.saveInst({
                    recordName,
                    inst: 'otherInst2',
                    markers: [PRIVATE_MARKER],
                });
                await instStore.saveInst({
                    recordName,
                    inst: 'otherInst3',
                    markers: [PRIVATE_MARKER],
                });

                const result = await server.listInsts(recordName, userId, null);

                expect(result).toEqual({
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'Insts are not allowed for this subscription.',
                });
            });

            describe('with marker', () => {
                it('should return an empty list if recordName is null', async () => {
                    await services.records.createRecord({
                        userId,
                        recordName,
                        ownerId: userId,
                    });

                    await instStore.saveInst({
                        recordName,
                        inst,
                        markers: ['test'],
                    });

                    await instStore.saveInst({
                        recordName,
                        inst: 'otherInst',
                        markers: [PRIVATE_MARKER],
                    });
                    await instStore.saveInst({
                        recordName,
                        inst: 'otherInst2',
                        markers: ['test'],
                    });

                    // Grant permission for 'test' marker
                    await services.policyStore.assignPermissionToSubjectAndMarker(
                        recordName,
                        'user',
                        userId,
                        'inst',
                        'test',
                        'list',
                        {},
                        null
                    );

                    const result = await server.listInsts(
                        null,
                        userId,
                        null,
                        'test'
                    );

                    expect(result).toEqual({
                        success: true,
                        insts: [],
                        totalCount: 0,
                    });
                });

                it('should be able to list insts with a specific marker if the user has permission', async () => {
                    await services.records.createRecord({
                        userId,
                        recordName,
                        ownerId: userId,
                    });

                    await instStore.saveInst({
                        recordName,
                        inst,
                        markers: ['test'],
                    });

                    await instStore.saveInst({
                        recordName,
                        inst: 'otherInst',
                        markers: [PRIVATE_MARKER],
                    });
                    await instStore.saveInst({
                        recordName,
                        inst: 'otherInst2',
                        markers: ['test'],
                    });

                    // Grant permission for 'test' marker
                    await services.policyStore.assignPermissionToSubjectAndMarker(
                        recordName,
                        'user',
                        userId,
                        'inst',
                        'test',
                        'list',
                        {},
                        null
                    );

                    const result = await server.listInsts(
                        recordName,
                        userId,
                        null,
                        'test'
                    );

                    expect(result).toEqual({
                        success: true,
                        insts: [
                            {
                                recordName,
                                inst,
                                markers: ['test'],
                            },
                            {
                                recordName,
                                inst: 'otherInst2',
                                markers: ['test'],
                            },
                        ],
                        totalCount: 2,
                    });
                });

                it('should return not_authorized if the user does not have permission for the marker', async () => {
                    uuidMock.mockReturnValueOnce('otherUserId');
                    const user = await createTestUser(
                        services,
                        'other@example.com'
                    );

                    await services.records.createRecord({
                        userId,
                        recordName,
                        ownerId: userId,
                    });

                    await instStore.saveInst({
                        recordName,
                        inst,
                        markers: ['test'],
                    });

                    const result = await server.listInsts(
                        recordName,
                        user.userId,
                        null,
                        'test'
                    );

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'You are not authorized to perform this action.',
                        reason: {
                            type: 'missing_permission',
                            recordName,
                            resourceKind: 'inst',
                            action: 'list',
                            subjectType: 'user',
                            subjectId: user.userId,
                        },
                    });
                });

                it('should use private marker permission by default when no marker is specified', async () => {
                    await services.records.createRecord({
                        userId,
                        recordName,
                        ownerId: userId,
                    });

                    await instStore.saveInst({
                        recordName,
                        inst,
                        markers: [PRIVATE_MARKER],
                    });

                    const result = await server.listInsts(
                        recordName,
                        userId,
                        null,
                        null
                    );

                    expect(result).toEqual({
                        success: true,
                        insts: [
                            {
                                recordName,
                                inst,
                                markers: [PRIVATE_MARKER],
                            },
                        ],
                        totalCount: 1,
                    });
                });
            });
        });

        describe('eraseInst()', () => {
            beforeEach(async () => {
                await services.records.createRecord({
                    userId,
                    recordName,
                    ownerId: userId,
                });

                await instStore.saveInst({
                    recordName,
                    inst,
                    markers: [PRIVATE_MARKER],
                });
            });

            it('should delete the given inst', async () => {
                const result = await server.eraseInst(recordName, inst, userId);

                expect(result).toEqual({
                    success: true,
                });

                expect(await instStore.getInstByName(recordName, inst)).toEqual(
                    null
                );
            });

            it('should be able to use a recordKey to delete the inst', async () => {
                const key = await services.records.createPublicRecordKey(
                    recordName,
                    'subjectfull',
                    userId
                );
                if (key.success === false) {
                    throw new Error('Unable to create key: ' + key.errorCode);
                }
                const result = await server.eraseInst(
                    key.recordKey,
                    inst,
                    userId
                );

                expect(result).toEqual({
                    success: true,
                });

                expect(await instStore.getInstByName(recordName, inst)).toEqual(
                    null
                );
            });

            it('should return record_not_found if given a null recordName', async () => {
                await instStore.saveInst({
                    recordName: null,
                    inst: inst,
                    markers: [PRIVATE_MARKER],
                });

                const result = await server.eraseInst(null, inst, userId);

                expect(result).toEqual({
                    success: false,
                    errorCode: 'record_not_found',
                    errorMessage: 'Record not found.',
                });
            });

            it('should return a not_authorized error if the user does have access to the inst', async () => {
                const otherUserId: string = 'otherUserId';
                await services.authStore.saveUser({
                    id: otherUserId,
                    email: 'other@example.com',
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                    phoneNumber: null,
                });

                const user = await createTestUser(
                    services,
                    'other@example.com'
                );

                const result = await server.eraseInst(
                    recordName,
                    inst,
                    user.userId
                );

                expect(result).toEqual({
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        resourceKind: 'inst',
                        resourceId: inst,
                        action: 'delete',
                        subjectType: 'user',
                        subjectId: user.userId,
                        recordName,
                        type: 'missing_permission',
                    },
                });

                expect(await instStore.getInstByName(recordName, inst)).toEqual(
                    {
                        recordName,
                        inst,
                        markers: [PRIVATE_MARKER],
                    }
                );
            });

            it('should be able to delete insts if the user has been given permission', async () => {
                const otherUserId: string = 'otherUserId';
                await services.authStore.saveUser({
                    id: otherUserId,
                    email: 'other@example.com',
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                    phoneNumber: null,
                });

                const user = await createTestUser(
                    services,
                    'other@example.com'
                );

                await services.policyStore.assignPermissionToSubjectAndMarker(
                    recordName,
                    'role',
                    'developer',
                    'inst',
                    PRIVATE_MARKER,
                    'delete',
                    {},
                    null
                );

                services.policyStore.roles[recordName] = {
                    [otherUserId]: new Set(['developer']),
                };

                const result = await server.eraseInst(
                    recordName,
                    inst,
                    user.userId
                );

                expect(result).toEqual({
                    success: true,
                });

                expect(await instStore.getInstByName(recordName, inst)).toEqual(
                    null
                );
            });

            it('should return success if the inst does not exist', async () => {
                const result = await server.eraseInst(
                    recordName,
                    'missing',
                    userId
                );

                expect(result).toEqual({
                    success: true,
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
                            .slice(2)
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

                const events = messenger.getEvents(
                    device1Info.serverConnectionId
                );
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

                const events = messenger.getEvents(
                    device1Info.serverConnectionId
                );
                expect(events).toEqual([
                    [
                        WebsocketEventTypes.Error,
                        1,
                        {
                            success: false,
                            errorCode: 'not_supported',
                            errorMessage: 'Upload requests are not supported.',
                        },
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
                const events = messenger.getEvents(
                    device1Info.serverConnectionId
                );
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
                    errorCode: 'not_supported',
                    errorMessage: 'Download requests are not supported.',
                });
                const events = messenger.getEvents(
                    device1Info.serverConnectionId
                );
                expect(events).toEqual([]);
            });
        });

        describe('savePermanentBranches()', () => {
            let update1Base64: string;
            let update2Base64: string;

            beforeEach(async () => {
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

                const update1Bytes = encodeStateAsUpdate(
                    (partition as YjsPartitionImpl).doc
                );
                update1Base64 = fromByteArray(update1Bytes);

                await partition.applyEvents([
                    botAdded(
                        createBot('test2', {
                            num: '999',
                        })
                    ),
                ]);

                const update2Bytes = encodeStateAsUpdate(
                    (partition as YjsPartitionImpl).doc
                );
                update2Base64 = fromByteArray(update2Bytes);

                await services.records.createRecord({
                    recordName,
                    userId,
                    ownerId: userId,
                });

                await server.login(serverConnectionId, 1, {
                    type: 'login',
                    connectionToken,
                });

                await server.addUpdates(serverConnectionId, {
                    type: 'repo/add_updates',
                    recordName,
                    inst,
                    branch: 'branch',
                    updates: [update1Base64, update2Base64],
                    updateId: 1,
                });
            });

            it('should save all the branches that are waiting to be saved', async () => {
                const generation =
                    await instStore.temp.getDirtyBranchGeneration();
                const beforeSaveUpdates = await instStore.getCurrentUpdates(
                    recordName,
                    inst,
                    'branch'
                );

                expect(beforeSaveUpdates).toEqual({
                    updates: [update1Base64, update2Base64],
                    timestamps: [expect.any(Number), expect.any(Number)],
                    instSizeInBytes:
                        update1Base64.length + update2Base64.length,
                });

                await server.savePermanentBranches();

                const updates = await instStore.getCurrentUpdates(
                    recordName,
                    inst,
                    'branch'
                );

                expect(updates).toEqual({
                    updates: [expect.any(String)],
                    timestamps: [expect.any(Number)],
                    instSizeInBytes: expect.any(Number),
                });
                expect(updates.instSizeInBytes).toEqual(
                    updates.updates[0].length
                );

                const tempUpdates = await instStore.temp.getUpdates(
                    recordName,
                    inst,
                    'branch'
                );
                expect(tempUpdates).toEqual({
                    updates: [expect.any(String)],
                    timestamps: [expect.any(Number)],
                    instSizeInBytes: expect.any(Number),
                    branchSizeInBytes: expect.any(Number),
                });
                expect(tempUpdates?.instSizeInBytes).toEqual(
                    tempUpdates?.branchSizeInBytes
                );
                expect(tempUpdates?.instSizeInBytes).toEqual(
                    updates.instSizeInBytes
                );

                const state = getStateFromUpdates({
                    type: 'get_inst_state_from_updates',
                    updates: [
                        {
                            id: 0,
                            update: updates.updates[0],
                            timestamp: 123,
                        },
                    ],
                });

                const state2 = getStateFromUpdates({
                    type: 'get_inst_state_from_updates',
                    updates: [
                        {
                            id: 0,
                            update: tempUpdates?.updates[0] as any,
                            timestamp: 123,
                        },
                    ],
                });

                expect(state).toEqual({
                    test1: createBot('test1', {
                        abc: 'def',
                        ghi: 123,
                    }),
                    test2: createBot('test2', {
                        num: '999',
                    }),
                });
                expect(state).toEqual(state2);

                expect(
                    await instStore.temp.countBranchUpdates(
                        recordName,
                        inst,
                        'branch'
                    )
                ).toBe(1);

                const allUpdates = await instStore.perm.getAllUpdates(
                    recordName,
                    inst,
                    'branch'
                );
                expect(allUpdates).toEqual({
                    updates: [updates.updates[0]],
                    timestamps: [expect.any(Number)],
                    instSizeInBytes: updates.instSizeInBytes,
                });

                const dirtyBranches = await instStore.temp.listDirtyBranches();
                expect(dirtyBranches).toEqual([]);

                expect(
                    await instStore.temp.listDirtyBranches(generation)
                ).toEqual([]);
            });

            it('should acquire a lock before trying to save branch data', async () => {
                const generation =
                    await instStore.temp.getDirtyBranchGeneration();
                const beforeSaveUpdates = await instStore.getCurrentUpdates(
                    recordName,
                    inst,
                    'branch'
                );

                expect(beforeSaveUpdates).toEqual({
                    updates: [update1Base64, update2Base64],
                    timestamps: [expect.any(Number), expect.any(Number)],
                    instSizeInBytes:
                        update1Base64.length + update2Base64.length,
                });

                const lock = await instStore.temp.acquireLock(
                    SAVE_PERMANENT_BRANCHES_LOCK,
                    100_000
                );
                expect(lock).not.toBeFalsy();

                const p1 = server.savePermanentBranches();
                const p2 = server.savePermanentBranches();

                const [r1, r2] = await Promise.all([p1, p2]);

                const updates = await instStore.getCurrentUpdates(
                    recordName,
                    inst,
                    'branch'
                );

                expect(updates).toEqual(beforeSaveUpdates);
                expect(await instStore.temp.getDirtyBranchGeneration()).toBe(
                    generation
                );
            });

            it('should start a new dirty branch generation', async () => {
                const generation =
                    await instStore.temp.getDirtyBranchGeneration();
                await server.savePermanentBranches();
                expect(
                    await instStore.temp.getDirtyBranchGeneration()
                ).not.toBe(generation);
            });
        });
    });
});
