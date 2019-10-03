import { testPartitionImplementation } from './test/PartitionTests';
import { createMemoryPartition } from './MemoryPartition';

describe('MemoryPartition', () => {
    testPartitionImplementation(async () => {
        return createMemoryPartition({
            type: 'memory',
            initialState: {},
        });
    });
});
