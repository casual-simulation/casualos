import { Atom, AtomOp } from './Atom';

/**
 * Defines an interface for objects that can filter atoms.
 */
export interface AtomFilter<T extends AtomOp> {
    (atom: Atom<T>): boolean;
}
