import {
    AuxOpType,
    AuxOp,
    TagOp,
    ValueOp,
    BotOp,
    CertificateOp,
    TagMaskOp,
} from './AuxOpTypes';
import {
    Weave,
    WeaveNode,
    iterateCausalGroup,
    Atom,
    SiteStatus,
    addAtom,
    first,
} from '@casual-simulation/causal-trees/core2';
import reducer from './AuxWeaveReducer';
import isEqual from 'lodash/isEqual';

/**
 * Finds the first weave node that defines a bot with the given ID.
 * @param weave The weave to search through.
 * @param id The bot ID.
 */
export function findBotNode(weave: Weave<AuxOp>, id: string): WeaveNode<BotOp> {
    return first(findBotNodes(weave, id)) || null;
}

/**
 * Finds all of the weave nodes that define a bot with the given ID.
 * @param weave The weave to search through.
 * @param id The bot ID.
 */
export function* findBotNodes(
    weave: Weave<AuxOp>,
    id: string
): IterableIterator<WeaveNode<BotOp>> {
    for (let root of weave.roots) {
        if (
            root.atom.value.type === AuxOpType.Bot &&
            root.atom.value.id === id
        ) {
            const firstAtom = first(iterateCausalGroup(root));
            if (!firstAtom || firstAtom.atom.value.type !== AuxOpType.Delete) {
                yield root as WeaveNode<BotOp>;
            }
        }
    }
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
            node.atom.value.type === AuxOpType.Tag &&
            node.atom.value.name === tag
        ) {
            return node as WeaveNode<TagOp>;
        }
    }

    return null;
}

/**
 * Finds the tag mask node for the given bot ID and tag.
 * @param weave The weave.
 * @param botId The ID of the bot.
 * @param tag The tag.
 */
export function* findTagMaskNodes(
    weave: Weave<AuxOp>,
    botId: string,
    tag: string
): IterableIterator<WeaveNode<TagMaskOp>> {
    for (let root of weave.roots) {
        if (
            root.atom.value.type === AuxOpType.TagMask &&
            root.atom.value.botId === botId &&
            root.atom.value.name === tag
        ) {
            const firstAtom = first(iterateCausalGroup(root));
            if (!firstAtom || firstAtom.atom.value.type !== AuxOpType.Delete) {
                yield root as WeaveNode<TagMaskOp>;
            }
        }
    }
}

/**
 * Finds the first value weave node for the given tag node.
 * @param tag The tag node that should be searched.
 */
export function findValueNode(tag: WeaveNode<AuxOp>): WeaveNode<ValueOp> {
    for (let node of iterateCausalGroup(tag)) {
        if (node.atom.value.type === AuxOpType.Value) {
            return node as WeaveNode<ValueOp>;
        }
    }

    return null;
}

/**
 * Finds the first value weave node for the given tag node and value.
 * @param tag The tag node that should be searched.
 * @param value The value that should be matched.
 */
export function findValueNodeByValue(
    tag: WeaveNode<AuxOp>,
    value: any
): WeaveNode<ValueOp> {
    for (let node of iterateCausalGroup(tag)) {
        if (
            node.atom.value.type === AuxOpType.Value &&
            isEqual(node.atom.value.value, value)
        ) {
            return node as WeaveNode<ValueOp>;
        }
    }

    return null;
}

// /**
//  * Adds the given atom to the weave.
//  * Returns the new site status, weave result, atom that was added, and status update.
//  * @param weave The weave.
//  * @param site The site.
//  * @param atom The atom.
//  */
// export function addAuxAtom<T extends AuxOp>(
//     weave: Weave<T>,
//     site: SiteStatus,
//     atom: Atom<T>
// ) {
//     const info = addAtom(weave, site, atom);
//     const update = reducer(weave, info.result);

//     return {
//         ...info,
//         update,
//     };
// }
