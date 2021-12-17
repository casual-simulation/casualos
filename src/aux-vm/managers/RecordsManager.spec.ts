import {
    asyncResult,
    AuxPartitions,
    AuxRuntime,
    BotAction,
    botAdded,
    createBot,
    createMemoryPartition,
    deleteRecord,
    getRecords,
    iteratePartitions,
    LocalActions,
    MemoryPartition,
    publishRecord,
    recordData,
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

            it('should make a POST request to /api/records', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    },
                });

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
