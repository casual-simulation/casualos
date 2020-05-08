import { atomId, atom, atomIdToString } from './Atom2';
import {
    index,
    repoCommit,
    commit,
    branch,
    repoAtom,
    CausalRepoBranch,
    CausalRepoObject,
} from './CausalRepoObject';
import { CausalRepoStore } from './CausalRepoStore';
import { MemoryCausalRepoStore } from './MemoryCausalRepoStore';
import {
    storeData,
    loadBranch,
    loadDiff,
    applyDiff,
    CausalRepo,
    updateBranch,
    listBranches,
    atomMap,
    listCommits,
    calculateCommitDiff,
    CommitData,
    loadCommit,
} from './CausalRepo';
import {
    createIndex,
    calculateDiff,
    createIndexDiff,
    AtomIndexFullDiff,
} from './AtomIndex';
import { Weave } from './Weave2';

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

            await storeData(store, 'head', idx.data.hash, [a1, c, idx, a2]);

            const loaded = await store.getObjects('head', [
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

            await storeData(store, 'my-repo/master', idx.data.hash, [
                a1,
                a2,
                idx,
                c,
            ]);

            const b = branch('my-repo/master', c);

            const data = await loadBranch(store, b);

            expect(data).toEqual({
                commit: c,
                index: idx,
                atoms: atomMap([a1, a2]),
            });
        });

        it('should load the index data for the branch', async () => {
            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});

            const idx = index(a1, a2);

            await storeData(store, 'my-repo/master', idx.data.hash, [
                a1,
                a2,
                idx,
            ]);

            const b = branch('my-repo/master', idx);

            const data = await loadBranch(store, b);

            expect(data).toEqual({
                commit: null,
                index: idx,
                atoms: atomMap([a1, a2]),
            });
        });

        it('should return null if the branch doesnt have a hash', async () => {
            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});

            const idx = index(a1, a2);

            await storeData(store, 'test', idx.data.hash, [a1, a2, idx]);

            const b: CausalRepoBranch = {
                type: 'branch',
                name: 'test',
                hash: null,
            };

            const data = await loadBranch(store, b);

            expect(data).toEqual(null);
        });

        it('should return null if the branch points to a nonexistant ref', async () => {
            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});

            const idx = index(a1, a2);

            await storeData(store, 'test', idx.data.hash, [a1, a2, idx]);

            const b: CausalRepoBranch = {
                type: 'branch',
                name: 'test',
                hash: 'blah',
            };

            const data = await loadBranch(store, b);

            expect(data).toEqual(null);
        });
    });

    describe('updateBranch()', () => {
        it('should save the branch in the store', async () => {
            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});

            const idx = index(a1, a2);

            const c = commit('message', new Date(2019, 9, 4), idx, null);

            await storeData(store, 'my-repo/master', idx.data.hash, [
                a1,
                a2,
                idx,
                c,
            ]);

            const b = branch('my-repo/master', c);

            await updateBranch(store, b);

            const branches = await listBranches(store);

            expect(branches).toEqual([b]);
        });

        it('should update the existing branch', async () => {
            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const idx = index(a1, a2);

            const c = commit('message', new Date(2019, 9, 4), idx, null);

            await storeData(store, 'my-repo/master', idx.data.hash, [
                a1,
                a2,
                idx,
                c,
            ]);

            const b = branch('my-repo/master', c);

            await updateBranch(store, b);

            const idx2 = index(a1, a2, a3);

            const c2 = commit('other', new Date(2019, 9, 4), idx2, c);

            await storeData(store, 'my-repo/master', idx.data.hash, [
                a3,
                idx2,
                c2,
            ]);

            const b2 = branch(b.name, c2);

            await updateBranch(store, b2);

            const branches = await listBranches(store);

            expect(branches).toEqual([b2]);
        });

        it('should throw if the branch references a hash that does not exist', async () => {
            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});

            const idx = index(a1, a2);

            const c = commit('message', new Date(2019, 9, 4), idx, null);

            const b = branch('my-repo/master', c);

            await expect(updateBranch(store, b)).rejects.toBeTruthy();
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

            await storeData(store, 'head', null, [a1, a2, a3, a4, otherA3]);

            const final = await loadDiff(store, diff);

            expect(final).toEqual({
                additions: [otherA3, a4],
                deletions: diff.deletions,
            });
        });
    });

    describe('applyDiff()', () => {
        it('should add the atoms in the diff to the weave', () => {
            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});
            const a4 = atom(atomId('a', 4), a1, {});

            const diff: AtomIndexFullDiff = {
                additions: [a1, a2, a3, a4],
                deletions: {},
            };

            let weave = new Weave();

            applyDiff(weave, diff);

            expect(weave.getAtoms()).toEqual([a1, a4, a2, a3]);
        });

        it('should remove the atoms in the diff from the weave', () => {
            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});
            const a4 = atom(atomId('a', 4), a1, {});

            const diff: AtomIndexFullDiff = {
                additions: [],
                deletions: {
                    [a2.hash]: 'a@2',
                },
            };

            let weave = new Weave();
            weave.insert(a1);
            weave.insert(a2);
            weave.insert(a3);
            weave.insert(a4);

            applyDiff(weave, diff);

            expect(weave.getAtoms()).toEqual([a1, a4]);
        });
    });

    describe('listCommits()', () => {
        it('should return a list of commit data from the given commit hash', async () => {
            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});
            const a4 = atom(atomId('a', 4), a1, {});

            const idx1 = index(a1, a2);
            const idx2 = index(a1, a2, a3, a4);

            const c1 = commit('message1', new Date(2001, 1, 1), idx1, null);
            const c2 = commit('message2', new Date(2001, 1, 2), idx2, c1);

            await storeData(store, 'head', idx1.data.hash, [a1, a2, idx1]);
            await storeData(store, 'head', idx2.data.hash, [
                a1,
                a2,
                a3,
                a4,
                idx2,
            ]);
            await storeData(store, 'head', null, [c1, c2]);

            const commits = await listCommits(store, c2.hash);

            expect(commits).toEqual([c2, c1]);
        });
    });

    describe('calculateCommitDiff()', () => {
        it('should return all the atoms as additions from the second if the first is null', async () => {
            const store = new MemoryCausalRepoStore();
            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), null, {});
            const a3 = atom(atomId('a', 3), null, {});
            const a4 = atom(atomId('a', 4), null, {});

            const idx2 = index(a1, a2, a3, a4);

            const c2 = commit('commit', new Date(1900, 1, 1), idx2, null);

            await storeData(store, 'head', idx2.data.hash, [
                a1,
                a2,
                a3,
                a4,
                idx2,
                c2,
            ]);

            const commit1: CommitData = null;
            const commit2 = await loadCommit(store, 'head', c2);
            const diff = calculateCommitDiff(commit1, commit2);

            expect(diff).toEqual({
                additions: atomMap([a1, a2, a3, a4]),
                deletions: atomMap([]),
            });
        });

        it('should return all the atoms as deletions from the first is the second is null', async () => {
            const store = new MemoryCausalRepoStore();
            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), null, {});
            const a3 = atom(atomId('a', 3), null, {});
            const a4 = atom(atomId('a', 4), null, {});

            const idx2 = index(a1, a2, a3, a4);

            const c2 = commit('commit', new Date(1900, 1, 1), idx2, null);

            await storeData(store, 'head', idx2.data.hash, [
                a1,
                a2,
                a3,
                a4,
                idx2,
                c2,
            ]);

            const commit1 = await loadCommit(store, 'head', c2);
            const commit2: CommitData = null;
            const diff = calculateCommitDiff(commit1, commit2);

            expect(diff).toEqual({
                additions: atomMap([]),
                deletions: atomMap([a1, a2, a3, a4]),
            });
        });

        it('should calculate which atoms were deleted', async () => {
            const store = new MemoryCausalRepoStore();
            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), null, {});
            const a3 = atom(atomId('a', 3), null, {});
            const a4 = atom(atomId('a', 4), null, {});

            const idx1 = index(a1, a2);
            const idx2 = index(a1, a3, a4);

            const c1 = commit('commit1', new Date(1900, 1, 1), idx1, null);
            const c2 = commit('commit2', new Date(1900, 1, 1), idx2, null);

            await storeData(store, 'head', idx1.data.hash, [a1, a2, idx1]);
            await storeData(store, 'head', idx2.data.hash, [
                a1,
                a2,
                a3,
                a4,
                idx2,
            ]);
            await storeData(store, 'head', null, [c1, c2]);

            const commit1 = await loadCommit(store, 'head', c1);
            const commit2 = await loadCommit(store, 'head', c2);
            const diff = calculateCommitDiff(commit1, commit2);

            expect(diff).toEqual({
                additions: atomMap([a3, a4]),
                deletions: atomMap([a2]),
            });
        });
    });

    describe('impl', () => {
        const a1 = atom(atomId('a', 1), null, {});
        const a2 = atom(atomId('a', 2), null, {});

        const idx = index(a1, a2);

        let repo: CausalRepo;
        let store: CausalRepoStore;

        beforeEach(async () => {
            store = new MemoryCausalRepoStore();
            repo = new CausalRepo(store);

            await storeData(store, 'master', idx.data.hash, [idx, a1, a2]);
        });

        it('should start without a head', () => {
            const head = repo.getHead();
            expect(head).toBe(null);
            expect(repo.currentCommit).toBe(null);
        });

        describe('checkout()', () => {
            it('should checkout the given branch', async () => {
                const b = branch('master', idx);

                await store.saveBranch(b);
                await repo.checkout('master');

                expect(repo.getHead()).toEqual(b);
                expect(repo.currentCommit).toEqual({
                    commit: null,
                    index: idx,
                    atoms: atomMap([a1, a2]),
                });
            });

            it('should fill the current atoms list', async () => {
                const b = branch('master', idx);

                await store.saveBranch(b);
                await repo.checkout('master');

                expect(repo.getAtoms()).toEqual([a1, a2]);
            });

            it('should allow creating the branch if it does not exist', async () => {
                await repo.checkout('missing', {
                    createIfDoesntExist: {
                        hash: null,
                    },
                });

                expect(repo.getHead()).toEqual({
                    type: 'branch',
                    name: 'missing',
                    hash: null,
                });
                expect(repo.currentCommit).toEqual(null);
            });
        });

        describe('createBranch()', () => {
            it('should create and checkout a branch', async () => {
                await repo.createBranch('master');

                const head = repo.getHead();
                expect(head).toEqual({
                    type: 'branch',
                    name: 'master',
                    hash: null,
                });
                expect(repo.currentCommit).toBe(null);
            });

            it('should create and checkout the branch at the given hash', async () => {
                await repo.createBranch('master', idx.data.hash);

                const head = repo.getHead();

                expect(head).toEqual({
                    type: 'branch',
                    name: 'master',
                    hash: idx.data.hash,
                });

                const c = repo.currentCommit;
                expect(c).toEqual({
                    commit: null,
                    index: idx,
                    atoms: atomMap([a1, a2]),
                });
            });
        });

        describe('add()', () => {
            it('should start with an empty stage', () => {
                expect(repo.stage).toEqual({
                    additions: [],
                    deletions: {},
                });
            });

            it('should add the given objects to the stage', () => {
                const b1 = atom(atomId('b', 1), null, {});
                const b2 = atom(atomId('b', 2), null, {});

                repo.add(b1, b2);

                expect(repo.stage).toEqual({
                    additions: [b1, b2],
                    deletions: {},
                });
            });

            it('should add the given atom to the current atoms list', async () => {
                const b = branch('master', idx);

                await store.saveBranch(b);
                await repo.checkout('master');
                const b1 = atom(atomId('b', 1), null, {});
                const b2 = atom(atomId('b', 2), null, {});

                repo.add(b1, b2);

                expect(repo.getAtoms()).toEqual([a1, a2, b1, b2]);
            });

            it('should return the atoms that were added', async () => {
                const b = branch('master', idx);

                await store.saveBranch(b);
                await repo.checkout('master');
                const b1 = atom(atomId('b', 1), null, {});
                const b2 = atom(atomId('b', 2), null, {});

                const added = repo.add(b1, a1, b2);

                expect(added).toEqual([b1, b2]);
                expect(repo.getAtoms()).toEqual([a1, a2, b1, b2]);
            });

            it('should not add the object if it is already in the stage', async () => {
                const b = branch('master', idx);

                await store.saveBranch(b);
                await repo.checkout('master');
                const b1 = atom(atomId('b', 1), null, {});
                const b2 = atom(atomId('b', 2), null, {});

                repo.add(b1, a1, b2);
                const added = repo.add(b1);

                expect(added).toEqual([]);
                expect(repo.getAtoms()).toEqual([a1, a2, b1, b2]);
            });

            it('should remove the atom from the stage deletions', async () => {
                const b = branch('master', idx);

                await store.saveBranch(b);
                await repo.checkout('master');
                const b1 = atom(atomId('b', 1), null, {});
                repo.remove(a1.hash);
                const added = repo.add(a1);

                expect(added).toEqual([a1]);
                expect(repo.getAtoms()).toEqual([a2, a1]);
                expect(repo.stage.deletions).toEqual({});
            });
        });

        describe('remove()', () => {
            it('should mark deleted atoms as deleted', async () => {
                const b = branch('master', idx);

                await store.saveBranch(b);
                await repo.checkout('master');
                repo.remove(a1.hash);

                expect(repo.stage).toEqual({
                    additions: [],
                    deletions: {
                        [a1.hash]: atomIdToString(a1.id),
                    },
                });
            });

            it('should remove the atom from the atoms list', async () => {
                const b = branch('master', idx);

                await store.saveBranch(b);
                await repo.checkout('master');
                repo.remove(a1.hash);

                expect(repo.getAtoms()).toEqual([a2]);
            });

            it('should return the atoms that were removed', async () => {
                const b = branch('master', idx);

                await store.saveBranch(b);
                await repo.checkout('master');
                const b1 = atom(atomId('b', 1), null, {});

                const removed = repo.remove(a2.hash, b1.hash, a1.hash);

                expect(removed).toEqual([a2, a1]);
                expect(repo.getAtoms()).toEqual([]);
            });

            it('should remove the atom from the stage if it was added', async () => {
                const b = branch('master', idx);

                await store.saveBranch(b);
                await repo.checkout('master');
                const b1 = atom(atomId('b', 1), null, {});
                repo.add(b1);
                const removed = repo.remove(b1.hash);

                expect(removed).toEqual([b1]);
                expect(repo.getAtoms()).toEqual([a1, a2]);
                expect(repo.stage.additions).toEqual([]);
            });
        });

        describe('hasChanges()', () => {
            it('should return true if the stage has a deleted atom', async () => {
                const b = branch('master', idx);

                await store.saveBranch(b);
                await repo.checkout('master');
                repo.remove(a1.hash);

                expect(repo.hasChanges()).toBe(true);
            });

            it('should return true if the stage has a added atom', async () => {
                const b = branch('master', idx);

                await store.saveBranch(b);
                await repo.checkout('master');
                const b1 = atom(atomId('b', 1), null, {});

                repo.add(b1);

                expect(repo.hasChanges()).toBe(true);
            });

            it('should return false if the stage has no atoms', async () => {
                const b = branch('master', idx);

                await store.saveBranch(b);
                await repo.checkout('master');

                expect(repo.hasChanges()).toBe(false);
            });
        });

        describe('commit()', () => {
            it('should create and store a commit object with the added atoms', async () => {
                const b = branch('master', idx);

                await store.saveBranch(b);
                await repo.checkout('master');
                const b1 = atom(atomId('b', 1), null, {});

                repo.add(b1);
                await repo.commit('test message', new Date(2019, 1, 1));

                const commit = await store.getObject(
                    repo.currentCommit.commit.hash
                );

                expect(commit).toEqual(repo.currentCommit.commit);
                expect(commit).toEqual({
                    type: 'commit',
                    message: 'test message',
                    time: new Date(2019, 1, 1),
                    previousCommit: null,
                    index: expect.any(String),
                    hash: expect.any(String),
                });

                expect(repo.currentCommit.atoms).toEqual(
                    new Map([[a1.hash, a1], [a2.hash, a2], [b1.hash, b1]])
                );
                expect(repo.getAtoms()).toEqual([a1, a2, b1]);
            });

            it('should create and store a commit referencing the previous commit', async () => {
                const prevCommit = commit(
                    'abc',
                    new Date(2019, 1, 1),
                    idx,
                    null
                );
                const b = branch('master', prevCommit);

                await storeData(store, 'master', null, [prevCommit]);
                await store.saveBranch(b);
                await repo.checkout('master');
                const b1 = atom(atomId('b', 1), null, {});

                repo.add(b1);
                await repo.commit('test message', new Date(2019, 1, 1));

                const newCommit = await store.getObject(
                    repo.currentCommit.commit.hash
                );

                expect(newCommit).toEqual({
                    type: 'commit',
                    message: 'test message',
                    time: new Date(2019, 1, 1),
                    previousCommit: prevCommit.hash,
                    index: expect.any(String),
                    hash: expect.any(String),
                });
            });

            it('should create and store a commit without the removed atoms', async () => {
                const prevCommit = commit(
                    'abc',
                    new Date(2019, 1, 1),
                    idx,
                    null
                );
                const b = branch('master', prevCommit);

                await storeData(store, 'master', null, [prevCommit]);
                await store.saveBranch(b);
                await repo.checkout('master');

                repo.remove(a2.hash);
                await repo.commit('test message', new Date(2019, 1, 1));

                const newCommit = await store.getObject(
                    repo.currentCommit.commit.hash
                );

                expect(repo.currentCommit.commit).toEqual(newCommit);
                expect(repo.currentCommit.atoms).toEqual(
                    new Map([[a1.hash, a1]])
                );
                expect(repo.getAtoms()).toEqual([a1]);
            });

            it('should do nothing if there are no changes', async () => {
                const prevCommit = commit(
                    'abc',
                    new Date(2019, 1, 1),
                    idx,
                    null
                );
                const b = branch('master', prevCommit);

                await storeData(store, 'master', null, [prevCommit]);
                await store.saveBranch(b);
                await repo.checkout('master');

                await repo.commit('test message', new Date(2019, 1, 1));

                const newCommit = await store.getObject(
                    repo.currentCommit.commit.hash
                );

                expect(newCommit).toEqual(prevCommit);
            });
        });

        describe('reset()', () => {
            it('should throw if there is no current head', async () => {
                const c1 = commit('commit', new Date(1900, 1, 1), idx, null);
                await storeData(store, 'master', null, [c1]);

                const promise = repo.reset(c1.hash);
                await expect(promise).rejects.toThrow();
            });

            it('should move the current branch to point to the given commit hash', async () => {
                const c1 = commit('commit', new Date(1900, 1, 1), idx, null);
                await storeData(store, 'master', null, [c1]);

                const b = branch('master', idx);

                await store.saveBranch(b);
                await repo.checkout('master');

                await repo.reset(c1.hash);

                expect(repo.getHead()).toEqual(branch('master', c1));
                expect(repo.currentCommit).toEqual({
                    commit: c1,
                    index: idx,
                    atoms: atomMap([a1, a2]),
                });
            });
        });
    });
});
