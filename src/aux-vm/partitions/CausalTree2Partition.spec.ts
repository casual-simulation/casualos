import { testPartitionImplementation } from './test/PartitionTests';
import { CausalTree2PartitionImpl } from './CausalTree2Partition';

describe('CausalTree2Partition', () => {
    testPartitionImplementation(
        async () =>
            new CausalTree2PartitionImpl({
                id: 'test',
                name: 'name',
                token: 'token',
                username: 'username',
            })
    );
});
