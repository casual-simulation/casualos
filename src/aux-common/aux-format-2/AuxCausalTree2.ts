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
    insertAtom,
    removeAtom,
    addResults,
    WeaveResult,
    insertAtoms,
    removeAtoms,
    AtomCardinality,
    first,
    calculateTimeFromId,
} from '@casual-simulation/causal-trees/core2';
import {
    AuxOp,
    tag,
    BotOp,
    value,
    bot,
    deleteOp,
    TagOp,
    selfSignedCert,
    signedCert,
    signedValue,
    signedRevocation,
    tagMask,
    TagMaskOp,
    insertOp,
    ValueOp,
    AuxOpType,
} from './AuxOpTypes';
import { BotsState, PartialBotsState, BotTags } from '../bots/Bot';
import reducer, { certificateId } from './AuxWeaveReducer';
import { merge } from '../utils';
import {
    apply,
    updates as stateUpdates,
    BotStateUpdates,
    isTagEdit,
} from './AuxStateHelpers';
import {
    BotActions,
    asyncError,
    CreateCertificateAction,
    asyncResult,
    enqueueAsyncResult,
    enqueueAsyncError,
} from '../bots/BotEvents';
import {
    findTagNode,
    findValueNode,
    findBotNode,
    findBotNodes,
    findValueNodeByValue,
    findTagMaskNodes,
    findEditPosition,
} from './AuxWeaveHelpers';
import { Action } from '@casual-simulation/causal-trees';

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
 * @param space The space that new bots should be placed in.
 */
export function addAuxAtom(
    tree: CausalTree<AuxOp>,
    cause: Atom<AuxOp>,
    op: AuxOp,
    priority?: number,
    space?: string,
    cardinality?: AtomCardinality
): AuxResult {
    const treeResult = addAtom(tree, cause, op, priority, cardinality);
    const update = reducer(tree.weave, treeResult.results[0], undefined, space);

    return {
        ...treeResult,
        update,
    };
}

/**
 * Inserts the given atom into the given tree.
 * @param tree The tree.
 * @param atom The atom.
 */
export function insertAuxAtom(
    tree: AuxCausalTree,
    atom: Atom<AuxOp>
): AuxResult {
    const treeResult = insertAtom(tree, atom);
    const update = reducer(tree.weave, treeResult.results[0]);

    return {
        ...treeResult,
        update,
    };
}

/**
 * Removes the atom with the given hash from the given tree.
 * @param tree The tree.
 * @param hash The atom hash.
 */
export function removeAuxAtom(tree: AuxCausalTree, hash: string): AuxResult {
    const treeResult = removeAtom(tree, hash);
    if (treeResult.results.length > 0) {
        const update = reducer(tree.weave, treeResult.results[0]);

        return {
            ...treeResult,
            update,
        };
    } else {
        return {
            ...treeResult,
            update: {},
        };
    }
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
 * Adds the results from the second result to the first result.
 * @param first The first result.
 * @param second The second result.
 */
export function addAuxResults(first: AuxResult, second: AuxResult) {
    addResults(first, second);
    first.update = merge(first.update, second.update);
    return first;
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
 * @param tree The tree that the events should be applied on top of.
 * @param actions The actions that should be applied.
 * @param space The space that new bots should be placed in.
 */
// TODO: Cleanup this function. It creates way too many extra objects and doesn't manage the return data very well.
export function applyEvents(
    tree: AuxCausalTree,
    actions: BotActions[],
    space?: string
) {
    const addAtomToTree = (
        cause: Atom<AuxOp>,
        op: AuxOp,
        priority?: number,
        cardinality?: AtomCardinality
    ) => {
        const result = addAuxAtom(
            tree,
            cause,
            op,
            priority,
            space,
            cardinality
        );
        tree = applyAuxResult(tree, result);
        return result;
    };

    const updateTag = (
        node: WeaveNode<TagOp | TagMaskOp>,
        currentVal: WeaveNode<ValueOp>,
        val: any
    ) => {
        // let valueResult: AuxResult;
        if (isTagEdit(val)) {
            let update = {};
            let updatedTree = tree as CausalTree<any>;
            let results = [] as WeaveResult[];
            const version = {
                ...val.version,
                [tree.site.id]: tree.site.time,
            };
            for (let ops of val.operations) {
                let index = 0;
                // let atoms = [] as Atom<AuxOp>[];
                for (let op of ops) {
                    if (op.type === 'preserve') {
                        index += op.count;
                    } else if (op.type === 'insert') {
                        if (op.text.length <= 0) {
                            continue;
                        }
                        const editPos = findEditPosition(
                            currentVal,
                            version,
                            index
                        );
                        if (!editPos) {
                            console.warn(
                                '[AuxCausalTree2] Unable to find edit position for insert. This likely means that the given edit version is incorrect.'
                            );
                            break;
                        }
                        const insertResult = addAtom(
                            updatedTree,
                            editPos.node.atom,
                            insertOp(editPos.index, op.text)
                        );
                        updatedTree = applyTreeResult(
                            updatedTree,
                            insertResult
                        );
                        for (let result of insertResult.results) {
                            update = reducer(tree.weave, result, update, space);
                        }
                        results.push(...insertResult.results);
                        index += op.text.length;
                    } else if (op.type === 'delete') {
                        if (op.count <= 0) {
                            continue;
                        }
                        const editPos = findEditPosition(
                            currentVal,
                            version,
                            index,
                            op.count
                        );
                        if (!editPos || editPos.length <= 0) {
                            console.warn(
                                '[AuxCausalTree2] Unable to find edit position for delete.  This likely means that the given edit version is incorrect.'
                            );
                            break;
                        }

                        for (let pos of editPos) {
                            const deleteResult = addAtom(
                                updatedTree,
                                pos.node.atom,
                                deleteOp(pos.index, pos.index + pos.count),
                                1
                            );
                            updatedTree = applyTreeResult(
                                updatedTree,
                                deleteResult
                            );
                            for (let result of deleteResult.results) {
                                update = reducer(
                                    tree.weave,
                                    result,
                                    update,
                                    space
                                );
                            }
                            results.push(...deleteResult.results);
                        }
                        // Increment the index because deletions do not affect the value node character indexes.
                        index += op.count;
                    }
                }
            }

            let auxResult: AuxResult = {
                newSite: updatedTree.site,
                results: results,
                update: update,
            };
            tree = applyAuxResult(tree, auxResult);
            return auxResult;
        } else {
            return addAtomToTree(node.atom, value(val));
        }
    };

    const updateTags = (bot: WeaveNode<BotOp>, tags: BotTags) => {
        let result: AuxResult = auxResultIdentity();
        for (let key in tags) {
            let node = findTagNode(bot, key);
            const val = tags[key];
            if (!node) {
                // create new tag
                const tagResult = addAtomToTree(bot.atom, tag(key));

                result = mergeAuxResults(result, tagResult);

                const newAtom = addedAtom(tagResult.results[0]);

                if (!newAtom) {
                    continue;
                }
                node = tree.weave.getNode(newAtom.id) as WeaveNode<TagOp>;
            }

            const currentVal = findValueNode(node);
            if (!currentVal || val !== currentVal.atom.value.value) {
                const valueResult = updateTag(node, currentVal, val);
                result = mergeAuxResults(result, valueResult);
                const newAtom = addedAtom(valueResult.results[0]) as Atom<
                    AuxOp
                >;
                if (newAtom && newAtom.value.type === AuxOpType.Value) {
                    const weaveResult = tree.weave.removeSiblingsBefore(
                        newAtom
                    );
                    result = mergeAuxResults(result, {
                        results: [weaveResult],
                        newSite: null,
                        update: {},
                    });
                }
            }
        }

        return result;
    };

    const updateTagMasks = (botId: string, tags: BotTags) => {
        let result: AuxResult = auxResultIdentity();
        for (let key in tags) {
            let node = first(findTagMaskNodes(tree.weave, botId, key));
            const val = tags[key];
            if (!node) {
                // create new tag
                const tagResult = addAtomToTree(null, tagMask(botId, key));

                result = mergeAuxResults(result, tagResult);

                const newAtom = addedAtom(tagResult.results[0]);

                if (!newAtom) {
                    continue;
                }
                node = tree.weave.getNode(newAtom.id) as WeaveNode<TagMaskOp>;
            }

            const currentVal = findValueNode(node);
            if (!currentVal || val !== currentVal.atom.value.value) {
                const valueResult = updateTag(node, currentVal, val);
                result = mergeAuxResults(result, valueResult);

                const newAtom = addedAtom(valueResult.results[0]);
                if (newAtom && newAtom.value.type === AuxOpType.Value) {
                    const weaveResult = tree.weave.removeSiblingsBefore(
                        newAtom
                    );
                    result = mergeAuxResults(result, {
                        results: [weaveResult],
                        newSite: null,
                        update: {},
                    });
                }
            }
        }

        return result;
    };

    const prevState = tree.state;
    let result: AuxResult = auxResultIdentity();
    let returnActions: Action[] = [];

    for (let event of actions) {
        let newResult: AuxResult = auxResultIdentity();
        if (event.type === 'add_bot') {
            const botResult = addAtomToTree(null, bot(event.id));

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
            let oldResult = newResult;
            if (event.update.tags) {
                const node = findBotNode(tree.weave, event.id);
                if (node) {
                    newResult = updateTags(node, event.update.tags);
                }
            }
            if (event.update.masks && space && event.update.masks[space]) {
                newResult = updateTagMasks(event.id, event.update.masks[space]);
            }
            if (newResult === oldResult) {
                continue;
            }
        } else if (event.type == 'remove_bot') {
            for (let node of findBotNodes(tree.weave, event.id)) {
                newResult = addAtomToTree(node.atom, deleteOp(), 1);

                const newAtom = addedAtom(newResult.results[0]);
                if (newAtom) {
                    const weaveResult = tree.weave.removeSiblingsBefore(
                        newAtom
                    );
                    newResult = mergeAuxResults(newResult, {
                        results: [weaveResult],
                        newSite: null,
                        update: {},
                    });
                }
            }
        } else if (event.type === 'create_certificate') {
            if (!event.signingBotId) {
                const certOp = signedCert(
                    null,
                    event.signingPassword,
                    event.keypair
                );
                if (!certOp) {
                    enqueueAsyncError(
                        returnActions,
                        event,
                        new Error('Unable to create certificate.')
                    );
                    continue;
                }
                newResult = addAtomToTree(null, certOp, undefined, {
                    group: 'certificates',
                    number: 1,
                });
                const newAtom = addedAtom(newResult.results[0]);
                if (newAtom) {
                    const id = certificateId(newAtom);
                    const newBot = tree.state[id];
                    if (newBot) {
                        enqueueAsyncResult(returnActions, event, newBot, true);
                    } else {
                        enqueueAsyncError(
                            returnActions,
                            event,
                            new Error('Unable to create certificate.')
                        );
                    }
                } else {
                    enqueueAsyncError(
                        returnActions,
                        event,
                        new Error('Unable to create certificate.')
                    );
                }
            } else {
                const signingBot = tree.state[event.signingBotId];
                if (!signingBot) {
                    enqueueAsyncError(
                        returnActions,
                        event,
                        new Error('Unable to create certificate.')
                    );
                    continue;
                }

                try {
                    const certOp = signedCert(
                        signingBot.tags.atom,
                        event.signingPassword,
                        event.keypair
                    );
                    if (!certOp) {
                        enqueueAsyncError(
                            returnActions,
                            event,
                            new Error('Unable to create certificate.')
                        );
                        continue;
                    }
                    newResult = addAtomToTree(signingBot.tags.atom, certOp);
                    const newAtom = addedAtom(newResult.results[0]);
                    if (newAtom) {
                        const id = certificateId(newAtom);
                        const newBot = tree.state[id];
                        if (newBot) {
                            enqueueAsyncResult(
                                returnActions,
                                event,
                                newBot,
                                true
                            );
                        } else {
                            enqueueAsyncError(
                                returnActions,
                                event,
                                new Error('Unable to create certificate.')
                            );
                        }
                    } else {
                        enqueueAsyncError(
                            returnActions,
                            event,
                            new Error('Unable to create certificate.')
                        );
                    }
                } catch (err) {
                    enqueueAsyncError(
                        returnActions,
                        event,
                        new Error('Unable to create certificate.')
                    );
                    continue;
                }
            }
        } else if (event.type === 'sign_tag') {
            const signingBot = tree.state[event.signingBotId];
            if (!signingBot) {
                enqueueAsyncError(
                    returnActions,
                    event,
                    new Error('Unable to create signature.')
                );
                continue;
            }
            const botNode = findBotNode(tree.weave, event.botId);
            if (!botNode) {
                enqueueAsyncError(
                    returnActions,
                    event,
                    new Error('Unable to create signature.')
                );
                continue;
            }
            const tagNode = findTagNode(botNode, event.tag);
            if (!tagNode) {
                enqueueAsyncError(
                    returnActions,
                    event,
                    new Error('Unable to create signature.')
                );
                continue;
            }
            const valueNode = findValueNodeByValue(tagNode, event.value);
            if (!valueNode) {
                enqueueAsyncError(
                    returnActions,
                    event,
                    new Error('Unable to create signature.')
                );
                continue;
            }

            try {
                const signOp = signedValue(
                    signingBot.tags.atom,
                    event.signingPassword,
                    valueNode.atom
                );
                if (!signOp) {
                    enqueueAsyncError(
                        returnActions,
                        event,
                        new Error('Unable to create signature.')
                    );
                    continue;
                }

                newResult = addAtomToTree(signingBot.tags.atom, signOp);
                const newAtom = addedAtom(newResult.results[0]);
                if (newAtom) {
                    enqueueAsyncResult(returnActions, event, undefined);
                } else {
                    enqueueAsyncError(
                        returnActions,
                        event,
                        new Error('Unable to create signature.')
                    );
                }
            } catch (err) {
                enqueueAsyncError(
                    returnActions,
                    event,
                    new Error('Unable to create signature.')
                );
                continue;
            }
        } else if (event.type === 'revoke_certificate') {
            const signingBot = tree.state[event.signingBotId];
            if (!signingBot) {
                enqueueAsyncError(
                    returnActions,
                    event,
                    new Error(
                        'Unable to revoke certificate. Signing certificate does not exist!'
                    )
                );
                continue;
            }
            const certificateBot = tree.state[event.certificateBotId];
            if (!certificateBot) {
                enqueueAsyncError(
                    returnActions,
                    event,
                    new Error(
                        'Unable to revoke certificate. Certificate does not exist!'
                    )
                );
                continue;
            }
            try {
                const revokeOp = signedRevocation(
                    signingBot.tags.atom,
                    event.signingPassword,
                    certificateBot.tags.atom
                );
                if (!revokeOp) {
                    enqueueAsyncError(
                        returnActions,
                        event,
                        new Error('Unable to revoke certificate.')
                    );
                    continue;
                }

                newResult = addAtomToTree(signingBot.tags.atom, revokeOp);
                const newAtom = addedAtom(newResult.results[0]);
                if (newAtom) {
                    enqueueAsyncResult(returnActions, event, undefined);
                } else {
                    enqueueAsyncError(
                        returnActions,
                        event,
                        new Error('Unable to revoke certificate.')
                    );
                }
            } catch (err) {
                enqueueAsyncError(
                    returnActions,
                    event,
                    new Error('Unable to revoke certificate.')
                );
                continue;
            }
        }

        result = mergeAuxResults(result, newResult);
    }

    const updates = stateUpdates(prevState, result.update);

    return {
        tree,
        updates,
        result,
        actions: returnActions,
    };
}

/**
 * Applies the given atoms to the given tree.
 * Returns the new tree and list of updates that occurred.
 * @param tree The tree.
 * @param atoms The atoms.
 * @param removedAtoms The atoms that were removed.
 * @param space The space that the bots should have.
 */
export function applyAtoms(
    tree: AuxCausalTree,
    atoms?: Atom<AuxOp>[],
    removedAtoms?: string[],
    space?: string
) {
    let update: PartialBotsState = {};
    let results = [] as WeaveResult[];
    // if (atoms) {
    //     insertAtoms(tree, atoms, results);
    // }
    // if (removedAtoms) {
    //     removeAtoms(tree, removedAtoms, results);
    // }
    // for (let result of results) {
    //     reducer(tree.weave, result, update, space);
    // }

    if (atoms) {
        for (let atom of atoms) {
            const result = tree.weave.insert(atom);
            results.push(result);
            reducer(tree.weave, result, update, space);
            const added = addedAtom(result);
            if (added) {
                tree.site.time = calculateTimeFromId(
                    tree.site.id,
                    tree.site.time,
                    added.id.site,
                    added.id.timestamp
                );
                tree.version[added.id.site] = Math.max(
                    added.id.timestamp,
                    tree.version[added.id.site] || 0
                );
            }
        }
    }
    if (removedAtoms) {
        for (let hash of removedAtoms) {
            const node = tree.weave.getNodeByHash(hash);
            if (node) {
                const result = tree.weave.remove(node.atom);
                results.push(result);
                reducer(tree.weave, result, update, space);
            }
        }
    }
    const prevState = tree.state;
    const finalState = apply(prevState, update);
    const updates = stateUpdates(prevState, update);

    tree.state = finalState;

    return { tree, updates, results, update };
}

// /**
//  * Removes the given atoms from the given tree.
//  * Returns the new tree and a list of updates that occurred.
//  * @param tree The tree.
//  * @param hashes The atom hashes to remove.
//  */
// export function removeAtoms(tree: AuxCausalTree, hashes: string[]) {
//     const prevState = tree.state;
//     let result = auxResultIdentity();
//     for (let hash of hashes) {
//         const removeResult = removeAuxAtom(tree, hash);
//         tree = applyAuxResult(tree, removeResult);
//         result = mergeAuxResults(result, removeResult);
//     }
//     const updates = stateUpdates(prevState, result.update);

//     return { tree, updates, result };
// }
