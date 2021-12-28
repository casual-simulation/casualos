import {
    asyncResult,
    AuxPartitions,
    AuxRuntime,
    BotAction,
    botAdded,
    createBot,
    createMemoryPartition,
    deleteRecord,
    getRecordData,
    getRecords,
    iteratePartitions,
    LocalActions,
    MemoryPartition,
    publishRecord,
    recordData,
    recordFile,
} from '@casual-simulation/aux-common';
import { Subject, Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';
import { RecordsManager } from './RecordsManager';
import { AuthHelperInterface } from './AuthHelperInterface';
import { TestAuxVM } from '../vm/test/TestAuxVM';
import { BotHelper } from './BotHelper';

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
    };
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
            get closed() {
                return false;
            },
        };

        records = new RecordsManager(
            {
                version: '1.0.0',
                versionHash: '1234567890abcdef',
                recordsOrigin: 'http://localhost:3002',
            },
            helper,
            auth
        );
    });

    function createHelper() {
        vm = new TestAuxVM(userId);
        const helper = new BotHelper(vm);

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
                    getRecordData('testRecord', 'myAddress', 1),
                ]);

                await waitAsync();

                expect(getLastGet()).toEqual([
                    'http://localhost:3002/api/v2/records/data?recordName=testRecord&address=myAddress',
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
        });

        describe('record_file', () => {
            beforeEach(() => {
                require('axios').__reset();
            });

            it('should make a POST request to /api/v2/records/file', async () => {
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
                    recordFile('myToken', 'myFile', 'test.txt', 1),
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
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'post',
                        'https://example.com/upload',
                        'myFile',
                        {
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);
            });
        });

        // describe('get_record', () => {
        //     beforeEach(() => {
        //         require('axios').__reset();
        //     });

        //     it('should make a GET request to /api/records', async () => {
        //         setResponse({
        //             data: {
        //                 records: [
        //                     {
        //                         authID: 'myAuthID',
        //                         space: 'tempRestricted',
        //                         address: 'myAddress',
        //                         data: { abc: 'def' },
        //                     },
        //                 ],
        //                 totalCount: 5,
        //                 hasMoreRecords: true,
        //                 cursor: 'myCursor',
        //             },
        //         });

        //         records.handleEvents([
        //             getRecords(
        //                 'myToken',
        //                 'myAuthID',
        //                 'tempRestricted',
        //                 {
        //                     prefix: 'myPrefix',
        //                 },
        //                 1
        //             ),
        //         ]);

        //         expect(getLastGet()).toEqual([
        //             'http://localhost:3002/api/records?prefix=myPrefix&authID=myAuthID&space=tempRestricted',
        //             {
        //                 headers: {
        //                     Authorization: 'Bearer myToken',
        //                 },
        //             },
        //         ]);

        //         await waitAsync();

        //         expect(actions).toEqual([
        //             asyncResult(1, {
        //                 records: [
        //                     {
        //                         authID: 'myAuthID',
        //                         space: 'tempRestricted',
        //                         address: 'myAddress',
        //                         data: { abc: 'def' },
        //                     },
        //                 ],
        //                 totalCount: 5,
        //                 hasMoreRecords: true,
        //                 cursor: 'myCursor',
        //             }),
        //         ]);
        //     });

        //     it('should be able to include the given address', async () => {
        //         setResponse({
        //             data: {
        //                 records: [
        //                     {
        //                         authID: 'myAuthID',
        //                         space: 'tempRestricted',
        //                         address: 'myAddress',
        //                         data: { abc: 'def' },
        //                     },
        //                 ],
        //                 totalCount: 5,
        //                 hasMoreRecords: true,
        //                 cursor: 'myCursor',
        //             },
        //         });

        //         records.handleEvents([
        //             getRecords(
        //                 'myToken',
        //                 'myAuthID',
        //                 'tempRestricted',
        //                 {
        //                     address: 'myAddress',
        //                 },
        //                 1
        //             ),
        //         ]);

        //         expect(getLastGet()).toEqual([
        //             'http://localhost:3002/api/records?address=myAddress&authID=myAuthID&space=tempRestricted',
        //             {
        //                 headers: {
        //                     Authorization: 'Bearer myToken',
        //                 },
        //             },
        //         ]);
        //     });

        //     it('should be able to include the given cursor', async () => {
        //         setResponse({
        //             data: {
        //                 records: [
        //                     {
        //                         authID: 'myAuthID',
        //                         space: 'tempRestricted',
        //                         address: 'myAddress',
        //                         data: { abc: 'def' },
        //                     },
        //                 ],
        //                 totalCount: 5,
        //                 hasMoreRecords: true,
        //                 cursor: 'myCursor',
        //             },
        //         });

        //         records.handleEvents([
        //             getRecords(
        //                 'myToken',
        //                 'myAuthID',
        //                 'tempRestricted',
        //                 {
        //                     cursor: 'myCursor',
        //                 },
        //                 1
        //             ),
        //         ]);

        //         expect(getLastGet()).toEqual([
        //             'http://localhost:3002/api/records?authID=myAuthID&cursor=myCursor&space=tempRestricted',
        //             {
        //                 headers: {
        //                     Authorization: 'Bearer myToken',
        //                 },
        //             },
        //         ]);
        //     });

        //     it('should include the authorization header even when no token is used', async () => {
        //         setResponse({
        //             data: {
        //                 records: [
        //                     {
        //                         authID: 'myAuthID',
        //                         space: 'tempRestricted',
        //                         address: 'myAddress',
        //                         data: { abc: 'def' },
        //                     },
        //                 ],
        //                 totalCount: 5,
        //                 hasMoreRecords: true,
        //                 cursor: 'myCursor',
        //             },
        //         });

        //         records.handleEvents([
        //             getRecords(
        //                 null,
        //                 'myAuthID',
        //                 'tempRestricted',
        //                 {
        //                     cursor: 'myCursor',
        //                 },
        //                 1
        //             ),
        //         ]);

        //         expect(getLastGet()).toEqual([
        //             'http://localhost:3002/api/records?authID=myAuthID&cursor=myCursor&space=tempRestricted',
        //             {
        //                 headers: {
        //                     Authorization: 'None',
        //                 },
        //             },
        //         ]);
        //     });
        // });

        // describe('delete_record', () => {
        //     beforeEach(() => {
        //         require('axios').__reset();
        //     });

        //     it('should make a POST request to /api/records/delete', async () => {
        //         setResponse({
        //             data: null,
        //             status: 200,
        //         });

        //         records.handleEvents([
        //             deleteRecord('myToken', 'myAddress', 'tempRestricted', 1),
        //         ]);

        //         expect(getLastPost()).toEqual([
        //             'http://localhost:3002/api/records/delete',
        //             {
        //                 token: 'myToken',
        //                 address: 'myAddress',
        //                 space: 'tempRestricted',
        //             },
        //         ]);

        //         await waitAsync();

        //         expect(actions).toEqual([asyncResult(1, null)]);
        //     });
        // });
    });
});
