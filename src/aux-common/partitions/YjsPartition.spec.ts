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
import type { Subscription } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import type { InstUpdate, StoredAux } from '../bots';
import {
    applyUpdatesToInst,
    asyncResult,
    botAdded,
    botUpdated,
    createBot,
    createInitializationUpdate,
    getCurrentInstUpdate,
    getInstStateFromUpdates,
    getRemoteCount,
    getRemotes,
    installAuxFile,
    listInstUpdates,
} from '../bots';
import type { Map as YMap } from 'yjs';
import { Text as YText } from 'yjs';
import type { Action } from '../common';
import { remote } from '../common';
import { testPartitionImplementation } from './test/PartitionTests';
import { createYjsPartition, YjsPartitionImpl } from './YjsPartition';
import { first } from 'rxjs/operators';
import { waitAsync } from '../test/TestHelpers';
import { applyUpdate, encodeStateAsUpdate } from 'yjs';
import { fromByteArray, toByteArray } from 'base64-js';
import { case1 } from './test/UpdateCases';
import { constructInitializationUpdate } from './PartitionUtils';

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

        const version = await firstValueFrom(
            mem.onVersionUpdated.pipe(first())
        );

        expect(version?.currentSite).not.toBe(null);
        expect(version?.currentSite).toBeDefined();
    });

    describe('bugged cases', () => {
        let partition: YjsPartitionImpl;
        let events = [] as Action[];
        let sub: Subscription;
        beforeEach(() => {
            events = [];
            partition = new YjsPartitionImpl({
                type: 'yjs',
                remoteEvents: {
                    get_remotes: true,
                    get_remote_count: true,
                    list_inst_updates: true,
                    get_inst_state_from_updates: true,
                    create_initialization_update: true,
                    apply_updates_to_inst: true,
                    get_current_inst_update: true,
                },
                connectionId: 'connectionId',
            });

            sub = partition.onEvents.subscribe((e) => events.push(...e));
        });

        afterEach(() => {
            sub.unsubscribe();
        });

        it('case1: should handle an update that includes updates in addition to adding a bot', async () => {
            partition.connect();

            const botId = '402ccb16-d402-4404-b1ad-7ad73cc29772';
            const tag = 'ResizeHandle';
            const bots = partition.doc.getMap('bots');
            let index = 0;

            for (let update of case1) {
                await partition.sendRemoteEvents([
                    remote(
                        applyUpdatesToInst([
                            {
                                id: 0,
                                timestamp: 0,
                                update,
                            },
                        ]),
                        undefined,
                        undefined,
                        'task1'
                    ),
                ]);

                await waitAsync();

                const expectedBot = bots.get(botId) as YMap<any>;
                const computedBot = partition.state[botId];

                if (!computedBot || !expectedBot) {
                    continue;
                }
                const expectedValue = expectedBot
                    .get('ResizeHandle')
                    .toString();
                const calculatedValue = computedBot.tags[tag];

                if (expectedValue !== calculatedValue) {
                    console.log('Update Index:', index);
                    expect(calculatedValue).toEqual(expectedValue);
                }

                index += 1;
            }
        });
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
                    get_remotes: true,
                    get_remote_count: true,
                    list_inst_updates: true,
                    get_inst_state_from_updates: true,
                    create_initialization_update: true,
                    apply_updates_to_inst: true,
                    get_current_inst_update: true,
                    install_aux_file: true,
                },
                connectionId: 'connectionId',
            });

            sub = partition.onEvents.subscribe((e) => events.push(...e));
        });

        afterEach(() => {
            sub.unsubscribe();
        });

        describe('get_remotes', () => {
            it(`should return the configured connection ID`, async () => {
                const events = [] as Action[];
                partition.onEvents.subscribe((e) => events.push(...e));

                await waitAsync();

                await partition.sendRemoteEvents([
                    remote(getRemotes(), undefined, undefined, 'task1'),
                ]);

                expect(events).toEqual([
                    asyncResult('task1', ['connectionId']),
                ]);
            });

            it(`should return an empty list if there is no connection ID`, async () => {
                partition = new YjsPartitionImpl({
                    type: 'yjs',
                    remoteEvents: {
                        get_remotes: true,
                        get_remote_count: true,
                        list_inst_updates: true,
                        get_inst_state_from_updates: true,
                        create_initialization_update: true,
                        apply_updates_to_inst: true,
                        get_current_inst_update: true,
                    },
                });

                const events = [] as Action[];
                partition.onEvents.subscribe((e) => events.push(...e));

                await waitAsync();

                await partition.sendRemoteEvents([
                    remote(getRemotes(), undefined, undefined, 'task1'),
                ]);

                expect(events).toEqual([asyncResult('task1', [])]);
            });
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

        describe('install_aux_file', () => {
            it('should add the version 2 state to the inst', async () => {
                partition.connect();

                const update = constructInitializationUpdate(
                    createInitializationUpdate([
                        createBot('installed1', {
                            abc: 'def',
                        }),
                        createBot('installed2', {
                            abc: 'ghi',
                        }),
                    ])
                );

                const state: StoredAux = {
                    version: 2,
                    updates: [update],
                };

                await waitAsync();

                await partition.sendRemoteEvents([
                    remote(
                        installAuxFile(state, 'default'),
                        undefined,
                        undefined,
                        'task1'
                    ),
                ]);

                await waitAsync();

                expect(events).toEqual([asyncResult('task1', null, false)]);

                expect(partition.state).toEqual({
                    installed1: createBot('installed1', {
                        abc: 'def',
                    }),
                    installed2: createBot('installed2', {
                        abc: 'ghi',
                    }),
                });
            });

            it('should add the version 1 state to the inst', async () => {
                partition.connect();

                const state: StoredAux = {
                    version: 1,
                    state: {
                        installed1: createBot('installed1', {
                            abc: 'def',
                        }),
                        installed2: createBot('installed2', {
                            abc: 'ghi',
                        }),
                    },
                };

                await waitAsync();

                await partition.sendRemoteEvents([
                    remote(
                        installAuxFile(state, 'default'),
                        undefined,
                        undefined,
                        'task1'
                    ),
                ]);

                await waitAsync();

                expect(events).toEqual([asyncResult('task1', null, false)]);

                expect(partition.state).toEqual({
                    installed1: createBot('installed1', {
                        abc: 'def',
                    }),
                    installed2: createBot('installed2', {
                        abc: 'ghi',
                    }),
                });
            });

            it('should overwrite existing bots when installing a version 1 aux with the default mode', async () => {
                partition.connect();

                const state: StoredAux = {
                    version: 1,
                    state: {
                        installed1: createBot('installed1', {
                            abc: 'def',
                        }),
                        installed2: createBot('installed2', {
                            abc: 'ghi',
                        }),
                    },
                };

                partition.applyEvents([
                    botAdded(
                        createBot('installed1', {
                            abc: 'xyz',
                        })
                    ),
                    botAdded(
                        createBot('installed2', {
                            abc: 'xyz',
                        })
                    ),
                ]);

                await waitAsync();

                await partition.sendRemoteEvents([
                    remote(
                        installAuxFile(state, 'default'),
                        undefined,
                        undefined,
                        'task1'
                    ),
                ]);

                await waitAsync();

                expect(events).toEqual([asyncResult('task1', null, false)]);

                expect(partition.state).toEqual({
                    installed1: createBot('installed1', {
                        abc: 'def',
                    }),
                    installed2: createBot('installed2', {
                        abc: 'ghi',
                    }),
                });
            });

            it('should do nothing when installing a version 2 state again with the default mode', async () => {
                partition.connect();

                const update = constructInitializationUpdate(
                    createInitializationUpdate([
                        createBot('installed1', {
                            abc: 'def',
                        }),
                        createBot('installed2', {
                            abc: 'ghi',
                        }),
                    ])
                );

                const state: StoredAux = {
                    version: 2,
                    updates: [update],
                };

                await waitAsync();

                await partition.sendRemoteEvents([
                    remote(
                        installAuxFile(state, 'default'),
                        undefined,
                        undefined,
                        'task1'
                    ),
                ]);

                await waitAsync();

                expect(events).toEqual([asyncResult('task1', null, false)]);

                expect(partition.state).toEqual({
                    installed1: createBot('installed1', {
                        abc: 'def',
                    }),
                    installed2: createBot('installed2', {
                        abc: 'ghi',
                    }),
                });

                await partition.sendRemoteEvents([
                    remote(
                        installAuxFile(state, 'default'),
                        undefined,
                        undefined,
                        'task2'
                    ),
                ]);

                await waitAsync();

                expect(events.slice(1)).toEqual([
                    asyncResult('task2', null, false),
                ]);

                expect(partition.state).toEqual({
                    installed1: createBot('installed1', {
                        abc: 'def',
                    }),
                    installed2: createBot('installed2', {
                        abc: 'ghi',
                    }),
                });
            });

            it('should create new bots from the version 2 aux if the mode is copy', async () => {
                partition.connect();

                const update = constructInitializationUpdate(
                    createInitializationUpdate([
                        createBot('installed1', {
                            abc: 'def',
                        }),
                        createBot('installed2', {
                            abc: 'ghi',
                        }),
                    ])
                );

                const state: StoredAux = {
                    version: 2,
                    updates: [update],
                };

                await waitAsync();

                await partition.sendRemoteEvents([
                    remote(
                        installAuxFile(state, 'copy'),
                        undefined,
                        undefined,
                        'task1'
                    ),
                ]);

                await waitAsync();

                expect(events).toEqual([asyncResult('task1', null, false)]);

                expect(Object.values(partition.state)).toEqual([
                    createBot(expect.any(String), {
                        abc: 'def',
                    }),
                    createBot(expect.any(String), {
                        abc: 'ghi',
                    }),
                ]);
            });

            it('should create new bots from the version 1 aux if the mode is copy', async () => {
                partition.connect();

                const state: StoredAux = {
                    version: 1,
                    state: {
                        installed1: createBot('installed1', {
                            abc: 'def',
                        }),
                        installed2: createBot('installed2', {
                            abc: 'ghi',
                        }),
                    },
                };

                await waitAsync();

                await partition.sendRemoteEvents([
                    remote(
                        installAuxFile(state, 'copy'),
                        undefined,
                        undefined,
                        'task1'
                    ),
                ]);

                await waitAsync();

                expect(events).toEqual([asyncResult('task1', null, false)]);

                expect(Object.values(partition.state)).toEqual([
                    createBot(expect.any(String), {
                        abc: 'def',
                    }),
                    createBot(expect.any(String), {
                        abc: 'ghi',
                    }),
                ]);
            });
        });
    });
});
