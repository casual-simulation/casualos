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
    iterateNewerSiblings,
    idEquals,
} from '@casual-simulation/causal-trees/core2';
import {
    BotOp,
    AuxOp,
    AuxOpType,
    ValueOp,
    DeleteOp,
    TagOp,
    CertificateOp,
    validateCertSignature,
    validateRevocation,
    RevocationOp,
    SignatureOp,
    validateSignedValue,
    tagValueHash,
    TagMaskOp,
    InsertOp,
} from './AuxOpTypes';
import uuidv5 from 'uuid/v5';
import { Bot, PartialBotsState, BotSpace } from '../bots/Bot';
import { merge } from '../utils';
import { hasValue, createBot } from '../bots/BotCalculations';
import lodashMerge from 'lodash/merge';
import {
    calculateOrderedEdits,
    findBotNode,
    findBotNodes,
    TextSegment,
} from './AuxWeaveHelpers';
import reverse from 'lodash/reverse';
import {
    apply,
    applyEdit,
    del,
    edit,
    insert,
    isTagEdit,
    mergeEdits,
    preserve,
    TagEditOp,
} from './AuxStateHelpers';

export const CERT_ID_NAMESPACE = 'a1307e2b-8d80-4945-9792-2cd483c45e24';
export const CERTIFIED_SPACE = 'certified';

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

    if (value.type === AuxOpType.Bot) {
        return botAtomAddedReducer(atom, value, state, space);
    } else if (value.type === AuxOpType.Value) {
        return valueAtomAddedReducer(weave, atom, value, state, space);
    } else if (value.type === AuxOpType.Insert) {
        return insertAtomAddedReducer(weave, atom, value, state, space);
    } else if (value.type === AuxOpType.Delete) {
        return deleteAtomAddedReducer(weave, atom, value, state, space);
    } else if (value.type === AuxOpType.Certificate) {
        return certificateAtomAddedReducer(
            weave,
            <Atom<CertificateOp>>atom,
            value,
            state
        );
    } else if (value.type === AuxOpType.Revocation) {
        return revokeAtomAddedReducer(weave, atom, value, state);
    } else if (value.type === AuxOpType.Signature) {
        return signatureAtomAddedReducer(weave, atom, value, state);
    }

    return {};
}

function atomRemovedReducer(
    weave: Weave<AuxOp>,
    result: AtomRemovedResult,
    state: PartialBotsState
): PartialBotsState {
    let updates = removeAtom(weave, result.ref.atom, result.ref, state);
    for (let sibling of iterateSiblings(result.ref)) {
        removeAtom(weave, sibling.atom, sibling, state);
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
    state: PartialBotsState,
    space: string
) {
    const [val, tag, bot] = weave.referenceChain(atom.id);

    if (!tag) {
        return state;
    }

    if (tag.atom.value.type === AuxOpType.TagMask) {
        return tagMaskValueAtomAddedReducer(
            weave,
            atom,
            value,
            <WeaveNode<TagMaskOp>>tag,
            state,
            space
        );
    }

    if (!bot) {
        return state;
    }

    if (bot.atom.value.type !== AuxOpType.Bot) {
        return state;
    }

    if (tag.atom.value.type !== AuxOpType.Tag) {
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

    const sibling = first(iterateSiblings(firstValue));
    if (sibling && sibling.atom.value.type === AuxOpType.Value) {
        const certificates = weave.roots.filter(
            (r) => r.atom.value.type === AuxOpType.Certificate
        );
        const signature = certificates.find((cert) => {
            for (let node of iterateChildren(cert)) {
                if (
                    node.atom.value.type === AuxOpType.Signature &&
                    node.atom.value.valueHash === sibling.atom.hash
                ) {
                    return true;
                }
            }
            return false;
        });
        if (signature) {
            lodashMerge(state, {
                [id]: {
                    signatures: {
                        [tagValueHash(
                            id,
                            tagName,
                            sibling.atom.value.value
                        )]: null,
                    },
                },
            });
        }
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

function insertAtomAddedReducer(
    weave: Weave<AuxOp>,
    atom: Atom<AuxOp>,
    op: InsertOp,
    state: PartialBotsState,
    space: string
) {
    const { tag: tagOrValue, bot: botOrTagMask, value } = getTextEditNodes(
        weave,
        atom
    );

    if (!tagOrValue) {
        return state;
    }

    if (!botOrTagMask) {
        return state;
    }

    if (botOrTagMask.atom.value.type === AuxOpType.TagMask) {
        return insertTagMaskAtomAddedReducer(
            weave,
            atom,
            op,
            state,
            space,
            botOrTagMask as WeaveNode<TagMaskOp>,
            tagOrValue
        );
    } else if (botOrTagMask.atom.value.type !== AuxOpType.Bot) {
        return state;
    }

    const id = botOrTagMask.atom.value.id;

    if (tagOrValue.atom.value.type !== AuxOpType.Tag) {
        return state;
    }
    if (!hasValue(tagOrValue.atom.value.name)) {
        return state;
    }

    const tagName = tagOrValue.atom.value.name;

    const nodes = [value, ...iterateCausalGroup(value)];
    const edits = calculateOrderedEdits(nodes);

    let count = 0;

    // NOTE: the variable cannot be named "edit" because
    // then webpack will not compile the reference to th edit() function
    // correctly.
    for (let e of edits) {
        if (e.node.atom === atom) {
            break;
        }
        count += e.text.length;
    }

    let ops = [] as TagEditOp[];
    if (count > 0) {
        ops.push(preserve(count));
    }
    ops.push(insert(op.text));

    const existingValue = state?.[id]?.tags?.[tagName];
    if (isTagEdit(existingValue)) {
        lodashMerge(state, {
            [id]: {
                tags: {
                    [tagName]: mergeEdits(
                        existingValue,
                        edit({ [atom.id.site]: atom.id.timestamp }, ...ops)
                    ),
                },
            },
        });
    } else {
        let tagEdit = edit({ [atom.id.site]: atom.id.timestamp }, ...ops);

        let finalValue: any;
        if (hasValue(existingValue)) {
            finalValue = applyEdit(existingValue, tagEdit);
        } else {
            finalValue = tagEdit;
        }
        lodashMerge(state, {
            [id]: {
                tags: {
                    [tagName]: finalValue,
                },
            },
        });
    }

    return state;
}

function insertTagMaskAtomAddedReducer(
    weave: Weave<AuxOp>,
    atom: Atom<AuxOp>,
    op: InsertOp,
    state: PartialBotsState,
    space: string,
    tagMask: WeaveNode<TagMaskOp>,
    value: WeaveNode<AuxOp>
) {
    if (!hasValue(tagMask.atom.value.botId)) {
        return state;
    }

    if (!hasValue(tagMask.atom.value.name)) {
        return state;
    }

    const id = tagMask.atom.value.botId;
    const tagName = tagMask.atom.value.name;

    if (value.atom.value.type !== AuxOpType.Value) {
        return state;
    }

    const nodes = [value, ...iterateCausalGroup(value)];
    const edits = calculateOrderedEdits(nodes);

    let count = 0;

    // NOTE: the variable cannot be named "edit" because
    // then webpack will not compile the reference to th edit() function
    // correctly.
    for (let e of edits) {
        if (e.node.atom === atom) {
            break;
        }
        count += e.text.length;
    }

    let ops = [] as TagEditOp[];
    if (count > 0) {
        ops.push(preserve(count));
    }
    ops.push(insert(op.text));

    const existingValue = state?.[id]?.masks?.[space]?.[tagName];
    if (isTagEdit(existingValue)) {
        lodashMerge(state, {
            [id]: {
                masks: {
                    [space]: {
                        [tagName]: mergeEdits(
                            existingValue,
                            edit({ [atom.id.site]: atom.id.timestamp }, ...ops)
                        ),
                    },
                },
            },
        });
    } else {
        let tagEdit = edit({ [atom.id.site]: atom.id.timestamp }, ...ops);

        let finalValue: any;
        if (hasValue(existingValue)) {
            finalValue = applyEdit(existingValue, tagEdit);
        } else {
            finalValue = tagEdit;
        }
        lodashMerge(state, {
            [id]: {
                masks: {
                    [space]: {
                        [tagName]: finalValue,
                    },
                },
            },
        });
    }

    return state;
}

function deleteTextReducer(
    weave: Weave<AuxOp>,
    atom: Atom<AuxOp>,
    value: DeleteOp,
    state: PartialBotsState,
    space: string
) {
    const {
        tag: tagOrValue,
        bot: botOrTagMask,
        values,
        value: valueNode,
    } = getTextEditNodes(weave, atom);

    if (!tagOrValue) {
        return state;
    }

    if (!botOrTagMask) {
        return state;
    }

    if (botOrTagMask.atom.value.type === AuxOpType.TagMask) {
        return deleteTagMaskTextReducer(
            weave,
            atom,
            value,
            state,
            space,
            botOrTagMask as WeaveNode<TagMaskOp>,
            tagOrValue,
            values
        );
    } else if (botOrTagMask.atom.value.type !== AuxOpType.Bot) {
        return state;
    }

    if (botOrTagMask.atom.value.type !== AuxOpType.Bot) {
        return state;
    }

    if (tagOrValue.atom.value.type !== AuxOpType.Tag) {
        return state;
    }

    if (!hasValue(tagOrValue.atom.value.name)) {
        return state;
    }

    const tagName = tagOrValue.atom.value.name;
    const id = botOrTagMask.atom.value.id;

    const nodes = [valueNode, ...iterateCausalGroup(valueNode)];
    const filtered = nodes.filter((n) => !idEquals(n.atom.id, atom.id));
    const edits = calculateOrderedEdits(filtered, true);

    let ops = [] as TagEditOp[];
    for (let { count, length } of findDeletePoints(
        edits,
        atom as Atom<DeleteOp>,
        value
    )) {
        if (count > 0) {
            ops.push(preserve(count));
        }
        ops.push(del(length));
    }

    if (ops.length > 0) {
        const existingValue = state?.[id]?.tags?.[tagName];
        if (isTagEdit(existingValue)) {
            lodashMerge(state, {
                [id]: {
                    tags: {
                        [tagName]: mergeEdits(
                            existingValue,
                            edit({ [atom.id.site]: atom.id.timestamp }, ...ops)
                        ),
                    },
                },
            });
        } else {
            const tagEdit = edit({ [atom.id.site]: atom.id.timestamp }, ...ops);

            let finalValue: any;
            if (hasValue(existingValue)) {
                finalValue = applyEdit(existingValue, tagEdit);
            } else {
                finalValue = tagEdit;
            }

            lodashMerge(state, {
                [id]: {
                    tags: {
                        [tagName]: finalValue,
                    },
                },
            });
        }
    }

    return state;
}

function deleteTagMaskTextReducer(
    weave: Weave<AuxOp>,
    atom: Atom<AuxOp>,
    op: DeleteOp,
    state: PartialBotsState,
    space: string,
    tagMask: WeaveNode<TagMaskOp>,
    value: WeaveNode<AuxOp>,
    values: WeaveNode<AuxOp>[]
) {
    if (value.atom.value.type !== AuxOpType.Value) {
        return state;
    }

    if (!hasValue(tagMask.atom.value.botId)) {
        return state;
    }

    if (!hasValue(tagMask.atom.value.name)) {
        return state;
    }

    const tagName = tagMask.atom.value.name;
    const id = tagMask.atom.value.botId;

    const nodes = [value, ...iterateCausalGroup(value)];
    const filtered = nodes.filter((n) => !idEquals(n.atom.id, atom.id));
    const edits = calculateOrderedEdits(filtered);

    let ops = [] as TagEditOp[];
    for (let { count, length } of findDeletePoints(
        edits,
        atom as Atom<DeleteOp>,
        op
    )) {
        if (count > 0) {
            ops.push(preserve(count));
        }
        ops.push(del(length));
    }

    if (ops.length > 0) {
        const existingValue = state?.[id]?.masks?.[space]?.[tagName];
        if (isTagEdit(existingValue)) {
            lodashMerge(state, {
                [id]: {
                    masks: {
                        [space]: {
                            [tagName]: mergeEdits(
                                existingValue,
                                edit(
                                    { [atom.id.site]: atom.id.timestamp },
                                    ...ops
                                )
                            ),
                        },
                    },
                },
            });
        } else {
            const tagEdit = edit({ [atom.id.site]: atom.id.timestamp }, ...ops);

            let finalValue: any;
            if (hasValue(existingValue)) {
                finalValue = applyEdit(existingValue, tagEdit);
            } else {
                finalValue = tagEdit;
            }

            lodashMerge(state, {
                [id]: {
                    masks: {
                        [space]: {
                            [tagName]: finalValue,
                        },
                    },
                },
            });
        }
    }

    return state;
}

/**
 * Finds all of the points that should be deleted for the given delete op and text segments.
 * @param edits The edits.
 * @param atom The delete atom.
 * @param value The delete op.
 */
export function* findDeletePoints(
    edits: TextSegment[],
    atom: Atom<DeleteOp>,
    value: DeleteOp
) {
    // The total number of characters that we have processed.
    // Used to determine where the final delete point should be.
    let count = 0;

    // The number of charactesr that we have processed
    // for the delete atom's cause.
    // Used to determine if the delete applies to an edit.
    let nodeCount = 0;

    // The number of characters that should be deleted.
    let length = 0;

    // Whether we have created a delete point during the calculation.
    let createdDelete = false;

    // NOTE: the variable cannot be named "edit" because
    // then webpack will not compile the reference to th edit() function
    // correctly.
    for (let e of edits) {
        let removedText = false;

        // We only care about edits that this delete is acting on.
        if (idEquals(e.node.atom.id, atom.cause)) {
            // We also only care about edits that this atom affects.
            // Basically we want to filter out all edits that the delete doesn't contain.
            if (nodeCount + e.marked.length > value.start) {
                // Go through each character in the edit and determine
                // if it should be deleted or if it has already been deleted.
                for (
                    let i = 0;
                    i < e.marked.length && i < value.end - e.offset;
                    i++
                ) {
                    const char = e.marked[i];
                    if (i >= value.start - e.offset) {
                        if (char !== '\0') {
                            // the character has not been deleted
                            // and is in the delete atom range so
                            // we make sure to delete it.
                            length += 1;
                        }
                    } else {
                        if (char === '\0') {
                            // Character is before where the edit takes place
                            // and has already been deleted so we adjust
                            // the edit point.
                            count -= 1;
                        }
                    }
                }

                if (length > 0) {
                    if (!createdDelete) {
                        // Take into account the starting point of the delete
                        // and the offset.
                        // Future delete points do not need this
                        // because all delete atoms represent a contigious
                        // range relative to the cause atom.
                        // As a result, all subsequent delete points
                        // will start at the same point that the edit starts.
                        count += value.start - e.offset;
                    }

                    createdDelete = true;
                    removedText = true;

                    yield {
                        count,
                        length,
                    };

                    length = 0;
                    count = 0;
                }
            }

            nodeCount += e.marked.length;
        }

        // If we created a delete point in this round then
        // we should not count the node text that the delete
        // was created for.
        if (!removedText) {
            count += e.text.length;
        }
    }
}

/**
 * Determines the number of characters that sibling nodes offset the final text insertion/deletion point.
 * @param weave The weave.
 * @param node The node that is represents the insertion/deletion operation.
 * @param offset The character offset that the insertion/deletion takes place at.
 * @param length The length of the insertion/deletion.
 */
function calculateSiblingOffset(
    weave: Weave<AuxOp>,
    node: WeaveNode<AuxOp>,
    offset: number,
    length: number
) {
    const parent = weave.getNode(node.atom.cause);
    const children = [...iterateChildren(parent)];

    let count = 0;
    let overlap = 0;
    // iterating atoms causes us to move from the newest (highest timestamps/priority) to the
    // oldest (lowest timestamps/priority).
    // We use this variable to procedurally keep track of whether the current atom is newer or older.
    // This allows the weave to use whatever logic for sorting atoms that it wants and we can adapt.
    let newer = true;
    for (let n of children) {
        if (n === node) {
            newer = false;
            continue;
        }
        if (n.atom.value.type === AuxOpType.Insert) {
            if (!newer && n.atom.value.index <= offset) {
                count += n.atom.value.text.length;
            }
        } else if (n.atom.value.type === AuxOpType.Delete) {
            if (n.atom.value.start <= offset) {
                const deleteStart = n.atom.value.start;
                const deleteEnd = n.atom.value.end;
                const deleteCount = deleteEnd - deleteStart;
                const shrink = -deleteCount;

                const nodeStart = offset;
                const nodeEnd = offset + length;

                let startOffset = 0;

                // If the current atom is an insert atom and
                // it starts at the same spot that the delete does,
                // then we need to make sure that startOffset is set to 1.
                // This is because while deletes can overlap, inserts cannot overlap deletes.
                // As a result, any insert that shares a starting point with a delete
                // needs to be ordered as occuring before or after the delete.
                // Inserts that are treated as occuring before the delete will not be affected
                // by the delete while inserts that are treated as happening after the delete will be affected.
                if (
                    node.atom.value.type === AuxOpType.Insert &&
                    nodeStart <= deleteEnd
                ) {
                    startOffset = offset - n.atom.value.start;

                    if (startOffset === 0) {
                        startOffset = deleteCount;
                    }
                }

                // abcdefg
                //  |--|
                //   123

                const endOffset = 0; //Math.abs(length - deleteCount);

                const startOverlap = Math.max(0, deleteStart - nodeStart);
                const endOverlap = Math.max(0, nodeEnd - deleteEnd);
                const totalOverlap = Math.max(
                    0,
                    length - (startOverlap + endOverlap)
                );

                overlap += totalOverlap;
                count += startOffset + shrink;
            }
        }
    }

    return { offset: count, overlap };
}

/**
 * Gets the weave nodes needed for a text edit.
 * Returns the bot node, tag node, and value/insert nodes.
 */
function getTextEditNodes(weave: Weave<AuxOp>, atom: Atom<AuxOp>) {
    const nodes = weave.referenceChain(atom.id);
    const bot = nodes[nodes.length - 1];
    const value = nodes[nodes.length - 3];
    const tag = nodes[nodes.length - 2];
    const values =
        bot.atom.value.type === AuxOpType.Bot
            ? nodes.slice(0, nodes.length - 2)
            : nodes.slice(0, nodes.length - 1);

    return {
        tag,
        bot,
        value,
        values,
    };
}

function tagMaskValueAtomAddedReducer(
    weave: Weave<AuxOp>,
    atom: Atom<AuxOp>,
    value: ValueOp,
    tag: WeaveNode<TagMaskOp>,
    state: PartialBotsState,
    space: string
) {
    if (!hasValue(space)) {
        return state;
    }

    if (!hasValue(tag.atom.value.name)) {
        return state;
    }

    const tagName = tag.atom.value.name;
    const id = tag.atom.value.botId;

    const firstValue = first(iterateCausalGroup(tag));
    if (firstValue && firstValue.atom.hash !== atom.hash) {
        return state;
    }

    if (!hasValue(value.value)) {
        lodashMerge(state, {
            [id]: {
                masks: {
                    [space]: {
                        [tagName]: null as any,
                    },
                },
            },
        });
        return state;
    }

    lodashMerge(state, {
        [id]: {
            masks: {
                [space]: {
                    [tagName]: value.value,
                },
            },
        },
    });
    return state;
}

function deleteAtomAddedReducer(
    weave: Weave<AuxOp>,
    atom: Atom<AuxOp>,
    value: DeleteOp,
    state: PartialBotsState,
    space: string
): PartialBotsState {
    const parent = weave.getNode(atom.cause);

    if (!parent) {
        return state;
    }

    if (parent.atom.value.type === AuxOpType.Bot) {
        return deleteBotReducer(weave, <WeaveNode<BotOp>>parent, atom, state);
    } else if (
        parent.atom.value.type === AuxOpType.Insert ||
        parent.atom.value.type === AuxOpType.Value
    ) {
        return deleteTextReducer(weave, atom, value, state, space);
    }

    return state;
}

function certificateAtomAddedReducer(
    weave: Weave<AuxOp>,
    atom: Atom<CertificateOp>,
    value: CertificateOp,
    state: PartialBotsState
): PartialBotsState {
    const botId = certificateId(atom);
    let signerId: string;
    if (atom.cause) {
        if (!isCertificateChainValid(weave, atom)) {
            return state;
        }
        signerId = certificateId(weave.getNode(atom.cause).atom);
    } else {
        if (!validateCertSignature(null, atom)) {
            return state;
        }
        signerId = botId;
    }

    lodashMerge(state, {
        [botId]: createBot(
            botId,
            {
                keypair: value.keypair,
                signature: value.signature,
                signingCertificate: signerId,
                atom: atom,
            },
            CERTIFIED_SPACE
        ),
    });
    return state;
}

function isCertificateChainValid(
    weave: Weave<AuxOp>,
    atom: Atom<CertificateOp>
) {
    const chain = weave.referenceChain(atom.cause);
    let i = 0;
    let signee = atom;
    while (i < chain.length) {
        let signer = chain[i];

        // Ensure that the tree is structured properly
        if (signer.atom.value.type !== AuxOpType.Certificate) {
            return false;
        }

        // Check that the certificate's signature is valid
        const signerCert = <Atom<CertificateOp>>signer.atom;
        if (!validateCertSignature(signerCert, signee)) {
            return false;
        }

        if (isCertDirectlyRevoked(weave, signer)) {
            return false;
        }

        signee = signerCert;
        i++;
    }

    // Assert that the last certificate is self signed
    if (!!signee.cause) {
        return false;
    }
    if (!validateCertSignature(null, signee)) {
        return false;
    }
    let signeeRef = weave.getNode(signee.id);
    if (isCertDirectlyRevoked(weave, signeeRef)) {
        return false;
    }

    return true;
}

function revokeAtomAddedReducer(
    weave: Weave<AuxOp>,
    atom: Atom<AuxOp>,
    value: RevocationOp,
    state: PartialBotsState
): PartialBotsState {
    const parent = weave.getNode(atom.cause);

    if (!parent) {
        return state;
    }

    if (parent.atom.value.type === AuxOpType.Certificate) {
        if (
            !isRevocationValid(
                weave,
                <Atom<RevocationOp>>atom,
                <WeaveNode<CertificateOp>>parent
            )
        ) {
            return state;
        }

        return certificateRemovedAtomReducer(
            weave,
            parent.atom,
            parent.atom.value,
            parent,
            state
        );
    } else if (parent.atom.value.type === AuxOpType.Signature) {
        // The signing certificate must be the same as the one that created the signature
        if (
            !isRevocationValid(
                weave,
                <Atom<RevocationOp>>atom,
                <WeaveNode<SignatureOp>>parent
            )
        ) {
            return state;
        }

        return signatureRemovedAtomReducer(
            weave,
            parent.atom,
            parent.atom.value,
            state
        );
    }

    return state;
}

function signatureAtomAddedReducer(
    weave: Weave<AuxOp>,
    atom: Atom<AuxOp>,
    value: SignatureOp,
    state: PartialBotsState
): PartialBotsState {
    const parent = weave.getNode(atom.cause);

    if (!parent) {
        return state;
    }

    if (parent.atom.value.type !== AuxOpType.Certificate) {
        return state;
    }

    const cert = <Atom<CertificateOp>>parent.atom;
    const signature = <Atom<SignatureOp>>atom;

    const [val, tag, bot] = weave.referenceChain(value.valueId);
    if (!val || !tag || !bot) {
        return state;
    }

    if (val.atom.hash !== value.valueHash) {
        return state;
    }

    if (bot.atom.value.type !== AuxOpType.Bot) {
        return state;
    }

    if (tag.atom.value.type !== AuxOpType.Tag) {
        return state;
    }

    if (!hasValue(tag.atom.value.name)) {
        return state;
    }

    const tagName = tag.atom.value.name;
    const id = bot.atom.value.id;

    const isDeleted = isBotDeleted(bot);
    if (isDeleted) {
        return state;
    }

    if (!isCertificateChainValid(weave, cert)) {
        return state;
    }

    const realValue = <Atom<ValueOp>>val.atom;
    if (!validateSignedValue(cert, signature, realValue)) {
        return state;
    }

    const hash = tagValueHash(id, tagName, realValue.value.value);

    lodashMerge(state, {
        [id]: {
            signatures: {
                [hash]: tagName,
            },
        },
    });

    return state;
}

/**
 * Determines if the given certificate has been revoked directly.
 * @param weave The weave.
 * @param cert The certificate to check.
 */
function isCertDirectlyRevoked(weave: Weave<AuxOp>, cert: WeaveNode<AuxOp>) {
    // Check if the certificate has been revoked.
    for (let child of iterateChildren(cert)) {
        if (
            child.atom.value.type === AuxOpType.Revocation &&
            isRevocationValid(
                weave,
                <Atom<RevocationOp>>child.atom,
                <WeaveNode<CertificateOp>>cert
            )
        ) {
            return true;
        }
    }
    return false;
}

function isRevocationValid(
    weave: Weave<AuxOp>,
    revocation: Atom<RevocationOp>,
    parent: WeaveNode<CertificateOp> | WeaveNode<SignatureOp>
) {
    // The signing certificate must be the parent or a grandparent
    const chain = weave.referenceChain(parent.atom.id);
    let signingCert: WeaveNode<CertificateOp>;
    for (let node of chain) {
        if (
            node.atom.value.type === AuxOpType.Certificate &&
            node.atom.hash === revocation.value.certHash
        ) {
            signingCert = <WeaveNode<CertificateOp>>node;
            break;
        }
    }

    if (!signingCert) {
        // No signing cert - return without changes
        return false;
    }

    if (!validateRevocation(signingCert.atom, revocation, parent.atom)) {
        return false;
    }

    return true;
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

    if (result.loser.value.type === AuxOpType.Bot) {
        // Iterate all the tags of the loser
        // and delete them.
        for (let node of iterateChildren(result.loserRef)) {
            if (node.atom.value.type === AuxOpType.Tag) {
                deleteTag(node.atom, result.loser, update);
            }
        }
    } else if (result.loser.value.type === AuxOpType.Tag) {
        const bot = weave.getNode(result.loser.cause).atom;

        if (bot.value.type === AuxOpType.Bot) {
            deleteTag(result.loser, <Atom<BotOp>>bot, update);
        }
    } else if (result.loser.value.type === AuxOpType.Certificate) {
        certificateRemovedAtomReducer(
            weave,
            result.loser,
            result.loser.value,
            result.loserRef,
            update
        );
    } else if (result.loser.value.type === AuxOpType.Revocation) {
        revocationRemovedAtomReducer(
            weave,
            result.loser,
            result.loser.value,
            update
        );
    } else if (result.loser.value.type === AuxOpType.Signature) {
        signatureRemovedAtomReducer(
            weave,
            result.loser,
            result.loser.value,
            update
        );
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
    return firstValue.atom.value.type === AuxOpType.Delete;
}

function removeAtom(
    weave: Weave<AuxOp>,
    atom: Atom<AuxOp>,
    node: WeaveNode<AuxOp>,
    state: PartialBotsState
) {
    if (atom.value.type === AuxOpType.Bot) {
        return deleteBot(weave, atom.value.id, state);
    } else if (atom.value.type === AuxOpType.Value) {
        return valueRemovedAtomReducer(weave, atom, atom.value, state);
    } else if (atom.value.type === AuxOpType.Certificate) {
        return certificateRemovedAtomReducer(
            weave,
            atom,
            atom.value,
            node,
            state
        );
    } else if (atom.value.type === AuxOpType.Revocation) {
        return revocationRemovedAtomReducer(weave, atom, atom.value, state);
    } else if (atom.value.type === AuxOpType.Signature) {
        return signatureRemovedAtomReducer(weave, atom, atom.value, state);
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

    if (bot.atom.value.type !== AuxOpType.Bot) {
        return state;
    }

    if (tag.atom.value.type !== AuxOpType.Tag) {
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
        firstValue.atom.value.type === AuxOpType.Value &&
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

function certificateRemovedAtomReducer(
    weave: Weave<AuxOp>,
    atom: Atom<AuxOp>,
    value: CertificateOp,
    node: WeaveNode<AuxOp>,
    state: PartialBotsState
) {
    const id = certificateId(atom);
    lodashMerge(state, {
        [id]: null,
    });

    for (let child of iterateCausalGroup(node)) {
        if (child.atom.value.type === AuxOpType.Certificate) {
            certificateRemovedAtomReducer(
                weave,
                child.atom,
                child.atom.value,
                child,
                state
            );
        } else if (child.atom.value.type === AuxOpType.Signature) {
            signatureRemovedAtomReducer(
                weave,
                child.atom,
                child.atom.value,
                state
            );
        }
    }

    return state;
}

function signatureRemovedAtomReducer(
    weave: Weave<AuxOp>,
    atom: Atom<AuxOp>,
    value: SignatureOp,
    state: PartialBotsState
) {
    const [val, tag, bot] = weave.referenceChain(value.valueId);
    if (!val || !tag || !bot) {
        return state;
    }
    if (val.atom.hash !== value.valueHash) {
        return state;
    }
    if (val.atom.value.type !== AuxOpType.Value) {
        return state;
    }
    if (tag.atom.value.type !== AuxOpType.Tag) {
        return state;
    }
    if (bot.atom.value.type !== AuxOpType.Bot) {
        return state;
    }

    const hash = tagValueHash(
        bot.atom.value.id,
        tag.atom.value.name,
        val.atom.value.value
    );

    lodashMerge(state, {
        [bot.atom.value.id]: {
            signatures: {
                [hash]: null,
            },
        },
    });

    return state;
}

function revocationRemovedAtomReducer(
    weave: Weave<AuxOp>,
    atom: Atom<AuxOp>,
    value: RevocationOp,
    state: PartialBotsState
) {
    if (!atom.cause) {
        return state;
    }

    const parent = weave.getNode(atom.cause);

    if (!parent) {
        return state;
    }

    if (parent.atom.value.type === AuxOpType.Certificate) {
        return certificateAtomAddedReducer(
            weave,
            <Atom<CertificateOp>>parent.atom,
            parent.atom.value,
            state
        );
    }

    return state;
}

export function certificateId(atom: Atom<any>) {
    return uuidv5(atom.hash, CERT_ID_NAMESPACE);
}
