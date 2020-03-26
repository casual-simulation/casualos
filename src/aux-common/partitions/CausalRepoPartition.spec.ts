import { testPartitionImplementation } from './test/PartitionTests';
import { CausalRepoPartitionImpl } from './CausalRepoPartition';

describe('CausalRepoPartition', () => {
    testPartitionImplementation(
        async () =>
            new CausalRepoPartitionImpl(
                {
                    id: 'test',
                    name: 'name',
                    token: 'token',
                    username: 'username',
                },
                { type: 'causal_repo' }
            )
    );
});
