import { CausalRepoClient } from './CausalRepoClient';
import { MemoryConnectionClient } from './MemoryConnectionClient';
import {
    WATCH_BRANCH,
    Atom,
    AddAtomsEvent,
    ADD_ATOMS,
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
        it('should send a watch branch event', () => {
            client.watchBranch('abc').subscribe();

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
});
