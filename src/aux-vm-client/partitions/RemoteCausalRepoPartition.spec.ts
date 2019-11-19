import { testPartitionImplementation } from '@casual-simulation/aux-vm/partitions/test/PartitionTests';
import { RemoteCausalRepoPartitionImpl } from './RemoteCausalRepoPartition';
import { CausalRepoClient } from '../../causal-tree-client-socketio';
import { MemoryConnectionClient } from '@casual-simulation/causal-tree-client-socketio/MemoryConnectionClient';
import { BehaviorSubject } from 'rxjs';
import {
    Atom,
    atom,
    atomId,
    ADD_ATOMS,
    AddAtomsEvent,
} from '@casual-simulation/causal-trees/core2';

describe('RemoteCausalRepoPartition', () => {
    testPartitionImplementation(async () => {
        const connection = new MemoryConnectionClient();
        const addAtoms = new BehaviorSubject<AddAtomsEvent>({
            branch: 'testBranch',
            atoms: [atom(atomId('a', 1), null, {})],
        });
        connection.events.set(ADD_ATOMS, addAtoms);

        const client = new CausalRepoClient(connection);
        connection.connect();

        return new RemoteCausalRepoPartitionImpl(
            {
                id: 'test',
                name: 'name',
                token: 'token',
                username: 'username',
            },
            client,
            {
                type: 'remote_causal_repo',
                branch: 'testBranch',
                host: 'testHost',
            }
        );
    });
});
