import { AuxOpType, AuxOp, TagOp, ValueOp, BotOp } from './AuxOpTypes';
import {
    Weave,
    WeaveNode,
    iterateCausalGroup,
} from '@casual-simulation/causal-trees/core2';

/**
 * Finds the first weave node that defines a bot with the given ID.
 * @param weave The weave to search through.
 * @param id The bot ID.
 */
export function findBotNode(weave: Weave<AuxOp>, id: string): WeaveNode<BotOp> {
    return (weave.roots.find(
        r => r.atom.value.type === AuxOpType.bot && r.atom.value.id === id
    ) || null) as WeaveNode<BotOp>;
}

/**
 * Finds the weave node that represents the given tag on the given bot node.
 * @param bot The bot node that should be searched.
 * @param tag The tag to find.
 */
export function findTagNode(
    bot: WeaveNode<AuxOp>,
    tag: string
): WeaveNode<TagOp> {
    for (let node of iterateCausalGroup(bot)) {
        if (
            node.atom.value.type === AuxOpType.tag &&
            node.atom.value.name === tag
        ) {
            return node as WeaveNode<TagOp>;
        }
    }

    return null;
}

/**
 * Finds the first value weave node for the given tag node.
 * @param tag The tag node that should be searched.
 */
export function findValueNode(tag: WeaveNode<AuxOp>): WeaveNode<ValueOp> {
    for (let node of iterateCausalGroup(tag)) {
        if (node.atom.value.type === AuxOpType.value) {
            return node as WeaveNode<ValueOp>;
        }
    }

    return null;
}
