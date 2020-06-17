import {
    CausalRepoClient,
    isClientAtoms,
    isClientEvent,
} from './CausalRepoClient';
import { MemoryConnectionClient } from './MemoryConnectionClient';
import { Subject } from 'rxjs';
import { waitAsync } from './test/TestHelpers';
import {
    WATCH_BRANCH,
    AddAtomsEvent,
    ADD_ATOMS,
    ATOMS_RECEIVED,
    AtomsReceivedEvent,
    WATCH_BRANCHES,
    LOAD_BRANCH,
    UNLOAD_BRANCH,
    LoadBranchEvent,
    UnloadBranchEvent,
    UNWATCH_BRANCH,
    UNWATCH_BRANCHES,
    WATCH_DEVICES,
    DEVICE_CONNECTED_TO_BRANCH,
    DisconnectedFromBranchEvent,
    ConnectedToBranchEvent,
    DEVICE_DISCONNECTED_FROM_BRANCH,
    UNWATCH_DEVICES,
    ReceiveDeviceActionEvent,
    RECEIVE_EVENT,
    SEND_EVENT,
    BRANCH_INFO,
    BranchInfoEvent,
    BRANCHES,
    BranchesEvent,
    COMMIT,
    WATCH_COMMITS,
    AddCommitsEvent,
    ADD_COMMITS,
    CHECKOUT,
    RESTORE,
    GET_BRANCH,
    DEVICES,
    DevicesEvent,
    WATCH_BRANCH_DEVICES,
    UNWATCH_BRANCH_DEVICES,
} from './CausalRepoEvents';
import { Atom, atom, atomId } from './Atom2';
import { deviceInfo } from '..';
import { filter, map } from 'rxjs/operators';
import {
    DeviceAction,
    device,
    remote,
    DeviceActionResult,
    DeviceActionError,
} from '../core/Event';
import { DeviceInfo } from '../core/DeviceInfo';
import { CausalRepoCommit, index, commit } from '.';

describe('CausalRepoClient', () => {
    let client: CausalRepoClient;
    let connection: MemoryConnectionClient;

    beforeEach(() => {
        connection = new MemoryConnectionClient();
        client = new CausalRepoClient(connection);
    });

    describe('watchBranch()', () => {
        it('should send a watch branch event after connecting', async () => {
            client.watchBranch('abc').subscribe();

            expect(connection.sentMessages).toEqual([]);

            connection.connect();
            await waitAsync();

            expect(connection.sentMessages).toEqual([
                {
                    name: WATCH_BRANCH,
                    data: {
                        branch: 'abc',
                    },
                },
            ]);
        });

        it('should return an observable of atoms for the branch', async () => {
            const addAtoms = new Subject<AddAtomsEvent>();
            connection.events.set(ADD_ATOMS, addAtoms);

            let atoms = [] as Atom<any>[];
            connection.connect();
            client
                .watchBranch('abc')
                .pipe(
                    filter(isClientAtoms),
                    map(e => e.atoms)
                )
                .subscribe(a => atoms.push(...a));

            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const b1 = atom(atomId('b', 1), null, {});
            const b2 = atom(atomId('b', 2), a1, {});

            addAtoms.next({
                branch: 'abc',
                atoms: [a1, a2],
            });

            addAtoms.next({
                branch: 'other',
                atoms: [b1, b2],
            });

            await waitAsync();

            expect(atoms).toEqual([a1, a2]);
        });

        it('should return an observable of removed atoms for the branch', async () => {
            const removeAtoms = new Subject<AddAtomsEvent>();
            connection.events.set(ADD_ATOMS, removeAtoms);

            let hashes = [] as string[];
            connection.connect();
            client
                .watchBranch('abc')
                .pipe(
                    filter(isClientAtoms),
                    map(e => e.removedAtoms || [])
                )
                .subscribe(a => hashes.push(...a));

            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const b1 = atom(atomId('b', 1), null, {});
            const b2 = atom(atomId('b', 2), a1, {});

            removeAtoms.next({
                branch: 'abc',
                removedAtoms: [a1.hash, a2.hash],
            });

            removeAtoms.next({
                branch: 'other',
                removedAtoms: [b1.hash, b2.hash],
            });

            await waitAsync();

            expect(hashes).toEqual([a1.hash, a2.hash]);
        });

        it('should return an observable of events for the branch', async () => {
            const receiveEvent = new Subject<ReceiveDeviceActionEvent>();
            connection.events.set(RECEIVE_EVENT, receiveEvent);

            let events = [] as (
                | DeviceAction
                | DeviceActionResult
                | DeviceActionError)[];
            connection.connect();
            client
                .watchBranch('abc')
                .pipe(
                    filter(isClientEvent),
                    map(e => e.action)
                )
                .subscribe(a => events.push(a));

            await waitAsync();

            const info = deviceInfo('username', 'deviceId', 'sessionId');

            receiveEvent.next({
                branch: 'abc',
                action: device(info, {
                    type: 'abc',
                }),
            });

            receiveEvent.next({
                branch: 'other',
                action: device(info, {
                    type: 'wrong',
                }),
            });

            await waitAsync();

            expect(events).toEqual([
                device(info, {
                    type: 'abc',
                }),
            ]);
        });

        it('should send a watch branch event after disconnecting and reconnecting', async () => {
            connection.connect();
            client.watchBranch('abc').subscribe();

            await waitAsync();
            expect(connection.sentMessages).toEqual([
                {
                    name: WATCH_BRANCH,
                    data: {
                        branch: 'abc',
                    },
                },
            ]);

            connection.disconnect();
            await waitAsync();
            expect(connection.sentMessages).toEqual([
                {
                    name: WATCH_BRANCH,
                    data: {
                        branch: 'abc',
                    },
                },
            ]);

            connection.connect();
            await waitAsync();
            expect(connection.sentMessages).toEqual([
                {
                    name: WATCH_BRANCH,
                    data: {
                        branch: 'abc',
                    },
                },
                {
                    name: WATCH_BRANCH,
                    data: {
                        branch: 'abc',
                    },
                },
            ]);
        });

        it('should remember atoms that were sent to the branch and resend them after reconnecting if they were not acknowledged', async () => {
            const atomsReceived = new Subject<AtomsReceivedEvent>();
            connection.events.set(ATOMS_RECEIVED, atomsReceived);
            connection.connect();
            client.watchBranch('abc').subscribe();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), null, {});
            const a3 = atom(atomId('a', 3), null, {});
            client.addAtoms('abc', [a1, a2, a3]);

            atomsReceived.next({
                branch: 'abc',
                hashes: [a1.hash],
            });

            connection.disconnect();
            await waitAsync();

            expect(connection.sentMessages).toEqual([
                {
                    name: WATCH_BRANCH,
                    data: {
                        branch: 'abc',
                    },
                },
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'abc',
                        atoms: [a1, a2, a3],
                    },
                },
            ]);

            connection.connect();
            await waitAsync();

            expect(connection.sentMessages.slice(2)).toEqual([
                {
                    name: WATCH_BRANCH,
                    data: {
                        branch: 'abc',
                    },
                },
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'abc',
                        atoms: [a2, a3],
                    },
                },
            ]);
        });

        it('should remember atoms that were removed from the branch and resend them after reconnecting if they were not acknowledged', async () => {
            const atomsReceived = new Subject<AtomsReceivedEvent>();
            connection.events.set(ATOMS_RECEIVED, atomsReceived);
            connection.connect();
            client.watchBranch('abc').subscribe();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), null, {});
            const a3 = atom(atomId('a', 3), null, {});
            client.addAtoms('abc', null, [a1.hash, a2.hash, a3.hash]);

            atomsReceived.next({
                branch: 'abc',
                hashes: [a1.hash],
            });

            connection.disconnect();
            await waitAsync();

            expect(connection.sentMessages).toEqual([
                {
                    name: WATCH_BRANCH,
                    data: {
                        branch: 'abc',
                    },
                },
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'abc',
                        removedAtoms: [a1.hash, a2.hash, a3.hash],
                    },
                },
            ]);

            connection.connect();
            await waitAsync();

            expect(connection.sentMessages.slice(2)).toEqual([
                {
                    name: WATCH_BRANCH,
                    data: {
                        branch: 'abc',
                    },
                },
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'abc',
                        removedAtoms: [a2.hash, a3.hash],
                    },
                },
            ]);
        });

        it('should allow the first list of atoms even if it is empty', async () => {
            const addAtoms = new Subject<AddAtomsEvent>();
            connection.events.set(ADD_ATOMS, addAtoms);

            let atoms = [] as Atom<any>[][];
            connection.connect();
            client
                .watchBranch('abc')
                .pipe(
                    filter(isClientAtoms),
                    map(e => e.atoms)
                )
                .subscribe(a => atoms.push(a));

            await waitAsync();

            addAtoms.next({
                branch: 'abc',
                atoms: [],
            });

            await waitAsync();

            expect(atoms).toEqual([[]]);
        });

        it('should send a unwatch branch event when unsubscribed', async () => {
            const sub = client.watchBranch('abc').subscribe();

            connection.connect();
            await waitAsync();

            sub.unsubscribe();
            await waitAsync();

            expect(connection.sentMessages).toEqual([
                {
                    name: WATCH_BRANCH,
                    data: {
                        branch: 'abc',
                    },
                },
                {
                    name: UNWATCH_BRANCH,
                    data: 'abc',
                },
            ]);
        });

        it('should allow connecting to temporary branches', async () => {
            const sub = client
                .watchBranch({
                    branch: 'abc',
                    temporary: true,
                })
                .subscribe();

            connection.connect();
            await waitAsync();

            sub.unsubscribe();
            await waitAsync();

            expect(connection.sentMessages).toEqual([
                {
                    name: WATCH_BRANCH,
                    data: {
                        branch: 'abc',
                        temporary: true,
                    },
                },
                {
                    name: UNWATCH_BRANCH,
                    data: 'abc',
                },
            ]);
        });

        it('should resend all atoms after connecting if the branch is temporary', async () => {
            const atomsReceived = new Subject<AtomsReceivedEvent>();
            connection.events.set(ATOMS_RECEIVED, atomsReceived);
            connection.connect();
            client
                .watchBranch({
                    branch: 'abc',
                    temporary: true,
                })
                .subscribe();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), null, {});
            const a3 = atom(atomId('a', 3), null, {});
            client.addAtoms('abc', [a1, a2, a3]);

            atomsReceived.next({
                branch: 'abc',
                hashes: [a1.hash],
            });

            connection.disconnect();
            await waitAsync();

            expect(connection.sentMessages).toEqual([
                {
                    name: WATCH_BRANCH,
                    data: {
                        branch: 'abc',
                        temporary: true,
                    },
                },
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'abc',
                        atoms: [a1, a2, a3],
                    },
                },
            ]);

            connection.connect();
            await waitAsync();

            expect(connection.sentMessages.slice(2)).toEqual([
                {
                    name: WATCH_BRANCH,
                    data: {
                        branch: 'abc',
                        temporary: true,
                    },
                },
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'abc',
                        atoms: [a1, a2, a3],
                    },
                },
            ]);
        });
    });

    describe('getBranch()', () => {
        it('should send a get branch event after connecting', async () => {
            client.getBranch('abc').subscribe();

            expect(connection.sentMessages).toEqual([]);

            connection.connect();
            await waitAsync();

            expect(connection.sentMessages).toEqual([
                {
                    name: GET_BRANCH,
                    data: 'abc',
                },
            ]);
        });

        it('should return an observable of atoms for the branch', async () => {
            const addAtoms = new Subject<AddAtomsEvent>();
            connection.events.set(ADD_ATOMS, addAtoms);

            let atoms = [] as Atom<any>[];
            connection.connect();
            client.getBranch('abc').subscribe(a => atoms.push(...a));

            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const b1 = atom(atomId('b', 1), null, {});
            const b2 = atom(atomId('b', 2), a1, {});

            addAtoms.next({
                branch: 'abc',
                atoms: [a1, a2],
            });

            addAtoms.next({
                branch: 'other',
                atoms: [b1, b2],
            });

            await waitAsync();

            expect(atoms).toEqual([a1, a2]);
        });

        it('should finish after the first add atoms event for the branch', async () => {
            const addAtoms = new Subject<AddAtomsEvent>();
            connection.events.set(ADD_ATOMS, addAtoms);

            let atoms = [] as Atom<any>[];
            let finished = false;
            connection.connect();
            client
                .getBranch('abc')
                .subscribe(
                    a => atoms.push(...a),
                    err => {},
                    () => (finished = true)
                );

            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a1, {});
            const b1 = atom(atomId('b', 1), null, {});
            const b2 = atom(atomId('b', 2), a1, {});

            addAtoms.next({
                branch: 'other',
                atoms: [b1, b2],
            });

            await waitAsync();

            expect(finished).toBe(false);

            addAtoms.next({
                branch: 'abc',
                atoms: [a1, a2],
            });

            await waitAsync();

            expect(finished).toBe(true);

            addAtoms.next({
                branch: 'abc',
                atoms: [a3],
            });

            await waitAsync();

            expect(atoms).toEqual([a1, a2]);
        });
    });

    describe('addAtoms()', () => {
        it('should send a add atoms event', async () => {
            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            client.addAtoms('abc', [a1, a2]);

            expect(connection.sentMessages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'abc',
                        atoms: [a1, a2],
                    },
                },
            ]);
        });

        it('should send removed atoms in the event', async () => {
            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            client.addAtoms('abc', undefined, [a1.hash, a2.hash]);

            expect(connection.sentMessages).toEqual([
                {
                    name: ADD_ATOMS,
                    data: {
                        branch: 'abc',
                        removedAtoms: [a1.hash, a2.hash],
                    },
                },
            ]);
        });
    });

    describe('commit()', () => {
        it('should send a commit event', async () => {
            client.commit('abc', 'newCommit');

            expect(connection.sentMessages).toEqual([
                {
                    name: COMMIT,
                    data: {
                        branch: 'abc',
                        message: 'newCommit',
                    },
                },
            ]);
        });
    });

    describe('checkout()', () => {
        it('should send a checkout event', async () => {
            client.checkout('abc', 'commit');

            expect(connection.sentMessages).toEqual([
                {
                    name: CHECKOUT,
                    data: {
                        branch: 'abc',
                        commit: 'commit',
                    },
                },
            ]);
        });
    });

    describe('restore()', () => {
        it('should send a restore event', async () => {
            client.restore('abc', 'commit');

            expect(connection.sentMessages).toEqual([
                {
                    name: RESTORE,
                    data: {
                        branch: 'abc',
                        commit: 'commit',
                    },
                },
            ]);
        });
    });

    describe('watchCommits()', () => {
        it('should send a watch commits event after connecting', async () => {
            client.watchCommits('abc').subscribe();

            expect(connection.sentMessages).toEqual([]);

            connection.connect();
            await waitAsync();

            expect(connection.sentMessages).toEqual([
                {
                    name: WATCH_COMMITS,
                    data: 'abc',
                },
            ]);
        });

        it('should return an observable of commits for the branch', async () => {
            const addCommits = new Subject<AddCommitsEvent>();
            connection.events.set(ADD_COMMITS, addCommits);

            let commits = [] as CausalRepoCommit[];
            connection.connect();
            client
                .watchCommits('abc')
                .pipe(map(e => e.commits))
                .subscribe(c => commits.unshift(...c));

            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});
            const b1 = atom(atomId('b', 1), null, {});
            const b2 = atom(atomId('b', 2), a1, {});
            const b3 = atom(atomId('b', 3), b2, {});

            const idx1 = index(a1, a2);
            const idx2 = index(a1, a2, a3);
            const idx3 = index(b1, b2);
            const idx4 = index(b1, b2, b3);
            const c1 = commit('commit1', new Date(1900, 1, 1), idx1, null);
            const c2 = commit('commit2', new Date(1900, 1, 1), idx2, c1);
            const c3 = commit('commit3', new Date(1900, 1, 1), idx3, c2);
            const c4 = commit('commit4', new Date(1900, 1, 1), idx4, c3);

            addCommits.next({
                branch: 'abc',
                commits: [c2, c1],
            });

            addCommits.next({
                branch: 'other',
                commits: [c3, c4],
            });

            await waitAsync();

            expect(commits).toEqual([c2, c1]);
        });
    });

    describe('sendEvent()', () => {
        it('should send the given remote event on the given branch', () => {
            client.sendEvent(
                'abc',
                remote(
                    {
                        type: 'def',
                    },
                    {
                        sessionId: 'session',
                    }
                )
            );

            expect(connection.sentMessages).toEqual([
                {
                    name: SEND_EVENT,
                    data: {
                        branch: 'abc',
                        action: remote(
                            {
                                type: 'def',
                            },
                            {
                                sessionId: 'session',
                            }
                        ),
                    },
                },
            ]);
        });
    });

    describe('forcedOffline', () => {
        it('should disconnect when set set to true', async () => {
            let states = [] as boolean[];
            connection.connectionState.subscribe(state =>
                states.push(state.connected)
            );

            connection.connect();
            client.forcedOffline = true;

            await waitAsync();

            expect(states).toEqual([false, true, false]);
        });

        it('should reconnect when set set back to false', async () => {
            let states = [] as boolean[];
            connection.connectionState.subscribe(state =>
                states.push(state.connected)
            );

            connection.connect();
            client.forcedOffline = true;
            client.forcedOffline = false;

            await waitAsync();

            expect(states).toEqual([false, true, false, true]);
        });
    });

    describe('watchBranches()', () => {
        it('should send a watch_branches event after connecting', async () => {
            client.watchBranches().subscribe();

            expect(connection.sentMessages).toEqual([]);

            connection.connect();
            await waitAsync();

            expect(connection.sentMessages).toEqual([
                {
                    name: WATCH_BRANCHES,
                    data: undefined,
                },
            ]);
        });

        it('should return an observable of branch loaded/unloaded events', async () => {
            let loadedBranches: string[] = [];
            let unloadedBranches: string[] = [];
            client.watchBranches().subscribe(e => {
                if (e.type === LOAD_BRANCH) {
                    loadedBranches.push(e.branch);
                } else {
                    unloadedBranches.push(e.branch);
                }
            });

            let loadBranch = new Subject<LoadBranchEvent>();
            let unloadBranch = new Subject<UnloadBranchEvent>();
            connection.events.set(LOAD_BRANCH, loadBranch);
            connection.events.set(UNLOAD_BRANCH, unloadBranch);

            connection.connect();
            await waitAsync();

            loadBranch.next({
                branch: 'abc',
            });

            unloadBranch.next({
                branch: 'def',
            });
            await waitAsync();

            expect(loadedBranches).toEqual(['abc']);
            expect(unloadedBranches).toEqual(['def']);
        });

        it('should send a unwatch branches event when unsubscribed', async () => {
            const sub = client.watchBranches().subscribe();

            connection.connect();
            await waitAsync();

            sub.unsubscribe();
            await waitAsync();

            expect(connection.sentMessages).toEqual([
                {
                    name: WATCH_BRANCHES,
                    data: undefined,
                },
                {
                    name: UNWATCH_BRANCHES,
                    data: undefined,
                },
            ]);
        });
    });

    describe('watchDevices()', () => {
        it('should send a watch devices event after connecting', async () => {
            client.watchDevices().subscribe();

            expect(connection.sentMessages).toEqual([]);

            connection.connect();
            await waitAsync();

            expect(connection.sentMessages).toEqual([
                {
                    name: WATCH_DEVICES,
                    data: undefined,
                },
            ]);
        });

        it('should return an observable of connected/disconnected events', async () => {
            let connections: ConnectedToBranchEvent[] = [];
            let disconnections: DisconnectedFromBranchEvent[] = [];
            client.watchDevices().subscribe(e => {
                if (e.type === DEVICE_CONNECTED_TO_BRANCH) {
                    connections.push(e);
                } else {
                    disconnections.push(e);
                }
            });

            let connect = new Subject<ConnectedToBranchEvent>();
            let disconnect = new Subject<DisconnectedFromBranchEvent>();
            connection.events.set(DEVICE_CONNECTED_TO_BRANCH, connect);
            connection.events.set(DEVICE_DISCONNECTED_FROM_BRANCH, disconnect);

            const device1 = deviceInfo('device1', 'device1', 'device1');
            const device2 = deviceInfo('device2', 'device2', 'device2');

            connection.connect();
            await waitAsync();

            connect.next({
                branch: {
                    branch: 'abc',
                },
                device: device1,
            });

            disconnect.next({
                branch: 'def',
                device: device2,
            });
            await waitAsync();

            expect(connections).toEqual([
                {
                    type: DEVICE_CONNECTED_TO_BRANCH,
                    branch: {
                        branch: 'abc',
                    },
                    device: device1,
                },
            ]);
            expect(disconnections).toEqual([
                {
                    type: DEVICE_DISCONNECTED_FROM_BRANCH,
                    branch: 'def',
                    device: device2,
                },
            ]);
        });

        it('should send a unwatch devices event when unsubscribed', async () => {
            const sub = client.watchDevices().subscribe();

            connection.connect();
            await waitAsync();

            sub.unsubscribe();
            await waitAsync();

            expect(connection.sentMessages).toEqual([
                {
                    name: WATCH_DEVICES,
                    data: undefined,
                },
                {
                    name: UNWATCH_DEVICES,
                    data: undefined,
                },
            ]);
        });
    });

    describe('watchBranchDevices()', () => {
        it('should send a watch devices event after connecting', async () => {
            client.watchBranchDevices('testBranch').subscribe();

            expect(connection.sentMessages).toEqual([]);

            connection.connect();
            await waitAsync();

            expect(connection.sentMessages).toEqual([
                {
                    name: WATCH_BRANCH_DEVICES,
                    data: 'testBranch',
                },
            ]);
        });

        it('should return an observable of connected/disconnected events', async () => {
            let connections: ConnectedToBranchEvent[] = [];
            let disconnections: DisconnectedFromBranchEvent[] = [];
            client.watchBranchDevices('testBranch').subscribe(e => {
                if (e.type === DEVICE_CONNECTED_TO_BRANCH) {
                    connections.push(e);
                } else {
                    disconnections.push(e);
                }
            });

            let connect = new Subject<ConnectedToBranchEvent>();
            let disconnect = new Subject<DisconnectedFromBranchEvent>();
            connection.events.set(DEVICE_CONNECTED_TO_BRANCH, connect);
            connection.events.set(DEVICE_DISCONNECTED_FROM_BRANCH, disconnect);

            const device1 = deviceInfo('device1', 'device1', 'device1');
            const device2 = deviceInfo('device2', 'device2', 'device2');

            connection.connect();
            await waitAsync();

            connect.next({
                branch: {
                    branch: 'testBranch',
                },
                device: device1,
            });

            disconnect.next({
                branch: 'testBranch',
                device: device2,
            });
            await waitAsync();

            expect(connections).toEqual([
                {
                    type: DEVICE_CONNECTED_TO_BRANCH,
                    branch: {
                        branch: 'testBranch',
                    },
                    device: device1,
                },
            ]);
            expect(disconnections).toEqual([
                {
                    type: DEVICE_DISCONNECTED_FROM_BRANCH,
                    branch: 'testBranch',
                    device: device2,
                },
            ]);
        });

        it('should send a unwatch devices event when unsubscribed', async () => {
            const sub = client.watchBranchDevices('testBranch').subscribe();

            connection.connect();
            await waitAsync();

            sub.unsubscribe();
            await waitAsync();

            expect(connection.sentMessages).toEqual([
                {
                    name: WATCH_BRANCH_DEVICES,
                    data: 'testBranch',
                },
                {
                    name: UNWATCH_BRANCH_DEVICES,
                    data: 'testBranch',
                },
            ]);
        });

        it('should send device disconnected events for all connected devices when the connection is lost', async () => {
            let connections: ConnectedToBranchEvent[] = [];
            let disconnections: DisconnectedFromBranchEvent[] = [];
            client.watchBranchDevices('testBranch').subscribe(e => {
                if (e.type === DEVICE_CONNECTED_TO_BRANCH) {
                    connections.push(e);
                } else {
                    disconnections.push(e);
                }
            });

            let connect = new Subject<ConnectedToBranchEvent>();
            let disconnect = new Subject<DisconnectedFromBranchEvent>();
            connection.events.set(DEVICE_CONNECTED_TO_BRANCH, connect);
            connection.events.set(DEVICE_DISCONNECTED_FROM_BRANCH, disconnect);

            const device1 = deviceInfo('device1', 'device1', 'device1');
            const device2 = deviceInfo('device2', 'device2', 'device2');

            connection.connect();
            await waitAsync();

            connect.next({
                branch: {
                    branch: 'testBranch',
                },
                device: device1,
            });

            connect.next({
                branch: {
                    branch: 'testBranch',
                },
                device: device2,
            });

            await waitAsync();

            connection.disconnect();

            await waitAsync();

            expect(connections).toEqual([
                {
                    type: DEVICE_CONNECTED_TO_BRANCH,
                    branch: {
                        branch: 'testBranch',
                    },
                    device: device1,
                },
                {
                    type: DEVICE_CONNECTED_TO_BRANCH,
                    branch: {
                        branch: 'testBranch',
                    },
                    device: device2,
                },
            ]);
            expect(disconnections).toEqual([
                {
                    type: DEVICE_DISCONNECTED_FROM_BRANCH,
                    branch: 'testBranch',
                    device: device1,
                },
                {
                    type: DEVICE_DISCONNECTED_FROM_BRANCH,
                    branch: 'testBranch',
                    device: device2,
                },
            ]);
        });
    });

    describe('branchInfo()', () => {
        it('should send a branch info event after connecting', async () => {
            client.branchInfo('abc').subscribe();

            expect(connection.sentMessages).toEqual([]);

            connection.connect();
            await waitAsync();

            expect(connection.sentMessages).toEqual([
                {
                    name: BRANCH_INFO,
                    data: 'abc',
                },
            ]);
        });

        it('should return an observable of info for the branch', async () => {
            const branchInfo = new Subject<BranchInfoEvent>();
            connection.events.set(BRANCH_INFO, branchInfo);

            let infos = [] as BranchInfoEvent[];
            client.branchInfo('abc').subscribe(e => infos.push(e));

            connection.connect();
            await waitAsync();

            branchInfo.next({
                branch: 'def',
                exists: true,
            });
            await waitAsync();

            branchInfo.next({
                branch: 'abc',
                exists: true,
            });
            await waitAsync();

            expect(infos).toEqual([
                {
                    branch: 'abc',
                    exists: true,
                },
            ]);
        });
    });

    describe('branches()', () => {
        it('should send a branches event after connecting', async () => {
            client.branches().subscribe();

            expect(connection.sentMessages).toEqual([]);

            connection.connect();
            await waitAsync();

            expect(connection.sentMessages).toEqual([
                {
                    name: BRANCHES,
                    data: undefined,
                },
            ]);
        });

        it('should return an observable of info for the branches', async () => {
            const branches = new Subject<BranchesEvent>();
            connection.events.set(BRANCHES, branches);

            let infos = [] as BranchesEvent[];
            client.branches().subscribe(e => infos.push(e));

            connection.connect();
            await waitAsync();

            branches.next({
                branches: ['abc', 'def'],
            });
            await waitAsync();

            branches.next({
                branches: ['123'],
            });
            await waitAsync();

            expect(infos).toEqual([
                {
                    branches: ['abc', 'def'],
                },
            ]);
        });
    });

    describe('devices()', () => {
        it('should send a devices event after connecting', async () => {
            client.devices().subscribe();

            expect(connection.sentMessages).toEqual([]);

            connection.connect();
            await waitAsync();

            expect(connection.sentMessages).toEqual([
                {
                    name: DEVICES,
                    data: undefined,
                },
            ]);
        });

        it('should return an observable of device info', async () => {
            const devices = new Subject<DevicesEvent>();
            connection.events.set(DEVICES, devices);

            let infos = [] as DevicesEvent[];
            client.devices().subscribe(e => infos.push(e));

            connection.connect();
            await waitAsync();

            const info1 = deviceInfo('abc', 'abc', 'abc');
            const info2 = deviceInfo('def', 'def', 'def');
            const info3 = deviceInfo('ghi', 'ghi', 'ghi');

            devices.next({
                devices: [info1, info2],
            });
            await waitAsync();

            devices.next({
                devices: [info3],
            });
            await waitAsync();

            expect(infos).toEqual([
                {
                    devices: [info1, info2],
                },
            ]);
        });

        it('should send the given branch name', async () => {
            const devices = new Subject<DevicesEvent>();
            connection.events.set(DEVICES, devices);

            client.devices('haha').subscribe();

            connection.connect();
            await waitAsync();

            expect(connection.sentMessages).toEqual([
                {
                    name: DEVICES,
                    data: 'haha',
                },
            ]);
        });
    });
});
