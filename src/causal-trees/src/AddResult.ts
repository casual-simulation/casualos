import { AtomOp, Atom } from './Atom';
import { RejectedAtom } from './RejectedAtom';
import { AtomBatch } from './AtomBatch';

/**
 * Defines the result of attempting to add an atom to the tree.
 */
export interface AddResult<T extends AtomOp> {
    /**
     * The atom that was added to the tree or null if it wasn't added.
     */
    added: Atom<T> | null;

    /**
     * The atom that was rejected from the tree or null if it wasn't rejected.
     */
    rejected: RejectedAtom<T> | null;
}

/**
 * Merges the given array of atom add results into a single atom batch.
 * @param results The results.
 */
export function mergeIntoBatch<T extends AtomOp>(
    results: AddResult<T>[]
): AtomBatch<T> {
    let added = results.map(r => r.added).filter(a => a);
    let rejected = results.map(r => r.rejected).filter(a => a);
    return {
        added,
        rejected,
    };
}
