import { CausalRepoClient } from './CausalRepoClient';
import { MemoryConnectionClient } from './MemoryConnectionClient';
import { WATCH_BRANCH } from '@casual-simulation/causal-trees/core2';

describe('CausalRepoClient', () => {
    let client: CausalRepoClient;
    let connection: MemoryConnectionClient;

    beforeEach(() => {
        connection = new MemoryConnectionClient();
        client = new CausalRepoClient(connection);
    });

    describe(WATCH_BRANCH, () => {
        it('should send a watch branch event', () => {
            client.watchBranch('abc');

            expect(connection.sentMessages).toEqual([
                {
                    name: WATCH_BRANCH,
                    data: 'abc',
                },
            ]);
        });
    });
});
