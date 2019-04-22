import { AtomOp, Atom } from './Atom';

/**
 * Defines an interface for an operation that was calculated
 * but yet to be placed into a weave.
 */
export interface PrecalculatedOp<T extends AtomOp> {
    /**
     * The operation that was calculated.
     */
    op: T;

    /**
     * The cause of the operation.
     */
    cause: Atom<AtomOp> | null;

    /**
     * The priority that the new atom should have.
     */
    priority?: number;
}

/**
 * Creates a new precalculated operation.
 * @param op
 * @param cause
 */
export function precalculatedOp<T extends AtomOp>(
    op: T,
    cause: Atom<AtomOp> = null,
    priority?: number
): PrecalculatedOp<T> {
    return {
        op,
        cause,
        priority,
    };
}
