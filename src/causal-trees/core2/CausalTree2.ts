import { Weave, WeaveResult, addedAtom } from './Weave2';
import {
    SiteStatus,
    newSite,
    createAtom,
    updateSite,
    mergeSites,
} from './SiteStatus';
import { Atom } from './Atom2';

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
export function tree<T>(id?: string): CausalTree<T> {
    return {
        weave: new Weave(),
        site: newSite(id),
    };
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
    priority?: number
): TreeResult {
    const atom = createAtom(tree.site, cause, op, priority);
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
export function addedAtoms(result: TreeResult): Atom<any>[] {
    let atoms = [] as Atom<any>[];
    for (let r of result.results) {
        const added = addedAtom(r);
        if (added) {
            atoms.push(added);
        }
    }
    return atoms;
}
