import {
    Weave,
    CausalTree,
    CausalTreeOptions,
    SiteInfo,
    StoredCausalTree,
    AtomId,
    Atom,
    atomIdToString,
    atomId,
    RejectedAtom,
    AtomBatch,
    AddResult,
    mergeIntoBatch,
} from '@casual-simulation/causal-trees';
import {
    AuxOp,
    BotOp,
    TagOp,
    InsertOp,
    ValueOp,
    DeleteOp,
    AuxOpType,
} from './AuxOpTypes';
import {
    BotsState,
    BotAction,
    PartialBot,
    Bot,
    tagsOnBot,
    getBotTag,
    hasValue,
    getTag,
    cleanBot,
    AddBotAction,
    RemoveBotAction,
} from '../bots';
import { AuxReducer, AuxReducerMetadata } from './AuxReducer';
import { root, bot, tag, value, del, insert } from './AuxAtoms';
import { AuxState, AuxBot } from './AuxState';
import {
    insertIntoTagValue,
    insertIntoTagName,
    deleteFromTagValue,
    deleteFromTagName,
} from './AuxTreeCalculations';
import { flatMap, keys, isEqual } from 'lodash';
import { merge } from '../utils';

/**
 * Defines a Causal Tree for aux bots.
 */
export class AuxCausalTree extends CausalTree<
    AuxOp,
    AuxState,
    AuxReducerMetadata
> {
    /**
     * Creates a new AUX Causal Tree.
     * @param tree The stored tree that this object should be constructed from.
     * @param options The options to use.
     */
    constructor(tree: StoredCausalTree<AuxOp>, options?: CausalTreeOptions) {
        super(tree, new AuxReducer(), options);
    }

    /**
     * Creates a new root atom and adds it to the tree.
     */
    root() {
        return this.create(root(), null);
    }

    /**
     * Creates a new bot atom and adds it to the tree.
     * @param id The ID of the bot.
     */
    bot(id: string) {
        if (this.weave.atoms.length === 0) {
            throw new Error('Cannot add a bot atom without a root atom.');
        }
        return this.create(bot(id), this.weave.atoms[0]);
    }

    /**
     * Creates a new tag for a bot and adds it to the tree.
     * @param name The initial name for the tag.
     * @param botAtom The atom that this tag should be attached to.
     */
    tag(name: string, botAtom: Atom<BotOp> | AtomId) {
        return this.create(tag(name), botAtom);
    }

    /**
     * Creates a new value for a tag and adds it to the tree.
     * @param val The initial value for the tag.
     * @param tagAtom The atom that this value should be attached to.
     */
    val(val: any, tagAtom: Atom<TagOp> | AtomId) {
        return this.create(value(val), tagAtom, 1);
    }

    /**
     * Creates a new delete operation for the given bot, insertion, or value and adds it to the tree.
     * @param atom The parent atom that should be (partially) deleted.
     * @param start The start index of the deletion. If not provided then the entire parent will be deleted.
     * @param end The end index of the deletion.
     */
    delete(
        atom:
            | Atom<BotOp>
            | Atom<TagOp>
            | Atom<InsertOp>
            | Atom<ValueOp>
            | AtomId,
        start?: number,
        end?: number
    ) {
        return this.create(del(start, end), atom, 1);
    }

    /**
     * Creates a new insert operation for the given value or insertion and adds it to the tree.
     * @param index The index of the parent that this text should be inserted at.
     * @param text The text to insert.
     * @param atom The atom that the text should be inserted at.
     */
    insert(
        index: number,
        text: string,
        atom: Atom<ValueOp> | Atom<TagOp> | Atom<InsertOp> | AtomId
    ) {
        return this.create(insert(index, text), atom);
    }

    /**
     * Inserts the given text into the given tag or value on the given bot.
     * @param bot The bot that the text should be inserted into.
     * @param tag The tag that the text should be inserted into.
     * @param text The text that should be inserted.
     * @param index The index that the text should be inserted at.
     */
    insertIntoTagValue(
        bot: AuxBot,
        tag: string,
        text: string,
        index: number
    ): Promise<AddResult<InsertOp>> {
        const precalc = insertIntoTagValue(bot, tag, text, index);
        return this.createFromPrecalculated(precalc);
    }

    /**
     * Inserts the given text into the given tag name.
     * Note that after inserting the text the tag name will change.
     * @param tag The tag whose name should be updated.
     * @param text The text to insert into the tag name.
     * @param index The index that the text should be inserted at.
     */
    insertIntoTagName(
        bot: AuxBot,
        tag: string,
        text: string,
        index: number
    ): Promise<AddResult<InsertOp>> {
        const precalc = insertIntoTagName(bot, tag, text, index);
        return this.createFromPrecalculated(precalc);
    }

    /**
     * Deletes a segment of text from the given tag's value.
     * @param bot The bot that the text should be deleted from.
     * @param tag The tag that the text should be deleted from.
     * @param index The index that the text should be deleted at.
     * @param length The number of characters to delete.
     */
    deleteFromTagValue(
        bot: AuxBot,
        tag: string,
        index: number,
        length: number
    ): Promise<AtomBatch<DeleteOp>> {
        const precalc = deleteFromTagValue(bot, tag, index, length);
        return this.createManyFromPrecalculated(precalc);
    }

    /**
     * Deletes a segment of text from the given tag's name.
     * Note that after inserting the text the tag name will change.
     * @param tag The tag whose name should be updated.
     * @param index The index that the characters should be deleted from.
     * @param length The number of characters to delete.
     */
    deleteFromTagName(
        bot: AuxBot,
        tag: string,
        index: number,
        length: number
    ): Promise<AtomBatch<DeleteOp>> {
        const precalc = deleteFromTagName(bot, tag, index, length);
        return this.createManyFromPrecalculated(precalc);
    }

    /**
     * Adds the given events to the tree.
     * @param events The events to add to the tree.
     * @param value The optional precalculated value to use for resolving tree references.
     */
    async addEvents(
        events: BotAction[],
        value?: AuxState
    ): Promise<AtomBatch<AuxOp>> {
        return await this.batch(async () => {
            value = value || this.value;
            let added: Atom<AuxOp>[] = [];
            let rejected: RejectedAtom<AuxOp>[] = [];
            let archived: Atom<AuxOp>[] = [];

            // Merge add_bot and update_bot events for the same bot
            events = mergeEvents(events);

            for (let i = 0; i < events.length; i++) {
                let e = events[i];
                let batch: AtomBatch<AuxOp>;
                if (e.type === 'update_bot') {
                    const bot = value[e.id];
                    batch = await this.updateBot(bot, e.update);
                } else if (e.type === 'add_bot') {
                    batch = await this.addBot(e.bot);
                } else if (e.type === 'remove_bot') {
                    const bot = value[e.id];
                    batch = await this.removeBot(bot);
                } else if (e.type === 'transaction') {
                    batch = await this.addEvents(e.events, value);
                } else if (e.type === 'apply_state') {
                    batch = await this.applyState(e.state, value);
                }

                if (batch) {
                    added.push(...batch.added);
                    rejected.push(...batch.rejected);
                    archived.push(...batch.archived);
                }
            }

            return {
                added,
                rejected,
                archived,
            };
        });
    }

    /**
     * Removes the given bot from the state by marking it as deleted.
     * @param bot The bot to remove.
     */
    async removeBot(bot: AuxBot): Promise<AtomBatch<DeleteOp>> {
        if (!bot) {
            return {
                added: [],
                rejected: [],
                archived: [],
            };
        }
        const result = await this.delete(bot.metadata.ref);
        if (result.added) {
            return {
                added: [result.added],
                rejected: [],
                archived: [],
            };
        } else {
            return {
                added: [],
                rejected: [result.rejected],
                archived: [],
            };
        }
    }

    /**
     * Adds the given bot to the tree.
     * @param bot The bot to add to the tree.
     */
    async addBot(bot: Bot): Promise<AtomBatch<AuxOp>> {
        return await this.batch(async () => {
            const f = await this.bot(bot.id);
            if (f.rejected) {
                return {
                    added: [],
                    rejected: [f.rejected],
                    archived: [],
                };
            }
            let tags = tagsOnBot(bot);
            let promises = tags.map(async t => {
                const tag = await this.tag(t, f.added);
                if (tag.rejected) {
                    return [tag];
                }
                const val = await this.val(bot.tags[t], tag.added);
                return [tag, val];
            });

            const results = await Promise.all(promises);
            const refs = flatMap(results);
            return mergeIntoBatch<AuxOp>([f, ...refs]);
        });
    }

    /**
     * Updates the given bot.
     * @param bot The bot to update.
     * @param newData The new data to include in the bot.
     */
    async updateBot(
        bot: AuxBot,
        newData: PartialBot
    ): Promise<AtomBatch<AuxOp>> {
        if (!bot) {
            return { added: [], rejected: [], archived: [] };
        }
        return await this.batch(async () => {
            let tags = tagsOnBot(newData);
            let promises = tags.map(async t => {
                const tagMeta = bot.metadata.tags[t];
                let newVal = getTag(newData, t);
                if (tagMeta) {
                    const oldVal = getBotTag(bot, t);
                    if (
                        newVal &&
                        oldVal &&
                        typeof newVal === 'object' &&
                        typeof oldVal === 'object' &&
                        !Array.isArray(newVal) &&
                        !Array.isArray(oldVal)
                    ) {
                        newVal = merge(oldVal, newVal);
                    }

                    const hasOld = hasValue(oldVal);
                    const hasNew = hasValue(newVal);
                    if (!isEqual(oldVal, newVal) && (hasOld || hasNew)) {
                        // tag is on the bot
                        const val = await this.val(newVal, tagMeta.ref);
                        return [val];
                    } else {
                        return [];
                    }
                } else {
                    const tag = await this.tag(t, bot.metadata.ref);
                    if (tag.rejected) {
                        return [tag];
                    }
                    const val = await this.val(newVal, tag.added);
                    return [tag, val];
                }
            });
            let results = await Promise.all(promises);
            let refs = flatMap(results);

            let added = refs.map(r => r.added).filter(a => a);
            let rejected = refs.map(r => r.rejected).filter(a => a);

            return {
                added,
                rejected,
                archived: [],
            };
        });
    }

    /**
     * Applies the given state to the tree.
     * This is like running a batch update bot operation.
     * @param state The state to add/update in the tree.
     * @param value The optional precalculated value to use for resolving tree references.
     */
    async applyState(
        state: BotsState,
        value?: AuxState
    ): Promise<AtomBatch<AuxOp>> {
        value = value || this.value;
        const bots = keys(state);
        const promises = bots.map(id => {
            const existing = value[id];
            const newBot = state[id];
            if (existing) {
                return this.updateBot(existing, newBot);
            } else {
                return this.addBot(newBot);
            }
        });
        const results = await Promise.all(promises);
        let added = flatMap(results, r => r.added);
        let rejected = flatMap(results, r => r.rejected);

        return {
            added,
            rejected,
            archived: [],
        };
    }

    async fork(): Promise<AuxCausalTree> {
        const stored = this.export();
        const tree = new AuxCausalTree(stored, this._options);
        await tree.import(stored);
        return tree;
    }

    protected collectGarbage(refs: Atom<AuxOp>[]): Atom<AuxOp>[] {
        let removed: Atom<AuxOp>[] = [];
        for (let i = 0; i < refs.length; i++) {
            const atom = refs[i];
            let newlyRemoved: Atom<AuxOp>[] = [];

            if (atom.value.type === AuxOpType.value) {
                newlyRemoved = this.weave.removeBefore(atom);

                checkRemovedAtoms(atom, newlyRemoved, AuxOpType.value);
            } else if (atom.value.type === AuxOpType.delete) {
                if (typeof atom.value.start === 'undefined') {
                    newlyRemoved = this.weave.removeBefore(atom);
                    checkRemovedAtoms(atom, newlyRemoved, AuxOpType.tag);
                }
            }

            removed.push(...newlyRemoved);
        }
        return removed;
    }
}

function mergeEvents(events: BotAction[]) {
    let addedBots = new Map<string, AddBotAction>();
    let removedBots = new Map<string, RemoveBotAction>();
    let finalEvents = mergeEventsCore(events, addedBots, removedBots);
    for (let [id, event] of addedBots) {
        if (event) {
            finalEvents.push(event);
        }
    }
    return finalEvents;
}

function mergeEventsCore(
    events: BotAction[],
    addedBots?: Map<string, AddBotAction>,
    removedBots?: Map<string, RemoveBotAction>
) {
    let finalEvents: BotAction[] = [];
    for (let e of events) {
        if (e.type === 'add_bot') {
            addedBots.set(e.id, e);
        } else if (e.type === 'remove_bot') {
            removedBots.set(e.id, e);
            if (addedBots.has(e.id)) {
                addedBots.set(e.id, null);
            } else {
                finalEvents.push(e);
            }
        } else if (e.type === 'update_bot') {
            if (addedBots.has(e.id)) {
                const a = addedBots.get(e.id);
                if (a) {
                    a.bot = merge(a.bot, e.update);
                }
            } else if (!removedBots.has(e.id)) {
                finalEvents.push(e);
            }
        } else if (e.type === 'transaction') {
            finalEvents.push(
                ...mergeEventsCore(e.events, addedBots, removedBots)
            );
        } else {
            finalEvents.push(e);
        }
    }

    return finalEvents;
}

function checkRemovedAtoms(
    atom: Atom<AuxOp>,
    newlyRemoved: Atom<AuxOp>[],
    type: AuxOpType
) {
    for (let j = 0; j < newlyRemoved.length; j++) {
        const r = newlyRemoved[j];
        if (r.value.type < type) {
            console.error(
                `[AuxCausalTree] Removed atom of type: ${
                    r.value.type
                } (${atomIdToString(r.id)}) incorrectly.`
            );
            console.error(
                `[AuxCausalTree] This happened while removing ${atomIdToString(
                    atom.id
                )}`
            );
            debugger;
        }
    }
}

/**
 * Gets the bot state from the given stored causal tree.
 * @param stored The stored tree to load.
 */
export async function getBotsStateFromStoredTree(
    stored: StoredCausalTree<AuxOp>
) {
    let value: BotsState;
    if (stored.site && stored.knownSites && stored.weave) {
        console.log('[AppManager] Importing Weave.');

        // Don't try to import the tree because it's like trying to
        // import an unrelated Git repo. Git handles this by allowing
        // multiple root nodes but we dont allow multiple roots.
        const tree = <AuxCausalTree>new AuxCausalTree(stored);
        await tree.import(stored);
        value = tree.value;
    } else {
        console.log('[AppManager] Old bot detected, adding state.');
        value = <BotsState>(<unknown>stored);
    }

    return value;
}
