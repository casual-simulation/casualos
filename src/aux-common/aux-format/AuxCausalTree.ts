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
    FileOp,
    TagOp,
    InsertOp,
    ValueOp,
    DeleteOp,
    AuxOpType,
} from './AuxOpTypes';
import {
    FilesState,
    BotAction,
    PartialFile,
    File,
    tagsOnFile,
    getFileTag,
    hasValue,
    getTag,
    cleanFile,
    AddBotAction,
    RemoveBotAction,
} from '../Files';
import { AuxReducer, AuxReducerMetadata } from './AuxReducer';
import { root, file, tag, value, del, insert } from './AuxAtoms';
import { AuxState, AuxFile } from './AuxState';
import {
    insertIntoTagValue,
    insertIntoTagName,
    deleteFromTagValue,
    deleteFromTagName,
} from './AuxTreeCalculations';
import { flatMap, keys, isEqual } from 'lodash';
import { merge } from '../utils';

/**
 * Defines a Causal Tree for aux files.
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
     * Creates a new file atom and adds it to the tree.
     * @param id The ID of the file.
     */
    file(id: string) {
        if (this.weave.atoms.length === 0) {
            throw new Error('Cannot add a file atom without a root atom.');
        }
        return this.create(file(id), this.weave.atoms[0]);
    }

    /**
     * Creates a new tag for a file and adds it to the tree.
     * @param name The initial name for the tag.
     * @param fileAtom The atom that this tag should be attached to.
     */
    tag(name: string, fileAtom: Atom<FileOp> | AtomId) {
        return this.create(tag(name), fileAtom);
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
     * Creates a new delete operation for the given file, insertion, or value and adds it to the tree.
     * @param atom The parent atom that should be (partially) deleted.
     * @param start The start index of the deletion. If not provided then the entire parent will be deleted.
     * @param end The end index of the deletion.
     */
    delete(
        atom:
            | Atom<FileOp>
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
     * Inserts the given text into the given tag or value on the given file.
     * @param file The file that the text should be inserted into.
     * @param tag The tag that the text should be inserted into.
     * @param text The text that should be inserted.
     * @param index The index that the text should be inserted at.
     */
    insertIntoTagValue(
        file: AuxFile,
        tag: string,
        text: string,
        index: number
    ): Promise<AddResult<InsertOp>> {
        const precalc = insertIntoTagValue(file, tag, text, index);
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
        file: AuxFile,
        tag: string,
        text: string,
        index: number
    ): Promise<AddResult<InsertOp>> {
        const precalc = insertIntoTagName(file, tag, text, index);
        return this.createFromPrecalculated(precalc);
    }

    /**
     * Deletes a segment of text from the given tag's value.
     * @param file The file that the text should be deleted from.
     * @param tag The tag that the text should be deleted from.
     * @param index The index that the text should be deleted at.
     * @param length The number of characters to delete.
     */
    deleteFromTagValue(
        file: AuxFile,
        tag: string,
        index: number,
        length: number
    ): Promise<AtomBatch<DeleteOp>> {
        const precalc = deleteFromTagValue(file, tag, index, length);
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
        file: AuxFile,
        tag: string,
        index: number,
        length: number
    ): Promise<AtomBatch<DeleteOp>> {
        const precalc = deleteFromTagName(file, tag, index, length);
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

            // Merge add_bot and update_bot events for the same file
            events = mergeEvents(events);

            for (let i = 0; i < events.length; i++) {
                let e = events[i];
                let batch: AtomBatch<AuxOp>;
                if (e.type === 'update_bot') {
                    const file = value[e.id];
                    batch = await this.updateFile(file, e.update);
                } else if (e.type === 'add_bot') {
                    batch = await this.addFile(e.file);
                } else if (e.type === 'remove_bot') {
                    const file = value[e.id];
                    batch = await this.removeFile(file);
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
     * Removes the given file from the state by marking it as deleted.
     * @param file The file to remove.
     */
    async removeFile(file: AuxFile): Promise<AtomBatch<DeleteOp>> {
        if (!file) {
            return {
                added: [],
                rejected: [],
                archived: [],
            };
        }
        const result = await this.delete(file.metadata.ref);
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
     * Adds the given file to the tree.
     * @param file The file to add to the tree.
     */
    async addFile(file: File): Promise<AtomBatch<AuxOp>> {
        return await this.batch(async () => {
            const f = await this.file(file.id);
            if (f.rejected) {
                return {
                    added: [],
                    rejected: [f.rejected],
                    archived: [],
                };
            }
            let tags = tagsOnFile(file);
            let promises = tags.map(async t => {
                const tag = await this.tag(t, f.added);
                if (tag.rejected) {
                    return [tag];
                }
                const val = await this.val(file.tags[t], tag.added);
                return [tag, val];
            });

            const results = await Promise.all(promises);
            const refs = flatMap(results);
            return mergeIntoBatch<AuxOp>([f, ...refs]);
        });
    }

    /**
     * Updates the given file.
     * @param file The file to update.
     * @param newData The new data to include in the file.
     */
    async updateFile(
        file: AuxFile,
        newData: PartialFile
    ): Promise<AtomBatch<AuxOp>> {
        if (!file) {
            return { added: [], rejected: [], archived: [] };
        }
        return await this.batch(async () => {
            let tags = tagsOnFile(newData);
            let promises = tags.map(async t => {
                const tagMeta = file.metadata.tags[t];
                let newVal = getTag(newData, t);
                if (tagMeta) {
                    const oldVal = getFileTag(file, t);
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
                        // tag is on the file
                        const val = await this.val(newVal, tagMeta.ref);
                        return [val];
                    } else {
                        return [];
                    }
                } else {
                    const tag = await this.tag(t, file.metadata.ref);
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
     * This is like running a batch update file operation.
     * @param state The state to add/update in the tree.
     * @param value The optional precalculated value to use for resolving tree references.
     */
    async applyState(
        state: FilesState,
        value?: AuxState
    ): Promise<AtomBatch<AuxOp>> {
        value = value || this.value;
        const files = keys(state);
        const promises = files.map(id => {
            const existing = value[id];
            const newFile = state[id];
            if (existing) {
                return this.updateFile(existing, newFile);
            } else {
                return this.addFile(newFile);
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
    let addedFiles = new Map<string, AddBotAction>();
    let removedFiles = new Map<string, RemoveBotAction>();
    let finalEvents = mergeEventsCore(events, addedFiles, removedFiles);
    for (let [id, event] of addedFiles) {
        if (event) {
            finalEvents.push(event);
        }
    }
    return finalEvents;
}

function mergeEventsCore(
    events: BotAction[],
    addedFiles?: Map<string, AddBotAction>,
    removedFiles?: Map<string, RemoveBotAction>
) {
    let finalEvents: BotAction[] = [];
    for (let e of events) {
        if (e.type === 'add_bot') {
            addedFiles.set(e.id, e);
        } else if (e.type === 'remove_bot') {
            removedFiles.set(e.id, e);
            if (addedFiles.has(e.id)) {
                addedFiles.set(e.id, null);
            } else {
                finalEvents.push(e);
            }
        } else if (e.type === 'update_bot') {
            if (addedFiles.has(e.id)) {
                const a = addedFiles.get(e.id);
                if (a) {
                    a.file = merge(a.file, e.update);
                }
            } else if (!removedFiles.has(e.id)) {
                finalEvents.push(e);
            }
        } else if (e.type === 'transaction') {
            finalEvents.push(
                ...mergeEventsCore(e.events, addedFiles, removedFiles)
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
 * Gets the file state from the given stored causal tree.
 * @param stored The stored tree to load.
 */
export async function getFilesStateFromStoredTree(
    stored: StoredCausalTree<AuxOp>
) {
    let value: FilesState;
    if (stored.site && stored.knownSites && stored.weave) {
        console.log('[AppManager] Importing Weave.');

        // Don't try to import the tree because it's like trying to
        // import an unrelated Git repo. Git handles this by allowing
        // multiple root nodes but we dont allow multiple roots.
        const tree = <AuxCausalTree>new AuxCausalTree(stored);
        await tree.import(stored);
        value = tree.value;
    } else {
        console.log('[AppManager] Old file detected, adding state.');
        value = <FilesState>(<unknown>stored);
    }

    return value;
}
