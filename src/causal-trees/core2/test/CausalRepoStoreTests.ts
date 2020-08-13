import { atom, atomId } from '../Atom2';
import {
    repoAtom,
    repoCommit,
    repoBranch,
    index,
    branch,
    branchSettings,
} from '../CausalRepoObject';
import { CausalRepoStore } from '../CausalRepoStore';
import { storeData, loadBranch } from '../CausalRepo';

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

        it('should create a reflog for the saved branch', async () => {
            const b1 = repoBranch('my-repo/master', 'hash1');

            await store.saveBranch(b1);

            const b2 = repoBranch('my-repo/master', 'hash2');

            await store.saveBranch(b2);

            let branches = await store.getBranches('my-repo');

            expect(branches).toEqual([b2]);

            let reflog = await store.getReflog('my-repo/master');

            expect(reflog).toEqual([
                {
                    type: 'reflog',
                    branch: 'my-repo/master',
                    hash: 'hash2',
                    time: expect.any(Date),
                },
                {
                    type: 'reflog',
                    branch: 'my-repo/master',
                    hash: 'hash1',
                    time: expect.any(Date),
                },
            ]);
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

    describe('sitelog', () => {
        it('should be able to log that a site was connected to a branch', async () => {
            await store.logSite('test', 'abc1', 'WATCH');
            await store.logSite('test', 'abc2', 'UNWATCH');
            await store.logSite('test', 'abc3', null);

            const log = await store.getSitelog('test');
            expect(log).toEqual([
                {
                    type: 'sitelog',
                    branch: 'test',
                    site: 'abc3',
                    time: expect.any(Date),
                    sitelogType: null,
                },
                {
                    type: 'sitelog',
                    branch: 'test',
                    site: 'abc2',
                    time: expect.any(Date),
                    sitelogType: 'UNWATCH',
                },
                {
                    type: 'sitelog',
                    branch: 'test',
                    site: 'abc1',
                    time: expect.any(Date),
                    sitelogType: 'WATCH',
                },
            ]);
        });
    });

    describe('branch settings', () => {
        it('should be able to save the given settings', async () => {
            await store.saveSettings(branchSettings('test', 'hash'));
            await store.saveSettings(branchSettings('test', 'hash2'));
            await store.saveSettings(branchSettings('test', 'hash3'));

            const settings = await store.getBranchSettings('test');
            expect(settings).toEqual({
                type: 'branch_settings',
                branch: 'test',
                time: expect.any(Date),
                passwordHash: 'hash3',
            });
        });
    });

    it('should be able to load atoms from a store that doesnt implement loadIndex()', async () => {
        store.loadIndex = null;

        const a1 = atom(atomId('a', 1), null, {});
        const a2 = atom(atomId('a', 2), null, {});
        const a3 = atom(atomId('a', 3), null, {});
        const idx = index(a1, a2, a3);

        await storeData(store, 'abc', idx.data.hash, [idx, a3, a1, a2]);

        const data = await loadBranch(store, branch('abc', idx.data.hash));

        expect(data.atoms).toEqual(
            new Map([[a1.hash, a1], [a2.hash, a2], [a3.hash, a3]])
        );
    });
}
