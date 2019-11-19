import { testPartitionImplementation } from './test/PartitionTests';
import { CausalRepoPartitionImpl } from './CausalTree2Partition';

describe('CausalRepoPartition', () => {
    testPartitionImplementation(
        async () =>
            new CausalRepoPartitionImpl({
                id: 'test',
                name: 'name',
                token: 'token',
                username: 'username',
            })
    );
});
