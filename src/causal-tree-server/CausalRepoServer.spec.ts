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
    loadCommit,
    loadBranch,
    AddAtomsEvent,
    WATCH_BRANCH,
    ADD_ATOMS,
    UNWATCH_BRANCH,
    WATCH_BRANCHES,
    LOAD_BRANCH,
    UNLOAD_BRANCH,
    WATCH_DEVICES,
    DEVICE_CONNECTED_TO_BRANCH,
    UNWATCH_DEVICES,
    DEVICE_DISCONNECTED_FROM_BRANCH,
} from '@casual-simulation/causal-trees/core2';
import { waitAsync } from './test/TestHelpers';
import { Subject } from 'rxjs';

console.log = jest.fn();

describe('CausalRepoServer', () => {
    let server: CausalRepoServer;
    let connections: MemoryConnectionServer;
    let store: MemoryCausalRepoStore;

    beforeEach(() => {
        store = new MemoryCausalRepoStore();
        connections = new MemoryConnectionServer();
        server = new CausalRepoServer(connections, store);
    });

    describe(WATCH_BRANCH, () => {
        it('should load the given branch and send the current atoms', async () => {
            server.init();

            const device = new MemroyConnection('testDevice');
            const joinBranch = new Subject<string>();
            device.events.set(WATCH_BRANCH, joinBranch);

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
                    name: ADD_ATOMS,
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
            device.events.set(WATCH_BRANCH, joinBranch);

            connections.connection.next(device);
            await waitAsync();

            joinBranch.next('doesNotExist');

            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'doesNotExist',
                        atoms: [],
                    },
                },
            ]);
        });

        it('should be able to accept multiple requests to watch a branch at a time', async () => {
            server.init();

            const device = new MemroyConnection('testDevice');
            const joinBranch = new Subject<string>();
            device.events.set(WATCH_BRANCH, joinBranch);

            const device1 = new MemroyConnection('testDevice1');
            const joinBranch1 = new Subject<string>();
            device1.events.set(WATCH_BRANCH, joinBranch1);

            connections.connection.next(device);
            connections.connection.next(device1);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, [a1, a2, idx, c]);
            await updateBranch(store, b);

            joinBranch.next('testBranch');
            joinBranch1.next('testBranch');

            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2],
                    },
                },
            ]);

            expect(device1.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2],
                    },
                },
            ]);
        });
    });

    describe(UNWATCH_BRANCH, () => {
        it('should stop sending new atoms to devices that have left a branch', async () => {
            server.init();

            const device = new MemroyConnection('testDevice');
            const addAtoms = new Subject<AddAtomsEvent>();
            device.events.set(ADD_ATOMS, addAtoms);

            const device1 = new MemroyConnection('testDevice1');
            const joinBranch1 = new Subject<string>();
            const leaveBranch1 = new Subject<string>();
            device1.events.set(WATCH_BRANCH, joinBranch1);
            device1.events.set(UNWATCH_BRANCH, leaveBranch1);

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
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2],
                    },
                },
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a3],
                    },
                },
            ]);
        });
    });

    describe(WATCH_BRANCHES, () => {
        it('should issue an event when a branch is loaded', async () => {
            server.init();

            const device = new MemroyConnection('testDevice');
            const joinBranch = new Subject<string>();
            device.events.set(WATCH_BRANCH, joinBranch);

            const device1 = new MemroyConnection('testDevice1');
            const watchBranches = new Subject<void>();
            device1.events.set(WATCH_BRANCHES, watchBranches);

            connections.connection.next(device);
            connections.connection.next(device1);
            await waitAsync();

            watchBranches.next();
            await waitAsync();

            joinBranch.next('testBranch');
            await waitAsync();

            expect(device1.messages).toEqual([
                {
                    name: LOAD_BRANCH,
                    data: {
                        branch: 'testBranch',
                    },
                },
            ]);
        });

        it('should issue an event for each branch that is already loaded', async () => {
            server.init();

            const device = new MemroyConnection('testDevice');
            const joinBranch = new Subject<string>();
            device.events.set(WATCH_BRANCH, joinBranch);

            const device1 = new MemroyConnection('testDevice1');
            const watchBranches = new Subject<void>();
            device1.events.set(WATCH_BRANCHES, watchBranches);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, [a1, a2, idx, c]);
            await updateBranch(store, b);

            connections.connection.next(device);
            connections.connection.next(device1);
            await waitAsync();

            joinBranch.next('testBranch');
            await waitAsync();

            watchBranches.next();
            await waitAsync();

            joinBranch.next('testBranch2');
            await waitAsync();

            expect(device1.messages).toEqual([
                {
                    name: LOAD_BRANCH,
                    data: {
                        branch: 'testBranch',
                    },
                },
                {
                    name: LOAD_BRANCH,
                    data: {
                        branch: 'testBranch2',
                    },
                },
            ]);
        });

        it('should issue an event when a branch is unloaded via unwatching leaving', async () => {
            server.init();

            const device = new MemroyConnection('testDevice');
            const joinBranch = new Subject<string>();
            const leaveBranch = new Subject<string>();
            device.events.set(WATCH_BRANCH, joinBranch);
            device.events.set(UNWATCH_BRANCH, leaveBranch);

            const device1 = new MemroyConnection('testDevice1');
            const watchBranches = new Subject<void>();
            device1.events.set(WATCH_BRANCHES, watchBranches);

            connections.connection.next(device);
            connections.connection.next(device1);
            await waitAsync();

            watchBranches.next();
            await waitAsync();

            joinBranch.next('testBranch');
            await waitAsync();

            leaveBranch.next('testBranch');
            await waitAsync();

            expect(device1.messages).toEqual([
                {
                    name: LOAD_BRANCH,
                    data: {
                        branch: 'testBranch',
                    },
                },
                {
                    name: UNLOAD_BRANCH,
                    data: {
                        branch: 'testBranch',
                    },
                },
            ]);
        });

        it('should issue an event when a branch is unloaded via disconnecting', async () => {
            server.init();

            const device = new MemroyConnection('testDevice');
            const joinBranch = new Subject<string>();
            const leaveBranch = new Subject<string>();
            device.events.set(WATCH_BRANCH, joinBranch);
            device.events.set(UNWATCH_BRANCH, leaveBranch);

            const device1 = new MemroyConnection('testDevice1');
            const watchBranches = new Subject<void>();
            device1.events.set(WATCH_BRANCHES, watchBranches);

            connections.connection.next(device);
            connections.connection.next(device1);
            await waitAsync();

            watchBranches.next();
            await waitAsync();

            joinBranch.next('testBranch');
            await waitAsync();

            device.disconnect.next();
            await waitAsync();

            expect(device1.messages).toEqual([
                {
                    name: LOAD_BRANCH,
                    data: {
                        branch: 'testBranch',
                    },
                },
                {
                    name: UNLOAD_BRANCH,
                    data: {
                        branch: 'testBranch',
                    },
                },
            ]);
        });

        it('should commit changes before unloading a branch', async () => {
            server.init();

            const device = new MemroyConnection('testDevice');
            const joinBranch = new Subject<string>();
            const leaveBranch = new Subject<string>();
            const addAtoms = new Subject<AddAtomsEvent>();
            device.events.set(WATCH_BRANCH, joinBranch);
            device.events.set(UNWATCH_BRANCH, leaveBranch);
            device.events.set(ADD_ATOMS, addAtoms);

            const device1 = new MemroyConnection('testDevice1');
            const watchBranches = new Subject<void>();
            device1.events.set(WATCH_BRANCHES, watchBranches);

            connections.connection.next(device);
            connections.connection.next(device1);
            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, [a1, a2, idx, c]);
            await updateBranch(store, b);

            watchBranches.next();
            await waitAsync();

            joinBranch.next('testBranch');
            await waitAsync();

            addAtoms.next({
                branch: 'testBranch',
                atoms: [a3],
            });
            await waitAsync();

            leaveBranch.next('testBranch');
            await waitAsync();

            const [savedBranch] = await store.getBranches('testBranch');
            expect(savedBranch.hash).not.toBe(b.hash);

            const savedCommit = await loadBranch(store, savedBranch);
            expect([...savedCommit.atoms.values()]).toEqual([a1, a2, a3]);
            expect(savedCommit.commit.message).toEqual('Save before unload');
        });
    });

    describe(ADD_ATOMS, () => {
        it('should add the given atoms to the given branch', async () => {
            server.init();

            const device = new MemroyConnection('testDevice');
            const addAtoms = new Subject<AddAtomsEvent>();
            device.events.set(ADD_ATOMS, addAtoms);

            const joinBranch = new Subject<string>();
            device.events.set(WATCH_BRANCH, joinBranch);

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
                    name: ADD_ATOMS,
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
            device.events.set(ADD_ATOMS, addAtoms);

            const device1 = new MemroyConnection('testDevice1');
            const joinBranch1 = new Subject<string>();
            device1.events.set(WATCH_BRANCH, joinBranch1);

            const device2 = new MemroyConnection('testDevice2');
            const joinBranch2 = new Subject<string>();
            device2.events.set(WATCH_BRANCH, joinBranch2);

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
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2],
                    },
                },
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a3],
                    },
                },
            ]);

            expect(device2.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2],
                    },
                },
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a3],
                    },
                },
            ]);
        });

        it('should not notify the device that sent the new atoms', async () => {
            server.init();

            const device = new MemroyConnection('testDevice');
            const addAtoms = new Subject<AddAtomsEvent>();
            const joinBranch = new Subject<string>();
            device.events.set(ADD_ATOMS, addAtoms);
            device.events.set(WATCH_BRANCH, joinBranch);

            connections.connection.next(device);

            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, [a1, a2, idx, c]);
            await updateBranch(store, b);

            joinBranch.next('testBranch');

            await waitAsync();

            addAtoms.next({
                branch: 'testBranch',
                atoms: [a3],
            });

            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2],
                    },
                },
            ]);
        });

        it('should immediately store the added atoms', async () => {
            server.init();

            const device = new MemroyConnection('testDevice');
            const addAtoms = new Subject<AddAtomsEvent>();
            device.events.set(ADD_ATOMS, addAtoms);

            const joinBranch = new Subject<string>();
            device.events.set(WATCH_BRANCH, joinBranch);

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

            const [repoAtom] = await store.getObjects([a3.hash]);
            expect(repoAtom).toEqual({
                type: 'atom',
                data: a3,
            });
        });
    });

    describe(WATCH_DEVICES, () => {
        it('should send an event when a device connects to a branch', async () => {
            server.init();

            const device = new MemroyConnection('testDevice');
            const watchDevices = new Subject<void>();
            device.events.set(WATCH_DEVICES, watchDevices);

            const device1 = new MemroyConnection('testDevice1');
            const joinBranch1 = new Subject<string>();
            device1.events.set(WATCH_BRANCH, joinBranch1);

            connections.connection.next(device);
            connections.connection.next(device1);
            await waitAsync();

            watchDevices.next();
            await waitAsync();

            joinBranch1.next('testBranch');
            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: DEVICE_CONNECTED_TO_BRANCH,
                    data: {
                        branch: 'testBranch',
                        connectionId: 'testDevice1',
                    },
                },
            ]);
        });

        it('should send an event when a device unwatches a branch', async () => {
            server.init();

            const device = new MemroyConnection('testDevice');
            const watchDevices = new Subject<void>();
            device.events.set(WATCH_DEVICES, watchDevices);

            const device1 = new MemroyConnection('testDevice1');
            const joinBranch1 = new Subject<string>();
            const leaveBranch1 = new Subject<string>();
            device1.events.set(WATCH_BRANCH, joinBranch1);
            device1.events.set(UNWATCH_BRANCH, leaveBranch1);

            connections.connection.next(device);
            connections.connection.next(device1);
            await waitAsync();

            watchDevices.next();
            await waitAsync();

            joinBranch1.next('testBranch');
            await waitAsync();

            leaveBranch1.next('testBranch');
            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: DEVICE_CONNECTED_TO_BRANCH,
                    data: {
                        branch: 'testBranch',
                        connectionId: 'testDevice1',
                    },
                },
                {
                    name: DEVICE_DISCONNECTED_FROM_BRANCH,
                    data: {
                        branch: 'testBranch',
                        connectionId: 'testDevice1',
                    },
                },
            ]);
        });

        it('should send an event when a device disconnects', async () => {
            server.init();

            const device = new MemroyConnection('testDevice');
            const watchDevices = new Subject<void>();
            device.events.set(WATCH_DEVICES, watchDevices);

            const device1 = new MemroyConnection('testDevice1');
            const joinBranch1 = new Subject<string>();
            device1.events.set(WATCH_BRANCH, joinBranch1);

            connections.connection.next(device);
            connections.connection.next(device1);
            await waitAsync();

            watchDevices.next();
            await waitAsync();

            joinBranch1.next('testBranch');
            await waitAsync();

            device1.disconnect.next();
            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: DEVICE_CONNECTED_TO_BRANCH,
                    data: {
                        branch: 'testBranch',
                        connectionId: 'testDevice1',
                    },
                },
                {
                    name: DEVICE_DISCONNECTED_FROM_BRANCH,
                    data: {
                        branch: 'testBranch',
                        connectionId: 'testDevice1',
                    },
                },
            ]);
        });

        it('should send events for all the currently loaded branches and devices', async () => {
            server.init();

            const device = new MemroyConnection('testDevice');
            const watchDevices = new Subject<void>();
            device.events.set(WATCH_DEVICES, watchDevices);

            const device1 = new MemroyConnection('testDevice1');
            const joinBranch1 = new Subject<string>();
            device1.events.set(WATCH_BRANCH, joinBranch1);

            const device2 = new MemroyConnection('testDevice2');
            const joinBranch2 = new Subject<string>();
            device2.events.set(WATCH_BRANCH, joinBranch2);

            const device3 = new MemroyConnection('testDevice3');
            const joinBranch3 = new Subject<string>();
            device3.events.set(WATCH_BRANCH, joinBranch3);

            connections.connection.next(device);
            connections.connection.next(device1);
            connections.connection.next(device2);
            connections.connection.next(device3);
            await waitAsync();

            joinBranch1.next('testBranch');
            await waitAsync();

            joinBranch2.next('testBranch2');
            await waitAsync();

            joinBranch3.next('testBranch2');
            await waitAsync();

            watchDevices.next();
            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: DEVICE_CONNECTED_TO_BRANCH,
                    data: {
                        branch: 'testBranch',
                        connectionId: 'testDevice1',
                    },
                },
                {
                    name: DEVICE_CONNECTED_TO_BRANCH,
                    data: {
                        branch: 'testBranch2',
                        connectionId: 'testDevice2',
                    },
                },
                {
                    name: DEVICE_CONNECTED_TO_BRANCH,
                    data: {
                        branch: 'testBranch2',
                        connectionId: 'testDevice3',
                    },
                },
            ]);
        });
    });

    // describe(UNWATCH_DEVICES, () => {
    //     it('should stop sending events when a device connects to a branch', async () => {
    //         server.init();

    //         const device = new MemroyConnection('testDevice');
    //         const watchDevices = new Subject<void>();
    //         device.events.set(WATCH_DEVICES, watchDevices);

    //         const device1 = new MemroyConnection('testDevice1');
    //         const joinBranch1 = new Subject<string>();
    //         device1.events.set(WATCH_BRANCH, joinBranch1);

    //         connections.connection.next(device);
    //         connections.connection.next(device1);
    //         await waitAsync();

    //         watchDevices.next();
    //         await waitAsync();

    //         joinBranch1.next('testBranch');
    //         await waitAsync();

    //         expect(device.messages).toEqual([
    //             {
    //                 name: DEVICE_CONNECTED_TO_BRANCH,
    //                 data: {
    //                     branch: 'testBranch',
    //                     connectionId: 'testDevice1'
    //                 },
    //             },
    //         ]);
    //     });
    // });
});
