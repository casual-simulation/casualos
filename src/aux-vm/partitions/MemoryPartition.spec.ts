import { testPartitionImplementation } from './test/PartitionTests';
import { createMemoryPartition } from './MemoryPartition';
import { StatusUpdate } from '@casual-simulation/causal-trees';

describe('MemoryPartition', () => {
    testPartitionImplementation(async () => {
        return createMemoryPartition({
            type: 'memory',
            initialState: {},
        });
    });

    describe('connect', () => {
        it('should issue connection and sync event', () => {
            const mem = createMemoryPartition({
                type: 'memory',
                initialState: {},
            });

            const updates: StatusUpdate[] = [];
            mem.onStatusUpdated.subscribe(update => updates.push(update));

            mem.connect();

            expect(updates).toEqual([
                {
                    type: 'connection',
                    connected: true,
                },
                {
                    type: 'sync',
                    synced: true,
                },
            ]);
        });
    });
});
