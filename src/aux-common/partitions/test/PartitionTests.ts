import { AuxPartition, getPartitionState } from '../AuxPartition';
import {
    botAdded,
    createBot,
    Bot,
    UpdatedBot,
    botRemoved,
    botUpdated,
    StateUpdatedEvent,
    stateUpdatedEvent,
} from '../../bots';
import { Subscription, never } from 'rxjs';
import { StatusUpdate } from '@casual-simulation/causal-trees';
import { waitAsync } from '../../test/TestHelpers';
import {
    first,
    buffer,
    takeUntil,
    takeWhile,
    bufferCount,
    skip,
} from 'rxjs/operators';
import { del, edit, insert } from '../../aux-format-2';

export function testPartitionImplementation(
    createPartition: () => Promise<AuxPartition>
) {
    let partition: AuxPartition;
    let added: Bot[];
    let removed: string[];
    let updated: UpdatedBot[];
    let statuses: StatusUpdate[];
    let updates: StateUpdatedEvent[];
    let sub: Subscription;
    beforeEach(async () => {
        sub = new Subscription();
        partition = await createPartition();

        added = [];
        removed = [];
        updated = [];
        statuses = [];
        updates = [];

        sub.add(partition.onBotsAdded.subscribe((bots) => added.push(...bots)));
        sub.add(
            partition.onBotsRemoved.subscribe((ids) => removed.push(...ids))
        );
        sub.add(
            partition.onBotsUpdated.subscribe((updates) =>
                updated.push(...updates)
            )
        );
        sub.add(
            partition.onStateUpdated
                .pipe(skip(1))
                .subscribe((u) => updates.push(u))
        );

        sub.add(
            partition.onStatusUpdated.subscribe((update) =>
                statuses.push(update)
            )
        );
    });

    afterEach(() => {
        sub.unsubscribe();
    });

    describe('add_bot', () => {
        it('should be able to add a bot to the partition', async () => {
            const bot = createBot('test', {
                abc: 'def',
            });
            await partition.applyEvents([botAdded(bot)]);

            await waitAsync();

            expect(added).toEqual([bot]);
            expect(updates).toEqual([
                {
                    state: {
                        test: bot,
                    },
                    addedBots: ['test'],
                    removedBots: [],
                    updatedBots: [],
                },
            ]);
        });

        it('should be able to add multiple bots to the partition at a time', async () => {
            const bot1 = createBot('test', {
                abc: 'def',
            });
            const bot2 = createBot('test2', {
                abc: 'xyz',
            });
            await partition.applyEvents([botAdded(bot1), botAdded(bot2)]);

            await waitAsync();

            expect(added).toEqual([bot1, bot2]);
        });

        it('should issue an event for all the existing bots upon subscription', async () => {
            const bot1 = createBot('test', {
                abc: 'def',
            });
            const bot2 = createBot('test2', {
                abc: 'xyz',
            });

            await partition.applyEvents([botAdded(bot1), botAdded(bot2)]);

            let added: Bot[] = [];
            partition.onBotsAdded.subscribe((a) => added.push(...a));

            expect(added).toEqual([bot1, bot2]);
        });

        it('should issue an state updated event for the existing state upon subscription', async () => {
            const bot1 = createBot('test', {
                abc: 'def',
            });
            const bot2 = createBot('test2', {
                abc: 'xyz',
            });

            await partition.applyEvents([botAdded(bot1), botAdded(bot2)]);

            let updates: StateUpdatedEvent[] = [];
            partition.onStateUpdated.subscribe((e) => updates.push(e));

            expect(updates).toEqual([
                {
                    state: {
                        test: createBot('test', {
                            abc: 'def',
                        }),
                        test2: createBot('test2', {
                            abc: 'xyz',
                        }),
                    },
                    addedBots: ['test', 'test2'],
                    removedBots: [],
                    updatedBots: [],
                },
            ]);
        });

        it('should add bots to the configured space.', async () => {
            const bot1 = createBot('test', {
                abc: 'def',
            });
            const bot2 = createBot('test2', {
                abc: 'xyz',
            });

            partition.space = 'test';
            await partition.applyEvents([botAdded(bot1), botAdded(bot2)]);

            let added: Bot[] = [];
            partition.onBotsAdded.subscribe((a) => added.push(...a));

            expect(added).toEqual([
                createBot(
                    'test',
                    {
                        abc: 'def',
                    },
                    <any>'test'
                ),
                createBot(
                    'test2',
                    {
                        abc: 'xyz',
                    },
                    <any>'test'
                ),
            ]);
        });
    });

    describe('remove_bot', () => {
        it('should be able to remove a bot from the partition', async () => {
            const bot = createBot('test', {
                abc: 'def',
            });

            // Run the bot added and updated
            // events in separate batches
            // because partitions may combine the events
            await partition.applyEvents([botAdded(bot)]);

            await partition.applyEvents([botRemoved('test')]);

            await waitAsync();

            expect(removed).toEqual(['test']);
            expect(updates.slice(1)).toEqual([
                {
                    state: {
                        test: null,
                    },
                    addedBots: [],
                    removedBots: ['test'],
                    updatedBots: [],
                },
            ]);
        });

        it('should be able to remove multiple bots from the partition', async () => {
            const bot1 = createBot('test', {
                abc: 'def',
            });
            const bot2 = createBot('test2', {
                abc: 'xyz',
            });

            // Run the bot added and updated
            // events in separate batches
            // because partitions may combine the events
            await partition.applyEvents([botAdded(bot1), botAdded(bot2)]);

            await partition.applyEvents([
                botRemoved('test2'),
                botRemoved('test'),
            ]);

            await waitAsync();

            expect(removed).toEqual(['test2', 'test']);
            expect(updates.slice(1)).toEqual([
                {
                    state: {
                        test: null,
                        test2: null,
                    },
                    addedBots: [],
                    removedBots: ['test2', 'test'],
                    updatedBots: [],
                },
            ]);
        });

        it('should be able to remove a bot that was just added to the partition', async () => {
            const bot1 = createBot('test', {
                abc: 'def',
            });

            // Run the bot added and updated
            // events in separate batches
            // because partitions may combine the events
            await partition.applyEvents([botAdded(bot1), botRemoved('test')]);

            await waitAsync();

            expect(added).toEqual([]);
            expect(updated).toEqual([]);
            expect(removed).toEqual([]);
        });
    });

    describe('update_bot', () => {
        it('should be able to update a bot in the partition', async () => {
            const bot = createBot('test', {
                abc: 'def',
            });

            // Run the bot added and updated
            // events in separate batches
            // because partitions may combine the events
            await partition.applyEvents([botAdded(bot)]);

            await partition.applyEvents([
                botUpdated('test', {
                    tags: {
                        abc: 'ghi',
                    },
                }),
            ]);

            await waitAsync();

            expect(updated).toEqual([
                {
                    bot: createBot('test', {
                        abc: 'ghi',
                    }),
                    tags: ['abc'],
                },
            ]);

            expect(updates.slice(1)).toEqual([
                {
                    state: {
                        test: {
                            tags: {
                                abc: 'ghi',
                            },
                        },
                    },
                    addedBots: [],
                    removedBots: [],
                    updatedBots: ['test'],
                },
            ]);
        });

        it('should report tags that were added to the bot', async () => {
            const bot = createBot('test', {
                abc: 'def',
            });

            // Run the bot added and updated
            // events in separate batches
            // because partitions may combine the events
            await partition.applyEvents([botAdded(bot)]);

            await partition.applyEvents([
                botUpdated('test', {
                    tags: {
                        hahaha: true,
                    },
                }),
            ]);

            await waitAsync();

            expect(updated).toEqual([
                {
                    bot: createBot('test', {
                        abc: 'def',
                        hahaha: true,
                    }),
                    tags: ['hahaha'],
                },
            ]);
        });

        it('should report tags that were removed from the bot', async () => {
            const bot = createBot('test', {
                abc: 'def',
                example: 123,
            });

            // Run the bot added and updated
            // events in separate batches
            // because partitions may combine the events
            await partition.applyEvents([botAdded(bot)]);

            await partition.applyEvents([
                botUpdated('test', {
                    tags: {
                        example: null,
                    },
                }),
            ]);

            await waitAsync();

            expect(updated).toEqual([
                {
                    bot: createBot('test', {
                        abc: 'def',
                    }),
                    tags: ['example'],
                },
            ]);
        });

        it('should ignore updates that dont change any tags', async () => {
            const bot = createBot('test', {
                abc: 'def',
                example: 123,
            });

            // Run the bot added and updated
            // events in separate batches
            // because partitions may combine the events
            await partition.applyEvents([botAdded(bot)]);

            await partition.applyEvents([botUpdated('test', {})]);

            await waitAsync();

            expect(updated).toEqual([]);
        });

        it('should ignore updates that set tag values to the same value that it is currently at', async () => {
            const bot = createBot('test', {
                abc: 'def',
                example: 123,
            });

            // Run the bot added and updated
            // events in separate batches
            // because partitions may combine the events
            await partition.applyEvents([botAdded(bot)]);

            await partition.applyEvents([
                botUpdated('test', {
                    tags: {
                        abc: 'def',
                    },
                }),
            ]);

            await waitAsync();

            expect(updated).toEqual([]);
        });

        it('should only report tags that changed', async () => {
            const bot = createBot('test', {
                abc: 'def',
                example: 123,
            });

            // Run the bot added and updated
            // events in separate batches
            // because partitions may combine the events
            await partition.applyEvents([botAdded(bot)]);

            await partition.applyEvents([
                botUpdated('test', {
                    tags: {
                        abc: 'def',
                        example: 456,
                    },
                }),
            ]);

            await waitAsync();

            expect(updated).toEqual([
                {
                    bot: createBot('test', {
                        abc: 'def',
                        example: 456,
                    }),
                    tags: ['example'],
                },
            ]);
        });

        it('should merge multiple updates to the same bot', async () => {
            const bot = createBot('test', {
                abc: 'def',
                example: 123,
            });

            // Run the bot added and updated
            // events in separate batches
            // because partitions may combine the events
            await partition.applyEvents([botAdded(bot)]);

            await partition.applyEvents([
                botUpdated('test', {
                    tags: {
                        abc: 'rgb',
                    },
                }),
                botUpdated('test', {
                    tags: {
                        example: 456,
                    },
                }),
            ]);

            await waitAsync();

            expect(updated).toEqual([
                {
                    bot: createBot('test', {
                        abc: 'rgb',
                        example: 456,
                    }),
                    tags: ['abc', 'example'],
                },
            ]);
            expect(updates.slice(1)).toEqual([
                {
                    state: {
                        test: {
                            tags: {
                                abc: 'rgb',
                                example: 456,
                            },
                        },
                    },
                    addedBots: [],
                    removedBots: [],
                    updatedBots: ['test'],
                },
            ]);
        });

        it('should ignore updates to bots that dont exist', async () => {
            await partition.applyEvents([
                botUpdated('test', {
                    tags: {
                        abc: 'def',
                    },
                }),
            ]);

            await waitAsync();

            expect(updated).toEqual([]);
        });

        let deleteValueCases = [
            ['null', null],
            ['undefined', undefined],
            ['empty string', ''],
        ];

        let preserveValueCases = [
            ['0', 0],
            ['false', false],
            ['whitespace', ' '],
        ];

        it.each(deleteValueCases)(
            'should delete tags with %s values',
            async (desc, val) => {
                const bot = createBot('test', {
                    abc: 'def',
                    example: 123,
                });

                // Run the bot added and updated
                // events in separate batches
                // because partitions may combine the events
                await partition.applyEvents([botAdded(bot)]);

                await partition.applyEvents([
                    botUpdated('test', {
                        tags: {
                            example: val,
                        },
                    }),
                ]);

                await waitAsync();

                expect(updated).toEqual([
                    {
                        bot: createBot('test', {
                            abc: 'def',
                        }),
                        tags: ['example'],
                    },
                ]);
                expect(updates.slice(1)).toEqual([
                    {
                        state: {
                            test: {
                                tags: {
                                    example: null,
                                },
                            },
                        },
                        addedBots: [],
                        removedBots: [],
                        updatedBots: ['test'],
                    },
                ]);
            }
        );

        it.each(preserveValueCases)(
            'should preserve tags with %s values',
            async (desc, val) => {
                const bot = createBot('test', {
                    abc: 'def',
                    example: 123,
                });

                // Run the bot added and updated
                // events in separate batches
                // because partitions may combine the events
                await partition.applyEvents([botAdded(bot)]);

                await partition.applyEvents([
                    botUpdated('test', {
                        tags: {
                            example: val,
                        },
                    }),
                ]);

                await waitAsync();

                expect(updated).toEqual([
                    {
                        bot: createBot('test', {
                            abc: 'def',
                            example: val,
                        }),
                        tags: ['example'],
                    },
                ]);
                expect(updates.slice(1)).toEqual([
                    {
                        state: {
                            test: {
                                tags: {
                                    example: val,
                                },
                            },
                        },
                        addedBots: [],
                        removedBots: [],
                        updatedBots: ['test'],
                    },
                ]);
            }
        );

        describe('edits', () => {
            it('should support inserting text into a tag value', async () => {
                await partition.applyEvents([
                    botAdded(
                        createBot('test', {
                            abc: 'def',
                        })
                    ),
                ]);

                await waitAsync();

                await partition.applyEvents([
                    botUpdated('test', {
                        tags: {
                            abc: edit(insert('ghi')),
                        },
                    }),
                ]);

                expect(partition.state).toEqual({
                    test: createBot('test', {
                        abc: 'ghidef',
                    }),
                });
                expect(updated).toEqual([
                    {
                        bot: createBot('test', {
                            abc: 'ghidef',
                        }),
                        tags: ['abc'],
                    },
                ]);
                expect(updates.slice(1)).toEqual([
                    stateUpdatedEvent({
                        test: {
                            tags: {
                                abc: edit(insert('ghi')),
                            },
                        },
                    }),
                ]);
            });

            it('should support deleting text from a tag value', async () => {
                await partition.applyEvents([
                    botAdded(
                        createBot('test', {
                            abc: 'def',
                        })
                    ),
                ]);

                await waitAsync();

                await partition.applyEvents([
                    botUpdated('test', {
                        tags: {
                            abc: edit(del(2)),
                        },
                    }),
                ]);

                expect(partition.state).toEqual({
                    test: createBot('test', {
                        abc: 'f',
                    }),
                });
                expect(updated).toEqual([
                    {
                        bot: createBot('test', {
                            abc: 'f',
                        }),
                        tags: ['abc'],
                    },
                ]);
                expect(updates.slice(1)).toEqual([
                    stateUpdatedEvent({
                        test: {
                            tags: {
                                abc: edit(del(2)),
                            },
                        },
                    }),
                ]);
            });
        });

        describe('TagMasks', () => {
            beforeEach(() => {
                partition.space = 'testSpace';
            });

            it('should support tag mask updates for the partition space', async () => {
                await partition.applyEvents([
                    botUpdated('test', {
                        masks: {
                            [partition.space]: {
                                newTag: true,
                                abc: 123,
                            },
                        },
                    }),
                ]);

                await waitAsync();

                expect(partition.state).toEqual({
                    test: {
                        masks: {
                            [partition.space]: {
                                newTag: true,
                                abc: 123,
                            },
                        },
                    },
                });
                expect(updated).toEqual([]);
                expect(updates).toEqual([
                    {
                        state: {
                            test: {
                                masks: {
                                    [partition.space]: {
                                        newTag: true,
                                        abc: 123,
                                    },
                                },
                            },
                        },
                        addedBots: [],
                        removedBots: [],
                        updatedBots: ['test'],
                    },
                ]);
            });

            it('should ignore tag mask updates for different partition spaces', async () => {
                await partition.applyEvents([
                    botUpdated('test', {
                        masks: {
                            ['different']: {
                                newTag: true,
                                abc: 123,
                            },
                        },
                    }),
                ]);

                await waitAsync();

                expect(partition.state).toEqual({});
                expect(updated).toEqual([]);
                expect(updates).toEqual([]);
            });

            it('should support tag mask updates for bots in the same partition', async () => {
                await partition.applyEvents([
                    botAdded(
                        createBot('test', {
                            abc: 'def',
                        })
                    ),
                ]);

                await partition.applyEvents([
                    botUpdated('test', {
                        masks: {
                            [partition.space]: {
                                newTag: true,
                                abc: 123,
                            },
                        },
                    }),
                ]);

                await waitAsync();

                expect(partition.state).toEqual({
                    test: {
                        id: 'test',
                        space: partition.space,
                        tags: {
                            abc: 'def',
                        },
                        masks: {
                            [partition.space]: {
                                newTag: true,
                                abc: 123,
                            },
                        },
                    },
                });
                expect(updated).toEqual([]);
                expect(updates.slice(1)).toEqual([
                    {
                        state: {
                            test: {
                                masks: {
                                    [partition.space]: {
                                        newTag: true,
                                        abc: 123,
                                    },
                                },
                            },
                        },
                        addedBots: [],
                        removedBots: [],
                        updatedBots: ['test'],
                    },
                ]);
            });

            it('should not confuse tag masks and tags when given an empty tags object in an update', async () => {
                await partition.applyEvents([
                    botUpdated('test', {
                        tags: {},
                        masks: {
                            [partition.space]: {
                                newTag: true,
                            },
                        },
                    }),
                ]);

                await waitAsync();

                expect(partition.state).toEqual({
                    test: {
                        masks: {
                            [partition.space]: {
                                newTag: true,
                            },
                        },
                    },
                });
                expect(updated).toEqual([]);
                expect(updates).toEqual([
                    {
                        state: {
                            test: {
                                masks: {
                                    [partition.space]: {
                                        newTag: true,
                                    },
                                },
                            },
                        },
                        addedBots: [],
                        removedBots: [],
                        updatedBots: ['test'],
                    },
                ]);
            });

            describe('edits', () => {
                it('should support inserting text into a tag mask value', async () => {
                    await partition.applyEvents([
                        botUpdated('test', {
                            masks: {
                                testSpace: {
                                    abc: 'def',
                                },
                            },
                        }),
                    ]);

                    await waitAsync();

                    await partition.applyEvents([
                        botUpdated('test', {
                            masks: {
                                testSpace: {
                                    abc: edit(insert('ghi')),
                                },
                            },
                        }),
                    ]);

                    await waitAsync();

                    expect(partition.state).toEqual({
                        test: {
                            masks: {
                                testSpace: {
                                    abc: 'ghidef',
                                },
                            },
                        },
                    });
                    expect(updated).toEqual([]);
                    expect(updates.slice(1)).toEqual([
                        stateUpdatedEvent({
                            test: {
                                masks: {
                                    testSpace: {
                                        abc: edit(insert('ghi')),
                                    },
                                },
                            },
                        }),
                    ]);
                });

                it('should support deleting text from a tag mask value', async () => {
                    await partition.applyEvents([
                        botUpdated('test', {
                            masks: {
                                testSpace: {
                                    abc: 'def',
                                },
                            },
                        }),
                    ]);

                    await waitAsync();

                    await partition.applyEvents([
                        botUpdated('test', {
                            masks: {
                                testSpace: {
                                    abc: edit(del(2)),
                                },
                            },
                        }),
                    ]);

                    await waitAsync();

                    expect(partition.state).toEqual({
                        test: {
                            masks: {
                                testSpace: {
                                    abc: 'f',
                                },
                            },
                        },
                    });
                    expect(updated).toEqual([]);
                    expect(updates.slice(1)).toEqual([
                        stateUpdatedEvent({
                            test: {
                                masks: {
                                    testSpace: {
                                        abc: edit(del(2)),
                                    },
                                },
                            },
                        }),
                    ]);
                });
            });
        });
    });

    describe('apply_state', () => {
        it('should be able to add a bot to the partition', async () => {
            const bot = createBot('test', {
                abc: 'def',
            });
            await partition.applyEvents([
                {
                    type: 'apply_state' as const,
                    state: <any>{
                        test: bot,
                    },
                },
            ]);

            await waitAsync();

            expect(added).toEqual([bot]);
        });

        it('should be able to update a bot in the partition', async () => {
            const bot = createBot('test', {
                abc: 'def',
            });

            // Run the bot added and updated
            // events in separate batches
            // because partitions may combine the events
            await partition.applyEvents([botAdded(bot)]);

            await partition.applyEvents([
                {
                    type: 'apply_state' as const,
                    state: <any>{
                        test: {
                            tags: {
                                abc: 'ghi',
                            },
                        },
                    },
                },
            ]);

            await waitAsync();

            expect(updated).toEqual([
                {
                    bot: createBot('test', {
                        abc: 'ghi',
                    }),
                    tags: ['abc'],
                },
            ]);
        });

        it('should be able to delete a bot in the partition', async () => {
            const bot = createBot('test', {
                abc: 'def',
            });

            // Run the bot added and updated
            // events in separate batches
            // because partitions may combine the events
            await partition.applyEvents([botAdded(bot)]);

            await partition.applyEvents([
                {
                    type: 'apply_state' as const,
                    state: <any>{
                        test: null,
                    },
                },
            ]);

            await waitAsync();

            expect(removed).toEqual(['test']);
        });
    });

    describe('getPartitionState()', () => {
        it('should be able to get the state from the partition', async () => {
            const bot1 = createBot('test', {
                abc: 'def',
            });
            const bot2 = createBot('test2', {
                abc: 'xyz',
            });

            await partition.applyEvents([botAdded(bot1), botAdded(bot2)]);

            const state = getPartitionState(partition);

            expect(state).toEqual({
                test: bot1,
                test2: bot2,
            });
        });
    });

    describe('connect()', () => {
        it('should issue connection, authentication, authorization, and sync events in that order', async () => {
            const promise = partition.onStatusUpdated
                .pipe(
                    takeWhile((update) => update.type !== 'sync', true),
                    bufferCount(4)
                )
                .toPromise();

            partition.connect();

            const update = await promise;

            expect(update).toEqual([
                {
                    type: 'connection',
                    connected: true,
                },
                expect.objectContaining({
                    type: 'authentication',
                    authenticated: true,
                }),
                expect.objectContaining({
                    type: 'authorization',
                    authorized: true,
                }),
                {
                    type: 'sync',
                    synced: true,
                },
            ]);
        });
    });
}
