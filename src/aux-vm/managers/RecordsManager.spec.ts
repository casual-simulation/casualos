import {
    asyncResult,
    AuxPartitions,
    AuxRuntime,
    BotAction,
    botAdded,
    createBot,
    createMemoryPartition,
    eraseRecordData,
    getRecordData,
    iteratePartitions,
    LocalActions,
    MemoryPartition,
    recordData,
    recordFile,
    eraseFile,
    approveDataRecord,
    listDataRecord,
    recordEvent,
    getEventCount,
    joinRoom,
    leaveRoom,
    setRoomOptions,
    getRoomOptions,
} from '@casual-simulation/aux-common';
import { Subject, Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';
import {
    GetRoomOptions,
    RecordsManager,
    RoomJoin,
    RoomLeave,
    SetRoomOptions,
} from './RecordsManager';
import { AuthHelperInterface } from './AuthHelperInterface';
import { TestAuxVM } from '../vm/test/TestAuxVM';
import { BotHelper } from './BotHelper';
import stringify from '@casual-simulation/fast-json-stable-stringify';
import 'aux-jest-matchers';

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
    };
    let customAuth: AuthHelperInterface;
    let customAuthMock = {
        isAuthenticated: jest.fn(),
        authenticate: jest.fn(),
        getAuthToken: jest.fn(),
        createPublicRecordKey: jest.fn(),
        provideSmsNumber: jest.fn(),
    };
    let authFactory: (endpoint: string) => AuthHelperInterface;
    let sub: Subscription;

    beforeEach(async () => {
        actions = [];
        sub = new Subscription();
        helper = createHelper();
        authMock = auth = {
            isAuthenticated: jest.fn(),
            authenticate: jest.fn(),
            getAuthToken: jest.fn(),
            createPublicRecordKey: jest.fn(),
            unsubscribe: jest.fn(),
            openAccountPage: jest.fn(),
            cancelLogin: jest.fn(),
            loginStatus: null,
            loginUIStatus: null,
            provideEmailAddress: jest.fn(),
            setUseCustomUI: jest.fn(),
            provideSmsNumber: jest.fn(),
            authenticateInBackground: jest.fn(),
            getRecordKeyPolicy: jest.fn(),
            getRecordsOrigin: jest
                .fn()
                .mockResolvedValue('http://localhost:3002'),
            get supportsAuthentication() {
                return true;
            },
            get closed() {
                return false;
            },
            get origin() {
                return 'http://localhost:3002';
            },
        };

        customAuthMock = customAuth = {
            isAuthenticated: jest.fn(),
            authenticate: jest.fn(),
            getAuthToken: jest.fn(),
            createPublicRecordKey: jest.fn(),
            unsubscribe: jest.fn(),
            openAccountPage: jest.fn(),
            cancelLogin: jest.fn(),
            loginStatus: null,
            loginUIStatus: null,
            provideEmailAddress: jest.fn(),
            setUseCustomUI: jest.fn(),
            provideSmsNumber: jest.fn(),
            authenticateInBackground: jest.fn(),
            getRecordKeyPolicy: jest.fn(),
            getRecordsOrigin: jest
                .fn()
                .mockResolvedValue('http://localhost:9999'),
            get supportsAuthentication() {
                return true;
            },
            get closed() {
                return false;
            },
            get origin() {
                return 'http://localhost:9999';
            },
        };

        authFactory = (endpoint: string) =>
            endpoint === 'http://localhost:9999' ? customAuth : auth;

        records = new RecordsManager(
            {
                version: '1.0.0',
                versionHash: '1234567890abcdef',
                recordsOrigin: 'http://localhost:3002',
                authOrigin: 'http://localhost:3002',
            },
            helper,
            authFactory
        );
    });

    function createHelper() {
        vm = new TestAuxVM(userId);
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
                    approveDataRecord(
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
                    approveDataRecord(
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
                        headers: {},
                    },
                ]);
                expect(authMock.isAuthenticated).not.toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).not.toBeCalled();
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

                records.handleEvents([
                    approveDataRecord(
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
                        recordKey: 'myToken',
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
                expect(authMock.getAuthToken).not.toBeCalled();
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
                    { validateStatus: expect.any(Function) },
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
                    { validateStatus: expect.any(Function) },
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
                    approveDataRecord(
                        getRecordData('testRecord', 'myAddress', true, {}, 1)
                    ),
                ]);

                await waitAsync();

                expect(getLastGet()).toEqual([
                    'http://localhost:3002/api/v2/records/manual/data?recordName=testRecord&address=myAddress',
                    { validateStatus: expect.any(Function) },
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
                    approveDataRecord(
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
                    { validateStatus: expect.any(Function) },
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
                    { validateStatus: expect.any(Function) },
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
                    { validateStatus: expect.any(Function) },
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
                    { validateStatus: expect.any(Function) },
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
                    approveDataRecord(
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
                    approveDataRecord(
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

                records.handleEvents([
                    eraseRecordData('myToken', 'myAddress', false, {}, 1),
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
                expect(authMock.getAuthToken).not.toBeCalled();
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

                records.handleEvents([
                    approveDataRecord(
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
                expect(authMock.getAuthToken).not.toBeCalled();
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

                records.handleEvents([
                    recordFile('myToken', true, 'test.html', undefined, {}, 1),
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
                expect(authMock.getAuthToken).not.toBeCalled();
                expect(authMock.getRecordKeyPolicy).toBeCalled();
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

                records.handleEvents([
                    eraseFile('myToken', 'myFileUrl', {}, 1),
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
                expect(authMock.getAuthToken).not.toBeCalled();
                expect(authMock.getRecordKeyPolicy).toBeCalled();
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

                records.handleEvents([
                    recordEvent('recordKey', 'eventName', 10, {}, 1),
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
                expect(authMock.getAuthToken).not.toBeCalled();
                expect(authMock.getRecordKeyPolicy).toBeCalled();
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
                    { validateStatus: expect.any(Function) },
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
                    { validateStatus: expect.any(Function) },
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
                        factory
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

                    expect(factory).toBeCalledWith('https://localhost:321');
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
                        factory
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
                        factory
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

                    expect(factory).toBeCalledWith('http://localhost:999');
                });
            });
        });
    });
});
