import { CausalRepoServer } from './CausalRepoServer';
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
import { waitAsync } from './test/TestHelpers';
import { Subject } from 'rxjs';

describe('CausalRepoServer', () => {
    let server: CausalRepoServer;
    let connections: MemoryConnectionServer;
    let store: MemoryCausalRepoStore;

    beforeEach(() => {
        store = new MemoryCausalRepoStore();
        connections = new MemoryConnectionServer();
        server = new CausalRepoServer(connections, store);
    });

    describe('join_or_create_branch', () => {
        it('should load the given branch and send the current atoms', async () => {
            server.init();

            const device = new MemroyConnection('testDevice');
            const joinBranch = new Subject<string>();
            device.events.set('join_or_create_branch', joinBranch);

            connections.connection.next(device);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, [a1, a2, idx, c]);
            await updateBranch(store, b);

            joinBranch.next('testBranch');

            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: 'addAtoms',
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2],
                    },
                },
            ]);
        });

        it('should create a new orphan branch if the branch name does not exist', async () => {
            server.init();

            const device = new MemroyConnection('testDevice');
            const joinBranch = new Subject<string>();
            device.events.set('join_or_create_branch', joinBranch);

            connections.connection.next(device);
            await waitAsync();

            joinBranch.next('doesNotExist');

            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: 'addAtoms',
                    data: {
                        branch: 'doesNotExist',
                        atoms: [],
                    },
                },
            ]);
        });
    });
});
