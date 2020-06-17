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
    addedAtom,
    WeaveNode,
    insertAtom,
    removeAtom,
    addResults,
    WeaveResult,
    insertAtoms,
    removeAtoms,
} from '@casual-simulation/causal-trees/core2';
import { AuxOp, tag, BotOp, value, bot, del, TagOp } from './AuxOpTypes';
import { BotsState, PartialBotsState, BotTags } from '../bots/Bot';
import reducer from './AuxWeaveReducer';
import { merge } from '../utils';
import {
    apply,
    updates as stateUpdates,
    BotStateUpdates,
} from './AuxStateHelpers';
import { BotActions } from '../bots/BotEvents';
import {
    findTagNode,
    findValueNode,
    findBotNode,
    findBotNodes,
} from './AuxWeaveHelpers';

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
 * @param space The space that new bots should be placed in.
 */
export function addAuxAtom(
    tree: CausalTree<AuxOp>,
    cause: Atom<AuxOp>,
    op: AuxOp,
    priority?: number,
    space?: string
): AuxResult {
    const treeResult = addAtom(tree, cause, op, priority);
    const update = reducer(tree.weave, treeResult.results[0], undefined, space);

    return {
        ...treeResult,
        update,
    };
}

/**
 * Inserts the given atom into the given tree.
 * @param tree The tree.
 * @param atom The atom.
 */
export function insertAuxAtom(
    tree: AuxCausalTree,
    atom: Atom<AuxOp>
): AuxResult {
    const treeResult = insertAtom(tree, atom);
    const update = reducer(tree.weave, treeResult.results[0]);

    return {
        ...treeResult,
        update,
    };
}

/**
 * Removes the atom with the given hash from the given tree.
 * @param tree The tree.
 * @param hash The atom hash.
 */
export function removeAuxAtom(tree: AuxCausalTree, hash: string): AuxResult {
    const treeResult = removeAtom(tree, hash);
    if (treeResult.results.length > 0) {
        const update = reducer(tree.weave, treeResult.results[0]);

        return {
            ...treeResult,
            update,
        };
    } else {
        return {
            ...treeResult,
            update: {},
        };
    }
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
 * Adds the results from the second result to the first result.
 * @param first The first result.
 * @param second The second result.
 */
export function addAuxResults(first: AuxResult, second: AuxResult) {
    addResults(first, second);
    first.update = merge(first.update, second.update);
    return first;
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

/**
 * Gets the identity AuxResult.
 * That is, an AuxResult that when merged with another AuxResult returns the other AuxResult.
 */
export function auxResultIdentity(): AuxResult {
    return {
        results: [],
        newSite: null,
        update: {},
    };
}

/**
 * Applies the given bot actions to the given tree.
 * Returns the new tree and the list of updates that occurred.
 * @param tree The tree that the events should be applied on top of.
 * @param actions The actions that should be applied.
 * @param space The space that new bots should be placed in.
 */
export function applyEvents(
    tree: AuxCausalTree,
    actions: BotActions[],
    space?: string
) {
    const addAtom = (cause: Atom<AuxOp>, op: AuxOp, priority?: number) => {
        const result = addAuxAtom(tree, cause, op, priority, space);
        tree = applyAuxResult(tree, result);
        return result;
    };

    const updateTags = (bot: WeaveNode<BotOp>, tags: BotTags) => {
        let result: AuxResult = auxResultIdentity();
        for (let key in tags) {
            let node = findTagNode(bot, key);
            const val = tags[key];
            if (!node) {
                // create new tag
                const tagResult = addAtom(bot.atom, tag(key));

                result = mergeAuxResults(result, tagResult);

                const newAtom = addedAtom(tagResult.results[0]);

                if (!newAtom) {
                    continue;
                }
                node = tree.weave.getNode(newAtom.id) as WeaveNode<TagOp>;
            }

            const currentVal = findValueNode(node);
            if (!currentVal || val !== currentVal.atom.value.value) {
                const valueResult = addAtom(node.atom, value(val));
                result = mergeAuxResults(result, valueResult);

                const newAtom = addedAtom(valueResult.results[0]);
                if (newAtom) {
                    const weaveResult = tree.weave.removeSiblingsBefore(
                        newAtom
                    );
                    result = mergeAuxResults(result, {
                        results: [weaveResult],
                        newSite: null,
                        update: {},
                    });
                }
            }
        }

        return result;
    };

    const prevState = tree.state;
    let result: AuxResult = auxResultIdentity();

    for (let event of actions) {
        let newResult: AuxResult = auxResultIdentity();
        if (event.type === 'add_bot') {
            const botResult = addAtom(null, bot(event.id));

            const botAtom = addedAtom(botResult.results[0]);

            if (botAtom) {
                const botNode = tree.weave.getNode(botAtom.id) as WeaveNode<
                    BotOp
                >;
                const tagsResult = updateTags(botNode, event.bot.tags);
                newResult = mergeAuxResults(botResult, tagsResult);
            } else {
                newResult = botResult;
            }
        } else if (event.type === 'update_bot') {
            if (!event.update.tags) {
                continue;
            }

            const node = findBotNode(tree.weave, event.id);
            if (node) {
                newResult = updateTags(node, event.update.tags);
            }
        } else if (event.type == 'remove_bot') {
            for (let node of findBotNodes(tree.weave, event.id)) {
                newResult = addAtom(node.atom, del(), 1);

                const newAtom = addedAtom(newResult.results[0]);
                if (newAtom) {
                    const weaveResult = tree.weave.removeSiblingsBefore(
                        newAtom
                    );
                    newResult = mergeAuxResults(newResult, {
                        results: [weaveResult],
                        newSite: null,
                        update: {},
                    });
                }
            }
        }

        result = mergeAuxResults(result, newResult);
    }

    const updates = stateUpdates(prevState, result.update);

    return {
        tree,
        updates,
        result,
    };
}

/**
 * Applies the given atoms to the given tree.
 * Returns the new tree and list of updates that occurred.
 * @param tree The tree.
 * @param atoms The atoms.
 * @param removedAtoms The atoms that were removed.
 * @param space The space that the bots should have.
 */
export function applyAtoms(
    tree: AuxCausalTree,
    atoms?: Atom<AuxOp>[],
    removedAtoms?: string[],
    space?: string
) {
    let update: PartialBotsState = {};
    let results = [] as WeaveResult[];
    if (atoms) {
        insertAtoms(tree, atoms, results);
    }
    if (removedAtoms) {
        removeAtoms(tree, removedAtoms, results);
    }
    for (let result of results) {
        reducer(tree.weave, result, update, space);
    }
    const prevState = tree.state;
    const finalState = apply(prevState, update);
    const updates = stateUpdates(prevState, update);

    tree.state = finalState;

    return { tree, updates, results };
}

// /**
//  * Removes the given atoms from the given tree.
//  * Returns the new tree and a list of updates that occurred.
//  * @param tree The tree.
//  * @param hashes The atom hashes to remove.
//  */
// export function removeAtoms(tree: AuxCausalTree, hashes: string[]) {
//     const prevState = tree.state;
//     let result = auxResultIdentity();
//     for (let hash of hashes) {
//         const removeResult = removeAuxAtom(tree, hash);
//         tree = applyAuxResult(tree, removeResult);
//         result = mergeAuxResults(result, removeResult);
//     }
//     const updates = stateUpdates(prevState, result.update);

//     return { tree, updates, result };
// }
