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

    it('should return immediate for the editStrategy', () => {
        const partition = new CausalRepoPartitionImpl(
            {
                id: 'test',
                name: 'name',
                token: 'token',
                username: 'username',
            },
            { type: 'causal_repo' }
        );

        expect(partition.realtimeStrategy).toEqual('immediate');
    });
});
