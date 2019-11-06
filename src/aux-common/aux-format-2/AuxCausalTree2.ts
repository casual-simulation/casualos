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
} from '@casual-simulation/causal-trees/core2';
import { AuxOp, tag, BotOp, value, bot, del, TagOp } from './AuxOpTypes';
import { BotsState, PartialBotsState, BotTags } from '../bots/Bot';
import reducer from './AuxWeaveReducer';
import { merge } from '../utils';
import { apply, updates as stateUpdates } from './AuxStateHelpers';
import { BotActions } from '../bots/BotEvents';
import { findTagNode, findValueNode, findBotNode } from './AuxWeaveHelpers';

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
 */
export function applyEvents(tree: AuxCausalTree, actions: BotActions[]) {
    const addAtom = (cause: Atom<AuxOp>, op: AuxOp, priority?: number) => {
        const result = addAuxAtom(tree, cause, op, priority);
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
            const node = findBotNode(tree.weave, event.id);
            if (node) {
                newResult = addAtom(node.atom, del(), 1);
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
