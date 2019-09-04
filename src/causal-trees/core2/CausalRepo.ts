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
