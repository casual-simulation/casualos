import { atom, atomId } from '../Atom2';
import { repoAtom, repoCommit, repoBranch } from '../CausalRepoObject';
import { CausalRepoStore } from '../CausalRepoStore';

export default function causalRepoStoreTests(
    createStore: () => CausalRepoStore
) {
    let store: CausalRepoStore;
    beforeEach(() => {
        store = createStore();
    });

    describe('get/store objects', () => {
        it('should be able to load stored atoms', async () => {
            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const objs = [repoAtom(a1), repoAtom(a2)];

            await store.storeObjects('head', objs);

            const results = await store.getObjects('head', [a2.hash, a1.hash]);

            expect(results).toEqual([repoAtom(a2), repoAtom(a1)]);
        });

        it('should be able to load stored commits', async () => {
            const commit = repoCommit(
                'message',
                new Date(2019, 9, 4),
                'hash',
                null
            );
            const objs = [commit];

            await store.storeObjects('head', objs);

            const results = await store.getObjects('head', [commit.hash]);

            expect(results).toEqual([commit]);
        });

        it('should only load atoms that were stored with the right head', async () => {
            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const objs = [repoAtom(a1), repoAtom(a2)];

            await store.storeObjects('head', objs);

            const results = await store.getObjects('wrong', [a2.hash, a1.hash]);

            expect(results).toEqual([undefined, undefined]);
        });
    });

    describe('branches', () => {
        it('should be able to save and load branches', async () => {
            const b1 = repoBranch('my-repo/master', 'hash1');
            const b2 = repoBranch('my-repo/other', 'hash2');
            const b3 = repoBranch('it-repo/master', 'hash3');
            const b4 = repoBranch('it-repo/abc', 'hash4');

            await store.saveBranch(b1);
            await store.saveBranch(b2);
            await store.saveBranch(b3);
            await store.saveBranch(b4);

            let branches = await store.getBranches('my-repo');

            expect(branches).toEqual([b1, b2]);

            branches = await store.getBranches('it-repo');

            // should sort by branch name
            expect(branches).toEqual([b4, b3]);
        });

        it('should be able to delete branches', async () => {
            const b1 = repoBranch('my-repo/master', 'hash1');
            const b2 = repoBranch('my-repo/other', 'hash2');

            await store.saveBranch(b1);
            await store.saveBranch(b2);
            await store.deleteBranch(b1);

            let branches = await store.getBranches('my-repo');

            expect(branches).toEqual([b2]);
        });

        it('should be able to update branches', async () => {
            const b1 = repoBranch('my-repo/master', 'hash1');
            const b2 = repoBranch('my-repo/master', 'hash2');

            await store.saveBranch(b1);
            await store.saveBranch(b2);

            let branches = await store.getBranches('my-repo');

            expect(branches).toEqual([b2]);
        });

        it('should load all branches if given a null prefix', async () => {
            const b1 = repoBranch('my-repo/master', 'hash1');
            const b2 = repoBranch('my-repo/other', 'hash2');
            const b3 = repoBranch('it-repo/master', 'hash3');
            const b4 = repoBranch('it-repo/abc', 'hash4');

            await store.saveBranch(b1);
            await store.saveBranch(b2);
            await store.saveBranch(b3);
            await store.saveBranch(b4);

            let branches = await store.getBranches(null);

            // should be sorted by name
            expect(branches).toEqual([b4, b3, b1, b2]);
        });
    });
}
