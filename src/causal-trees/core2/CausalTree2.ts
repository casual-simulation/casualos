import { Weave, WeaveResult, addedAtom, weaveRemovedAtoms } from './Weave2';
import {
    SiteStatus,
    newSite,
    createAtom,
    updateSite,
    mergeSites,
    calculateTimeFromId,
} from './SiteStatus';
import { Atom, AtomCardinality } from './Atom2';

/**
 * Defines an interface for a casual tree that can be operated on.
 */
export interface CausalTree<T> {
    weave: Weave<T>;
    site: SiteStatus;
}

/**
 * Defines an interface for a result from adding an atom to a tree.
 */
export interface TreeResult {
    results: WeaveResult[];
    newSite: SiteStatus;
}

/**
 * Creates a new tree.
 * @param id The ID to use for the site.
 */
export function tree<T>(id?: string, time?: number): CausalTree<T> {
    return {
        weave: new Weave(),
        site: newSite(id, time),
    };
}

/**
 * Inserts the given atoms to the given tree.
 * @param tree The tree that the atoms should be added to.
 * @param atoms The atoms that should be added.
 */
export function insertAtoms<T, O extends T>(
    tree: CausalTree<T>,
    atoms: Atom<O>[],
    results: WeaveResult[] = []
) {
    for (let atom of atoms) {
        const result = tree.weave.insert(atom);
        results.push(result);
        const added = addedAtom(result);
        if (added) {
            tree.site.time = calculateTimeFromId(
                tree.site.id,
                tree.site.time,
                added.id.site,
                added.id.timestamp
            );
        }
    }

    return results;
}

/**
 * Removes the atoms with the given hashes from the given tree.
 * @param tree The tree.
 * @param hashes The atom hashes to remove.
 */
export function removeAtoms<T>(
    tree: CausalTree<T>,
    hashes: string[],
    results: WeaveResult[] = []
) {
    for (let hash of hashes) {
        const node = tree.weave.getNodeByHash(hash);
        if (node) {
            results.push(tree.weave.remove(node.atom));
        }
    }

    return results;
}

/**
 * Adds the given atom to the tree's weave and returns a result representing the update.
 * @param tree The tree.
 * @param cause The cause of the new atom.
 * @param op The operation for the new atom.
 * @param priority The priority of the new atom.
 */
export function addAtom<T, O extends T>(
    tree: CausalTree<T>,
    cause: Atom<T>,
    op: O,
    priority?: number,
    cardinality?: AtomCardinality
): TreeResult {
    const atom = createAtom(tree.site, cause, op, priority, cardinality);
    return insertAtom<T, O>(tree, atom);
}

/**
 * Inserts the given atom into the given tree.
 * @param tree The tree.
 * @param atom The atom.
 */
export function insertAtom<T, O extends T>(tree: CausalTree<T>, atom: Atom<O>) {
    const weaveResult = tree.weave.insert(atom);
    const newSite = updateSite(tree.site, weaveResult);
    return {
        results: [weaveResult],
        newSite,
    };
}

/**
 * Removes the atom with the given hash from the tree.
 * @param tree The tree.
 * @param hash The hash.
 */
export function removeAtom<T>(tree: CausalTree<T>, hash: string): TreeResult {
    const node = tree.weave.getNodeByHash(hash);
    if (!node) {
        return {
            results: [],
            newSite: tree.site,
        };
    }
    const weaveResult = tree.weave.remove(node.atom);
    return {
        results: [weaveResult],
        newSite: tree.site,
    };
}

/**
 * Merges the two tree results into one.
 * @param first The first tree result.
 * @param second The second tree result.
 */
export function mergeResults(first: TreeResult, second: TreeResult) {
    return {
        results: [...first.results, ...second.results],
        newSite: mergeSites(first.newSite, second.newSite),
    };
}

/**
 * Adds the results from the second result to the first result.
 * This method mutates first.
 * @param first The first result.
 * @param second The second result.
 */
export function addResults(first: TreeResult, second: TreeResult) {
    first.results.push(...second.results);
    first.newSite = mergeSites(first.newSite, second.newSite);
    return first;
}

/**
 * Applies the given tree result by creating a new tree which incorporates the result into the new tree.
 * @param tree
 * @param result
 */
export function applyResult<T>(
    tree: CausalTree<T>,
    result: TreeResult
): CausalTree<T> {
    return {
        weave: tree.weave,
        site: result.newSite,
    };
}

/**
 * Gets the list of atoms that were added via the given tree result.
 * @param result The result.
 */
export function addedAtoms(results: WeaveResult[]): Atom<any>[] {
    let atoms = [] as Atom<any>[];
    for (let r of results) {
        const added = addedAtom(r);
        if (added) {
            atoms.push(added);
        }
    }
    return atoms;
}

/**
 * Gets the list of atoms that were removed via the given tree result.
 * @param result The result.
 */
export function removedAtoms(results: WeaveResult[]): string[] {
    let hashes = [] as string[];
    for (let r of results) {
        const removed = weaveRemovedAtoms(r);
        for (let atom of removed) {
            hashes.push(atom.hash);
        }
    }

    return hashes;
}
