import { AtomReducer } from "../channels-core/AtomReducer";
import { AuxOp, AuxOpType, TagOp, FileOp, InsertOp, DeleteOp } from "./AuxOpTypes";
import { Weave, WeaveReference } from '../channels-core/Weave';
import { FilesState, File, Object } from "../Files";
import { createFile, createWorkspace } from "../Files/FileCalculations";
import { WeaveTraverser } from "../channels-core/WeaveTraverser";
import { merge, splice } from "../utils";
import { AtomFactory } from "../channels-core/AtomFactory";

export class AuxReducer implements AtomReducer<AuxOp, FilesState> {
    
    eval(weave: Weave<AuxOp>): FilesState {
        let value: FilesState = {};
        let tree = new WeaveTraverser<AuxOp>(weave);

        while (tree.peek()) {
            const ref = tree.next();

            if (ref.atom.value.type === AuxOpType.file) {
                const id = ref.atom.value.id;
                if (typeof value[id] === 'undefined') {
                    value[id] = this._evalFile(tree, ref, ref.atom.value);
                }
            }
        }

        return value;
    }

    private _evalFile(tree: WeaveTraverser<AuxOp>, parent: WeaveReference<AuxOp>, file: FileOp): File {
        const id = file.id;
        let data: any = {};

        while (tree.peek(parent.atom.id)) {
            const ref = tree.next();
            if (ref.atom.value.type === AuxOpType.delete) {
                tree.skip(parent.atom.id);
                return null;
            } else if(ref.atom.value.type === AuxOpType.tag) {
                let name = this.evalSequence(tree.fork(), ref, ref.atom.value.name);
                if (name && typeof data[name] === 'undefined') {
                    let value = this._evalTag(tree, ref, ref.atom.value);
                    data[name] = value;
                }
            }
        }

        if (file.fileType === 'object') {
            let file = createFile(id);
            file.tags = merge(file.tags, data);
            return file;
        } else {
            let workspace = createWorkspace(id);
            workspace = merge(workspace, data);
            return workspace;
        }
    }

    private _evalTag(tree: WeaveTraverser<AuxOp>, parent: WeaveReference<AuxOp>, tag: TagOp) {
        let value: any = null;
        let hasValue = false;

        while (tree.peek(parent.atom.id)) {
            const ref = tree.next();
            if (!hasValue && ref.atom.value.type === AuxOpType.value) {
                hasValue = true;
                value = ref.atom.value.value;
            }
        }

        return value;
    }

    public evalSequence(tree: WeaveTraverser<AuxOp>, parent: WeaveReference<AuxOp>, value: string): string {

        // list of number pairs
        let offsets: number[] = [];
        while (tree.peek(parent.atom.id)) {
            const ref = tree.next();
            if (ref.atom.value.type === AuxOpType.delete) {
                const start = Math.max(ref.atom.value.start || 0, 0);
                const end = ref.atom.value.end || value.length;
                const length = end - start;
                const offset = calculateOffsetForIndex(start, offsets, true);
                const index = start + offset;
                const deleteCount = length + offset;
                offsets.push(index, -deleteCount);
                value = splice(value, index, deleteCount, '');
            } else if (ref.atom.value.type === AuxOpType.insert) {
                const text = this.evalSequence(tree, ref, ref.atom.value.text);
                const offset = calculateOffsetForIndex(ref.atom.value.index, offsets, false);
                const index = ref.atom.value.index + offset;
                offsets.push(index, text.length);
                value = splice(value, index, 0, text);
            }
        }

        return value;
    }
}

function calculateOffsetForIndex(index: number, offsets: number[], isDelete: boolean) {
    const startIndex = index;
    let offset = 0;
    for (let i = 0; i < offsets.length; i += 2) {
        const oIndex = offsets[i];
        if(isDelete) {
            if (oIndex <= startIndex) {
               offset += offsets[i + 1];
            }
        } else {
            if (oIndex < startIndex) {
                offset += + offsets[i + 1];
            }
        }
    }
    return offset;
}