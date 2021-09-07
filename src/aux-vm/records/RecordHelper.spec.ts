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
    MemoryPartition,
    publishRecord,
} from '@casual-simulation/aux-common';
import { Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';
import { AuxHelper } from '../vm/AuxHelper';
import { RecordHelper } from './RecordHelper';

jest.mock('axios');

console.log = jest.fn();

describe('RecordHelper', () => {
    let records: RecordHelper;
    let runtime: AuxRuntime;
    let actions: BotAction[];
    let memory: MemoryPartition;
    let userId: string = 'user';
    let helper: AuxHelper;
    let sub: Subscription;

    beforeEach(async () => {
        actions = [];
        sub = new Subscription();
        memory = createMemoryPartition({
            type: 'memory',
            initialState: {},
        });
        memory.space = 'shared';
        await memory.applyEvents([botAdded(createBot('user'))]);
        helper = createHelper({
            shared: memory,
        });

        records = new RecordHelper(
            {
                version: '1.0.0',
                versionHash: '1234567890abcdef',
                recordsOrigin: 'http://localhost:3002',
            },
            helper
        );
    });

    function createHelper(partitions: AuxPartitions) {
        runtime = new AuxRuntime(
            {
                hash: 'hash',
                major: 1,
                minor: 0,
                patch: 0,
                version: 'v1.0.0',
            },
            {
                supportsAR: false,
                supportsVR: false,
                isCollaborative: true,
                ab1BootstrapUrl: 'ab1Bootstrap',
            }
        );
        const helper = new AuxHelper(partitions, runtime);

        for (let [, partition] of iteratePartitions(partitions)) {
            sub.add(
                partition.onStateUpdated
                    .pipe(
                        tap((e) => {
                            runtime.stateUpdated(e);
                        })
                    )
                    .subscribe(null, (e: any) => console.error(e))
            );
        }

        runtime.userId = userId;
        sub.add(helper.localEvents.subscribe((a) => actions.push(...a)));

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
        describe('publish_record', () => {
            beforeEach(() => {
                require('axios').__reset();
            });

            it('should make a POST request to /api/records', async () => {
                setResponse({
                    data: {
                        space: 'tempRestricted',
                        address: 'myAddress',
                        issuer: 'myIssuer',
                    },
                });

                records.handleEvents([
                    publishRecord(
                        'myToken',
                        'myAddress',
                        {
                            myRecord: true,
                        },
                        'tempRestricted',
                        1
                    ),
                ]);

                expect(getLastPost()).toEqual([
                    'http://localhost:3002/api/records',
                    {
                        token: 'myToken',
                        address: 'myAddress',
                        space: 'tempRestricted',
                        record: {
                            myRecord: true,
                        },
                    },
                ]);

                await waitAsync();

                expect(actions).toEqual([
                    asyncResult(1, {
                        space: 'tempRestricted',
                        address: 'myAddress',
                        authID: 'myIssuer',
                    }),
                ]);
            });
        });

        describe('get_record', () => {
            beforeEach(() => {
                require('axios').__reset();
            });

            it('should make a GET request to /api/records', async () => {
                setResponse({
                    data: {
                        records: [
                            {
                                authID: 'myAuthID',
                                space: 'tempRestricted',
                                address: 'myAddress',
                                data: { abc: 'def' },
                            },
                        ],
                        totalCount: 5,
                        hasMoreRecords: true,
                        cursor: 'myCursor',
                    },
                });

                records.handleEvents([
                    getRecords(
                        'myToken',
                        'myAuthID',
                        'tempRestricted',
                        {
                            prefix: 'myPrefix',
                        },
                        1
                    ),
                ]);

                expect(getLastGet()).toEqual([
                    'http://localhost:3002/api/records?prefix=myPrefix&authID=myAuthID&space=tempRestricted',
                    {
                        headers: {
                            Authorization: 'Bearer myToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(actions).toEqual([
                    asyncResult(1, {
                        records: [
                            {
                                authID: 'myAuthID',
                                space: 'tempRestricted',
                                address: 'myAddress',
                                data: { abc: 'def' },
                            },
                        ],
                        totalCount: 5,
                        hasMoreRecords: true,
                        cursor: 'myCursor',
                    }),
                ]);
            });

            it('should be able to include the given address', async () => {
                setResponse({
                    data: {
                        records: [
                            {
                                authID: 'myAuthID',
                                space: 'tempRestricted',
                                address: 'myAddress',
                                data: { abc: 'def' },
                            },
                        ],
                        totalCount: 5,
                        hasMoreRecords: true,
                        cursor: 'myCursor',
                    },
                });

                records.handleEvents([
                    getRecords(
                        'myToken',
                        'myAuthID',
                        'tempRestricted',
                        {
                            address: 'myAddress',
                        },
                        1
                    ),
                ]);

                expect(getLastGet()).toEqual([
                    'http://localhost:3002/api/records?address=myAddress&authID=myAuthID&space=tempRestricted',
                    {
                        headers: {
                            Authorization: 'Bearer myToken',
                        },
                    },
                ]);
            });

            it('should be able to include the given cursor', async () => {
                setResponse({
                    data: {
                        records: [
                            {
                                authID: 'myAuthID',
                                space: 'tempRestricted',
                                address: 'myAddress',
                                data: { abc: 'def' },
                            },
                        ],
                        totalCount: 5,
                        hasMoreRecords: true,
                        cursor: 'myCursor',
                    },
                });

                records.handleEvents([
                    getRecords(
                        'myToken',
                        'myAuthID',
                        'tempRestricted',
                        {
                            cursor: 'myCursor',
                        },
                        1
                    ),
                ]);

                expect(getLastGet()).toEqual([
                    'http://localhost:3002/api/records?authID=myAuthID&cursor=myCursor&space=tempRestricted',
                    {
                        headers: {
                            Authorization: 'Bearer myToken',
                        },
                    },
                ]);
            });

            it('should include the authorization header even when no token is used', async () => {
                setResponse({
                    data: {
                        records: [
                            {
                                authID: 'myAuthID',
                                space: 'tempRestricted',
                                address: 'myAddress',
                                data: { abc: 'def' },
                            },
                        ],
                        totalCount: 5,
                        hasMoreRecords: true,
                        cursor: 'myCursor',
                    },
                });

                records.handleEvents([
                    getRecords(
                        null,
                        'myAuthID',
                        'tempRestricted',
                        {
                            cursor: 'myCursor',
                        },
                        1
                    ),
                ]);

                expect(getLastGet()).toEqual([
                    'http://localhost:3002/api/records?authID=myAuthID&cursor=myCursor&space=tempRestricted',
                    {
                        headers: {
                            Authorization: 'None',
                        },
                    },
                ]);
            });
        });

        describe('delete_record', () => {
            beforeEach(() => {
                require('axios').__reset();
            });

            it('should make a POST request to /api/records/delete', async () => {
                setResponse({
                    data: null,
                    status: 200,
                });

                records.handleEvents([
                    deleteRecord('myToken', 'myAddress', 'tempRestricted', 1),
                ]);

                expect(getLastPost()).toEqual([
                    'http://localhost:3002/api/records/delete',
                    {
                        token: 'myToken',
                        address: 'myAddress',
                        space: 'tempRestricted',
                    },
                ]);

                await waitAsync();

                expect(actions).toEqual([asyncResult(1, null)]);
            });
        });
    });
});
