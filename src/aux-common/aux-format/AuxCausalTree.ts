import { Weave } from '../causal-trees/Weave';
import { AuxOp, FileOp, TagOp, InsertOp, ValueOp, DeleteOp, AuxOpType } from './AuxOpTypes';
import { CausalTree, CausalTreeOptions } from '../causal-trees/CausalTree';
import { FilesState, FileEvent, PartialFile, Object, File, Workspace, tagsOnFile, getFileTag, hasValue, getTag, cleanFile } from '../Files';
import { AuxReducer, AuxReducerMetadata } from './AuxReducer';
import { root, file, tag, value, del, insert } from './AuxAtoms';
import { AtomId, Atom, atomIdToString, atomId } from '../causal-trees/Atom';
import { SiteInfo } from '../causal-trees/SiteIdInfo';
import { StoredCausalTree } from '../causal-trees/StoredCausalTree';
import { AuxState, AuxTagMetadata, AuxValueMetadata, AuxFile } from './AuxState';
import { getTagMetadata, insertIntoTagValue, insertIntoTagName, deleteFromTagValue, deleteFromTagName } from './AuxTreeCalculations';
import { flatMap, keys, isEqual } from 'lodash';
import { merge } from '../utils';

/**
 * Defines a Causal Tree for aux files.
 */
export class AuxCausalTree extends CausalTree<AuxOp, AuxState, AuxReducerMetadata> {

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
    delete(atom: Atom<FileOp> | Atom<TagOp> | Atom<InsertOp> | Atom<ValueOp> | AtomId, start?: number, end?: number) {
        return this.create(del(start, end), atom, 1);
    }

    /**
     * Creates a new insert operation for the given value or insertion and adds it to the tree.
     * @param index The index of the parent that this text should be inserted at.
     * @param text The text to insert.
     * @param atom The atom that the text should be inserted at.
     */
    insert(index: number, text: string, atom: Atom<ValueOp> | Atom<TagOp> | Atom<InsertOp> | AtomId) {
        return this.create(insert(index, text), atom);
    }

    /**
     * Inserts the given text into the given tag or value on the given file.
     * @param file The file that the text should be inserted into.
     * @param tag The tag that the text should be inserted into.
     * @param text The text that should be inserted. 
     * @param index The index that the text should be inserted at.
     */
    insertIntoTagValue(file: AuxFile, tag: string, text: string, index: number): Promise<Atom<InsertOp>> {
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
    insertIntoTagName(file: AuxFile, tag: string, text: string, index: number): Promise<Atom<InsertOp>> {
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
    deleteFromTagValue(file: AuxFile, tag: string, index: number, length: number): Promise<Atom<DeleteOp>[]> {
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
    deleteFromTagName(file: AuxFile, tag: string, index: number, length: number): Promise<Atom<DeleteOp>[]> {
        const precalc = deleteFromTagName(file, tag, index, length);
        return this.createManyFromPrecalculated(precalc);
    }

    /**
     * Adds the given events to the tree.
     * @param events The events to add to the tree.
     * @param value The optional precalculated value to use for resolving tree references.
     */
    async addEvents(events: FileEvent[], value?: AuxState): Promise<Atom<AuxOp>[]> {
        return await this.batch(async () => {
            value = value || this.value;
            const promises = events.map(e => {
                if (e.type === 'file_updated') {
                    const file = value[e.id];
                    return this.updateFile(file, e.update);
                } else if(e.type === 'file_added') {
                    return this.addFile(e.file);
                } else if(e.type === 'file_removed') {
                    const file = value[e.id];
                    return this.removeFile(file);
                } else if(e.type === 'transaction') {
                    return this.addEvents(e.events, value);
                } else if(e.type === 'apply_state') {
                    return this.applyState(e.state, value);
                }
            });
            const vals = await Promise.all(promises);
            const results = flatMap(vals);
            return results;
        });
    }
    
    /**
     * Removes the given file from the state by marking it as deleted.
     * @param file The file to remove.
     */
    async removeFile(file: AuxFile): Promise<Atom<AuxOp>[]> {
        if (!file) {
            return [];
        }
        return [await this.delete(file.metadata.ref)];
    }
    
    /**
     * Adds the given file to the tree.
     * @param file The file to add to the tree.
     */
    async addFile(file: File): Promise<Atom<AuxOp>[]> {
        return await this.batch(async () => {
            const f = await this.file(file.id);
            let tags = tagsOnFile(file);
            let promises = tags.map(async t => {
                const tag = await this.tag(t, f);
                const val = await this.val(file.tags[t], tag);
                return [tag, val];
            });
            
            const results = await Promise.all(promises);
            const refs = flatMap(results);

            return [
                f,
                ...refs
            ];
        });
    }

    /**
     * Updates the given file.
     * @param file The file to update.
     * @param newData The new data to include in the file.
     */
    async updateFile(file: AuxFile, newData: PartialFile): Promise<Atom<AuxOp>[]> {
        return await this.batch(async () => {
            let tags = tagsOnFile(newData);
            let promises = tags.map(async t => {
                const tagMeta = file.metadata.tags[t];
                let newVal = getTag(newData, t);
                if (tagMeta) {
                    const oldVal = getFileTag(file, t);
                    if (newVal && typeof newVal === 'object' && !Array.isArray(newVal) && !Array.isArray(oldVal)) {
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
                    const val = await this.val(newVal, tag);
                    return [tag, val];
                }
            });
            let results = await Promise.all(promises);
            let refs = flatMap(results);

            return refs;
        });
    }

    /**
     * Applies the given state to the tree.
     * This is like running a batch update file operation.
     * @param state The state to add/update in the tree.
     * @param value The optional precalculated value to use for resolving tree references.
     */
    async applyState(state: FilesState, value?: AuxState): Promise<Atom<AuxOp>[]> {
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
        let refs = flatMap(results);
        return refs;
    }

    fork(): AuxCausalTree {
        const stored = this.export();
        return new AuxCausalTree(stored);
    }

    protected collectGarbage(refs: Atom<AuxOp>[]): Atom<AuxOp>[] {
        let removed: Atom<AuxOp>[] = [];
        for (let i = 0; i < refs.length; i++) {
            const atom = refs[i];
            if (atom.value.type === AuxOpType.value) {
                const newlyRemoved = this.weave.removeBefore(atom);
                for (let j = 0; j < newlyRemoved.length; j++) {
                    const r = newlyRemoved[j];
                    if (r.value.type < AuxOpType.value) {
                        console.error(`[AuxCausalTree] Removed atom of type: ${r.value.type} (${atomIdToString(r.id)}) incorrectly.`);
                        console.error(`[AuxCausalTree] This happened while removing ${atomIdToString(atom.id)}`);
                        debugger;
                    }
                }
                removed.push(...newlyRemoved);
            }
        }
        return removed;
    }
}