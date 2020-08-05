import {
    AuxOpType,
    AuxOp,
    TagOp,
    ValueOp,
    BotOp,
    CertificateOp,
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
            root.atom.value.type === AuxOpType.bot &&
            root.atom.value.id === id
        ) {
            const firstAtom = first(iterateCausalGroup(root));
            if (!firstAtom || firstAtom.atom.value.type !== AuxOpType.delete) {
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
