import { Subscription } from 'rxjs';
import {
    InstUpdate,
    applyUpdatesToInst,
    asyncResult,
    botAdded,
    botUpdated,
    createBot,
    createInitializationUpdate,
    getCurrentInstUpdate,
    getInstStateFromUpdates,
    getRemoteCount,
    listInstUpdates,
} from '../bots';
import { Action, remote } from '../common';
import { testPartitionImplementation } from './test/PartitionTests';
import { createYjsPartition, YjsPartitionImpl } from './YjsPartition';
import { first } from 'rxjs/operators';
import { waitAsync } from '../test/TestHelpers';
import { applyUpdate, encodeStateAsUpdate } from 'yjs';
import { fromByteArray, toByteArray } from 'base64-js';

describe('YjsPartition', () => {
    testPartitionImplementation(
        async () => new YjsPartitionImpl({ type: 'yjs' }),
        true,
        true
    );

    it('should return immediate for the editStrategy', () => {
        const partition = new YjsPartitionImpl({ type: 'yjs' });

        expect(partition.realtimeStrategy).toEqual('immediate');
    });

    it('should have a current site ID', async () => {
        const mem = createYjsPartition({
            type: 'yjs',
        });

        const version = await mem.onVersionUpdated.pipe(first()).toPromise();

        expect(version?.currentSite).not.toBe(null);
        expect(version?.currentSite).toBeDefined();
    });

    describe('remote events', () => {
        let partition: YjsPartitionImpl;
        let events = [] as Action[];
        let sub: Subscription;
        beforeEach(() => {
            events = [];
            partition = new YjsPartitionImpl({
                type: 'yjs',
                remoteEvents: {
                    get_remote_count: true,
                    list_inst_updates: true,
                    get_inst_state_from_updates: true,
                    create_initialization_update: true,
                    apply_updates_to_inst: true,
                    get_current_inst_update: true,
                },
            });

            sub = partition.onEvents.subscribe((e) => events.push(...e));
        });

        afterEach(() => {
            sub.unsubscribe();
        });

        describe('get_remote_count', () => {
            it('should return 1', async () => {
                await partition.sendRemoteEvents([
                    remote(getRemoteCount(), undefined, undefined, 'task1'),
                ]);

                await waitAsync();

                expect(events).toEqual([asyncResult('task1', 1)]);
            });
        });

        describe('list_inst_updates', () => {
            it('should return the current update in a list', async () => {
                await partition.applyEvents([
                    botAdded(
                        createBot('test1', {
                            abc: 'def',
                        })
                    ),
                ]);

                await waitAsync();

                await partition.sendRemoteEvents([
                    remote(listInstUpdates(), undefined, undefined, 'task2'),
                ]);

                await waitAsync();

                const currentUpdate = fromByteArray(
                    encodeStateAsUpdate(partition.doc)
                );

                expect(events).toEqual([
                    asyncResult(
                        'task2',
                        [
                            {
                                id: 0,
                                update: currentUpdate,
                                timestamp: expect.any(Number),
                            },
                        ],
                        false
                    ),
                ]);
            });
        });

        describe('get_inst_state_from_updates', () => {
            it('should return the state matching the given updates', async () => {
                partition.connect();

                await partition.applyEvents([
                    botAdded(
                        createBot('test1', {
                            abc: 'def',
                            num: 123,
                        })
                    ),
                ]);

                await waitAsync();

                const update1 = fromByteArray(
                    encodeStateAsUpdate(partition.doc)
                );

                await partition.applyEvents([
                    botUpdated('test1', {
                        tags: {
                            num: 456,
                        },
                    }),
                ]);

                await waitAsync();

                const update2 = fromByteArray(
                    encodeStateAsUpdate(partition.doc)
                );

                await partition.sendRemoteEvents([
                    remote(
                        getInstStateFromUpdates([
                            {
                                id: 0,
                                update: update1,
                                timestamp: 0,
                            },
                        ]),
                        undefined,
                        undefined,
                        'task1'
                    ),
                    remote(
                        getInstStateFromUpdates([
                            {
                                id: 0,
                                update: update1,
                                timestamp: 0,
                            },
                            {
                                id: 1,
                                update: update2,
                                timestamp: 0,
                            },
                        ]),
                        undefined,
                        undefined,
                        'task2'
                    ),
                ]);

                await waitAsync();

                expect(events).toEqual([
                    asyncResult(
                        'task1',
                        {
                            test1: createBot('test1', {
                                abc: 'def',
                                num: 123,
                            }),
                        },
                        false
                    ),
                    asyncResult(
                        'task2',
                        {
                            test1: createBot('test1', {
                                abc: 'def',
                                num: 456,
                            }),
                        },
                        false
                    ),
                ]);
            });
        });

        describe('create_initialization_update', () => {
            it('should return an update that represents the bots', async () => {
                partition.connect();

                await partition.sendRemoteEvents([
                    remote(
                        createInitializationUpdate([
                            createBot('test1', {
                                abc: 'def',
                            }),
                            createBot('test2', {
                                num: 123,
                            }),
                        ]),
                        undefined,
                        undefined,
                        'task1'
                    ),
                ]);

                await waitAsync();

                expect(events).toEqual([
                    asyncResult(
                        'task1',
                        {
                            id: 0,
                            timestamp: expect.any(Number),
                            update: expect.any(String),
                        },
                        false
                    ),
                ]);

                const event = events[0] as any;
                const update = event.result.update;

                const validationPartition = new YjsPartitionImpl({
                    type: 'yjs',
                });
                applyUpdate(validationPartition.doc, toByteArray(update));

                expect(validationPartition.state).toEqual({
                    test1: createBot('test1', {
                        abc: 'def',
                    }),
                    test2: createBot('test2', {
                        num: 123,
                    }),
                });
            });
        });

        describe('apply_updates_to_inst', () => {
            it('should add the update to the inst', async () => {
                partition.connect();

                const testPartition = new YjsPartitionImpl({
                    type: 'yjs',
                });
                const updates = [] as InstUpdate[];

                testPartition.doc.on('update', (update: Uint8Array) => {
                    updates.push({
                        id: updates.length,
                        timestamp: Date.now(),
                        update: fromByteArray(update),
                    });
                });

                testPartition.applyEvents([
                    botAdded(
                        createBot('test1', {
                            abc: 'def',
                        })
                    ),
                    botAdded(
                        createBot('test2', {
                            num: 124,
                        })
                    ),
                ]);

                await waitAsync();

                expect(updates).not.toEqual([]);

                await partition.sendRemoteEvents([
                    remote(
                        applyUpdatesToInst([...updates]),
                        undefined,
                        undefined,
                        'task1'
                    ),
                ]);

                await waitAsync();

                expect(events).toEqual([asyncResult('task1', null, false)]);

                expect(partition.state).toEqual({
                    test1: createBot('test1', {
                        abc: 'def',
                    }),
                    test2: createBot('test2', {
                        num: 124,
                    }),
                });
            });

            it('should support updates from v13.5.24 of yjs', async () => {
                partition.connect();

                await waitAsync();

                await partition.sendRemoteEvents([
                    remote(
                        applyUpdatesToInst([
                            {
                                id: 0,
                                timestamp: 0,
                                update: 'AQLNrtWDBQAnAQRib3RzBGJvdDEBKADNrtWDBQAEdGFnMQF3A2FiYwA=',
                            },
                        ]),
                        undefined,
                        undefined,
                        'task1'
                    ),
                ]);

                await waitAsync();

                expect(events).toEqual([asyncResult('task1', null, false)]);

                expect(partition.state).toEqual({
                    bot1: createBot('bot1', {
                        tag1: 'abc',
                    }),
                });
            });
        });

        describe('get_current_inst_update', () => {
            it('should return the current doc state as an update', async () => {
                partition.connect();

                await partition.applyEvents([
                    botAdded(
                        createBot('test1', {
                            abc: 'def',
                        })
                    ),
                    botAdded(
                        createBot('test2', {
                            num: 124,
                        })
                    ),
                ]);

                await waitAsync();

                await partition.sendRemoteEvents([
                    remote(
                        getCurrentInstUpdate(),
                        undefined,
                        undefined,
                        'task1'
                    ),
                ]);

                await waitAsync();

                const expectedUpdate = fromByteArray(
                    encodeStateAsUpdate(partition.doc)
                );

                expect(events).toEqual([
                    asyncResult(
                        'task1',
                        {
                            id: 0,
                            timestamp: expect.any(Number),
                            update: expectedUpdate,
                        },
                        false
                    ),
                ]);
            });
        });
    });
});
