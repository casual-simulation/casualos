import { CausalRepoClient } from './CausalRepoClient';
import { MemoryConnectionClient } from './MemoryConnectionClient';
import {
    WATCH_BRANCH,
    Atom,
    AddAtomsEvent,
    ADD_ATOMS,
    AtomsReceivedEvent,
    ATOMS_RECEIVED,
} from '@casual-simulation/causal-trees/core2';
import { Subject } from 'rxjs';
import { waitAsync } from '../causal-tree-server/test/TestHelpers';
import { atomId, atom } from '@casual-simulation/causal-trees/core2';

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
                    data: 'abc',
                },
            ]);
        });

        it('should return an observable of atoms for the branch', async () => {
            const addAtoms = new Subject<AddAtomsEvent>();
            connection.events.set(ADD_ATOMS, addAtoms);

            let atoms = [] as Atom<any>[];
            connection.connect();
            client.watchBranch('abc').subscribe(a => atoms.push(...a));

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

        it('should send a watch branch event after disconnecting and reconnecting', async () => {
            connection.connect();
            client.watchBranch('abc').subscribe();

            await waitAsync();
            expect(connection.sentMessages).toEqual([
                {
                    name: WATCH_BRANCH,
                    data: 'abc',
                },
            ]);

            connection.disconnect();
            await waitAsync();
            expect(connection.sentMessages).toEqual([
                {
                    name: WATCH_BRANCH,
                    data: 'abc',
                },
            ]);

            connection.connect();
            await waitAsync();
            expect(connection.sentMessages).toEqual([
                {
                    name: WATCH_BRANCH,
                    data: 'abc',
                },
                {
                    name: WATCH_BRANCH,
                    data: 'abc',
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
                    data: 'abc',
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
                    data: 'abc',
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
    });

    describe('forcedOffline', () => {
        it('should disconnect when set set to true', async () => {
            let states = [] as boolean[];
            connection.connectionState.subscribe(state => states.push(state));

            connection.connect();
            client.forcedOffline = true;

            await waitAsync();

            expect(states).toEqual([false, true, false]);
        });

        it('should reconnect when set set back to false', async () => {
            let states = [] as boolean[];
            connection.connectionState.subscribe(state => states.push(state));

            connection.connect();
            client.forcedOffline = true;
            client.forcedOffline = false;

            await waitAsync();

            expect(states).toEqual([false, true, false, true]);
        });
    });
});
