import { CausalRepoServer } from './CausalRepoServer';
import {
    MemoryConnectionServer,
    MemoryConnection,
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
    MemoryStageStore,
    ATOMS_RECEIVED,
    BRANCH_INFO,
    SEND_EVENT,
    SendRemoteActionEvent,
    RECEIVE_EVENT,
    BRANCHES,
    atomIdToString,
    COMMIT,
    CommitEvent,
    WATCH_COMMITS,
    ADD_COMMITS,
    CHECKOUT,
    CheckoutEvent,
    RESTORE,
    RestoreEvent,
    CausalRepoCommit,
    GET_BRANCH,
    DEVICES,
    WatchBranchEvent,
    WATCH_BRANCH_DEVICES,
    UNWATCH_BRANCH_DEVICES,
    BRANCHES_STATUS,
    COMMIT_CREATED,
    RESTORED,
    RESET,
    SetBranchPasswordEvent,
    AuthenticateBranchWritesEvent,
    branchSettings,
    AUTHENTICATED_TO_BRANCH,
    ADD_UPDATES,
    AddUpdatesEvent,
    UPDATES_RECEIVED,
    GET_UPDATES,
    SYNC_TIME,
    TimeSyncRequest,
} from '@casual-simulation/causal-trees/core2';
import { waitAsync } from './test/TestHelpers';
import { Subject } from 'rxjs';
import {
    DeviceInfo,
    deviceInfo,
    remote,
    SESSION_ID_CLAIM,
    device as deviceEvent,
    remoteResult,
    deviceResult,
    remoteError,
    deviceError,
    SET_BRANCH_PASSWORD,
    AUTHENTICATE_BRANCH_WRITES,
    DEVICE_COUNT,
    MemoryUpdatesStore,
} from '@casual-simulation/causal-trees';
import { bot } from '../aux-vm/node_modules/@casual-simulation/aux-common/aux-format-2';
import {
    hashPassword,
    verifyPassword,
} from '../causal-trees/node_modules/@casual-simulation/crypto';

console.log = jest.fn();
console.error = jest.fn();

const device1Info = deviceInfo('device1', 'device1', 'device1');
const device2Info = deviceInfo('device2', 'device2', 'device2');
const device3Info = deviceInfo('device3', 'device3', 'device3');
const device4Info = deviceInfo('device4', 'device4', 'device4');

const serverInfo = deviceInfo('Server', 'deviceId', 'sessionId');

describe('CausalRepoServer', () => {
    let server: CausalRepoServer;
    let connections: MemoryConnectionServer;
    let store: MemoryCausalRepoStore;
    let stageStore: MemoryStageStore;
    let updateStore: MemoryUpdatesStore;

    beforeEach(() => {
        store = new MemoryCausalRepoStore();
        stageStore = new MemoryStageStore();
        connections = new MemoryConnectionServer();
        updateStore = new MemoryUpdatesStore();
        server = new CausalRepoServer(
            connections,
            store,
            stageStore,
            updateStore
        );
    });

    describe(WATCH_BRANCH, () => {
        it('should load the given branch and send the current atoms', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const joinBranch = new Subject<WatchBranchEvent>();
            device.events.set(WATCH_BRANCH, joinBranch);

            connections.connection.next(device);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, 'testBranch', idx.data.hash, [
                a1,
                a2,
                idx,
                c,
            ]);
            await updateBranch(store, b);

            joinBranch.next({
                branch: 'testBranch',
            });

            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2],
                        initial: true,
                    },
                },
            ]);
        });

        it('should create a new orphan branch if the branch name does not exist', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const joinBranch = new Subject<WatchBranchEvent>();
            device.events.set(WATCH_BRANCH, joinBranch);

            connections.connection.next(device);
            await waitAsync();

            joinBranch.next({
                branch: 'doesNotExist',
            });

            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'doesNotExist',
                        atoms: [],
                        initial: true,
                    },
                },
            ]);
        });

        it('should be able to accept multiple requests to watch a branch at a time', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const joinBranch = new Subject<WatchBranchEvent>();
            device.events.set(WATCH_BRANCH, joinBranch);

            const device2 = new MemoryConnection(device2Info);
            const joinBranch2 = new Subject<WatchBranchEvent>();
            device2.events.set(WATCH_BRANCH, joinBranch2);

            connections.connection.next(device);
            connections.connection.next(device2);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, 'testBranch', idx.data.hash, [
                a1,
                a2,
                idx,
                c,
            ]);
            await updateBranch(store, b);

            joinBranch.next({
                branch: 'testBranch',
            });
            joinBranch2.next({
                branch: 'testBranch',
            });

            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2],
                        initial: true,
                    },
                },
            ]);

            expect(device2.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2],
                        initial: true,
                    },
                },
            ]);
        });

        it('should load the atoms from the stage', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const addAtoms = new Subject<AddAtomsEvent>();
            device.events.set(ADD_ATOMS, addAtoms);

            const joinBranch = new Subject<WatchBranchEvent>();
            device.events.set(WATCH_BRANCH, joinBranch);

            connections.connection.next(device);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, 'testBranch', idx.data.hash, [
                a1,
                a2,
                idx,
                c,
            ]);
            await updateBranch(store, b);

            await stageStore.addAtoms('testBranch', [a3]);

            joinBranch.next({
                branch: 'testBranch',
            });

            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2, a3],
                        initial: true,
                    },
                },
            ]);
        });

        it('should log the site ID to the branch if specified', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const addAtoms = new Subject<AddAtomsEvent>();
            device.events.set(ADD_ATOMS, addAtoms);

            const joinBranch = new Subject<WatchBranchEvent>();
            device.events.set(WATCH_BRANCH, joinBranch);

            connections.connection.next(device);

            await waitAsync();

            joinBranch.next({
                branch: 'testBranch',
                siteId: 'testSite',
            });

            await waitAsync();

            const log = await store.getSitelog('testBranch');
            expect(log).toEqual([
                {
                    type: 'sitelog',
                    branch: 'testBranch',
                    site: 'testSite',
                    time: expect.any(Date),
                    sitelogType: 'WATCH',
                    connectionReason: 'watch_branch',
                },
            ]);
        });

        it('should only load the branch once when concurrent watch events arrive', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const device2 = new MemoryConnection(device2Info);
            const joinBranch = new Subject<WatchBranchEvent>();
            device.events.set(WATCH_BRANCH, joinBranch);

            const joinBranch2 = new Subject<WatchBranchEvent>();
            device2.events.set(WATCH_BRANCH, joinBranch2);

            connections.connection.next(device);
            connections.connection.next(device2);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, 'testBranch', idx.data.hash, [
                a1,
                a2,
                idx,
                c,
            ]);
            await updateBranch(store, b);

            const spy = jest.spyOn(store, 'getBranches');

            joinBranch.next({
                branch: 'testBranch',
            });

            joinBranch2.next({
                branch: 'testBranch',
            });

            await waitAsync();

            expect(spy).toBeCalledTimes(1);
        });

        describe('temp', () => {
            it('should load the branch without persistent data if the branch is temporary', async () => {
                server.init();

                const device = new MemoryConnection(device1Info);
                const joinBranch = new Subject<WatchBranchEvent>();
                device.events.set(WATCH_BRANCH, joinBranch);

                connections.connection.next(device);

                const a1 = atom(atomId('a', 1), null, {});
                const a2 = atom(atomId('a', 2), a1, {});

                const idx = index(a1, a2);
                const c = commit('message', new Date(2019, 9, 4), idx, null);
                const b = branch('testBranch', c);

                await storeData(store, 'testBranch', idx.data.hash, [
                    a1,
                    a2,
                    idx,
                    c,
                ]);
                await updateBranch(store, b);

                joinBranch.next({
                    branch: 'testBranch',
                    temporary: true,
                });

                await waitAsync();

                expect(device.messages).toEqual([
                    {
                        name: ADD_ATOMS,
                        data: {
                            branch: 'testBranch',
                            atoms: [],
                            initial: true,
                        },
                    },
                ]);
            });

            it('should load the atoms that were added to the branch by another device', async () => {
                server.init();

                const device = new MemoryConnection(device1Info);
                const joinBranch = new Subject<WatchBranchEvent>();
                const addAtoms = new Subject<AddAtomsEvent>();
                device.events.set(ADD_ATOMS, addAtoms);
                device.events.set(WATCH_BRANCH, joinBranch);

                const device3 = new MemoryConnection(device3Info);
                const joinBranch3 = new Subject<WatchBranchEvent>();
                device3.events.set(WATCH_BRANCH, joinBranch3);

                connections.connection.next(device);
                connections.connection.next(device3);

                await waitAsync();

                const a1 = atom(atomId('a', 1), null, {});

                joinBranch.next({
                    branch: 'testBranch',
                    temporary: true,
                });

                await waitAsync();

                addAtoms.next({
                    branch: 'testBranch',
                    atoms: [a1],
                });

                await waitAsync();

                joinBranch3.next({
                    branch: 'testBranch',
                    temporary: true,
                });

                await waitAsync();

                expect(device3.messages).toEqual([
                    {
                        name: ADD_ATOMS,
                        data: {
                            branch: 'testBranch',
                            atoms: [a1],
                            initial: true,
                        },
                    },
                ]);
            });

            it('should not log the site ID to the branch if specified', async () => {
                server.init();

                const device = new MemoryConnection(device1Info);
                const addAtoms = new Subject<AddAtomsEvent>();
                device.events.set(ADD_ATOMS, addAtoms);

                const joinBranch = new Subject<WatchBranchEvent>();
                device.events.set(WATCH_BRANCH, joinBranch);

                connections.connection.next(device);

                await waitAsync();

                joinBranch.next({
                    branch: 'testBranch',
                    siteId: 'testSite',
                    temporary: true,
                });

                await waitAsync();

                const log = await store.getSitelog('testBranch');
                expect(log).toEqual([]);
            });

            it('should not create a branch', async () => {
                server.init();

                const device = new MemoryConnection(device1Info);
                const addAtoms = new Subject<AddAtomsEvent>();
                device.events.set(ADD_ATOMS, addAtoms);

                const joinBranch = new Subject<WatchBranchEvent>();
                device.events.set(WATCH_BRANCH, joinBranch);

                connections.connection.next(device);

                await waitAsync();

                joinBranch.next({
                    branch: 'testBranch',
                    siteId: 'testSite',
                    temporary: true,
                });

                await waitAsync();

                const branches = await store.getBranches('testBranch');
                expect(branches).toEqual([]);
            });

            it('should be able to load a temporary branch immediately after loading a persistent branch', async () => {
                server.init();

                const device = new MemoryConnection(device1Info);
                const joinBranch = new Subject<WatchBranchEvent>();
                const addAtoms = new Subject<AddAtomsEvent>();
                device.events.set(WATCH_BRANCH, joinBranch);
                device.events.set(ADD_ATOMS, addAtoms);

                connections.connection.next(device);

                const a1 = atom(atomId('a', 1), null, {});
                const a2 = atom(atomId('a', 2), a1, {});
                const b1 = atom(atomId('b', 1), null, {});
                const b2 = atom(atomId('b', 2), b1, {});

                const idx = index(a1, a2);
                const c = commit('message', new Date(2019, 9, 4), idx, null);
                const b = branch('testBranch', c);

                await storeData(store, 'testBranch', idx.data.hash, [
                    a1,
                    a2,
                    idx,
                    c,
                ]);
                await updateBranch(store, b);

                joinBranch.next({
                    branch: 'persistentBranch',
                });

                joinBranch.next({
                    branch: 'tempBranch',
                    temporary: true,
                });

                addAtoms.next({
                    branch: 'tempBranch',
                    atoms: [b1, b2],
                });

                await waitAsync();

                expect(device.messages).toEqual([
                    {
                        name: ADD_ATOMS,
                        data: {
                            branch: 'persistentBranch',
                            atoms: [],
                            initial: true,
                        },
                    },
                    {
                        name: ADD_ATOMS,
                        data: {
                            branch: 'tempBranch',
                            atoms: [],
                            initial: true,
                        },
                    },
                    {
                        name: ATOMS_RECEIVED,
                        data: {
                            branch: 'tempBranch',
                            hashes: [b1.hash, b2.hash],
                        },
                    },
                ]);
            });
        });

        describe('updates', () => {
            it('should do nothing if updates are not supported', async () => {
                server = new CausalRepoServer(
                    connections,
                    store,
                    stageStore,
                    null
                );
                server.init();

                const device = new MemoryConnection(device1Info);
                const joinBranch = new Subject<WatchBranchEvent>();
                device.events.set(WATCH_BRANCH, joinBranch);

                connections.connection.next(device);

                joinBranch.next({
                    branch: 'testBranch',
                    protocol: 'updates',
                });

                await waitAsync();

                expect(device.messages).toEqual([]);
            });

            it('should load the given branch and send the current updates', async () => {
                server.init();

                const device = new MemoryConnection(device1Info);
                const joinBranch = new Subject<WatchBranchEvent>();
                device.events.set(WATCH_BRANCH, joinBranch);

                connections.connection.next(device);

                await updateStore.addUpdates('testBranch', ['111', '222']);

                joinBranch.next({
                    branch: 'testBranch',
                    protocol: 'updates',
                });

                await waitAsync();

                expect(device.messages).toEqual([
                    {
                        name: ADD_UPDATES,
                        data: {
                            branch: 'testBranch',
                            updates: ['111', '222'],
                            initial: true,
                        },
                    },
                ]);
            });

            it('should create a new orphan branch if the branch name does not exist', async () => {
                server.init();

                const device = new MemoryConnection(device1Info);
                const joinBranch = new Subject<WatchBranchEvent>();
                device.events.set(WATCH_BRANCH, joinBranch);

                connections.connection.next(device);
                await waitAsync();

                joinBranch.next({
                    branch: 'doesNotExist',
                    protocol: 'updates',
                });

                await waitAsync();

                expect(device.messages).toEqual([
                    {
                        name: ADD_UPDATES,
                        data: {
                            branch: 'doesNotExist',
                            updates: [] as string[],
                            initial: true,
                        },
                    },
                ]);
            });

            describe('temp', () => {
                it('should load the branch without persistent data if the branch is temporary', async () => {
                    server.init();

                    const device = new MemoryConnection(device1Info);
                    const joinBranch = new Subject<WatchBranchEvent>();
                    device.events.set(WATCH_BRANCH, joinBranch);

                    connections.connection.next(device);

                    await updateStore.addUpdates('testBranch', ['111', '222']);

                    joinBranch.next({
                        branch: 'testBranch',
                        temporary: true,
                        protocol: 'updates',
                    });

                    await waitAsync();

                    expect(device.messages).toEqual([
                        {
                            name: ADD_UPDATES,
                            data: {
                                branch: 'testBranch',
                                updates: [],
                                initial: true,
                            },
                        },
                    ]);
                });

                it('should load the updates that were added to the branch by another device', async () => {
                    server.init();

                    const device = new MemoryConnection(device1Info);
                    const joinBranch = new Subject<WatchBranchEvent>();
                    const addUpdates = new Subject<AddUpdatesEvent>();
                    device.events.set(ADD_UPDATES, addUpdates);
                    device.events.set(WATCH_BRANCH, joinBranch);

                    const device3 = new MemoryConnection(device3Info);
                    const joinBranch3 = new Subject<WatchBranchEvent>();
                    device3.events.set(WATCH_BRANCH, joinBranch3);

                    connections.connection.next(device);
                    connections.connection.next(device3);

                    await waitAsync();

                    joinBranch.next({
                        branch: 'testBranch',
                        temporary: true,
                        protocol: 'updates',
                    });

                    await waitAsync();

                    addUpdates.next({
                        branch: 'testBranch',
                        updates: ['abc', 'def'],
                    });

                    await waitAsync();

                    joinBranch3.next({
                        branch: 'testBranch',
                        temporary: true,
                        protocol: 'updates',
                    });

                    await waitAsync();

                    expect(device3.messages).toEqual([
                        {
                            name: ADD_UPDATES,
                            data: {
                                branch: 'testBranch',
                                updates: ['abc', 'def'],
                                initial: true,
                            },
                        },
                    ]);
                });
            });
        });
    });

    describe(GET_BRANCH, () => {
        it('should load the given branch and send the current atoms', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const getBranch = new Subject<string>();
            device.events.set(GET_BRANCH, getBranch);

            connections.connection.next(device);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, 'testBranch', idx.data.hash, [
                a1,
                a2,
                idx,
                c,
            ]);
            await updateBranch(store, b);

            getBranch.next('testBranch');

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

            const device = new MemoryConnection(device1Info);
            const getBranch = new Subject<string>();
            device.events.set(GET_BRANCH, getBranch);

            connections.connection.next(device);

            await waitAsync();

            getBranch.next('testBranch');

            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [],
                    },
                },
            ]);
        });

        it('should not send additional atoms that were added after the GET_BRANCH call', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const device2 = new MemoryConnection(device2Info);
            const getBranch = new Subject<string>();
            const addAtoms = new Subject<AddAtomsEvent>();
            device.events.set(GET_BRANCH, getBranch);
            device2.events.set(ADD_ATOMS, addAtoms);

            connections.connection.next(device);
            connections.connection.next(device2);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const b1 = atom(atomId('b', 1), null, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, 'testBranch', idx.data.hash, [
                a1,
                a2,
                idx,
                c,
            ]);
            await updateBranch(store, b);

            getBranch.next('testBranch');

            await waitAsync();

            addAtoms.next({
                branch: 'testBranch',
                atoms: [b1],
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
    });

    describe(GET_UPDATES, () => {
        let originalNow: any;
        let mockedNow: jest.Mock<number>;

        beforeEach(() => {
            originalNow = Date.now;
            Date.now = mockedNow = jest.fn();
        });

        afterEach(() => {
            Date.now = originalNow;
        });

        it('should load the given branch and send the current updates', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const getBranch = new Subject<string>();
            device.events.set(GET_UPDATES, getBranch);

            connections.connection.next(device);

            mockedNow.mockReturnValue(100);
            await updateStore.addUpdates('testBranch', ['111', '222']);

            await waitAsync();

            getBranch.next('testBranch');

            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: ADD_UPDATES,
                    data: {
                        branch: 'testBranch',
                        updates: ['111', '222'],
                        timestamps: [100, 100],
                    },
                },
            ]);
        });

        it('should not send additional atoms that were added after the GET_UPDATES call', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const device2 = new MemoryConnection(device2Info);
            const getBranch = new Subject<string>();
            const addAtoms = new Subject<AddUpdatesEvent>();
            device.events.set(GET_UPDATES, getBranch);
            device2.events.set(ADD_UPDATES, addAtoms);

            connections.connection.next(device);
            connections.connection.next(device2);

            mockedNow.mockReturnValue(100);
            await updateStore.addUpdates('testBranch', ['111', '222']);

            await waitAsync();

            getBranch.next('testBranch');

            await waitAsync();

            mockedNow.mockReturnValue(200);
            addAtoms.next({
                branch: 'testBranch',
                updates: ['333', '444'],
            });

            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: ADD_UPDATES,
                    data: {
                        branch: 'testBranch',
                        updates: ['111', '222'],
                        timestamps: [100, 100],
                    },
                },
            ]);
        });
    });

    describe(UNWATCH_BRANCH, () => {
        it('should stop sending new atoms to devices that have left a branch', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const addAtoms = new Subject<AddAtomsEvent>();
            device.events.set(ADD_ATOMS, addAtoms);

            const device2 = new MemoryConnection(device2Info);
            const joinBranch1 = new Subject<WatchBranchEvent>();
            const leaveBranch1 = new Subject<string>();
            device2.events.set(WATCH_BRANCH, joinBranch1);
            device2.events.set(UNWATCH_BRANCH, leaveBranch1);

            connections.connection.next(device);
            connections.connection.next(device2);
            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});
            const a4 = atom(atomId('a', 4), a3, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, 'testBranch', idx.data.hash, [
                a1,
                a2,
                idx,
                c,
            ]);
            await updateBranch(store, b);
            await waitAsync();

            joinBranch1.next({
                branch: 'testBranch',
            });
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

            expect(device2.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2],
                        initial: true,
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

        it('should commit changes before unloading a branch', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const joinBranch = new Subject<WatchBranchEvent>();
            const leaveBranch = new Subject<string>();
            const addAtoms = new Subject<AddAtomsEvent>();
            device.events.set(WATCH_BRANCH, joinBranch);
            device.events.set(UNWATCH_BRANCH, leaveBranch);
            device.events.set(ADD_ATOMS, addAtoms);

            const device2 = new MemoryConnection(device2Info);
            const watchBranches = new Subject<void>();
            device2.events.set(WATCH_BRANCHES, watchBranches);

            connections.connection.next(device);
            connections.connection.next(device2);
            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, 'testBranch', idx.data.hash, [
                a1,
                a2,
                idx,
                c,
            ]);
            await updateBranch(store, b);

            watchBranches.next();
            await waitAsync();

            joinBranch.next({
                branch: 'testBranch',
            });
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
            expect(savedCommit.commit.message).toEqual(
                'Save testBranch before unload'
            );
        });

        it('should clear the stored stage after commiting', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const joinBranch = new Subject<WatchBranchEvent>();
            const leaveBranch = new Subject<string>();
            const addAtoms = new Subject<AddAtomsEvent>();
            device.events.set(WATCH_BRANCH, joinBranch);
            device.events.set(UNWATCH_BRANCH, leaveBranch);
            device.events.set(ADD_ATOMS, addAtoms);

            const device2 = new MemoryConnection(device2Info);
            const watchBranches = new Subject<void>();
            device2.events.set(WATCH_BRANCHES, watchBranches);

            connections.connection.next(device);
            connections.connection.next(device2);
            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, 'testBranch', idx.data.hash, [
                a1,
                a2,
                idx,
                c,
            ]);
            await updateBranch(store, b);

            watchBranches.next();
            await waitAsync();

            joinBranch.next({
                branch: 'testBranch',
            });
            await waitAsync();

            addAtoms.next({
                branch: 'testBranch',
                atoms: [a3],
            });
            await waitAsync();

            leaveBranch.next('testBranch');
            await waitAsync();

            const stage = await stageStore.getStage('testBranch');
            expect(stage).toEqual({
                additions: [],
                deletions: {},
            });
        });

        it('should do nothing if the branch is already unloaded', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const watchDevices = new Subject<void>();
            device.events.set(WATCH_DEVICES, watchDevices);

            const joinBranch = new Subject<WatchBranchEvent>();
            const leaveBranch = new Subject<string>();
            device.events.set(WATCH_BRANCH, joinBranch);
            device.events.set(UNWATCH_BRANCH, leaveBranch);

            connections.connection.next(device);

            await waitAsync();

            watchDevices.next();

            await waitAsync();

            leaveBranch.next('testBranch');

            await waitAsync();

            expect(device.messages).toEqual([]);
        });

        it('should not clear the stage if the branch is not loaded', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const watchDevices = new Subject<void>();
            device.events.set(WATCH_DEVICES, watchDevices);

            const joinBranch = new Subject<WatchBranchEvent>();
            const leaveBranch = new Subject<string>();
            device.events.set(WATCH_BRANCH, joinBranch);
            device.events.set(UNWATCH_BRANCH, leaveBranch);

            connections.connection.next(device);

            await waitAsync();

            watchDevices.next();

            const a1 = atom(atomId('a', 1), null, bot('test'));
            await stageStore.addAtoms('testBranch', [a1]);

            await waitAsync();

            leaveBranch.next('testBranch');

            await waitAsync();

            const atoms = await stageStore.getStage('testBranch');

            expect(atoms.additions).toEqual([a1]);
        });

        it('should wait to commit until the branch has been loaded', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const watchDevices = new Subject<void>();
            device.events.set(WATCH_DEVICES, watchDevices);

            const joinBranch = new Subject<WatchBranchEvent>();
            const leaveBranch = new Subject<string>();
            device.events.set(WATCH_BRANCH, joinBranch);
            device.events.set(UNWATCH_BRANCH, leaveBranch);

            connections.connection.next(device);

            await waitAsync();

            watchDevices.next();

            const a1 = atom(atomId('a', 1), null, bot('test'));
            await stageStore.addAtoms('testBranch', [a1]);

            await waitAsync();

            joinBranch.next({
                branch: 'testBranch',
            });
            leaveBranch.next('testBranch');

            await waitAsync();

            const atoms = await stageStore.getStage('testBranch');

            expect(atoms.additions).toEqual([]);

            const [branch] = await store.getBranches('testBranch');
            const commit = await loadBranch(store, branch);
            expect([...commit.atoms.values()]).toEqual([a1]);
        });

        it('should not clear the stage if there are no changes', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const watchDevices = new Subject<void>();
            device.events.set(WATCH_DEVICES, watchDevices);

            const joinBranch = new Subject<WatchBranchEvent>();
            const leaveBranch = new Subject<string>();
            device.events.set(WATCH_BRANCH, joinBranch);
            device.events.set(UNWATCH_BRANCH, leaveBranch);

            connections.connection.next(device);

            await waitAsync();

            watchDevices.next();

            const a1 = atom(atomId('a', 1), null, bot('test'));

            // The same data is stored in the stage as the
            // repo store.
            await stageStore.addAtoms('testBranch', [a1]);
            const idx = index(a1);
            const b = branch('testBranch', idx);
            await storeData(store, 'testBranch', idx.data.hash, [a1, idx]);
            await store.saveBranch(b);

            await waitAsync();

            joinBranch.next({
                branch: 'testBranch',
            });
            leaveBranch.next('testBranch');

            await waitAsync();

            const atoms = await stageStore.getStage('testBranch');

            expect(atoms.additions).toEqual([a1]);
        });

        it('should log the site when unwatching a branch', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const joinBranch = new Subject<WatchBranchEvent>();
            const leaveBranch = new Subject<string>();
            device.events.set(WATCH_BRANCH, joinBranch);
            device.events.set(UNWATCH_BRANCH, leaveBranch);

            connections.connection.next(device);
            await waitAsync();

            joinBranch.next({
                branch: 'testBranch',
                siteId: 'testSite',
            });
            await waitAsync();

            leaveBranch.next('testBranch');
            await waitAsync();

            const log = await store.getSitelog('testBranch');

            expect(log).toEqual([
                {
                    type: 'sitelog',
                    branch: 'testBranch',
                    site: 'testSite',
                    time: expect.any(Date),
                    sitelogType: 'UNWATCH',
                    connectionReason: 'unwatch_branch',
                },
                {
                    type: 'sitelog',
                    branch: 'testBranch',
                    site: 'testSite',
                    time: expect.any(Date),
                    sitelogType: 'WATCH',
                    connectionReason: 'watch_branch',
                },
            ]);
        });

        it('should log the site when disconnected while watching a branch', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const joinBranch = new Subject<WatchBranchEvent>();
            const leaveBranch = new Subject<string>();
            device.events.set(WATCH_BRANCH, joinBranch);
            device.events.set(UNWATCH_BRANCH, leaveBranch);

            connections.connection.next(device);
            await waitAsync();

            joinBranch.next({
                branch: 'testBranch',
                siteId: 'testSite',
            });
            await waitAsync();

            device.disconnect.next('timeout');
            await waitAsync();

            const log = await store.getSitelog('testBranch');

            expect(log).toEqual([
                {
                    type: 'sitelog',
                    branch: 'testBranch',
                    site: 'testSite',
                    time: expect.any(Date),
                    sitelogType: 'UNWATCH',
                    connectionReason: 'timeout',
                },
                {
                    type: 'sitelog',
                    branch: 'testBranch',
                    site: 'testSite',
                    time: expect.any(Date),
                    sitelogType: 'WATCH',
                    connectionReason: 'watch_branch',
                },
            ]);
        });

        describe('updates', () => {
            it('should clear the temporary branch when all devices have left', async () => {
                server.init();

                const device = new MemoryConnection(device1Info);
                const addUpdates = new Subject<AddUpdatesEvent>();
                device.events.set(ADD_UPDATES, addUpdates);

                const device2 = new MemoryConnection(device2Info);
                const joinBranch1 = new Subject<WatchBranchEvent>();
                const leaveBranch1 = new Subject<string>();
                device2.events.set(WATCH_BRANCH, joinBranch1);
                device2.events.set(UNWATCH_BRANCH, leaveBranch1);

                connections.connection.next(device);
                connections.connection.next(device2);
                await waitAsync();

                joinBranch1.next({
                    branch: 'testBranch',
                    protocol: 'updates',
                    temporary: true,
                });
                await waitAsync();

                addUpdates.next({
                    branch: 'testBranch',
                    updates: ['abc'],
                });
                await waitAsync();

                leaveBranch1.next('testBranch');
                await waitAsync();

                addUpdates.next({
                    branch: 'testBranch',
                    updates: ['def'],
                });
                await waitAsync();

                joinBranch1.next({
                    branch: 'testBranch',
                    protocol: 'updates',
                    temporary: true,
                });

                await waitAsync();

                expect(device2.messages).toEqual([
                    {
                        name: ADD_UPDATES,
                        data: {
                            branch: 'testBranch',
                            updates: [],
                            initial: true,
                        },
                    },
                    {
                        name: ADD_UPDATES,
                        data: {
                            branch: 'testBranch',
                            updates: ['abc'],
                        },
                    },
                    {
                        name: ADD_UPDATES,
                        data: {
                            branch: 'testBranch',
                            updates: [],
                            initial: true,
                        },
                    },
                ]);
            });
        });
    });

    describe(WATCH_BRANCHES, () => {
        it('should issue an event when a branch is loaded', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const joinBranch = new Subject<WatchBranchEvent>();
            device.events.set(WATCH_BRANCH, joinBranch);

            const device2 = new MemoryConnection(device2Info);
            const watchBranches = new Subject<void>();
            device2.events.set(WATCH_BRANCHES, watchBranches);

            connections.connection.next(device);
            connections.connection.next(device2);
            await waitAsync();

            watchBranches.next();
            await waitAsync();

            joinBranch.next({
                branch: 'testBranch',
            });
            await waitAsync();

            expect(device2.messages).toEqual([
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

            const device = new MemoryConnection(device1Info);
            const joinBranch = new Subject<WatchBranchEvent>();
            device.events.set(WATCH_BRANCH, joinBranch);

            const device2 = new MemoryConnection(device2Info);
            const watchBranches = new Subject<void>();
            device2.events.set(WATCH_BRANCHES, watchBranches);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, 'testBranch', idx.data.hash, [
                a1,
                a2,
                idx,
                c,
            ]);
            await updateBranch(store, b);

            connections.connection.next(device);
            connections.connection.next(device2);
            await waitAsync();

            joinBranch.next({
                branch: 'testBranch',
            });
            await waitAsync();

            watchBranches.next();
            await waitAsync();

            joinBranch.next({
                branch: 'testBranch2',
            });
            await waitAsync();

            expect(device2.messages).toEqual([
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

            const device = new MemoryConnection(device1Info);
            const joinBranch = new Subject<WatchBranchEvent>();
            const leaveBranch = new Subject<string>();
            device.events.set(WATCH_BRANCH, joinBranch);
            device.events.set(UNWATCH_BRANCH, leaveBranch);

            const device2 = new MemoryConnection(device2Info);
            const watchBranches = new Subject<void>();
            device2.events.set(WATCH_BRANCHES, watchBranches);

            connections.connection.next(device);
            connections.connection.next(device2);
            await waitAsync();

            watchBranches.next();
            await waitAsync();

            joinBranch.next({
                branch: 'testBranch',
            });
            await waitAsync();

            leaveBranch.next('testBranch');
            await waitAsync();

            expect(device2.messages).toEqual([
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

            const device = new MemoryConnection(device1Info);
            const joinBranch = new Subject<WatchBranchEvent>();
            const leaveBranch = new Subject<string>();
            device.events.set(WATCH_BRANCH, joinBranch);
            device.events.set(UNWATCH_BRANCH, leaveBranch);

            const device2 = new MemoryConnection(device2Info);
            const watchBranches = new Subject<void>();
            device2.events.set(WATCH_BRANCHES, watchBranches);

            connections.connection.next(device);
            connections.connection.next(device2);
            await waitAsync();

            watchBranches.next();
            await waitAsync();

            joinBranch.next({
                branch: 'testBranch',
            });
            await waitAsync();

            device.disconnect.next('transport_close');
            await waitAsync();

            expect(device2.messages).toEqual([
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
    });

    describe(ADD_ATOMS, () => {
        it('should add the given atoms to the given branch', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const addAtoms = new Subject<AddAtomsEvent>();
            device.events.set(ADD_ATOMS, addAtoms);

            const joinBranch = new Subject<WatchBranchEvent>();
            device.events.set(WATCH_BRANCH, joinBranch);

            connections.connection.next(device);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, 'testBranch', idx.data.hash, [
                a1,
                a2,
                idx,
                c,
            ]);
            await updateBranch(store, b);

            addAtoms.next({
                branch: 'testBranch',
                atoms: [a3],
            });

            await waitAsync();

            joinBranch.next({
                branch: 'testBranch',
            });

            await waitAsync();

            expect(device.messages).toEqual([
                // Server should send a atoms received event
                // back indicating which atoms it processed
                {
                    name: ATOMS_RECEIVED,
                    data: {
                        branch: 'testBranch',
                        hashes: [a3.hash],
                    },
                },

                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2, a3],
                        initial: true,
                    },
                },
            ]);
        });

        it('should not add atoms that violate cardinality', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const addAtoms = new Subject<AddAtomsEvent>();
            device.events.set(ADD_ATOMS, addAtoms);

            const joinBranch = new Subject<WatchBranchEvent>();
            device.events.set(WATCH_BRANCH, joinBranch);

            connections.connection.next(device);

            const a1 = atom(
                atomId('a', 1, undefined, { group: 'abc', number: 1 }),
                null,
                {}
            );
            const a2 = atom(
                atomId('a', 2, undefined, { group: 'abc', number: 1 }),
                null,
                {}
            );

            const idx = index();
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, 'testBranch', idx.data.hash, [idx, c]);
            await updateBranch(store, b);

            addAtoms.next({
                branch: 'testBranch',
                atoms: [a1, a2],
            });

            await waitAsync();

            joinBranch.next({
                branch: 'testBranch',
            });

            await waitAsync();

            expect(device.messages).toEqual([
                // Server should send a atoms received event
                // back indicating which atoms it processed
                {
                    name: ATOMS_RECEIVED,
                    data: {
                        branch: 'testBranch',
                        hashes: [a1.hash, a2.hash],
                    },
                },

                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1],
                        initial: true,
                    },
                },
            ]);
        });

        it('should notify all other devices connected to the branch', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const addAtoms = new Subject<AddAtomsEvent>();
            device.events.set(ADD_ATOMS, addAtoms);

            const device2 = new MemoryConnection(device2Info);
            const joinBranch2 = new Subject<WatchBranchEvent>();
            device2.events.set(WATCH_BRANCH, joinBranch2);

            const device3 = new MemoryConnection(device3Info);
            const joinBranch3 = new Subject<WatchBranchEvent>();
            device3.events.set(WATCH_BRANCH, joinBranch3);

            connections.connection.next(device);
            connections.connection.next(device2);
            connections.connection.next(device3);

            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, 'testBranch', idx.data.hash, [
                a1,
                a2,
                idx,
                c,
            ]);
            await updateBranch(store, b);

            joinBranch2.next({
                branch: 'testBranch',
            });
            joinBranch3.next({
                branch: 'testBranch',
            });

            await waitAsync();

            addAtoms.next({
                branch: 'testBranch',
                atoms: [a3],
            });

            await waitAsync();

            expect(device2.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2],
                        initial: true,
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

            expect(device3.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2],
                        initial: true,
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

            const device = new MemoryConnection(device1Info);
            const addAtoms = new Subject<AddAtomsEvent>();
            const joinBranch = new Subject<WatchBranchEvent>();
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

            await storeData(store, 'testBranch', idx.data.hash, [
                a1,
                a2,
                idx,
                c,
            ]);
            await updateBranch(store, b);

            joinBranch.next({
                branch: 'testBranch',
            });

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
                        initial: true,
                    },
                },

                // Server should send a atoms received event
                // back indicating which atoms it processed
                {
                    name: ATOMS_RECEIVED,
                    data: {
                        branch: 'testBranch',
                        hashes: [a3.hash],
                    },
                },
            ]);
        });

        it('should immediately store the added atoms', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const addAtoms = new Subject<AddAtomsEvent>();
            device.events.set(ADD_ATOMS, addAtoms);

            const joinBranch = new Subject<WatchBranchEvent>();
            device.events.set(WATCH_BRANCH, joinBranch);

            connections.connection.next(device);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, 'testBranch', idx.data.hash, [
                a1,
                a2,
                idx,
                c,
            ]);
            await updateBranch(store, b);

            addAtoms.next({
                branch: 'testBranch',
                atoms: [a3],
            });

            await waitAsync();

            const repoAtom = await store.getObject(a3.hash);
            expect(repoAtom).toEqual({
                type: 'atom',
                data: a3,
            });
        });

        it('should store the given atoms with the current branch', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const addAtoms = new Subject<AddAtomsEvent>();
            device.events.set(ADD_ATOMS, addAtoms);

            const joinBranch = new Subject<WatchBranchEvent>();
            device.events.set(WATCH_BRANCH, joinBranch);

            connections.connection.next(device);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, 'testBranch', idx.data.hash, [
                a1,
                a2,
                idx,
                c,
            ]);
            await updateBranch(store, b);

            addAtoms.next({
                branch: 'testBranch',
                atoms: [a3],
            });

            await waitAsync();

            const [repoAtom] = await store.getObjects('testBranch', [a3.hash]);
            expect(repoAtom).toEqual({
                type: 'atom',
                data: a3,
            });
        });

        it('should not send atoms that are already in the current commit', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const addAtoms = new Subject<AddAtomsEvent>();
            device.events.set(ADD_ATOMS, addAtoms);

            const device2 = new MemoryConnection(device2Info);
            const joinBranch2 = new Subject<WatchBranchEvent>();
            device2.events.set(WATCH_BRANCH, joinBranch2);

            const device3 = new MemoryConnection(device3Info);
            const joinBranch3 = new Subject<WatchBranchEvent>();
            device3.events.set(WATCH_BRANCH, joinBranch3);

            connections.connection.next(device);
            connections.connection.next(device2);
            connections.connection.next(device3);

            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2, a3);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, 'testBranch', idx.data.hash, [
                a1,
                a2,
                a3,
                idx,
                c,
            ]);
            await updateBranch(store, b);

            joinBranch2.next({
                branch: 'testBranch',
            });
            joinBranch3.next({
                branch: 'testBranch',
            });

            await waitAsync();

            addAtoms.next({
                branch: 'testBranch',
                atoms: [a3],
            });

            await waitAsync();

            expect(device2.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2, a3],
                        initial: true,
                    },
                },
            ]);

            expect(device3.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2, a3],
                        initial: true,
                    },
                },
            ]);

            expect(device.messages).toEqual([
                {
                    name: ATOMS_RECEIVED,
                    data: {
                        branch: 'testBranch',
                        hashes: [a3.hash],
                    },
                },
            ]);
        });

        it('should add the atoms to the stage store', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const addAtoms = new Subject<AddAtomsEvent>();
            device.events.set(ADD_ATOMS, addAtoms);

            const joinBranch = new Subject<WatchBranchEvent>();
            device.events.set(WATCH_BRANCH, joinBranch);

            connections.connection.next(device);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, 'testBranch', idx.data.hash, [
                a1,
                a2,
                idx,
                c,
            ]);
            await updateBranch(store, b);

            addAtoms.next({
                branch: 'testBranch',
                atoms: [a3],
            });

            await waitAsync();

            const stage = await stageStore.getStage('testBranch');

            expect(stage).toEqual({
                additions: [a3],
                deletions: {},
            });
        });

        it('should remove the given atoms from the given branch', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const removeAtoms = new Subject<AddAtomsEvent>();
            device.events.set(ADD_ATOMS, removeAtoms);

            const joinBranch = new Subject<WatchBranchEvent>();
            device.events.set(WATCH_BRANCH, joinBranch);

            connections.connection.next(device);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2, a3);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, 'testBranch', idx.data.hash, [
                a1,
                a2,
                a3,
                idx,
                c,
            ]);
            await updateBranch(store, b);

            removeAtoms.next({
                branch: 'testBranch',
                removedAtoms: [a3.hash],
            });

            await waitAsync();

            joinBranch.next({
                branch: 'testBranch',
            });

            await waitAsync();

            expect(device.messages).toEqual([
                // Server should send a atoms received event
                // back indicating which atoms it processed
                {
                    name: ATOMS_RECEIVED,
                    data: {
                        branch: 'testBranch',
                        hashes: [a3.hash],
                    },
                },

                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2],
                        initial: true,
                    },
                },
            ]);
        });

        it('should not remove the given atoms if they are part of a cardinality tree', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const removeAtoms = new Subject<AddAtomsEvent>();
            device.events.set(ADD_ATOMS, removeAtoms);

            const joinBranch = new Subject<WatchBranchEvent>();
            device.events.set(WATCH_BRANCH, joinBranch);

            connections.connection.next(device);

            const a1 = atom(
                atomId('a', 1, undefined, { group: 'abc', number: 1 }),
                null,
                {}
            );
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2, a3);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, 'testBranch', idx.data.hash, [
                a1,
                a2,
                a3,
                idx,
                c,
            ]);
            await updateBranch(store, b);

            removeAtoms.next({
                branch: 'testBranch',
                removedAtoms: [a3.hash],
            });

            await waitAsync();

            joinBranch.next({
                branch: 'testBranch',
            });

            await waitAsync();

            expect(device.messages).toEqual([
                // Server should send a atoms received event
                // back indicating which atoms it processed
                {
                    name: ATOMS_RECEIVED,
                    data: {
                        branch: 'testBranch',
                        hashes: [a3.hash],
                    },
                },

                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2, a3],
                        initial: true,
                    },
                },
            ]);
        });

        it('should notify all other devices connected to the branch', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const removeAtoms = new Subject<AddAtomsEvent>();
            device.events.set(ADD_ATOMS, removeAtoms);

            const device2 = new MemoryConnection(device2Info);
            const joinBranch2 = new Subject<WatchBranchEvent>();
            device2.events.set(WATCH_BRANCH, joinBranch2);

            const device3 = new MemoryConnection(device3Info);
            const joinBranch3 = new Subject<WatchBranchEvent>();
            device3.events.set(WATCH_BRANCH, joinBranch3);

            connections.connection.next(device);
            connections.connection.next(device2);
            connections.connection.next(device3);

            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2, a3);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, 'testBranch', idx.data.hash, [
                a1,
                a2,
                a3,
                idx,
                c,
            ]);
            await updateBranch(store, b);

            joinBranch2.next({
                branch: 'testBranch',
            });
            joinBranch3.next({
                branch: 'testBranch',
            });

            await waitAsync();

            removeAtoms.next({
                branch: 'testBranch',
                removedAtoms: [a3.hash],
            });

            await waitAsync();

            expect(device2.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2, a3],
                        initial: true,
                    },
                },
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        removedAtoms: [a3.hash],
                    },
                },
            ]);

            expect(device3.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2, a3],
                        initial: true,
                    },
                },
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        removedAtoms: [a3.hash],
                    },
                },
            ]);
        });

        it('should not notify the device that removed the atoms', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const removeAtoms = new Subject<AddAtomsEvent>();
            const joinBranch = new Subject<WatchBranchEvent>();
            device.events.set(ADD_ATOMS, removeAtoms);
            device.events.set(WATCH_BRANCH, joinBranch);

            connections.connection.next(device);

            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2, a3);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, 'testBranch', idx.data.hash, [
                a1,
                a2,
                a3,
                idx,
                c,
            ]);
            await updateBranch(store, b);

            joinBranch.next({
                branch: 'testBranch',
            });

            await waitAsync();

            removeAtoms.next({
                branch: 'testBranch',
                removedAtoms: [a3.hash],
            });

            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2, a3],
                        initial: true,
                    },
                },

                // Server should send a atoms received event
                // back indicating which atoms it processed
                {
                    name: ATOMS_RECEIVED,
                    data: {
                        branch: 'testBranch',
                        hashes: [a3.hash],
                    },
                },
            ]);
        });

        it('should not send atoms that were already removed from the current commit', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const removeAtoms = new Subject<AddAtomsEvent>();
            device.events.set(ADD_ATOMS, removeAtoms);

            const device2 = new MemoryConnection(device2Info);
            const joinBranch2 = new Subject<WatchBranchEvent>();
            device2.events.set(WATCH_BRANCH, joinBranch2);

            const device3 = new MemoryConnection(device3Info);
            const joinBranch3 = new Subject<WatchBranchEvent>();
            device3.events.set(WATCH_BRANCH, joinBranch3);

            connections.connection.next(device);
            connections.connection.next(device2);
            connections.connection.next(device3);

            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, 'testBranch', idx.data.hash, [
                a1,
                a2,
                idx,
                c,
            ]);
            await updateBranch(store, b);

            joinBranch2.next({
                branch: 'testBranch',
            });
            joinBranch3.next({
                branch: 'testBranch',
            });

            await waitAsync();

            removeAtoms.next({
                branch: 'testBranch',
                removedAtoms: [a3.hash],
            });

            await waitAsync();

            expect(device2.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2],
                        initial: true,
                    },
                },
            ]);

            expect(device3.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2],
                        initial: true,
                    },
                },
            ]);

            expect(device.messages).toEqual([
                {
                    name: ATOMS_RECEIVED,
                    data: {
                        branch: 'testBranch',
                        hashes: [a3.hash],
                    },
                },
            ]);
        });

        it('should add the removed atoms to the stage store', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const addAtoms = new Subject<AddAtomsEvent>();
            device.events.set(ADD_ATOMS, addAtoms);

            const joinBranch = new Subject<WatchBranchEvent>();
            device.events.set(WATCH_BRANCH, joinBranch);

            connections.connection.next(device);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2, a3);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, 'testBranch', idx.data.hash, [
                a1,
                a2,
                a3,
                idx,
                c,
            ]);
            await updateBranch(store, b);

            addAtoms.next({
                branch: 'testBranch',
                removedAtoms: [a3.hash],
            });

            await waitAsync();

            const stage = await stageStore.getStage('testBranch');

            expect(stage).toEqual({
                additions: [],
                deletions: {
                    [a3.hash]: atomIdToString(a3.id),
                },
            });
        });

        it('should ignore when given an event with a null branch', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const addAtoms = new Subject<AddAtomsEvent>();
            device.events.set(ADD_ATOMS, addAtoms);

            const joinBranch = new Subject<WatchBranchEvent>();
            device.events.set(WATCH_BRANCH, joinBranch);

            connections.connection.next(device);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, 'testBranch', idx.data.hash, [
                a1,
                a2,
                idx,
                c,
            ]);
            await updateBranch(store, b);

            addAtoms.next({
                branch: null,
                atoms: [a3],
            });

            await waitAsync();

            const repoAtom = await store.getObject(a3.hash);
            expect(repoAtom).toBe(null);
        });

        it('should not crash if adding atoms to a branch that does not exist', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const addAtoms = new Subject<AddAtomsEvent>();
            device.events.set(ADD_ATOMS, addAtoms);

            connections.connection.next(device);

            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            addAtoms.next({
                branch: 'abc',
                atoms: [a1, a2, a3],
            });

            await waitAsync();

            const repoAtom = await store.getObject(a3.hash);
            expect(repoAtom).toBe(null);
        });

        describe('temp', () => {
            it('should not store the given atoms with the current branch', async () => {
                server.init();

                const device = new MemoryConnection(device1Info);
                const addAtoms = new Subject<AddAtomsEvent>();
                device.events.set(ADD_ATOMS, addAtoms);

                const joinBranch = new Subject<WatchBranchEvent>();
                device.events.set(WATCH_BRANCH, joinBranch);

                connections.connection.next(device);

                await waitAsync();

                joinBranch.next({
                    branch: '@testBranch',
                    temporary: true,
                });

                const a1 = atom(atomId('a', 1), null, {});
                const a2 = atom(atomId('a', 2), a1, {});
                const a3 = atom(atomId('a', 3), a2, {});

                const idx = index(a1, a2);
                const c = commit('message', new Date(2019, 9, 4), idx, null);
                const b = branch('@testBranch', c);

                await storeData(store, '@testBranch', idx.data.hash, [
                    a1,
                    a2,
                    idx,
                    c,
                ]);
                await updateBranch(store, b);

                addAtoms.next({
                    branch: '@testBranch',
                    atoms: [a3],
                });

                await waitAsync();

                const [repoAtom] = await store.getObjects('@testBranch', [
                    a3.hash,
                ]);
                expect(repoAtom).toBeFalsy();
            });

            it('should notify all other devices connected to the branch', async () => {
                server.init();

                const device = new MemoryConnection(device1Info);
                const addAtoms = new Subject<AddAtomsEvent>();
                device.events.set(ADD_ATOMS, addAtoms);

                const device2 = new MemoryConnection(device2Info);
                const joinBranch2 = new Subject<WatchBranchEvent>();
                device2.events.set(WATCH_BRANCH, joinBranch2);

                const device3 = new MemoryConnection(device3Info);
                const joinBranch3 = new Subject<WatchBranchEvent>();
                device3.events.set(WATCH_BRANCH, joinBranch3);

                connections.connection.next(device);
                connections.connection.next(device2);
                connections.connection.next(device3);

                await waitAsync();

                const a1 = atom(atomId('a', 1), null, {});

                joinBranch2.next({
                    branch: '@testBranch',
                    temporary: true,
                });
                joinBranch3.next({
                    branch: '@testBranch',
                    temporary: true,
                });

                await waitAsync();

                addAtoms.next({
                    branch: '@testBranch',
                    atoms: [a1],
                });

                await waitAsync();

                expect(device2.messages).toEqual([
                    {
                        name: ADD_ATOMS,
                        data: {
                            branch: '@testBranch',
                            atoms: [],
                            initial: true,
                        },
                    },
                    {
                        name: ADD_ATOMS,
                        data: {
                            branch: '@testBranch',
                            atoms: [a1],
                        },
                    },
                ]);

                expect(device3.messages).toEqual([
                    {
                        name: ADD_ATOMS,
                        data: {
                            branch: '@testBranch',
                            atoms: [],
                            initial: true,
                        },
                    },
                    {
                        name: ADD_ATOMS,
                        data: {
                            branch: '@testBranch',
                            atoms: [a1],
                        },
                    },
                ]);
            });
        });

        it('should prevent adding atoms to a branch that has a password', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const addAtoms = new Subject<AddAtomsEvent>();
            device.events.set(ADD_ATOMS, addAtoms);

            const joinBranch = new Subject<WatchBranchEvent>();
            device.events.set(WATCH_BRANCH, joinBranch);

            connections.connection.next(device);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);
            const hash1 = hashPassword('password');
            const settings = branchSettings('testBranch', hash1);
            await store.saveSettings(settings);

            await storeData(store, 'testBranch', idx.data.hash, [
                a1,
                a2,
                idx,
                c,
            ]);
            await updateBranch(store, b);

            addAtoms.next({
                branch: 'testBranch',
                atoms: [a3],
            });

            await waitAsync();

            const repoAtom = await store.getObject(a3.hash);
            expect(repoAtom).toBe(null);

            expect(device.messages).toEqual([
                // Server should send a atoms received event
                // back indicating which atoms it processed
                // in this case, no atoms were accepted
                {
                    name: ATOMS_RECEIVED,
                    data: {
                        branch: 'testBranch',
                        hashes: [],
                    },
                },
            ]);
        });

        it('should allow adding atoms to a branch that has a password when authenticated', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const addAtoms = new Subject<AddAtomsEvent>();
            const authenticate = new Subject<AuthenticateBranchWritesEvent>();
            device.events.set(ADD_ATOMS, addAtoms);
            device.events.set(AUTHENTICATE_BRANCH_WRITES, authenticate);

            const joinBranch = new Subject<WatchBranchEvent>();
            device.events.set(WATCH_BRANCH, joinBranch);

            connections.connection.next(device);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);
            const hash1 = hashPassword('password');
            const settings = branchSettings('testBranch', hash1);
            await store.saveSettings(settings);

            await storeData(store, 'testBranch', idx.data.hash, [
                a1,
                a2,
                idx,
                c,
            ]);
            await updateBranch(store, b);

            joinBranch.next({
                branch: 'testBranch',
            });

            await waitAsync();

            authenticate.next({
                branch: 'testBranch',
                password: 'password',
            });

            await waitAsync();

            addAtoms.next({
                branch: 'testBranch',
                atoms: [a3],
            });

            await waitAsync();

            const repoAtom = await store.getObject(a3.hash);
            expect(repoAtom).toEqual({
                type: 'atom',
                data: a3,
            });

            expect(device.messages.slice(2)).toEqual([
                // Server should send a atoms received event
                // back indicating which atoms it processed
                // in this case, no atoms were accepted
                {
                    name: ATOMS_RECEIVED,
                    data: {
                        branch: 'testBranch',
                        hashes: [a3.hash],
                    },
                },
            ]);
        });

        it('should remember that the device is authenticated if the device authenticates without watching', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const addAtoms = new Subject<AddAtomsEvent>();
            const authenticate = new Subject<AuthenticateBranchWritesEvent>();
            device.events.set(ADD_ATOMS, addAtoms);
            device.events.set(AUTHENTICATE_BRANCH_WRITES, authenticate);

            const joinBranch = new Subject<WatchBranchEvent>();
            device.events.set(WATCH_BRANCH, joinBranch);

            connections.connection.next(device);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);
            const hash1 = hashPassword('password');
            const settings = branchSettings('testBranch', hash1);
            await store.saveSettings(settings);

            await storeData(store, 'testBranch', idx.data.hash, [
                a1,
                a2,
                idx,
                c,
            ]);
            await updateBranch(store, b);

            authenticate.next({
                branch: 'testBranch',
                password: 'password',
            });

            await waitAsync();

            addAtoms.next({
                branch: 'testBranch',
                atoms: [a3],
            });

            await waitAsync();

            const repoAtom = await store.getObject(a3.hash);
            expect(repoAtom).toEqual({
                type: 'atom',
                data: a3,
            });

            expect(device.messages).toEqual([
                {
                    name: AUTHENTICATED_TO_BRANCH,
                    data: {
                        branch: 'testBranch',
                        authenticated: true,
                    },
                },
                // Server should send a atoms received event
                // back indicating which atoms it processed
                // in this case, no atoms were accepted
                {
                    name: ATOMS_RECEIVED,
                    data: {
                        branch: 'testBranch',
                        hashes: [a3.hash],
                    },
                },
            ]);
        });
    });

    describe(ADD_UPDATES, () => {
        it('should add the given atoms to the given branch', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const addUpdates = new Subject<AddUpdatesEvent>();
            device.events.set(ADD_UPDATES, addUpdates);

            const joinBranch = new Subject<WatchBranchEvent>();
            device.events.set(WATCH_BRANCH, joinBranch);

            connections.connection.next(device);

            await updateStore.addUpdates('testBranch', ['111', '222']);

            addUpdates.next({
                branch: 'testBranch',
                updates: ['abc'],
                updateId: 1,
            });

            await waitAsync();

            joinBranch.next({
                branch: 'testBranch',
                protocol: 'updates',
            });

            await waitAsync();

            expect(device.messages).toEqual([
                // Server should send a updates received event
                // back indicating which updates it processed
                {
                    name: UPDATES_RECEIVED,
                    data: {
                        branch: 'testBranch',
                        updateId: 1,
                    },
                },

                {
                    name: ADD_UPDATES,
                    data: {
                        branch: 'testBranch',
                        updates: ['111', '222', 'abc'],
                        initial: true,
                    },
                },
            ]);
        });

        it('should notify all other devices connected to the branch', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const addUpdates = new Subject<AddUpdatesEvent>();
            device.events.set(ADD_UPDATES, addUpdates);

            const device2 = new MemoryConnection(device2Info);
            const joinBranch2 = new Subject<WatchBranchEvent>();
            device2.events.set(WATCH_BRANCH, joinBranch2);

            const device3 = new MemoryConnection(device3Info);
            const joinBranch3 = new Subject<WatchBranchEvent>();
            device3.events.set(WATCH_BRANCH, joinBranch3);

            connections.connection.next(device);
            connections.connection.next(device2);
            connections.connection.next(device3);

            await waitAsync();

            await updateStore.addUpdates('testBranch', ['111', '222']);

            joinBranch2.next({
                branch: 'testBranch',
                protocol: 'updates',
            });
            joinBranch3.next({
                branch: 'testBranch',
                protocol: 'updates',
            });

            await waitAsync();

            addUpdates.next({
                branch: 'testBranch',
                updates: ['abc'],
                updateId: 1,
            });

            await waitAsync();

            expect(device2.messages).toEqual([
                {
                    name: ADD_UPDATES,
                    data: {
                        branch: 'testBranch',
                        updates: ['111', '222'],
                        initial: true,
                    },
                },
                {
                    name: ADD_UPDATES,
                    data: {
                        branch: 'testBranch',
                        updates: ['abc'],
                    },
                },
            ]);

            expect(device3.messages).toEqual([
                {
                    name: ADD_UPDATES,
                    data: {
                        branch: 'testBranch',
                        updates: ['111', '222'],
                        initial: true,
                    },
                },
                {
                    name: ADD_UPDATES,
                    data: {
                        branch: 'testBranch',
                        updates: ['abc'],
                    },
                },
            ]);
        });

        it('should add the given atoms to the given branch', async () => {
            updateStore.maxAllowedInstSize = 5;

            server.init();

            const device = new MemoryConnection(device1Info);
            const addUpdates = new Subject<AddUpdatesEvent>();
            device.events.set(ADD_UPDATES, addUpdates);

            const device2 = new MemoryConnection(device2Info);
            const joinBranch = new Subject<WatchBranchEvent>();
            device2.events.set(WATCH_BRANCH, joinBranch);

            connections.connection.next(device);
            connections.connection.next(device2);

            await waitAsync();

            joinBranch.next({
                branch: 'testBranch',
                protocol: 'updates',
            });

            await waitAsync();

            expect(device2.messages).toEqual([
                {
                    name: ADD_UPDATES,
                    data: {
                        branch: 'testBranch',
                        updates: [],
                        initial: true,
                    },
                },
            ]);

            addUpdates.next({
                branch: 'testBranch',
                updates: ['111', '222'],
                updateId: 1,
            });

            await waitAsync();

            const updates = await updateStore.getUpdates('testBranch');

            expect(updates).toEqual({
                updates: [],
                timestamps: [],
            });

            expect(device.messages).toEqual([
                // Server should send a updates received event
                // back indicating which updates it processed
                {
                    name: UPDATES_RECEIVED,
                    data: {
                        branch: 'testBranch',
                        updateId: 1,
                        errorCode: 'max_size_reached',
                        maxBranchSizeInBytes: 5,
                        neededBranchSizeInBytes: 6,
                    },
                },
            ]);

            expect(device2.messages).toEqual([
                {
                    name: ADD_UPDATES,
                    data: {
                        branch: 'testBranch',
                        updates: [],
                        initial: true,
                    },
                },
            ]);
        });

        describe('temp', () => {
            it('should not store the given atoms with the current branch', async () => {
                server.init();

                const device = new MemoryConnection(device1Info);
                const addUpdates = new Subject<AddUpdatesEvent>();
                device.events.set(ADD_UPDATES, addUpdates);

                const joinBranch = new Subject<WatchBranchEvent>();
                device.events.set(WATCH_BRANCH, joinBranch);

                connections.connection.next(device);

                await waitAsync();

                joinBranch.next({
                    branch: '@testBranch',
                    temporary: true,
                    protocol: 'updates',
                });

                await waitAsync();

                addUpdates.next({
                    branch: '@testBranch',
                    updates: ['abc'],
                });

                await waitAsync();

                const updates = await updateStore.getUpdates('@testBranch');
                expect(updates).toEqual({
                    updates: [],
                    timestamps: [],
                });
            });

            it('should notify all other devices connected to the branch', async () => {
                server.init();

                const device = new MemoryConnection(device1Info);
                const addUpdates = new Subject<AddUpdatesEvent>();
                device.events.set(ADD_UPDATES, addUpdates);

                const device2 = new MemoryConnection(device2Info);
                const joinBranch2 = new Subject<WatchBranchEvent>();
                device2.events.set(WATCH_BRANCH, joinBranch2);

                const device3 = new MemoryConnection(device3Info);
                const joinBranch3 = new Subject<WatchBranchEvent>();
                device3.events.set(WATCH_BRANCH, joinBranch3);

                connections.connection.next(device);
                connections.connection.next(device2);
                connections.connection.next(device3);

                await waitAsync();

                joinBranch2.next({
                    branch: '@testBranch',
                    temporary: true,
                    protocol: 'updates',
                });
                joinBranch3.next({
                    branch: '@testBranch',
                    temporary: true,
                    protocol: 'updates',
                });

                await waitAsync();

                addUpdates.next({
                    branch: '@testBranch',
                    updates: ['abc'],
                });

                await waitAsync();

                expect(device2.messages).toEqual([
                    {
                        name: ADD_UPDATES,
                        data: {
                            branch: '@testBranch',
                            updates: [],
                            initial: true,
                        },
                    },
                    {
                        name: ADD_UPDATES,
                        data: {
                            branch: '@testBranch',
                            updates: ['abc'],
                        },
                    },
                ]);

                expect(device3.messages).toEqual([
                    {
                        name: ADD_UPDATES,
                        data: {
                            branch: '@testBranch',
                            updates: [],
                            initial: true,
                        },
                    },
                    {
                        name: ADD_UPDATES,
                        data: {
                            branch: '@testBranch',
                            updates: ['abc'],
                        },
                    },
                ]);
            });
        });
    });

    describe(COMMIT, () => {
        it('should commit the current changes to the branch', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const addAtoms = new Subject<AddAtomsEvent>();
            const makeCommit = new Subject<CommitEvent>();
            device.events.set(ADD_ATOMS, addAtoms);
            device.events.set(COMMIT, makeCommit);

            connections.connection.next(device);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, 'testBranch', idx.data.hash, [
                a1,
                a2,
                idx,
                c,
            ]);
            await updateBranch(store, b);

            addAtoms.next({
                branch: 'testBranch',
                atoms: [a3],
            });

            await waitAsync();

            makeCommit.next({
                branch: 'testBranch',
                message: 'newCommit',
            });

            await waitAsync();

            const [testBranch] = await store.getBranches('testBranch');
            const data = await loadBranch(store, testBranch);

            expect(data.commit.message).toBe('newCommit');
            expect(data.commit.previousCommit).toBe(c.hash);
            expect(data.atoms).toEqual(
                new Map([
                    [a1.hash, a1],
                    [a2.hash, a2],
                    [a3.hash, a3],
                ])
            );
        });

        it('should send the new commit to all devices watching for commits', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const addAtoms = new Subject<AddAtomsEvent>();
            const makeCommit = new Subject<CommitEvent>();
            const watchCommits = new Subject<string>();
            device.events.set(ADD_ATOMS, addAtoms);
            device.events.set(COMMIT, makeCommit);
            device.events.set(WATCH_COMMITS, watchCommits);

            connections.connection.next(device);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, 'testBranch', idx.data.hash, [
                a1,
                a2,
                idx,
                c,
            ]);
            await updateBranch(store, b);

            addAtoms.next({
                branch: 'testBranch',
                atoms: [a3],
            });

            await waitAsync();

            watchCommits.next('testBranch');

            await waitAsync();

            makeCommit.next({
                branch: 'testBranch',
                message: 'newCommit',
            });

            await waitAsync();

            const [testBranch] = await store.getBranches('testBranch');
            const newCommit = await store.getObject(testBranch.hash);

            expect(device.messages).toEqual([
                // Server should send a atoms received event
                // back indicating which atoms it processed
                {
                    name: ATOMS_RECEIVED,
                    data: {
                        branch: 'testBranch',
                        hashes: [a3.hash],
                    },
                },
                {
                    name: ADD_COMMITS,
                    data: {
                        branch: 'testBranch',
                        commits: [c],
                    },
                },
                {
                    name: ADD_COMMITS,
                    data: {
                        branch: 'testBranch',
                        commits: [newCommit],
                    },
                },
                {
                    name: COMMIT_CREATED,
                    data: {
                        branch: 'testBranch',
                    },
                },
            ]);
        });

        it('should finish the commit operation before allowing new atoms', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const addAtoms = new Subject<AddAtomsEvent>();
            const makeCommit = new Subject<CommitEvent>();
            const joinBranch = new Subject<WatchBranchEvent>();
            device.events.set(ADD_ATOMS, addAtoms);
            device.events.set(WATCH_BRANCH, joinBranch);
            device.events.set(COMMIT, makeCommit);

            connections.connection.next(device);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});
            const a4 = atom(atomId('a', 4), a2, {});
            const a5 = atom(atomId('a', 5), a2, {});
            const a6 = atom(atomId('a', 6), a2, {});
            // const a7 = atom(atomId('a', 7), a2, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, 'testBranch', idx.data.hash, [
                a1,
                a2,
                idx,
                c,
            ]);
            await updateBranch(store, b);

            addAtoms.next({
                branch: 'testBranch',
                atoms: [a3],
            });

            await waitAsync();

            makeCommit.next({
                branch: 'testBranch',
                message: 'newCommit',
            });

            addAtoms.next({
                branch: 'testBranch',
                atoms: [a4, a5, a6],
            });

            await waitAsync();

            const [testBranch] = await store.getBranches('testBranch');
            const data = await loadBranch(store, testBranch);

            expect(data.commit.message).toBe('newCommit');
            expect(data.commit.previousCommit).toBe(c.hash);
            expect(data.atoms).toEqual(
                new Map([
                    [a1.hash, a1],
                    [a2.hash, a2],
                    [a3.hash, a3],
                ])
            );

            joinBranch.next({
                branch: 'testBranch',
            });

            await waitAsync();

            // Should have the newly added atoms in the stage
            expect(device.messages.slice(3)).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2, a3, a4, a5, a6],
                        initial: true,
                    },
                },
            ]);
        });

        it('should send a commit created event to the device that requested the commit', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const addAtoms = new Subject<AddAtomsEvent>();
            const makeCommit = new Subject<CommitEvent>();
            device.events.set(ADD_ATOMS, addAtoms);
            device.events.set(COMMIT, makeCommit);

            connections.connection.next(device);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, 'testBranch', idx.data.hash, [
                a1,
                a2,
                idx,
                c,
            ]);
            await updateBranch(store, b);

            addAtoms.next({
                branch: 'testBranch',
                atoms: [a3],
            });

            await waitAsync();

            makeCommit.next({
                branch: 'testBranch',
                message: 'newCommit',
            });

            await waitAsync();

            expect(device.messages).toEqual([
                // Server should send a atoms received event
                // back indicating which atoms it processed
                {
                    name: ATOMS_RECEIVED,
                    data: {
                        branch: 'testBranch',
                        hashes: [a3.hash],
                    },
                },
                {
                    name: COMMIT_CREATED,
                    data: {
                        branch: 'testBranch',
                    },
                },
            ]);
        });
    });

    describe(WATCH_COMMITS, () => {
        it('should send the commits for the branch when first connected', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const watchCommits = new Subject<string>();
            device.events.set(WATCH_COMMITS, watchCommits);

            connections.connection.next(device);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx1 = index(a1, a2);
            const idx2 = index(a1, a2, a3);
            const c1 = commit('message', new Date(2019, 9, 4), idx1, null);
            const c2 = commit('message2', new Date(2019, 9, 4), idx2, c1);
            const b = branch('testBranch', c2);

            await storeData(store, 'testBranch', idx1.data.hash, [
                a1,
                a2,
                idx1,
            ]);
            await storeData(store, 'testBranch', idx2.data.hash, [
                a1,
                a2,
                a3,
                idx2,
            ]);
            await storeData(store, 'testBranch', null, [c1, c2]);
            await updateBranch(store, b);

            watchCommits.next('testBranch');

            await waitAsync();

            expect(device.messages).toEqual([
                // Server should send all the existing commits
                {
                    name: ADD_COMMITS,
                    data: {
                        branch: 'testBranch',
                        commits: [c2, c1],
                    },
                },
            ]);
        });
    });

    describe(CHECKOUT, () => {
        it('should reset the given branch to the given commit', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const checkout = new Subject<CheckoutEvent>();
            device.events.set(CHECKOUT, checkout);

            connections.connection.next(device);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx1 = index(a1, a2);
            const idx2 = index(a1, a2, a3);
            const c1 = commit('message', new Date(2019, 9, 4), idx1, null);
            const c2 = commit('message2', new Date(2019, 9, 4), idx2, c1);
            const b = branch('testBranch', c2);

            await storeData(store, 'testBranch', idx1.data.hash, [
                a1,
                a2,
                idx1,
            ]);
            await storeData(store, 'testBranch', idx2.data.hash, [
                a1,
                a2,
                a3,
                idx2,
            ]);
            await storeData(store, 'testBranch', null, [c1, c2]);
            await updateBranch(store, b);

            checkout.next({
                branch: 'testBranch',
                commit: c1.hash,
            });

            await waitAsync();

            const [testBranch] = await store.getBranches('testBranch');
            const branchCommit = await store.getObject(testBranch.hash);

            expect(branchCommit).toEqual(c1);
        });

        it(`should send a RESET event with the new state`, async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const checkout = new Subject<CheckoutEvent>();
            const watchBranch = new Subject<WatchBranchEvent>();
            device.events.set(CHECKOUT, checkout);
            device.events.set(WATCH_BRANCH, watchBranch);

            connections.connection.next(device);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});
            const a4 = atom(atomId('a', 4), a2, {});
            const a5 = atom(atomId('a', 5), a2, {});

            const idx1 = index(a1, a2, a3);
            const idx2 = index(a1, a2, a4, a5);
            const c1 = commit('message', new Date(2019, 9, 4), idx1, null);
            const c2 = commit('message2', new Date(2019, 9, 4), idx2, c1);
            const b = branch('testBranch', c2);

            await storeData(store, 'testBranch', idx1.data.hash, [
                a1,
                a2,
                a3,
                idx1,
            ]);
            await storeData(store, 'testBranch', idx2.data.hash, [
                a1,
                a2,
                a4,
                a5,
                idx2,
            ]);
            await storeData(store, 'testBranch', null, [c1, c2]);
            await updateBranch(store, b);

            watchBranch.next({
                branch: 'testBranch',
            });

            await waitAsync();

            checkout.next({
                branch: 'testBranch',
                commit: c1.hash,
            });

            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2, a4, a5],
                        initial: true,
                    },
                },
                {
                    name: RESET,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2, a3],
                    },
                },
            ]);
        });

        it(`should handle resetting atoms with cardinality constraints`, async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const checkout = new Subject<CheckoutEvent>();
            const addAtoms = new Subject<AddAtomsEvent>();
            const watchBranch = new Subject<WatchBranchEvent>();
            device.events.set(CHECKOUT, checkout);
            device.events.set(WATCH_BRANCH, watchBranch);
            device.events.set(ADD_ATOMS, addAtoms);

            connections.connection.next(device);

            const a1 = atom(
                atomId('a', 1, undefined, { group: 'abc', number: 2 }),
                null,
                {}
            );
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(
                atomId('a', 3, undefined, { group: 'abc', number: 2 }),
                null,
                {}
            );

            const b1 = atom(
                atomId('b', 1, undefined, { group: 'abc', number: 1 }),
                null,
                {}
            );
            const b2 = atom(atomId('b', 2), b1, {});

            const idx1 = index(a1, a2);
            const idx2 = index(b1, b2);
            const c1 = commit('message', new Date(2019, 9, 4), idx1, null);
            const c2 = commit('message2', new Date(2019, 9, 4), idx2, c1);
            const b = branch('testBranch', c2);

            await storeData(store, 'testBranch', idx1.data.hash, [
                a1,
                a2,
                idx1,
            ]);
            await storeData(store, 'testBranch', idx2.data.hash, [
                b1,
                b2,
                idx2,
            ]);
            await storeData(store, 'testBranch', null, [c1, c2]);
            await updateBranch(store, b);

            checkout.next({
                branch: 'testBranch',
                commit: c1.hash,
            });

            await waitAsync();

            addAtoms.next({
                branch: 'testBranch',
                atoms: [a3],
            });

            await waitAsync();

            watchBranch.next({
                branch: 'testBranch',
            });

            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: ATOMS_RECEIVED,
                    data: {
                        branch: 'testBranch',
                        hashes: [a3.hash],
                    },
                },
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2, a3],
                        initial: true,
                    },
                },
            ]);
        });
    });

    describe(RESTORE, () => {
        it('should create a commit referencing the restored commits index', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const restore = new Subject<RestoreEvent>();
            const watchBranch = new Subject<WatchBranchEvent>();
            device.events.set(RESTORE, restore);
            device.events.set(WATCH_BRANCH, watchBranch);

            connections.connection.next(device);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});
            const a4 = atom(atomId('a', 4), a2, {});
            const a5 = atom(atomId('a', 5), a2, {});

            const idx1 = index(a1, a2, a3);
            const idx2 = index(a1, a2, a4, a5);
            const c1 = commit('message', new Date(2019, 9, 4), idx1, null);
            const c2 = commit('message2', new Date(2019, 9, 4), idx2, c1);
            const b = branch('testBranch', c2);

            await storeData(store, 'testBranch', idx1.data.hash, [
                a1,
                a2,
                a3,
                idx1,
            ]);
            await storeData(store, 'testBranch', idx2.data.hash, [
                a1,
                a2,
                a3,
                a4,
                a5,
                idx2,
            ]);
            await storeData(store, 'testBranch', null, [c1, c2]);
            await updateBranch(store, b);

            watchBranch.next({
                branch: 'testBranch',
            });

            await waitAsync();

            restore.next({
                branch: 'testBranch',
                commit: c1.hash,
            });

            await waitAsync();

            const [testBranch] = await store.getBranches('testBranch');
            const branchCommit = await store.getObject(testBranch.hash);

            expect(branchCommit).toEqual({
                type: 'commit',
                message: `Restore to ${c1.hash}`,
                time: expect.any(Date),
                hash: expect.any(String),
                index: c1.index,
                previousCommit: c2.hash,
            });
        });

        it('should commit uncommitted changes', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const restore = new Subject<RestoreEvent>();
            const addAtoms = new Subject<AddAtomsEvent>();
            const watchBranch = new Subject<WatchBranchEvent>();
            device.events.set(RESTORE, restore);
            device.events.set(ADD_ATOMS, addAtoms);
            device.events.set(WATCH_BRANCH, watchBranch);

            connections.connection.next(device);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});
            const a4 = atom(atomId('a', 4), a2, {});
            const a5 = atom(atomId('a', 5), a2, {});
            const a6 = atom(atomId('a', 6), a2, {});

            const idx1 = index(a1, a2, a3);
            const idx2 = index(a1, a2, a4, a5);
            const c1 = commit('message', new Date(2019, 9, 4), idx1, null);
            const c2 = commit('message2', new Date(2019, 9, 4), idx2, c1);
            const b = branch('testBranch', c2);

            await storeData(store, 'testBranch', idx1.data.hash, [
                a1,
                a2,
                a3,
                idx1,
            ]);
            await storeData(store, 'testBranch', idx2.data.hash, [
                a1,
                a2,
                a4,
                a5,
                idx2,
            ]);
            await storeData(store, 'testBranch', null, [c1, c2]);
            await updateBranch(store, b);

            watchBranch.next({
                branch: 'testBranch',
            });

            await waitAsync();

            addAtoms.next({
                branch: 'testBranch',
                atoms: [a6],
            });

            await waitAsync();

            restore.next({
                branch: 'testBranch',
                commit: c1.hash,
            });

            await waitAsync();

            const [testBranch] = await store.getBranches('testBranch');
            const branchCommit = (await store.getObject(
                testBranch.hash
            )) as CausalRepoCommit;
            const changesCommit = (await store.getObject(
                branchCommit.previousCommit
            )) as CausalRepoCommit;
            const data = await loadCommit(store, 'testBranch', changesCommit);

            expect(branchCommit).toEqual({
                type: 'commit',
                message: `Restore to ${c1.hash}`,
                time: expect.any(Date),
                hash: expect.any(String),
                index: c1.index,
                previousCommit: changesCommit.hash,
            });

            expect(changesCommit).toEqual({
                type: 'commit',
                message: `Save testBranch before restore`,
                time: expect.any(Date),
                hash: expect.any(String),
                index: expect.any(String),
                previousCommit: c2.hash,
            });
            expect(data.atoms).toEqual(
                new Map([
                    [a1.hash, a1],
                    [a2.hash, a2],
                    [a4.hash, a4],
                    [a5.hash, a5],
                    [a6.hash, a6],
                ])
            );
        });

        it(`should send a RESET event with the new state`, async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const restore = new Subject<RestoreEvent>();
            const watchBranch = new Subject<WatchBranchEvent>();
            device.events.set(RESTORE, restore);
            device.events.set(WATCH_BRANCH, watchBranch);

            connections.connection.next(device);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});
            const a4 = atom(atomId('a', 4), a2, {});
            const a5 = atom(atomId('a', 5), a2, {});

            const idx1 = index(a1, a2, a3);
            const idx2 = index(a1, a2, a4, a5);
            const c1 = commit('message', new Date(2019, 9, 4), idx1, null);
            const c2 = commit('message2', new Date(2019, 9, 4), idx2, c1);
            const b = branch('testBranch', c2);

            await storeData(store, 'testBranch', idx1.data.hash, [
                a1,
                a2,
                a3,
                idx1,
            ]);
            await storeData(store, 'testBranch', idx2.data.hash, [
                a1,
                a2,
                a4,
                a5,
                idx2,
            ]);
            await storeData(store, 'testBranch', null, [c1, c2]);
            await updateBranch(store, b);

            watchBranch.next({
                branch: 'testBranch',
            });

            await waitAsync();

            restore.next({
                branch: 'testBranch',
                commit: c1.hash,
            });

            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2, a4, a5],
                        initial: true,
                    },
                },
                {
                    name: RESET,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2, a3],
                    },
                },
                {
                    name: RESTORED,
                    data: {
                        branch: 'testBranch',
                    },
                },
            ]);
        });

        it(`should handle resetting atoms with cardinality constraints`, async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const restore = new Subject<RestoreEvent>();
            const watchBranch = new Subject<WatchBranchEvent>();
            const addAtoms = new Subject<AddAtomsEvent>();
            device.events.set(RESTORE, restore);
            device.events.set(WATCH_BRANCH, watchBranch);
            device.events.set(ADD_ATOMS, addAtoms);

            connections.connection.next(device);

            const a1 = atom(
                atomId('a', 1, undefined, { group: 'abc', number: 2 }),
                null,
                {}
            );
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(
                atomId('a', 3, undefined, { group: 'abc', number: 2 }),
                null,
                {}
            );

            const b1 = atom(
                atomId('b', 1, undefined, { group: 'abc', number: 1 }),
                null,
                {}
            );
            const b2 = atom(atomId('b', 2), b1, {});

            const idx1 = index(a1, a2);
            const idx2 = index(b1, b2);
            const c1 = commit('message', new Date(2019, 9, 4), idx1, null);
            const c2 = commit('message2', new Date(2019, 9, 4), idx2, c1);
            const b = branch('testBranch', c2);

            await storeData(store, 'testBranch', idx1.data.hash, [
                a1,
                a2,
                idx1,
            ]);
            await storeData(store, 'testBranch', idx2.data.hash, [
                b1,
                b2,
                idx2,
            ]);
            await storeData(store, 'testBranch', null, [c1, c2]);
            await updateBranch(store, b);

            restore.next({
                branch: 'testBranch',
                commit: c1.hash,
            });

            await waitAsync();

            addAtoms.next({
                branch: 'testBranch',
                atoms: [a3],
            });

            await waitAsync();

            watchBranch.next({
                branch: 'testBranch',
            });

            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: RESTORED,
                    data: {
                        branch: 'testBranch',
                    },
                },
                {
                    name: ATOMS_RECEIVED,
                    data: {
                        branch: 'testBranch',
                        hashes: [a3.hash],
                    },
                },
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2, a3],
                        initial: true,
                    },
                },
            ]);
        });
    });

    describe(SEND_EVENT, () => {
        it('should notify the device that the event was sent to', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const sendEvent = new Subject<SendRemoteActionEvent>();
            device.events.set(SEND_EVENT, sendEvent);

            const device2 = new MemoryConnection(device2Info);
            const joinBranch2 = new Subject<WatchBranchEvent>();
            device2.events.set(WATCH_BRANCH, joinBranch2);

            const device3 = new MemoryConnection(device3Info);
            const joinBranch3 = new Subject<WatchBranchEvent>();
            device3.events.set(WATCH_BRANCH, joinBranch3);

            connections.connection.next(device);
            connections.connection.next(device2);
            connections.connection.next(device3);

            await waitAsync();

            joinBranch2.next({
                branch: 'testBranch',
            });
            joinBranch3.next({
                branch: 'testBranch',
            });

            await waitAsync();

            sendEvent.next({
                branch: 'testBranch',
                action: remote(
                    {
                        type: 'abc',
                    },
                    {
                        sessionId: device3Info.claims[SESSION_ID_CLAIM],
                    }
                ),
            });

            await waitAsync();

            expect(device2.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [],
                        initial: true,
                    },
                },
            ]);
            expect(device3.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [],
                        initial: true,
                    },
                },
                {
                    name: RECEIVE_EVENT,
                    data: {
                        branch: 'testBranch',
                        action: deviceEvent(device1Info, {
                            type: 'abc',
                        }),
                    },
                },
            ]);
        });

        it('should send remote events to the default selector if none is specified', async () => {
            server.defaultDeviceSelector = {
                sessionId: device2Info.claims[SESSION_ID_CLAIM],
            };
            server.init();

            const device = new MemoryConnection(device1Info);
            const sendEvent = new Subject<SendRemoteActionEvent>();
            device.events.set(SEND_EVENT, sendEvent);

            const device2 = new MemoryConnection(device2Info);
            const joinBranch2 = new Subject<WatchBranchEvent>();
            device2.events.set(WATCH_BRANCH, joinBranch2);

            const device3 = new MemoryConnection(device3Info);
            const joinBranch3 = new Subject<WatchBranchEvent>();
            device3.events.set(WATCH_BRANCH, joinBranch3);

            connections.connection.next(device);
            connections.connection.next(device2);
            connections.connection.next(device3);

            await waitAsync();

            joinBranch2.next({
                branch: 'testBranch',
            });
            joinBranch3.next({
                branch: 'testBranch',
            });

            await waitAsync();

            sendEvent.next({
                branch: 'testBranch',
                action: remote({
                    type: 'abc',
                }),
            });

            await waitAsync();

            expect(device2.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [],
                        initial: true,
                    },
                },
                {
                    name: RECEIVE_EVENT,
                    data: {
                        branch: 'testBranch',
                        action: deviceEvent(device1Info, {
                            type: 'abc',
                        }),
                    },
                },
            ]);
            expect(device3.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [],
                        initial: true,
                    },
                },
            ]);
        });

        it('should broadcast to all devices if broadcast is true', async () => {
            server.defaultDeviceSelector = {
                sessionId: device2Info.claims[SESSION_ID_CLAIM],
            };
            server.init();

            const device = new MemoryConnection(device1Info);
            const sendEvent = new Subject<SendRemoteActionEvent>();
            device.events.set(SEND_EVENT, sendEvent);

            const device2 = new MemoryConnection(device2Info);
            const joinBranch2 = new Subject<WatchBranchEvent>();
            device2.events.set(WATCH_BRANCH, joinBranch2);

            const device3 = new MemoryConnection(device3Info);
            const joinBranch3 = new Subject<WatchBranchEvent>();
            device3.events.set(WATCH_BRANCH, joinBranch3);

            connections.connection.next(device);
            connections.connection.next(device2);
            connections.connection.next(device3);

            await waitAsync();

            joinBranch2.next({
                branch: 'testBranch',
            });
            joinBranch3.next({
                branch: 'testBranch',
            });

            await waitAsync();

            sendEvent.next({
                branch: 'testBranch',
                action: remote(
                    {
                        type: 'abc',
                    },
                    {
                        broadcast: true,
                    }
                ),
            });

            await waitAsync();

            expect(device2.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [],
                        initial: true,
                    },
                },
                {
                    name: RECEIVE_EVENT,
                    data: {
                        branch: 'testBranch',
                        action: deviceEvent(device1Info, {
                            type: 'abc',
                        }),
                    },
                },
            ]);
            expect(device3.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [],
                        initial: true,
                    },
                },
                {
                    name: RECEIVE_EVENT,
                    data: {
                        branch: 'testBranch',
                        action: deviceEvent(device1Info, {
                            type: 'abc',
                        }),
                    },
                },
            ]);
        });

        it('should relay the task ID from the remote action to the device action', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const sendEvent = new Subject<SendRemoteActionEvent>();
            device.events.set(SEND_EVENT, sendEvent);

            const device2 = new MemoryConnection(device2Info);
            const joinBranch2 = new Subject<WatchBranchEvent>();
            device2.events.set(WATCH_BRANCH, joinBranch2);

            const device3 = new MemoryConnection(device3Info);
            const joinBranch3 = new Subject<WatchBranchEvent>();
            device3.events.set(WATCH_BRANCH, joinBranch3);

            connections.connection.next(device);
            connections.connection.next(device2);
            connections.connection.next(device3);

            await waitAsync();

            joinBranch2.next({
                branch: 'testBranch',
            });
            joinBranch3.next({
                branch: 'testBranch',
            });

            await waitAsync();

            sendEvent.next({
                branch: 'testBranch',
                action: remote(
                    {
                        type: 'abc',
                    },
                    {
                        sessionId: device3Info.claims[SESSION_ID_CLAIM],
                    },
                    undefined,
                    'task1'
                ),
            });

            await waitAsync();

            expect(device2.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [],
                        initial: true,
                    },
                },
            ]);
            expect(device3.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [],
                        initial: true,
                    },
                },
                {
                    name: RECEIVE_EVENT,
                    data: {
                        branch: 'testBranch',
                        action: deviceEvent(
                            device1Info,
                            {
                                type: 'abc',
                            },
                            'task1'
                        ),
                    },
                },
            ]);
        });

        it('should convert a remote action result to a device action result', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const sendEvent = new Subject<SendRemoteActionEvent>();
            device.events.set(SEND_EVENT, sendEvent);

            const device2 = new MemoryConnection(device2Info);
            const joinBranch2 = new Subject<WatchBranchEvent>();
            device2.events.set(WATCH_BRANCH, joinBranch2);

            const device3 = new MemoryConnection(device3Info);
            const joinBranch3 = new Subject<WatchBranchEvent>();
            device3.events.set(WATCH_BRANCH, joinBranch3);

            connections.connection.next(device);
            connections.connection.next(device2);
            connections.connection.next(device3);

            await waitAsync();

            joinBranch2.next({
                branch: 'testBranch',
            });
            joinBranch3.next({
                branch: 'testBranch',
            });

            await waitAsync();

            sendEvent.next({
                branch: 'testBranch',
                action: remoteResult(
                    'data',
                    {
                        sessionId: device3Info.claims[SESSION_ID_CLAIM],
                    },
                    'task1'
                ),
            });

            await waitAsync();

            expect(device2.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [],
                        initial: true,
                    },
                },
            ]);
            expect(device3.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [],
                        initial: true,
                    },
                },
                {
                    name: RECEIVE_EVENT,
                    data: {
                        branch: 'testBranch',
                        action: deviceResult(device1Info, 'data', 'task1'),
                    },
                },
            ]);
        });

        it('should convert a remote action error to a device action error', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const sendEvent = new Subject<SendRemoteActionEvent>();
            device.events.set(SEND_EVENT, sendEvent);

            const device2 = new MemoryConnection(device2Info);
            const joinBranch2 = new Subject<WatchBranchEvent>();
            device2.events.set(WATCH_BRANCH, joinBranch2);

            const device3 = new MemoryConnection(device3Info);
            const joinBranch3 = new Subject<WatchBranchEvent>();
            device3.events.set(WATCH_BRANCH, joinBranch3);

            connections.connection.next(device);
            connections.connection.next(device2);
            connections.connection.next(device3);

            await waitAsync();

            joinBranch2.next({
                branch: 'testBranch',
            });
            joinBranch3.next({
                branch: 'testBranch',
            });

            await waitAsync();

            sendEvent.next({
                branch: 'testBranch',
                action: remoteError(
                    'data',
                    {
                        sessionId: device3Info.claims[SESSION_ID_CLAIM],
                    },
                    'task1'
                ),
            });

            await waitAsync();

            expect(device2.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [],
                        initial: true,
                    },
                },
            ]);
            expect(device3.messages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [],
                        initial: true,
                    },
                },
                {
                    name: RECEIVE_EVENT,
                    data: {
                        branch: 'testBranch',
                        action: deviceError(device1Info, 'data', 'task1'),
                    },
                },
            ]);
        });
    });

    describe(WATCH_DEVICES, () => {
        it('should send an event when a device connects to a branch', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const watchDevices = new Subject<void>();
            device.events.set(WATCH_DEVICES, watchDevices);

            const device2 = new MemoryConnection(device2Info);
            const joinBranch2 = new Subject<WatchBranchEvent>();
            device2.events.set(WATCH_BRANCH, joinBranch2);

            connections.connection.next(device);
            connections.connection.next(device2);
            await waitAsync();

            watchDevices.next();
            await waitAsync();

            joinBranch2.next({
                branch: 'testBranch',
            });
            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: DEVICE_CONNECTED_TO_BRANCH,
                    data: {
                        broadcast: true,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: device2Info,
                    },
                },
            ]);
        });

        it('should send an event when a device unwatches a branch', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const watchDevices = new Subject<void>();
            device.events.set(WATCH_DEVICES, watchDevices);

            const device2 = new MemoryConnection(device2Info);
            const joinBranch2 = new Subject<WatchBranchEvent>();
            const leaveBranch2 = new Subject<string>();
            device2.events.set(WATCH_BRANCH, joinBranch2);
            device2.events.set(UNWATCH_BRANCH, leaveBranch2);

            connections.connection.next(device);
            connections.connection.next(device2);
            await waitAsync();

            watchDevices.next();
            await waitAsync();

            joinBranch2.next({
                branch: 'testBranch',
            });
            await waitAsync();

            leaveBranch2.next('testBranch');
            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: DEVICE_CONNECTED_TO_BRANCH,
                    data: {
                        broadcast: true,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: device2Info,
                    },
                },
                {
                    name: DEVICE_DISCONNECTED_FROM_BRANCH,
                    data: {
                        broadcast: true,
                        branch: 'testBranch',
                        device: device2Info,
                    },
                },
            ]);
        });

        it('should send an event when a device disconnects', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const watchDevices = new Subject<void>();
            device.events.set(WATCH_DEVICES, watchDevices);

            const device2 = new MemoryConnection(device2Info);
            const joinBranch2 = new Subject<WatchBranchEvent>();
            device2.events.set(WATCH_BRANCH, joinBranch2);

            connections.connection.next(device);
            connections.connection.next(device2);
            await waitAsync();

            watchDevices.next();
            await waitAsync();

            joinBranch2.next({
                branch: 'testBranch',
            });
            await waitAsync();

            device2.disconnect.next('transport_close');
            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: DEVICE_CONNECTED_TO_BRANCH,
                    data: {
                        broadcast: true,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: device2Info,
                    },
                },
                {
                    name: DEVICE_DISCONNECTED_FROM_BRANCH,
                    data: {
                        broadcast: true,
                        branch: 'testBranch',
                        device: device2Info,
                    },
                },
            ]);
        });

        it('should send events for all the currently loaded branches and devices', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const watchDevices = new Subject<void>();
            device.events.set(WATCH_DEVICES, watchDevices);

            const device2 = new MemoryConnection(device2Info);
            const joinBranch2 = new Subject<WatchBranchEvent>();
            device2.events.set(WATCH_BRANCH, joinBranch2);

            const device3 = new MemoryConnection(device3Info);
            const joinBranch3 = new Subject<WatchBranchEvent>();
            device3.events.set(WATCH_BRANCH, joinBranch3);

            const device4 = new MemoryConnection(device4Info);
            const joinBranch4 = new Subject<WatchBranchEvent>();
            device4.events.set(WATCH_BRANCH, joinBranch4);

            connections.connection.next(device);
            connections.connection.next(device2);
            connections.connection.next(device3);
            connections.connection.next(device4);
            await waitAsync();

            joinBranch2.next({
                branch: 'testBranch',
            });
            await waitAsync();

            joinBranch3.next({
                branch: 'testBranch2',
            });
            await waitAsync();

            joinBranch4.next({
                branch: 'testBranch2',
            });
            await waitAsync();

            watchDevices.next();
            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: DEVICE_CONNECTED_TO_BRANCH,
                    data: {
                        broadcast: true,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: device2Info,
                    },
                },
                {
                    name: DEVICE_CONNECTED_TO_BRANCH,
                    data: {
                        broadcast: true,
                        branch: {
                            branch: 'testBranch2',
                        },
                        device: device3Info,
                    },
                },
                {
                    name: DEVICE_CONNECTED_TO_BRANCH,
                    data: {
                        broadcast: true,
                        branch: {
                            branch: 'testBranch2',
                        },
                        device: device4Info,
                    },
                },
            ]);
        });

        it('should include whether the branch is temporary when a device connects', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const watchDevices = new Subject<void>();
            device.events.set(WATCH_DEVICES, watchDevices);

            const device2 = new MemoryConnection(device2Info);
            const joinBranch2 = new Subject<WatchBranchEvent>();
            device2.events.set(WATCH_BRANCH, joinBranch2);

            connections.connection.next(device);
            connections.connection.next(device2);
            await waitAsync();

            watchDevices.next();
            await waitAsync();

            joinBranch2.next({
                branch: 'testBranch',
                temporary: true,
            });
            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: DEVICE_CONNECTED_TO_BRANCH,
                    data: {
                        broadcast: true,
                        branch: {
                            branch: 'testBranch',
                            temporary: true,
                        },
                        device: device2Info,
                    },
                },
            ]);
        });
    });

    describe(WATCH_BRANCH_DEVICES, () => {
        it('should send an event when a device connects to a branch', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const watchDevices = new Subject<string>();
            device.events.set(WATCH_BRANCH_DEVICES, watchDevices);

            const device2 = new MemoryConnection(device2Info);
            const joinBranch2 = new Subject<WatchBranchEvent>();
            device2.events.set(WATCH_BRANCH, joinBranch2);

            connections.connection.next(device);
            connections.connection.next(device2);
            await waitAsync();

            watchDevices.next('testBranch');
            await waitAsync();

            joinBranch2.next({
                branch: 'testBranch',
            });
            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: DEVICE_CONNECTED_TO_BRANCH,
                    data: {
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: device2Info,
                    },
                },
            ]);
        });

        it('should send an event when a device unwatches a branch', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const watchDevices = new Subject<string>();
            device.events.set(WATCH_BRANCH_DEVICES, watchDevices);

            const device2 = new MemoryConnection(device2Info);
            const joinBranch2 = new Subject<WatchBranchEvent>();
            const leaveBranch2 = new Subject<string>();
            device2.events.set(WATCH_BRANCH, joinBranch2);
            device2.events.set(UNWATCH_BRANCH, leaveBranch2);

            connections.connection.next(device);
            connections.connection.next(device2);
            await waitAsync();

            watchDevices.next('testBranch');
            await waitAsync();

            joinBranch2.next({
                branch: 'testBranch',
            });
            await waitAsync();

            leaveBranch2.next('testBranch');
            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: DEVICE_CONNECTED_TO_BRANCH,
                    data: {
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: device2Info,
                    },
                },
                {
                    name: DEVICE_DISCONNECTED_FROM_BRANCH,
                    data: {
                        broadcast: false,
                        branch: 'testBranch',
                        device: device2Info,
                    },
                },
            ]);
        });

        it('should send an event when a device disconnects', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const watchDevices = new Subject<string>();
            device.events.set(WATCH_BRANCH_DEVICES, watchDevices);

            const device2 = new MemoryConnection(device2Info);
            const joinBranch2 = new Subject<WatchBranchEvent>();
            device2.events.set(WATCH_BRANCH, joinBranch2);

            connections.connection.next(device);
            connections.connection.next(device2);
            await waitAsync();

            watchDevices.next('testBranch');
            await waitAsync();

            joinBranch2.next({
                branch: 'testBranch',
            });
            await waitAsync();

            device2.disconnect.next('transport_close');
            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: DEVICE_CONNECTED_TO_BRANCH,
                    data: {
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: device2Info,
                    },
                },
                {
                    name: DEVICE_DISCONNECTED_FROM_BRANCH,
                    data: {
                        broadcast: false,
                        branch: 'testBranch',
                        device: device2Info,
                    },
                },
            ]);
        });

        it('should send events for all the currently connected devices only for the specified branch', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const watchDevices = new Subject<string>();
            device.events.set(WATCH_BRANCH_DEVICES, watchDevices);

            const device2 = new MemoryConnection(device2Info);
            const joinBranch2 = new Subject<WatchBranchEvent>();
            device2.events.set(WATCH_BRANCH, joinBranch2);

            const device3 = new MemoryConnection(device3Info);
            const joinBranch3 = new Subject<WatchBranchEvent>();
            device3.events.set(WATCH_BRANCH, joinBranch3);

            const device4 = new MemoryConnection(device4Info);
            const joinBranch4 = new Subject<WatchBranchEvent>();
            device4.events.set(WATCH_BRANCH, joinBranch4);

            connections.connection.next(device);
            connections.connection.next(device2);
            connections.connection.next(device3);
            connections.connection.next(device4);
            await waitAsync();

            joinBranch2.next({
                branch: 'testBranch',
            });
            await waitAsync();

            joinBranch3.next({
                branch: 'testBranch',
            });
            await waitAsync();

            joinBranch4.next({
                branch: 'testBranch2',
            });
            await waitAsync();

            watchDevices.next('testBranch');
            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: DEVICE_CONNECTED_TO_BRANCH,
                    data: {
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: device2Info,
                    },
                },
                {
                    name: DEVICE_CONNECTED_TO_BRANCH,
                    data: {
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: device3Info,
                    },
                },
            ]);
        });

        it('should include whether the branch is temporary when a device connects', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const watchDevices = new Subject<string>();
            device.events.set(WATCH_BRANCH_DEVICES, watchDevices);

            const device2 = new MemoryConnection(device2Info);
            const joinBranch2 = new Subject<WatchBranchEvent>();
            device2.events.set(WATCH_BRANCH, joinBranch2);

            connections.connection.next(device);
            connections.connection.next(device2);
            await waitAsync();

            watchDevices.next('testBranch');
            await waitAsync();

            joinBranch2.next({
                branch: 'testBranch',
                temporary: true,
            });
            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: DEVICE_CONNECTED_TO_BRANCH,
                    data: {
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                            temporary: true,
                        },
                        device: device2Info,
                    },
                },
            ]);
        });
    });

    describe(UNWATCH_BRANCH_DEVICES, () => {
        it('should not send an event when stopped watching', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const watchDevices = new Subject<string>();
            device.events.set(WATCH_BRANCH_DEVICES, watchDevices);
            const unwatchDevices = new Subject<string>();
            device.events.set(UNWATCH_BRANCH_DEVICES, unwatchDevices);

            const device2 = new MemoryConnection(device2Info);
            const joinBranch2 = new Subject<WatchBranchEvent>();
            device2.events.set(WATCH_BRANCH, joinBranch2);

            connections.connection.next(device);
            connections.connection.next(device2);
            await waitAsync();

            watchDevices.next('testBranch');
            await waitAsync();

            unwatchDevices.next('testBranch');
            await waitAsync();

            joinBranch2.next({
                branch: 'testBranch',
            });
            await waitAsync();

            expect(device.messages).toEqual([]);
        });
    });

    describe(BRANCH_INFO, () => {
        it('should send a response with false when the given branch does not exist', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const branchInfo = new Subject<string>();
            device.events.set(BRANCH_INFO, branchInfo);

            connections.connection.next(device);
            await waitAsync();

            branchInfo.next('testBranch');
            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: BRANCH_INFO,
                    data: {
                        branch: 'testBranch',
                        exists: false,
                    },
                },
            ]);
        });

        it('should send a response with true when the given branch exists', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const branchInfo = new Subject<string>();
            device.events.set(BRANCH_INFO, branchInfo);

            connections.connection.next(device);
            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b = branch('testBranch', c);

            await storeData(store, 'testBranch', idx.data.hash, [
                a1,
                a2,
                idx,
                c,
            ]);
            await updateBranch(store, b);

            branchInfo.next('testBranch');
            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: BRANCH_INFO,
                    data: {
                        branch: 'testBranch',
                        exists: true,
                    },
                },
            ]);
        });
    });

    describe(BRANCHES, () => {
        it('should send a response with the list of branch names', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const branches = new Subject<void>();
            device.events.set(BRANCHES, branches);

            connections.connection.next(device);
            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b1 = branch('testBranch', c);
            const b2 = branch('testBranch2', c);

            await storeData(store, 'testBranch', idx.data.hash, [
                a1,
                a2,
                idx,
                c,
            ]);
            await updateBranch(store, b1);
            await updateBranch(store, b2);

            branches.next();
            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: BRANCHES,
                    data: {
                        branches: ['testBranch', 'testBranch2'],
                    },
                },
            ]);
        });
    });

    describe(BRANCHES_STATUS, () => {
        it('should send a response with info about each branch', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const branches = new Subject<void>();
            device.events.set(BRANCHES_STATUS, branches);

            connections.connection.next(device);
            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b1 = branch('testBranch', c);
            const b2 = branch('testBranch2', c, new Date(2019, 9, 5));
            const b3 = branch('testBranch3', c, new Date(2019, 9, 6));

            await storeData(store, 'testBranch', idx.data.hash, [
                a1,
                a2,
                idx,
                c,
            ]);
            await updateBranch(store, b1);
            await updateBranch(store, b2);
            await updateBranch(store, b3);

            branches.next();
            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: BRANCHES_STATUS,
                    data: {
                        // should be sorted from most recently updated to least
                        // recently updated.
                        branches: [
                            {
                                branch: 'testBranch3',
                                lastUpdateTime: new Date(2019, 9, 6),
                            },
                            {
                                branch: 'testBranch2',
                                lastUpdateTime: new Date(2019, 9, 5),
                            },
                            {
                                branch: 'testBranch',
                                lastUpdateTime: null,
                            },
                        ],
                    },
                },
            ]);
        });
    });

    describe(SET_BRANCH_PASSWORD, () => {
        it('should change the password if given the previous password', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const setPassword = new Subject<SetBranchPasswordEvent>();
            device.events.set(SET_BRANCH_PASSWORD, setPassword);

            connections.connection.next(device);
            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b1 = branch('testBranch', c);
            const hash1 = hashPassword('password1');
            const settings = branchSettings('testBranch', hash1);
            await store.saveSettings(settings);

            await storeData(store, 'testBranch', idx.data.hash, [
                a1,
                a2,
                idx,
                c,
            ]);
            await updateBranch(store, b1);

            setPassword.next({
                branch: 'testBranch',
                oldPassword: 'password1',
                newPassword: 'newPassword',
            });

            await waitAsync();

            const storedSettings = await store.getBranchSettings('testBranch');

            expect(
                verifyPassword('newPassword', storedSettings.passwordHash)
            ).toBe(true);
        });

        it('should be able to set the password of a branch that doesnt have a password by using 3342 as the old password', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const setPassword = new Subject<SetBranchPasswordEvent>();
            device.events.set(SET_BRANCH_PASSWORD, setPassword);

            connections.connection.next(device);
            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b1 = branch('testBranch', c);

            await storeData(store, 'testBranch', idx.data.hash, [
                a1,
                a2,
                idx,
                c,
            ]);
            await updateBranch(store, b1);

            setPassword.next({
                branch: 'testBranch',
                oldPassword: '3342',
                newPassword: 'newPassword',
            });

            await waitAsync();

            const storedSettings = await store.getBranchSettings('testBranch');

            expect(
                verifyPassword('newPassword', storedSettings.passwordHash)
            ).toBe(true);
        });

        it('should not be able to set the password of a branch if the old password is wrong', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const setPassword = new Subject<SetBranchPasswordEvent>();
            device.events.set(SET_BRANCH_PASSWORD, setPassword);

            connections.connection.next(device);
            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b1 = branch('testBranch', c);
            const hash1 = hashPassword('password1');
            const settings = branchSettings('testBranch', hash1);
            await store.saveSettings(settings);

            await storeData(store, 'testBranch', idx.data.hash, [
                a1,
                a2,
                idx,
                c,
            ]);
            await updateBranch(store, b1);

            setPassword.next({
                branch: 'testBranch',
                oldPassword: 'wrong',
                newPassword: 'newPassword',
            });

            await waitAsync();

            const storedSettings = await store.getBranchSettings('testBranch');

            expect(
                verifyPassword('newPassword', storedSettings.passwordHash)
            ).toBe(false);
        });

        it('should not allow adding atoms when the password was changed while authenticated', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const device2 = new MemoryConnection(device2Info);

            const addAtoms = new Subject<AddAtomsEvent>();
            const authenticate = new Subject<AuthenticateBranchWritesEvent>();
            const setPassword = new Subject<SetBranchPasswordEvent>();
            const joinBranch = new Subject<WatchBranchEvent>();
            device.events.set(ADD_ATOMS, addAtoms);
            device.events.set(AUTHENTICATE_BRANCH_WRITES, authenticate);
            device.events.set(WATCH_BRANCH, joinBranch);

            device2.events.set(SET_BRANCH_PASSWORD, setPassword);

            connections.connection.next(device);
            connections.connection.next(device2);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const hash1 = hashPassword('password');
            const settings = branchSettings('testBranch', hash1);
            await store.saveSettings(settings);
            const b = branch('testBranch', c);

            await storeData(store, 'testBranch', idx.data.hash, [
                a1,
                a2,
                idx,
                c,
            ]);
            await updateBranch(store, b);

            joinBranch.next({
                branch: 'testBranch',
            });

            await waitAsync();

            authenticate.next({
                branch: 'testBranch',
                password: 'password',
            });

            await waitAsync();

            setPassword.next({
                branch: 'testBranch',
                oldPassword: 'password',
                newPassword: 'different',
            });

            await waitAsync();

            addAtoms.next({
                branch: 'testBranch',
                atoms: [a3],
            });

            await waitAsync();

            const repoAtom = await store.getObject(a3.hash);
            expect(repoAtom).toEqual(null);

            expect(device.messages.slice(1)).toEqual([
                {
                    name: AUTHENTICATED_TO_BRANCH,
                    data: {
                        branch: 'testBranch',
                        authenticated: true,
                    },
                },

                // Disconnected because the password changed
                {
                    name: AUTHENTICATED_TO_BRANCH,
                    data: {
                        branch: 'testBranch',
                        authenticated: false,
                    },
                },
                // Server should send a atoms received event
                // back indicating which atoms it processed
                // in this case, no atoms were accepted
                {
                    name: ATOMS_RECEIVED,
                    data: {
                        branch: 'testBranch',
                        hashes: [],
                    },
                },
            ]);
        });
    });

    describe(AUTHENTICATE_BRANCH_WRITES, () => {
        it('should respond with an message indicating that the password was wrong', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const authenticate = new Subject<AuthenticateBranchWritesEvent>();
            device.events.set(AUTHENTICATE_BRANCH_WRITES, authenticate);

            connections.connection.next(device);
            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b1 = branch('testBranch', c);
            const hash1 = hashPassword('password1');
            const settings = branchSettings('testBranch', hash1);
            await store.saveSettings(settings);

            await storeData(store, 'testBranch', idx.data.hash, [
                a1,
                a2,
                idx,
                c,
            ]);
            await updateBranch(store, b1);

            authenticate.next({
                branch: 'testBranch',
                password: 'wrong',
            });

            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: AUTHENTICATED_TO_BRANCH,
                    data: {
                        branch: 'testBranch',
                        authenticated: false,
                    },
                },
            ]);
        });

        it('should be able to authenticate to branches without passwords by using 3342 as the password', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const authenticate = new Subject<AuthenticateBranchWritesEvent>();
            device.events.set(AUTHENTICATE_BRANCH_WRITES, authenticate);

            connections.connection.next(device);
            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});

            const idx = index(a1, a2);
            const c = commit('message', new Date(2019, 9, 4), idx, null);
            const b1 = branch('testBranch', c);

            await storeData(store, 'testBranch', idx.data.hash, [
                a1,
                a2,
                idx,
                c,
            ]);
            await updateBranch(store, b1);

            authenticate.next({
                branch: 'testBranch',
                password: '3342',
            });

            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: AUTHENTICATED_TO_BRANCH,
                    data: {
                        branch: 'testBranch',
                        authenticated: true,
                    },
                },
            ]);
        });
    });

    describe(DEVICES, () => {
        it('should send a response with the list of devices', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const device2 = new MemoryConnection(device2Info);
            const devices = new Subject<string>();
            device.events.set(DEVICES, devices);

            connections.connection.next(device);
            connections.connection.next(device2);
            await waitAsync();

            devices.next(null);
            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: DEVICES,
                    data: {
                        devices: [device1Info, device2Info],
                    },
                },
            ]);
        });

        it('should send a response with the list of devices that are connected to the given branch', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const device2 = new MemoryConnection(device2Info);
            const device3 = new MemoryConnection(device3Info);
            const devices = new Subject<string>();
            const watchBranch2 = new Subject<WatchBranchEvent>();
            const watchBranch3 = new Subject<WatchBranchEvent>();
            device.events.set(DEVICES, devices);
            device2.events.set(WATCH_BRANCH, watchBranch2);
            device3.events.set(WATCH_BRANCH, watchBranch3);

            connections.connection.next(device);
            connections.connection.next(device2);
            connections.connection.next(device3);

            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});
            const a4 = atom(atomId('a', 4), a2, {});
            const a5 = atom(atomId('a', 5), a2, {});
            const a6 = atom(atomId('a', 6), a2, {});

            const idx1 = index(a1, a2, a3);
            const idx2 = index(a1, a2, a4, a5);
            const c1 = commit('message', new Date(2019, 9, 4), idx1, null);
            const c2 = commit('message2', new Date(2019, 9, 4), idx2, c1);
            const b = branch('testBranch', c2);

            await storeData(store, 'testBranch', idx1.data.hash, [
                a1,
                a2,
                a3,
                idx1,
            ]);
            await storeData(store, 'testBranch', idx2.data.hash, [
                a1,
                a2,
                a4,
                a5,
                idx2,
            ]);
            await storeData(store, 'testBranch', null, [c1, c2]);
            await updateBranch(store, b);

            watchBranch2.next({
                branch: 'testBranch',
            });
            watchBranch3.next({
                branch: 'testBranch',
            });

            await waitAsync();

            devices.next('testBranch');
            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: DEVICES,
                    data: {
                        devices: [device2Info, device3Info],
                    },
                },
            ]);
        });
    });

    describe(DEVICE_COUNT, () => {
        it('should send a response with the number of devices', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const device2 = new MemoryConnection(device2Info);
            const devices = new Subject<string>();
            device.events.set(DEVICE_COUNT, devices);

            connections.connection.next(device);
            connections.connection.next(device2);
            await waitAsync();

            devices.next(null);
            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: DEVICE_COUNT,
                    data: {
                        branch: null,
                        count: 2,
                    },
                },
            ]);
        });

        it('should ignore the server player', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const device2 = new MemoryConnection(device2Info);
            const serverDevice = new MemoryConnection(serverInfo);
            const devices = new Subject<string>();
            const watchBranch2 = new Subject<WatchBranchEvent>();
            const watchBranch3 = new Subject<WatchBranchEvent>();
            device.events.set(DEVICE_COUNT, devices);
            device2.events.set(WATCH_BRANCH, watchBranch2);
            serverDevice.events.set(WATCH_BRANCH, watchBranch3);

            connections.connection.next(device);
            connections.connection.next(device2);
            connections.connection.next(serverDevice);

            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});
            const a4 = atom(atomId('a', 4), a2, {});
            const a5 = atom(atomId('a', 5), a2, {});
            const a6 = atom(atomId('a', 6), a2, {});

            const idx1 = index(a1, a2, a3);
            const idx2 = index(a1, a2, a4, a5);
            const c1 = commit('message', new Date(2019, 9, 4), idx1, null);
            const c2 = commit('message2', new Date(2019, 9, 4), idx2, c1);
            const b = branch('testBranch', c2);

            await storeData(store, 'testBranch', idx1.data.hash, [
                a1,
                a2,
                a3,
                idx1,
            ]);
            await storeData(store, 'testBranch', idx2.data.hash, [
                a1,
                a2,
                a4,
                a5,
                idx2,
            ]);
            await storeData(store, 'testBranch', null, [c1, c2]);
            await updateBranch(store, b);

            watchBranch2.next({
                branch: 'testBranch',
            });
            watchBranch3.next({
                branch: 'testBranch',
            });

            await waitAsync();

            devices.next('testBranch');
            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: DEVICE_COUNT,
                    data: {
                        branch: 'testBranch',
                        count: 1,
                    },
                },
            ]);
        });

        it('should send a response with the number of devices that are connected to the given branch', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const device2 = new MemoryConnection(device2Info);
            const device3 = new MemoryConnection(device3Info);
            const devices = new Subject<string>();
            const watchBranch2 = new Subject<WatchBranchEvent>();
            const watchBranch3 = new Subject<WatchBranchEvent>();
            device.events.set(DEVICE_COUNT, devices);
            device2.events.set(WATCH_BRANCH, watchBranch2);
            device3.events.set(WATCH_BRANCH, watchBranch3);

            connections.connection.next(device);
            connections.connection.next(device2);
            connections.connection.next(device3);

            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});
            const a4 = atom(atomId('a', 4), a2, {});
            const a5 = atom(atomId('a', 5), a2, {});
            const a6 = atom(atomId('a', 6), a2, {});

            const idx1 = index(a1, a2, a3);
            const idx2 = index(a1, a2, a4, a5);
            const c1 = commit('message', new Date(2019, 9, 4), idx1, null);
            const c2 = commit('message2', new Date(2019, 9, 4), idx2, c1);
            const b = branch('testBranch', c2);

            await storeData(store, 'testBranch', idx1.data.hash, [
                a1,
                a2,
                a3,
                idx1,
            ]);
            await storeData(store, 'testBranch', idx2.data.hash, [
                a1,
                a2,
                a4,
                a5,
                idx2,
            ]);
            await storeData(store, 'testBranch', null, [c1, c2]);
            await updateBranch(store, b);

            watchBranch2.next({
                branch: 'testBranch',
            });
            watchBranch3.next({
                branch: 'testBranch',
            });

            await waitAsync();

            devices.next('testBranch');
            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: DEVICE_COUNT,
                    data: {
                        branch: 'testBranch',
                        count: 2,
                    },
                },
            ]);
        });
    });

    describe(SYNC_TIME, () => {
        let oldNow: typeof Date.now;
        let now: jest.Mock<number>;

        beforeEach(() => {
            oldNow = Date.now;
            Date.now = now = jest.fn();
        });

        afterEach(() => {
            Date.now = oldNow;
        });

        it('should send a response with current time', async () => {
            server.init();

            const device = new MemoryConnection(device1Info);
            const device2 = new MemoryConnection(device2Info);
            const syncTime = new Subject<TimeSyncRequest>();
            device.events.set(SYNC_TIME, syncTime);

            connections.connection.next(device);
            connections.connection.next(device2);
            await waitAsync();

            now.mockReturnValueOnce(1000).mockReturnValueOnce(2000);

            syncTime.next({
                id: 1,
                clientRequestTime: 123,
            });
            await waitAsync();

            expect(device.messages).toEqual([
                {
                    name: SYNC_TIME,
                    data: {
                        id: 1,
                        clientRequestTime: 123,
                        serverReceiveTime: 1000,
                        serverTransmitTime: 2000,
                    },
                },
            ]);
        });
    });

    // describe(UNWATCH_DEVICES, () => {
    //     it('should stop sending events when a device connects to a branch', async () => {
    //         server.init();

    //         const device = new MemoryConnection('testDevice');
    //         const watchDevices = new Subject<void>();
    //         device.events.set(WATCH_DEVICES, watchDevices);

    //         const device1 = new MemoryConnection('testDevice1');
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
