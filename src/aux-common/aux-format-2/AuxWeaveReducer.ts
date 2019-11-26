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
import { Bot, PartialBotsState } from '../bots/Bot';
import { merge } from '../utils';
import { hasValue, createBot } from '../bots/BotCalculations';

/**
 * Calculates the state update needed for the given weave result from the given weave.
 * @param weave The weave.
 * @param result The result from the weave.
 */
export default function reducer(
    weave: Weave<AuxOp>,
    result: WeaveResult
): PartialBotsState {
    if (result.type === 'atom_added') {
        return atomAddedReducer(weave, result);
    } else if (result.type === 'conflict') {
        return conflictReducer(weave, result);
    } else if (result.type === 'atom_removed') {
        return atomRemovedReducer(weave, result);
    }
    return {};
}

function atomAddedReducer(
    weave: Weave<AuxOp>,
    result: AtomAddedResult
): PartialBotsState {
    const atom: Atom<AuxOp> = result.atom;
    const value: AuxOp = atom.value;

    if (value.type === AuxOpType.bot) {
        return botAtomAddedReducer(atom, value);
    } else if (value.type === AuxOpType.value) {
        return valueAtomAddedReducer(weave, atom, value);
    } else if (value.type === AuxOpType.delete) {
        return deleteAtomAddedReducer(weave, atom, value);
    }

    return {};
}

function atomRemovedReducer(
    weave: Weave<AuxOp>,
    result: AtomRemovedResult
): PartialBotsState {
    let updates = removeAtom(weave, result.ref.atom) || {};
    for (let sibling of iterateSiblings(result.ref)) {
        let update = removeAtom(weave, sibling.atom);
        if (update) {
            updates = merge(updates, update);
        }
    }

    return updates;
}

function botAtomAddedReducer(
    atom: Atom<AuxOp>,
    value: BotOp
): PartialBotsState {
    const id = value.id;
    return addBot(atom, id);
}

function valueAtomAddedReducer(
    weave: Weave<AuxOp>,
    atom: Atom<AuxOp>,
    value: ValueOp
) {
    const [val, tag, bot] = weave.referenceChain(atom.id);

    if (!tag || !bot) {
        return {};
    }

    if (bot.atom.value.type !== AuxOpType.bot) {
        return {};
    }

    if (tag.atom.value.type !== AuxOpType.tag) {
        return {};
    }

    if (!hasValue(tag.atom.value.name)) {
        return {};
    }

    const tagName = tag.atom.value.name;

    const firstValue = first(iterateCausalGroup(tag));
    if (firstValue && firstValue.atom.hash !== atom.hash) {
        return {};
    }

    const id = bot.atom.value.id;

    const isDeleted = isBotDeleted(bot);
    if (isDeleted) {
        return {};
    }

    if (!hasValue(value.value)) {
        return {
            [id]: {
                tags: {
                    [tagName]: null as any,
                },
            },
        };
    }

    return {
        [id]: {
            tags: {
                [tagName]: value.value,
            },
        },
    };
}

function deleteAtomAddedReducer(
    weave: Weave<AuxOp>,
    atom: Atom<AuxOp>,
    value: DeleteOp
): PartialBotsState {
    const parent = weave.getNode(atom.cause);

    if (!parent) {
        return {};
    }

    if (parent.atom.value.type === AuxOpType.bot) {
        return deleteBotReducer(weave, <WeaveNode<BotOp>>parent, atom);
    }

    return {};
}

function deleteBotReducer(
    weave: Weave<AuxOp>,
    bot: WeaveNode<BotOp>,
    atom: Atom<AuxOp>
): PartialBotsState {
    const firstValue = first(iterateCausalGroup(bot));

    if (firstValue && firstValue.atom.hash !== atom.hash) {
        return {};
    }

    const id = bot.atom.value.id;
    return deleteBot(id);
}

function conflictReducer(
    weave: Weave<AuxOp>,
    result: AtomConflictResult
): PartialBotsState {
    if (!result.loserRef) {
        return {};
    }

    let update = {};

    if (result.loser.value.type === AuxOpType.bot) {
        // Iterate all the tags of the loser
        // and delete them.
        for (let node of iterateChildren(result.loserRef)) {
            if (node.atom.value.type === AuxOpType.tag) {
                update = merge(update, deleteTag(node.atom, result.loser));
            }
        }
    } else if (result.loser.value.type === AuxOpType.tag) {
        const bot = weave.getNode(result.loser.cause).atom;

        if (bot.value.type === AuxOpType.bot) {
            update = deleteTag(result.loser, <Atom<BotOp>>bot);
        }
    }

    update = merge(
        update,
        atomAddedReducer(weave, {
            type: 'atom_added',
            atom: result.winner,
        })
    );

    return update;
}

function addBot(atom: Atom<AuxOp>, botId: string): PartialBotsState {
    if (atom.cause !== null) {
        return {};
    }

    return {
        [botId]: createBot(botId),
    };
}

function deleteBot(id: string): PartialBotsState {
    return {
        [id]: null,
    };
}

function deleteTag(tag: Atom<AuxOp>, bot: Atom<BotOp>): PartialBotsState {
    const value = tag.value as TagOp;
    const id = bot.value.id;

    return {
        [id]: {
            tags: {
                [value.name]: null,
            },
        },
    };
}

function isBotDeleted(bot: WeaveNode<AuxOp>): boolean {
    const firstValue = first(iterateCausalGroup(bot));
    return firstValue.atom.value.type === AuxOpType.delete;
}

function removeAtom(weave: Weave<AuxOp>, atom: Atom<AuxOp>) {
    if (atom.value.type === AuxOpType.bot) {
        return deleteBot(atom.value.id);
    } else if (atom.value.type === AuxOpType.value) {
        return valueRemovedAtomReducer(weave, atom, atom.value);
    }
}

function valueRemovedAtomReducer(
    weave: Weave<AuxOp>,
    atom: Atom<AuxOp>,
    value: ValueOp
) {
    const [tag, bot] = weave.referenceChain(atom.cause);

    if (!tag || !bot) {
        return {};
    }

    if (bot.atom.value.type !== AuxOpType.bot) {
        return {};
    }

    if (tag.atom.value.type !== AuxOpType.tag) {
        return {};
    }

    if (!hasValue(tag.atom.value.name)) {
        return {};
    }

    const isDeleted = isBotDeleted(bot);
    if (isDeleted) {
        return {};
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
            return {
                [id]: {
                    tags: {
                        [tagName]: firstValue.atom.value.value,
                    },
                },
            };
        } else {
            // The atom was removed but the first atom
            // after it so nothing needs to change.
            return {};
        }
    }

    // If there are no value atoms left, then the new value
    // is null
    return {
        [id]: {
            tags: {
                [tagName]: null,
            },
        },
    };
}
