import { testPartitionImplementation } from './test/PartitionTests';
import { createMemoryPartition } from './MemoryPartition';
import { Bot, createBot } from '../bots';
import { first } from 'rxjs/operators';

describe('MemoryPartition', () => {
    testPartitionImplementation(async () => {
        return createMemoryPartition({
            type: 'memory',
            initialState: {},
        });
    });

    describe('connect', () => {
        it('should send an onBotsAdded event for all the bots in the partition on init', async () => {
            const mem = createMemoryPartition({
                type: 'memory',
                initialState: {
                    test: createBot('test'),
                    test2: createBot('test2'),
                },
            });

            let added: Bot[] = [];
            mem.onBotsAdded.subscribe((e) => added.push(...e));

            expect(added).toEqual([createBot('test'), createBot('test2')]);
        });

        it('should return immediate for the editStrategy', () => {
            const mem = createMemoryPartition({
                type: 'memory',
                initialState: {
                    test: createBot('test'),
                    test2: createBot('test2'),
                },
            });

            expect(mem.realtimeStrategy).toEqual('immediate');
        });

        it('should have a current site ID', async () => {
            const mem = createMemoryPartition({
                type: 'memory',
                initialState: {
                    test: createBot('test'),
                    test2: createBot('test2'),
                },
            });

            const version = await mem.onVersionUpdated
                .pipe(first())
                .toPromise();

            expect(version.currentSite).not.toBe(null);
            expect(version.currentSite).toBeDefined();
        });
    });
});
