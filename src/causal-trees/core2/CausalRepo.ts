import {
    AtomIndex,
    isAtomIndex,
    getAtomHashes,
    AtomIndexDiff,
    AtomIndexFullDiff,
    AtomHashList,
    calculateDiff,
} from './AtomIndex';
import { Atom, isAtom, atomIdToString } from './Atom2';
import {
    CausalRepoObject,
    repoAtom,
    repoIndex,
    CausalRepoBranch,
    CausalRepoCommit,
    CausalRepoIndex,
    getObjectHash,
    index,
    commit,
    branch,
    CausalRepoAtom,
} from './CausalRepoObject';
import {
    CausalRepoStore,
    CausalObjectStore,
    CausalBranchStore,
} from './CausalRepoStore';
import { Weave } from './Weave2';
import { Observable } from 'rxjs';
import merge from 'lodash/merge';

/**
 * Defines the set of types that can be stored in a repo.
 */
export type Storable = Atom<any> | AtomIndex | CausalRepoObject;

/**
 * Defines an interface for data about an index.
 */
export interface IndexData {
    /**
     * The index that was loaded.
     */
    index: CausalRepoIndex;

    /**
     * The atoms that were loaded.
     */
    atoms: Map<string, Atom<any>>;
}

/**
 * Defines an interface for data about a commit.
 */
export interface CommitData extends IndexData {
    /**
     * The commit.
     */
    commit: CausalRepoCommit;
}

/**
 * Stores the given data in the given store.
 * If given an index, then all the atoms in the given data array
 * will be stored with the index for quick lookup.
 * @param store The store that the data should be saved in.
 * @param head The head that the data is being stored for.
 * @param index The index that the data is being stored for.
 * @param data The data to store.
 */
export async function storeData(
    store: CausalObjectStore,
    head: string,
    index: string,
    data: Storable[]
): Promise<void> {
    let objs: CausalRepoObject[] = [];
    let atoms: CausalRepoObject[] = [];
    for (let storable of data) {
        if (isAtom(storable)) {
            let atom = repoAtom(storable);
            if (index) {
                atoms.push(atom);
            } else {
                objs.push(atom);
            }
        } else if (isAtomIndex(storable)) {
            objs.push(repoIndex(storable));
        } else {
            objs.push(storable);
        }
    }

    if (index) {
        await store.storeIndex(head, index, atoms);
    }
    await store.storeObjects(head, objs);
}

/**
 * Loads the commit data for the given branch.
 * @param store The store that the data should be loaded from.
 * @param branch The branch to load.
 */
export async function loadBranch(
    store: CausalObjectStore,
    branch: CausalRepoBranch
): Promise<CommitData> {
    const hash = branch.hash;
    const commitOrIndex = await store.getObject(hash);

    if (!commitOrIndex) {
        return null;
    }

    if (commitOrIndex.type === 'commit') {
        return await loadCommit(store, branch.name, commitOrIndex);
    } else if (commitOrIndex.type === 'index') {
        return {
            commit: null,
            ...(await loadIndex(store, branch.name, commitOrIndex)),
        };
    }
}

/**
 * Loads the commit data for the given commit.
 * @param store The store.
 * @param head The head that the commit is being loaded for.
 * @param commit The commit.
 */
export async function loadCommit(
    store: CausalObjectStore,
    head: string,
    commit: CausalRepoCommit
): Promise<CommitData> {
    const index = await store.getObject(commit.index);

    if (index.type !== 'index') {
        throw new Error(
            'Found bad data. A commit references an object other than an index.'
        );
    }

    return {
        commit: commit,
        ...(await loadIndex(store, head, index)),
    };
}

// export function indexData()

/**
 * Loads the index data for the given commit.
 * @param store The store.
 * @param head The head that the index is being loaded for.
 * @param index The index.
 */
export async function loadIndex(
    store: CausalObjectStore,
    head: string,
    index: CausalRepoIndex
): Promise<IndexData> {
    return {
        index: index,
        atoms: await loadAtomsForHeadOrIndex(store, head, index),
    };
}

/**
 * Loads the atoms for the given diff.
 * @param store The store.
 * @param diff The diff to load.
 */
export async function loadDiff(
    store: CausalObjectStore,
    diff: AtomIndexDiff
): Promise<AtomIndexFullDiff> {
    const atoms = await loadAtomsWithoutHead(store, diff.additions);

    return {
        additions: [...atoms.values()],
        deletions: diff.deletions,
    };
}

/**
 * Applies the given diff to the given weave.
 * @param weave The weave.
 * @param diff The diff to apply.
 */
export function applyDiff<T>(weave: Weave<T>, diff: AtomIndexFullDiff) {
    for (let added of diff.additions) {
        weave.insert(added);
    }

    for (let hash in diff.deletions) {
        const id = diff.deletions[hash];
        const node = weave.getNode(id);
        if (node && node.atom.hash === hash) {
            weave.remove(node.atom);
        }
    }
}

/**
 * Loads all the given atoms that have been stored for the given head from the given store.
 * @param store The object store.
 * @param head The head that the atoms should be loaded for.
 * @param hashList The list of atom hashes to load.
 */
async function loadAtomsForHeadOrIndex(
    store: CausalObjectStore,
    head: string,
    index: CausalRepoIndex
): Promise<Map<string, Atom<any>>> {
    const repoAtoms = store.loadIndex
        ? await store.loadIndex(head, index)
        : await store.getObjects(head, getAtomHashes(index.data.atoms));

    const atoms = repoAtoms.map(a => {
        if (a.type !== 'atom') {
            throw new Error(
                'Found bad data. An index references an object other than an atom.'
            );
        }
        return a.data;
    });

    return atomMap(atoms);
}

/**
 * Loads all the given atoms from the given store.
 * This method performs a point lookup for each hash, so it is not recommended to use
 * this for a large number of hashes. Instead, you should use loadAtomsForHead() if at all possible.
 * @param store The object store.
 * @param hashList The list of atom hashes to load.
 */
async function loadAtomsWithoutHead(
    store: CausalObjectStore,
    hashList: AtomHashList
): Promise<Map<string, Atom<any>>> {
    const hashes = getAtomHashes(hashList);
    const repoAtoms = await Promise.all(hashes.map(h => store.getObject(h)));

    const atoms = repoAtoms.map(a => {
        if (a.type !== 'atom') {
            throw new Error(
                'Found bad data. An index references an object other than an atom.'
            );
        }
        return a.data;
    });

    return atomMap(atoms);
}

/**
 * Creates a map from the given list of atoms.
 * @param atoms The atoms.
 */
export function atomMap(atoms: Atom<any>[]): Map<string, Atom<any>> {
    return new Map(atoms.map(a => [a.hash, a] as const));
}

/**
 * Updates the given branch in the given store.
 * If the branch points to a non-existant hash then an error will be thrown.
 * @param store The store.
 * @param branch The updated branch.
 */
export async function updateBranch(
    store: CausalRepoStore,
    branch: CausalRepoBranch
): Promise<void> {
    const data = await store.getObject(branch.hash);
    if (!data) {
        throw new Error(
            `The branch (${branch.name}) references a hash (${
                branch.hash
            }) that does not exist in the store.`
        );
    }
    return await store.saveBranch(branch);
}

/**
 * Lists the branches saved in the given store.
 * @param store The store.
 * @param prefix The prefix that should be used to filter branches. If null then all branches are included.
 */
export async function listBranches(
    store: CausalBranchStore,
    prefix: string = null
): Promise<CausalRepoBranch[]> {
    return store.getBranches(prefix);
}

/**
 * Lists the set of commits for the given commit hash.
 * @param store The store that the commit info should be loaded from.
 * @param hash
 */
export async function listCommits(
    store: CausalObjectStore,
    hash: string
): Promise<CausalRepoCommit[]> {
    let commit: CausalRepoObject;
    let commits: CausalRepoCommit[] = [];
    while (hash) {
        commit = await store.getObject(hash);
        if (commit && commit.type === 'commit') {
            hash = commit.previousCommit;
            commits.push(commit);
        } else {
            hash = null;
        }
    }

    return commits;
}

/**
 * Calculates the difference between the two commits.
 * @param first The first commit.
 * @param second The second commit.
 */
export function calculateCommitDiff(
    first: CommitData,
    second: CommitData
): CommitDiff {
    if (!first && second) {
        return {
            additions: second.atoms,
            deletions: atomMap([]),
        };
    } else if (first && !second) {
        return {
            additions: atomMap([]),
            deletions: first.atoms,
        };
    } else {
        const diff = calculateDiff(first.index.data, second.index.data);
        const added = Object.keys(diff.additions);
        const deleted = Object.keys(diff.deletions);

        return {
            additions: atomMap(added.map(hash => second.atoms.get(hash))),
            deletions: atomMap(deleted.map(hash => first.atoms.get(hash))),
        };
    }
}

/**
 * Defines an interface for objects that represent a diff between two commits.
 */
export interface CommitDiff {
    /**
     * The map of atoms that were added.
     */
    additions: Map<string, Atom<any>>;

    /**
     * The map of atoms that were deleted.
     */
    deletions: Map<string, Atom<any>>;
}

/**
 * Defines an interface that represents a causal repo.
 * That is, a repository of atoms stored in a weave.
 */
export class CausalRepo {
    /**
     * The diff of atoms that have been added to the stage.
     */
    stage: AtomIndexFullDiff;

    /**
     * The atoms that are currently being worked on. (a.k.a working set)
     * It is a map of atom hashes to their actual values.
     */
    atoms: Map<string, Atom<any>>;

    private _store: CausalRepoStore;
    private _head: CausalRepoBranch = null;

    /**
     * Gets an observable that resolves whenever a diff is added to the repo.
     */
    diffAdded: Observable<AtomIndexFullDiff>;

    /**
     * Gets an observable that resolves whenever a commit is added to the repo.
     */
    commitAdded: Observable<CausalRepoCommit>;

    /**
     * The commit that the repo currently has checked out.
     */
    currentCommit: CommitData = null;

    /**
     *
     * @param store
     */
    constructor(store: CausalRepoStore) {
        this._store = store;
        this._setCurrentCommit(null);
    }

    /**
     * Gets the list of atoms that currently exist in this repo.
     */
    getAtoms(): Atom<any>[] {
        return [...this.atoms.values()];
    }

    /**
     * Determines if the repo has any uncommited changes.
     */
    hasChanges(): boolean {
        return (
            this.stage.additions.length > 0 ||
            Object.keys(this.stage.deletions).length > 0
        );
    }

    /**
     * Adds the given atoms to the stage.
     * @param atoms The atoms to add.
     */
    add(...atoms: Atom<any>[]) {
        return this.addMany(atoms);
    }

    /**
     * Adds the given atoms to the stage.
     * @param atoms The atoms to add.
     */
    addMany(atoms: Atom<any>[]) {
        let added = [] as Atom<any>[];
        for (let atom of atoms) {
            const existing = this._getAtomFromCurrentState(atom.hash);
            if (!existing) {
                this.stage.additions.push(atom);
                delete this.stage.deletions[atom.hash];
                this.atoms.set(atom.hash, atom);
                added.push(atom);
            }
        }
        return added;
    }

    /**
     * Removes the atoms with the given hashes.
     * @param hashes The list of hashes to remove.
     */
    remove(...hashes: string[]) {
        return this.removeMany(hashes);
    }

    /**
     * Removes the given atoms with the given hashes.
     * @param hashes The list of hashes to remove.
     */
    removeMany(hashes: string[]) {
        let removed = [] as Atom<any>[];
        for (let hash of hashes) {
            const existing = this._getAtomFromCurrentState(hash);
            if (existing) {
                // mark as deleted

                // TODO: Replace with map if better performance is needed
                const index = this.stage.additions.indexOf(existing);
                if (index >= 0) {
                    this.stage.additions.splice(index, 1);
                }
                this.stage.deletions[hash] = atomIdToString(existing.id);
                this.atoms.delete(hash);
                removed.push(existing);
            }
        }
        return removed;
    }

    /**
     * Creates a commit containing all of the current changes.
     * Returns null if there are no changes to commit.
     * @param message The message to include for the commit.
     */
    async commit(
        message: string,
        time: Date = new Date()
    ): Promise<CausalRepoCommit> {
        if (!this.hasChanges()) {
            return null;
        }
        const atoms = this.getAtoms();
        const idx = index(...atoms);
        const c = commit(
            message,
            time,
            idx,
            this.currentCommit ? this.currentCommit.commit : null
        );
        await storeData(this._store, this._head.name, idx.data.hash, [
            ...atoms,
            idx,
            c,
        ]);
        await this._updateHead(c);
        await this._checkoutHead();

        return c;
    }

    /**
     * Checks out the given branch.
     * @param branch The branch to checkout
     * @param opts The options.
     */
    async checkout(branch: string, options?: CheckoutOptions): Promise<void> {
        options = merge({}, options || {});
        const branches = await this._store.getBranches(branch);
        if (branches.length === 0) {
            if (options.createIfDoesntExist) {
                console.log(
                    `[CausalRepo] Creating branch (${branch}) at ${
                        options.createIfDoesntExist.hash
                    }`
                );
                await this.createBranch(
                    branch,
                    options.createIfDoesntExist.hash
                );
                return;
            } else {
                throw new Error(`Branch ${branch} could not be found.`);
            }
        }
        const b = branches[0];

        await this._saveHead(b);
        await this._checkoutHead();
    }

    /**
     * Resets the current branch to the given hash.
     * @param hash The hash.
     */
    async reset(hash: CausalRepoCommit | string): Promise<void> {
        if (!this._head) {
            throw new Error('There is no head to reset!');
        }

        const newBranch = branch(this._head.name, hash);
        await this._saveHead(newBranch);
        await this._checkoutHead();
    }

    /**
     * Creates and checks out the given branch.
     * @param name The name of the branch.
     * @param hash The hash to checkout.
     */
    async createBranch(name: string, hash: string = null): Promise<void> {
        const branches = await this._store.getBranches(name);
        if (branches.length > 0) {
            throw new Error('Branch already exists.');
        }
        if (hash) {
        }
        const branch: CausalRepoBranch = {
            type: 'branch',
            name: name,
            hash: hash || null,
        };

        await this._saveHead(branch);
        await this._checkoutHead();
    }

    getHead(): CausalRepoBranch {
        return this._head;
    }

    private _getAtomFromCurrentState(hash: string): Atom<any> {
        return this.atoms.get(hash);
    }

    private async _updateHead(
        ref: string | CausalRepoCommit | CausalRepoIndex
    ) {
        const updated = branch(this._head.name, ref);
        await this._saveHead(updated);
    }

    private async _saveHead(branch: CausalRepoBranch): Promise<void> {
        await this._store.saveBranch(branch);
        this._head = branch;
    }

    private async _checkoutHead() {
        if (!this._head) {
            this._setCurrentCommit(null);
        } else {
            this._setCurrentCommit(await loadBranch(this._store, this._head));
        }
    }

    private _setCurrentCommit(commit: CommitData) {
        this.currentCommit = commit;
        this._resetStage();
        if (this.currentCommit) {
            this.atoms = new Map(this.currentCommit.atoms);
        } else {
            this.atoms = new Map();
        }
    }

    private _resetStage() {
        this.stage = {
            additions: [],
            deletions: {},
        };
    }
}

/**
 * The options for checking out a branch.
 */
export interface CheckoutOptions {
    /**
     * The options that should be used to create the branch if it doesn't exist.
     */
    createIfDoesntExist?: {
        hash: string;
    };
}
