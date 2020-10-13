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
import { findBotNode, findBotNodes } from './AuxWeaveHelpers';
import reverse from 'lodash/reverse';
import {
    del,
    edit,
    insert,
    isTagEdit,
    mergeEdits,
    preserve,
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
        return deleteAtomAddedReducer(weave, atom, value, state);
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
    value: InsertOp,
    state: PartialBotsState,
    space: string
) {
    const { tag, bot, values } = getTextEditNodes(weave, atom);

    if (!tag) {
        return state;
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
    const id = bot.atom.value.id;

    // The number of characters to preserve
    // before the insert.
    let count = 0;
    for (let node of values) {
        if (node.atom.value.type === AuxOpType.Insert) {
            const { offset, overlap } = calculateSiblingOffset(
                weave,
                node,
                node.atom.value.index,
                node.atom.value.text.length
            );
            count += node.atom.value.index + offset;
        }
    }

    const possibleEdit = state?.[id]?.tags?.[tagName];
    if (isTagEdit(possibleEdit)) {
        lodashMerge(state, {
            [id]: {
                tags: {
                    [tagName]: mergeEdits(
                        possibleEdit,
                        edit(
                            atom.id.timestamp,
                            preserve(count),
                            insert(value.text)
                        )
                    ),
                },
            },
        });
    } else {
        lodashMerge(state, {
            [id]: {
                tags: {
                    [tagName]: edit(
                        atom.id.timestamp,
                        preserve(count),
                        insert(value.text)
                    ),
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
    state: PartialBotsState
) {
    const { tag, bot, values } = getTextEditNodes(weave, atom);

    if (!tag) {
        return state;
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
    const id = bot.atom.value.id;

    let count = 0;
    let length = value.end - value.start;
    for (let node of values) {
        if (node.atom.value.type === AuxOpType.Insert) {
            const { offset, overlap } = calculateSiblingOffset(
                weave,
                node,
                node.atom.value.index,
                node.atom.value.text.length
            );
            count += node.atom.value.index + offset;
        } else if (node.atom.value.type === AuxOpType.Delete) {
            const { offset, overlap } = calculateSiblingOffset(
                weave,
                node,
                node.atom.value.start,
                node.atom.value.end - node.atom.value.start
            );
            count = Math.max(0, count + node.atom.value.start + offset);
            length -= overlap;
        }
    }

    if (length > 0) {
        const possibleEdit = state?.[id]?.tags?.[tagName];
        if (isTagEdit(possibleEdit)) {
            lodashMerge(state, {
                [id]: {
                    tags: {
                        [tagName]: mergeEdits(
                            possibleEdit,
                            edit(
                                atom.id.timestamp,
                                preserve(count),
                                del(length)
                            )
                        ),
                    },
                },
            });
        } else {
            lodashMerge(state, {
                [id]: {
                    tags: {
                        [tagName]: edit(
                            atom.id.timestamp,
                            preserve(count),
                            del(length)
                        ),
                    },
                },
            });
        }
    }

    return state;
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
                let startOffset = 0;

                // If the current atom is an insert atom and
                // it starts at the same spot that the delete does,
                // then we need to make sure that startOffset is set to 1.
                // This is because while deletes can overlap, inserts cannot overlap deletes.
                // As a result, any insert that shares a starting point with a delete
                // needs to be ordered as occuring before or after the delete.
                // Inserts that are treated as occuring before the delete will not be affected
                // by the delete while inserts that are treated as happening after the delete will be affected.
                if (node.atom.value.type === AuxOpType.Insert) {
                    startOffset = offset - n.atom.value.start;

                    if (startOffset === 0) {
                        startOffset = deleteCount;
                    }
                }

                // abcdefg
                //  |--|
                //   123

                const endOffset = 0; //Math.abs(length - deleteCount);

                const nodeStart = offset;
                const nodeEnd = offset + length;

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
    const tag = nodes[nodes.length - 2];
    const bot = nodes[nodes.length - 1];
    const values = nodes.slice(0, nodes.length - 2);

    return {
        tag,
        bot,
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
    state: PartialBotsState
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
        return deleteTextReducer(weave, atom, value, state);
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
