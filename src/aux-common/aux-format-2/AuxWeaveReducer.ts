import {
    Weave,
    WeaveNode,
    WeaveResult,
    AtomAddedResult,
    AtomConflictResult,
    iterateCausalGroup,
    first,
} from '@casual-simulation/causal-trees/core2/Weave2';
import { Atom } from '@casual-simulation/causal-trees/core2/Atom2';
import {
    BotOp,
    AuxOp,
    AuxOpType,
    ValueOp,
    DeleteOp,
    botId,
    TagOp,
} from './AuxOpTypes';
import { BotsState } from '../Bots/Bot';
import { merge } from '../utils';
import { hasValue } from '../Bots/BotCalculations';

export default function reducer(
    weave: Weave<AuxOp>,
    result: WeaveResult,
    state: BotsState
): BotsState {
    if (result.type === 'atom_added') {
        return atomAddedReducer(weave, result, state);
    } else if (result.type === 'conflict') {
        return conflictReducer(weave, result, state);
    }
    return state;
}

function atomAddedReducer(
    weave: Weave<AuxOp>,
    result: AtomAddedResult,
    state: BotsState
): BotsState {
    const atom: Atom<AuxOp> = result.atom;
    const value: AuxOp = atom.value;

    if (value.type === AuxOpType.bot) {
        return fileAtomAddedReducer(atom, value, state);
    } else if (value.type === AuxOpType.value) {
        return valueAtomAddedReducer(weave, atom, value, state);
    } else if (value.type === AuxOpType.delete) {
        return deleteAtomAddedReducer(weave, atom, value, state);
    }

    return state;
}

function fileAtomAddedReducer(
    atom: Atom<AuxOp>,
    value: BotOp,
    state: BotsState
): BotsState {
    const id = botId(atom.id);
    return addFile(atom, id, state);
}

function valueAtomAddedReducer(
    weave: Weave<AuxOp>,
    atom: Atom<AuxOp>,
    value: ValueOp,
    state: BotsState
): BotsState {
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

    const firstValue = first(iterateCausalGroup(tag));
    if (firstValue && firstValue.atom.hash !== atom.hash) {
        return state;
    }

    const id = botId(bot.atom.id);
    if (!state[id]) {
        return state;
    }

    if (!hasValue(value.value)) {
        let { [tag.atom.value.name]: tagVal, ...others } = state[id].tags;
        return {
            ...state,
            [id]: {
                id: id,
                tags: others,
            },
        };
    }

    return merge(state, {
        [id]: {
            tags: {
                [tag.atom.value.name]: value.value,
            },
        },
    });
}

function deleteAtomAddedReducer(
    weave: Weave<AuxOp>,
    atom: Atom<AuxOp>,
    value: DeleteOp,
    state: BotsState
): BotsState {
    const parent = weave.getNode(atom.cause);

    if (!parent) {
        return state;
    }

    if (parent.atom.value.type === AuxOpType.bot) {
        return deleteFileReducer(weave, parent, atom, state);
    }

    return state;
}

function deleteFileReducer(
    weave: Weave<AuxOp>,
    bot: WeaveNode<AuxOp>,
    atom: Atom<AuxOp>,
    state: BotsState
): BotsState {
    const firstValue = first(iterateCausalGroup(bot));

    if (firstValue && firstValue.atom.hash !== atom.hash) {
        return state;
    }

    const id = botId(bot.atom.id);
    return deleteFile(id, state);
}

function conflictReducer(
    weave: Weave<AuxOp>,
    result: AtomConflictResult,
    state: BotsState
): BotsState {
    if (!result.loserRef) {
        return state;
    }

    if (result.loser.value.type === AuxOpType.bot) {
        state = deleteFile(botId(result.loser.id), state);
    } else if (result.loser.value.type === AuxOpType.tag) {
        state = deleteTag(result.loser, state);
    }

    state = atomAddedReducer(
        weave,
        {
            type: 'atom_added',
            atom: result.winner,
        },
        state
    );

    return state;
}

function addFile(atom: Atom<AuxOp>, botId: string, state: BotsState) {
    if (atom.cause !== null) {
        return state;
    }

    return {
        ...state,
        [botId]: {
            id: botId,
            tags: {},
        },
    };
}

function deleteFile(id: string, state: BotsState): BotsState {
    const { [id]: fileState, ...stateWithoutFile } = state;
    return stateWithoutFile;
}

function deleteTag(tag: Atom<AuxOp>, state: BotsState): BotsState {
    const value = tag.value as TagOp;
    const id = botId(tag.cause);

    const bot = state[id];
    const { [value.name]: tagVal, ...tags } = bot.tags;
    const updated = {
        ...bot,
        tags: tags,
    };

    return {
        ...state,
        [id]: updated,
    };
}
