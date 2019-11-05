import {
    SiteStatus,
    Weave,
    Atom,
    CausalTree,
    TreeResult,
    applyResult as applyTreeResult,
    addAtom,
    tree,
    mergeResults,
} from '@casual-simulation/causal-trees/core2';
import { AuxOp } from './AuxOpTypes';
import { BotsState, PartialBotsState } from '../bots/Bot';
import reducer from './AuxWeaveReducer';
import { merge } from '../utils';
import { apply } from './AuxStateHelpers';

/**
 * Defines an interface that represents the state of a causal tree that contains AUX state.
 */
export interface AuxCausalTree extends CausalTree<AuxOp> {
    state: BotsState;
}

/**
 * Defines an interface that represents an update from adding an atom to the tree.
 */
export interface AuxResult extends TreeResult {
    update: PartialBotsState;
}

/**
 * Creates a new AUX tree with the given ID.
 * @param id The ID.
 */
export function auxTree(id?: string): AuxCausalTree {
    return {
        ...tree(id),
        state: {},
    };
}

/**
 * Adds a new atom to the given tree with the given cause, operation, and priority.
 * Returns a result that can be applied to the tree to get the updated state.
 * @param tree The tree.
 * @param cause The cause of the operation.
 * @param op The operation.
 * @param priority The priority.
 */
export function addAuxAtom(
    tree: AuxCausalTree,
    cause: Atom<AuxOp>,
    op: AuxOp,
    priority?: number
): AuxResult {
    const treeResult = addAtom(tree, cause, op, priority);
    const update = reducer(tree.weave, treeResult.results[0]);

    return {
        ...treeResult,
        update,
    };
}

/**
 * Merges two AUX results into a single final result.
 * @param first The first result.
 * @param second The second result.
 */
export function mergeAuxResults(
    first: AuxResult,
    second: AuxResult
): AuxResult {
    return {
        ...mergeResults(first, second),
        update: merge(first.update, second.update),
    };
}

/**
 * Applies the given AuxResult to the tree.
 * @param tree The tree.
 * @param result The result.
 */
export function applyAuxResult(
    tree: AuxCausalTree,
    result: AuxResult
): AuxCausalTree {
    const newTree = applyTreeResult(tree, result);

    return {
        ...newTree,
        state: apply(tree.state, result.update),
    };
}

export function auxResultIdentity(): AuxResult {
    return {
        results: [],
        newSite: null,
        update: {},
    };
}
