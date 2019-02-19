import { Weave, WeaveReference } from "../channels-core/Weave";
import { AuxOp, FileOp, TagOp, InsertOp, ValueOp } from "./AuxOpTypes";
import { CausalTree } from "../channels-core/CausalTree";
import { FilesState, FileType } from "../Files";
import { AuxReducer } from "./AuxReducer";
import { root, file, tag, value, del, insert } from "./AuxAtoms";
import { AtomId, Atom } from "../channels-core/Atom";

/**
 * Defines a Causal Tree for aux files.
 */
export class AuxCausalTree extends CausalTree<AuxOp, FilesState> {
    constructor(site: number) {
        super(site, new AuxReducer());
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
}