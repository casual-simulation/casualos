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
    BotAction,
    RemoteCausalRepoProtocol,
    ConnectionClient,
    WebsocketHttpResponseMessage,
    WebsocketHttpRequestMessage,
    WebsocketHttpPartialResponseMessage,
    StoredAux,
} from '@casual-simulation/aux-common';
import {
    asyncResult,
    approveAction,
    asyncError,
    MemoryConnectionClient,
    getRecordsEndpoint,
    iterableNext,
    iterableComplete,
    createBot,
    PUBLIC_READ_MARKER,
    installAuxFile,
    remote as calcRemote,
    DEFAULT_BRANCH_NAME,
    action,
    iterableThrow,
    signOut,
} from '@casual-simulation/aux-common';
import {
    aiChat,
    aiGenerateSkybox,
    aiGenerateImage,
    listUserStudios,
    listDataRecord,
    recordEvent,
    getEventCount,
    joinRoom,
    leaveRoom,
    setRoomOptions,
    getRoomOptions,
    grantInstAdminPermission,
    grantUserRole,
    grantInstRole,
    revokeUserRole,
    revokeInstRole,
    getFile,
    recordData,
    recordFile,
    eraseFile,
    eraseRecordData,
    getRecordData,
    listDataRecordByMarker,
    grantRecordPermission,
    revokeRecordPermission,
    aiChatStream,
    aiHumeGetAccessToken,
    aiSloydGenerateModel,
    recordsCallProcedure,
    recordPackageVersion,
    installPackage,
    listInstalledPackages,
} from '@casual-simulation/aux-runtime';
import { Subject, Subscription } from 'rxjs';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';
import type {
    GetEndpointInfoFunction,
    GetRoomOptions,
    RecordsEndpointInfo,
    RoomJoin,
    RoomLeave,
    SetRoomOptions,
} from './RecordsManager';
import { RecordsManager } from './RecordsManager';
import type { AuthHelperInterface } from './AuthHelperInterface';
import { TestAuxVM } from '../vm/test/TestAuxVM';
import { BotHelper } from './BotHelper';
import stringify from '@casual-simulation/fast-json-stable-stringify';
import 'aux-jest-matchers';
import { DateTime } from 'luxon';
import type { ListedStudio } from '@casual-simulation/aux-records';
import {
    asyncIterable,
    readableFromAsyncIterable,
} from '@casual-simulation/aux-records/TestUtils';
import type { GetPackageVersionResult } from '@casual-simulation/aux-records/packages/version';
import { version } from '@casual-simulation/aux-records/packages/version';
import { formatV2RecordKey } from '@casual-simulation/aux-common/records/RecordKeys';

jest.mock('axios');

console.log = jest.fn();

describe('RecordsManager', () => {
    let records: RecordsManager;
    let actions: BotAction[];
    let userId: string = 'user';
    let vm: TestAuxVM;
    let helper: BotHelper;
    let auth: AuthHelperInterface;
    let authMock = {
        isAuthenticated: jest.fn(),
        authenticate: jest.fn(),
        getAuthToken: jest.fn(),
        createPublicRecordKey: jest.fn(),
        provideSmsNumber: jest.fn(),
        getRecordKeyPolicy: jest.fn(),
        logout: jest.fn(),
    };
    let customAuth: AuthHelperInterface;
    let customAuthMock = {
        isAuthenticated: jest.fn(),
        authenticate: jest.fn(),
        getAuthToken: jest.fn(),
        createPublicRecordKey: jest.fn(),
        provideSmsNumber: jest.fn(),
    };
    let getEndpointInfo: GetEndpointInfoFunction;
    let connectionClientFactory: (
        endpoint: string,
        protocol: RemoteCausalRepoProtocol
    ) => ConnectionClient;
    let sub: Subscription;

    beforeEach(async () => {
        require('axios').__reset();

        actions = [];
        sub = new Subscription();
        helper = createHelper();
        auth = {
            isAuthenticated: jest.fn(),
            authenticate: jest.fn(),
            getAuthToken: jest.fn(),
            createPublicRecordKey: jest.fn(),
            unsubscribe: jest.fn(),
            openAccountPage: jest.fn(),
            cancelLogin: jest.fn(),
            loginStatus: null,
            loginUIStatus: null,
            logout: jest.fn(),
            relogin: jest.fn(),
            getConnectionKey: jest.fn(),
            provideEmailAddress: jest.fn(),
            setUseCustomUI: jest.fn(),
            provideSmsNumber: jest.fn(),
            provideCode: jest.fn(),
            authenticateInBackground: jest.fn(),
            getRecordKeyPolicy: jest.fn(),
            isValidDisplayName: jest.fn(),
            isValidEmailAddress: jest.fn(),
            provideHasAccount: jest.fn(),
            providePrivoSignUpInfo: jest.fn(),
            getPolicyUrls: jest.fn(),
            getRecordsOrigin: jest
                .fn()
                .mockResolvedValue('http://localhost:3002'),
            getWebsocketOrigin: jest
                .fn()
                .mockResolvedValue('http://localhost:2998'),
            getWebsocketProtocol: jest.fn().mockResolvedValue('websocket'),
            getComIdWebConfig: jest.fn(),
            grantPermission: jest.fn(),
            provideLoginResult: jest.fn(),
            get supportsAuthentication() {
                return true;
            },
            get closed() {
                return false;
            },
            get origin() {
                return 'http://localhost:3002';
            },
            get currentLoginStatus(): any {
                return null;
            },
        };
        authMock = auth as any;

        customAuth = {
            isAuthenticated: jest.fn(),
            authenticate: jest.fn(),
            getAuthToken: jest.fn(),
            createPublicRecordKey: jest.fn(),
            unsubscribe: jest.fn(),
            openAccountPage: jest.fn(),
            cancelLogin: jest.fn(),
            loginStatus: null,
            loginUIStatus: null,
            logout: jest.fn(),
            relogin: jest.fn(),
            getConnectionKey: jest.fn(),
            provideEmailAddress: jest.fn(),
            setUseCustomUI: jest.fn(),
            provideSmsNumber: jest.fn(),
            provideCode: jest.fn(),
            authenticateInBackground: jest.fn(),
            getRecordKeyPolicy: jest.fn(),
            getRecordsOrigin: jest
                .fn()
                .mockResolvedValue('http://localhost:9999'),
            getWebsocketOrigin: jest
                .fn()
                .mockResolvedValue('http://localhost:2998'),
            getWebsocketProtocol: jest.fn().mockResolvedValue('websocket'),
            isValidDisplayName: jest.fn(),
            isValidEmailAddress: jest.fn(),
            provideHasAccount: jest.fn(),
            providePrivoSignUpInfo: jest.fn(),
            getPolicyUrls: jest.fn(),
            getComIdWebConfig: jest.fn(),
            grantPermission: jest.fn(),
            provideLoginResult: jest.fn(),
            get supportsAuthentication() {
                return true;
            },
            get closed() {
                return false;
            },
            get origin() {
                return 'http://localhost:9999';
            },
            get currentLoginStatus(): any {
                return null;
            },
        };
        customAuthMock = customAuth as any;

        let authFactory = (endpoint: string) => {
            if (endpoint === 'http://localhost:9999') {
                return customAuth;
            } else {
                return auth;
            }
        };

        let endpointInfoFromAuth = async (
            auth: AuthHelperInterface,
            authenticateIfNotLoggedIn: boolean
        ) => {
            if (authenticateIfNotLoggedIn) {
                if (!(await auth.isAuthenticated())) {
                    await auth.authenticate();
                }
            }

            const token = await auth.getAuthToken();
            let headers: { [key: string]: string } = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            return {
                error: false,
                recordsOrigin: await auth.getRecordsOrigin(),
                websocketOrigin: await auth.getWebsocketOrigin(),
                websocketProtocol: await auth.getWebsocketProtocol(),
                token,
                headers,
            } as RecordsEndpointInfo;
        };

        getEndpointInfo = async (
            endpoint: string,
            authenticateIfNotLoggedIn: boolean
        ) => {
            const auth = authFactory(endpoint);
            return await endpointInfoFromAuth(auth, authenticateIfNotLoggedIn);
        };

        records = new RecordsManager(
            {
                version: '1.0.0',
                versionHash: '1234567890abcdef',
                recordsOrigin: 'http://localhost:3002',
                authOrigin: 'http://localhost:3302',
            },
            helper,
            getEndpointInfo,
            (endpoint) => authMock as any,
            true
        );
    });

    function createHelper() {
        vm = new TestAuxVM(null, userId);
        const helper = new BotHelper(vm);
        helper.userId = 'userId';

        return helper;
    }

    function setResponse(response: any) {
        require('axios').__setResponse(response);
    }

    function setNextResponse(response: any) {
        require('axios').__setNextResponse(response);
    }

    function getLastPost() {
        return require('axios').__getLastPost();
    }

    function getLastGet() {
        return require('axios').__getLastGet();
    }

    function getLastDelete() {
        return require('axios').__getLastDelete();
    }

    function getRequests() {
        return require('axios').__getRequests();
    }

    describe('handleEvents()', () => {
        describe('record_data', () => {
            beforeEach(() => {
                authMock.getRecordKeyPolicy.mockResolvedValue('subjectfull');
                require('axios').__reset();
            });

            it('should make a POST request to /api/v2/records/data', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    recordData(
                        'myToken',
                        'myAddress',
                        {
                            myRecord: true,
                        },
                        false,
                        {},
                        1
                    ),
                ]);

                await waitAsync();

                expect(getLastPost()).toEqual([
                    'http://localhost:3002/api/v2/records/data',
                    {
                        recordKey: 'myToken',
                        address: 'myAddress',
                        data: {
                            myRecord: true,
                        },
                    },
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should include the update and delete policies', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    recordData(
                        'myToken',
                        'myAddress',
                        {
                            myRecord: true,
                        },
                        false,
                        {
                            updatePolicy: true,
                            deletePolicy: ['user1'],
                        },
                        1
                    ),
                ]);

                await waitAsync();

                expect(getLastPost()).toEqual([
                    'http://localhost:3002/api/v2/records/data',
                    {
                        recordKey: 'myToken',
                        address: 'myAddress',
                        data: {
                            myRecord: true,
                        },
                        updatePolicy: true,
                        deletePolicy: ['user1'],
                    },
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should include the markers', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    recordData(
                        'myToken',
                        'myAddress',
                        {
                            myRecord: true,
                        },
                        false,
                        {
                            markers: ['marker1', 'marker2'],
                        },
                        1
                    ),
                ]);

                await waitAsync();

                expect(getLastPost()).toEqual([
                    'http://localhost:3002/api/v2/records/data',
                    {
                        recordKey: 'myToken',
                        address: 'myAddress',
                        data: {
                            myRecord: true,
                        },
                        markers: ['marker1', 'marker2'],
                    },
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should include the inst', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: null,
                    inst: 'myInst',
                };

                records.handleEvents([
                    recordData(
                        'myToken',
                        'myAddress',
                        {
                            myRecord: true,
                        },
                        false,
                        {},
                        1
                    ),
                ]);

                await waitAsync();

                expect(getLastPost()).toEqual([
                    'http://localhost:3002/api/v2/records/data',
                    {
                        recordKey: 'myToken',
                        address: 'myAddress',
                        data: {
                            myRecord: true,
                        },
                        instances: ['/myInst'],
                    },
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should not include the inst if it is static', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: null,
                    inst: 'myInst',
                    isStatic: true,
                };

                records.handleEvents([
                    recordData(
                        'myToken',
                        'myAddress',
                        {
                            myRecord: true,
                        },
                        false,
                        {},
                        1
                    ),
                ]);

                await waitAsync();

                expect(getLastPost()).toEqual([
                    'http://localhost:3002/api/v2/records/data',
                    {
                        recordKey: 'myToken',
                        address: 'myAddress',
                        data: {
                            myRecord: true,
                        },
                    },
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should support record names', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: 'record',
                    inst: 'myInst',
                };

                records.handleEvents([
                    recordData(
                        'myToken',
                        'myAddress',
                        {
                            myRecord: true,
                        },
                        false,
                        {},
                        1
                    ),
                ]);

                await waitAsync();

                expect(getLastPost()).toEqual([
                    'http://localhost:3002/api/v2/records/data',
                    {
                        recordKey: 'myToken',
                        address: 'myAddress',
                        data: {
                            myRecord: true,
                        },
                        instances: ['record/myInst'],
                    },
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should support custom endpoints', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    },
                });

                customAuthMock.isAuthenticated.mockResolvedValueOnce(true);
                customAuthMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    recordData(
                        'myToken',
                        'myAddress',
                        {
                            myRecord: true,
                        },
                        false,
                        { endpoint: 'http://localhost:9999' },
                        1
                    ),
                ]);

                await waitAsync();

                expect(getLastPost()).toEqual([
                    'http://localhost:9999/api/v2/records/data',
                    {
                        recordKey: 'myToken',
                        address: 'myAddress',
                        data: {
                            myRecord: true,
                        },
                    },
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    }),
                ]);
                expect(customAuthMock.isAuthenticated).toBeCalled();
                expect(customAuthMock.authenticate).not.toBeCalled();
                expect(customAuthMock.getAuthToken).toBeCalled();
            });

            it('should make a POST request to /api/v2/records/manual/data for manual records', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    approveAction(
                        recordData(
                            'myToken',
                            'myAddress',
                            {
                                myRecord: true,
                            },
                            true,
                            {},
                            1
                        )
                    ),
                ]);

                await waitAsync();

                expect(getLastPost()).toEqual([
                    'http://localhost:3002/api/v2/records/manual/data',
                    {
                        recordKey: 'myToken',
                        address: 'myAddress',
                        data: {
                            myRecord: true,
                        },
                    },
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should support custom endpoints for manual records', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    },
                });

                customAuthMock.isAuthenticated.mockResolvedValueOnce(true);
                customAuthMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    approveAction(
                        recordData(
                            'myToken',
                            'myAddress',
                            {
                                myRecord: true,
                            },
                            true,
                            { endpoint: 'http://localhost:9999' },
                            1
                        )
                    ),
                ]);

                await waitAsync();

                expect(getLastPost()).toEqual([
                    'http://localhost:9999/api/v2/records/manual/data',
                    {
                        recordKey: 'myToken',
                        address: 'myAddress',
                        data: {
                            myRecord: true,
                        },
                    },
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    }),
                ]);
                expect(customAuthMock.isAuthenticated).toBeCalled();
                expect(customAuthMock.authenticate).not.toBeCalled();
                expect(customAuthMock.getAuthToken).toBeCalled();
            });

            it('should attempt to login if not authenticated', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(false);
                authMock.authenticate.mockResolvedValueOnce({});
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    recordData(
                        'myToken',
                        'myAddress',
                        {
                            myRecord: true,
                        },
                        false,
                        {},
                        1
                    ),
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should return a not_logged_in error if there is no token', async () => {
                authMock.isAuthenticated.mockResolvedValueOnce(false);
                authMock.authenticate.mockResolvedValueOnce({});
                authMock.getAuthToken.mockResolvedValueOnce(null);
                const recordKey = formatV2RecordKey(
                    'recordName',
                    'secret',
                    'subjectfull'
                );

                records.handleEvents([
                    recordData(
                        recordKey,
                        'myAddress',
                        {
                            myRecord: true,
                        },
                        false,
                        {},
                        1
                    ),
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: false,
                        errorCode: 'not_logged_in',
                        errorMessage: 'The user is not logged in.',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should ignore actions that require manual approval but are not approved', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    recordData(
                        'myToken',
                        'myAddress',
                        {
                            myRecord: true,
                        },
                        true,
                        {},
                        1
                    ),
                ]);

                await waitAsync();

                expect(getLastPost()).toBeUndefined();

                await waitAsync();

                expect(vm.events).toEqual([]);
                expect(authMock.isAuthenticated).not.toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).not.toBeCalled();
            });

            it('should not require login with subjectless keys', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    },
                });
                authMock.getRecordKeyPolicy.mockResolvedValueOnce(
                    'subjectless'
                );
                authMock.getAuthToken.mockResolvedValueOnce(null);
                const recordKey = formatV2RecordKey(
                    'recordName',
                    'secret',
                    'subjectless'
                );

                records.handleEvents([
                    recordData(
                        recordKey,
                        'myAddress',
                        {
                            myRecord: true,
                        },
                        false,
                        {},
                        1
                    ),
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    }),
                ]);
                expect(getLastPost()).toEqual([
                    'http://localhost:3002/api/v2/records/data',
                    {
                        recordKey: recordKey,
                        address: 'myAddress',
                        data: {
                            myRecord: true,
                        },
                    },
                    {
                        validateStatus: expect.any(Function),
                        headers: {},
                    },
                ]);
                expect(authMock.isAuthenticated).not.toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
            });

            it('support manual records with subjectless keys', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    },
                });
                authMock.getRecordKeyPolicy.mockResolvedValueOnce(
                    'subjectless'
                );
                authMock.getAuthToken.mockResolvedValueOnce(null);
                const recordKey = formatV2RecordKey(
                    'recordName',
                    'secret',
                    'subjectless'
                );

                records.handleEvents([
                    approveAction(
                        recordData(
                            recordKey,
                            'myAddress',
                            {
                                myRecord: true,
                            },
                            true,
                            {},
                            1
                        )
                    ),
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    }),
                ]);
                expect(getLastPost()).toEqual([
                    'http://localhost:3002/api/v2/records/manual/data',
                    {
                        recordKey: recordKey,
                        address: 'myAddress',
                        data: {
                            myRecord: true,
                        },
                    },
                    {
                        validateStatus: expect.any(Function),
                        headers: {},
                    },
                ]);
                expect(authMock.isAuthenticated).not.toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
            });
        });

        describe('get_record_data', () => {
            beforeEach(() => {
                require('axios').__reset();
            });

            it('should make a GET request to /api/v2/records/data', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                        data: {
                            abc: 'def',
                        },
                    },
                });

                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    getRecordData('testRecord', 'myAddress', false, {}, 1),
                ]);

                await waitAsync();

                expect(getLastGet()).toEqual([
                    'http://localhost:3002/api/v2/records/data?recordName=testRecord&address=myAddress',
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                        data: {
                            abc: 'def',
                        },
                    }),
                ]);
            });

            it('should not include authorization if the user is not logged in', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                        data: {
                            abc: 'def',
                        },
                    },
                });

                authMock.getAuthToken.mockResolvedValueOnce(null);

                records.handleEvents([
                    getRecordData('testRecord', 'myAddress', false, {}, 1),
                ]);

                await waitAsync();

                expect(getLastGet()).toEqual([
                    'http://localhost:3002/api/v2/records/data?recordName=testRecord&address=myAddress',
                    {
                        validateStatus: expect.any(Function),
                        headers: {},
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                        data: {
                            abc: 'def',
                        },
                    }),
                ]);

                // should also not try to authenticate
                expect(authMock.authenticate).not.toBeCalled();
            });

            it('should include the inst', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                        data: {
                            abc: 'def',
                        },
                    },
                });

                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: null,
                    inst: 'myInst',
                };

                records.handleEvents([
                    getRecordData('testRecord', 'myAddress', false, {}, 1),
                ]);

                await waitAsync();

                expect(getLastGet()).toEqual([
                    'http://localhost:3002/api/v2/records/data?recordName=testRecord&address=myAddress&instances=%2FmyInst',
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                        data: {
                            abc: 'def',
                        },
                    }),
                ]);
            });

            it('should not include the inst if it is static', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                        data: {
                            abc: 'def',
                        },
                    },
                });

                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: null,
                    inst: 'myInst',
                    isStatic: true,
                };

                records.handleEvents([
                    getRecordData('testRecord', 'myAddress', false, {}, 1),
                ]);

                await waitAsync();

                expect(getLastGet()).toEqual([
                    'http://localhost:3002/api/v2/records/data?recordName=testRecord&address=myAddress',
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                        data: {
                            abc: 'def',
                        },
                    }),
                ]);
            });

            it('should support record names', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                        data: {
                            abc: 'def',
                        },
                    },
                });

                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: 'record',
                    inst: 'myInst',
                };

                records.handleEvents([
                    getRecordData('testRecord', 'myAddress', false, {}, 1),
                ]);

                await waitAsync();

                expect(getLastGet()).toEqual([
                    'http://localhost:3002/api/v2/records/data?recordName=testRecord&address=myAddress&instances=record%2FmyInst',
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                        data: {
                            abc: 'def',
                        },
                    }),
                ]);
            });

            it('should support custom endpoints', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                        data: {
                            abc: 'def',
                        },
                    },
                });

                customAuthMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    getRecordData(
                        'testRecord',
                        'myAddress',
                        false,
                        { endpoint: 'http://localhost:9999' },
                        1
                    ),
                ]);

                await waitAsync();

                expect(getLastGet()).toEqual([
                    'http://localhost:9999/api/v2/records/data?recordName=testRecord&address=myAddress',
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                        data: {
                            abc: 'def',
                        },
                    }),
                ]);
            });

            it('should make a GET request to /api/v2/records/manual/data for manual records', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                        data: {
                            abc: 'def',
                        },
                    },
                });

                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    approveAction(
                        getRecordData('testRecord', 'myAddress', true, {}, 1)
                    ),
                ]);

                await waitAsync();

                expect(getLastGet()).toEqual([
                    'http://localhost:3002/api/v2/records/manual/data?recordName=testRecord&address=myAddress',
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                        data: {
                            abc: 'def',
                        },
                    }),
                ]);
            });

            it('should support custom endpoints for manual record data', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                        data: {
                            abc: 'def',
                        },
                    },
                });

                customAuthMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    approveAction(
                        getRecordData(
                            'testRecord',
                            'myAddress',
                            true,
                            { endpoint: 'http://localhost:9999' },
                            1
                        )
                    ),
                ]);

                await waitAsync();

                expect(getLastGet()).toEqual([
                    'http://localhost:9999/api/v2/records/manual/data?recordName=testRecord&address=myAddress',
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                        data: {
                            abc: 'def',
                        },
                    }),
                ]);
            });

            it('should fail if no recordsOrigin is set', async () => {
                records = new RecordsManager(
                    {
                        version: '1.0.0',
                        versionHash: '1234567890abcdef',
                        recordsOrigin: null,
                    },
                    helper,
                    () => null,
                    () => null
                );

                records.handleEvents([
                    getRecordData('testRecord', 'myAddress', false, {}, 1),
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: false,
                        errorCode: 'not_supported',
                        errorMessage: 'Records are not supported on this inst.',
                    }),
                ]);
            });

            it('should ignore requests that need approval but are not approved', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                        data: {
                            abc: 'def',
                        },
                    },
                });

                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    getRecordData('testRecord', 'myAddress', true, {}, 1),
                ]);

                await waitAsync();

                expect(getLastGet()).toEqual([]);

                await waitAsync();

                expect(vm.events).toEqual([]);
            });
        });

        describe('list_record_data', () => {
            beforeEach(() => {
                require('axios').__reset();
            });

            it('should make a GET request to /api/v2/records/data/list', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        items: {
                            address: 'myAddress',
                            data: {
                                abc: 'def',
                            },
                        },
                    },
                });

                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    listDataRecord('testRecord', 'myAddress', {}, 1),
                ]);

                await waitAsync();

                expect(getLastGet()).toEqual([
                    'http://localhost:3002/api/v2/records/data/list?recordName=testRecord&address=myAddress',
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        items: {
                            address: 'myAddress',
                            data: {
                                abc: 'def',
                            },
                        },
                    }),
                ]);
                expect(authMock.getAuthToken).toHaveBeenCalled();
            });

            it('should not include the Authorization header if the user is not logged in', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        items: {
                            address: 'myAddress',
                            data: {
                                abc: 'def',
                            },
                        },
                    },
                });

                authMock.getAuthToken.mockResolvedValueOnce(null);

                records.handleEvents([
                    listDataRecord('testRecord', 'myAddress', {}, 1),
                ]);

                await waitAsync();

                expect(getLastGet()).toEqual([
                    'http://localhost:3002/api/v2/records/data/list?recordName=testRecord&address=myAddress',
                    { validateStatus: expect.any(Function), headers: {} },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        items: {
                            address: 'myAddress',
                            data: {
                                abc: 'def',
                            },
                        },
                    }),
                ]);
                expect(authMock.getAuthToken).toHaveBeenCalled();
                expect(authMock.authenticate).toHaveBeenCalled();
            });

            it('should include the inst', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        items: {
                            address: 'myAddress',
                            data: {
                                abc: 'def',
                            },
                        },
                    },
                });

                authMock.getAuthToken.mockResolvedValueOnce('authToken');
                vm.origin = {
                    recordName: null,
                    inst: 'myInst',
                };

                records.handleEvents([
                    listDataRecord('testRecord', 'myAddress', {}, 1),
                ]);

                await waitAsync();

                expect(getLastGet()).toEqual([
                    'http://localhost:3002/api/v2/records/data/list?recordName=testRecord&address=myAddress&instances=%2FmyInst',
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        items: {
                            address: 'myAddress',
                            data: {
                                abc: 'def',
                            },
                        },
                    }),
                ]);
            });

            it('should not include the inst if it is static', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        items: {
                            address: 'myAddress',
                            data: {
                                abc: 'def',
                            },
                        },
                    },
                });

                authMock.getAuthToken.mockResolvedValueOnce('authToken');
                vm.origin = {
                    recordName: null,
                    inst: 'myInst',
                    isStatic: true,
                };

                records.handleEvents([
                    listDataRecord('testRecord', 'myAddress', {}, 1),
                ]);

                await waitAsync();

                expect(getLastGet()).toEqual([
                    'http://localhost:3002/api/v2/records/data/list?recordName=testRecord&address=myAddress',
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        items: {
                            address: 'myAddress',
                            data: {
                                abc: 'def',
                            },
                        },
                    }),
                ]);
            });

            it('should support record names', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        items: {
                            address: 'myAddress',
                            data: {
                                abc: 'def',
                            },
                        },
                    },
                });

                authMock.getAuthToken.mockResolvedValueOnce('authToken');
                vm.origin = {
                    recordName: 'record',
                    inst: 'myInst',
                };

                records.handleEvents([
                    listDataRecord('testRecord', 'myAddress', {}, 1),
                ]);

                await waitAsync();

                expect(getLastGet()).toEqual([
                    'http://localhost:3002/api/v2/records/data/list?recordName=testRecord&address=myAddress&instances=record%2FmyInst',
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        items: {
                            address: 'myAddress',
                            data: {
                                abc: 'def',
                            },
                        },
                    }),
                ]);
            });

            it('should support custom endpoints', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        items: {
                            address: 'myAddress',
                            data: {
                                abc: 'def',
                            },
                        },
                    },
                });

                customAuthMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    listDataRecord(
                        'testRecord',
                        'myAddress',
                        { endpoint: 'http://localhost:9999' },
                        1
                    ),
                ]);

                await waitAsync();

                expect(getLastGet()).toEqual([
                    'http://localhost:9999/api/v2/records/data/list?recordName=testRecord&address=myAddress',
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        items: {
                            address: 'myAddress',
                            data: {
                                abc: 'def',
                            },
                        },
                    }),
                ]);
            });

            it('should not include the address if the event specifies a null address', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        items: {
                            address: 'myAddress',
                            data: {
                                abc: 'def',
                            },
                        },
                    },
                });

                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    listDataRecord('testRecord', null, {}, 1),
                ]);

                await waitAsync();

                expect(getLastGet()).toEqual([
                    'http://localhost:3002/api/v2/records/data/list?recordName=testRecord',
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        items: {
                            address: 'myAddress',
                            data: {
                                abc: 'def',
                            },
                        },
                    }),
                ]);
            });
        });

        describe('list_record_data_by_marker', () => {
            beforeEach(() => {
                require('axios').__reset();
            });

            it('should make a GET request to /api/v2/records/data/list', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        items: {
                            address: 'myAddress',
                            data: {
                                abc: 'def',
                            },
                        },
                        marker: 'myMarker',
                    },
                });

                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    listDataRecordByMarker(
                        'testRecord',
                        'myMarker',
                        'myAddress',
                        {},
                        1
                    ),
                ]);

                await waitAsync();

                expect(getLastGet()).toEqual([
                    'http://localhost:3002/api/v2/records/data/list?recordName=testRecord&marker=myMarker&address=myAddress',
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        items: {
                            address: 'myAddress',
                            data: {
                                abc: 'def',
                            },
                        },
                        marker: 'myMarker',
                    }),
                ]);
            });

            it('should not include the Authorization header if the user is not logged in', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        items: {
                            address: 'myAddress',
                            data: {
                                abc: 'def',
                            },
                        },
                        marker: 'myMarker',
                    },
                });

                authMock.getAuthToken.mockResolvedValueOnce(null);

                records.handleEvents([
                    listDataRecordByMarker(
                        'testRecord',
                        'myMarker',
                        'myAddress',
                        {},
                        1
                    ),
                ]);

                await waitAsync();

                expect(getLastGet()).toEqual([
                    'http://localhost:3002/api/v2/records/data/list?recordName=testRecord&marker=myMarker&address=myAddress',
                    { validateStatus: expect.any(Function), headers: {} },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        items: {
                            address: 'myAddress',
                            data: {
                                abc: 'def',
                            },
                        },
                        marker: 'myMarker',
                    }),
                ]);
                expect(authMock.getAuthToken).toHaveBeenCalled();
                expect(authMock.authenticate).not.toHaveBeenCalled();
            });

            it('should include the inst', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        items: {
                            address: 'myAddress',
                            data: {
                                abc: 'def',
                            },
                        },
                        marker: 'myMarker',
                    },
                });

                authMock.getAuthToken.mockResolvedValueOnce('authToken');
                vm.origin = {
                    recordName: null,
                    inst: 'myInst',
                };

                records.handleEvents([
                    listDataRecordByMarker(
                        'testRecord',
                        'myMarker',
                        'myAddress',
                        {},
                        1
                    ),
                ]);

                await waitAsync();

                expect(getLastGet()).toEqual([
                    'http://localhost:3002/api/v2/records/data/list?recordName=testRecord&marker=myMarker&address=myAddress&instances=%2FmyInst',
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        items: {
                            address: 'myAddress',
                            data: {
                                abc: 'def',
                            },
                        },
                        marker: 'myMarker',
                    }),
                ]);
            });

            it('should not include the inst if it is static', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        items: {
                            address: 'myAddress',
                            data: {
                                abc: 'def',
                            },
                        },
                        marker: 'myMarker',
                    },
                });

                authMock.getAuthToken.mockResolvedValueOnce('authToken');
                vm.origin = {
                    recordName: null,
                    inst: 'myInst',
                    isStatic: true,
                };

                records.handleEvents([
                    listDataRecordByMarker(
                        'testRecord',
                        'myMarker',
                        'myAddress',
                        {},
                        1
                    ),
                ]);

                await waitAsync();

                expect(getLastGet()).toEqual([
                    'http://localhost:3002/api/v2/records/data/list?recordName=testRecord&marker=myMarker&address=myAddress',
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        items: {
                            address: 'myAddress',
                            data: {
                                abc: 'def',
                            },
                        },
                        marker: 'myMarker',
                    }),
                ]);
            });

            it('should support record names', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        items: {
                            address: 'myAddress',
                            data: {
                                abc: 'def',
                            },
                        },
                        marker: 'myMarker',
                    },
                });

                authMock.getAuthToken.mockResolvedValueOnce('authToken');
                vm.origin = {
                    recordName: 'record',
                    inst: 'myInst',
                };

                records.handleEvents([
                    listDataRecordByMarker(
                        'testRecord',
                        'myMarker',
                        'myAddress',
                        {},
                        1
                    ),
                ]);

                await waitAsync();

                expect(getLastGet()).toEqual([
                    'http://localhost:3002/api/v2/records/data/list?recordName=testRecord&marker=myMarker&address=myAddress&instances=record%2FmyInst',
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        items: {
                            address: 'myAddress',
                            data: {
                                abc: 'def',
                            },
                        },
                        marker: 'myMarker',
                    }),
                ]);
            });

            it('should support custom endpoints', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        items: {
                            address: 'myAddress',
                            data: {
                                abc: 'def',
                            },
                        },
                        marker: 'myMarker',
                    },
                });

                customAuthMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    listDataRecordByMarker(
                        'testRecord',
                        'myMarker',
                        'myAddress',
                        { endpoint: 'http://localhost:9999' },
                        1
                    ),
                ]);

                await waitAsync();

                expect(getLastGet()).toEqual([
                    'http://localhost:9999/api/v2/records/data/list?recordName=testRecord&marker=myMarker&address=myAddress',
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        items: {
                            address: 'myAddress',
                            data: {
                                abc: 'def',
                            },
                        },
                        marker: 'myMarker',
                    }),
                ]);
            });

            it('should not include the address if the event specifies a null address', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        items: {
                            address: 'myAddress',
                            data: {
                                abc: 'def',
                            },
                        },
                        marker: 'myMarker',
                    },
                });

                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    listDataRecordByMarker(
                        'testRecord',
                        'myMarker',
                        null,
                        {},
                        1
                    ),
                ]);

                await waitAsync();

                expect(getLastGet()).toEqual([
                    'http://localhost:3002/api/v2/records/data/list?recordName=testRecord&marker=myMarker',
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        items: {
                            address: 'myAddress',
                            data: {
                                abc: 'def',
                            },
                        },
                        marker: 'myMarker',
                    }),
                ]);
            });
        });

        describe('erase_record_data', () => {
            beforeEach(() => {
                require('axios').__reset();
            });

            it('should make a DELETE request to /api/v2/records/data', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    eraseRecordData('myToken', 'myAddress', false, {}, 1),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'DELETE',
                        'http://localhost:3002/api/v2/records/data',
                        { recordKey: 'myToken', address: 'myAddress' },
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should include the inst', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: null,
                    inst: 'myInst',
                };

                records.handleEvents([
                    eraseRecordData('myToken', 'myAddress', false, {}, 1),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'DELETE',
                        'http://localhost:3002/api/v2/records/data',
                        {
                            recordKey: 'myToken',
                            address: 'myAddress',
                            instances: ['/myInst'],
                        },
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should not include the inst if it is static', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: null,
                    inst: 'myInst',
                    isStatic: true,
                };

                records.handleEvents([
                    eraseRecordData('myToken', 'myAddress', false, {}, 1),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'DELETE',
                        'http://localhost:3002/api/v2/records/data',
                        {
                            recordKey: 'myToken',
                            address: 'myAddress',
                        },
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should support record names', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: 'record',
                    inst: 'myInst',
                };

                records.handleEvents([
                    eraseRecordData('myToken', 'myAddress', false, {}, 1),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'DELETE',
                        'http://localhost:3002/api/v2/records/data',
                        {
                            recordKey: 'myToken',
                            address: 'myAddress',
                            instances: ['record/myInst'],
                        },
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should support custom endpoints', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    },
                });

                customAuthMock.isAuthenticated.mockResolvedValueOnce(true);
                customAuthMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    eraseRecordData(
                        'myToken',
                        'myAddress',
                        false,
                        { endpoint: 'http://localhost:9999' },
                        1
                    ),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'DELETE',
                        'http://localhost:9999/api/v2/records/data',
                        { recordKey: 'myToken', address: 'myAddress' },
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    }),
                ]);
                expect(customAuthMock.isAuthenticated).toBeCalled();
                expect(customAuthMock.authenticate).not.toBeCalled();
                expect(customAuthMock.getAuthToken).toBeCalled();
            });

            it('should make a DELETE request to /api/v2/records/manual/data for manual record data', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    approveAction(
                        eraseRecordData('myToken', 'myAddress', true, {}, 1)
                    ),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'DELETE',
                        'http://localhost:3002/api/v2/records/manual/data',
                        { recordKey: 'myToken', address: 'myAddress' },
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should support custom endpoints for manual record data', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    },
                });

                customAuthMock.isAuthenticated.mockResolvedValueOnce(true);
                customAuthMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    approveAction(
                        eraseRecordData(
                            'myToken',
                            'myAddress',
                            true,
                            { endpoint: 'http://localhost:9999' },
                            1
                        )
                    ),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'DELETE',
                        'http://localhost:9999/api/v2/records/manual/data',
                        { recordKey: 'myToken', address: 'myAddress' },
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    }),
                ]);
                expect(customAuthMock.isAuthenticated).toBeCalled();
                expect(customAuthMock.authenticate).not.toBeCalled();
                expect(customAuthMock.getAuthToken).toBeCalled();
            });

            it('should fail if no recordsOrigin is set', async () => {
                records = new RecordsManager(
                    {
                        version: '1.0.0',
                        versionHash: '1234567890abcdef',
                        recordsOrigin: null,
                    },
                    helper,
                    () => null,
                    () => null
                );

                records.handleEvents([
                    eraseRecordData('myToken', 'myAddress', false, {}, 1),
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: false,
                        errorCode: 'not_supported',
                        errorMessage: 'Records are not supported on this inst.',
                    }),
                ]);
            });

            it('should ignore requests that need approval but are not approved', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    eraseRecordData('myToken', 'myAddress', true, {}, 1),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([]);

                await waitAsync();

                expect(vm.events).toEqual([]);
                expect(authMock.isAuthenticated).not.toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).not.toBeCalled();
            });

            it('should attempt to login in not authenticated', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(false);
                authMock.authenticate.mockResolvedValueOnce({});
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    eraseRecordData('myToken', 'myAddress', false, {}, 1),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'DELETE',
                        'http://localhost:3002/api/v2/records/data',
                        { recordKey: 'myToken', address: 'myAddress' },
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should return not_logged_in if there is no authToken', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(false);
                authMock.authenticate.mockResolvedValueOnce({});
                authMock.getAuthToken.mockResolvedValueOnce(null);
                const recordKey = formatV2RecordKey(
                    'recordName',
                    'secret',
                    'subjectfull'
                );

                records.handleEvents([
                    eraseRecordData(recordKey, 'myAddress', false, {}, 1),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: false,
                        errorCode: 'not_logged_in',
                        errorMessage: 'The user is not logged in.',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should not require login with subjectless keys', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    },
                });
                authMock.getRecordKeyPolicy.mockResolvedValueOnce(
                    'subjectless'
                );
                const recordKey = formatV2RecordKey(
                    'recordName',
                    'secret',
                    'subjectless'
                );

                records.handleEvents([
                    eraseRecordData(recordKey, 'myAddress', false, {}, 1),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'DELETE',
                        'http://localhost:3002/api/v2/records/data',
                        { recordKey: recordKey, address: 'myAddress' },
                        {
                            validateStatus: expect.any(Function),
                            headers: {},
                        },
                    ],
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    }),
                ]);
                expect(authMock.isAuthenticated).not.toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
            });

            it('should support manual records with subjectless keys', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    },
                });
                authMock.getRecordKeyPolicy.mockResolvedValueOnce(
                    'subjectless'
                );
                const recordKey = formatV2RecordKey(
                    'recordName',
                    'secret',
                    'subjectless'
                );

                records.handleEvents([
                    approveAction(
                        eraseRecordData(recordKey, 'myAddress', true, {}, 1)
                    ),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'DELETE',
                        'http://localhost:3002/api/v2/records/manual/data',
                        { recordKey: recordKey, address: 'myAddress' },
                        {
                            validateStatus: expect.any(Function),
                            headers: {},
                        },
                    ],
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    }),
                ]);
                expect(authMock.isAuthenticated).not.toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
            });
        });

        describe('record_file', () => {
            beforeEach(() => {
                require('axios').__reset();
            });

            it('should support strings', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        uploadUrl: 'https://example.com/upload',
                        uploadMethod: 'POST',
                        uploadHeaders: {
                            test: 'abc',
                        },
                        fileName: 'test.txt',
                    },
                });
                setNextResponse({
                    status: 200,
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    recordFile(
                        'myToken',
                        'myFile',
                        'test.txt',
                        undefined,
                        {},
                        1
                    ),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'http://localhost:3002/api/v2/records/file',
                        {
                            recordKey: 'myToken',
                            fileSha256Hex:
                                '7b8478283c88551efc6a8e64248cf6b44aa8be4d06e412eb9e4f66a1771bea50',
                            fileByteLength: 6,
                            fileMimeType: 'text/plain',
                            fileDescription: 'test.txt',
                        },
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'post',
                        'https://example.com/upload',
                        expect.expect('toBeUtf8EncodedText', 'myFile'),
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);
                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        url: 'https://example.com/upload',
                        sha256Hash:
                            '7b8478283c88551efc6a8e64248cf6b44aa8be4d06e412eb9e4f66a1771bea50',
                    }),
                ]);
            });

            it('should use the given mime type for strings', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        uploadUrl: 'https://example.com/upload',
                        uploadMethod: 'POST',
                        uploadHeaders: {
                            test: 'abc',
                        },
                        fileName: 'test.txt',
                    },
                });
                setNextResponse({
                    status: 200,
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    recordFile(
                        'myToken',
                        'myFile',
                        'test.txt',
                        'text/xml',
                        {},
                        1
                    ),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'http://localhost:3002/api/v2/records/file',
                        {
                            recordKey: 'myToken',
                            fileSha256Hex:
                                '7b8478283c88551efc6a8e64248cf6b44aa8be4d06e412eb9e4f66a1771bea50',
                            fileByteLength: 6,
                            fileMimeType: 'text/xml',
                            fileDescription: 'test.txt',
                        },
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'post',
                        'https://example.com/upload',
                        expect.expect('toBeUtf8EncodedText', 'myFile'),
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);
            });

            it('should convert objects to stable JSON', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        uploadUrl: 'https://example.com/upload',
                        uploadMethod: 'POST',
                        uploadHeaders: {
                            test: 'abc',
                        },
                        fileName: 'test.json',
                    },
                });
                setNextResponse({
                    status: 200,
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                const obj = {
                    zyx: 123,
                    abc: {
                        bool: true,
                    },
                };

                const json = stringify(obj);

                records.handleEvents([
                    recordFile('myToken', obj, 'test.json', undefined, {}, 1),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'http://localhost:3002/api/v2/records/file',
                        {
                            recordKey: 'myToken',
                            fileSha256Hex:
                                '8499ab51a0226b4977bbf0549b394225fe12643376782a2bb3d141014de70820',
                            fileByteLength: 31,
                            fileMimeType: 'application/json',
                            fileDescription: 'test.json',
                        },
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'post',
                        'https://example.com/upload',
                        expect.expect('toBeUtf8EncodedText', json),
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);
            });

            it('should use the user provided mime type for objects', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        uploadUrl: 'https://example.com/upload',
                        uploadMethod: 'POST',
                        uploadHeaders: {
                            test: 'abc',
                        },
                        fileName: 'test.json',
                    },
                });
                setNextResponse({
                    status: 200,
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                const obj = {
                    zyx: 123,
                    abc: {
                        bool: true,
                    },
                };

                const json = stringify(obj);

                records.handleEvents([
                    recordFile(
                        'myToken',
                        obj,
                        'test.json',
                        'text/plain',
                        {},
                        1
                    ),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'http://localhost:3002/api/v2/records/file',
                        {
                            recordKey: 'myToken',
                            fileSha256Hex:
                                '8499ab51a0226b4977bbf0549b394225fe12643376782a2bb3d141014de70820',
                            fileByteLength: 31,
                            fileMimeType: 'text/plain',
                            fileDescription: 'test.json',
                        },
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'post',
                        'https://example.com/upload',
                        expect.expect('toBeUtf8EncodedText', json),
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);
            });

            it('should support blob objects', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        uploadUrl: 'https://example.com/upload',
                        uploadMethod: 'POST',
                        uploadHeaders: {
                            test: 'abc',
                        },
                        fileName: 'test.html',
                    },
                });
                setNextResponse({
                    status: 200,
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                const html = '<abc></abc>';
                const blob = new Blob([html], { type: 'text/html' });

                records.handleEvents([
                    recordFile('myToken', blob, 'test.html', undefined, {}, 1),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'http://localhost:3002/api/v2/records/file',
                        {
                            recordKey: 'myToken',
                            fileSha256Hex:
                                '95b50f5aa4106c3872f3ba7a52ae035b5875a729f6a8ab6f02d86c57eda56c0b',
                            fileByteLength: 11,
                            fileMimeType: 'text/html',
                            fileDescription: 'test.html',
                        },
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'post',
                        'https://example.com/upload',
                        expect.expect('toBeUtf8EncodedText', html),
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);
            });

            it('should use the user-provided mime type for blob objects', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        uploadUrl: 'https://example.com/upload',
                        uploadMethod: 'POST',
                        uploadHeaders: {
                            test: 'abc',
                        },
                        fileName: 'test.html',
                    },
                });
                setNextResponse({
                    status: 200,
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                const html = '<abc></abc>';
                const blob = new Blob([html], { type: 'text/html' });

                records.handleEvents([
                    recordFile(
                        'myToken',
                        blob,
                        'test.html',
                        'text/plain',
                        {},
                        1
                    ),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'http://localhost:3002/api/v2/records/file',
                        {
                            recordKey: 'myToken',
                            fileSha256Hex:
                                '95b50f5aa4106c3872f3ba7a52ae035b5875a729f6a8ab6f02d86c57eda56c0b',
                            fileByteLength: 11,
                            fileMimeType: 'text/plain',
                            fileDescription: 'test.html',
                        },
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'post',
                        'https://example.com/upload',
                        expect.expect('toBeUtf8EncodedText', html),
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);
            });

            it('should support objects in the structure of a file from @onFileUpload', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        uploadUrl: 'https://example.com/upload',
                        uploadMethod: 'POST',
                        uploadHeaders: {
                            test: 'abc',
                        },
                        fileName: 'test.html',
                    },
                });
                setNextResponse({
                    status: 200,
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                const buffer = new ArrayBuffer(123);
                const bytes = new Uint8Array(buffer);
                for (let i = 0; i < bytes.length; i++) {
                    bytes[i] = i;
                }

                const file = {
                    name: 'test.zip',
                    size: 15,
                    data: buffer,
                    mimeType: 'application/zip',
                };

                records.handleEvents([
                    recordFile('myToken', file, 'test.html', undefined, {}, 1),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'http://localhost:3002/api/v2/records/file',
                        {
                            recordKey: 'myToken',
                            fileSha256Hex:
                                'cc63be92e3a900cd067da89473b61b40579b54ef54f8305c2ffcc893743792e9',
                            fileByteLength: 123,
                            fileMimeType: 'application/zip',
                            fileDescription: 'test.html',
                        },
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'post',
                        'https://example.com/upload',
                        bytes,
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);
            });

            it('should support objects in the structure of a file from @onFileUpload that contain strings', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        uploadUrl: 'https://example.com/upload',
                        uploadMethod: 'POST',
                        uploadHeaders: {
                            test: 'abc',
                        },
                        fileName: 'test.html',
                    },
                });
                setNextResponse({
                    status: 200,
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                const file = {
                    name: 'test.zip',
                    size: 15,
                    data: 'data',
                    mimeType: 'application/zip',
                };

                records.handleEvents([
                    recordFile('myToken', file, 'test.html', undefined, {}, 1),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'http://localhost:3002/api/v2/records/file',
                        {
                            recordKey: 'myToken',
                            fileSha256Hex:
                                '3a6eb0790f39ac87c94f3856b2dd2c5d110e6811602261a9a923d3bb23adc8b7',
                            fileByteLength: 4,
                            fileMimeType: 'application/zip',
                            fileDescription: 'test.html',
                        },
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'post',
                        'https://example.com/upload',
                        expect.expect('toBeUtf8EncodedText', 'data'),
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);
            });

            it('should use the user-provided mime type for files', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        uploadUrl: 'https://example.com/upload',
                        uploadMethod: 'POST',
                        uploadHeaders: {
                            test: 'abc',
                        },
                        fileName: 'test.html',
                    },
                });
                setNextResponse({
                    status: 200,
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                const buffer = new ArrayBuffer(123);
                const bytes = new Uint8Array(buffer);
                for (let i = 0; i < bytes.length; i++) {
                    bytes[i] = i;
                }

                const file = {
                    name: 'test.zip',
                    size: 15,
                    data: buffer,
                    mimeType: 'application/zip',
                };

                records.handleEvents([
                    recordFile(
                        'myToken',
                        file,
                        'test.html',
                        'application/octet-stream',
                        {},
                        1
                    ),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'http://localhost:3002/api/v2/records/file',
                        {
                            recordKey: 'myToken',
                            fileSha256Hex:
                                'cc63be92e3a900cd067da89473b61b40579b54ef54f8305c2ffcc893743792e9',
                            fileByteLength: 123,
                            fileMimeType: 'application/octet-stream',
                            fileDescription: 'test.html',
                        },
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'post',
                        'https://example.com/upload',
                        bytes,
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);
            });

            it('should support array buffer objects', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        uploadUrl: 'https://example.com/upload',
                        uploadMethod: 'POST',
                        uploadHeaders: {
                            test: 'abc',
                        },
                        fileName: 'test.html',
                    },
                });
                setNextResponse({
                    status: 200,
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                const buffer = new ArrayBuffer(123);
                const bytes = new Uint8Array(buffer);
                for (let i = 0; i < bytes.length; i++) {
                    bytes[i] = i;
                }

                records.handleEvents([
                    recordFile(
                        'myToken',
                        buffer,
                        'test.html',
                        undefined,
                        {},
                        1
                    ),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'http://localhost:3002/api/v2/records/file',
                        {
                            recordKey: 'myToken',
                            fileSha256Hex:
                                'cc63be92e3a900cd067da89473b61b40579b54ef54f8305c2ffcc893743792e9',
                            fileByteLength: 123,
                            fileMimeType: 'application/octet-stream',
                            fileDescription: 'test.html',
                        },
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'post',
                        'https://example.com/upload',
                        bytes,
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);
            });

            it('should use the user-provided mime type for array buffer objects', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        uploadUrl: 'https://example.com/upload',
                        uploadMethod: 'POST',
                        uploadHeaders: {
                            test: 'abc',
                        },
                        fileName: 'test.html',
                    },
                });
                setNextResponse({
                    status: 200,
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                const buffer = new ArrayBuffer(123);
                const bytes = new Uint8Array(buffer);
                for (let i = 0; i < bytes.length; i++) {
                    bytes[i] = i;
                }

                records.handleEvents([
                    recordFile(
                        'myToken',
                        buffer,
                        'test.html',
                        'application/zip',
                        {},
                        1
                    ),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'http://localhost:3002/api/v2/records/file',
                        {
                            recordKey: 'myToken',
                            fileSha256Hex:
                                'cc63be92e3a900cd067da89473b61b40579b54ef54f8305c2ffcc893743792e9',
                            fileByteLength: 123,
                            fileMimeType: 'application/zip',
                            fileDescription: 'test.html',
                        },
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'post',
                        'https://example.com/upload',
                        bytes,
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);
            });

            it('should support typed array objects', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        uploadUrl: 'https://example.com/upload',
                        uploadMethod: 'POST',
                        uploadHeaders: {
                            test: 'abc',
                        },
                        fileName: 'test.html',
                    },
                });
                setNextResponse({
                    status: 200,
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                const buffer = new ArrayBuffer(128);
                const bytes = new Uint8Array(buffer);
                for (let i = 0; i < bytes.length; i++) {
                    bytes[i] = i;
                }
                const doubles = new Float64Array(buffer);

                records.handleEvents([
                    recordFile(
                        'myToken',
                        doubles,
                        'test.html',
                        undefined,
                        {},
                        1
                    ),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'http://localhost:3002/api/v2/records/file',
                        {
                            recordKey: 'myToken',
                            fileSha256Hex:
                                '471fb943aa23c511f6f72f8d1652d9c880cfa392ad80503120547703e56a2be5',
                            fileByteLength: 128,
                            fileMimeType: 'application/octet-stream',
                            fileDescription: 'test.html',
                        },
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'post',
                        'https://example.com/upload',
                        bytes,
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);
            });

            it('should support numbers', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        uploadUrl: 'https://example.com/upload',
                        uploadMethod: 'POST',
                        uploadHeaders: {
                            test: 'abc',
                        },
                        fileName: 'test.html',
                    },
                });
                setNextResponse({
                    status: 200,
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    recordFile('myToken', 10, 'test.html', undefined, {}, 1),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'http://localhost:3002/api/v2/records/file',
                        {
                            recordKey: 'myToken',
                            fileSha256Hex:
                                '4a44dc15364204a80fe80e9039455cc1608281820fe2b24f1e5233ade6af1dd5',
                            fileByteLength: 2,
                            fileMimeType: 'text/plain',
                            fileDescription: 'test.html',
                        },
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'post',
                        'https://example.com/upload',
                        expect.expect('toBeUtf8EncodedText', '10'),
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);
            });

            it('should support booleans', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        uploadUrl: 'https://example.com/upload',
                        uploadMethod: 'POST',
                        uploadHeaders: {
                            test: 'abc',
                        },
                        fileName: 'test.html',
                    },
                });
                setNextResponse({
                    status: 200,
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    recordFile('myToken', true, 'test.html', undefined, {}, 1),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'http://localhost:3002/api/v2/records/file',
                        {
                            recordKey: 'myToken',
                            fileSha256Hex:
                                'b5bea41b6c623f7c09f1bf24dcae58ebab3c0cdd90ad966bc43a45b44867e12b',
                            fileByteLength: 4,
                            fileMimeType: 'text/plain',
                            fileDescription: 'test.html',
                        },
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'post',
                        'https://example.com/upload',
                        expect.expect('toBeUtf8EncodedText', 'true'),
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);
            });

            it('should support custom endpoints', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        uploadUrl: 'https://example.com/upload',
                        uploadMethod: 'POST',
                        uploadHeaders: {
                            test: 'abc',
                        },
                        fileName: 'test.html',
                    },
                });
                setNextResponse({
                    status: 200,
                });

                customAuthMock.isAuthenticated.mockResolvedValueOnce(true);
                customAuthMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    recordFile(
                        'myToken',
                        true,
                        'test.html',
                        undefined,
                        { endpoint: 'http://localhost:9999' },
                        1
                    ),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'http://localhost:9999/api/v2/records/file',
                        {
                            recordKey: 'myToken',
                            fileSha256Hex:
                                'b5bea41b6c623f7c09f1bf24dcae58ebab3c0cdd90ad966bc43a45b44867e12b',
                            fileByteLength: 4,
                            fileMimeType: 'text/plain',
                            fileDescription: 'test.html',
                        },
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'post',
                        'https://example.com/upload',
                        expect.expect('toBeUtf8EncodedText', 'true'),
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);
            });

            const invalidDataCases = [
                [
                    'a function',
                    function abc() {},
                    'Function instances cannot be stored in files.',
                ],
                [
                    'undefined',
                    undefined,
                    'Null or undefined values cannot be stored in files.',
                ],
                [
                    'null',
                    null,
                    'Null or undefined values cannot be stored in files.',
                ],
            ];

            it.each(invalidDataCases)(
                'should return an error if given %s',
                async (desc, value, message) => {
                    setNextResponse({
                        data: {
                            success: true,
                            uploadUrl: 'https://example.com/upload',
                            uploadMethod: 'POST',
                            uploadHeaders: {
                                test: 'abc',
                            },
                            fileName: 'test.html',
                        },
                    });
                    setNextResponse({
                        status: 200,
                    });

                    authMock.isAuthenticated.mockResolvedValueOnce(true);
                    authMock.getAuthToken.mockResolvedValueOnce('authToken');

                    records.handleEvents([
                        recordFile(
                            'myToken',
                            value,
                            'test.html',
                            undefined,
                            {},
                            1
                        ),
                    ]);

                    await waitAsync();

                    expect(getRequests()).toEqual([]);
                    expect(vm.events).toEqual([
                        asyncResult(1, {
                            success: false,
                            errorCode: 'invalid_file_data',
                            errorMessage: message,
                        }),
                    ]);
                }
            );

            it('should include the URL if the file already exists', async () => {
                setNextResponse({
                    data: {
                        success: false,
                        errorCode: 'file_already_exists',
                        errorMessage: 'The file already exists.',
                        existingFileUrl: 'https://example.com/existing',
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    recordFile('myToken', true, 'test.html', undefined, {}, 1),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'http://localhost:3002/api/v2/records/file',
                        {
                            recordKey: 'myToken',
                            fileSha256Hex:
                                'b5bea41b6c623f7c09f1bf24dcae58ebab3c0cdd90ad966bc43a45b44867e12b',
                            fileByteLength: 4,
                            fileMimeType: 'text/plain',
                            fileDescription: 'test.html',
                        },
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                ]);

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: false,
                        errorCode: 'file_already_exists',
                        errorMessage: 'The file already exists.',
                        existingFileUrl: 'https://example.com/existing',
                    }),
                ]);
            });

            const unsafeHeaders = [
                ['accept-encoding'],
                ['referer'],
                ['sec-fetch-dest'],
                ['sec-fetch-mode'],
                ['sec-fetch-site'],
                ['origin'],
                ['sec-ch-ua-platform'],
                ['user-agent'],
                ['sec-ch-ua-mobile'],
                ['sec-ch-ua'],
                ['content-length'],
                ['connection'],
                ['host'],
            ];

            describe('unsafe headers', () => {
                it.each(unsafeHeaders)(
                    'should not send %s in the upload request headers',
                    async (header) => {
                        setNextResponse({
                            data: {
                                success: true,
                                uploadUrl: 'https://example.com/upload',
                                uploadMethod: 'POST',
                                uploadHeaders: {
                                    [header]: 'abc',
                                },
                                fileName: 'test.html',
                            },
                        });
                        setNextResponse({
                            status: 200,
                        });

                        authMock.isAuthenticated.mockResolvedValueOnce(true);
                        authMock.getAuthToken.mockResolvedValueOnce(
                            'authToken'
                        );

                        records.handleEvents([
                            recordFile(
                                'myToken',
                                true,
                                'test.html',
                                undefined,
                                {},
                                1
                            ),
                        ]);

                        await waitAsync();

                        expect(getRequests()).toEqual([
                            [
                                'post',
                                'http://localhost:3002/api/v2/records/file',
                                {
                                    recordKey: 'myToken',
                                    fileSha256Hex:
                                        'b5bea41b6c623f7c09f1bf24dcae58ebab3c0cdd90ad966bc43a45b44867e12b',
                                    fileByteLength: 4,
                                    fileMimeType: 'text/plain',
                                    fileDescription: 'test.html',
                                },
                                {
                                    validateStatus: expect.any(Function),
                                    headers: {
                                        Authorization: 'Bearer authToken',
                                    },
                                },
                            ],
                            [
                                'post',
                                'https://example.com/upload',
                                expect.expect('toBeUtf8EncodedText', 'true'),
                                {
                                    validateStatus: expect.any(Function),
                                    headers: {},
                                },
                            ],
                        ]);
                    }
                );
            });

            it('should attempt to login if not authenticated', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        uploadUrl: 'https://example.com/upload',
                        uploadMethod: 'POST',
                        uploadHeaders: {
                            test: 'abc',
                        },
                        fileName: 'test.html',
                    },
                });
                setNextResponse({
                    status: 200,
                });

                authMock.isAuthenticated.mockResolvedValueOnce(false);
                authMock.authenticate.mockResolvedValueOnce({});
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    recordFile('myToken', true, 'test.html', undefined, {}, 1),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'http://localhost:3002/api/v2/records/file',
                        {
                            recordKey: 'myToken',
                            fileSha256Hex:
                                'b5bea41b6c623f7c09f1bf24dcae58ebab3c0cdd90ad966bc43a45b44867e12b',
                            fileByteLength: 4,
                            fileMimeType: 'text/plain',
                            fileDescription: 'test.html',
                        },
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'post',
                        'https://example.com/upload',
                        expect.expect('toBeUtf8EncodedText', 'true'),
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        url: 'https://example.com/upload',
                        sha256Hash:
                            'b5bea41b6c623f7c09f1bf24dcae58ebab3c0cdd90ad966bc43a45b44867e12b',
                    }),
                ]);

                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should return not_logged_in if there is no authToken', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        uploadUrl: 'https://example.com/upload',
                        uploadMethod: 'POST',
                        uploadHeaders: {
                            test: 'abc',
                        },
                        fileName: 'test.html',
                    },
                });
                setNextResponse({
                    status: 200,
                });

                authMock.isAuthenticated.mockResolvedValueOnce(false);
                authMock.authenticate.mockResolvedValueOnce({});
                authMock.getAuthToken.mockResolvedValueOnce(null);
                const recordKey = formatV2RecordKey(
                    'recordName',
                    'secret',
                    'subjectfull'
                );

                records.handleEvents([
                    recordFile(recordKey, true, 'test.html', undefined, {}, 1),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([]);
                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: false,
                        errorCode: 'not_logged_in',
                        errorMessage: 'The user is not logged in.',
                    }),
                ]);

                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should not login if using a subjectless token', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        uploadUrl: 'https://example.com/upload',
                        uploadMethod: 'POST',
                        uploadHeaders: {
                            test: 'abc',
                        },
                        fileName: 'test.html',
                    },
                });
                setNextResponse({
                    status: 200,
                });

                authMock.isAuthenticated.mockResolvedValueOnce(false);
                authMock.authenticate.mockResolvedValueOnce({});
                authMock.getAuthToken.mockResolvedValueOnce(null);
                authMock.getRecordKeyPolicy.mockResolvedValueOnce(
                    'subjectless'
                );
                const recordKey = formatV2RecordKey(
                    'recordName',
                    'secret',
                    'subjectless'
                );

                records.handleEvents([
                    recordFile(recordKey, true, 'test.html', undefined, {}, 1),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'http://localhost:3002/api/v2/records/file',
                        {
                            recordKey: recordKey,
                            fileSha256Hex:
                                'b5bea41b6c623f7c09f1bf24dcae58ebab3c0cdd90ad966bc43a45b44867e12b',
                            fileByteLength: 4,
                            fileMimeType: 'text/plain',
                            fileDescription: 'test.html',
                        },
                        {
                            validateStatus: expect.any(Function),
                            headers: {},
                        },
                    ],
                    [
                        'post',
                        'https://example.com/upload',
                        expect.expect('toBeUtf8EncodedText', 'true'),
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        url: 'https://example.com/upload',
                        sha256Hash:
                            'b5bea41b6c623f7c09f1bf24dcae58ebab3c0cdd90ad966bc43a45b44867e12b',
                    }),
                ]);
                expect(authMock.isAuthenticated).not.toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
            });

            it('should include the inst', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        uploadUrl: 'https://example.com/upload',
                        uploadMethod: 'POST',
                        uploadHeaders: {
                            test: 'abc',
                        },
                        fileName: 'test.txt',
                    },
                });
                setNextResponse({
                    status: 200,
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: null,
                    inst: 'myInst',
                };

                records.handleEvents([
                    recordFile(
                        'myToken',
                        'myFile',
                        'test.txt',
                        undefined,
                        {},
                        1
                    ),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'http://localhost:3002/api/v2/records/file',
                        {
                            recordKey: 'myToken',
                            fileSha256Hex:
                                '7b8478283c88551efc6a8e64248cf6b44aa8be4d06e412eb9e4f66a1771bea50',
                            fileByteLength: 6,
                            fileMimeType: 'text/plain',
                            fileDescription: 'test.txt',
                            instances: ['/myInst'],
                        },
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'post',
                        'https://example.com/upload',
                        expect.expect('toBeUtf8EncodedText', 'myFile'),
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);
                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        url: 'https://example.com/upload',
                        sha256Hash:
                            '7b8478283c88551efc6a8e64248cf6b44aa8be4d06e412eb9e4f66a1771bea50',
                    }),
                ]);
            });

            it('should not include the inst if it is static', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        uploadUrl: 'https://example.com/upload',
                        uploadMethod: 'POST',
                        uploadHeaders: {
                            test: 'abc',
                        },
                        fileName: 'test.txt',
                    },
                });
                setNextResponse({
                    status: 200,
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: null,
                    inst: 'myInst',
                    isStatic: true,
                };

                records.handleEvents([
                    recordFile(
                        'myToken',
                        'myFile',
                        'test.txt',
                        undefined,
                        {},
                        1
                    ),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'http://localhost:3002/api/v2/records/file',
                        {
                            recordKey: 'myToken',
                            fileSha256Hex:
                                '7b8478283c88551efc6a8e64248cf6b44aa8be4d06e412eb9e4f66a1771bea50',
                            fileByteLength: 6,
                            fileMimeType: 'text/plain',
                            fileDescription: 'test.txt',
                        },
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'post',
                        'https://example.com/upload',
                        expect.expect('toBeUtf8EncodedText', 'myFile'),
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);
                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        url: 'https://example.com/upload',
                        sha256Hash:
                            '7b8478283c88551efc6a8e64248cf6b44aa8be4d06e412eb9e4f66a1771bea50',
                    }),
                ]);
            });

            it('should support records', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        uploadUrl: 'https://example.com/upload',
                        uploadMethod: 'POST',
                        uploadHeaders: {
                            test: 'abc',
                        },
                        fileName: 'test.txt',
                    },
                });
                setNextResponse({
                    status: 200,
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: 'record',
                    inst: 'myInst',
                };

                records.handleEvents([
                    recordFile(
                        'myToken',
                        'myFile',
                        'test.txt',
                        undefined,
                        {},
                        1
                    ),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'http://localhost:3002/api/v2/records/file',
                        {
                            recordKey: 'myToken',
                            fileSha256Hex:
                                '7b8478283c88551efc6a8e64248cf6b44aa8be4d06e412eb9e4f66a1771bea50',
                            fileByteLength: 6,
                            fileMimeType: 'text/plain',
                            fileDescription: 'test.txt',
                            instances: ['record/myInst'],
                        },
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'post',
                        'https://example.com/upload',
                        expect.expect('toBeUtf8EncodedText', 'myFile'),
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);
                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        url: 'https://example.com/upload',
                        sha256Hash:
                            '7b8478283c88551efc6a8e64248cf6b44aa8be4d06e412eb9e4f66a1771bea50',
                    }),
                ]);
            });

            it('should include the markers', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        uploadUrl: 'https://example.com/upload',
                        uploadMethod: 'POST',
                        uploadHeaders: {
                            test: 'abc',
                        },
                        fileName: 'test.txt',
                    },
                });
                setNextResponse({
                    status: 200,
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    recordFile(
                        'myToken',
                        'myFile',
                        'test.txt',
                        undefined,
                        { markers: ['test1', 'test2'] },
                        1
                    ),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'http://localhost:3002/api/v2/records/file',
                        {
                            recordKey: 'myToken',
                            fileSha256Hex:
                                '7b8478283c88551efc6a8e64248cf6b44aa8be4d06e412eb9e4f66a1771bea50',
                            fileByteLength: 6,
                            fileMimeType: 'text/plain',
                            fileDescription: 'test.txt',
                            markers: ['test1', 'test2'],
                        },
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'post',
                        'https://example.com/upload',
                        expect.expect('toBeUtf8EncodedText', 'myFile'),
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);
                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        url: 'https://example.com/upload',
                        sha256Hash:
                            '7b8478283c88551efc6a8e64248cf6b44aa8be4d06e412eb9e4f66a1771bea50',
                    }),
                ]);
            });
        });

        describe('get_file', () => {
            beforeEach(() => {
                require('axios').__reset();
            });

            it('should make a GET request to /api/v2/records/file', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        requestUrl: 'https://example.com/file',
                        requestMethod: 'GET',
                        requestHeaders: {
                            test: 'abc',
                        },
                    },
                });
                setNextResponse({
                    status: 200,
                    data: 'Hello, world!',
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([getFile('myFileUrl', {}, 1)]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'get',
                        'http://localhost:3002/api/v2/records/file?fileUrl=myFileUrl',
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'GET',
                        'https://example.com/file',
                        undefined,
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);

                await waitAsync();

                expect(vm.events).toEqual([asyncResult(1, 'Hello, world!')]);
                expect(authMock.isAuthenticated).not.toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should include the inst', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        requestUrl: 'https://example.com/file',
                        requestMethod: 'GET',
                        requestHeaders: {
                            test: 'abc',
                        },
                    },
                });
                setNextResponse({
                    status: 200,
                    data: 'Hello, world!',
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: null,
                    inst: 'myInst',
                };

                records.handleEvents([getFile('myFileUrl', {}, 1)]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'get',
                        'http://localhost:3002/api/v2/records/file?fileUrl=myFileUrl&instances=%2FmyInst',
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'GET',
                        'https://example.com/file',
                        undefined,
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);

                await waitAsync();

                expect(vm.events).toEqual([asyncResult(1, 'Hello, world!')]);
                expect(authMock.isAuthenticated).not.toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should not include the inst if it is static', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        requestUrl: 'https://example.com/file',
                        requestMethod: 'GET',
                        requestHeaders: {
                            test: 'abc',
                        },
                    },
                });
                setNextResponse({
                    status: 200,
                    data: 'Hello, world!',
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: null,
                    inst: 'myInst',
                    isStatic: true,
                };

                records.handleEvents([getFile('myFileUrl', {}, 1)]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'get',
                        'http://localhost:3002/api/v2/records/file?fileUrl=myFileUrl',
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'GET',
                        'https://example.com/file',
                        undefined,
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);

                await waitAsync();

                expect(vm.events).toEqual([asyncResult(1, 'Hello, world!')]);
                expect(authMock.isAuthenticated).not.toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should support record names', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        requestUrl: 'https://example.com/file',
                        requestMethod: 'GET',
                        requestHeaders: {
                            test: 'abc',
                        },
                    },
                });
                setNextResponse({
                    status: 200,
                    data: 'Hello, world!',
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: 'record',
                    inst: 'myInst',
                };

                records.handleEvents([getFile('myFileUrl', {}, 1)]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'get',
                        'http://localhost:3002/api/v2/records/file?fileUrl=myFileUrl&instances=record%2FmyInst',
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'GET',
                        'https://example.com/file',
                        undefined,
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);

                await waitAsync();

                expect(vm.events).toEqual([asyncResult(1, 'Hello, world!')]);
                expect(authMock.isAuthenticated).not.toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should support custom endpoints', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        requestUrl: 'https://example.com/file',
                        requestMethod: 'GET',
                        requestHeaders: {
                            test: 'abc',
                        },
                    },
                });
                setNextResponse({
                    status: 200,
                    data: 'Hello, world!',
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    getFile(
                        'myFileUrl',
                        {
                            endpoint: 'http://localhost:9999',
                        },
                        1
                    ),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'get',
                        'http://localhost:9999/api/v2/records/file?fileUrl=myFileUrl',
                        {
                            validateStatus: expect.any(Function),
                            headers: {},
                        },
                    ],
                    [
                        'GET',
                        'https://example.com/file',
                        undefined,
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);

                await waitAsync();

                expect(vm.events).toEqual([asyncResult(1, 'Hello, world!')]);
                expect(authMock.isAuthenticated).not.toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).not.toBeCalled();
            });

            it('should not attempt to login if not authenticated', async () => {
                setResponse({
                    data: {
                        success: false,
                        errorCode: 'not_logged_in',
                        errorMessage: 'The user is not logged in.',
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(false);
                authMock.authenticate.mockResolvedValueOnce({});
                authMock.getAuthToken.mockResolvedValueOnce(null);

                records.handleEvents([getFile('myFileUrl', {}, 1)]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'get',
                        'http://localhost:3002/api/v2/records/file?fileUrl=myFileUrl',
                        {
                            validateStatus: expect.any(Function),
                            headers: {},
                        },
                    ],
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncError(1, {
                        success: false,
                        errorCode: 'not_logged_in',
                        errorMessage: 'The user is not logged in.',
                    }),
                ]);
                expect(authMock.isAuthenticated).not.toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });
        });

        describe('erase_file', () => {
            beforeEach(() => {
                require('axios').__reset();
            });

            it('should make a DELETE request to /api/v2/records/file', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        fileName: 'myFile',
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    eraseFile('myToken', 'myFileUrl', {}, 1),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'DELETE',
                        'http://localhost:3002/api/v2/records/file',
                        { recordKey: 'myToken', fileUrl: 'myFileUrl' },
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        fileName: 'myFile',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should include the inst', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        fileName: 'myFile',
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: null,
                    inst: 'myInst',
                };

                records.handleEvents([
                    eraseFile('myToken', 'myFileUrl', {}, 1),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'DELETE',
                        'http://localhost:3002/api/v2/records/file',
                        {
                            recordKey: 'myToken',
                            fileUrl: 'myFileUrl',
                            instances: ['/myInst'],
                        },
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        fileName: 'myFile',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should not include the inst if it is static', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        fileName: 'myFile',
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: null,
                    inst: 'myInst',
                    isStatic: true,
                };

                records.handleEvents([
                    eraseFile('myToken', 'myFileUrl', {}, 1),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'DELETE',
                        'http://localhost:3002/api/v2/records/file',
                        {
                            recordKey: 'myToken',
                            fileUrl: 'myFileUrl',
                        },
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        fileName: 'myFile',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should support record names', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        fileName: 'myFile',
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: 'record',
                    inst: 'myInst',
                };

                records.handleEvents([
                    eraseFile('myToken', 'myFileUrl', {}, 1),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'DELETE',
                        'http://localhost:3002/api/v2/records/file',
                        {
                            recordKey: 'myToken',
                            fileUrl: 'myFileUrl',
                            instances: ['record/myInst'],
                        },
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        fileName: 'myFile',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should support custom endpoints', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        fileName: 'myFile',
                    },
                });

                customAuthMock.isAuthenticated.mockResolvedValueOnce(true);
                customAuthMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    eraseFile(
                        'myToken',
                        'myFileUrl',
                        { endpoint: 'http://localhost:9999' },
                        1
                    ),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'DELETE',
                        'http://localhost:9999/api/v2/records/file',
                        { recordKey: 'myToken', fileUrl: 'myFileUrl' },
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        fileName: 'myFile',
                    }),
                ]);
                expect(customAuthMock.isAuthenticated).toBeCalled();
                expect(customAuthMock.authenticate).not.toBeCalled();
                expect(customAuthMock.getAuthToken).toBeCalled();
            });

            it('should attempt to login if not authenticated', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        fileName: 'myFile',
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(false);
                authMock.authenticate.mockResolvedValueOnce({});
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    eraseFile('myToken', 'myFileUrl', {}, 1),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'DELETE',
                        'http://localhost:3002/api/v2/records/file',
                        { recordKey: 'myToken', fileUrl: 'myFileUrl' },
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        fileName: 'myFile',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should return not_logged_in if there is no authToken', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        fileName: 'myFile',
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(false);
                authMock.authenticate.mockResolvedValueOnce({});
                authMock.getAuthToken.mockResolvedValueOnce(null);
                const recordKey = formatV2RecordKey(
                    'recordName',
                    'secret',
                    'subjectfull'
                );

                records.handleEvents([
                    eraseFile(recordKey, 'myFileUrl', {}, 1),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: false,
                        errorCode: 'not_logged_in',
                        errorMessage: 'The user is not logged in.',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should support subjectless tokens', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        fileName: 'myFile',
                    },
                });

                authMock.getRecordKeyPolicy.mockResolvedValueOnce(
                    'subjectless'
                );
                authMock.isAuthenticated.mockResolvedValueOnce(false);
                authMock.authenticate.mockResolvedValueOnce({});
                authMock.getAuthToken.mockResolvedValueOnce(null);
                const recordKey = formatV2RecordKey(
                    'recordName',
                    'secret',
                    'subjectless'
                );

                records.handleEvents([
                    eraseFile(recordKey, 'myFileUrl', {}, 1),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'DELETE',
                        'http://localhost:3002/api/v2/records/file',
                        { recordKey: recordKey, fileUrl: 'myFileUrl' },
                        {
                            validateStatus: expect.any(Function),
                            headers: {},
                        },
                    ],
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        fileName: 'myFile',
                    }),
                ]);
                expect(authMock.isAuthenticated).not.toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
            });
        });

        describe('record_event', () => {
            beforeEach(() => {
                require('axios').__reset();
            });

            it('should make a POST request to /api/v2/records/events/count', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        eventName: 'testEvent',
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    recordEvent('recordKey', 'eventName', 10, {}, 1),
                ]);

                await waitAsync();

                expect(getLastPost()).toEqual([
                    'http://localhost:3002/api/v2/records/events/count',
                    {
                        recordKey: 'recordKey',
                        eventName: 'eventName',
                        count: 10,
                    },
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        eventName: 'testEvent',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should include the inst', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        eventName: 'testEvent',
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: null,
                    inst: 'myInst',
                };

                records.handleEvents([
                    recordEvent('recordKey', 'eventName', 10, {}, 1),
                ]);

                await waitAsync();

                expect(getLastPost()).toEqual([
                    'http://localhost:3002/api/v2/records/events/count',
                    {
                        recordKey: 'recordKey',
                        eventName: 'eventName',
                        count: 10,
                        instances: ['/myInst'],
                    },
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        eventName: 'testEvent',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should not include the inst if it is static', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        eventName: 'testEvent',
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: null,
                    inst: 'myInst',
                    isStatic: true,
                };

                records.handleEvents([
                    recordEvent('recordKey', 'eventName', 10, {}, 1),
                ]);

                await waitAsync();

                expect(getLastPost()).toEqual([
                    'http://localhost:3002/api/v2/records/events/count',
                    {
                        recordKey: 'recordKey',
                        eventName: 'eventName',
                        count: 10,
                    },
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        eventName: 'testEvent',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should support record names', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        eventName: 'testEvent',
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: 'record',
                    inst: 'myInst',
                };

                records.handleEvents([
                    recordEvent('recordKey', 'eventName', 10, {}, 1),
                ]);

                await waitAsync();

                expect(getLastPost()).toEqual([
                    'http://localhost:3002/api/v2/records/events/count',
                    {
                        recordKey: 'recordKey',
                        eventName: 'eventName',
                        count: 10,
                        instances: ['record/myInst'],
                    },
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        eventName: 'testEvent',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should support custom endpoints', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        eventName: 'testEvent',
                    },
                });

                customAuthMock.isAuthenticated.mockResolvedValueOnce(true);
                customAuthMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    recordEvent(
                        'recordKey',
                        'eventName',
                        10,
                        { endpoint: 'http://localhost:9999' },
                        1
                    ),
                ]);

                await waitAsync();

                expect(getLastPost()).toEqual([
                    'http://localhost:9999/api/v2/records/events/count',
                    {
                        recordKey: 'recordKey',
                        eventName: 'eventName',
                        count: 10,
                    },
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        eventName: 'testEvent',
                    }),
                ]);
                expect(customAuthMock.isAuthenticated).toBeCalled();
                expect(customAuthMock.authenticate).not.toBeCalled();
                expect(customAuthMock.getAuthToken).toBeCalled();
            });

            it('should login if not authenticated', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        eventName: 'testEvent',
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(false);
                authMock.authenticate.mockResolvedValueOnce({});
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    recordEvent('recordKey', 'eventName', 10, {}, 1),
                ]);

                await waitAsync();

                expect(getLastPost()).toEqual([
                    'http://localhost:3002/api/v2/records/events/count',
                    {
                        recordKey: 'recordKey',
                        eventName: 'eventName',
                        count: 10,
                    },
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        eventName: 'testEvent',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should return not_logged_in if there is no authToken', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        eventName: 'testEvent',
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(false);
                authMock.authenticate.mockResolvedValueOnce({});
                authMock.getAuthToken.mockResolvedValueOnce(null);
                const recordKey = formatV2RecordKey(
                    'recordName',
                    'secret',
                    'subjectfull'
                );

                records.handleEvents([
                    recordEvent(recordKey, 'eventName', 10, {}, 1),
                ]);

                await waitAsync();

                expect(getLastPost()).toEqual(undefined);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: false,
                        errorCode: 'not_logged_in',
                        errorMessage: 'The user is not logged in.',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should support subjectless keys', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        eventName: 'testEvent',
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(false);
                authMock.authenticate.mockResolvedValueOnce({});
                authMock.getAuthToken.mockResolvedValueOnce(null);
                authMock.getRecordKeyPolicy.mockResolvedValueOnce(
                    'subjectless'
                );
                const recordKey = formatV2RecordKey(
                    'recordName',
                    'secret',
                    'subjectless'
                );

                records.handleEvents([
                    recordEvent(recordKey, 'eventName', 10, {}, 1),
                ]);

                await waitAsync();

                expect(getLastPost()).toEqual([
                    'http://localhost:3002/api/v2/records/events/count',
                    {
                        recordKey: recordKey,
                        eventName: 'eventName',
                        count: 10,
                    },
                    {
                        validateStatus: expect.any(Function),
                        headers: {},
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        eventName: 'testEvent',
                    }),
                ]);
                expect(authMock.isAuthenticated).not.toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
            });
        });

        describe('get_event_count', () => {
            beforeEach(() => {
                require('axios').__reset();
            });

            it('should make a GET request to /api/v2/records/events/count', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        eventName: 'testEvent',
                        count: 10,
                    },
                });

                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    getEventCount('testRecord', 'myAddress', {}, 1),
                ]);

                await waitAsync();

                expect(getLastGet()).toEqual([
                    'http://localhost:3002/api/v2/records/events/count?recordName=testRecord&eventName=myAddress',
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        eventName: 'testEvent',
                        count: 10,
                    }),
                ]);
            });

            it('should not include the Authorization header if the user is not logged in', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        eventName: 'testEvent',
                        count: 10,
                    },
                });

                authMock.getAuthToken.mockResolvedValueOnce(null);

                records.handleEvents([
                    getEventCount('testRecord', 'myAddress', {}, 1),
                ]);

                await waitAsync();

                expect(getLastGet()).toEqual([
                    'http://localhost:3002/api/v2/records/events/count?recordName=testRecord&eventName=myAddress',
                    {
                        validateStatus: expect.any(Function),
                        headers: {},
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        eventName: 'testEvent',
                        count: 10,
                    }),
                ]);
            });

            it('should include the inst', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        eventName: 'testEvent',
                        count: 10,
                    },
                });

                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: null,
                    inst: 'myInst',
                };

                records.handleEvents([
                    getEventCount('testRecord', 'myAddress', {}, 1),
                ]);

                await waitAsync();

                expect(getLastGet()).toEqual([
                    'http://localhost:3002/api/v2/records/events/count?recordName=testRecord&eventName=myAddress&instances=%2FmyInst',
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        eventName: 'testEvent',
                        count: 10,
                    }),
                ]);
            });

            it('should not include the inst if it is static', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        eventName: 'testEvent',
                        count: 10,
                    },
                });

                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: null,
                    inst: 'myInst',
                    isStatic: true,
                };

                records.handleEvents([
                    getEventCount('testRecord', 'myAddress', {}, 1),
                ]);

                await waitAsync();

                expect(getLastGet()).toEqual([
                    'http://localhost:3002/api/v2/records/events/count?recordName=testRecord&eventName=myAddress',
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        eventName: 'testEvent',
                        count: 10,
                    }),
                ]);
            });

            it('should support record names', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        eventName: 'testEvent',
                        count: 10,
                    },
                });

                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: 'record',
                    inst: 'myInst',
                };

                records.handleEvents([
                    getEventCount('testRecord', 'myAddress', {}, 1),
                ]);

                await waitAsync();

                expect(getLastGet()).toEqual([
                    'http://localhost:3002/api/v2/records/events/count?recordName=testRecord&eventName=myAddress&instances=record%2FmyInst',
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        eventName: 'testEvent',
                        count: 10,
                    }),
                ]);
            });

            it('should fail if no recordsOrigin is set', async () => {
                records = new RecordsManager(
                    {
                        version: '1.0.0',
                        versionHash: '1234567890abcdef',
                    },
                    helper,
                    () => null,
                    () => null
                );

                records.handleEvents([
                    getEventCount('testRecord', 'myAddress', {}, 1),
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: false,
                        errorCode: 'not_supported',
                        errorMessage: 'Records are not supported on this inst.',
                    }),
                ]);
            });

            it('should support custom endpoints', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        eventName: 'testEvent',
                        count: 10,
                    },
                });

                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    getEventCount(
                        'testRecord',
                        'myAddress',
                        { endpoint: 'http://localhost:9999' },
                        1
                    ),
                ]);

                await waitAsync();

                expect(getLastGet()).toEqual([
                    'http://localhost:9999/api/v2/records/events/count?recordName=testRecord&eventName=myAddress',
                    { validateStatus: expect.any(Function), headers: {} },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        eventName: 'testEvent',
                        count: 10,
                    }),
                ]);
            });
        });

        describe('join_room', () => {
            beforeEach(() => {
                require('axios').__reset();
            });

            it('should make a POST request to /api/v2/meet/token', async () => {
                setResponse({
                    data: {
                        success: true,
                        roomName: 'myRoom',
                        token: 'mytoken',
                        url: 'url',
                    },
                });

                let events = [] as RoomJoin[];
                records.onRoomJoin.subscribe((e) => events.push(e));

                records.handleEvents([joinRoom('myRoom', {}, 1)]);

                await waitAsync();

                expect(getLastPost()).toEqual([
                    'http://localhost:3002/api/v2/meet/token',
                    { roomName: 'myRoom', userName: 'userId' },
                    {
                        validateStatus: expect.any(Function),
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([]);

                expect(events).toEqual([
                    {
                        roomName: 'myRoom',
                        token: 'mytoken',
                        url: 'url',
                        options: {},
                        resolve: expect.any(Function),
                        reject: expect.any(Function),
                    },
                ]);

                events[0].resolve({
                    video: true,
                    audio: false,
                    screen: false,
                });

                await waitAsync();
                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        roomName: 'myRoom',
                        options: {
                            video: true,
                            audio: false,
                            screen: false,
                        },
                    }),
                ]);
            });

            it('should return an unsuccessful result if the join room event is rejected', async () => {
                setResponse({
                    data: {
                        success: true,
                        roomName: 'myRoom',
                        token: 'mytoken',
                    },
                });

                let events = [] as RoomJoin[];
                records.onRoomJoin.subscribe((e) => events.push(e));

                records.handleEvents([joinRoom('myRoom', {}, 1)]);

                await waitAsync();

                expect(getLastPost()).toEqual([
                    'http://localhost:3002/api/v2/meet/token',
                    { roomName: 'myRoom', userName: 'userId' },
                    {
                        validateStatus: expect.any(Function),
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([]);

                expect(events).toEqual([
                    {
                        roomName: 'myRoom',
                        token: 'mytoken',
                        options: {},
                        resolve: expect.any(Function),
                        reject: expect.any(Function),
                    },
                ]);

                events[0].reject('error', 'Could not join room.');

                await waitAsync();
                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: false,
                        roomName: 'myRoom',
                        errorCode: 'error',
                        errorMessage: 'Could not join room.',
                    }),
                ]);
            });

            it('should fail if no recordsOrigin is set', async () => {
                records = new RecordsManager(
                    {
                        version: '1.0.0',
                        versionHash: '1234567890abcdef',
                    },
                    helper,
                    () => null,
                    () => null
                );

                records.handleEvents([joinRoom('myRoom', {}, 1)]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: false,
                        errorCode: 'not_supported',
                        errorMessage: 'Records are not supported on this inst.',
                    }),
                ]);
            });

            it('should support custom endpoints', async () => {
                setResponse({
                    data: {
                        success: true,
                        roomName: 'myRoom',
                        token: 'mytoken',
                        url: 'url',
                    },
                });

                let events = [] as RoomJoin[];
                records.onRoomJoin.subscribe((e) => events.push(e));

                records.handleEvents([
                    joinRoom(
                        'myRoom',
                        { endpoint: 'http://localhost:9999' },
                        1
                    ),
                ]);

                await waitAsync();

                expect(getLastPost()).toEqual([
                    'http://localhost:9999/api/v2/meet/token',
                    { roomName: 'myRoom', userName: 'userId' },
                    {
                        validateStatus: expect.any(Function),
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([]);

                expect(events).toEqual([
                    {
                        roomName: 'myRoom',
                        token: 'mytoken',
                        url: 'url',
                        options: { endpoint: 'http://localhost:9999' },
                        resolve: expect.any(Function),
                        reject: expect.any(Function),
                    },
                ]);

                events[0].resolve({
                    video: true,
                    audio: false,
                    screen: false,
                });

                await waitAsync();
                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        roomName: 'myRoom',
                        options: {
                            video: true,
                            audio: false,
                            screen: false,
                        },
                    }),
                ]);
            });
        });

        describe('leave_room', () => {
            beforeEach(() => {
                require('axios').__reset();
            });

            it('should emit a onRoomLeave event', async () => {
                let events = [] as RoomLeave[];
                records.onRoomLeave.subscribe((e) => events.push(e));

                records.handleEvents([leaveRoom('myRoom', {}, 1)]);

                await waitAsync();

                expect(vm.events).toEqual([]);

                expect(events).toEqual([
                    {
                        roomName: 'myRoom',
                        resolve: expect.any(Function),
                        reject: expect.any(Function),
                    },
                ]);

                events[0].resolve();

                await waitAsync();
                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        roomName: 'myRoom',
                    }),
                ]);
            });

            it('should return an unsuccessful result if the join room event is rejected', async () => {
                let events = [] as RoomLeave[];
                records.onRoomLeave.subscribe((e) => events.push(e));

                records.handleEvents([leaveRoom('myRoom', {}, 1)]);

                await waitAsync();

                expect(vm.events).toEqual([]);

                expect(events).toEqual([
                    {
                        roomName: 'myRoom',
                        resolve: expect.any(Function),
                        reject: expect.any(Function),
                    },
                ]);

                events[0].reject('error', 'Could not leave room.');

                await waitAsync();
                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: false,
                        roomName: 'myRoom',
                        errorCode: 'error',
                        errorMessage: 'Could not leave room.',
                    }),
                ]);
            });

            it('should work if no recordsOrigin is set', async () => {
                records = new RecordsManager(
                    {
                        version: '1.0.0',
                        versionHash: '1234567890abcdef',
                    },
                    helper,
                    () => null,
                    () => null
                );

                let events = [] as RoomLeave[];
                records.onRoomLeave.subscribe((e) => events.push(e));

                records.handleEvents([leaveRoom('myRoom', {}, 1)]);

                await waitAsync();

                expect(vm.events).toEqual([]);

                expect(events).toEqual([
                    {
                        roomName: 'myRoom',
                        resolve: expect.any(Function),
                        reject: expect.any(Function),
                    },
                ]);

                events[0].reject('error', 'Could not leave room.');

                await waitAsync();
                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: false,
                        roomName: 'myRoom',
                        errorCode: 'error',
                        errorMessage: 'Could not leave room.',
                    }),
                ]);
            });
        });

        describe('set_room_options', () => {
            it('should emit a onSetRoomOptions event', async () => {
                let events = [] as SetRoomOptions[];
                records.onSetRoomOptions.subscribe((e) => events.push(e));

                records.handleEvents([
                    setRoomOptions(
                        'myRoom',
                        {
                            video: true,
                        },
                        1
                    ),
                ]);

                await waitAsync();

                expect(vm.events).toEqual([]);

                expect(events).toEqual([
                    {
                        roomName: 'myRoom',
                        options: {
                            video: true,
                        },
                        resolve: expect.any(Function),
                        reject: expect.any(Function),
                    },
                ]);

                events[0].resolve({
                    video: true,
                    audio: true,
                    screen: false,
                });

                await waitAsync();
                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        roomName: 'myRoom',
                        options: {
                            video: true,
                            audio: true,
                            screen: false,
                        },
                    }),
                ]);
            });

            it('should return an unsuccessful result if the set room options event is rejected', async () => {
                let events = [] as SetRoomOptions[];
                records.onSetRoomOptions.subscribe((e) => events.push(e));

                records.handleEvents([
                    setRoomOptions(
                        'myRoom',
                        {
                            video: true,
                        },
                        1
                    ),
                ]);

                await waitAsync();

                expect(vm.events).toEqual([]);

                expect(events).toEqual([
                    {
                        roomName: 'myRoom',
                        options: {
                            video: true,
                        },
                        resolve: expect.any(Function),
                        reject: expect.any(Function),
                    },
                ]);

                events[0].reject('error', 'Could not set room options.');

                await waitAsync();
                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: false,
                        roomName: 'myRoom',
                        errorCode: 'error',
                        errorMessage: 'Could not set room options.',
                    }),
                ]);
            });
        });

        describe('get_room_options', () => {
            it('should emit a onGetRoomOptions event', async () => {
                let events = [] as GetRoomOptions[];
                records.onGetRoomOptions.subscribe((e) => events.push(e));

                records.handleEvents([getRoomOptions('myRoom', 1)]);

                await waitAsync();

                expect(vm.events).toEqual([]);

                expect(events).toEqual([
                    {
                        roomName: 'myRoom',
                        resolve: expect.any(Function),
                        reject: expect.any(Function),
                    },
                ]);

                events[0].resolve({
                    video: true,
                    audio: true,
                    screen: true,
                });

                await waitAsync();
                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        roomName: 'myRoom',
                        options: {
                            video: true,
                            audio: true,
                            screen: true,
                        },
                    }),
                ]);
            });

            it('should return an unsuccessful result if the set room options event is rejected', async () => {
                let events = [] as GetRoomOptions[];
                records.onGetRoomOptions.subscribe((e) => events.push(e));

                records.handleEvents([getRoomOptions('myRoom', 1)]);

                await waitAsync();

                expect(vm.events).toEqual([]);

                expect(events).toEqual([
                    {
                        roomName: 'myRoom',
                        resolve: expect.any(Function),
                        reject: expect.any(Function),
                    },
                ]);

                events[0].reject('error', 'Could not set room options.');

                await waitAsync();
                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: false,
                        roomName: 'myRoom',
                        errorCode: 'error',
                        errorMessage: 'Could not set room options.',
                    }),
                ]);
            });
        });

        describe('grant_record_permission', () => {
            beforeEach(() => {
                require('axios').__reset();

                vm.origin = {
                    recordName: null,
                    inst: 'myInst',
                };
            });

            it('should make a POST request to /api/v2/records/permissions', async () => {
                setResponse({
                    data: {
                        success: true,
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    grantRecordPermission(
                        'recordName',
                        {
                            marker: 'marker',
                            resourceKind: 'data',
                            action: 'read',
                            subjectType: 'role',
                            subjectId: 'developer',
                            expireTimeMs: null,
                            options: {},
                        },
                        {},
                        1
                    ),
                ]);

                await waitAsync();

                expect(getLastPost()).toEqual([
                    'http://localhost:3002/api/v2/records/permissions',
                    {
                        recordName: 'recordName',
                        permission: {
                            marker: 'marker',
                            resourceKind: 'data',
                            action: 'read',
                            subjectType: 'role',
                            subjectId: 'developer',
                            expireTimeMs: null,
                            options: {},
                        },
                        instances: ['/myInst'],
                    },
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });
        });

        describe('revoke_record_permission', () => {
            beforeEach(() => {
                require('axios').__reset();

                vm.origin = {
                    recordName: null,
                    inst: 'myInst',
                };
            });

            it('should make a POST request to /api/v2/records/permissions/revoke', async () => {
                setResponse({
                    data: {
                        success: true,
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    revokeRecordPermission('recordName', 'permissionId', {}, 1),
                ]);

                await waitAsync();

                expect(getLastPost()).toEqual([
                    'http://localhost:3002/api/v2/records/permissions/revoke',
                    {
                        recordName: 'recordName',
                        permissionId: 'permissionId',
                        instances: ['/myInst'],
                    },
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });
        });

        describe('grant_inst_admin_permission', () => {
            beforeEach(() => {
                require('axios').__reset();
                vm.origin = {
                    recordName: null,
                    inst: 'myInst',
                };
            });

            it('should do nothing if the request is not approved', async () => {
                setResponse({
                    data: {
                        success: true,
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    grantInstAdminPermission('recordName', {}, 1),
                ]);

                await waitAsync();

                expect(getLastPost()).toBeUndefined();

                await waitAsync();

                expect(vm.events).toEqual([]);
                expect(authMock.isAuthenticated).not.toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).not.toBeCalled();
            });

            it('should make a POST request to /api/v2/records/role/grant', async () => {
                const now = DateTime.now();
                const plusOneDay = now.plus({ day: 1 });
                const startOfNextDay = plusOneDay.set({
                    hour: 0,
                    minute: 0,
                    second: 0,
                    millisecond: 0,
                });

                setResponse({
                    data: {
                        success: true,
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    approveAction(
                        grantInstAdminPermission('recordName', {}, 1)
                    ),
                ]);

                await waitAsync();

                expect(getLastPost()).toEqual([
                    'http://localhost:3002/api/v2/records/role/grant',
                    {
                        recordName: 'recordName',
                        inst: '/myInst',
                        role: 'admin',
                        expireTimeMs: startOfNextDay.toMillis(),
                    },
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should return an error if the inst is static', async () => {
                const now = DateTime.now();
                const plusOneDay = now.plus({ day: 1 });
                const startOfNextDay = plusOneDay.set({
                    hour: 0,
                    minute: 0,
                    second: 0,
                    millisecond: 0,
                });

                setResponse({
                    data: {
                        success: true,
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: null,
                    inst: 'myInst',
                    isStatic: true,
                };

                records.handleEvents([
                    approveAction(
                        grantInstAdminPermission('recordName', {}, 1)
                    ),
                ]);

                await waitAsync();

                expect(getLastPost()).toBeUndefined();

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncError(
                        1,
                        'Unable to grant inst admin permission to static insts.'
                    ),
                ]);
                expect(authMock.isAuthenticated).not.toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).not.toBeCalled();
            });
        });

        describe('grant_role', () => {
            beforeEach(() => {
                require('axios').__reset();
                vm.origin = {
                    recordName: null,
                    inst: 'myInst',
                };
            });

            it('should make a POST request to /api/v2/records/role/grant', async () => {
                setResponse({
                    data: {
                        success: true,
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    grantUserRole(
                        'recordName',
                        'developer',
                        'userId',
                        null,
                        {},
                        1
                    ),
                ]);

                await waitAsync();

                expect(getLastPost()).toEqual([
                    'http://localhost:3002/api/v2/records/role/grant',
                    {
                        recordName: 'recordName',
                        userId: 'userId',
                        role: 'developer',
                        expireTimeMs: null,
                        instances: ['/myInst'],
                    },
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should not include the inst if it is static', async () => {
                setResponse({
                    data: {
                        success: true,
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: null,
                    inst: 'myInst',
                    isStatic: true,
                };

                records.handleEvents([
                    grantUserRole(
                        'recordName',
                        'developer',
                        'userId',
                        null,
                        {},
                        1
                    ),
                ]);

                await waitAsync();

                expect(getLastPost()).toEqual([
                    'http://localhost:3002/api/v2/records/role/grant',
                    {
                        recordName: 'recordName',
                        userId: 'userId',
                        role: 'developer',
                        expireTimeMs: null,
                    },
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should support instances', async () => {
                setResponse({
                    data: {
                        success: true,
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    grantInstRole(
                        'recordName',
                        'developer',
                        'inst',
                        null,
                        {},
                        1
                    ),
                ]);

                await waitAsync();

                expect(getLastPost()).toEqual([
                    'http://localhost:3002/api/v2/records/role/grant',
                    {
                        recordName: 'recordName',
                        inst: 'inst',
                        role: 'developer',
                        expireTimeMs: null,
                        instances: ['/myInst'],
                    },
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });
        });

        describe('revoke_role', () => {
            beforeEach(() => {
                require('axios').__reset();
                vm.origin = {
                    recordName: null,
                    inst: 'myInst',
                };
            });

            it('should make a POST request to /api/v2/records/role/revoke', async () => {
                setResponse({
                    data: {
                        success: true,
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    revokeUserRole('recordName', 'developer', 'userId', {}, 1),
                ]);

                await waitAsync();

                expect(getLastPost()).toEqual([
                    'http://localhost:3002/api/v2/records/role/revoke',
                    {
                        recordName: 'recordName',
                        userId: 'userId',
                        role: 'developer',
                        instances: ['/myInst'],
                    },
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should not include the inst if it is static', async () => {
                setResponse({
                    data: {
                        success: true,
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: null,
                    inst: 'myInst',
                    isStatic: true,
                };

                records.handleEvents([
                    revokeUserRole('recordName', 'developer', 'userId', {}, 1),
                ]);

                await waitAsync();

                expect(getLastPost()).toEqual([
                    'http://localhost:3002/api/v2/records/role/revoke',
                    {
                        recordName: 'recordName',
                        userId: 'userId',
                        role: 'developer',
                    },
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should support instances', async () => {
                setResponse({
                    data: {
                        success: true,
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    revokeInstRole('recordName', 'developer', 'inst', {}, 1),
                ]);

                await waitAsync();

                expect(getLastPost()).toEqual([
                    'http://localhost:3002/api/v2/records/role/revoke',
                    {
                        recordName: 'recordName',
                        inst: 'inst',
                        role: 'developer',
                        instances: ['/myInst'],
                    },
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });
        });

        describe('sign_out', () => {
            it('should call logout on the auth helper', async () => {
                authMock.logout.mockResolvedValueOnce(undefined);

                records.handleEvents([signOut(1)]);

                await waitAsync();

                expect(authMock.logout).toHaveBeenCalled();
                expect(vm.events).toEqual([asyncResult(1, null)]);
            });

            it('should return an error if no auth helper is available', async () => {
                const getAuthHelper = jest.fn(
                    (): AuthHelperInterface | null => null
                );
                records = new RecordsManager(
                    {
                        version: '1.0.0',
                        versionHash: '1234567890abcdef',
                        recordsOrigin: 'http://localhost:3002',
                        authOrigin: 'http://localhost:3302',
                    },
                    helper,
                    (endpoint, authenticate) => {
                        return Promise.resolve({
                            recordsOrigin: 'http://localhost:3002',
                            headers: {},
                            token: null,
                            error: false,
                        });
                    },
                    getAuthHelper,
                    false
                );

                records.handleEvents([signOut(1)]);

                await waitAsync();

                expect(getAuthHelper).toHaveBeenCalledWith(
                    'http://localhost:3302'
                );
                expect(vm.events).toEqual([
                    asyncError(
                        1,
                        new Error(
                            'Unable to sign out: No auth helper available.'
                        )
                    ),
                ]);
            });

            it('should return an error if logout fails', async () => {
                const error = new Error('Logout failed');
                authMock.logout.mockRejectedValueOnce(error);

                records.handleEvents([signOut(1)]);

                await waitAsync();

                expect(authMock.logout).toHaveBeenCalled();
                expect(vm.events).toEqual([asyncError(1, error)]);
            });
        });

        describe('records_call_procedure', () => {
            let fetch: jest.Mock<
                Promise<{
                    status: number;
                    headers?: Headers;
                    json?: () => Promise<any>;
                    text?: () => Promise<string>;
                    body?: ReadableStream;
                }>
            >;

            const originalFetch = globalThis.fetch;

            beforeEach(() => {
                authMock.getRecordKeyPolicy.mockResolvedValue('subjectfull');
                require('axios').__reset();
                fetch = globalThis.fetch = jest.fn();
            });

            afterAll(() => {
                globalThis.fetch = originalFetch;
            });

            const allowedProcedures = [
                [
                    'recordWebhook',
                    recordsCallProcedure(
                        {
                            recordWebhook: {
                                input: {
                                    recordName: 'testRecord',
                                    item: {
                                        address: 'test',
                                        targetResourceKind: 'data',
                                        targetRecordName: 'testRecord',
                                        targetAddress: 'address',
                                        markers: ['marker'],
                                    },
                                },
                            },
                        },
                        {},
                        1
                    ),
                ] as const,
                [
                    'getWebhook',
                    recordsCallProcedure(
                        {
                            getWebhook: {
                                input: {
                                    recordName: 'testRecord',
                                    address: 'test',
                                },
                            },
                        },
                        {},
                        1
                    ),
                ] as const,
                [
                    'listWebhooks',
                    recordsCallProcedure(
                        {
                            listWebhooks: {
                                input: {
                                    recordName: 'testRecord',
                                    address: 'test',
                                    sort: 'ascending',
                                },
                            },
                        },
                        {},
                        1
                    ),
                ] as const,
                [
                    'eraseWebhook',
                    recordsCallProcedure(
                        {
                            eraseWebhook: {
                                input: {
                                    recordName: 'testRecord',
                                    address: 'test',
                                },
                            },
                        },
                        {},
                        1
                    ),
                ] as const,
                [
                    'runWebhook',
                    recordsCallProcedure(
                        {
                            runWebhook: {
                                input: {
                                    value: 123,
                                },
                                query: {
                                    recordName: 'testRecord',
                                    address: 'test',
                                },
                            },
                        },
                        {},
                        1
                    ),
                ] as const,
                [
                    'recordNotification',
                    recordsCallProcedure(
                        {
                            recordNotification: {
                                input: {
                                    recordName: 'testRecord',
                                    item: {
                                        address: 'test',
                                        description: 'description',
                                        markers: ['marker'],
                                    },
                                },
                            },
                        },
                        {},
                        1
                    ),
                ] as const,
                [
                    'getNotification',
                    recordsCallProcedure(
                        {
                            getNotification: {
                                input: {
                                    recordName: 'testRecord',
                                    address: 'test',
                                },
                            },
                        },
                        {},
                        1
                    ),
                ] as const,
                [
                    'eraseNotification',
                    recordsCallProcedure(
                        {
                            eraseNotification: {
                                input: {
                                    recordName: 'testRecord',
                                    address: 'test',
                                },
                            },
                        },
                        {},
                        1
                    ),
                ] as const,
                [
                    'listNotifications',
                    recordsCallProcedure(
                        {
                            listNotifications: {
                                input: {
                                    recordName: 'testRecord',
                                    address: 'test',
                                },
                            },
                        },
                        {},
                        1
                    ),
                ] as const,
                [
                    'subscribeToNotification',
                    recordsCallProcedure(
                        {
                            subscribeToNotification: {
                                input: {
                                    recordName: 'testRecord',
                                    address: 'test',
                                    pushSubscription: {
                                        endpoint: 'endpoint',
                                        keys: {},
                                    },
                                },
                            },
                        },
                        {},
                        1
                    ),
                ] as const,
                [
                    'unsubscribeFromNotification',
                    recordsCallProcedure(
                        {
                            unsubscribeFromNotification: {
                                input: {
                                    subscriptionId: 'subscriptionId',
                                },
                            },
                        },
                        {},
                        1
                    ),
                ] as const,
                [
                    'sendNotification',
                    recordsCallProcedure(
                        {
                            sendNotification: {
                                input: {
                                    recordName: 'testRecord',
                                    address: 'test',
                                    payload: {
                                        title: 'title',
                                    },
                                    topic: 'topic',
                                },
                            },
                        },
                        {},
                        1
                    ),
                ] as const,
                [
                    'listNotificationSubscriptions',
                    recordsCallProcedure(
                        {
                            listNotificationSubscriptions: {
                                input: {
                                    recordName: 'testRecord',
                                    address: 'test',
                                },
                            },
                        },
                        {},
                        1
                    ),
                ] as const,
                [
                    'listUserNotificationSubscriptions',
                    recordsCallProcedure(
                        {
                            listUserNotificationSubscriptions: {
                                input: {},
                            },
                        },
                        {},
                        1
                    ),
                ] as const,
                [
                    'erasePackageVersion',
                    recordsCallProcedure(
                        {
                            erasePackageVersion: {
                                input: {
                                    recordName: 'testRecord',
                                    address: 'test',
                                    key: {
                                        major: 1,
                                        minor: 0,
                                        patch: 0,
                                        tag: '',
                                    },
                                },
                            },
                        },
                        {},
                        1
                    ),
                ] as const,
                [
                    'listPackageVersions',
                    recordsCallProcedure(
                        {
                            listPackageVersions: {
                                input: {
                                    recordName: 'testRecord',
                                    address: 'test',
                                },
                            },
                        },
                        {},
                        1
                    ),
                ] as const,
                [
                    'getPackageVersion',
                    recordsCallProcedure(
                        {
                            getPackageVersion: {
                                input: {
                                    recordName: 'testRecord',
                                    address: 'test',
                                    key: 'v1.0.0',
                                } as any,
                            },
                        },
                        {},
                        1
                    ),
                ] as const,
                [
                    'recordPackage',
                    recordsCallProcedure(
                        {
                            recordPackage: {
                                input: {
                                    recordName: 'testRecord',
                                    item: {
                                        address: 'test',
                                        markers: ['marker'],
                                    },
                                },
                            },
                        },
                        {},
                        1
                    ),
                ] as const,
                [
                    'erasePackage',
                    recordsCallProcedure(
                        {
                            erasePackage: {
                                input: {
                                    recordName: 'testRecord',
                                    address: 'test',
                                },
                            },
                        },
                        {},
                        1
                    ),
                ] as const,
                [
                    'listPackages',
                    recordsCallProcedure(
                        {
                            listPackages: {
                                input: {
                                    recordName: 'testRecord',
                                    address: 'test',
                                    marker: 'publicRead',
                                },
                            },
                        },
                        {},
                        1
                    ),
                ] as const,
                [
                    'getPackage',
                    recordsCallProcedure(
                        {
                            getPackage: {
                                input: {
                                    recordName: 'testRecord',
                                    address: 'test',
                                },
                            },
                        },
                        {},
                        1
                    ),
                ] as const,
                [
                    'recordSearchCollection',
                    recordsCallProcedure(
                        {
                            recordSearchCollection: {
                                input: {
                                    recordName: 'testRecord',
                                    item: {
                                        address: 'test',
                                        markers: ['marker'],
                                        schema: {
                                            '.*': {
                                                type: 'auto',
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        {},
                        1
                    ),
                ] as const,
                [
                    'getSearchCollection',
                    recordsCallProcedure(
                        {
                            getSearchCollection: {
                                input: {
                                    recordName: 'testRecord',
                                    address: 'test',
                                },
                            },
                        },
                        {},
                        1
                    ),
                ] as const,
                [
                    'eraseSearchCollection',
                    recordsCallProcedure(
                        {
                            eraseSearchCollection: {
                                input: {
                                    recordName: 'testRecord',
                                    address: 'test',
                                },
                            },
                        },
                        {},
                        1
                    ),
                ] as const,
                [
                    'listSearchCollections',
                    recordsCallProcedure(
                        {
                            listSearchCollections: {
                                input: {
                                    recordName: 'testRecord',
                                    address: 'test',
                                    marker: 'publicRead',
                                },
                            },
                        },
                        {},
                        1
                    ),
                ] as const,
                [
                    'recordSearchDocument',
                    recordsCallProcedure(
                        {
                            recordSearchDocument: {
                                input: {
                                    recordName: 'testRecord',
                                    address: 'test',
                                    document: {
                                        test: 'abc',
                                    },
                                },
                            },
                        },
                        {},
                        1
                    ),
                ] as const,
                [
                    'eraseSearchDocument',
                    recordsCallProcedure(
                        {
                            eraseSearchDocument: {
                                input: {
                                    recordName: 'testRecord',
                                    address: 'test',
                                    documentId: '1',
                                },
                            },
                        },
                        {},
                        1
                    ),
                ] as const,
                [
                    'listPermissions',
                    recordsCallProcedure(
                        {
                            listPermissions: {
                                input: {
                                    recordName: 'testRecord',
                                    marker: 'test',
                                    resourceKind: 'data',
                                    resourceId: 'address',
                                },
                            },
                        },
                        {},
                        1
                    ),
                ] as const,
                [
                    'deleteInst',
                    recordsCallProcedure(
                        {
                            deleteInst: {
                                input: {
                                    recordName: 'testRecord',
                                    inst: 'testInst',
                                },
                            },
                        },
                        {},
                        1
                    ),
                ] as const,
            ];

            describe.each(allowedProcedures)('%s', (name, event) => {
                it('should make a POST request to /api/v3/callProcedure', async () => {
                    fetch.mockResolvedValueOnce({
                        status: 200,
                        json: async () => ({
                            success: true,
                            recordName: 'testRecord',
                            address: 'myAddress',
                        }),
                    });

                    authMock.isAuthenticated.mockResolvedValueOnce(true);
                    authMock.getAuthToken.mockResolvedValueOnce('authToken');

                    records.handleEvents([event]);

                    await waitAsync();

                    expect(fetch).toHaveBeenCalledWith(
                        'http://localhost:3002/api/v3/callProcedure',
                        {
                            method: 'POST',
                            body: JSON.stringify({
                                procedure: name,
                                input: event.procedure[name]?.input,
                                query: event.procedure[name]?.query,
                            }),
                            headers: expect.objectContaining({
                                Authorization: 'Bearer authToken',
                            }),
                        }
                    );

                    expect(vm.events).toEqual([
                        asyncResult(1, {
                            success: true,
                            recordName: 'testRecord',
                            address: 'myAddress',
                        }),
                    ]);
                });

                it('should include the inst', async () => {
                    fetch.mockResolvedValueOnce({
                        status: 200,
                        json: async () => ({
                            success: true,
                            recordName: 'testRecord',
                            address: 'myAddress',
                        }),
                    });

                    authMock.isAuthenticated.mockResolvedValueOnce(true);
                    authMock.getAuthToken.mockResolvedValueOnce('authToken');

                    vm.origin = {
                        recordName: null,
                        inst: 'myInst',
                    };

                    records.handleEvents([event]);

                    await waitAsync();

                    if (!event.procedure[name]?.query) {
                        expect(fetch).toHaveBeenCalledWith(
                            'http://localhost:3002/api/v3/callProcedure',
                            {
                                method: 'POST',
                                body: JSON.stringify({
                                    procedure: name,
                                    input: {
                                        ...event.procedure[name]?.input,
                                        instances: ['/myInst'],
                                    },
                                }),
                                headers: expect.objectContaining({
                                    Authorization: 'Bearer authToken',
                                }),
                            }
                        );
                    } else {
                        expect(fetch).toHaveBeenCalledWith(
                            'http://localhost:3002/api/v3/callProcedure',
                            {
                                method: 'POST',
                                body: JSON.stringify({
                                    procedure: name,
                                    input: event.procedure[name]?.input,
                                    query: {
                                        ...event.procedure[name]?.query,
                                        instances: ['/myInst'],
                                    },
                                }),
                                headers: expect.objectContaining({
                                    Authorization: 'Bearer authToken',
                                }),
                            }
                        );
                    }

                    expect(vm.events).toEqual([
                        asyncResult(1, {
                            success: true,
                            recordName: 'testRecord',
                            address: 'myAddress',
                        }),
                    ]);
                });

                it('should not include the inst if the inst is static', async () => {
                    fetch.mockResolvedValueOnce({
                        status: 200,
                        json: async () => ({
                            success: true,
                            recordName: 'testRecord',
                            address: 'myAddress',
                        }),
                    });

                    authMock.isAuthenticated.mockResolvedValueOnce(true);
                    authMock.getAuthToken.mockResolvedValueOnce('authToken');

                    vm.origin = {
                        recordName: null,
                        inst: 'myInst',
                        isStatic: true,
                    };

                    records.handleEvents([event]);

                    await waitAsync();

                    if (!event.procedure[name]?.query) {
                        expect(fetch).toHaveBeenCalledWith(
                            'http://localhost:3002/api/v3/callProcedure',
                            {
                                method: 'POST',
                                body: JSON.stringify({
                                    procedure: name,
                                    input: {
                                        ...event.procedure[name]?.input,
                                    },
                                }),
                                headers: expect.objectContaining({
                                    Authorization: 'Bearer authToken',
                                }),
                            }
                        );
                    } else {
                        expect(fetch).toHaveBeenCalledWith(
                            'http://localhost:3002/api/v3/callProcedure',
                            {
                                method: 'POST',
                                body: JSON.stringify({
                                    procedure: name,
                                    input: event.procedure[name]?.input,
                                    query: {
                                        ...event.procedure[name]?.query,
                                    },
                                }),
                                headers: expect.objectContaining({
                                    Authorization: 'Bearer authToken',
                                }),
                            }
                        );
                    }

                    expect(vm.events).toEqual([
                        asyncResult(1, {
                            success: true,
                            recordName: 'testRecord',
                            address: 'myAddress',
                        }),
                    ]);
                });

                it('should fail if no recordsOrigin is set', async () => {
                    records = new RecordsManager(
                        {
                            version: '1.0.0',
                            versionHash: '1234567890abcdef',
                            recordsOrigin: null,
                        },
                        helper,
                        () => null,
                        () => null
                    );

                    records.handleEvents([event]);

                    await waitAsync();

                    expect(vm.events).toEqual([
                        asyncResult(1, {
                            success: false,
                            errorCode: 'not_supported',
                            errorMessage:
                                'Records are not supported on this inst.',
                        }),
                    ]);
                });

                it('should support custom endpoints', async () => {
                    fetch.mockResolvedValueOnce({
                        status: 200,
                        json: async () => ({
                            success: true,
                            recordName: 'testRecord',
                            address: 'myAddress',
                        }),
                    });

                    customAuthMock.isAuthenticated.mockResolvedValueOnce(true);
                    customAuthMock.getAuthToken.mockResolvedValueOnce(
                        'authToken'
                    );

                    records.handleEvents([
                        {
                            ...event,
                            options: {
                                ...event.options,
                                endpoint: 'http://localhost:9999',
                            },
                        },
                    ]);

                    await waitAsync();

                    if (!event.procedure[name]?.query) {
                        expect(fetch).toHaveBeenCalledWith(
                            'http://localhost:9999/api/v3/callProcedure',
                            {
                                method: 'POST',
                                body: JSON.stringify({
                                    procedure: name,
                                    input: {
                                        ...event.procedure[name]?.input,
                                    },
                                }),
                                headers: expect.objectContaining({
                                    Authorization: 'Bearer authToken',
                                }),
                            }
                        );
                    } else {
                        expect(fetch).toHaveBeenCalledWith(
                            'http://localhost:9999/api/v3/callProcedure',
                            {
                                method: 'POST',
                                body: JSON.stringify({
                                    procedure: name,
                                    input: event.procedure[name]?.input,
                                    query: {
                                        ...event.procedure[name]?.query,
                                    },
                                }),
                                headers: expect.objectContaining({
                                    Authorization: 'Bearer authToken',
                                }),
                            }
                        );
                    }

                    await waitAsync();

                    expect(vm.events).toEqual([
                        asyncResult(1, {
                            success: true,
                            recordName: 'testRecord',
                            address: 'myAddress',
                        }),
                    ]);
                });
            });
        });

        describe('ai_chat', () => {
            beforeEach(() => {
                authMock.getRecordKeyPolicy.mockResolvedValue('subjectfull');
                require('axios').__reset();
            });

            it('should make a POST request to /api/v2/ai/chat', async () => {
                setResponse({
                    data: {
                        success: true,
                        choices: [
                            {
                                role: 'assistant',
                                content: 'Hello!',
                                finishReason: 'stop',
                            },
                        ],
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    aiChat(
                        [
                            {
                                role: 'user',
                                content: 'Hello!',
                            },
                        ],
                        undefined,
                        1
                    ),
                ]);

                await waitAsync();

                expect(getLastPost()).toEqual([
                    'http://localhost:3002/api/v2/ai/chat',
                    {
                        messages: [
                            {
                                role: 'user',
                                content: 'Hello!',
                            },
                        ],
                    },
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        choices: [
                            {
                                role: 'assistant',
                                content: 'Hello!',
                                finishReason: 'stop',
                            },
                        ],
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should support custom models', async () => {
                setResponse({
                    data: {
                        success: true,
                        choices: [
                            {
                                role: 'assistant',
                                content: 'Hello!',
                                finishReason: 'stop',
                            },
                        ],
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    aiChat(
                        [
                            {
                                role: 'user',
                                content: 'Hello!',
                            },
                        ],
                        {
                            preferredModel: 'custom-model',
                        },
                        1
                    ),
                ]);

                await waitAsync();

                expect(getLastPost()).toEqual([
                    'http://localhost:3002/api/v2/ai/chat',
                    {
                        messages: [
                            {
                                role: 'user',
                                content: 'Hello!',
                            },
                        ],
                        model: 'custom-model',
                    },
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        choices: [
                            {
                                role: 'assistant',
                                content: 'Hello!',
                                finishReason: 'stop',
                            },
                        ],
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should include the inst', async () => {
                setResponse({
                    data: {
                        success: true,
                        choices: [
                            {
                                role: 'assistant',
                                content: 'Hello!',
                                finishReason: 'stop',
                            },
                        ],
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: null,
                    inst: 'myInst',
                };

                records.handleEvents([
                    aiChat(
                        [
                            {
                                role: 'user',
                                content: 'Hello!',
                            },
                        ],
                        undefined,
                        1
                    ),
                ]);

                await waitAsync();

                expect(getLastPost()).toEqual([
                    'http://localhost:3002/api/v2/ai/chat',
                    {
                        messages: [
                            {
                                role: 'user',
                                content: 'Hello!',
                            },
                        ],
                        instances: ['/myInst'],
                    },
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        choices: [
                            {
                                role: 'assistant',
                                content: 'Hello!',
                                finishReason: 'stop',
                            },
                        ],
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should not include the inst if it is static', async () => {
                setResponse({
                    data: {
                        success: true,
                        choices: [
                            {
                                role: 'assistant',
                                content: 'Hello!',
                                finishReason: 'stop',
                            },
                        ],
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: null,
                    inst: 'myInst',
                    isStatic: true,
                };

                records.handleEvents([
                    aiChat(
                        [
                            {
                                role: 'user',
                                content: 'Hello!',
                            },
                        ],
                        undefined,
                        1
                    ),
                ]);

                await waitAsync();

                expect(getLastPost()).toEqual([
                    'http://localhost:3002/api/v2/ai/chat',
                    {
                        messages: [
                            {
                                role: 'user',
                                content: 'Hello!',
                            },
                        ],
                    },
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        choices: [
                            {
                                role: 'assistant',
                                content: 'Hello!',
                                finishReason: 'stop',
                            },
                        ],
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should support record names', async () => {
                setResponse({
                    data: {
                        success: true,
                        choices: [
                            {
                                role: 'assistant',
                                content: 'Hello!',
                                finishReason: 'stop',
                            },
                        ],
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: 'record',
                    inst: 'myInst',
                };

                records.handleEvents([
                    aiChat(
                        [
                            {
                                role: 'user',
                                content: 'Hello!',
                            },
                        ],
                        undefined,
                        1
                    ),
                ]);

                await waitAsync();

                expect(getLastPost()).toEqual([
                    'http://localhost:3002/api/v2/ai/chat',
                    {
                        messages: [
                            {
                                role: 'user',
                                content: 'Hello!',
                            },
                        ],
                        instances: ['record/myInst'],
                    },
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        choices: [
                            {
                                role: 'assistant',
                                content: 'Hello!',
                                finishReason: 'stop',
                            },
                        ],
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should support custom endpoints', async () => {
                setResponse({
                    data: {
                        success: true,
                        choices: [
                            {
                                role: 'assistant',
                                content: 'Hello!',
                                finishReason: 'stop',
                            },
                        ],
                    },
                });

                customAuthMock.isAuthenticated.mockResolvedValueOnce(true);
                customAuthMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    aiChat(
                        [
                            {
                                role: 'user',
                                content: 'Hello!',
                            },
                        ],
                        {
                            endpoint: 'http://localhost:9999',
                        },
                        1
                    ),
                ]);

                await waitAsync();

                expect(getLastPost()).toEqual([
                    'http://localhost:9999/api/v2/ai/chat',
                    {
                        messages: [
                            {
                                role: 'user',
                                content: 'Hello!',
                            },
                        ],
                    },
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        choices: [
                            {
                                role: 'assistant',
                                content: 'Hello!',
                                finishReason: 'stop',
                            },
                        ],
                    }),
                ]);
                expect(customAuthMock.isAuthenticated).toBeCalled();
                expect(customAuthMock.authenticate).not.toBeCalled();
                expect(customAuthMock.getAuthToken).toBeCalled();
            });

            it('should attempt to login if not authenticated', async () => {
                setResponse({
                    data: {
                        success: true,
                        choices: [
                            {
                                role: 'assistant',
                                content: 'Hello!',
                                finishReason: 'stop',
                            },
                        ],
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(false);
                authMock.authenticate.mockResolvedValueOnce({});
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    aiChat(
                        [
                            {
                                role: 'user',
                                content: 'Hello!',
                            },
                        ],
                        undefined,
                        1
                    ),
                ]);

                await waitAsync();

                expect(getLastPost()).toEqual([
                    'http://localhost:3002/api/v2/ai/chat',
                    {
                        messages: [
                            {
                                role: 'user',
                                content: 'Hello!',
                            },
                        ],
                    },
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        choices: [
                            {
                                role: 'assistant',
                                content: 'Hello!',
                                finishReason: 'stop',
                            },
                        ],
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should return a not_logged_in error if there is no token', async () => {
                authMock.isAuthenticated.mockResolvedValueOnce(false);
                authMock.authenticate.mockResolvedValueOnce({});
                authMock.getAuthToken.mockResolvedValueOnce(null);

                records.handleEvents([
                    aiChat(
                        [
                            {
                                role: 'user',
                                content: 'Hello!',
                            },
                        ],
                        undefined,
                        1
                    ),
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: false,
                        errorCode: 'not_logged_in',
                        errorMessage: 'The user is not logged in.',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });
        });

        describe('ai_chat_stream', () => {
            let fetch: jest.Mock<
                Promise<{
                    status: number;
                    headers?: Headers;
                    json?: () => Promise<any>;
                    text?: () => Promise<string>;
                    body?: ReadableStream;
                }>
            >;

            const originalFetch = globalThis.fetch;

            beforeEach(() => {
                authMock.getRecordKeyPolicy.mockResolvedValue('subjectfull');
                require('axios').__reset();
                fetch = globalThis.fetch = jest.fn();
            });

            afterAll(() => {
                globalThis.fetch = originalFetch;
            });

            it.skip('should make a POST request to /api/v2/ai/chat/stream', async () => {
                fetch.mockResolvedValueOnce({
                    status: 200,
                    headers: new Headers({
                        'Content-Type': 'application/x-ndjson',
                    }),
                    body: readableFromAsyncIterable(
                        asyncIterable([
                            Promise.resolve(
                                Buffer.from(
                                    JSON.stringify({
                                        choices: [
                                            {
                                                role: 'assistant',
                                                content: 'Hello!',
                                                finishReason: 'stop',
                                            },
                                        ],
                                    }) + '\n'
                                )
                            ),
                            Promise.resolve(
                                Buffer.from(
                                    JSON.stringify({
                                        success: true,
                                    })
                                )
                            ),
                        ])
                    ),
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    aiChatStream(
                        [
                            {
                                role: 'user',
                                content: 'Hello!',
                            },
                        ],
                        undefined,
                        1
                    ),
                ]);

                await waitAsync();

                expect(fetch).toHaveBeenCalledWith(
                    'http://localhost:3002/api/v3/callProcedure',
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json;charset=UTF-8',
                            Accept: 'application/json,application/x-ndjson',
                            Authorization: 'Bearer authToken',
                        },
                        body: JSON.stringify({
                            procedure: 'aiChatStream',
                            input: {
                                messages: [
                                    {
                                        role: 'user',
                                        content: 'Hello!',
                                    },
                                ],
                            },
                        }),
                    }
                );

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                    }),
                    iterableNext(1, {
                        choices: [
                            {
                                role: 'assistant',
                                content: 'Hello!',
                                finishReason: 'stop',
                            },
                        ],
                    }),
                    iterableComplete(1),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should make a websocket request', async () => {
                const client = new MemoryConnectionClient();

                let responses =
                    new Subject<WebsocketHttpPartialResponseMessage>();
                client.events.set('http_partial_response', responses);

                connectionClientFactory = () => {
                    return client;
                };
                records = new RecordsManager(
                    {
                        version: '1.0.0',
                        versionHash: '1234567890abcdef',
                        recordsOrigin: 'http://localhost:3002',
                        authOrigin: 'http://localhost:3002',
                    },
                    helper,
                    getEndpointInfo,
                    (endpoint) => authMock as any,
                    true,
                    connectionClientFactory
                );

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    aiChatStream(
                        [
                            {
                                role: 'user',
                                content: 'hello',
                            },
                        ],
                        undefined,
                        1
                    ),
                ]);

                await waitAsync();

                expect(client.sentMessages).toEqual([
                    {
                        type: 'http_request',
                        id: 0,
                        request: {
                            path: '/api/v2/ai/chat/stream',
                            method: 'POST',
                            body: expect.any(String),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                            query: {},
                            pathParams: {},
                        },
                    },
                ]);

                const body = JSON.parse(
                    (client.sentMessages[0] as WebsocketHttpRequestMessage)
                        .request.body as string
                );
                expect(body).toEqual({
                    messages: [
                        {
                            role: 'user',
                            content: 'hello',
                        },
                    ],
                });

                responses.next({
                    type: 'http_partial_response',
                    id: 0,
                    index: 0,
                    response: {
                        statusCode: 200,
                        body:
                            JSON.stringify({
                                choices: [
                                    {
                                        role: 'assistant',
                                        content: 'Hello!',
                                    },
                                ],
                            }) + '\n',
                        headers: {
                            'content-type': 'application/x-ndjson',
                        },
                    },
                });

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                    }),
                    iterableNext(1, {
                        choices: [
                            {
                                role: 'assistant',
                                content: 'Hello!',
                            },
                        ],
                    }),
                ]);

                responses.next({
                    type: 'http_partial_response',
                    id: 0,
                    index: 0,
                    response: {
                        statusCode: 200,
                        body:
                            JSON.stringify({
                                success: true,
                            }) + '\n',
                        headers: {
                            'content-type': 'application/x-ndjson',
                        },
                    },
                    final: true,
                });

                expect(vm.events.slice(2)).toEqual([iterableComplete(1)]);
            });

            it('should return an error if the connection closes during the request', async () => {
                const client = new MemoryConnectionClient();

                let responses =
                    new Subject<WebsocketHttpPartialResponseMessage>();
                client.events.set('http_partial_response', responses);

                connectionClientFactory = () => {
                    return client;
                };
                records = new RecordsManager(
                    {
                        version: '1.0.0',
                        versionHash: '1234567890abcdef',
                        recordsOrigin: 'http://localhost:3002',
                        authOrigin: 'http://localhost:3002',
                    },
                    helper,
                    getEndpointInfo,
                    (endpoint) => authMock as any,
                    true,
                    connectionClientFactory
                );

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    aiChatStream(
                        [
                            {
                                role: 'user',
                                content: 'hello',
                            },
                        ],
                        undefined,
                        1
                    ),
                ]);

                await waitAsync();

                expect(client.sentMessages).toEqual([
                    {
                        type: 'http_request',
                        id: 0,
                        request: {
                            path: '/api/v2/ai/chat/stream',
                            method: 'POST',
                            body: expect.any(String),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                            query: {},
                            pathParams: {},
                        },
                    },
                ]);

                const body = JSON.parse(
                    (client.sentMessages[0] as WebsocketHttpRequestMessage)
                        .request.body as string
                );
                expect(body).toEqual({
                    messages: [
                        {
                            role: 'user',
                            content: 'hello',
                        },
                    ],
                });

                responses.next({
                    type: 'http_partial_response',
                    id: 0,
                    index: 0,
                    response: {
                        statusCode: 200,
                        body:
                            JSON.stringify({
                                choices: [
                                    {
                                        role: 'assistant',
                                        content: 'Hello!',
                                    },
                                ],
                            }) + '\n',
                        headers: {
                            'content-type': 'application/x-ndjson',
                        },
                    },
                });

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                    }),
                    iterableNext(1, {
                        choices: [
                            {
                                role: 'assistant',
                                content: 'Hello!',
                            },
                        ],
                    }),
                ]);

                client.disconnect();

                await waitAsync();

                expect(vm.events.slice(2)).toEqual([
                    iterableThrow(
                        1,
                        new Error('The request encountered an error.')
                    ),
                ]);
            });
        });

        describe('ai_generate_skybox', () => {
            beforeEach(() => {
                jest.useFakeTimers();
                require('axios').__reset();
            });

            afterEach(() => {
                jest.useRealTimers();
            });

            it('should make a POST request to /api/v2/ai/skybox', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        skyboxId: 'skybox-id',
                    },
                });
                setNextResponse({
                    data: {
                        success: true,
                        status: 'pending',
                    },
                });
                setNextResponse({
                    data: {
                        success: true,
                        status: 'generated',
                        fileUrl: 'file-url',
                        thumbnailUrl: 'thumb-url',
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    aiGenerateSkybox('prompt', undefined, undefined, 1),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'http://localhost:3002/api/v2/ai/skybox',
                        {
                            prompt: 'prompt',
                        },
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'get',
                        'http://localhost:3002/api/v2/ai/skybox?skyboxId=skybox-id',
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'get',
                        'http://localhost:3002/api/v2/ai/skybox?skyboxId=skybox-id',
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                ]);

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        status: 'generated',
                        fileUrl: 'file-url',
                        thumbnailUrl: 'thumb-url',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should include the inst', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        skyboxId: 'skybox-id',
                    },
                });
                setNextResponse({
                    data: {
                        success: true,
                        status: 'pending',
                    },
                });
                setNextResponse({
                    data: {
                        success: true,
                        status: 'generated',
                        fileUrl: 'file-url',
                        thumbnailUrl: 'thumb-url',
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: null,
                    inst: 'myInst',
                };

                records.handleEvents([
                    aiGenerateSkybox('prompt', undefined, undefined, 1),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'http://localhost:3002/api/v2/ai/skybox',
                        {
                            prompt: 'prompt',
                            instances: ['/myInst'],
                        },
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'get',
                        'http://localhost:3002/api/v2/ai/skybox?skyboxId=skybox-id&instances=%2FmyInst',
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'get',
                        'http://localhost:3002/api/v2/ai/skybox?skyboxId=skybox-id&instances=%2FmyInst',
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        status: 'generated',
                        fileUrl: 'file-url',
                        thumbnailUrl: 'thumb-url',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should not include the inst if it is static', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        skyboxId: 'skybox-id',
                    },
                });
                setNextResponse({
                    data: {
                        success: true,
                        status: 'pending',
                    },
                });
                setNextResponse({
                    data: {
                        success: true,
                        status: 'generated',
                        fileUrl: 'file-url',
                        thumbnailUrl: 'thumb-url',
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: null,
                    inst: 'myInst',
                    isStatic: true,
                };

                records.handleEvents([
                    aiGenerateSkybox('prompt', undefined, undefined, 1),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'http://localhost:3002/api/v2/ai/skybox',
                        {
                            prompt: 'prompt',
                        },
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'get',
                        'http://localhost:3002/api/v2/ai/skybox?skyboxId=skybox-id',
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'get',
                        'http://localhost:3002/api/v2/ai/skybox?skyboxId=skybox-id',
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        status: 'generated',
                        fileUrl: 'file-url',
                        thumbnailUrl: 'thumb-url',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should support record names', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        skyboxId: 'skybox-id',
                    },
                });
                setNextResponse({
                    data: {
                        success: true,
                        status: 'pending',
                    },
                });
                setNextResponse({
                    data: {
                        success: true,
                        status: 'generated',
                        fileUrl: 'file-url',
                        thumbnailUrl: 'thumb-url',
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: 'record',
                    inst: 'myInst',
                };

                records.handleEvents([
                    aiGenerateSkybox('prompt', undefined, undefined, 1),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'http://localhost:3002/api/v2/ai/skybox',
                        {
                            prompt: 'prompt',
                            instances: ['record/myInst'],
                        },
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'get',
                        'http://localhost:3002/api/v2/ai/skybox?skyboxId=skybox-id&instances=record%2FmyInst',
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'get',
                        'http://localhost:3002/api/v2/ai/skybox?skyboxId=skybox-id&instances=record%2FmyInst',
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        status: 'generated',
                        fileUrl: 'file-url',
                        thumbnailUrl: 'thumb-url',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should support custom endpoints', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        skyboxId: 'skybox-id',
                    },
                });
                setNextResponse({
                    data: {
                        success: true,
                        status: 'pending',
                    },
                });
                setNextResponse({
                    data: {
                        success: true,
                        status: 'generated',
                        fileUrl: 'file-url',
                        thumbnailUrl: 'thumb-url',
                    },
                });

                customAuthMock.isAuthenticated.mockResolvedValueOnce(true);
                customAuthMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    aiGenerateSkybox(
                        'prompt',
                        undefined,
                        {
                            endpoint: 'http://localhost:9999',
                        },
                        1
                    ),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'http://localhost:9999/api/v2/ai/skybox',
                        {
                            prompt: 'prompt',
                        },
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'get',
                        'http://localhost:9999/api/v2/ai/skybox?skyboxId=skybox-id',
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'get',
                        'http://localhost:9999/api/v2/ai/skybox?skyboxId=skybox-id',
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        status: 'generated',
                        fileUrl: 'file-url',
                        thumbnailUrl: 'thumb-url',
                    }),
                ]);
                expect(customAuthMock.isAuthenticated).toBeCalled();
                expect(customAuthMock.authenticate).not.toBeCalled();
                expect(customAuthMock.getAuthToken).toBeCalled();
            });

            it('should attempt to login if not authenticated', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        skyboxId: 'skybox-id',
                    },
                });
                setNextResponse({
                    data: {
                        success: true,
                        status: 'pending',
                    },
                });
                setNextResponse({
                    data: {
                        success: true,
                        status: 'generated',
                        fileUrl: 'file-url',
                        thumbnailUrl: 'thumb-url',
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(false);
                authMock.authenticate.mockResolvedValueOnce({});
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    aiGenerateSkybox('prompt', undefined, undefined, 1),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'http://localhost:3002/api/v2/ai/skybox',
                        {
                            prompt: 'prompt',
                        },
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'get',
                        'http://localhost:3002/api/v2/ai/skybox?skyboxId=skybox-id',
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'get',
                        'http://localhost:3002/api/v2/ai/skybox?skyboxId=skybox-id',
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        status: 'generated',
                        fileUrl: 'file-url',
                        thumbnailUrl: 'thumb-url',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should return a server_error if unable to retrieve the image after 10 attempts', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        skyboxId: 'skybox-id',
                    },
                });
                for (let i = 0; i < 10; i++) {
                    setNextResponse({
                        data: {
                            success: true,
                            status: 'pending',
                        },
                    });
                }
                setNextResponse({
                    data: {
                        success: true,
                        status: 'generated',
                        fileUrl: 'file-url',
                        thumbnailUrl: 'thumb-url',
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    aiGenerateSkybox('prompt', undefined, undefined, 1),
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: false,
                        errorCode: 'server_error',
                        errorMessage: 'The request timed out.',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should return a not_logged_in error if there is no token', async () => {
                authMock.isAuthenticated.mockResolvedValueOnce(false);
                authMock.authenticate.mockResolvedValueOnce({});
                authMock.getAuthToken.mockResolvedValueOnce(null);

                records.handleEvents([
                    aiGenerateSkybox('prompt', undefined, undefined, 1),
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: false,
                        errorCode: 'not_logged_in',
                        errorMessage: 'The user is not logged in.',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });
        });

        describe('ai_generate_image', () => {
            beforeEach(() => {
                authMock.getRecordKeyPolicy.mockResolvedValue('subjectfull');
                require('axios').__reset();
            });

            it('should make a POST request to /api/v2/ai/image', async () => {
                setResponse({
                    data: {
                        success: true,
                        images: [
                            {
                                base64: 'data',
                            },
                        ],
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    aiGenerateImage(
                        {
                            prompt: 'a blue bridge',
                        },
                        undefined,
                        1
                    ),
                ]);

                await waitAsync();

                expect(getLastPost()).toEqual([
                    'http://localhost:3002/api/v2/ai/image',
                    {
                        prompt: 'a blue bridge',
                    },
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        images: [
                            {
                                base64: 'data',
                            },
                        ],
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should include the inst', async () => {
                setResponse({
                    data: {
                        success: true,
                        images: [
                            {
                                base64: 'data',
                            },
                        ],
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: null,
                    inst: 'myInst',
                };

                records.handleEvents([
                    aiGenerateImage(
                        {
                            prompt: 'a blue bridge',
                        },
                        undefined,
                        1
                    ),
                ]);

                await waitAsync();

                expect(getLastPost()).toEqual([
                    'http://localhost:3002/api/v2/ai/image',
                    {
                        prompt: 'a blue bridge',
                        instances: ['/myInst'],
                    },
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        images: [
                            {
                                base64: 'data',
                            },
                        ],
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should not include the inst if it is static', async () => {
                setResponse({
                    data: {
                        success: true,
                        images: [
                            {
                                base64: 'data',
                            },
                        ],
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: null,
                    inst: 'myInst',
                    isStatic: true,
                };

                records.handleEvents([
                    aiGenerateImage(
                        {
                            prompt: 'a blue bridge',
                        },
                        undefined,
                        1
                    ),
                ]);

                await waitAsync();

                expect(getLastPost()).toEqual([
                    'http://localhost:3002/api/v2/ai/image',
                    {
                        prompt: 'a blue bridge',
                    },
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        images: [
                            {
                                base64: 'data',
                            },
                        ],
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should support record names', async () => {
                setResponse({
                    data: {
                        success: true,
                        images: [
                            {
                                base64: 'data',
                            },
                        ],
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: 'record',
                    inst: 'myInst',
                };

                records.handleEvents([
                    aiGenerateImage(
                        {
                            prompt: 'a blue bridge',
                        },
                        undefined,
                        1
                    ),
                ]);

                await waitAsync();

                expect(getLastPost()).toEqual([
                    'http://localhost:3002/api/v2/ai/image',
                    {
                        prompt: 'a blue bridge',
                        instances: ['record/myInst'],
                    },
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        images: [
                            {
                                base64: 'data',
                            },
                        ],
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should support custom endpoints', async () => {
                setResponse({
                    data: {
                        success: true,
                        images: [
                            {
                                base64: 'data',
                            },
                        ],
                    },
                });

                customAuthMock.isAuthenticated.mockResolvedValueOnce(true);
                customAuthMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    aiGenerateImage(
                        {
                            prompt: 'a blue bridge',
                        },
                        {
                            endpoint: 'http://localhost:9999',
                        },
                        1
                    ),
                ]);

                await waitAsync();

                expect(getLastPost()).toEqual([
                    'http://localhost:9999/api/v2/ai/image',
                    {
                        prompt: 'a blue bridge',
                    },
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        images: [
                            {
                                base64: 'data',
                            },
                        ],
                    }),
                ]);
                expect(customAuthMock.isAuthenticated).toBeCalled();
                expect(customAuthMock.authenticate).not.toBeCalled();
                expect(customAuthMock.getAuthToken).toBeCalled();
            });

            it('should attempt to login if not authenticated', async () => {
                setResponse({
                    data: {
                        success: true,
                        images: [
                            {
                                base64: 'data',
                            },
                        ],
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(false);
                authMock.authenticate.mockResolvedValueOnce({});
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    aiGenerateImage(
                        {
                            prompt: 'a blue bridge',
                        },
                        undefined,
                        1
                    ),
                ]);

                await waitAsync();

                expect(getLastPost()).toEqual([
                    'http://localhost:3002/api/v2/ai/image',
                    {
                        prompt: 'a blue bridge',
                    },
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        images: [
                            {
                                base64: 'data',
                            },
                        ],
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should return a not_logged_in error if there is no token', async () => {
                authMock.isAuthenticated.mockResolvedValueOnce(false);
                authMock.authenticate.mockResolvedValueOnce({});
                authMock.getAuthToken.mockResolvedValueOnce(null);

                records.handleEvents([
                    aiGenerateImage(
                        {
                            prompt: 'a blue bridge',
                        },
                        undefined,
                        1
                    ),
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: false,
                        errorCode: 'not_logged_in',
                        errorMessage: 'The user is not logged in.',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should use websockets if they are supported', async () => {
                const client = new MemoryConnectionClient();

                let responses = new Subject<WebsocketHttpResponseMessage>();
                client.events.set('http_response', responses);

                connectionClientFactory = () => {
                    return client;
                };
                records = new RecordsManager(
                    {
                        version: '1.0.0',
                        versionHash: '1234567890abcdef',
                        recordsOrigin: 'http://localhost:3002',
                        authOrigin: 'http://localhost:3002',
                    },
                    helper,
                    getEndpointInfo,
                    (endpoint) => authMock as any,
                    true,
                    connectionClientFactory
                );

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    aiGenerateImage(
                        {
                            prompt: 'a blue bridge',
                        },
                        undefined,
                        1
                    ),
                ]);

                await waitAsync();

                expect(client.sentMessages).toEqual([
                    {
                        type: 'http_request',
                        id: 0,
                        request: {
                            path: '/api/v2/ai/image',
                            method: 'POST',
                            body: expect.any(String),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                            query: {},
                            pathParams: {},
                        },
                    },
                ]);

                const body = JSON.parse(
                    (client.sentMessages[0] as WebsocketHttpRequestMessage)
                        .request.body
                );
                expect(body).toEqual({
                    prompt: 'a blue bridge',
                });

                responses.next({
                    type: 'http_response',
                    id: 0,
                    response: {
                        statusCode: 200,
                        body: JSON.stringify({
                            success: true,
                            images: [
                                {
                                    base64: 'data',
                                },
                            ],
                        }),
                        headers: {},
                    },
                });

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        images: [
                            {
                                base64: 'data',
                            },
                        ],
                    }),
                ]);
            });

            it('should return websocket errors', async () => {
                const client = new MemoryConnectionClient();

                let responses = new Subject<WebsocketHttpResponseMessage>();
                client.events.set('http_response', responses);

                connectionClientFactory = () => {
                    return client;
                };
                records = new RecordsManager(
                    {
                        version: '1.0.0',
                        versionHash: '1234567890abcdef',
                        recordsOrigin: 'http://localhost:3002',
                        authOrigin: 'http://localhost:3002',
                    },
                    helper,
                    getEndpointInfo,
                    (endpoint) => authMock as any,
                    true,
                    connectionClientFactory
                );

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    aiGenerateImage(
                        {
                            prompt: 'a blue bridge',
                        },
                        undefined,
                        1
                    ),
                ]);

                await waitAsync();

                expect(client.sentMessages).toEqual([
                    {
                        type: 'http_request',
                        id: 0,
                        request: {
                            path: '/api/v2/ai/image',
                            method: 'POST',
                            body: expect.any(String),
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                            query: {},
                            pathParams: {},
                        },
                    },
                ]);

                const body = JSON.parse(
                    (client.sentMessages[0] as WebsocketHttpRequestMessage)
                        .request.body
                );
                expect(body).toEqual({
                    prompt: 'a blue bridge',
                });

                client.disconnect();

                await waitAsync();

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncError(1, 'Error: The request encountered an error.'),
                ]);
            });
        });

        describe('ai_hume_get_access_token', () => {
            let fetch: jest.Mock<
                Promise<{
                    status: number;
                    headers?: Headers;
                    json?: () => Promise<any>;
                    text?: () => Promise<string>;
                    body?: ReadableStream;
                }>
            >;

            const originalFetch = globalThis.fetch;

            beforeEach(() => {
                authMock.getRecordKeyPolicy.mockResolvedValue('subjectfull');
                require('axios').__reset();
                fetch = globalThis.fetch = jest.fn();
            });

            afterAll(() => {
                globalThis.fetch = originalFetch;
            });

            it('should make a GET request to /api/v2/ai/hume/token', async () => {
                fetch.mockResolvedValueOnce({
                    status: 200,
                    json: async () => ({
                        success: true,
                        accessToken: 'token',
                    }),
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([aiHumeGetAccessToken(undefined, {}, 1)]);

                await waitAsync();

                expect(fetch).toHaveBeenCalledWith(
                    'http://localhost:3002/api/v3/callProcedure',
                    {
                        method: 'POST',
                        body: JSON.stringify({
                            procedure: 'getHumeAccessToken',
                            input: {},
                        }),
                        headers: expect.objectContaining({
                            Authorization: 'Bearer authToken',
                        }),
                    }
                );

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        accessToken: 'token',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should include the record name', async () => {
                fetch.mockResolvedValueOnce({
                    status: 200,
                    json: async () => ({
                        success: true,
                        accessToken: 'token',
                    }),
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    aiHumeGetAccessToken('recordName', {}, 1),
                ]);

                await waitAsync();

                expect(fetch).toHaveBeenCalledWith(
                    'http://localhost:3002/api/v3/callProcedure',
                    {
                        method: 'POST',
                        body: JSON.stringify({
                            procedure: 'getHumeAccessToken',
                            input: {
                                recordName: 'recordName',
                            },
                        }),
                        headers: expect.objectContaining({
                            Authorization: 'Bearer authToken',
                        }),
                    }
                );

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        accessToken: 'token',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });
        });

        describe('ai_sloyd_generate_model', () => {
            let fetch: jest.Mock<
                Promise<{
                    status: number;
                    headers?: Headers;
                    json?: () => Promise<any>;
                    text?: () => Promise<string>;
                    body?: ReadableStream;
                }>
            >;

            const originalFetch = globalThis.fetch;

            beforeEach(() => {
                authMock.getRecordKeyPolicy.mockResolvedValue('subjectfull');
                require('axios').__reset();
                fetch = globalThis.fetch = jest.fn();
            });

            afterAll(() => {
                globalThis.fetch = originalFetch;
            });

            it('should make a GET request to /api/v3/callProcedure', async () => {
                fetch.mockResolvedValueOnce({
                    status: 200,
                    json: async () => ({
                        success: true,
                        confidenceScore: 0.5,
                        interactionId: 'modelId',
                        modelOutputType: 'json-gltf',
                        name: 'model name',
                        gltfJson: 'json',
                    }),
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    aiSloydGenerateModel(
                        {
                            prompt: 'the prompt',
                        },
                        {},
                        1
                    ),
                ]);

                await waitAsync();

                expect(fetch).toHaveBeenCalledWith(
                    'http://localhost:3002/api/v3/callProcedure',
                    {
                        method: 'POST',
                        body: JSON.stringify({
                            procedure: 'createSloydModel',
                            input: {
                                prompt: 'the prompt',
                            },
                        }),
                        headers: expect.objectContaining({
                            Authorization: 'Bearer authToken',
                        }),
                    }
                );

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        confidenceScore: 0.5,
                        interactionId: 'modelId',
                        modelOutputType: 'json-gltf',
                        name: 'model name',
                        gltfJson: 'json',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });
        });

        describe('list_user_studios', () => {
            beforeEach(() => {
                require('axios').__reset();
            });

            it('should make a GET request to /api/v2/studios/list', async () => {
                setResponse({
                    data: {
                        success: true,
                        studios: [
                            {
                                studioId: 'studio-id',
                                displayName: 'Studio',
                                role: 'member',
                                isPrimaryContact: false,
                                subscriptionTier: 'tier1',
                            } as ListedStudio,
                        ],
                    },
                });

                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([listUserStudios({}, 1)]);

                await waitAsync();

                expect(getLastGet()).toEqual([
                    'http://localhost:3002/api/v2/studios/list',
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        studios: [
                            {
                                studioId: 'studio-id',
                                displayName: 'Studio',
                                role: 'member',
                                isPrimaryContact: false,
                                subscriptionTier: 'tier1',
                            } as ListedStudio,
                        ],
                    }),
                ]);
            });

            it('should include the comId from the config if specified', async () => {
                records = new RecordsManager(
                    {
                        version: '1.0.0',
                        versionHash: '1234567890abcdef',
                        recordsOrigin: 'http://localhost:3002',
                        authOrigin: 'http://localhost:3002',
                        comId: 'comId1',
                    },
                    helper,
                    getEndpointInfo,
                    (endpoint) => authMock as any,
                    true
                );

                setResponse({
                    data: {
                        success: true,
                        studios: [
                            {
                                studioId: 'studio-id',
                                displayName: 'Studio',
                                role: 'member',
                                isPrimaryContact: false,
                                subscriptionTier: 'tier1',
                            } as ListedStudio,
                        ],
                    },
                });

                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([listUserStudios({}, 1)]);

                await waitAsync();

                expect(getLastGet()).toEqual([
                    'http://localhost:3002/api/v2/studios/list?comId=comId1',
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        studios: [
                            {
                                studioId: 'studio-id',
                                displayName: 'Studio',
                                role: 'member',
                                isPrimaryContact: false,
                                subscriptionTier: 'tier1',
                            } as ListedStudio,
                        ],
                    }),
                ]);
            });

            it('should attempt to login if not authenticated', async () => {
                setResponse({
                    data: {
                        success: true,
                        studios: [
                            {
                                studioId: 'studio-id',
                                displayName: 'Studio',
                                role: 'member',
                                isPrimaryContact: false,
                                subscriptionTier: 'tier1',
                            } as ListedStudio,
                        ],
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(false);
                authMock.authenticate.mockResolvedValueOnce({});
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([listUserStudios({}, 1)]);

                await waitAsync();

                expect(getLastGet()).toEqual([
                    'http://localhost:3002/api/v2/studios/list',
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        studios: [
                            {
                                studioId: 'studio-id',
                                displayName: 'Studio',
                                role: 'member',
                                isPrimaryContact: false,
                                subscriptionTier: 'tier1',
                            } as ListedStudio,
                        ],
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should return a not_logged_in error if there is no token', async () => {
                authMock.isAuthenticated.mockResolvedValueOnce(false);
                authMock.authenticate.mockResolvedValueOnce({});
                authMock.getAuthToken.mockResolvedValueOnce(null);

                records.handleEvents([listUserStudios({}, 1)]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: false,
                        errorCode: 'not_logged_in',
                        errorMessage: 'The user is not logged in.',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should not include the inst', async () => {
                setResponse({
                    data: {
                        success: true,
                        studios: [
                            {
                                studioId: 'studio-id',
                                displayName: 'Studio',
                                role: 'member',
                                isPrimaryContact: false,
                                subscriptionTier: 'tier1',
                            } as ListedStudio,
                        ],
                    },
                });

                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: null,
                    inst: 'myInst',
                };

                records.handleEvents([listUserStudios({}, 1)]);

                await waitAsync();

                expect(getLastGet()).toEqual([
                    'http://localhost:3002/api/v2/studios/list',
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        studios: [
                            {
                                studioId: 'studio-id',
                                displayName: 'Studio',
                                role: 'member',
                                isPrimaryContact: false,
                                subscriptionTier: 'tier1',
                            } as ListedStudio,
                        ],
                    }),
                ]);
            });

            it('should support custom endpoints', async () => {
                setResponse({
                    data: {
                        success: true,
                        studios: [
                            {
                                studioId: 'studio-id',
                                displayName: 'Studio',
                                role: 'member',
                                isPrimaryContact: false,
                                subscriptionTier: 'tier1',
                            } as ListedStudio,
                        ],
                    },
                });

                customAuthMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    listUserStudios({ endpoint: 'http://localhost:9999' }, 1),
                ]);

                await waitAsync();

                expect(getLastGet()).toEqual([
                    'http://localhost:9999/api/v2/studios/list',
                    {
                        validateStatus: expect.any(Function),
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        studios: [
                            {
                                studioId: 'studio-id',
                                displayName: 'Studio',
                                role: 'member',
                                isPrimaryContact: false,
                                subscriptionTier: 'tier1',
                            } as ListedStudio,
                        ],
                    }),
                ]);
            });
        });

        describe('get_records_endpoint', () => {
            it('should return the authOrigin', async () => {
                records.handleEvents([getRecordsEndpoint(1)]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, 'http://localhost:3302'),
                ]);
            });
        });

        describe('record_package_version', () => {
            let fetch: jest.Mock<
                Promise<{
                    status: number;
                    headers?: Headers;
                    json?: () => Promise<any>;
                    text?: () => Promise<string>;
                    body?: ReadableStream;
                }>
            >;

            const originalFetch = globalThis.fetch;

            beforeEach(() => {
                authMock.getRecordKeyPolicy.mockResolvedValue('subjectfull');
                require('axios').__reset();
                fetch = globalThis.fetch = jest.fn();
            });

            afterAll(() => {
                globalThis.fetch = originalFetch;
            });

            it('should record the package and file', async () => {
                fetch.mockResolvedValueOnce({
                    status: 200,
                    json: async () => ({
                        success: true,
                        recordName: 'test',
                        address: 'package',
                        auxFileResult: {
                            success: true,
                            uploadUrl: 'https://example.com/upload',
                            uploadMethod: 'POST',
                            uploadHeaders: {
                                test: 'abc',
                            },
                            fileName: 'test.txt',
                        },
                    }),
                });
                setNextResponse({
                    status: 200,
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                const state: StoredAux = {
                    version: 1,
                    state: {
                        test: createBot('test', {
                            color: 'red',
                        }),
                    },
                };

                records.handleEvents([
                    recordPackageVersion(
                        {
                            recordName: 'test',
                            address: 'package',
                            key: {
                                major: 1,
                                minor: 0,
                                patch: 0,
                                tag: '',
                            },
                            entitlements: [],
                            description: 'test',
                            state,
                        },
                        {},
                        1
                    ),
                ]);

                await waitAsync();

                expect(fetch).toHaveBeenCalledWith(
                    'http://localhost:3002/api/v3/callProcedure',
                    {
                        method: 'POST',
                        body: expect.any(String),
                        headers: expect.objectContaining({
                            Authorization: 'Bearer authToken',
                        }),
                    }
                );

                expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
                    procedure: 'recordPackageVersion',
                    input: {
                        recordName: 'test',
                        item: {
                            address: 'package',
                            key: {
                                major: 1,
                                minor: 0,
                                patch: 0,
                                tag: '',
                            },
                            auxFileRequest: {
                                fileSha256Hex:
                                    '8cd7595e8a4aa0ce1a2bbb142cd64317840305391be5e0409802e0f2a8e23940',
                                fileByteLength: 67,
                                fileMimeType: 'application/json',
                                fileDescription: 'test/package@v1.0.0',
                            },
                            entitlements: [],
                            description: 'test',
                        },
                    },
                });

                const json = stringify(state);

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'https://example.com/upload',
                        expect.expect('toBeUtf8EncodedText', json),
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);
                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'test',
                        address: 'package',
                        auxFileResult: {
                            success: true,
                            url: 'https://example.com/upload',
                            sha256Hash:
                                '8cd7595e8a4aa0ce1a2bbb142cd64317840305391be5e0409802e0f2a8e23940',
                        },
                    }),
                ]);
            });

            it('should support custom endpoints', async () => {
                fetch.mockResolvedValueOnce({
                    status: 200,
                    json: async () => ({
                        success: true,
                        recordName: 'test',
                        address: 'package',
                        auxFileResult: {
                            success: true,
                            uploadUrl: 'https://example.com/upload',
                            uploadMethod: 'POST',
                            uploadHeaders: {
                                test: 'abc',
                            },
                            fileName: 'test.txt',
                        },
                    }),
                });
                setNextResponse({
                    status: 200,
                });

                customAuthMock.isAuthenticated.mockResolvedValueOnce(true);
                customAuthMock.getAuthToken.mockResolvedValueOnce('authToken');

                const state: StoredAux = {
                    version: 1,
                    state: {
                        test: createBot('test', {
                            color: 'red',
                        }),
                    },
                };

                records.handleEvents([
                    recordPackageVersion(
                        {
                            recordName: 'test',
                            address: 'package',
                            key: {
                                major: 1,
                                minor: 0,
                                patch: 0,
                                tag: '',
                            },
                            entitlements: [],
                            description: 'test',
                            state,
                        },
                        { endpoint: 'http://localhost:9999' },
                        1
                    ),
                ]);

                await waitAsync();

                expect(fetch).toHaveBeenCalledWith(
                    'http://localhost:9999/api/v3/callProcedure',
                    {
                        method: 'POST',
                        body: expect.any(String),
                        headers: expect.objectContaining({
                            Authorization: 'Bearer authToken',
                        }),
                    }
                );

                expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
                    procedure: 'recordPackageVersion',
                    input: {
                        recordName: 'test',
                        item: {
                            address: 'package',
                            key: {
                                major: 1,
                                minor: 0,
                                patch: 0,
                                tag: '',
                            },
                            auxFileRequest: {
                                fileSha256Hex:
                                    '8cd7595e8a4aa0ce1a2bbb142cd64317840305391be5e0409802e0f2a8e23940',
                                fileByteLength: 67,
                                fileMimeType: 'application/json',
                                fileDescription: 'test/package@v1.0.0',
                            },
                            entitlements: [],
                            description: 'test',
                        },
                    },
                });

                const json = stringify(state);

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'https://example.com/upload',
                        expect.expect('toBeUtf8EncodedText', json),
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);
                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'test',
                        address: 'package',
                        auxFileResult: {
                            success: true,
                            url: 'https://example.com/upload',
                            sha256Hash:
                                '8cd7595e8a4aa0ce1a2bbb142cd64317840305391be5e0409802e0f2a8e23940',
                        },
                    }),
                ]);
            });

            it('should include the inst', async () => {
                fetch.mockResolvedValueOnce({
                    status: 200,
                    json: async () => ({
                        success: true,
                        recordName: 'test',
                        address: 'package',
                        auxFileResult: {
                            success: true,
                            uploadUrl: 'https://example.com/upload',
                            uploadMethod: 'POST',
                            uploadHeaders: {
                                test: 'abc',
                            },
                            fileName: 'test.txt',
                        },
                    }),
                });
                setNextResponse({
                    status: 200,
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: null,
                    inst: 'myInst',
                };

                const state: StoredAux = {
                    version: 1,
                    state: {
                        test: createBot('test', {
                            color: 'red',
                        }),
                    },
                };

                records.handleEvents([
                    recordPackageVersion(
                        {
                            recordName: 'test',
                            address: 'package',
                            key: {
                                major: 1,
                                minor: 0,
                                patch: 0,
                                tag: '',
                            },
                            entitlements: [],
                            description: 'test',
                            state,
                        },
                        {},
                        1
                    ),
                ]);

                await waitAsync();

                expect(fetch).toHaveBeenCalledWith(
                    'http://localhost:3002/api/v3/callProcedure',
                    {
                        method: 'POST',
                        body: expect.any(String),
                        headers: expect.objectContaining({
                            Authorization: 'Bearer authToken',
                        }),
                    }
                );

                expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
                    procedure: 'recordPackageVersion',
                    input: {
                        recordName: 'test',
                        item: {
                            address: 'package',
                            key: {
                                major: 1,
                                minor: 0,
                                patch: 0,
                                tag: '',
                            },
                            auxFileRequest: {
                                fileSha256Hex:
                                    '8cd7595e8a4aa0ce1a2bbb142cd64317840305391be5e0409802e0f2a8e23940',
                                fileByteLength: 67,
                                fileMimeType: 'application/json',
                                fileDescription: 'test/package@v1.0.0',
                            },
                            entitlements: [],
                            description: 'test',
                        },
                        instances: ['/myInst'],
                    },
                });

                const json = stringify(state);

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'https://example.com/upload',
                        expect.expect('toBeUtf8EncodedText', json),
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);
                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'test',
                        address: 'package',
                        auxFileResult: {
                            success: true,
                            url: 'https://example.com/upload',
                            sha256Hash:
                                '8cd7595e8a4aa0ce1a2bbb142cd64317840305391be5e0409802e0f2a8e23940',
                        },
                    }),
                ]);
            });

            it('should not include the inst if it is static', async () => {
                fetch.mockResolvedValueOnce({
                    status: 200,
                    json: async () => ({
                        success: true,
                        recordName: 'test',
                        address: 'package',
                        auxFileResult: {
                            success: true,
                            uploadUrl: 'https://example.com/upload',
                            uploadMethod: 'POST',
                            uploadHeaders: {
                                test: 'abc',
                            },
                            fileName: 'test.txt',
                        },
                    }),
                });
                setNextResponse({
                    status: 200,
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: null,
                    inst: 'myInst',
                    isStatic: true,
                };

                const state: StoredAux = {
                    version: 1,
                    state: {
                        test: createBot('test', {
                            color: 'red',
                        }),
                    },
                };

                records.handleEvents([
                    recordPackageVersion(
                        {
                            recordName: 'test',
                            address: 'package',
                            key: {
                                major: 1,
                                minor: 0,
                                patch: 0,
                                tag: '',
                            },
                            entitlements: [],
                            description: 'test',
                            state,
                        },
                        {},
                        1
                    ),
                ]);

                await waitAsync();

                expect(fetch).toHaveBeenCalledWith(
                    'http://localhost:3002/api/v3/callProcedure',
                    {
                        method: 'POST',
                        body: expect.any(String),
                        headers: expect.objectContaining({
                            Authorization: 'Bearer authToken',
                        }),
                    }
                );

                expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
                    procedure: 'recordPackageVersion',
                    input: {
                        recordName: 'test',
                        item: {
                            address: 'package',
                            key: {
                                major: 1,
                                minor: 0,
                                patch: 0,
                                tag: '',
                            },
                            auxFileRequest: {
                                fileSha256Hex:
                                    '8cd7595e8a4aa0ce1a2bbb142cd64317840305391be5e0409802e0f2a8e23940',
                                fileByteLength: 67,
                                fileMimeType: 'application/json',
                                fileDescription: 'test/package@v1.0.0',
                            },
                            entitlements: [],
                            description: 'test',
                        },
                    },
                });

                const json = stringify(state);

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'https://example.com/upload',
                        expect.expect('toBeUtf8EncodedText', json),
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);
                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'test',
                        address: 'package',
                        auxFileResult: {
                            success: true,
                            url: 'https://example.com/upload',
                            sha256Hash:
                                '8cd7595e8a4aa0ce1a2bbb142cd64317840305391be5e0409802e0f2a8e23940',
                        },
                    }),
                ]);
            });

            it('should include the markers', async () => {
                fetch.mockResolvedValueOnce({
                    status: 200,
                    json: async () => ({
                        success: true,
                        recordName: 'test',
                        address: 'package',
                        auxFileResult: {
                            success: true,
                            uploadUrl: 'https://example.com/upload',
                            uploadMethod: 'POST',
                            uploadHeaders: {
                                test: 'abc',
                            },
                            fileName: 'test.txt',
                        },
                    }),
                });
                setNextResponse({
                    status: 200,
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                const state: StoredAux = {
                    version: 1,
                    state: {
                        test: createBot('test', {
                            color: 'red',
                        }),
                    },
                };

                records.handleEvents([
                    recordPackageVersion(
                        {
                            recordName: 'test',
                            address: 'package',
                            key: {
                                major: 1,
                                minor: 0,
                                patch: 0,
                                tag: '',
                            },
                            entitlements: [],
                            description: 'test',
                            state,
                            markers: [PUBLIC_READ_MARKER],
                        },
                        {},
                        1
                    ),
                ]);

                await waitAsync();

                expect(fetch).toHaveBeenCalledWith(
                    'http://localhost:3002/api/v3/callProcedure',
                    {
                        method: 'POST',
                        body: expect.any(String),
                        headers: expect.objectContaining({
                            Authorization: 'Bearer authToken',
                        }),
                    }
                );

                expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
                    procedure: 'recordPackageVersion',
                    input: {
                        recordName: 'test',
                        item: {
                            address: 'package',
                            key: {
                                major: 1,
                                minor: 0,
                                patch: 0,
                                tag: '',
                            },
                            auxFileRequest: {
                                fileSha256Hex:
                                    '8cd7595e8a4aa0ce1a2bbb142cd64317840305391be5e0409802e0f2a8e23940',
                                fileByteLength: 67,
                                fileMimeType: 'application/json',
                                fileDescription: 'test/package@v1.0.0',
                            },
                            entitlements: [],
                            description: 'test',
                            markers: [PUBLIC_READ_MARKER],
                        },
                    },
                });

                const json = stringify(state);

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'https://example.com/upload',
                        expect.expect('toBeUtf8EncodedText', json),
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);
                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'test',
                        address: 'package',
                        auxFileResult: {
                            success: true,
                            url: 'https://example.com/upload',
                            sha256Hash:
                                '8cd7595e8a4aa0ce1a2bbb142cd64317840305391be5e0409802e0f2a8e23940',
                        },
                    }),
                ]);
            });

            it('should attempt to login if not authenticated', async () => {
                fetch.mockResolvedValueOnce({
                    status: 200,
                    json: async () => ({
                        success: true,
                        recordName: 'test',
                        address: 'package',
                        auxFileResult: {
                            success: true,
                            uploadUrl: 'https://example.com/upload',
                            uploadMethod: 'POST',
                            uploadHeaders: {
                                test: 'abc',
                            },
                            fileName: 'test.txt',
                        },
                    }),
                });
                setNextResponse({
                    status: 200,
                });

                authMock.isAuthenticated.mockResolvedValueOnce(false);
                authMock.authenticate.mockResolvedValueOnce({});
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                const state: StoredAux = {
                    version: 1,
                    state: {
                        test: createBot('test', {
                            color: 'red',
                        }),
                    },
                };

                records.handleEvents([
                    recordPackageVersion(
                        {
                            recordName: 'test',
                            address: 'package',
                            key: {
                                major: 1,
                                minor: 0,
                                patch: 0,
                                tag: '',
                            },
                            entitlements: [],
                            description: 'test',
                            state,
                        },
                        {},
                        1
                    ),
                ]);

                await waitAsync();

                expect(fetch).toHaveBeenCalledWith(
                    'http://localhost:3002/api/v3/callProcedure',
                    {
                        method: 'POST',
                        body: expect.any(String),
                        headers: expect.objectContaining({
                            Authorization: 'Bearer authToken',
                        }),
                    }
                );

                expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
                    procedure: 'recordPackageVersion',
                    input: {
                        recordName: 'test',
                        item: {
                            address: 'package',
                            key: {
                                major: 1,
                                minor: 0,
                                patch: 0,
                                tag: '',
                            },
                            auxFileRequest: {
                                fileSha256Hex:
                                    '8cd7595e8a4aa0ce1a2bbb142cd64317840305391be5e0409802e0f2a8e23940',
                                fileByteLength: 67,
                                fileMimeType: 'application/json',
                                fileDescription: 'test/package@v1.0.0',
                            },
                            entitlements: [],
                            description: 'test',
                        },
                    },
                });

                const json = stringify(state);

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'https://example.com/upload',
                        expect.expect('toBeUtf8EncodedText', json),
                        {
                            validateStatus: expect.any(Function),
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);
                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'test',
                        address: 'package',
                        auxFileResult: {
                            success: true,
                            url: 'https://example.com/upload',
                            sha256Hash:
                                '8cd7595e8a4aa0ce1a2bbb142cd64317840305391be5e0409802e0f2a8e23940',
                        },
                    }),
                ]);

                expect(authMock.isAuthenticated).toHaveBeenCalled();
                expect(authMock.authenticate).toHaveBeenCalled();
                expect(authMock.getAuthToken).toHaveBeenCalled();
            });
        });

        describe('install_package', () => {
            let fetch: jest.Mock<
                Promise<{
                    status: number;
                    headers?: Headers;
                    json?: () => Promise<any>;
                    text?: () => Promise<string>;
                    body?: ReadableStream;
                }>
            >;

            const originalFetch = globalThis.fetch;

            beforeEach(() => {
                authMock.getRecordKeyPolicy.mockResolvedValue('subjectfull');
                require('axios').__reset();
                fetch = globalThis.fetch = jest.fn();
                vm.origin = {
                    recordName: null,
                    inst: 'myInst',
                };
            });

            afterAll(() => {
                globalThis.fetch = originalFetch;
            });

            it('should call the API to install the package', async () => {
                fetch.mockResolvedValueOnce({
                    status: 200,
                    json: async () => ({
                        success: true,
                        packageLoadId: 'packageLoadId',
                        package: {
                            id: 'packageId',
                            packageId: 'public',
                            address: 'address',
                            key: version(1),
                            entitlements: [],
                            description: '',
                            markers: [PUBLIC_READ_MARKER],
                            createdAtMs: 123,
                            sha256: 'sha256',
                            auxSha256: 'auxSha256',
                            auxFileName: 'fileName',
                            createdFile: true,
                            requiresReview: false,
                            sizeInBytes: 123,
                            approved: true,
                            approvalType: 'normal',
                        },
                    }),
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    installPackage('test', 'address', 'v1.0.0', {}, 1),
                ]);

                await waitAsync();

                expect(fetch).toHaveBeenCalledWith(
                    'http://localhost:3002/api/v3/callProcedure',
                    {
                        method: 'POST',
                        body: expect.any(String),
                        headers: expect.objectContaining({
                            Authorization: 'Bearer authToken',
                        }),
                    }
                );

                expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
                    procedure: 'installPackage',
                    input: {
                        recordName: null,
                        inst: 'myInst',
                        package: {
                            recordName: 'test',
                            address: 'address',
                            key: 'v1.0.0',
                        },
                        instances: ['/myInst'],
                    },
                });

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        packageLoadId: 'packageLoadId',
                        package: {
                            id: 'packageId',
                            packageId: 'public',
                            address: 'address',
                            key: version(1),
                            entitlements: [],
                            description: '',
                            markers: [PUBLIC_READ_MARKER],
                            createdAtMs: 123,
                            sha256: 'sha256',
                            auxSha256: 'auxSha256',
                            auxFileName: 'fileName',
                            createdFile: true,
                            requiresReview: false,
                            sizeInBytes: 123,
                            approved: true,
                            approvalType: 'normal',
                        },
                    }),
                    action('onPackageInstalled', null, null, {
                        packageLoadId: 'packageLoadId',
                        package: {
                            id: 'packageId',
                            packageId: 'public',
                            address: 'address',
                            key: version(1),
                            entitlements: [],
                            description: '',
                            markers: [PUBLIC_READ_MARKER],
                            createdAtMs: 123,
                            sha256: 'sha256',
                            auxSha256: 'auxSha256',
                            auxFileName: 'fileName',
                            createdFile: true,
                            requiresReview: false,
                            sizeInBytes: 123,
                            approved: true,
                            approvalType: 'normal',
                        },
                    }),
                ]);
            });

            it('should not attempt to authenticate', async () => {
                fetch.mockResolvedValueOnce({
                    status: 200,
                    json: async () => ({
                        success: true,
                        packageLoadId: 'packageLoadId',
                        package: {
                            id: 'packageId',
                            packageId: 'public',
                            address: 'address',
                            key: version(1),
                            entitlements: [],
                            description: '',
                            markers: [PUBLIC_READ_MARKER],
                            createdAtMs: 123,
                            sha256: 'sha256',
                            auxSha256: 'auxSha256',
                            auxFileName: 'fileName',
                            createdFile: true,
                            requiresReview: false,
                            sizeInBytes: 123,
                            approved: true,
                            approvalType: 'normal',
                        },
                    }),
                });

                authMock.getAuthToken.mockResolvedValueOnce(null);

                records.handleEvents([
                    installPackage('test', 'address', 'v1.0.0', {}, 1),
                ]);

                await waitAsync();

                expect(fetch).toHaveBeenCalledWith(
                    'http://localhost:3002/api/v3/callProcedure',
                    {
                        method: 'POST',
                        body: expect.any(String),
                        headers: expect.not.objectContaining({
                            Authorization: expect.any(String),
                        }),
                    }
                );

                expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
                    procedure: 'installPackage',
                    input: {
                        recordName: null,
                        inst: 'myInst',
                        package: {
                            recordName: 'test',
                            address: 'address',
                            key: 'v1.0.0',
                        },
                        instances: ['/myInst'],
                    },
                });

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        packageLoadId: 'packageLoadId',
                        package: {
                            id: 'packageId',
                            packageId: 'public',
                            address: 'address',
                            key: version(1),
                            entitlements: [],
                            description: '',
                            markers: [PUBLIC_READ_MARKER],
                            createdAtMs: 123,
                            sha256: 'sha256',
                            auxSha256: 'auxSha256',
                            auxFileName: 'fileName',
                            createdFile: true,
                            requiresReview: false,
                            sizeInBytes: 123,
                            approved: true,
                            approvalType: 'normal',
                        },
                    }),
                    action('onPackageInstalled', null, null, {
                        packageLoadId: 'packageLoadId',
                        package: {
                            id: 'packageId',
                            packageId: 'public',
                            address: 'address',
                            key: version(1),
                            entitlements: [],
                            description: '',
                            markers: [PUBLIC_READ_MARKER],
                            createdAtMs: 123,
                            sha256: 'sha256',
                            auxSha256: 'auxSha256',
                            auxFileName: 'fileName',
                            createdFile: true,
                            requiresReview: false,
                            sizeInBytes: 123,
                            approved: true,
                            approvalType: 'normal',
                        },
                    }),
                ]);

                expect(authMock.getAuthToken).toHaveBeenCalledTimes(1);
                expect(authMock.isAuthenticated).not.toHaveBeenCalled();
                expect(authMock.authenticate).not.toHaveBeenCalled();
            });

            it('should support installing packages without specifying a version key', async () => {
                fetch.mockResolvedValueOnce({
                    status: 200,
                    json: async () => ({
                        success: true,
                        packageLoadId: 'packageLoadId',
                        package: {
                            id: 'packageId',
                            packageId: 'public',
                            address: 'address',
                            key: version(1),
                            entitlements: [],
                            description: '',
                            markers: [PUBLIC_READ_MARKER],
                            createdAtMs: 123,
                            sha256: 'sha256',
                            auxSha256: 'auxSha256',
                            auxFileName: 'fileName',
                            createdFile: true,
                            requiresReview: false,
                            sizeInBytes: 123,
                            approved: true,
                            approvalType: 'normal',
                        },
                    }),
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    installPackage('test', 'address', null as any, {}, 1),
                ]);

                await waitAsync();

                expect(fetch).toHaveBeenCalledWith(
                    'http://localhost:3002/api/v3/callProcedure',
                    {
                        method: 'POST',
                        body: expect.any(String),
                        headers: expect.objectContaining({
                            Authorization: 'Bearer authToken',
                        }),
                    }
                );

                expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
                    procedure: 'installPackage',
                    input: {
                        recordName: null,
                        inst: 'myInst',
                        package: {
                            recordName: 'test',
                            address: 'address',
                            key: null,
                        },
                        instances: ['/myInst'],
                    },
                });

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        packageLoadId: 'packageLoadId',
                        package: {
                            id: 'packageId',
                            packageId: 'public',
                            address: 'address',
                            key: version(1),
                            entitlements: [],
                            description: '',
                            markers: [PUBLIC_READ_MARKER],
                            createdAtMs: 123,
                            sha256: 'sha256',
                            auxSha256: 'auxSha256',
                            auxFileName: 'fileName',
                            createdFile: true,
                            requiresReview: false,
                            sizeInBytes: 123,
                            approved: true,
                            approvalType: 'normal',
                        },
                    }),
                    action('onPackageInstalled', null, null, {
                        packageLoadId: 'packageLoadId',
                        package: {
                            id: 'packageId',
                            packageId: 'public',
                            address: 'address',
                            key: version(1),
                            entitlements: [],
                            description: '',
                            markers: [PUBLIC_READ_MARKER],
                            createdAtMs: 123,
                            sha256: 'sha256',
                            auxSha256: 'auxSha256',
                            auxFileName: 'fileName',
                            createdFile: true,
                            requiresReview: false,
                            sizeInBytes: 123,
                            approved: true,
                            approvalType: 'normal',
                        },
                    }),
                ]);
            });

            it('should fetch the package file to install packages in static insts', async () => {
                fetch.mockResolvedValueOnce({
                    status: 200,
                    json: async () =>
                        ({
                            success: true,
                            item: {
                                id: 'packageId',
                                packageId: 'public',
                                address: 'address',
                                key: version(1),
                                entitlements: [],
                                description: '',
                                markers: [PUBLIC_READ_MARKER],
                                createdAtMs: 123,
                                sha256: 'sha256',
                                auxSha256: 'auxSha256',
                                auxFileName: 'fileName',
                                createdFile: true,
                                requiresReview: false,
                                sizeInBytes: 123,
                                approved: true,
                                approvalType: 'normal',
                            },
                            auxFile: {
                                success: true,
                                requestMethod: 'GET',
                                requestUrl: 'https://example.com/aux-file',
                                requestHeaders: {
                                    test: 'abc',
                                },
                            },
                        } as GetPackageVersionResult),
                });

                setNextResponse({
                    status: 200,
                    data: {
                        version: 1,
                        state: {
                            test: createBot('test', {
                                abc: 'def',
                            }),
                        },
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: null,
                    inst: 'test',
                    isStatic: true,
                };

                records.handleEvents([
                    installPackage('test', 'address', 'v1.0.0', {}, 1),
                ]);

                await waitAsync();

                expect(fetch).toHaveBeenCalledWith(
                    'http://localhost:3002/api/v3/callProcedure',
                    {
                        method: 'POST',
                        body: expect.any(String),
                        headers: expect.objectContaining({
                            Authorization: 'Bearer authToken',
                        }),
                    }
                );

                expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
                    procedure: 'getPackageVersion',
                    input: {
                        recordName: 'test',
                        address: 'address',
                        key: 'v1.0.0',
                    },
                });

                expect(getRequests()).toEqual([
                    [
                        'GET',
                        'https://example.com/aux-file',
                        undefined,
                        {
                            headers: {
                                test: 'abc',
                            },
                            validateStatus: expect.any(Function),
                        },
                    ],
                ]);

                expect(vm.events).toEqual([
                    calcRemote(
                        installAuxFile(
                            {
                                version: 1,
                                state: {
                                    test: createBot('test', {
                                        abc: 'def',
                                    }),
                                },
                            },
                            'default'
                        )
                    ),
                    asyncResult(1, {
                        success: true,
                        packageLoadId: null,
                        package: {
                            id: 'packageId',
                            packageId: 'public',
                            address: 'address',
                            key: version(1),
                            entitlements: [],
                            description: '',
                            markers: [PUBLIC_READ_MARKER],
                            createdAtMs: 123,
                            sha256: 'sha256',
                            auxSha256: 'auxSha256',
                            auxFileName: 'fileName',
                            createdFile: true,
                            requiresReview: false,
                            sizeInBytes: 123,
                            approved: true,
                            approvalType: 'normal',
                        },
                    }),
                    action('onPackageInstalled', null, null, {
                        packageLoadId: null,
                        package: {
                            id: 'packageId',
                            packageId: 'public',
                            address: 'address',
                            key: version(1),
                            entitlements: [],
                            description: '',
                            markers: [PUBLIC_READ_MARKER],
                            createdAtMs: 123,
                            sha256: 'sha256',
                            auxSha256: 'auxSha256',
                            auxFileName: 'fileName',
                            createdFile: true,
                            requiresReview: false,
                            sizeInBytes: 123,
                            approved: true,
                            approvalType: 'normal',
                        },
                    }),
                ]);
            });

            it('should support installing packages in static insts without specifying a version key', async () => {
                fetch.mockResolvedValueOnce({
                    status: 200,
                    json: async () =>
                        ({
                            success: true,
                            item: {
                                id: 'packageId',
                                packageId: 'public',
                                address: 'address',
                                key: version(1),
                                entitlements: [],
                                description: '',
                                markers: [PUBLIC_READ_MARKER],
                                createdAtMs: 123,
                                sha256: 'sha256',
                                auxSha256: 'auxSha256',
                                auxFileName: 'fileName',
                                createdFile: true,
                                requiresReview: false,
                                sizeInBytes: 123,
                                approved: true,
                                approvalType: 'normal',
                            },
                            auxFile: {
                                success: true,
                                requestMethod: 'GET',
                                requestUrl: 'https://example.com/aux-file',
                                requestHeaders: {
                                    test: 'abc',
                                },
                            },
                        } as GetPackageVersionResult),
                });

                setNextResponse({
                    status: 200,
                    data: {
                        version: 1,
                        state: {
                            test: createBot('test', {
                                abc: 'def',
                            }),
                        },
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: null,
                    inst: 'test',
                    isStatic: true,
                };

                records.handleEvents([
                    installPackage('test', 'address', null, {}, 1),
                ]);

                await waitAsync();

                expect(fetch).toHaveBeenCalledWith(
                    'http://localhost:3002/api/v3/callProcedure',
                    {
                        method: 'POST',
                        body: expect.any(String),
                        headers: expect.objectContaining({
                            Authorization: 'Bearer authToken',
                        }),
                    }
                );

                expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
                    procedure: 'getPackageVersion',
                    input: {
                        recordName: 'test',
                        address: 'address',
                    },
                });

                expect(getRequests()).toEqual([
                    [
                        'GET',
                        'https://example.com/aux-file',
                        undefined,
                        {
                            headers: {
                                test: 'abc',
                            },
                            validateStatus: expect.any(Function),
                        },
                    ],
                ]);

                expect(vm.events).toEqual([
                    calcRemote(
                        installAuxFile(
                            {
                                version: 1,
                                state: {
                                    test: createBot('test', {
                                        abc: 'def',
                                    }),
                                },
                            },
                            'default'
                        )
                    ),
                    asyncResult(1, {
                        success: true,
                        packageLoadId: null,
                        package: {
                            id: 'packageId',
                            packageId: 'public',
                            address: 'address',
                            key: version(1),
                            entitlements: [],
                            description: '',
                            markers: [PUBLIC_READ_MARKER],
                            createdAtMs: 123,
                            sha256: 'sha256',
                            auxSha256: 'auxSha256',
                            auxFileName: 'fileName',
                            createdFile: true,
                            requiresReview: false,
                            sizeInBytes: 123,
                            approved: true,
                            approvalType: 'normal',
                        },
                    }),
                    action('onPackageInstalled', null, null, {
                        packageLoadId: null,
                        package: {
                            id: 'packageId',
                            packageId: 'public',
                            address: 'address',
                            key: version(1),
                            entitlements: [],
                            description: '',
                            markers: [PUBLIC_READ_MARKER],
                            createdAtMs: 123,
                            sha256: 'sha256',
                            auxSha256: 'auxSha256',
                            auxFileName: 'fileName',
                            createdFile: true,
                            requiresReview: false,
                            sizeInBytes: 123,
                            approved: true,
                            approvalType: 'normal',
                        },
                    }),
                ]);
            });

            it('should fail if the package file cannot be downloaded', async () => {
                fetch.mockResolvedValueOnce({
                    status: 200,
                    json: async () =>
                        ({
                            success: true,
                            item: {
                                id: 'packageId',
                                packageId: 'public',
                                address: 'address',
                                key: version(1),
                                entitlements: [],
                                description: '',
                                markers: [PUBLIC_READ_MARKER],
                                createdAtMs: 123,
                                sha256: 'sha256',
                                auxSha256: 'auxSha256',
                                auxFileName: 'fileName',
                                createdFile: true,
                                requiresReview: false,
                                sizeInBytes: 123,
                                approved: true,
                                approvalType: 'normal',
                            },
                            auxFile: {
                                success: true,
                                requestMethod: 'GET',
                                requestUrl: 'https://example.com/aux-file',
                                requestHeaders: {
                                    test: 'abc',
                                },
                            },
                        } as GetPackageVersionResult),
                });

                setNextResponse({
                    status: 404,
                    data: 'File not found',
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: null,
                    inst: 'test',
                    isStatic: true,
                };

                records.handleEvents([
                    installPackage('test', 'address', 'v1.0.0', {}, 1),
                ]);

                await waitAsync();

                expect(fetch).toHaveBeenCalledWith(
                    'http://localhost:3002/api/v3/callProcedure',
                    {
                        method: 'POST',
                        body: expect.any(String),
                        headers: expect.objectContaining({
                            Authorization: 'Bearer authToken',
                        }),
                    }
                );

                expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
                    procedure: 'getPackageVersion',
                    input: {
                        recordName: 'test',
                        address: 'address',
                        key: 'v1.0.0',
                    },
                });

                expect(getRequests()).toEqual([
                    [
                        'GET',
                        'https://example.com/aux-file',
                        undefined,
                        {
                            headers: {
                                test: 'abc',
                            },
                            validateStatus: expect.any(Function),
                        },
                    ],
                ]);

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: false,
                        errorCode: 'file_not_found',
                        errorMessage: 'The file was not found.',
                    }),
                ]);
            });
        });

        describe('list_installed_packages', () => {
            let fetch: jest.Mock<
                Promise<{
                    status: number;
                    headers?: Headers;
                    json?: () => Promise<any>;
                    text?: () => Promise<string>;
                    body?: ReadableStream;
                }>
            >;

            const originalFetch = globalThis.fetch;

            beforeEach(() => {
                authMock.getRecordKeyPolicy.mockResolvedValue('subjectfull');
                require('axios').__reset();
                fetch = globalThis.fetch = jest.fn();
                vm.origin = {
                    recordName: null,
                    inst: 'myInst',
                };
            });

            afterAll(() => {
                globalThis.fetch = originalFetch;
            });

            it('should call the API to get the list of installed packages', async () => {
                fetch.mockResolvedValueOnce({
                    status: 200,
                    json: async () => ({
                        success: true,
                        packages: [
                            {
                                id: 'loadedPackageId',
                                recordName: null,
                                inst: 'myInst',
                                branch: DEFAULT_BRANCH_NAME,
                                packageId: 'public',
                                packageVersionId: 'public@1.0.0',
                                userId: userId,
                            },
                            {
                                id: 'loadedPackageId2',
                                recordName: null,
                                inst: 'myInst',
                                branch: DEFAULT_BRANCH_NAME,
                                packageId: 'public',
                                packageVersionId: 'public@1.0.1',
                                userId: userId,
                            },
                        ],
                    }),
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([listInstalledPackages({}, 1)]);

                await waitAsync();

                expect(fetch).toHaveBeenCalledWith(
                    'http://localhost:3002/api/v3/callProcedure',
                    {
                        method: 'POST',
                        body: expect.any(String),
                        headers: expect.objectContaining({
                            Authorization: 'Bearer authToken',
                        }),
                    }
                );

                expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
                    procedure: 'listInstalledPackages',
                    input: {
                        recordName: null,
                        inst: 'myInst',
                        instances: ['/myInst'],
                    },
                });

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        packages: [
                            {
                                id: 'loadedPackageId',
                                recordName: null,
                                inst: 'myInst',
                                branch: DEFAULT_BRANCH_NAME,
                                packageId: 'public',
                                packageVersionId: 'public@1.0.0',
                                userId: userId,
                            },
                            {
                                id: 'loadedPackageId2',
                                recordName: null,
                                inst: 'myInst',
                                branch: DEFAULT_BRANCH_NAME,
                                packageId: 'public',
                                packageVersionId: 'public@1.0.1',
                                userId: userId,
                            },
                        ],
                    }),
                ]);
            });

            it('should not attempt to authenticate', async () => {
                fetch.mockResolvedValueOnce({
                    status: 200,
                    json: async () => ({
                        success: true,
                        packages: [
                            {
                                id: 'loadedPackageId',
                                recordName: null,
                                inst: 'myInst',
                                branch: DEFAULT_BRANCH_NAME,
                                packageId: 'public',
                                packageVersionId: 'public@1.0.0',
                                userId: userId,
                            },
                            {
                                id: 'loadedPackageId2',
                                recordName: null,
                                inst: 'myInst',
                                branch: DEFAULT_BRANCH_NAME,
                                packageId: 'public',
                                packageVersionId: 'public@1.0.1',
                                userId: userId,
                            },
                        ],
                    }),
                });

                // authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce(null);

                records.handleEvents([listInstalledPackages({}, 1)]);

                await waitAsync();

                expect(fetch).toHaveBeenCalledWith(
                    'http://localhost:3002/api/v3/callProcedure',
                    {
                        method: 'POST',
                        body: expect.any(String),
                        headers: expect.not.objectContaining({
                            Authorization: expect.any(String),
                        }),
                    }
                );

                expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
                    procedure: 'listInstalledPackages',
                    input: {
                        recordName: null,
                        inst: 'myInst',
                        instances: ['/myInst'],
                    },
                });

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        packages: [
                            {
                                id: 'loadedPackageId',
                                recordName: null,
                                inst: 'myInst',
                                branch: DEFAULT_BRANCH_NAME,
                                packageId: 'public',
                                packageVersionId: 'public@1.0.0',
                                userId: userId,
                            },
                            {
                                id: 'loadedPackageId2',
                                recordName: null,
                                inst: 'myInst',
                                branch: DEFAULT_BRANCH_NAME,
                                packageId: 'public',
                                packageVersionId: 'public@1.0.1',
                                userId: userId,
                            },
                        ],
                    }),
                ]);

                expect(authMock.getAuthToken).toHaveBeenCalledTimes(1);
                expect(authMock.isAuthenticated).not.toHaveBeenCalled();
                expect(authMock.authenticate).not.toHaveBeenCalled();
            });

            it('should return an error if the inst is a static inst', async () => {
                fetch.mockResolvedValueOnce({
                    status: 200,
                    json: async () => ({
                        success: true,
                        packages: [
                            {
                                id: 'loadedPackageId',
                                recordName: null,
                                inst: 'myInst',
                                branch: DEFAULT_BRANCH_NAME,
                                packageId: 'public',
                                packageVersionId: 'public@1.0.0',
                                userId: userId,
                            },
                            {
                                id: 'loadedPackageId2',
                                recordName: null,
                                inst: 'myInst',
                                branch: DEFAULT_BRANCH_NAME,
                                packageId: 'public',
                                packageVersionId: 'public@1.0.1',
                                userId: userId,
                            },
                        ],
                    }),
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                vm.origin = {
                    recordName: null,
                    inst: 'myInst',
                    isStatic: true,
                };

                records.handleEvents([listInstalledPackages({}, 1)]);

                await waitAsync();

                expect(fetch).not.toHaveBeenCalled();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: false,
                        errorCode: 'not_supported',
                        errorMessage:
                            'Listing packages is not supported for local insts.',
                    }),
                ]);
            });
        });

        describe('Common Errors', () => {
            const events = [
                [
                    'record_data',
                    recordData(
                        'myToken',
                        'myAddress',
                        {
                            myRecord: true,
                        },
                        false,
                        {},
                        1
                    ),
                ] as const,
                [
                    'get_record_data',
                    getRecordData('testRecord', 'myAddress', false, {}, 1),
                ] as const,
                [
                    'list_record_data',
                    listDataRecord('testRecord', null, {}, 1),
                ] as const,
                [
                    'erase_record_data',
                    eraseRecordData('myToken', 'myAddress', false, {}, 1),
                ] as const,
                [
                    'record_file',
                    recordFile(
                        'myToken',
                        'myFile',
                        'test.txt',
                        undefined,
                        {},
                        1
                    ),
                ] as const,
                [
                    'erase_file',
                    eraseFile('myToken', 'myFileUrl', {}, 1),
                ] as const,
                [
                    'record_event',
                    recordEvent('recordKey', 'eventName', 10, {}, 1),
                ] as const,
                [
                    'get_event_count',
                    getEventCount('testRecord', 'myAddress', {}, 1),
                ] as const,
                ['join_room', joinRoom('myRoom', {}, 1)] as const,
            ];

            describe.each(events)('%s', (desc, event) => {
                it('should fail if the authFactory returns null', async () => {
                    let factory = jest.fn();
                    records = new RecordsManager(
                        {
                            version: '1.0.0',
                            versionHash: '1234567890abcdef',
                            authOrigin: 'https://localhost:321',
                            recordsOrigin: 'https://localhost:145',
                        },
                        helper,
                        factory,
                        () => null
                    );

                    factory.mockReturnValueOnce(null);

                    records.handleEvents([event]);

                    await waitAsync();

                    expect(vm.events).toEqual([
                        asyncResult(1, {
                            success: false,
                            errorCode: 'not_supported',
                            errorMessage:
                                'Records are not supported on this inst.',
                        }),
                    ]);

                    expect(factory).toBeCalledWith(
                        'https://localhost:321',
                        expect.any(Boolean)
                    );
                });

                it('should fail if authOrigin is null and no endpoint is provided', async () => {
                    let factory = jest.fn();
                    records = new RecordsManager(
                        {
                            version: '1.0.0',
                            versionHash: '1234567890abcdef',
                            authOrigin: null,
                        },
                        helper,
                        factory,
                        () => null
                    );

                    factory.mockReturnValueOnce(null);

                    records.handleEvents([event]);

                    await waitAsync();

                    expect(vm.events).toEqual([
                        asyncResult(1, {
                            success: false,
                            errorCode: 'not_supported',
                            errorMessage:
                                'Records are not supported on this inst.',
                        }),
                    ]);

                    expect(factory).not.toBeCalled();
                });

                it('should attempt to use the endpoint provided in the event', async () => {
                    let factory = jest.fn();
                    records = new RecordsManager(
                        {
                            version: '1.0.0',
                            versionHash: '1234567890abcdef',
                            authOrigin: null,
                        },
                        helper,
                        factory,
                        () => null
                    );

                    let e = {
                        ...event,
                        options: {
                            ...event.options,
                            endpoint: 'http://localhost:999',
                        },
                    };

                    factory.mockReturnValueOnce(null);

                    records.handleEvents([e]);

                    await waitAsync();

                    expect(vm.events).toEqual([
                        asyncResult(1, {
                            success: false,
                            errorCode: 'not_supported',
                            errorMessage:
                                'Records are not supported on this inst.',
                        }),
                    ]);

                    expect(factory).toBeCalledWith(
                        'http://localhost:999',
                        expect.any(Boolean)
                    );
                });
            });
        });
    });

    describe('reportInst()', () => {
        beforeEach(() => {
            require('axios').__reset();
        });

        it('should send a POST request to /api/v2/records/insts/report', async () => {
            setResponse({
                data: {
                    success: true,
                    id: 'reportId',
                },
            });

            authMock.isAuthenticated.mockResolvedValueOnce(true);
            authMock.getAuthToken.mockResolvedValueOnce('authToken');

            await records.reportInst({
                recordName: null,
                inst: 'inst',
                automaticReport: false,
                reportReason: 'spam',
                reportReasonText: 'description',
                reportedUrl: 'url',
                reportedPermalink: 'permalink',
            });

            expect(getLastPost()).toEqual([
                'http://localhost:3002/api/v2/records/insts/report',
                {
                    recordName: null,
                    inst: 'inst',
                    automaticReport: false,
                    reportReason: 'spam',
                    reportReasonText: 'description',
                    reportedUrl: 'url',
                    reportedPermalink: 'permalink',
                },
                {
                    validateStatus: expect.any(Function),
                    headers: {
                        Authorization: 'Bearer authToken',
                    },
                },
            ]);
        });
    });
});
