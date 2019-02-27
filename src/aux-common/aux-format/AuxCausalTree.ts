import { Weave, WeaveReference } from '../channels-core/Weave';
import { AuxOp, FileOp, TagOp, InsertOp, ValueOp, DeleteOp } from './AuxOpTypes';
import { CausalTree } from '../channels-core/CausalTree';
import { FilesState, FileType } from '../Files';
import { AuxReducer, calculateSequenceRef, calculateSequenceRefs } from './AuxReducer';
import { root, file, tag, value, del, insert } from './AuxAtoms';
import { AtomId, Atom } from '../channels-core/Atom';
import { SiteInfo } from '../channels-core/SiteIdInfo';
import { StoredCausalTree } from '../channels-core/StoredCausalTree';
import { AuxState, AuxTagMetadata, AuxValueMetadata, AuxFile } from './AuxState';

/**
 * Defines a Causal Tree for aux files.
 */
export class AuxCausalTree extends CausalTree<AuxOp, AuxState> {
    
    constructor(tree: StoredCausalTree<AuxOp>) {
        super(tree, new AuxReducer());
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
    file(id: string, type: FileType) {
        return this.create(file(id, type), this.weave.atoms[0]);
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
    insertIntoTagValue(file: AuxFile, tag: string, text: string, index: number): WeaveReference<InsertOp> {
        const tagMeta = this._getTagMetadata(file, tag);
        if (tagMeta) {
            const result = calculateSequenceRef(tagMeta.value.sequence, index);
            return this.insert(result.index, text, <Atom<TagOp>>result.ref.atom);
        } else {
            return null;
        }
    }

    /**
     * Inserts the given text into the given tag name.
     * Note that after inserting the text the tag name will change.
     * @param tag The tag whose name should be updated.
     * @param text The text to insert into the tag name.
     * @param index The index that the text should be inserted at.
     */
    insertIntoTagName(file: AuxFile, tag: string, text: string, index: number): WeaveReference<InsertOp> {
        const tagMeta = this._getTagMetadata(file, tag);
        if (tagMeta) {
            const result = calculateSequenceRef(tagMeta.name, index);
            return this.insert(result.index, text, <Atom<TagOp>>result.ref.atom);
        } else {
            return null;
        }
    }

    /**
     * Deletes a segment of text from the given tag's value.
     * @param file The file that the text should be deleted from.
     * @param tag The tag that the text should be deleted from.
     * @param index The index that the text should be deleted at.
     * @param length The number of characters to delete.
     */
    deleteFromTagValue(file: AuxFile, tag: string, index: number, length: number): WeaveReference<DeleteOp>[] {
        const tagMeta = this._getTagMetadata(file, tag);
        if (tagMeta) {
            const result = calculateSequenceRefs(tagMeta.value.sequence, index, length);
            return result.map(r => this.delete(<Atom<TagOp>>r.ref.atom, r.index, r.index + r.length));
        } else {
            return null;
        }
    }

    /**
     * Deletes a segment of text from the given tag's name.
     * Note that after inserting the text the tag name will change.
     * @param tag The tag whose name should be updated.
     * @param index The index that the characters should be deleted from.
     * @param length The number of characters to delete. 
     */
    deleteFromTagName(file: AuxFile, tag: string, index: number, length: number): WeaveReference<DeleteOp>[] {
        const tagMeta = this._getTagMetadata(file, tag);
        if (tagMeta) {
            const result = calculateSequenceRefs(tagMeta.name, index);
            return result.map(r => this.delete(<Atom<TagOp>>r.ref.atom, r.index, r.index + r.length));
        } else {
            return null;
        }
    }

    private _getTagMetadata(file: AuxFile, tag: string): AuxTagMetadata {
        if (file && file.metadata && file.metadata.tags[tag]) {
            return file.metadata.tags[tag];
        } else {
            return null;
        }
    }
}