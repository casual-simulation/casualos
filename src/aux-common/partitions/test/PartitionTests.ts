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
    hasValue,
    BotSpace,
} from '../../bots';
import { Subscription, never } from 'rxjs';
import { CurrentVersion, StatusUpdate } from '@casual-simulation/causal-trees';
import { waitAsync } from '../../test/TestHelpers';
import {
    first,
    buffer,
    takeUntil,
    takeWhile,
    bufferCount,
    skip,
} from 'rxjs/operators';
import {
    del,
    edit,
    edits,
    insert,
    preserve,
    TAG_EDIT_NAME,
} from '../../aux-format-2';
import faker from 'faker';
import {
    generateRandomEditCases,
    generateRandomEditParagraphCases,
} from '../../test/FuzzingHelpers';

/**
 * Tests the given partition implementation for various features.
 * @param createPartition A function that creates a new instance of the partition that should be tested.
 * @param testForMergedEdits Whether to test that multiple edit sequences are merged instead of preserved as separate sequences.
 */
export function testPartitionImplementation(
    createPartition: () => Promise<AuxPartition>,
    testForMergedEdits: boolean = false,
    testConcurrentEdits: boolean = false
) {
    let partition: AuxPartition;
    let added: Bot[];
    let removed: string[];
    let updated: UpdatedBot[];
    let statuses: StatusUpdate[];
    let updates: StateUpdatedEvent[];
    let version: CurrentVersion;
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
        sub.add(partition.onVersionUpdated.subscribe((v) => (version = v)));

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

            expect(partition.state).toEqual({
                test: bot,
            });
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
            expect(partition.state).toEqual({
                test: bot1,
                test2: bot2,
            });
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
            expect(partition.state).toEqual({
                [bot1.id]: bot1,
                [bot2.id]: bot2,
            });
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
            expect(partition.state).toEqual({
                test: bot1,
                test2: bot2,
            });
        });

        it('should add bots to the configured space.', async () => {
            const bot1 = createBot('test', {
                abc: 'def',
            });
            const bot2 = createBot('test2', {
                abc: 'xyz',
            });

            let added: Bot[] = [];
            partition.onBotsAdded.subscribe((a) => added.push(...a));

            partition.space = 'test';
            await partition.applyEvents([botAdded(bot1), botAdded(bot2)]);

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
            expect(partition.state).toEqual({
                test: createBot(
                    'test',
                    {
                        abc: 'def',
                    },
                    <any>'test'
                ),
                test2: createBot(
                    'test2',
                    {
                        abc: 'xyz',
                    },
                    <any>'test'
                ),
            });
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
            expect(partition.state).toEqual({});
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
            expect(partition.state).toEqual({});
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
            expect(partition.state).toEqual({});
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

        it('should be able to update multiple bots at the same time', async () => {
            const bot1 = createBot('test1', {
                abc: 'def',
            });
            const bot2 = createBot('test2', {
                number: 123,
            });

            // Run the bot added and updated
            // events in separate batches
            // because partitions may combine the events
            await partition.applyEvents([botAdded(bot1), botAdded(bot2)]);

            await partition.applyEvents([
                botUpdated('test1', {
                    tags: {
                        abc: 'ghi',
                    },
                }),
                botUpdated('test2', {
                    tags: {
                        number: 456,
                    },
                }),
            ]);

            await waitAsync();

            expect(updated).toEqual([
                {
                    bot: createBot('test1', {
                        abc: 'ghi',
                    }),
                    tags: ['abc'],
                },
                {
                    bot: createBot('test2', {
                        number: 456,
                    }),
                    tags: ['number'],
                },
            ]);

            expect(updates.slice(1)).toEqual([
                {
                    state: {
                        test1: {
                            tags: {
                                abc: 'ghi',
                            },
                        },
                        test2: {
                            tags: {
                                number: 456,
                            },
                        },
                    },
                    addedBots: [],
                    removedBots: [],
                    updatedBots: ['test1', 'test2'],
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

        it('should support updates to arrays that keep the same array instance', async () => {
            let arr = [] as any[];
            const bot = createBot('test', {
                array: arr,
            });

            // Run the bot added and updated
            // events in separate batches
            // because partitions may combine the events
            await partition.applyEvents([botAdded(bot)]);

            await partition.applyEvents([
                botUpdated('test', {
                    tags: {
                        array: arr,
                    },
                }),
            ]);

            await waitAsync();

            expect(updates.slice(1)).toEqual([
                stateUpdatedEvent({
                    test: {
                        tags: {
                            array: arr,
                        },
                    },
                }),
            ]);
            expect(updated).toEqual([
                {
                    bot: createBot('test', {
                        array: arr,
                    }),
                    tags: ['array'],
                },
            ]);
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
            ['null', null as any] as const,
            ['undefined', undefined as any] as const,
            ['empty string', ''] as const,
        ];

        let preserveValueCases = [
            ['0', 0] as const,
            ['false', false] as const,
            ['whitespace', ' '] as const,
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

                const editVersion = { ...version.vector };
                await partition.applyEvents([
                    botUpdated('test', {
                        tags: {
                            abc: edit(editVersion, insert('ghi')),
                        },
                    }),
                ]);

                expect(partition.state).toEqual({
                    test: createBot('test', {
                        abc: 'ghidef',
                    }),
                });
                expect(updates.slice(1)).toEqual([
                    stateUpdatedEvent({
                        test: {
                            tags: {
                                abc: edit(version.vector, insert('ghi')),
                            },
                        },
                    }),
                ]);
                expect(Object.keys(version.vector).length).toBeGreaterThan(0);
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

                const editVersion = { ...version.vector };
                await partition.applyEvents([
                    botUpdated('test', {
                        tags: {
                            abc: edit(editVersion, del(2)),
                        },
                    }),
                ]);

                expect(partition.state).toEqual({
                    test: createBot('test', {
                        abc: 'f',
                    }),
                });
                expect(updates.slice(1)).toEqual([
                    stateUpdatedEvent({
                        test: {
                            tags: {
                                abc: edit(version.vector, del(2)),
                            },
                        },
                    }),
                ]);
                expect(Object.keys(version.vector).length).toBeGreaterThan(0);
            });

            it('should support deletes in multiple edit sequences', async () => {
                await partition.applyEvents([
                    botAdded(
                        createBot('test', {
                            abc: 'abcdefghijklmnop',
                        })
                    ),
                ]);

                await waitAsync();

                const editVersion = { ...version.vector };
                await partition.applyEvents([
                    botUpdated('test', {
                        tags: {
                            abc: edits(
                                editVersion,
                                [preserve(3), del(3)],
                                [preserve(6), del(3)]
                            ),
                        },
                    }),
                ]);

                expect(partition.state).toEqual({
                    test: createBot('test', {
                        abc: 'abcghimnop',
                    }),
                });
                expect(updates.slice(1)).toEqual([
                    stateUpdatedEvent({
                        test: {
                            tags: {
                                abc: testForMergedEdits
                                    ? edits(version.vector, [
                                          preserve(3),
                                          del(3),
                                          preserve(3),
                                          del(3),
                                      ])
                                    : edits(
                                          version.vector,
                                          [preserve(3), del(3)],
                                          [preserve(6), del(3)]
                                      ),
                            },
                        },
                    }),
                ]);
                expect(Object.keys(version.vector).length).toBeGreaterThan(0);
            });

            it('should support inserts in multiple edit sequences', async () => {
                await partition.applyEvents([
                    botAdded(
                        createBot('test', {
                            abc: 'abcdef',
                        })
                    ),
                ]);

                await waitAsync();

                const editVersion = { ...version.vector };
                await partition.applyEvents([
                    botUpdated('test', {
                        tags: {
                            abc: edits(
                                editVersion,
                                [preserve(3), insert('123')],
                                [preserve(9), insert('456')]
                            ),
                        },
                    }),
                ]);

                expect(partition.state).toEqual({
                    test: createBot('test', {
                        abc: 'abc123def456',
                    }),
                });

                expect(updates.slice(1)).toEqual([
                    stateUpdatedEvent({
                        test: {
                            tags: {
                                abc: testForMergedEdits
                                    ? edits(version.vector, [
                                          preserve(3),
                                          insert('123'),
                                          preserve(3),
                                          insert('456'),
                                      ])
                                    : edits(
                                          version.vector,
                                          [preserve(3), insert('123')],
                                          [preserve(9), insert('456')]
                                      ),
                            },
                        },
                    }),
                ]);
                expect(Object.keys(version.vector).length).toBeGreaterThan(0);
            });

            it('should delete tags that have all text deleted', async () => {
                await partition.applyEvents([
                    botAdded(
                        createBot('test', {
                            abc: 'abcdef',
                        })
                    ),
                ]);

                await waitAsync();

                const editVersion = { ...version.vector };
                await partition.applyEvents([
                    botUpdated('test', {
                        tags: {
                            abc: edits(editVersion, [del(6)]),
                        },
                    }),
                ]);

                expect(partition.state).toEqual({
                    test: createBot('test', {}),
                });

                expect(updates.slice(1)).toEqual([
                    stateUpdatedEvent({
                        test: {
                            tags: {
                                abc: edits(version.vector, [del(6)]),
                            },
                        },
                    }),
                ]);
                expect(Object.keys(version.vector).length).toBeGreaterThan(0);
            });

            const valueCases = [
                [
                    'numbers',
                    123,
                    edit({}, preserve(1), insert('abc')),
                    '1abc23',
                ] as const,
                [
                    'booleans',
                    true,
                    edit({}, preserve(1), insert('abc')),
                    'tabcrue',
                ] as const,
                [
                    'objects',
                    { prop: 'yes' },
                    edit({}, preserve(1), insert('abc')),
                    '{abc"prop":"yes"}',
                ] as const,
            ];

            it.each(valueCases)(
                'should support %s',
                async (desc, initial, edit, expected) => {
                    await partition.applyEvents([
                        botAdded(
                            createBot('test', {
                                abc: initial,
                            })
                        ),
                    ]);

                    await waitAsync();

                    await partition.applyEvents([
                        botUpdated('test', {
                            tags: {
                                abc: edit,
                            },
                        }),
                    ]);

                    expect(partition.state).toEqual({
                        test: createBot('test', {
                            abc: expected,
                        }),
                    });
                }
            );

            it('should use a separate site ID for remote edits', async () => {
                await partition.applyEvents([
                    botAdded(
                        createBot('test', {
                            abc: 'def',
                        })
                    ),
                ]);

                await waitAsync();

                const editVersion = { ...version.vector };
                const tagEdit = edit(editVersion, insert('ghi'));
                tagEdit.isRemote = true;
                await partition.applyEvents([
                    botUpdated('test', {
                        tags: {
                            abc: tagEdit,
                        },
                    }),
                ]);

                expect(partition.state).toEqual({
                    test: createBot('test', {
                        abc: 'ghidef',
                    }),
                });

                const partitionEdit = updates[1].state.test.tags.abc;

                expect(partitionEdit.version).not.toEqual({
                    [version.currentSite]: expect.any(Number),
                });
                expect(partitionEdit.version).toEqual({
                    [version.remoteSite]: expect.any(Number),
                });

                expect(Object.keys(version.vector).length).toBeGreaterThan(0);
            });

            if (testConcurrentEdits) {
                describe('concurrent edits', () => {
                    const cases = [
                        [
                            'should support concatenations',
                            'def',
                            [
                                [insert('ghi')],
                                [preserve(3), insert('jfk')],
                                [preserve(6), insert('lmn')],
                            ],
                            'ghijfklmndef',
                        ] as const,
                        [
                            'should support inserts',
                            'def',
                            [
                                [insert('ghi')],
                                [preserve(1), insert('jfk')],
                                [preserve(3), insert('lmn')],
                            ],
                            'gjflmnkhidef',
                        ] as const,
                        [
                            'should support deletes',
                            'def',
                            [
                                [insert('ghi')],
                                [preserve(1), del(2)],
                                [preserve(1), del(2)],
                            ],
                            'gf',
                        ] as const,
                    ];

                    it.each(cases)(
                        '%s',
                        async (desc, startValue, operations, expected) => {
                            await partition.applyEvents([
                                botAdded(
                                    createBot('test', {
                                        abc: startValue,
                                    })
                                ),
                            ]);

                            await waitAsync();

                            const editVersion = { ...version.vector };

                            const edits = operations.map((ops: any) =>
                                edit(editVersion, ...ops)
                            );

                            for (let e of edits) {
                                await partition.applyEvents([
                                    botUpdated('test', {
                                        tags: {
                                            abc: e,
                                        },
                                    }),
                                ]);
                            }

                            expect(partition.state).toEqual({
                                test: createBot('test', {
                                    abc: expected,
                                }),
                            });
                            expect(
                                Object.keys(version.vector).length
                            ).toBeGreaterThan(0);
                        }
                    );

                    it('should handle concurrent inserts that rely on each other', async () => {
                        await partition.applyEvents([
                            botAdded(
                                createBot('test', {
                                    abc: `abc\nabc\nabc\nabc`,
                                })
                            ),
                        ]);

                        await waitAsync();

                        const editVersion = { ...version.vector };

                        let edit = edits(
                            editVersion,
                            [preserve(3), insert('d')],
                            [preserve(8), insert('d')],
                            [preserve(13), insert('d')],
                            [preserve(18), insert('d')]
                        );

                        await partition.applyEvents([
                            botUpdated('test', {
                                tags: {
                                    abc: edit,
                                },
                            }),
                        ]);

                        expect(partition.state).toEqual({
                            test: createBot('test', {
                                abc: 'abcd\nabcd\nabcd\nabcd',
                            }),
                        });
                        expect(
                            Object.keys(version.vector).length
                        ).toBeGreaterThan(0);
                    });

                    it('should handle local edits while remote edits occur', async () => {
                        await partition.applyEvents([
                            botAdded(
                                createBot('test', {
                                    abc: 'def',
                                })
                            ),
                        ]);

                        await waitAsync();

                        const editVersion = { ...version.vector };

                        const edit1 = edit(editVersion, insert('111'));
                        // after: 111def
                        const edit2 = edit(
                            editVersion,
                            preserve(1),
                            insert('222')
                        );
                        // after: 122211def
                        const edit3 = edit(
                            editVersion,
                            preserve(2),
                            insert('333')
                        );
                        // after: 122213331def

                        const remoteEdit1 = edit(
                            editVersion,
                            preserve(2),
                            insert('444')
                        );
                        // TODO: this is probably a bug but I want to wait on this until people
                        // start having problems.
                        // BUG: remote edits always see the local edits
                        // after: 114441def
                        edit2.isRemote = true;

                        // final: 122213334441def

                        await partition.applyEvents([
                            botUpdated('test', {
                                tags: {
                                    abc: edit1,
                                },
                            }),
                        ]);
                        await partition.applyEvents([
                            botUpdated('test', {
                                tags: {
                                    abc: remoteEdit1,
                                },
                            }),
                        ]);
                        await partition.applyEvents([
                            botUpdated('test', {
                                tags: {
                                    abc: edit2,
                                },
                            }),
                        ]);
                        await partition.applyEvents([
                            botUpdated('test', {
                                tags: {
                                    abc: edit3,
                                },
                            }),
                        ]);

                        expect(partition.state).toEqual({
                            test: createBot('test', {
                                abc: '122213334441def',
                            }),
                        });
                    });
                });

                describe('fuzzing', () => {
                    faker.seed(95423);

                    const randomEdits = generateRandomEditCases(25);
                    const paragraphCases = generateRandomEditParagraphCases(5);

                    describe.each([...randomEdits, ...paragraphCases])(
                        '%s -> %s',
                        (startText, endText, intermediateTexts, edits) => {
                            const space = 'space';

                            it('should be able to apply the given edits to produce the final text', async () => {
                                await partition.applyEvents([
                                    botAdded(
                                        createBot('test', {
                                            abc: startText,
                                        })
                                    ),
                                ]);

                                for (let i = 0; i < edits.length; i++) {
                                    let edit = edits[i];
                                    let str = intermediateTexts[i];

                                    await partition.applyEvents([
                                        botUpdated('test', {
                                            tags: {
                                                abc: edit,
                                            },
                                        }),
                                    ]);

                                    expect(partition.state).toEqual({
                                        test: createBot(
                                            'test',
                                            hasValue(str)
                                                ? {
                                                      abc: str,
                                                  }
                                                : {}
                                        ),
                                    });
                                }

                                expect(partition.state).toEqual({
                                    test: createBot(
                                        'test',
                                        hasValue(endText)
                                            ? {
                                                  abc: endText,
                                              }
                                            : {}
                                    ),
                                });
                            });

                            it('should be able to apply the given edit to tag masks', async () => {
                                partition.space = space;

                                await partition.applyEvents([
                                    botUpdated('test', {
                                        masks: {
                                            [space]: {
                                                abc: startText,
                                            },
                                        },
                                    }),
                                ]);

                                for (let i = 0; i < edits.length; i++) {
                                    let edit = edits[i];
                                    let str = intermediateTexts[i];

                                    await partition.applyEvents([
                                        botUpdated('test', {
                                            masks: {
                                                [space]: {
                                                    abc: edit,
                                                },
                                            },
                                        }),
                                    ]);

                                    expect(partition.state).toEqual({
                                        test: hasValue(str)
                                            ? {
                                                  masks: {
                                                      [space]: {
                                                          abc: str,
                                                      },
                                                  },
                                              }
                                            : {},
                                    });
                                }

                                expect(partition.state).toEqual({
                                    test: hasValue(endText)
                                        ? {
                                              masks: {
                                                  [space]: {
                                                      abc: endText,
                                                  },
                                              },
                                          }
                                        : {},
                                });
                            });
                        }
                    );
                });
            }
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

            it('should support tag mask updates on multiple bots at a time', async () => {
                await partition.applyEvents([
                    botUpdated('test1', {
                        masks: {
                            [partition.space]: {
                                newTag: true,
                                abc: 123,
                            },
                        },
                    }),
                    botUpdated('test2', {
                        masks: {
                            [partition.space]: {
                                otherTag: true,
                                num: 123,
                            },
                        },
                    }),
                ]);

                await waitAsync();

                expect(partition.state).toEqual({
                    test1: {
                        masks: {
                            [partition.space]: {
                                newTag: true,
                                abc: 123,
                            },
                        },
                    },
                    test2: {
                        masks: {
                            [partition.space]: {
                                otherTag: true,
                                num: 123,
                            },
                        },
                    },
                });
                expect(updated).toEqual([]);
                expect(updates).toEqual([
                    {
                        state: {
                            test1: {
                                masks: {
                                    [partition.space]: {
                                        newTag: true,
                                        abc: 123,
                                    },
                                },
                            },
                            test2: {
                                masks: {
                                    [partition.space]: {
                                        otherTag: true,
                                        num: 123,
                                    },
                                },
                            },
                        },
                        addedBots: [],
                        removedBots: [],
                        updatedBots: ['test1', 'test2'],
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
                                    abc: edit(version.vector, insert('ghi')),
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
                                        abc: edit(
                                            version.vector,
                                            insert('ghi')
                                        ),
                                    },
                                },
                            },
                        }),
                    ]);
                    expect(Object.keys(version.vector).length).toBeGreaterThan(
                        0
                    );
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
                                    abc: edit(version.vector, del(2)),
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
                                        abc: edit(version.vector, del(2)),
                                    },
                                },
                            },
                        }),
                    ]);
                    expect(Object.keys(version.vector).length).toBeGreaterThan(
                        0
                    );
                });

                it('should delete tag masks that have all text deleted', async () => {
                    await partition.applyEvents([
                        botUpdated('test', {
                            masks: {
                                [partition.space]: {
                                    newTag: 'value',
                                },
                            },
                        }),
                    ]);

                    await waitAsync();

                    const editVersion = { ...version.vector };
                    await partition.applyEvents([
                        botUpdated('test', {
                            masks: {
                                [partition.space]: {
                                    newTag: edits(editVersion, [del(5)]),
                                },
                            },
                        }),
                    ]);

                    expect(partition.state).toEqual({
                        test: {},
                    });

                    expect(updates.slice(1)).toEqual([
                        stateUpdatedEvent({
                            test: {
                                masks: {
                                    [partition.space]: {
                                        newTag: edits(version.vector, [del(5)]),
                                    },
                                },
                            },
                        }),
                    ]);
                    expect(Object.keys(version.vector).length).toBeGreaterThan(
                        0
                    );
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
