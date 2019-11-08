import {
    Actor,
    processConnections,
    processBranches,
    processActorBranches,
    CausalTreeServer2SocketIO,
} from './CausalTreeServer2SocketIO';
import {
    MemoryConnectionServer,
    MemroyConnection,
} from './MemoryConnectionServer';
import {
    MemoryCausalRepoStore,
    atom,
    atomId,
    index,
    commit,
    branch,
    storeData,
    updateBranch,
} from '@casual-simulation/causal-trees/core2';
import { Subject } from 'rxjs';

describe('CausalTreeServer2', () => {
    let server: CausalTreeServer2SocketIO;
    let connections: MemoryConnectionServer;
    let store: MemoryCausalRepoStore;

    beforeEach(() => {
        store = new MemoryCausalRepoStore();
        connections = new MemoryConnectionServer();
        server = new CausalTreeServer2SocketIO(connections, store);
    });

    describe('join_branch', () => {
        it('should load the given branch and send the current atoms', async () => {
            server.init();

            const device = new MemroyConnection('testDevice');
            const joinBranch = new Subject<string>();
            device.events.set('join_branch', joinBranch);

            connections.connection.next(device);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, [a1, a2, idx, c]);
            await updateBranch(store, b);

            joinBranch.next('testBranch');

            expect(device.messages).toEqual([
                {
                    name: 'testBranch_atoms',
                    data: [a1, a2],
                },
            ]);
        });
    });
});
