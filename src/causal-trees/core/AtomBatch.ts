import { RejectedAtom } from './RejectedAtom';
import { Atom, AtomOp } from './Atom';

/**
 * Defines a batch of atoms that were added or rejected.
 */
export interface AtomBatch<T extends AtomOp> {
    /**
     * The atoms that were added to the tree.
     */
    added: Atom<T>[];

    /**
     * The atoms that were rejected from the tree.
     */
    rejected: RejectedAtom<T>[];
}
