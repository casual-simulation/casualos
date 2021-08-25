import {
    asyncResult,
    AuxPartitions,
    AuxRuntime,
    BotAction,
    botAdded,
    createBot,
    createMemoryPartition,
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
                        issuer: 'myIssuer',
                    }),
                ]);
            });
        });
    });
});
