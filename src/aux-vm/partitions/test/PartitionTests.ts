import { AuxPartition } from '../AuxPartition';
import {
    botAdded,
    createBot,
    Bot,
    UpdatedBot,
    botRemoved,
    botUpdated,
} from '@casual-simulation/aux-common';
import { Subscription } from 'rxjs';
import { waitAsync } from '../../test/TestHelpers';

export function testPartitionImplementation(
    createPartition: () => Promise<AuxPartition>
) {
    let partition: AuxPartition;
    let added: Bot[];
    let removed: string[];
    let updated: UpdatedBot[];
    let sub: Subscription;
    beforeEach(async () => {
        sub = new Subscription();
        partition = await createPartition();

        added = [];
        removed = [];
        updated = [];

        sub.add(partition.onBotsAdded.subscribe(bots => added.push(...bots)));
        sub.add(partition.onBotsRemoved.subscribe(ids => removed.push(...ids)));
        sub.add(
            partition.onBotsUpdated.subscribe(updates =>
                updated.push(...updates)
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
    });
}
