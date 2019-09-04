import { atomId, atom } from './Atom2';
import {
    index,
    repoCommit,
    commit,
    branch,
    repoAtom,
} from './CausalRepoObject';
import { CausalRepoStore } from './CausalRepoStore';
import { MemoryCausalRepoStore } from './MemoryCausalRepoStore';
import { storeData, loadBranch, loadDiff } from './CausalRepo';
import { createIndex, calculateDiff, createIndexDiff } from './AtomIndex';

describe('CausalRepo', () => {
    let store: CausalRepoStore;
    beforeEach(() => {
        store = new MemoryCausalRepoStore();
    });

    describe('storeData()', () => {
        it('should store the given atoms, indexes, and commits', async () => {
            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});

            const idx = index(a1, a2);

            const c = commit('message', new Date(2019, 9, 4), idx, null);

            await storeData(store, [a1, c, idx, a2]);

            const loaded = await store.getObjects([
                a1.hash,
                a2.hash,
                idx.data.hash,
                c.hash,
            ]);

            expect(loaded).toEqual([repoAtom(a1), repoAtom(a2), idx, c]);
        });
    });

    describe('loadBranch()', () => {
        it('should load the commit and index data for the branch', async () => {
            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});

            const idx = index(a1, a2);

            const c = commit('message', new Date(2019, 9, 4), idx, null);

            await storeData(store, [a1, a2, idx, c]);

            const b = branch('my-repo/master', c);

            const data = await loadBranch(store, b);

            expect(data).toEqual({
                commit: c,
                index: idx,
                atoms: [a1, a2],
            });
        });

        it('should load the index data for the branch', async () => {
            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});

            const idx = index(a1, a2);

            await storeData(store, [a1, a2, idx]);

            const b = branch('my-repo/master', idx);

            const data = await loadBranch(store, b);

            expect(data).toEqual({
                commit: null,
                index: idx,
                atoms: [a1, a2],
            });
        });
    });

    describe('updateBranch()', () => {
        it('', async () => {
            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2);

            const c = commit('message', new Date(2019, 9, 4), idx, null);

            await storeData(store, [a1, a2, idx, c]);

            const b = branch('my-repo/master', c);

            const data = await loadBranch(store, b);

            const update = createIndexDiff([a3]);

            // const update = await updateBranch(b, );

            expect(data).toEqual({
                commit: c,
                index: idx,
                atoms: [a1, a2],
            });
        });
    });

    describe('loadDiff()', () => {
        it('should load the added atoms from the store', async () => {
            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});
            const a4 = atom(atomId('a', 4), a1, {});

            const otherA3 = atom(atomId('a', 3), a1, {});

            const index = createIndex([a1, a2, a3]);
            const index2 = createIndex([a1, otherA3, a4]);

            const diff = calculateDiff(index, index2);

            await storeData(store, [a1, a2, a3, a4, otherA3]);

            const final = await loadDiff(store, diff);

            expect(final).toEqual({
                additions: [otherA3, a4],
                deletions: diff.deletions,
            });
        });
    });
});
