import {
    Weave,
    WeaveNode,
    WeaveResult,
    AtomAddedResult,
    AtomConflictResult,
    iterateCausalGroup,
    iterateChildren,
    first,
    Atom,
    AtomRemovedResult,
    iterateSiblings,
} from '@casual-simulation/causal-trees/core2';
import {
    BotOp,
    AuxOp,
    AuxOpType,
    ValueOp,
    DeleteOp,
    TagOp,
} from './AuxOpTypes';
import { Bot, PartialBotsState, BotSpace } from '../bots/Bot';
import { merge } from '../utils';
import { hasValue, createBot } from '../bots/BotCalculations';
import lodashMerge from 'lodash/merge';
import { findBotNode, findBotNodes } from './AuxWeaveHelpers';

/**
 * Calculates the state update needed for the given weave result from the given weave.
 * @param weave The weave.
 * @param result The result from the weave.
 * @param state The object that the updates should be stored in. Use this when batching updates to reduce intermediate object allocations.
 * @param space The space that new bots should use.
 */
export default function reducer(
    weave: Weave<AuxOp>,
    result: WeaveResult,
    state: PartialBotsState = {},
    space?: string
): PartialBotsState {
    if (result.type === 'atom_added') {
        return atomAddedReducer(weave, result, state, space);
    } else if (result.type === 'conflict') {
        return conflictReducer(weave, result, state);
    } else if (result.type === 'atom_removed') {
        return atomRemovedReducer(weave, result, state);
    }
    return {};
}

function atomAddedReducer(
    weave: Weave<AuxOp>,
    result: AtomAddedResult,
    state: PartialBotsState,
    space?: string
): PartialBotsState {
    const atom: Atom<AuxOp> = result.atom;
    const value: AuxOp = atom.value;

    if (value.type === AuxOpType.bot) {
        return botAtomAddedReducer(atom, value, state, space);
    } else if (value.type === AuxOpType.value) {
        return valueAtomAddedReducer(weave, atom, value, state);
    } else if (value.type === AuxOpType.delete) {
        return deleteAtomAddedReducer(weave, atom, value, state);
    }

    return {};
}

function atomRemovedReducer(
    weave: Weave<AuxOp>,
    result: AtomRemovedResult,
    state: PartialBotsState
): PartialBotsState {
    let updates = removeAtom(weave, result.ref.atom, state);
    for (let sibling of iterateSiblings(result.ref)) {
        removeAtom(weave, sibling.atom, state);
    }

    return updates;
}

function botAtomAddedReducer(
    atom: Atom<AuxOp>,
    value: BotOp,
    state: PartialBotsState,
    space: string
): PartialBotsState {
    const id = value.id;
    return addBot(atom, id, state, space);
}

function valueAtomAddedReducer(
    weave: Weave<AuxOp>,
    atom: Atom<AuxOp>,
    value: ValueOp,
    state: PartialBotsState
) {
    const [val, tag, bot] = weave.referenceChain(atom.id);

    if (!tag || !bot) {
        return state;
    }

    if (bot.atom.value.type !== AuxOpType.bot) {
        return state;
    }

    if (tag.atom.value.type !== AuxOpType.tag) {
        return state;
    }

    if (!hasValue(tag.atom.value.name)) {
        return state;
    }

    const tagName = tag.atom.value.name;

    const firstValue = first(iterateCausalGroup(tag));
    if (firstValue && firstValue.atom.hash !== atom.hash) {
        return state;
    }

    const id = bot.atom.value.id;

    const isDeleted = isBotDeleted(bot);
    if (isDeleted) {
        return state;
    }

    if (!hasValue(value.value)) {
        lodashMerge(state, {
            [id]: {
                tags: {
                    [tagName]: null as any,
                },
            },
        });
        return state;
    }

    lodashMerge(state, {
        [id]: {
            tags: {
                [tagName]: value.value,
            },
        },
    });
    return state;
}

function deleteAtomAddedReducer(
    weave: Weave<AuxOp>,
    atom: Atom<AuxOp>,
    value: DeleteOp,
    state: PartialBotsState
): PartialBotsState {
    const parent = weave.getNode(atom.cause);

    if (!parent) {
        return state;
    }

    if (parent.atom.value.type === AuxOpType.bot) {
        return deleteBotReducer(weave, <WeaveNode<BotOp>>parent, atom, state);
    }

    return state;
}

function deleteBotReducer(
    weave: Weave<AuxOp>,
    bot: WeaveNode<BotOp>,
    atom: Atom<AuxOp>,
    state: PartialBotsState
): PartialBotsState {
    const firstValue = first(iterateCausalGroup(bot));

    if (firstValue && firstValue.atom.hash !== atom.hash) {
        return state;
    }

    const id = bot.atom.value.id;
    return deleteBot(weave, id, state);
}

function conflictReducer(
    weave: Weave<AuxOp>,
    result: AtomConflictResult,
    state: PartialBotsState
): PartialBotsState {
    if (!result.loserRef) {
        return state;
    }

    let update = state;

    if (result.loser.value.type === AuxOpType.bot) {
        // Iterate all the tags of the loser
        // and delete them.
        for (let node of iterateChildren(result.loserRef)) {
            if (node.atom.value.type === AuxOpType.tag) {
                deleteTag(node.atom, result.loser, update);
            }
        }
    } else if (result.loser.value.type === AuxOpType.tag) {
        const bot = weave.getNode(result.loser.cause).atom;

        if (bot.value.type === AuxOpType.bot) {
            deleteTag(result.loser, <Atom<BotOp>>bot, update);
        }
    }

    atomAddedReducer(
        weave,
        {
            type: 'atom_added',
            atom: result.winner,
        },
        update
    );

    return update;
}

function addBot(
    atom: Atom<AuxOp>,
    botId: string,
    state: PartialBotsState,
    space: string
): PartialBotsState {
    if (atom.cause !== null) {
        return state;
    }

    lodashMerge(state, {
        [botId]: createBot(botId, undefined, <BotSpace>space),
    });
    return state;
}

function deleteBot(
    weave: Weave<AuxOp>,
    id: string,
    state: PartialBotsState
): PartialBotsState {
    let nodes = [...findBotNodes(weave, id)];
    if (nodes.length > 0) {
        return state;
    }

    lodashMerge(state, {
        [id]: null,
    });

    return state;
}

function deleteTag(
    tag: Atom<AuxOp>,
    bot: Atom<BotOp>,
    state: PartialBotsState
): PartialBotsState {
    const value = tag.value as TagOp;
    const id = bot.value.id;

    lodashMerge(state, {
        [id]: {
            tags: {
                [value.name]: null,
            },
        },
    });

    return state;
}

function isBotDeleted(bot: WeaveNode<AuxOp>): boolean {
    const firstValue = first(iterateCausalGroup(bot));
    return firstValue.atom.value.type === AuxOpType.delete;
}

function removeAtom(
    weave: Weave<AuxOp>,
    atom: Atom<AuxOp>,
    state: PartialBotsState
) {
    if (atom.value.type === AuxOpType.bot) {
        return deleteBot(weave, atom.value.id, state);
    } else if (atom.value.type === AuxOpType.value) {
        return valueRemovedAtomReducer(weave, atom, atom.value, state);
    } else {
        return state;
    }
}

function valueRemovedAtomReducer(
    weave: Weave<AuxOp>,
    atom: Atom<AuxOp>,
    value: ValueOp,
    state: PartialBotsState
) {
    const [tag, bot] = weave.referenceChain(atom.cause);

    if (!tag || !bot) {
        return state;
    }

    if (bot.atom.value.type !== AuxOpType.bot) {
        return state;
    }

    if (tag.atom.value.type !== AuxOpType.tag) {
        return state;
    }

    if (!hasValue(tag.atom.value.name)) {
        return state;
    }

    const isDeleted = isBotDeleted(bot);
    if (isDeleted) {
        return state;
    }

    const tagName = tag.atom.value.name;
    const id = bot.atom.value.id;
    const firstValue = first(iterateCausalGroup(tag));
    if (
        firstValue &&
        firstValue.atom.value.type === AuxOpType.value &&
        firstValue.atom.hash !== atom.hash
    ) {
        if (firstValue.atom.id.timestamp <= atom.id.timestamp) {
            // The atom was removed so and the first atom
            // happened before it so it should have the new value.
            lodashMerge(state, {
                [id]: {
                    tags: {
                        [tagName]: firstValue.atom.value.value,
                    },
                },
            });

            return state;
        } else {
            // The atom was removed but the first atom
            // after it so nothing needs to change.
            return state;
        }
    }

    // If there are no value atoms left, then the new value
    // is null
    lodashMerge(state, {
        [id]: {
            tags: {
                [tagName]: null,
            },
        },
    });
    return state;
}
