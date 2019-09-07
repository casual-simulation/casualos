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
    FileOp,
    AuxOp,
    AuxOpType,
    ValueOp,
    DeleteOp,
    fileId,
    TagOp,
} from './AuxOpTypes';
import { FilesState } from '../Files/File';
import { merge } from '../utils';
import { hasValue } from '../Files/FileCalculations';

export default function reducer(
    weave: Weave<AuxOp>,
    result: WeaveResult,
    state: FilesState
): FilesState {
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
    state: FilesState
): FilesState {
    const atom: Atom<AuxOp> = result.atom;
    const value: AuxOp = atom.value;

    if (value.type === AuxOpType.file) {
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
    value: FileOp,
    state: FilesState
): FilesState {
    const id = fileId(atom.id);
    return addFile(atom, id, state);
}

function valueAtomAddedReducer(
    weave: Weave<AuxOp>,
    atom: Atom<AuxOp>,
    value: ValueOp,
    state: FilesState
): FilesState {
    const [val, tag, file] = weave.referenceChain(atom.id);

    if (!tag || !file) {
        return state;
    }

    if (file.atom.value.type !== AuxOpType.file) {
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

    const id = fileId(file.atom.id);
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
    state: FilesState
): FilesState {
    const parent = weave.getNode(atom.cause);

    if (!parent) {
        return state;
    }

    if (parent.atom.value.type === AuxOpType.file) {
        return deleteFileReducer(weave, parent, atom, state);
    }

    return state;
}

function deleteFileReducer(
    weave: Weave<AuxOp>,
    file: WeaveNode<AuxOp>,
    atom: Atom<AuxOp>,
    state: FilesState
): FilesState {
    const firstValue = first(iterateCausalGroup(file));

    if (firstValue && firstValue.atom.hash !== atom.hash) {
        return state;
    }

    const id = fileId(file.atom.id);
    return deleteFile(id, state);
}

function conflictReducer(
    weave: Weave<AuxOp>,
    result: AtomConflictResult,
    state: FilesState
): FilesState {
    if (!result.loserRef) {
        return state;
    }

    if (result.loser.value.type === AuxOpType.file) {
        state = deleteFile(fileId(result.loser.id), state);
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

function addFile(atom: Atom<AuxOp>, fileId: string, state: FilesState) {
    if (atom.cause !== null) {
        return state;
    }

    return {
        ...state,
        [fileId]: {
            id: fileId,
            tags: {},
        },
    };
}

function deleteFile(id: string, state: FilesState): FilesState {
    const { [id]: fileState, ...stateWithoutFile } = state;
    return stateWithoutFile;
}

function deleteTag(tag: Atom<AuxOp>, state: FilesState): FilesState {
    const value = tag.value as TagOp;
    const id = fileId(tag.cause);

    const file = state[id];
    const { [value.name]: tagVal, ...tags } = file.tags;
    const updated = {
        ...file,
        tags: tags,
    };

    return {
        ...state,
        [id]: updated,
    };
}
