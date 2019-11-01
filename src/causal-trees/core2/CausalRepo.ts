import {
    AtomIndex,
    isAtomIndex,
    getAtomHashes,
    AtomIndexDiff,
    AtomIndexFullDiff,
    AtomHashList,
} from './AtomIndex';
import { Atom, isAtom } from './Atom2';
import {
    CausalRepoObject,
    repoAtom,
    repoIndex,
    CausalRepoBranch,
    CausalRepoCommit,
    CausalRepoIndex,
} from './CausalRepoObject';
import { CausalRepoStore } from './CausalRepoStore';
import { Weave } from './Weave2';
import { Observable } from 'rxjs';

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
    atoms: Atom<any>[];
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
 * @param store The store that the data should be saved in.
 * @param data The data to store.
 */
export async function storeData(
    store: CausalRepoStore,
    data: Storable[]
): Promise<void> {
    let objs: CausalRepoObject[] = [];
    for (let storable of data) {
        if (isAtom(storable)) {
            objs.push(repoAtom(storable));
        } else if (isAtomIndex(storable)) {
            objs.push(repoIndex(storable));
        } else {
            objs.push(storable);
        }
    }

    await store.storeObjects(objs);
}

/**
 * Loads the commit data for the given branch.
 * @param store The store that the data should be loaded from.
 * @param branch The branch to load.
 */
export async function loadBranch(
    store: CausalRepoStore,
    branch: CausalRepoBranch
): Promise<CommitData> {
    const hash = branch.hash;
    const [commitOrIndex] = await store.getObjects([hash]);

    if (!commitOrIndex) {
        return null;
    }

    if (commitOrIndex.type === 'commit') {
        return await loadCommit(store, commitOrIndex);
    } else if (commitOrIndex.type === 'index') {
        return {
            commit: null,
            ...(await loadIndex(store, commitOrIndex)),
        };
    }
}

/**
 * Loads the commit data for the given commit.
 * @param store The store.
 * @param commit The commit.
 */
export async function loadCommit(
    store: CausalRepoStore,
    commit: CausalRepoCommit
): Promise<CommitData> {
    const [index] = await store.getObjects([commit.index]);

    if (index.type !== 'index') {
        throw new Error(
            'Found bad data. A commit references an object other than an index.'
        );
    }

    return {
        commit: commit,
        ...(await loadIndex(store, index)),
    };
}

/**
 * Loads the index data for the given commit.
 * @param store The store.
 * @param index The index.
 */
export async function loadIndex(
    store: CausalRepoStore,
    index: CausalRepoIndex
): Promise<IndexData> {
    return {
        index: index,
        atoms: await loadAtoms(store, index.data.atoms),
    };
}

/**
 * Loads the atoms for the given diff.
 * @param store The store.
 * @param diff The diff to load.
 */
export async function loadDiff(
    store: CausalRepoStore,
    diff: AtomIndexDiff
): Promise<AtomIndexFullDiff> {
    const atoms = await loadAtoms(store, diff.additions);

    return {
        additions: atoms,
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

async function loadAtoms(
    store: CausalRepoStore,
    hashList: AtomHashList
): Promise<Atom<any>[]> {
    const repoAtoms = await store.getObjects(getAtomHashes(hashList));

    const atoms = repoAtoms.map(a => {
        if (a.type !== 'atom') {
            throw new Error(
                'Found bad data. An index references an object other than an atom.'
            );
        }
        return a.data;
    });
    return atoms;
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
    return store.saveBranch(branch);
}

/**
 * Lists the branches saved in the given store.
 * @param store The store.
 * @param prefix The prefix that should be used to filter branches. If null then all branches are included.
 */
export async function listBranches(
    store: CausalRepoStore,
    prefix: string = null
): Promise<CausalRepoBranch[]> {
    return store.getBranches(prefix);
}

/**
 * Defines an interface that represents a causal repo.
 * That is, a repository of atoms stored in a weave.
 */
export class CausalRepo {
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
    }

    /**
     * Adds the given diff to the repo's working directory.
     * @param diff The diff to add.
     */
    addDiff(diff: AtomIndexFullDiff): void {}

    /**
     * Creates a commit containing all of the current changes.
     * @param message The message to include for the commit.
     */
    commit(message: string): void {}

    /**
     * Checks out the given branch.
     * @param branch The branch to checkout
     * @param opts The options.
     */
    async checkout(branch: string): Promise<void> {
        const branches = await this._store.getBranches(branch);
        if (branches.length === 0) {
            throw new Error(`Branch ${branch} could not be found.`);
        }
        const b = branches[0];

        await this._saveHead(b);
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

    private async _saveHead(branch: CausalRepoBranch): Promise<void> {
        await this._store.saveBranch(branch);
        this._head = branch;
    }

    private async _checkoutHead() {
        if (!this._head) {
            this.currentCommit = null;
        } else {
            this.currentCommit = await loadBranch(this._store, this._head);
        }
    }
}
