import {
    branchNamespace,
    CausalRepoServer,
    deviceInfo,
    isEventForDevice,
} from './CausalRepoServer';
import {
    ADD_ATOMS,
    atom,
    atomId,
    atomMatchesHash,
    ATOMS_RECEIVED,
    DEVICE_CONNECTED_TO_BRANCH,
    DEVICE_DISCONNECTED_FROM_BRANCH,
    GET_UPDATES,
    RECEIVE_EVENT,
    SEND_EVENT,
    UNWATCH_BRANCH,
    UNWATCH_BRANCH_DEVICES,
    WATCH_BRANCH,
    WATCH_BRANCH_DEVICES,
} from '@casual-simulation/causal-trees/core2';
import { MemoryApiaryConnectionStore } from './MemoryApiaryConnectionStore';
import { MemoryApiaryAtomStore } from './MemoryApiaryAtomStore';
import { DeviceConnection } from './ApiaryConnectionStore';
import { MemoryApiaryMessenger } from './MemoryApiaryMessenger';
import {
    device,
    deviceError,
    DeviceInfo,
    deviceResult,
    DEVICE_ID_CLAIM,
    remote,
    remoteError,
    remoteResult,
    SESSION_ID_CLAIM,
    USERNAME_CLAIM,
} from '@casual-simulation/causal-trees';
import {
    action,
    botAdded,
    setupServer,
    ON_WEBHOOK_ACTION_NAME,
} from '@casual-simulation/aux-common/bots';
import { createBot } from '@casual-simulation/aux-common/bots/BotCalculations';
import { v4 as uuid } from 'uuid';
import {
    bot,
    tag,
    updates,
    value,
} from '@casual-simulation/aux-common/aux-format-2';
import {
    createYjsPartition,
    YjsPartitionImpl,
} from '@casual-simulation/aux-common/partitions/YjsPartition';
import { DEVICE_COUNT } from './ApiaryMessenger';
import { MemoryUpdatesStore } from './MemoryUpdatesStore';
import { ADD_UPDATES, UPDATES_RECEIVED, SYNC_TIME } from './ExtraEvents';
import { encodeStateAsUpdate } from 'yjs';
import { fromByteArray } from 'base64-js';

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid');

console.log = jest.fn();
console.error = jest.fn();

const device1Info: DeviceConnection = {
    username: 'device1',
    connectionId: 'device1',
    sessionId: 'device1',
    token: 'device1',
};
const device2Info: DeviceConnection = {
    username: 'device2',
    connectionId: 'device2',
    sessionId: 'device2',
    token: 'device2',
};
const device3Info: DeviceConnection = {
    username: 'device3',
    connectionId: 'device3',
    sessionId: 'device3',
    token: 'device3',
};
const device4Info: DeviceConnection = {
    username: 'device4',
    connectionId: 'device4',
    sessionId: 'device4',
    token: 'device4',
};

describe('CausalRepoServer', () => {
    let server: CausalRepoServer;
    let atomStore: MemoryApiaryAtomStore;
    let connectionStore: MemoryApiaryConnectionStore;
    let messenger: MemoryApiaryMessenger;
    let updateStore: MemoryUpdatesStore;

    beforeEach(() => {
        atomStore.reset();
        connectionStore.reset();
        messenger.reset();
        updateStore.reset();
    });

    // We initialize the server once for all the tests
    // because it should only rely on the stores for cross-request data.
    beforeAll(() => {
        atomStore = new MemoryApiaryAtomStore();
        connectionStore = new MemoryApiaryConnectionStore();
        messenger = new MemoryApiaryMessenger();
        updateStore = new MemoryUpdatesStore();
        server = new CausalRepoServer(
            connectionStore,
            atomStore,
            messenger,
            updateStore
        );
    });

    describe('connect()', () => {
        it('should save the given connection', async () => {
            await server.connect(device1Info);

            const connection = await connectionStore.getConnection(
                device1Info.connectionId
            );
            expect(connection).toEqual(device1Info);
        });
    });

    describe('disconnect()', () => {
        it('should remove the given connection', async () => {
            await server.connect(device1Info);

            await server.disconnect('connectionId');

            const connection = await connectionStore.getConnection(
                'connectionId'
            );
            expect(connection).toBeUndefined();
        });

        it('should delete temporary atoms when all devices have left the branch', async () => {
            await server.connect(device1Info);
            await server.connect(device2Info);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});
            const a4 = atom(atomId('a', 4), a3, {});

            await server.watchBranch(device1Info.connectionId, {
                branch: 'testBranch',
                temporary: true,
            });

            await server.watchBranch(device2Info.connectionId, {
                branch: 'testBranch',
                temporary: true,
            });

            await server.addAtoms(device2Info.connectionId, {
                branch: 'testBranch',
                atoms: [a1, a2, a3, a4],
            });

            await server.unwatchBranch(device1Info.connectionId, 'testBranch');

            expect(
                await atomStore.loadAtoms(branchNamespace('testBranch'))
            ).toEqual([a1, a2, a3, a4]);

            await server.disconnect(device2Info.connectionId);

            expect(
                await atomStore.loadAtoms(branchNamespace('testBranch'))
            ).toEqual([]);
        });

        it('should delete temporary updates when all devices have left the branch', async () => {
            await server.connect(device1Info);
            await server.connect(device2Info);

            await server.watchBranch(device1Info.connectionId, {
                branch: 'testBranch',
                protocol: 'updates',
                temporary: true,
            });

            await server.watchBranch(device2Info.connectionId, {
                branch: 'testBranch',
                protocol: 'updates',
                temporary: true,
            });

            await server.addUpdates(device2Info.connectionId, {
                branch: 'testBranch',
                updates: ['111', '222'],
            });

            await server.unwatchBranch(device1Info.connectionId, 'testBranch');

            expect(
                await updateStore.getUpdates(branchNamespace('testBranch'))
            ).toEqual({
                updates: ['111', '222'],
                timestamps: [expect.any(Number), expect.any(Number)],
            });

            await server.disconnect(device2Info.connectionId);

            expect(
                await updateStore.getUpdates(branchNamespace('testBranch'))
            ).toEqual({
                updates: [],
                timestamps: [],
            });
        });
    });

    describe(WATCH_BRANCH, () => {
        it('should load the given branch and send the current atoms', async () => {
            await server.connect(device1Info);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            await atomStore.saveAtoms(branchNamespace('testBranch'), [a1, a2]);

            await server.watchBranch(device1Info.connectionId, {
                branch: 'testBranch',
            });

            expect(messenger.getMessages(device1Info.connectionId)).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2],
                        initial: true, // should include whether this event includes the initial data.
                    },
                },
            ]);
        });

        it('should create a new orphan branch if the branch name does not exist', async () => {
            await server.connect(device1Info);

            await server.watchBranch(device1Info.connectionId, {
                branch: 'doesNotExist',
            });

            expect(messenger.getMessages(device1Info.connectionId)).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'doesNotExist',
                        atoms: [],
                        initial: true, // should include whether this event includes the initial data.
                    },
                },
            ]);
        });

        it('should be able to accept multiple requests to watch a branch at a time', async () => {
            await server.connect(device1Info);
            await server.connect(device2Info);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            await atomStore.saveAtoms(branchNamespace('testBranch'), [a1, a2]);

            const watchBranch1 = server.watchBranch(device1Info.connectionId, {
                branch: 'testBranch',
            });
            const watchBranch2 = server.watchBranch(device2Info.connectionId, {
                branch: 'testBranch',
            });

            await Promise.all([watchBranch1, watchBranch2]);

            expect(messenger.getMessages(device1Info.connectionId)).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2],
                        initial: true,
                    },
                },
            ]);
            expect(messenger.getMessages(device2Info.connectionId)).toEqual([
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

        it('should be able to load, unload, and reload the branch', async () => {
            await server.connect(device1Info);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            await atomStore.saveAtoms(branchNamespace('testBranch'), [a1, a2]);

            await server.watchBranch(device1Info.connectionId, {
                branch: 'testBranch',
            });

            await server.disconnect(device1Info.connectionId);

            await server.connect(device1Info);

            await server.watchBranch(device1Info.connectionId, {
                branch: 'testBranch',
            });

            expect(messenger.getMessages(device1Info.connectionId)).toEqual([
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
                        atoms: [a1, a2],
                        initial: true,
                    },
                },
            ]);
        });

        describe('temp', () => {
            it('should load the branch like normal if it is temporary', async () => {
                await server.connect(device1Info);

                const a1 = atom(atomId('a', 1), null, {});
                const a2 = atom(atomId('a', 2), a1, {});
                await atomStore.saveAtoms(branchNamespace('testBranch'), [
                    a1,
                    a2,
                ]);

                await server.watchBranch(device1Info.connectionId, {
                    branch: 'testBranch',
                    temporary: true,
                });

                expect(messenger.getMessages(device1Info.connectionId)).toEqual(
                    [
                        {
                            name: ADD_ATOMS,
                            data: {
                                branch: 'testBranch',
                                atoms: [a1, a2],
                                initial: true,
                            },
                        },
                    ]
                );
            });
            it('should load the atoms that were added to the branch by another device', async () => {
                await server.connect(device1Info);
                await server.connect(device2Info);
                await server.connect(device3Info);

                const a1 = atom(atomId('a', 1), null, {});
                const a2 = atom(atomId('a', 2), a1, {});

                await server.watchBranch(device1Info.connectionId, {
                    branch: 'testBranch',
                    temporary: true,
                });

                await server.addAtoms(device2Info.connectionId, {
                    branch: 'testBranch',
                    atoms: [a1, a2],
                });

                await server.watchBranch(device3Info.connectionId, {
                    branch: 'testBranch',
                    temporary: true,
                });

                expect(messenger.getMessages(device1Info.connectionId)).toEqual(
                    [
                        {
                            name: ADD_ATOMS,
                            data: {
                                branch: 'testBranch',
                                atoms: [],
                                initial: true,
                            },
                        },
                        {
                            name: ADD_ATOMS,
                            data: {
                                branch: 'testBranch',
                                atoms: [a1, a2],
                            },
                        },
                    ]
                );

                expect(messenger.getMessages(device2Info.connectionId)).toEqual(
                    [
                        {
                            name: ATOMS_RECEIVED,
                            data: {
                                branch: 'testBranch',
                                hashes: [a1.hash, a2.hash],
                            },
                        },
                    ]
                );

                expect(messenger.getMessages(device3Info.connectionId)).toEqual(
                    [
                        {
                            name: ADD_ATOMS,
                            data: {
                                branch: 'testBranch',
                                atoms: [a1, a2],
                                initial: true,
                            },
                        },
                    ]
                );
            });

            it('should delete the atoms once all devices have disconnected', async () => {
                await server.connect(device1Info);
                await server.connect(device2Info);
                await server.connect(device3Info);

                const a1 = atom(atomId('a', 1), null, {});
                const a2 = atom(atomId('a', 2), a1, {});

                await server.watchBranch(device1Info.connectionId, {
                    branch: 'testBranch',
                    temporary: true,
                });

                await server.addAtoms(device2Info.connectionId, {
                    branch: 'testBranch',
                    atoms: [a1, a2],
                });

                await server.watchBranch(device3Info.connectionId, {
                    branch: 'testBranch',
                    temporary: true,
                });

                let atoms = await atomStore.loadAtoms(
                    branchNamespace('testBranch')
                );
                expect(atoms).toEqual([a1, a2]);

                await server.disconnect(device1Info.connectionId);

                atoms = await atomStore.loadAtoms(
                    branchNamespace('testBranch')
                );
                expect(atoms).toEqual([a1, a2]);

                await server.disconnect(device2Info.connectionId);

                atoms = await atomStore.loadAtoms(
                    branchNamespace('testBranch')
                );
                expect(atoms).toEqual([a1, a2]);

                await server.disconnect(device3Info.connectionId);

                atoms = await atomStore.loadAtoms(
                    branchNamespace('testBranch')
                );
                expect(atoms).toEqual([]);
            });

            it('should not send a add_atoms event to the device that added the atoms', async () => {
                await server.connect(device1Info);

                const a1 = atom(atomId('a', 1), null, {});
                const a2 = atom(atomId('a', 2), a1, {});

                await server.watchBranch(device1Info.connectionId, {
                    branch: 'testBranch',
                });

                await server.addAtoms(device1Info.connectionId, {
                    branch: 'testBranch',
                    atoms: [a1, a2],
                });

                expect(messenger.getMessages(device1Info.connectionId)).toEqual(
                    [
                        {
                            name: ADD_ATOMS,
                            data: {
                                branch: 'testBranch',
                                atoms: [],
                                initial: true,
                            },
                        },
                        {
                            name: ATOMS_RECEIVED,
                            data: {
                                branch: 'testBranch',
                                hashes: [a1.hash, a2.hash],
                            },
                        },
                    ]
                );
            });

            it('should be able to load a temporary branch immediately after loading a persistent branch', async () => {
                await server.connect(device1Info);

                const a1 = atom(atomId('a', 1), null, {});
                const a2 = atom(atomId('a', 2), a1, {});

                await server.watchBranch(device1Info.connectionId, {
                    branch: 'persistentBranch',
                });

                await server.watchBranch(device1Info.connectionId, {
                    branch: 'tempBranch',
                    temporary: true,
                });

                await server.addAtoms(device1Info.connectionId, {
                    branch: 'tempBranch',
                    atoms: [a1, a2],
                });

                expect(messenger.getMessages(device1Info.connectionId)).toEqual(
                    [
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
                                hashes: [a1.hash, a2.hash],
                            },
                        },
                    ]
                );
            });
        });

        describe('updates', () => {
            it('should load the given branch and send the current updates', async () => {
                await server.connect(device1Info);

                await updateStore.addUpdates(branchNamespace('testBranch'), [
                    '123',
                    '456',
                ]);

                await server.watchBranch(device1Info.connectionId, {
                    branch: 'testBranch',
                    protocol: 'updates',
                });

                expect(messenger.getMessages(device1Info.connectionId)).toEqual(
                    [
                        {
                            name: ADD_UPDATES,
                            data: {
                                branch: 'testBranch',
                                updates: ['123', '456'],
                                initial: true, // should include whether this event includes the initial data.
                            },
                        },
                    ]
                );
            });

            it('should create a new orphan branch if the branch name does not exist', async () => {
                await server.connect(device1Info);

                await server.watchBranch(device1Info.connectionId, {
                    branch: 'doesNotExist',
                    protocol: 'updates',
                });

                expect(messenger.getMessages(device1Info.connectionId)).toEqual(
                    [
                        {
                            name: ADD_UPDATES,
                            data: {
                                branch: 'doesNotExist',
                                updates: [] as string[],
                                initial: true,
                            },
                        },
                    ]
                );
            });

            describe('temp', () => {
                it('should load the branch like normal if the branch is temporary', async () => {
                    await server.connect(device1Info);

                    await updateStore.addUpdates(
                        branchNamespace('testBranch'),
                        ['111', '222']
                    );

                    await server.watchBranch(device1Info.connectionId, {
                        branch: 'testBranch',
                        temporary: true,
                        protocol: 'updates',
                    });

                    expect(
                        messenger.getMessages(device1Info.connectionId)
                    ).toEqual([
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

                it('should load the updates that were added to the branch by another device', async () => {
                    await server.connect(device1Info);
                    await server.connect(device2Info);
                    await server.connect(device3Info);

                    await server.watchBranch(device1Info.connectionId, {
                        branch: 'testBranch',
                        protocol: 'updates',
                        temporary: true,
                    });

                    await server.addUpdates(device1Info.connectionId, {
                        branch: 'testBranch',
                        updates: ['abc', 'def'],
                    });

                    await server.watchBranch(device3Info.connectionId, {
                        branch: 'testBranch',
                        protocol: 'updates',
                        temporary: true,
                    });

                    expect(
                        messenger.getMessages(device3Info.connectionId)
                    ).toEqual([
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

    // describe(GET_BRANCH, () => {
    //     it('should load the given branch and send the current atoms', async () => {
    //         server.init();

    //         const device = new MemoryConnection(device1Info);
    //         const getBranch = new Subject<string>();
    //         device.events.set(GET_BRANCH, getBranch);

    //         connections.connection.next(device);

    //         const a1 = atom(atomId('a', 1), null, {});
    //         const a2 = atom(atomId('a', 2), a1, {});

    //         const idx = index(a1, a2);
    //         const c = commit('message', new Date(2019, 9, 4), idx, null);
    //         const b = branch('testBranch', c);

    //         await storeData(store, 'testBranch', idx.data.hash, [
    //             a1,
    //             a2,
    //             idx,
    //             c,
    //         ]);
    //         await updateBranch(store, b);

    //         getBranch.next('testBranch');

    //         await waitAsync();

    //         expect(device.messages).toEqual([
    //             {
    //                 name: ADD_ATOMS,
    //                 data: {
    //                     branch: 'testBranch',
    //                     atoms: [a1, a2],
    //                 },
    //             },
    //         ]);
    //     });

    //     it('should create a new orphan branch if the branch name does not exist', async () => {
    //         server.init();

    //         const device = new MemoryConnection(device1Info);
    //         const getBranch = new Subject<string>();
    //         device.events.set(GET_BRANCH, getBranch);

    //         connections.connection.next(device);

    //         await waitAsync();

    //         getBranch.next('testBranch');

    //         await waitAsync();

    //         expect(device.messages).toEqual([
    //             {
    //                 name: ADD_ATOMS,
    //                 data: {
    //                     branch: 'testBranch',
    //                     atoms: [],
    //                 },
    //             },
    //         ]);
    //     });

    //     it('should not send additional atoms that were added after the GET_BRANCH call', async () => {
    //         server.init();

    //         const device = new MemoryConnection(device1Info);
    //         const device2 = new MemoryConnection(device2Info);
    //         const getBranch = new Subject<string>();
    //         const addAtoms = new Subject<AddAtomsEvent>();
    //         device.events.set(GET_BRANCH, getBranch);
    //         device2.events.set(ADD_ATOMS, addAtoms);

    //         connections.connection.next(device);
    //         connections.connection.next(device2);

    //         const a1 = atom(atomId('a', 1), null, {});
    //         const a2 = atom(atomId('a', 2), a1, {});
    //         const b1 = atom(atomId('b', 1), null, {});

    //         const idx = index(a1, a2);
    //         const c = commit('message', new Date(2019, 9, 4), idx, null);
    //         const b = branch('testBranch', c);

    //         await storeData(store, 'testBranch', idx.data.hash, [
    //             a1,
    //             a2,
    //             idx,
    //             c,
    //         ]);
    //         await updateBranch(store, b);

    //         getBranch.next('testBranch');

    //         await waitAsync();

    //         addAtoms.next({
    //             branch: 'testBranch',
    //             atoms: [b1],
    //         });

    //         await waitAsync();

    //         expect(device.messages).toEqual([
    //             {
    //                 name: ADD_ATOMS,
    //                 data: {
    //                     branch: 'testBranch',
    //                     atoms: [a1, a2],
    //                 },
    //             },
    //         ]);
    //     });
    // });

    describe(UNWATCH_BRANCH, () => {
        it('should stop sending new atoms to devices that have left a branch', async () => {
            await server.connect(device1Info);
            await server.connect(device2Info);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});
            const a4 = atom(atomId('a', 4), a3, {});

            await server.watchBranch(device1Info.connectionId, {
                branch: 'testBranch',
            });

            await server.addAtoms(device2Info.connectionId, {
                branch: 'testBranch',
                atoms: [a1, a2],
            });

            await server.unwatchBranch(device1Info.connectionId, 'testBranch');

            await server.addAtoms(device2Info.connectionId, {
                branch: 'testBranch',
                atoms: [a3, a4],
            });

            expect(messenger.getMessages(device1Info.connectionId)).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [],
                        initial: true,
                    },
                },
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2],
                    },
                },
            ]);
        });

        it('should do nothing if the branch is already unloaded', async () => {
            await server.connect(device1Info);

            await server.unwatchBranch(device1Info.connectionId, 'testBranch');

            expect(messenger.getMessages(device1Info.connectionId)).toEqual([]);
        });

        it('should delete temporary atoms when all devices have left the branch', async () => {
            await server.connect(device1Info);
            await server.connect(device2Info);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});
            const a4 = atom(atomId('a', 4), a3, {});

            await server.watchBranch(device1Info.connectionId, {
                branch: 'testBranch',
                temporary: true,
            });

            await server.watchBranch(device2Info.connectionId, {
                branch: 'testBranch',
                temporary: true,
            });

            await server.addAtoms(device2Info.connectionId, {
                branch: 'testBranch',
                atoms: [a1, a2, a3, a4],
            });

            await server.unwatchBranch(device1Info.connectionId, 'testBranch');

            expect(
                await atomStore.loadAtoms(branchNamespace('testBranch'))
            ).toEqual([a1, a2, a3, a4]);

            await server.unwatchBranch(device2Info.connectionId, 'testBranch');

            expect(
                await atomStore.loadAtoms(branchNamespace('testBranch'))
            ).toEqual([]);
        });

        describe('updates', () => {
            it('should stop sending new atoms to devices that have left a branch', async () => {
                await server.connect(device1Info);
                await server.connect(device2Info);

                await server.watchBranch(device1Info.connectionId, {
                    branch: 'testBranch',
                    protocol: 'updates',
                });

                await server.addUpdates(device2Info.connectionId, {
                    branch: 'testBranch',
                    updates: ['111', '222'],
                });

                await server.unwatchBranch(
                    device1Info.connectionId,
                    'testBranch'
                );

                await server.addUpdates(device2Info.connectionId, {
                    branch: 'testBranch',
                    updates: ['333', '444'],
                });

                expect(messenger.getMessages(device1Info.connectionId)).toEqual(
                    [
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
                                updates: ['111', '222'],
                            },
                        },
                    ]
                );
            });

            it('should delete temporary updates when all devices have left the branch', async () => {
                await server.connect(device1Info);
                await server.connect(device2Info);

                await server.watchBranch(device1Info.connectionId, {
                    branch: 'testBranch',
                    temporary: true,
                    protocol: 'updates',
                });

                await server.watchBranch(device2Info.connectionId, {
                    branch: 'testBranch',
                    temporary: true,
                    protocol: 'updates',
                });

                await server.addUpdates(device2Info.connectionId, {
                    branch: 'testBranch',
                    updates: ['111', '222'],
                });

                await server.unwatchBranch(
                    device1Info.connectionId,
                    'testBranch'
                );

                expect(
                    await updateStore.getUpdates(branchNamespace('testBranch'))
                ).toEqual({
                    updates: ['111', '222'],
                    timestamps: [expect.any(Number), expect.any(Number)],
                });

                await server.unwatchBranch(
                    device2Info.connectionId,
                    'testBranch'
                );

                expect(
                    await updateStore.getUpdates(branchNamespace('testBranch'))
                ).toEqual({
                    updates: [],
                    timestamps: [],
                });
            });
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
            await server.connect(device1Info);

            mockedNow.mockReturnValue(100);
            await server.addUpdates(device1Info.connectionId, {
                branch: 'testBranch',
                updates: ['111', '222'],
                updateId: 0,
            });

            await server.getUpdates(device1Info.connectionId, 'testBranch');

            expect(messenger.getMessages(device1Info.connectionId)).toEqual([
                // Server should send a atoms received event
                // back indicating which atoms it processed
                {
                    name: UPDATES_RECEIVED,
                    data: {
                        branch: 'testBranch',
                        updateId: 0,
                    },
                },

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
            await server.connect(device1Info);

            mockedNow.mockReturnValue(100);
            await server.addUpdates(device1Info.connectionId, {
                branch: 'testBranch',
                updates: ['111', '222'],
                updateId: 0,
            });

            await server.getUpdates(device1Info.connectionId, 'testBranch');

            await server.addUpdates(device1Info.connectionId, {
                branch: 'testBranch',
                updates: ['333'],
                updateId: 1,
            });

            expect(messenger.getMessages(device1Info.connectionId)).toEqual([
                // Server should send a atoms received event
                // back indicating which atoms it processed
                {
                    name: UPDATES_RECEIVED,
                    data: {
                        branch: 'testBranch',
                        updateId: 0,
                    },
                },

                {
                    name: ADD_UPDATES,
                    data: {
                        branch: 'testBranch',
                        updates: ['111', '222'],
                        timestamps: [100, 100],
                    },
                },

                // Server should send a atoms received event
                // back indicating which atoms it processed
                {
                    name: UPDATES_RECEIVED,
                    data: {
                        branch: 'testBranch',
                        updateId: 1,
                    },
                },
            ]);
        });
    });

    describe(ADD_ATOMS, () => {
        it('should add the given atoms to the given branch', async () => {
            await server.connect(device1Info);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            await server.addAtoms(device1Info.connectionId, {
                branch: 'testBranch',
                atoms: [a3],
            });

            await atomStore.saveAtoms(branchNamespace('testBranch'), [a1, a2]);

            await server.watchBranch(device1Info.connectionId, {
                branch: 'testBranch',
            });

            expect(messenger.getMessages(device1Info.connectionId)).toEqual([
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

        // it('should not add atoms that violate cardinality', async () => {
        //     server.init();

        //     const device = new MemoryConnection(device1Info);
        //     const addAtoms = new Subject<AddAtomsEvent>();
        //     device.events.set(ADD_ATOMS, addAtoms);

        //     const joinBranch = new Subject<WatchBranchEvent>();
        //     device.events.set(WATCH_BRANCH, joinBranch);

        //     connections.connection.next(device);

        //     const a1 = atom(
        //         atomId('a', 1, undefined, { group: 'abc', number: 1 }),
        //         null,
        //         {}
        //     );
        //     const a2 = atom(
        //         atomId('a', 2, undefined, { group: 'abc', number: 1 }),
        //         null,
        //         {}
        //     );

        //     const idx = index();
        //     const c = commit('message', new Date(2019, 9, 4), idx, null);
        //     const b = branch('testBranch', c);

        //     await storeData(store, 'testBranch', idx.data.hash, [idx, c]);
        //     await updateBranch(store, b);

        //     addAtoms.next({
        //         branch: 'testBranch',
        //         atoms: [a1, a2],
        //     });

        //     await waitAsync();

        //     joinBranch.next({
        //         branch: 'testBranch',
        //     });

        //     await waitAsync();

        //     expect(device.messages).toEqual([
        //         // Server should send a atoms received event
        //         // back indicating which atoms it processed
        //         {
        //             name: ATOMS_RECEIVED,
        //             data: {
        //                 branch: 'testBranch',
        //                 hashes: [a1.hash, a2.hash],
        //             },
        //         },

        //         {
        //             name: ADD_ATOMS,
        //             data: {
        //                 branch: 'testBranch',
        //                 atoms: [a1],
        //             },
        //         },
        //     ]);
        // });

        it('should notify all other devices connected to the branch', async () => {
            await server.connect(device1Info);
            await server.connect(device2Info);
            await server.connect(device3Info);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            await atomStore.saveAtoms(branchNamespace('testBranch'), [a1, a2]);

            await server.watchBranch(device2Info.connectionId, {
                branch: 'testBranch',
            });

            await server.watchBranch(device3Info.connectionId, {
                branch: 'testBranch',
            });

            await server.addAtoms(device1Info.connectionId, {
                branch: 'testBranch',
                atoms: [a3],
            });

            expect(messenger.getMessages(device2Info.connectionId)).toEqual([
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

            expect(messenger.getMessages(device3Info.connectionId)).toEqual([
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
            await server.connect(device1Info);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});
            await atomStore.saveAtoms(branchNamespace('testBranch'), [a1, a2]);

            await server.watchBranch(device1Info.connectionId, {
                branch: 'testBranch',
            });

            await server.addAtoms(device1Info.connectionId, {
                branch: 'testBranch',
                atoms: [a3],
            });

            expect(messenger.getMessages(device1Info.connectionId)).toEqual([
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
            await server.connect(device1Info);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            await server.addAtoms(device1Info.connectionId, {
                branch: 'testBranch',
                atoms: [a3],
            });

            const atoms = await atomStore.loadAtoms(
                branchNamespace('testBranch')
            );

            expect(atoms).toEqual([a3]);
        });

        it('should remove the given atoms from the given branch', async () => {
            await server.connect(device1Info);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            await atomStore.saveAtoms(branchNamespace('testBranch'), [
                a1,
                a2,
                a3,
            ]);

            await server.addAtoms(device1Info.connectionId, {
                branch: 'testBranch',
                removedAtoms: [a3.hash],
            });

            const atoms = await atomStore.loadAtoms(
                branchNamespace('testBranch')
            );

            expect(atoms).toEqual([a1, a2]);

            await server.watchBranch(device1Info.connectionId, {
                branch: 'testBranch',
            });

            expect(messenger.getMessages(device1Info.connectionId)).toEqual([
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

        // it('should not remove the given atoms if they are part of a cardinality tree', async () => {
        //     server.init();

        //     const device = new MemoryConnection(device1Info);
        //     const removeAtoms = new Subject<AddAtomsEvent>();
        //     device.events.set(ADD_ATOMS, removeAtoms);

        //     const joinBranch = new Subject<WatchBranchEvent>();
        //     device.events.set(WATCH_BRANCH, joinBranch);

        //     connections.connection.next(device);

        //     const a1 = atom(
        //         atomId('a', 1, undefined, { group: 'abc', number: 1 }),
        //         null,
        //         {}
        //     );
        //     const a2 = atom(atomId('a', 2), a1, {});
        //     const a3 = atom(atomId('a', 3), a2, {});

        //     const idx = index(a1, a2, a3);
        //     const c = commit('message', new Date(2019, 9, 4), idx, null);
        //     const b = branch('testBranch', c);

        //     await storeData(store, 'testBranch', idx.data.hash, [
        //         a1,
        //         a2,
        //         a3,
        //         idx,
        //         c,
        //     ]);
        //     await updateBranch(store, b);

        //     removeAtoms.next({
        //         branch: 'testBranch',
        //         removedAtoms: [a3.hash],
        //     });

        //     await waitAsync();

        //     joinBranch.next({
        //         branch: 'testBranch',
        //     });

        //     await waitAsync();

        //     expect(device.messages).toEqual([
        //         // Server should send a atoms received event
        //         // back indicating which atoms it processed
        //         {
        //             name: ATOMS_RECEIVED,
        //             data: {
        //                 branch: 'testBranch',
        //                 hashes: [a3.hash],
        //             },
        //         },

        //         {
        //             name: ADD_ATOMS,
        //             data: {
        //                 branch: 'testBranch',
        //                 atoms: [a1, a2, a3],
        //             },
        //         },
        //     ]);
        // });

        it('should notify all other devices connected to the branch', async () => {
            await server.connect(device1Info);
            await server.connect(device2Info);
            await server.connect(device3Info);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            await atomStore.saveAtoms(branchNamespace('testBranch'), [
                a1,
                a2,
                a3,
            ]);

            await server.watchBranch(device2Info.connectionId, {
                branch: 'testBranch',
            });

            await server.watchBranch(device3Info.connectionId, {
                branch: 'testBranch',
            });

            await server.addAtoms(device1Info.connectionId, {
                branch: 'testBranch',
                removedAtoms: [a3.hash],
            });

            expect(messenger.getMessages(device2Info.connectionId)).toEqual([
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

            expect(messenger.getMessages(device3Info.connectionId)).toEqual([
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
            await server.connect(device1Info);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            await atomStore.saveAtoms(branchNamespace('testBranch'), [
                a1,
                a2,
                a3,
            ]);

            await server.watchBranch(device1Info.connectionId, {
                branch: 'testBranch',
            });

            await server.addAtoms(device1Info.connectionId, {
                branch: 'testBranch',
                removedAtoms: [a3.hash],
            });

            expect(messenger.getMessages(device1Info.connectionId)).toEqual([
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

        it('should not send atoms that were already removed', async () => {
            await server.connect(device1Info);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            await atomStore.saveAtoms(branchNamespace('testBranch'), [
                a1,
                a2,
                a3,
            ]);

            await server.watchBranch(device1Info.connectionId, {
                branch: 'testBranch',
            });

            await server.addAtoms(device1Info.connectionId, {
                branch: 'testBranch',
                removedAtoms: [a3.hash],
            });

            expect(messenger.getMessages(device1Info.connectionId)).toEqual([
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

        it('should ignore when given an event with a null branch', async () => {
            await server.connect(device1Info);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            await server.addAtoms(device1Info.connectionId, {
                branch: null,
                atoms: [a3],
            });
        });

        it('should not crash if adding atoms to a branch that does not exist', async () => {
            await server.connect(device1Info);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            await server.addAtoms(device1Info.connectionId, {
                branch: 'abc',
                atoms: [a3],
            });

            expect(await atomStore.loadAtoms(branchNamespace('abc'))).toEqual([
                a3,
            ]);
        });

        // describe('temp', () => {
        //     it('should not store the given atoms with the current branch', async () => {
        //         server.init();

        //         const device = new MemoryConnection(device1Info);
        //         const addAtoms = new Subject<AddAtomsEvent>();
        //         device.events.set(ADD_ATOMS, addAtoms);

        //         const joinBranch = new Subject<WatchBranchEvent>();
        //         device.events.set(WATCH_BRANCH, joinBranch);

        //         connections.connection.next(device);

        //         await waitAsync();

        //         joinBranch.next({
        //             branch: '@testBranch',
        //             temporary: true,
        //         });

        //         const a1 = atom(atomId('a', 1), null, {});
        //         const a2 = atom(atomId('a', 2), a1, {});
        //         const a3 = atom(atomId('a', 3), a2, {});

        //         const idx = index(a1, a2);
        //         const c = commit('message', new Date(2019, 9, 4), idx, null);
        //         const b = branch('@testBranch', c);

        //         await storeData(store, '@testBranch', idx.data.hash, [
        //             a1,
        //             a2,
        //             idx,
        //             c,
        //         ]);
        //         await updateBranch(store, b);

        //         addAtoms.next({
        //             branch: '@testBranch',
        //             atoms: [a3],
        //         });

        //         await waitAsync();

        //         const [repoAtom] = await store.getObjects('@testBranch', [
        //             a3.hash,
        //         ]);
        //         expect(repoAtom).toBeFalsy();
        //     });

        //     it('should notify all other devices connected to the branch', async () => {
        //         server.init();

        //         const device = new MemoryConnection(device1Info);
        //         const addAtoms = new Subject<AddAtomsEvent>();
        //         device.events.set(ADD_ATOMS, addAtoms);

        //         const device2 = new MemoryConnection(device2Info);
        //         const joinBranch2 = new Subject<WatchBranchEvent>();
        //         device2.events.set(WATCH_BRANCH, joinBranch2);

        //         const device3 = new MemoryConnection(device3Info);
        //         const joinBranch3 = new Subject<WatchBranchEvent>();
        //         device3.events.set(WATCH_BRANCH, joinBranch3);

        //         connections.connection.next(device);
        //         connections.connection.next(device2);
        //         connections.connection.next(device3);

        //         await waitAsync();

        //         const a1 = atom(atomId('a', 1), null, {});

        //         joinBranch2.next({
        //             branch: '@testBranch',
        //             temporary: true,
        //         });
        //         joinBranch3.next({
        //             branch: '@testBranch',
        //             temporary: true,
        //         });

        //         await waitAsync();

        //         addAtoms.next({
        //             branch: '@testBranch',
        //             atoms: [a1],
        //         });

        //         await waitAsync();

        //         expect(device2.messages).toEqual([
        //             {
        //                 name: ADD_ATOMS,
        //                 data: {
        //                     branch: '@testBranch',
        //                     atoms: [],
        //                 },
        //             },
        //             {
        //                 name: ADD_ATOMS,
        //                 data: {
        //                     branch: '@testBranch',
        //                     atoms: [a1],
        //                 },
        //             },
        //         ]);

        //         expect(device3.messages).toEqual([
        //             {
        //                 name: ADD_ATOMS,
        //                 data: {
        //                     branch: '@testBranch',
        //                     atoms: [],
        //                 },
        //             },
        //             {
        //                 name: ADD_ATOMS,
        //                 data: {
        //                     branch: '@testBranch',
        //                     atoms: [a1],
        //                 },
        //             },
        //         ]);
        //     });
        // });

        // it('should prevent adding atoms to a branch that has a password', async () => {
        //     server.init();

        //     const device = new MemoryConnection(device1Info);
        //     const addAtoms = new Subject<AddAtomsEvent>();
        //     device.events.set(ADD_ATOMS, addAtoms);

        //     const joinBranch = new Subject<WatchBranchEvent>();
        //     device.events.set(WATCH_BRANCH, joinBranch);

        //     connections.connection.next(device);

        //     const a1 = atom(atomId('a', 1), null, {});
        //     const a2 = atom(atomId('a', 2), a1, {});
        //     const a3 = atom(atomId('a', 3), a2, {});

        //     const idx = index(a1, a2);
        //     const c = commit('message', new Date(2019, 9, 4), idx, null);
        //     const b = branch('testBranch', c);
        //     const hash1 = hashPassword('password');
        //     const settings = branchSettings('testBranch', hash1);
        //     await store.saveSettings(settings);

        //     await storeData(store, 'testBranch', idx.data.hash, [
        //         a1,
        //         a2,
        //         idx,
        //         c,
        //     ]);
        //     await updateBranch(store, b);

        //     addAtoms.next({
        //         branch: 'testBranch',
        //         atoms: [a3],
        //     });

        //     await waitAsync();

        //     const repoAtom = await store.getObject(a3.hash);
        //     expect(repoAtom).toBe(null);

        //     expect(device.messages).toEqual([
        //         // Server should send a atoms received event
        //         // back indicating which atoms it processed
        //         // in this case, no atoms were accepted
        //         {
        //             name: ATOMS_RECEIVED,
        //             data: {
        //                 branch: 'testBranch',
        //                 hashes: [],
        //             },
        //         },
        //     ]);
        // });

        // it('should allow adding atoms to a branch that has a password when authenticated', async () => {
        //     server.init();

        //     const device = new MemoryConnection(device1Info);
        //     const addAtoms = new Subject<AddAtomsEvent>();
        //     const authenticate = new Subject<AuthenticateBranchWritesEvent>();
        //     device.events.set(ADD_ATOMS, addAtoms);
        //     device.events.set(AUTHENTICATE_BRANCH_WRITES, authenticate);

        //     const joinBranch = new Subject<WatchBranchEvent>();
        //     device.events.set(WATCH_BRANCH, joinBranch);

        //     connections.connection.next(device);

        //     const a1 = atom(atomId('a', 1), null, {});
        //     const a2 = atom(atomId('a', 2), a1, {});
        //     const a3 = atom(atomId('a', 3), a2, {});

        //     const idx = index(a1, a2);
        //     const c = commit('message', new Date(2019, 9, 4), idx, null);
        //     const b = branch('testBranch', c);
        //     const hash1 = hashPassword('password');
        //     const settings = branchSettings('testBranch', hash1);
        //     await store.saveSettings(settings);

        //     await storeData(store, 'testBranch', idx.data.hash, [
        //         a1,
        //         a2,
        //         idx,
        //         c,
        //     ]);
        //     await updateBranch(store, b);

        //     joinBranch.next({
        //         branch: 'testBranch',
        //     });

        //     await waitAsync();

        //     authenticate.next({
        //         branch: 'testBranch',
        //         password: 'password',
        //     });

        //     await waitAsync();

        //     addAtoms.next({
        //         branch: 'testBranch',
        //         atoms: [a3],
        //     });

        //     await waitAsync();

        //     const repoAtom = await store.getObject(a3.hash);
        //     expect(repoAtom).toEqual({
        //         type: 'atom',
        //         data: a3,
        //     });

        //     expect(device.messages.slice(2)).toEqual([
        //         // Server should send a atoms received event
        //         // back indicating which atoms it processed
        //         // in this case, no atoms were accepted
        //         {
        //             name: ATOMS_RECEIVED,
        //             data: {
        //                 branch: 'testBranch',
        //                 hashes: [a3.hash],
        //             },
        //         },
        //     ]);
        // });

        // it('should remember that the device is authenticated if the device authenticates without watching', async () => {
        //     server.init();

        //     const device = new MemoryConnection(device1Info);
        //     const addAtoms = new Subject<AddAtomsEvent>();
        //     const authenticate = new Subject<AuthenticateBranchWritesEvent>();
        //     device.events.set(ADD_ATOMS, addAtoms);
        //     device.events.set(AUTHENTICATE_BRANCH_WRITES, authenticate);

        //     const joinBranch = new Subject<WatchBranchEvent>();
        //     device.events.set(WATCH_BRANCH, joinBranch);

        //     connections.connection.next(device);

        //     const a1 = atom(atomId('a', 1), null, {});
        //     const a2 = atom(atomId('a', 2), a1, {});
        //     const a3 = atom(atomId('a', 3), a2, {});

        //     const idx = index(a1, a2);
        //     const c = commit('message', new Date(2019, 9, 4), idx, null);
        //     const b = branch('testBranch', c);
        //     const hash1 = hashPassword('password');
        //     const settings = branchSettings('testBranch', hash1);
        //     await store.saveSettings(settings);

        //     await storeData(store, 'testBranch', idx.data.hash, [
        //         a1,
        //         a2,
        //         idx,
        //         c,
        //     ]);
        //     await updateBranch(store, b);

        //     authenticate.next({
        //         branch: 'testBranch',
        //         password: 'password',
        //     });

        //     await waitAsync();

        //     addAtoms.next({
        //         branch: 'testBranch',
        //         atoms: [a3],
        //     });

        //     await waitAsync();

        //     const repoAtom = await store.getObject(a3.hash);
        //     expect(repoAtom).toEqual({
        //         type: 'atom',
        //         data: a3,
        //     });

        //     expect(device.messages).toEqual([
        //         {
        //             name: AUTHENTICATED_TO_BRANCH,
        //             data: {
        //                 branch: 'testBranch',
        //                 authenticated: true,
        //             },
        //         },
        //         // Server should send a atoms received event
        //         // back indicating which atoms it processed
        //         // in this case, no atoms were accepted
        //         {
        //             name: ATOMS_RECEIVED,
        //             data: {
        //                 branch: 'testBranch',
        //                 hashes: [a3.hash],
        //             },
        //         },
        //     ]);
        // });
    });

    describe(ADD_UPDATES, () => {
        it('should add the given updates to the given branch', async () => {
            await server.connect(device1Info);

            await server.addUpdates(device1Info.connectionId, {
                branch: 'testBranch',
                updates: ['111', '222'],
                updateId: 0,
            });

            await updateStore.addUpdates(branchNamespace('testBranch'), [
                '333',
            ]);

            await server.watchBranch(device1Info.connectionId, {
                branch: 'testBranch',
                protocol: 'updates',
            });

            expect(messenger.getMessages(device1Info.connectionId)).toEqual([
                // Server should send a atoms received event
                // back indicating which atoms it processed
                {
                    name: UPDATES_RECEIVED,
                    data: {
                        branch: 'testBranch',
                        updateId: 0,
                    },
                },

                {
                    name: ADD_UPDATES,
                    data: {
                        branch: 'testBranch',
                        updates: ['111', '222', '333'],
                        initial: true,
                    },
                },
            ]);
        });

        it('should notify all other devices connected to the branch', async () => {
            await server.connect(device1Info);
            await server.connect(device2Info);
            await server.connect(device3Info);

            await updateStore.addUpdates(branchNamespace('testBranch'), [
                '111',
                '222',
            ]);

            await server.watchBranch(device2Info.connectionId, {
                branch: 'testBranch',
                protocol: 'updates',
            });

            await server.watchBranch(device3Info.connectionId, {
                branch: 'testBranch',
                protocol: 'updates',
            });

            await server.addUpdates(device1Info.connectionId, {
                branch: 'testBranch',
                updates: ['333'],
            });

            expect(messenger.getMessages(device2Info.connectionId)).toEqual([
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
                        updates: ['333'],
                    },
                },
            ]);

            expect(messenger.getMessages(device3Info.connectionId)).toEqual([
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
                        updates: ['333'],
                    },
                },
            ]);
        });

        it('should not notify the device that sent the new atoms', async () => {
            await server.connect(device1Info);

            await updateStore.addUpdates(branchNamespace('testBranch'), [
                '111',
                '222',
            ]);

            await server.watchBranch(device1Info.connectionId, {
                branch: 'testBranch',
                protocol: 'updates',
            });

            await server.addUpdates(device1Info.connectionId, {
                branch: 'testBranch',
                updates: ['333'],
                updateId: 0,
            });

            expect(messenger.getMessages(device1Info.connectionId)).toEqual([
                {
                    name: ADD_UPDATES,
                    data: {
                        branch: 'testBranch',
                        updates: ['111', '222'],
                        initial: true,
                    },
                },

                // Server should send a atoms received event
                // back indicating which atoms it processed
                {
                    name: UPDATES_RECEIVED,
                    data: {
                        branch: 'testBranch',
                        updateId: 0,
                    },
                },
            ]);
        });

        it('should immediately store the added atoms', async () => {
            await server.connect(device1Info);

            await server.addUpdates(device1Info.connectionId, {
                branch: 'testBranch',
                updates: ['111', '222'],
                updateId: 0,
            });

            const updates = await updateStore.getUpdates(
                branchNamespace('testBranch')
            );

            expect(updates).toEqual({
                updates: ['111', '222'],
                timestamps: [expect.any(Number), expect.any(Number)],
            });
        });

        it('should ignore when given an event with a null branch', async () => {
            await server.connect(device1Info);

            await server.addUpdates(device1Info.connectionId, {
                branch: null,
                updates: ['111'],
            });
        });

        it('should not crash if adding atoms to a branch that does not exist', async () => {
            await server.connect(device1Info);

            await server.addUpdates(device1Info.connectionId, {
                branch: 'abc',
                updates: ['111'],
            });

            expect(
                await updateStore.getUpdates(branchNamespace('abc'))
            ).toEqual({
                updates: ['111'],
                timestamps: [expect.any(Number)],
            });
        });
    });

    describe(SEND_EVENT, () => {
        it('should notify the device that the event was sent to', async () => {
            await server.connect(device1Info);
            await server.connect(device2Info);
            await server.connect(device3Info);

            await server.watchBranch(device2Info.connectionId, {
                branch: 'testBranch',
            });

            await server.watchBranch(device3Info.connectionId, {
                branch: 'testBranch',
            });

            await server.sendEvent(device1Info.connectionId, {
                branch: 'testBranch',
                action: remote(
                    {
                        type: 'abc',
                    },
                    {
                        sessionId: device3Info.sessionId,
                    }
                ),
            });

            expect(messenger.getMessages(device2Info.connectionId)).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [],
                        initial: true,
                    },
                },
            ]);
            expect(messenger.getMessages(device3Info.connectionId)).toEqual([
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
                        action: device(deviceInfo(device1Info), {
                            type: 'abc',
                        }),
                    },
                },
            ]);
        });

        it('should send remote events to a random device if none is specified', async () => {
            await server.connect(device1Info);
            await server.connect(device2Info);
            await server.connect(device3Info);

            const randomMock = (Math.random = jest.fn());
            randomMock.mockReturnValueOnce(1 / 2);

            await server.watchBranch(device2Info.connectionId, {
                branch: 'testBranch',
            });

            await server.watchBranch(device3Info.connectionId, {
                branch: 'testBranch',
            });

            await server.sendEvent(device1Info.connectionId, {
                branch: 'testBranch',
                action: remote({
                    type: 'abc',
                }),
            });

            expect(messenger.getMessages(device2Info.connectionId)).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [],
                        initial: true,
                    },
                },
            ]);
            expect(messenger.getMessages(device3Info.connectionId)).toEqual([
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
                        action: device(deviceInfo(device1Info), {
                            type: 'abc',
                        }),
                    },
                },
            ]);
        });

        it('should broadcast to all devices if broadcast is true', async () => {
            await server.connect(device1Info);
            await server.connect(device2Info);
            await server.connect(device3Info);

            await server.watchBranch(device1Info.connectionId, {
                branch: 'testBranch',
            });

            await server.watchBranch(device3Info.connectionId, {
                branch: 'testBranch',
            });

            await server.sendEvent(device1Info.connectionId, {
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

            expect(messenger.getMessages(device1Info.connectionId)).toEqual([
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
                        action: device(deviceInfo(device1Info), {
                            type: 'abc',
                        }),
                    },
                },
            ]);
            expect(messenger.getMessages(device2Info.connectionId)).toEqual([]);
            expect(messenger.getMessages(device3Info.connectionId)).toEqual([
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
                        action: device(deviceInfo(device1Info), {
                            type: 'abc',
                        }),
                    },
                },
            ]);
        });

        it('should relay the task ID from the remote action to the device action', async () => {
            await server.connect(device1Info);
            await server.connect(device2Info);
            await server.connect(device3Info);

            await server.watchBranch(device2Info.connectionId, {
                branch: 'testBranch',
            });

            await server.watchBranch(device3Info.connectionId, {
                branch: 'testBranch',
            });

            await server.sendEvent(device1Info.connectionId, {
                branch: 'testBranch',
                action: remote(
                    {
                        type: 'abc',
                    },
                    {
                        sessionId: device3Info.sessionId,
                    },
                    undefined,
                    'task1'
                ),
            });

            expect(messenger.getMessages(device2Info.connectionId)).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [],
                        initial: true,
                    },
                },
            ]);

            expect(messenger.getMessages(device3Info.connectionId)).toEqual([
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
                        action: device(
                            deviceInfo(device1Info),
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
            await server.connect(device1Info);
            await server.connect(device2Info);
            await server.connect(device3Info);

            await server.watchBranch(device2Info.connectionId, {
                branch: 'testBranch',
            });

            await server.watchBranch(device3Info.connectionId, {
                branch: 'testBranch',
            });

            await server.sendEvent(device1Info.connectionId, {
                branch: 'testBranch',
                action: remoteResult(
                    'data',
                    {
                        sessionId: device3Info.sessionId,
                    },
                    'task1'
                ),
            });

            expect(messenger.getMessages(device2Info.connectionId)).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [],
                        initial: true,
                    },
                },
            ]);
            expect(messenger.getMessages(device3Info.connectionId)).toEqual([
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
                        action: deviceResult(
                            deviceInfo(device1Info),
                            'data',
                            'task1'
                        ),
                    },
                },
            ]);
        });

        it('should convert a remote action error to a device action error', async () => {
            await server.connect(device1Info);
            await server.connect(device2Info);
            await server.connect(device3Info);

            await server.watchBranch(device2Info.connectionId, {
                branch: 'testBranch',
            });

            await server.watchBranch(device3Info.connectionId, {
                branch: 'testBranch',
            });

            await server.sendEvent(device1Info.connectionId, {
                branch: 'testBranch',
                action: remoteError(
                    'data',
                    {
                        sessionId: device3Info.sessionId,
                    },
                    'task1'
                ),
            });

            expect(messenger.getMessages(device2Info.connectionId)).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [],
                        initial: true,
                    },
                },
            ]);
            expect(messenger.getMessages(device3Info.connectionId)).toEqual([
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
                        action: deviceError(
                            deviceInfo(device1Info),
                            'data',
                            'task1'
                        ),
                    },
                },
            ]);
        });

        describe('setup_story', () => {
            it('should intercept setup_story actions and add the given atoms to the branch', async () => {
                await server.connect(device1Info);

                uuidMock
                    .mockReturnValueOnce('siteId')
                    .mockReturnValueOnce('botId');
                await server.sendEvent(device1Info.connectionId, {
                    branch: 'testBranch',
                    action: remote(
                        setupServer(
                            'otherBranch',
                            createBot('test', {
                                abc: 'def',
                            })
                        )
                    ),
                });

                const atoms = await atomStore.loadAtoms('/branch/otherBranch');

                const bot1 = atom(atomId('siteId', 1), null, bot('botId'));
                const tag1 = atom(atomId('siteId', 2), bot1, tag('abc'));
                const val1 = atom(atomId('siteId', 3), tag1, value('def'));

                expect(atoms).toEqual([bot1, tag1, val1]);
            });

            it('should support bot mods', async () => {
                await server.connect(device1Info);

                uuidMock
                    .mockReturnValueOnce('siteId')
                    .mockReturnValueOnce('botId');
                await server.sendEvent(device1Info.connectionId, {
                    branch: 'testBranch',
                    action: remote(
                        setupServer('otherBranch', {
                            abc: 'def',
                        })
                    ),
                });

                const atoms = await atomStore.loadAtoms('/branch/otherBranch');

                const bot1 = atom(atomId('siteId', 1), null, bot('botId'));
                const tag1 = atom(atomId('siteId', 2), bot1, tag('abc'));
                const val1 = atom(atomId('siteId', 3), tag1, value('def'));

                expect(atoms).toEqual([bot1, tag1, val1]);
            });

            it('should do nothing if the namespace already has atoms in it', async () => {
                await server.connect(device1Info);

                uuidMock
                    .mockReturnValueOnce('siteId')
                    .mockReturnValueOnce('botId');

                const a1 = atom(atomId('a', 1), null, bot('test1'));

                await atomStore.saveAtoms('/branch/otherBranch', [a1]);

                await server.sendEvent(device1Info.connectionId, {
                    branch: 'testBranch',
                    action: remote(
                        setupServer('otherBranch', {
                            abc: 'def',
                        })
                    ),
                });

                const atoms = await atomStore.loadAtoms('/branch/otherBranch');

                expect(atoms).toEqual([a1]);
            });

            it('should not send the event to other players', async () => {
                await server.connect(device1Info);
                await server.connect(device2Info);

                await server.watchBranch(device1Info.connectionId, {
                    branch: 'testBranch',
                });

                await server.watchBranch(device2Info.connectionId, {
                    branch: 'testBranch',
                });

                uuidMock
                    .mockReturnValueOnce('siteId')
                    .mockReturnValueOnce('botId');

                await server.sendEvent(device1Info.connectionId, {
                    branch: 'testBranch',
                    action: remote(
                        setupServer('otherBranch', {
                            abc: 'def',
                        })
                    ),
                });

                const atoms = await atomStore.loadAtoms('/branch/otherBranch');

                const bot1 = atom(atomId('siteId', 1), null, bot('botId'));
                const tag1 = atom(atomId('siteId', 2), bot1, tag('abc'));
                const val1 = atom(atomId('siteId', 3), tag1, value('def'));

                expect(atoms).toEqual([bot1, tag1, val1]);

                expect(messenger.getMessages(device1Info.connectionId)).toEqual(
                    [
                        {
                            name: ADD_ATOMS,
                            data: {
                                atoms: [],
                                branch: 'testBranch',
                                initial: true,
                            },
                        },
                    ]
                );
                expect(messenger.getMessages(device2Info.connectionId)).toEqual(
                    [
                        {
                            name: ADD_ATOMS,
                            data: {
                                atoms: [],
                                branch: 'testBranch',
                                initial: true,
                            },
                        },
                    ]
                );
            });
        });
    });

    describe(WATCH_BRANCH_DEVICES, () => {
        it('should send an event when a device connects to a branch', async () => {
            await server.connect(device1Info);
            await server.connect(device2Info);

            await server.watchBranchDevices(
                device1Info.connectionId,
                'testBranch'
            );

            await server.watchBranch(device2Info.connectionId, {
                branch: 'testBranch',
            });

            expect(messenger.getMessages(device1Info.connectionId)).toEqual([
                {
                    name: DEVICE_CONNECTED_TO_BRANCH,
                    data: {
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: deviceInfo(device2Info),
                    },
                },
            ]);
        });

        it('should send an event when a device unwatches a branch', async () => {
            await server.connect(device1Info);
            await server.connect(device2Info);

            await server.watchBranchDevices(
                device1Info.connectionId,
                'testBranch'
            );

            await server.watchBranch(device2Info.connectionId, {
                branch: 'testBranch',
            });

            await server.unwatchBranch(device2Info.connectionId, 'testBranch');

            expect(messenger.getMessages(device1Info.connectionId)).toEqual([
                {
                    name: DEVICE_CONNECTED_TO_BRANCH,
                    data: {
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: deviceInfo(device2Info),
                    },
                },
                {
                    name: DEVICE_DISCONNECTED_FROM_BRANCH,
                    data: {
                        broadcast: false,
                        branch: 'testBranch',
                        device: deviceInfo(device2Info),
                    },
                },
            ]);
        });

        it('should send an event when a device disconnects', async () => {
            await server.connect(device1Info);
            await server.connect(device2Info);

            await server.watchBranchDevices(
                device1Info.connectionId,
                'testBranch'
            );

            await server.watchBranch(device2Info.connectionId, {
                branch: 'testBranch',
            });

            await server.disconnect(device2Info.connectionId);

            expect(messenger.getMessages(device1Info.connectionId)).toEqual([
                {
                    name: DEVICE_CONNECTED_TO_BRANCH,
                    data: {
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                        },
                        device: deviceInfo(device2Info),
                    },
                },
                {
                    name: DEVICE_DISCONNECTED_FROM_BRANCH,
                    data: {
                        broadcast: false,
                        branch: 'testBranch',
                        device: deviceInfo(device2Info),
                    },
                },
            ]);
        });

        it('should send events for all the currently connected devices only for the specified branch', async () => {
            await server.connect(device1Info);
            await server.connect(device2Info);
            await server.connect(device3Info);
            await server.connect(device4Info);

            await server.watchBranch(device2Info.connectionId, {
                branch: 'testBranch',
            });

            await server.watchBranch(device3Info.connectionId, {
                branch: 'testBranch',
            });

            await server.watchBranch(device4Info.connectionId, {
                branch: 'testBranch2',
            });

            await server.watchBranchDevices(
                device1Info.connectionId,
                'testBranch'
            );

            expect(messenger.getMessages(device1Info.connectionId)).toEqual([
                {
                    name: DEVICE_CONNECTED_TO_BRANCH,
                    data: {
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                            temporary: false,
                        },
                        device: deviceInfo(device2Info),
                    },
                },
                {
                    name: DEVICE_CONNECTED_TO_BRANCH,
                    data: {
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                            temporary: false,
                        },
                        device: deviceInfo(device3Info),
                    },
                },
            ]);
        });

        it('should include whether the branch is temporary when a device connects', async () => {
            await server.connect(device1Info);
            await server.connect(device2Info);

            await server.watchBranchDevices(
                device1Info.connectionId,
                'testBranch'
            );

            await server.watchBranch(device2Info.connectionId, {
                branch: 'testBranch',
                temporary: true,
            });

            expect(messenger.getMessages(device1Info.connectionId)).toEqual([
                {
                    name: DEVICE_CONNECTED_TO_BRANCH,
                    data: {
                        broadcast: false,
                        branch: {
                            branch: 'testBranch',
                            temporary: true,
                        },
                        device: deviceInfo(device2Info),
                    },
                },
            ]);
        });
    });

    describe(UNWATCH_BRANCH_DEVICES, () => {
        it('should not send an event when stopped watching', async () => {
            await server.connect(device1Info);
            await server.connect(device2Info);

            await server.watchBranchDevices(
                device1Info.connectionId,
                'testBranch'
            );
            await server.unwatchBranchDevices(
                device1Info.connectionId,
                'testBranch'
            );

            await server.watchBranch(device2Info.connectionId, {
                branch: 'testBranch',
            });

            expect(messenger.getMessages(device1Info.connectionId)).toEqual([]);
        });

        it('should stop watching when the device disconnects', async () => {
            await server.connect(device1Info);
            await server.connect(device2Info);

            await server.watchBranchDevices(
                device1Info.connectionId,
                'testBranch'
            );

            await server.disconnect(device1Info.connectionId);

            await server.connect(device1Info);

            await server.watchBranch(device2Info.connectionId, {
                branch: 'testBranch',
            });

            expect(messenger.getMessages(device1Info.connectionId)).toEqual([]);
        });
    });

    describe(DEVICE_COUNT, () => {
        it('should send a response with the number of devices', async () => {
            await server.connect(device1Info);
            await server.connect(device2Info);

            await server.deviceCount(device1Info.connectionId, null);

            expect(messenger.getMessages(device1Info.connectionId)).toEqual([
                {
                    name: DEVICE_COUNT,
                    data: {
                        branch: null,
                        count: 2,
                    },
                },
            ]);
        });

        it('should send a response with the number of devices that are connected to the given branch', async () => {
            await server.connect(device1Info);
            await server.connect(device2Info);
            await server.connect(device3Info);

            await server.watchBranch(device2Info.connectionId, {
                branch: 'testBranch',
            });
            await server.watchBranch(device3Info.connectionId, {
                branch: 'testBranch',
            });

            await server.deviceCount(device1Info.connectionId, 'testBranch');

            expect(messenger.getMessages(device1Info.connectionId)).toEqual([
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
            await server.connect(device1Info);
            await server.connect(device2Info);

            now.mockReturnValueOnce(1000).mockReturnValueOnce(2000);

            await server.syncTime(
                device1Info.connectionId,
                {
                    id: 1,
                    clientRequestTime: 123,
                },
                500
            );

            expect(messenger.getMessages(device1Info.connectionId)).toEqual([
                {
                    name: SYNC_TIME,
                    data: {
                        id: 1,
                        clientRequestTime: 123,
                        serverReceiveTime: 500,
                        serverTransmitTime: 1000,
                    },
                },
            ]);
        });
    });

    describe('getBranchData()', () => {
        it('should return an empty AUX if there is no branch updates', async () => {
            const data = await server.getBranchData('testBranch');

            expect(data).toEqual({
                version: 1,
                state: {},
            });
        });

        it('should return the aux file for the given branch', async () => {
            const partition = createYjsPartition({
                type: 'yjs',
            });

            await partition.applyEvents([
                botAdded(
                    createBot('test1', {
                        abc: 'def',
                        ghi: 123,
                    })
                ),
            ]);

            const updateBytes = encodeStateAsUpdate(
                (partition as YjsPartitionImpl).doc
            );
            const updateBase64 = fromByteArray(updateBytes);

            await updateStore.addUpdates(branchNamespace('testBranch'), [
                updateBase64,
            ]);

            const data = await server.getBranchData('testBranch');

            expect(data).toEqual({
                version: 1,
                state: {
                    test1: createBot('test1', {
                        abc: 'def',
                        ghi: 123,
                    }),
                },
            });
        });
    });

    // describe(BRANCH_INFO, () => {
    //     it('should send a response with false when the given branch does not exist', async () => {
    //         server.init();

    //         const device = new MemoryConnection(device1Info);
    //         const branchInfo = new Subject<string>();
    //         device.events.set(BRANCH_INFO, branchInfo);

    //         connections.connection.next(device);
    //         await waitAsync();

    //         branchInfo.next('testBranch');
    //         await waitAsync();

    //         expect(device.messages).toEqual([
    //             {
    //                 name: BRANCH_INFO,
    //                 data: {
    //                     branch: 'testBranch',
    //                     exists: false,
    //                 },
    //             },
    //         ]);
    //     });

    //     it('should send a response with true when the given branch exists', async () => {
    //         server.init();

    //         const device = new MemoryConnection(device1Info);
    //         const branchInfo = new Subject<string>();
    //         device.events.set(BRANCH_INFO, branchInfo);

    //         connections.connection.next(device);
    //         await waitAsync();

    //         const a1 = atom(atomId('a', 1), null, {});
    //         const a2 = atom(atomId('a', 2), a1, {});

    //         const idx = index(a1, a2);
    //         const c = commit('message', new Date(2019, 9, 4), idx, null);
    //         const b = branch('testBranch', c);

    //         await storeData(store, 'testBranch', idx.data.hash, [
    //             a1,
    //             a2,
    //             idx,
    //             c,
    //         ]);
    //         await updateBranch(store, b);

    //         branchInfo.next('testBranch');
    //         await waitAsync();

    //         expect(device.messages).toEqual([
    //             {
    //                 name: BRANCH_INFO,
    //                 data: {
    //                     branch: 'testBranch',
    //                     exists: true,
    //                 },
    //             },
    //         ]);
    //     });
    // });

    // describe(BRANCHES, () => {
    //     it('should send a response with the list of branch names', async () => {
    //         server.init();

    //         const device = new MemoryConnection(device1Info);
    //         const branches = new Subject<void>();
    //         device.events.set(BRANCHES, branches);

    //         connections.connection.next(device);
    //         await waitAsync();

    //         const a1 = atom(atomId('a', 1), null, {});
    //         const a2 = atom(atomId('a', 2), a1, {});

    //         const idx = index(a1, a2);
    //         const c = commit('message', new Date(2019, 9, 4), idx, null);
    //         const b1 = branch('testBranch', c);
    //         const b2 = branch('testBranch2', c);

    //         await storeData(store, 'testBranch', idx.data.hash, [
    //             a1,
    //             a2,
    //             idx,
    //             c,
    //         ]);
    //         await updateBranch(store, b1);
    //         await updateBranch(store, b2);

    //         branches.next();
    //         await waitAsync();

    //         expect(device.messages).toEqual([
    //             {
    //                 name: BRANCHES,
    //                 data: {
    //                     branches: ['testBranch', 'testBranch2'],
    //                 },
    //             },
    //         ]);
    //     });
    // });

    // describe(BRANCHES_STATUS, () => {
    //     it('should send a response with info about each branch', async () => {
    //         server.init();

    //         const device = new MemoryConnection(device1Info);
    //         const branches = new Subject<void>();
    //         device.events.set(BRANCHES_STATUS, branches);

    //         connections.connection.next(device);
    //         await waitAsync();

    //         const a1 = atom(atomId('a', 1), null, {});
    //         const a2 = atom(atomId('a', 2), a1, {});

    //         const idx = index(a1, a2);
    //         const c = commit('message', new Date(2019, 9, 4), idx, null);
    //         const b1 = branch('testBranch', c);
    //         const b2 = branch('testBranch2', c, new Date(2019, 9, 5));
    //         const b3 = branch('testBranch3', c, new Date(2019, 9, 6));

    //         await storeData(store, 'testBranch', idx.data.hash, [
    //             a1,
    //             a2,
    //             idx,
    //             c,
    //         ]);
    //         await updateBranch(store, b1);
    //         await updateBranch(store, b2);
    //         await updateBranch(store, b3);

    //         branches.next();
    //         await waitAsync();

    //         expect(device.messages).toEqual([
    //             {
    //                 name: BRANCHES_STATUS,
    //                 data: {
    //                     // should be sorted from most recently updated to least
    //                     // recently updated.
    //                     branches: [
    //                         {
    //                             branch: 'testBranch3',
    //                             lastUpdateTime: new Date(2019, 9, 6),
    //                         },
    //                         {
    //                             branch: 'testBranch2',
    //                             lastUpdateTime: new Date(2019, 9, 5),
    //                         },
    //                         {
    //                             branch: 'testBranch',
    //                             lastUpdateTime: null,
    //                         },
    //                     ],
    //                 },
    //             },
    //         ]);
    //     });
    // });

    // describe(SET_BRANCH_PASSWORD, () => {
    //     it('should change the password if given the previous password', async () => {
    //         server.init();

    //         const device = new MemoryConnection(device1Info);
    //         const setPassword = new Subject<SetBranchPasswordEvent>();
    //         device.events.set(SET_BRANCH_PASSWORD, setPassword);

    //         connections.connection.next(device);
    //         await waitAsync();

    //         const a1 = atom(atomId('a', 1), null, {});
    //         const a2 = atom(atomId('a', 2), a1, {});

    //         const idx = index(a1, a2);
    //         const c = commit('message', new Date(2019, 9, 4), idx, null);
    //         const b1 = branch('testBranch', c);
    //         const hash1 = hashPassword('password1');
    //         const settings = branchSettings('testBranch', hash1);
    //         await store.saveSettings(settings);

    //         await storeData(store, 'testBranch', idx.data.hash, [
    //             a1,
    //             a2,
    //             idx,
    //             c,
    //         ]);
    //         await updateBranch(store, b1);

    //         setPassword.next({
    //             branch: 'testBranch',
    //             oldPassword: 'password1',
    //             newPassword: 'newPassword',
    //         });

    //         await waitAsync();

    //         const storedSettings = await store.getBranchSettings('testBranch');

    //         expect(
    //             verifyPassword('newPassword', storedSettings.passwordHash)
    //         ).toBe(true);
    //     });

    //     it('should be able to set the password of a branch that doesnt have a password by using 3342 as the old password', async () => {
    //         server.init();

    //         const device = new MemoryConnection(device1Info);
    //         const setPassword = new Subject<SetBranchPasswordEvent>();
    //         device.events.set(SET_BRANCH_PASSWORD, setPassword);

    //         connections.connection.next(device);
    //         await waitAsync();

    //         const a1 = atom(atomId('a', 1), null, {});
    //         const a2 = atom(atomId('a', 2), a1, {});

    //         const idx = index(a1, a2);
    //         const c = commit('message', new Date(2019, 9, 4), idx, null);
    //         const b1 = branch('testBranch', c);

    //         await storeData(store, 'testBranch', idx.data.hash, [
    //             a1,
    //             a2,
    //             idx,
    //             c,
    //         ]);
    //         await updateBranch(store, b1);

    //         setPassword.next({
    //             branch: 'testBranch',
    //             oldPassword: '3342',
    //             newPassword: 'newPassword',
    //         });

    //         await waitAsync();

    //         const storedSettings = await store.getBranchSettings('testBranch');

    //         expect(
    //             verifyPassword('newPassword', storedSettings.passwordHash)
    //         ).toBe(true);
    //     });

    //     it('should not be able to set the password of a branch if the old password is wrong', async () => {
    //         server.init();

    //         const device = new MemoryConnection(device1Info);
    //         const setPassword = new Subject<SetBranchPasswordEvent>();
    //         device.events.set(SET_BRANCH_PASSWORD, setPassword);

    //         connections.connection.next(device);
    //         await waitAsync();

    //         const a1 = atom(atomId('a', 1), null, {});
    //         const a2 = atom(atomId('a', 2), a1, {});

    //         const idx = index(a1, a2);
    //         const c = commit('message', new Date(2019, 9, 4), idx, null);
    //         const b1 = branch('testBranch', c);
    //         const hash1 = hashPassword('password1');
    //         const settings = branchSettings('testBranch', hash1);
    //         await store.saveSettings(settings);

    //         await storeData(store, 'testBranch', idx.data.hash, [
    //             a1,
    //             a2,
    //             idx,
    //             c,
    //         ]);
    //         await updateBranch(store, b1);

    //         setPassword.next({
    //             branch: 'testBranch',
    //             oldPassword: 'wrong',
    //             newPassword: 'newPassword',
    //         });

    //         await waitAsync();

    //         const storedSettings = await store.getBranchSettings('testBranch');

    //         expect(
    //             verifyPassword('newPassword', storedSettings.passwordHash)
    //         ).toBe(false);
    //     });

    //     it('should not allow adding atoms when the password was changed while authenticated', async () => {
    //         server.init();

    //         const device = new MemoryConnection(device1Info);
    //         const device2 = new MemoryConnection(device2Info);

    //         const addAtoms = new Subject<AddAtomsEvent>();
    //         const authenticate = new Subject<AuthenticateBranchWritesEvent>();
    //         const setPassword = new Subject<SetBranchPasswordEvent>();
    //         const joinBranch = new Subject<WatchBranchEvent>();
    //         device.events.set(ADD_ATOMS, addAtoms);
    //         device.events.set(AUTHENTICATE_BRANCH_WRITES, authenticate);
    //         device.events.set(WATCH_BRANCH, joinBranch);

    //         device2.events.set(SET_BRANCH_PASSWORD, setPassword);

    //         connections.connection.next(device);
    //         connections.connection.next(device2);

    //         const a1 = atom(atomId('a', 1), null, {});
    //         const a2 = atom(atomId('a', 2), a1, {});
    //         const a3 = atom(atomId('a', 3), a2, {});

    //         const idx = index(a1, a2);
    //         const c = commit('message', new Date(2019, 9, 4), idx, null);
    //         const hash1 = hashPassword('password');
    //         const settings = branchSettings('testBranch', hash1);
    //         await store.saveSettings(settings);
    //         const b = branch('testBranch', c);

    //         await storeData(store, 'testBranch', idx.data.hash, [
    //             a1,
    //             a2,
    //             idx,
    //             c,
    //         ]);
    //         await updateBranch(store, b);

    //         joinBranch.next({
    //             branch: 'testBranch',
    //         });

    //         await waitAsync();

    //         authenticate.next({
    //             branch: 'testBranch',
    //             password: 'password',
    //         });

    //         await waitAsync();

    //         setPassword.next({
    //             branch: 'testBranch',
    //             oldPassword: 'password',
    //             newPassword: 'different',
    //         });

    //         await waitAsync();

    //         addAtoms.next({
    //             branch: 'testBranch',
    //             atoms: [a3],
    //         });

    //         await waitAsync();

    //         const repoAtom = await store.getObject(a3.hash);
    //         expect(repoAtom).toEqual(null);

    //         expect(device.messages.slice(1)).toEqual([
    //             {
    //                 name: AUTHENTICATED_TO_BRANCH,
    //                 data: {
    //                     branch: 'testBranch',
    //                     authenticated: true,
    //                 },
    //             },

    //             // Disconnected because the password changed
    //             {
    //                 name: AUTHENTICATED_TO_BRANCH,
    //                 data: {
    //                     branch: 'testBranch',
    //                     authenticated: false,
    //                 },
    //             },
    //             // Server should send a atoms received event
    //             // back indicating which atoms it processed
    //             // in this case, no atoms were accepted
    //             {
    //                 name: ATOMS_RECEIVED,
    //                 data: {
    //                     branch: 'testBranch',
    //                     hashes: [],
    //                 },
    //             },
    //         ]);
    //     });
    // });

    // describe(AUTHENTICATE_BRANCH_WRITES, () => {
    //     it('should respond with an message indicating that the password was wrong', async () => {
    //         server.init();

    //         const device = new MemoryConnection(device1Info);
    //         const authenticate = new Subject<AuthenticateBranchWritesEvent>();
    //         device.events.set(AUTHENTICATE_BRANCH_WRITES, authenticate);

    //         connections.connection.next(device);
    //         await waitAsync();

    //         const a1 = atom(atomId('a', 1), null, {});
    //         const a2 = atom(atomId('a', 2), a1, {});

    //         const idx = index(a1, a2);
    //         const c = commit('message', new Date(2019, 9, 4), idx, null);
    //         const b1 = branch('testBranch', c);
    //         const hash1 = hashPassword('password1');
    //         const settings = branchSettings('testBranch', hash1);
    //         await store.saveSettings(settings);

    //         await storeData(store, 'testBranch', idx.data.hash, [
    //             a1,
    //             a2,
    //             idx,
    //             c,
    //         ]);
    //         await updateBranch(store, b1);

    //         authenticate.next({
    //             branch: 'testBranch',
    //             password: 'wrong',
    //         });

    //         await waitAsync();

    //         expect(device.messages).toEqual([
    //             {
    //                 name: AUTHENTICATED_TO_BRANCH,
    //                 data: {
    //                     branch: 'testBranch',
    //                     authenticated: false,
    //                 },
    //             },
    //         ]);
    //     });

    //     it('should be able to authenticate to branches without passwords by using 3342 as the password', async () => {
    //         server.init();

    //         const device = new MemoryConnection(device1Info);
    //         const authenticate = new Subject<AuthenticateBranchWritesEvent>();
    //         device.events.set(AUTHENTICATE_BRANCH_WRITES, authenticate);

    //         connections.connection.next(device);
    //         await waitAsync();

    //         const a1 = atom(atomId('a', 1), null, {});
    //         const a2 = atom(atomId('a', 2), a1, {});

    //         const idx = index(a1, a2);
    //         const c = commit('message', new Date(2019, 9, 4), idx, null);
    //         const b1 = branch('testBranch', c);

    //         await storeData(store, 'testBranch', idx.data.hash, [
    //             a1,
    //             a2,
    //             idx,
    //             c,
    //         ]);
    //         await updateBranch(store, b1);

    //         authenticate.next({
    //             branch: 'testBranch',
    //             password: '3342',
    //         });

    //         await waitAsync();

    //         expect(device.messages).toEqual([
    //             {
    //                 name: AUTHENTICATED_TO_BRANCH,
    //                 data: {
    //                     branch: 'testBranch',
    //                     authenticated: true,
    //                 },
    //             },
    //         ]);
    //     });
    // });

    // describe(DEVICES, () => {
    //     it('should send a response with the list of devices', async () => {
    //         server.init();

    //         const device = new MemoryConnection(device1Info);
    //         const device2 = new MemoryConnection(device2Info);
    //         const devices = new Subject<string>();
    //         device.events.set(DEVICES, devices);

    //         connections.connection.next(device);
    //         connections.connection.next(device2);
    //         await waitAsync();

    //         devices.next(null);
    //         await waitAsync();

    //         expect(device.messages).toEqual([
    //             {
    //                 name: DEVICES,
    //                 data: {
    //                     devices: [device1Info, device2Info],
    //                 },
    //             },
    //         ]);
    //     });

    //     it('should send a response with the list of devices that are connected to the given branch', async () => {
    //         server.init();

    //         const device = new MemoryConnection(device1Info);
    //         const device2 = new MemoryConnection(device2Info);
    //         const device3 = new MemoryConnection(device3Info);
    //         const devices = new Subject<string>();
    //         const watchBranch2 = new Subject<WatchBranchEvent>();
    //         const watchBranch3 = new Subject<WatchBranchEvent>();
    //         device.events.set(DEVICES, devices);
    //         device2.events.set(WATCH_BRANCH, watchBranch2);
    //         device3.events.set(WATCH_BRANCH, watchBranch3);

    //         connections.connection.next(device);
    //         connections.connection.next(device2);
    //         connections.connection.next(device3);

    //         await waitAsync();

    //         const a1 = atom(atomId('a', 1), null, {});
    //         const a2 = atom(atomId('a', 2), a1, {});
    //         const a3 = atom(atomId('a', 3), a2, {});
    //         const a4 = atom(atomId('a', 4), a2, {});
    //         const a5 = atom(atomId('a', 5), a2, {});
    //         const a6 = atom(atomId('a', 6), a2, {});

    //         const idx1 = index(a1, a2, a3);
    //         const idx2 = index(a1, a2, a4, a5);
    //         const c1 = commit('message', new Date(2019, 9, 4), idx1, null);
    //         const c2 = commit('message2', new Date(2019, 9, 4), idx2, c1);
    //         const b = branch('testBranch', c2);

    //         await storeData(store, 'testBranch', idx1.data.hash, [
    //             a1,
    //             a2,
    //             a3,
    //             idx1,
    //         ]);
    //         await storeData(store, 'testBranch', idx2.data.hash, [
    //             a1,
    //             a2,
    //             a4,
    //             a5,
    //             idx2,
    //         ]);
    //         await storeData(store, 'testBranch', null, [c1, c2]);
    //         await updateBranch(store, b);

    //         watchBranch2.next({
    //             branch: 'testBranch',
    //         });
    //         watchBranch3.next({
    //             branch: 'testBranch',
    //         });

    //         await waitAsync();

    //         devices.next('testBranch');
    //         await waitAsync();

    //         expect(device.messages).toEqual([
    //             {
    //                 name: DEVICES,
    //                 data: {
    //                     devices: [device2Info, device3Info],
    //                 },
    //             },
    //         ]);
    //     });
    // });

    describe('webhook()', () => {
        it('should return 200 if the webhook is handled', async () => {
            const randomMock = (Math.random = jest.fn());
            randomMock.mockReturnValueOnce(0);

            await server.connect(device1Info);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});

            await atomStore.saveAtoms(branchNamespace('testBranch'), [a1, a2]);

            await server.watchBranch(device1Info.connectionId, {
                branch: 'testBranch',
            });

            const result = await server.webhook(
                'testBranch',
                'method',
                'url',
                {
                    'Content-Type': 'application/json',
                },
                {
                    value: 'anything',
                }
            );

            expect(result).toEqual(200);
            expect(messenger.getMessages(device1Info.connectionId)).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'testBranch',
                        atoms: [a1, a2],
                        initial: true,
                    },
                },
                {
                    name: RECEIVE_EVENT,
                    data: {
                        branch: 'testBranch',
                        action: action(ON_WEBHOOK_ACTION_NAME, null, null, {
                            method: 'method',
                            url: 'url',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            data: {
                                value: 'anything',
                            },
                        }),
                    },
                },
            ]);
        });

        it('should return 404 if there are no atoms in the branch', async () => {
            const randomMock = (Math.random = jest.fn());
            randomMock.mockReturnValueOnce(0);

            await server.connect(device1Info);

            await server.watchBranch(device1Info.connectionId, {
                branch: 'testBranch',
            });

            const result = await server.webhook(
                'testBranch',
                'method',
                'url',
                {
                    'Content-Type': 'application/json',
                },
                {
                    value: 'anything',
                }
            );

            expect(result).toEqual(404);
            expect(messenger.getMessages(device1Info.connectionId)).toEqual([
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

        it('should return 503 if there are no connected devices', async () => {
            const randomMock = (Math.random = jest.fn());
            randomMock.mockReturnValueOnce(0);

            await server.connect(device1Info);

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});

            await atomStore.saveAtoms(branchNamespace('testBranch'), [a1, a2]);

            const result = await server.webhook(
                'testBranch',
                'method',
                'url',
                {
                    'Content-Type': 'application/json',
                },
                {
                    value: 'anything',
                }
            );

            expect(result).toEqual(503);
            expect(messenger.getMessages(device1Info.connectionId)).toEqual([]);
        });
    });

    describe('isEventForDevice()', () => {
        const usernameCases = [
            [true, 'matches', 'username', 'username'] as const,
            [false, 'does not match', 'username', 'no match'] as const,
        ];

        it.each(usernameCases)(
            'should return %s if the username %s',
            (expected, desc, deviceUsername, eventUsername) => {
                let device: DeviceConnection = {
                    connectionId: 'connection',
                    username: deviceUsername,
                    sessionId: 'sessionId',
                    token: 'abc',
                };

                expect(
                    isEventForDevice(
                        <any>{
                            type: 'remote',
                            event: null,
                            username: eventUsername,
                        },
                        device
                    )
                ).toBe(expected);
            }
        );

        const sessionIdCases = [
            [true, 'matches', 'sessionId', 'sessionId'] as const,
            [false, 'does not match', 'sessionId', 'no match'] as const,
        ];

        it.each(sessionIdCases)(
            'should return %s if the session ID %s',
            (expected, desc, deviceSessionId, eventSessionId) => {
                let device: DeviceConnection = {
                    connectionId: 'connection',
                    username: 'username',
                    token: 'abc',
                    sessionId: deviceSessionId,
                };

                expect(
                    isEventForDevice(
                        <any>{
                            type: 'remote',
                            event: null,
                            sessionId: eventSessionId,
                        },
                        device
                    )
                ).toBe(expected);
            }
        );

        const deviceIdCases = [
            [true, 'matches', 'deviceId', 'deviceId'] as const,
            [false, 'does not match', 'deviceId', 'no match'] as const,
        ];

        it.each(deviceIdCases)(
            'should return %s if the device ID %s',
            (expected, desc, deviceId, eventDeviceId) => {
                let device: DeviceConnection = {
                    connectionId: 'connection',
                    username: deviceId,
                    sessionId: 'sessionId',
                    token: 'abc',
                };

                expect(
                    isEventForDevice(
                        <any>{
                            type: 'remote',
                            event: null,
                            deviceId: eventDeviceId,
                        },
                        device
                    )
                ).toBe(expected);
            }
        );

        it('should return true if broadcast is true', () => {
            let device: DeviceConnection = {
                connectionId: 'connection',
                username: 'username',
                sessionId: 'sessionId',
                token: 'abc',
            };
            expect(
                isEventForDevice(
                    <any>{
                        type: 'remote',
                        event: null,
                        broadcast: true,
                    },
                    device
                )
            ).toBe(true);
        });
    });
});

describe('branchNamespace()', () => {
    it('should use the default namespace for branches', () => {
        expect(branchNamespace('testBranch')).toMatchInlineSnapshot(
            `"/branch/testBranch"`
        );
    });
});
