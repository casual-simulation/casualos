import { AuxPartition, getPartitionState } from '../AuxPartition';
import {
    botAdded,
    createBot,
    Bot,
    UpdatedBot,
    botRemoved,
    botUpdated,
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
} from 'rxjs/operators';

export function testPartitionImplementation(
    createPartition: () => Promise<AuxPartition>
) {
    let partition: AuxPartition;
    let added: Bot[];
    let removed: string[];
    let updated: UpdatedBot[];
    let statuses: StatusUpdate[];
    let sub: Subscription;
    beforeEach(async () => {
        sub = new Subscription();
        partition = await createPartition();

        added = [];
        removed = [];
        updated = [];
        statuses = [];

        sub.add(partition.onBotsAdded.subscribe(bots => added.push(...bots)));
        sub.add(partition.onBotsRemoved.subscribe(ids => removed.push(...ids)));
        sub.add(
            partition.onBotsUpdated.subscribe(updates =>
                updated.push(...updates)
            )
        );

        sub.add(
            partition.onStatusUpdated.subscribe(update => statuses.push(update))
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
            partition.onBotsAdded.subscribe(a => added.push(...a));

            expect(added).toEqual([bot1, bot2]);
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
            partition.onBotsAdded.subscribe(a => added.push(...a));

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
                    takeWhile(update => update.type !== 'sync', true),
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
