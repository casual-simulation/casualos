import {
    AddUpdatesEvent,
    ADD_ATOMS,
    ADD_UPDATES,
    CausalRepoClient,
    MemoryConnectionClient,
} from '@casual-simulation/causal-trees';
import { BehaviorSubject } from 'rxjs';
import { Doc } from 'yjs';
import { testPartitionImplementation } from './test/PartitionTests';
import { fromByteArray } from 'base64-js';
import { RemoteYjsPartitionImpl } from './RemoteYjsPartition';

describe('RemoteYjsPartition', () => {
    testPartitionImplementation(
        async () => {
            let update: Uint8Array;

            const doc = new Doc();
            const map = doc.getMap('__test');

            doc.on('update', (u: Uint8Array) => {
                update = u;
            });
            doc.transact(() => {
                map.set('abc', 123);
            });

            if (!update) {
                throw new Error('Unable to get update!');
            }

            const connection = new MemoryConnectionClient();
            const addAtoms = new BehaviorSubject<AddUpdatesEvent>({
                branch: 'testBranch',
                updates: [fromByteArray(update)],
                initial: true,
            });
            connection.events.set(ADD_UPDATES, addAtoms);

            const client = new CausalRepoClient(connection);
            connection.connect();

            return new RemoteYjsPartitionImpl(
                {
                    id: 'test',
                    name: 'name',
                    token: 'token',
                    username: 'username',
                },
                client,
                {
                    type: 'remote_yjs',
                    branch: 'testBranch',
                    host: 'testHost',
                }
            );
        },
        true,
        true
    );
});
