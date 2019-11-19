import {
    AtomIndex,
    isAtomIndex,
    getAtomHashes,
    AtomIndexDiff,
    AtomIndexFullDiff,
    AtomHashList,
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
} from './CausalRepoObject';
import { CausalRepoStore } from './CausalRepoStore';
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
     * Maps
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

// export function indexData()

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

async function loadAtoms(
    store: CausalRepoStore,
    hashList: AtomHashList
): Promise<Map<string, Atom<any>>> {
    const repoAtoms = await store.getObjects(getAtomHashes(hashList));

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
    const [data] = await store.getObjects([branch.hash]);
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
        let added = [] as Atom<any>[];
        for (let atom of atoms) {
            const existing = this._getAtomFromCurrentCommit(atom.hash);
            if (!existing) {
                this.stage.additions.push(atom);
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
        let removed = [] as Atom<any>[];
        for (let hash of hashes) {
            const existing = this._getAtomFromCurrentCommit(hash);
            if (existing) {
                // mark as deleted
                this.stage.deletions[hash] = atomIdToString(existing.id);
                this.atoms.delete(hash);
                removed.push(existing);
            }
        }
        return removed;
    }

    /**
     * Creates a commit containing all of the current changes.
     * @param message The message to include for the commit.
     */
    async commit(message: string, time: Date = new Date()): Promise<void> {
        if (!this.hasChanges()) {
            return;
        }
        const addedAtoms = this.stage.additions;
        const idx = index(...this.getAtoms());
        const c = commit(
            message,
            time,
            idx,
            this.currentCommit ? this.currentCommit.commit : null
        );
        await storeData(this._store, [...addedAtoms, idx, c]);
        await this._updateHead(c);
        await this._checkoutHead();
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

    private _getAtomFromCurrentCommit(hash: string): Atom<any> {
        if (this.currentCommit) {
            const atom = this.currentCommit.atoms.get(hash);
            if (atom) {
                return atom;
            }
        }
        return null;
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
