import { CausalRepoServer, AddAtomsEvent } from './CausalRepoServer';
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
                    name: 'add_atoms',
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
                    name: 'add_atoms',
                    data: {
                        branch: 'doesNotExist',
                        atoms: [],
                    },
                },
            ]);
        });
    });

    describe('leave_branch', () => {
        it('should stop sending new atoms to devices that have left a branch', async () => {
            server.init();

            const device = new MemroyConnection('testDevice');
            const addAtoms = new Subject<AddAtomsEvent>();
            device.events.set('add_atoms', addAtoms);

            const device1 = new MemroyConnection('testDevice1');
            const joinBranch1 = new Subject<string>();
            const leaveBranch1 = new Subject<string>();
            device1.events.set('join_or_create_branch', joinBranch1);
            device1.events.set('leave_branch', leaveBranch1);

            connections.connection.next(device);
            connections.connection.next(device1);
            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});
            const a4 = atom(atomId('a', 4), a3, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, [a1, a2, idx, c]);
            await updateBranch(store, b);
            await waitAsync();

            joinBranch1.next('testBranch');
            await waitAsync();

            addAtoms.next({
                branch: 'testBranch',
                atoms: [a3],
            });
            await waitAsync();

            leaveBranch1.next('testBranch');
            await waitAsync();

            addAtoms.next({
                branch: 'testBranch',
                atoms: [a4],
            });
            await waitAsync();

            expect(device1.messages).toEqual([
                {
                    name: 'add_atoms',
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2],
                    },
                },
                {
                    name: 'add_atoms',
                    data: {
                        branch: 'testBranch',
                        atoms: [a3],
                    },
                },
            ]);
        });
    });

    describe('add_atoms', () => {
        it('should add the given atoms to the given branch', async () => {
            server.init();

            const device = new MemroyConnection('testDevice');
            const addAtoms = new Subject<AddAtomsEvent>();
            device.events.set('add_atoms', addAtoms);

            const joinBranch = new Subject<string>();
            device.events.set('join_or_create_branch', joinBranch);

            connections.connection.next(device);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, [a1, a2, idx, c]);
            await updateBranch(store, b);

            addAtoms.next({
                branch: 'testBranch',
                atoms: [a3],
            });

            await waitAsync();

            joinBranch.next('testBranch');

            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: 'add_atoms',
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2, a3],
                    },
                },
            ]);
        });

        it('should notify all other devices connected to the branch', async () => {
            server.init();

            const device = new MemroyConnection('testDevice');
            const addAtoms = new Subject<AddAtomsEvent>();
            device.events.set('add_atoms', addAtoms);

            const device1 = new MemroyConnection('testDevice1');
            const joinBranch1 = new Subject<string>();
            device1.events.set('join_or_create_branch', joinBranch1);

            const device2 = new MemroyConnection('testDevice2');
            const joinBranch2 = new Subject<string>();
            device2.events.set('join_or_create_branch', joinBranch2);

            connections.connection.next(device);
            connections.connection.next(device1);
            connections.connection.next(device2);

            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, [a1, a2, idx, c]);
            await updateBranch(store, b);

            joinBranch1.next('testBranch');
            joinBranch2.next('testBranch');

            await waitAsync();

            addAtoms.next({
                branch: 'testBranch',
                atoms: [a3],
            });

            await waitAsync();

            expect(device1.messages).toEqual([
                {
                    name: 'add_atoms',
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2],
                    },
                },
                {
                    name: 'add_atoms',
                    data: {
                        branch: 'testBranch',
                        atoms: [a3],
                    },
                },
            ]);

            expect(device2.messages).toEqual([
                {
                    name: 'add_atoms',
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2],
                    },
                },
                {
                    name: 'add_atoms',
                    data: {
                        branch: 'testBranch',
                        atoms: [a3],
                    },
                },
            ]);
        });
    });
});
