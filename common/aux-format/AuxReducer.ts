import { AtomReducer } from "common/channels-core/AtomReducer";
import { AuxOp, AuxOpType, TagOp, FileOp, InsertOp, DeleteOp } from "./AuxOpTypes";
import { Weave, WeaveReference } from 'common/channels-core/Weave';
import { FilesState, File, Object } from "common/Files";
import { createFile, createWorkspace } from "common/Files/FileCalculations";
import { WeaveTraverser } from "common/channels-core/WeaveTraverser";
import { merge } from "common/utils";
import { AtomFactory } from "common/channels-core/AtomFactory";

export class AuxReducer implements AtomReducer<AuxOp, FilesState> {
    
    eval(weave: Weave<AuxOp>): FilesState {
        let value: FilesState = {};
        let tree = new WeaveTraverser<AuxOp>(weave);

        while (tree.peek()) {
            const atom = tree.next();

            if (atom.value.type === AuxOpType.file) {
                const id = atom.value.id;
                if (typeof value[id] === 'undefined') {
                    value[id] = this._evalFile(tree, atom, atom.value);
                }
            }
        }

        return value;
    }

    private _evalFile(tree: WeaveTraverser<AuxOp>, parent: WeaveReference<AuxOp, AuxOp>, file: FileOp): File {
        const id = file.id;
        let data: any = {};

        while (tree.peek(parent.id)) {
            const atom = tree.next();
            if (atom.value.type === AuxOpType.delete) {
                tree.skip(parent.id);
                return null;
            } else if(atom.value.type === AuxOpType.tag) {
                let { name, value } = this._evalTag(tree, atom, atom.value);
                if (typeof data[name] === 'undefined') {
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

    private _evalTag(tree: WeaveTraverser<AuxOp>, parent: WeaveReference<AuxOp, AuxOp>, tag: TagOp) {
        let name = this._evalSequence(tree.fork(), parent, tag.name);
        let value: any = null;
        let hasValue = false;

        while (tree.peek(parent.id)) {
            const atom = tree.next();
            if (!hasValue && atom.value.type === AuxOpType.value) {
                hasValue = true;
                value = atom.value.value;
            }
        }

        return { name, value };
    }

    private _evalSequence(tree: WeaveTraverser<AuxOp>, parent: WeaveReference<AuxOp, AuxOp>, value: string): string {

        // list of number pairs
        let offsets: number[] = [];
        while (tree.peek(parent.id)) {
            const atom = tree.next();
            if (atom.value.type === AuxOpType.insert) {
                const text = this._evalSequence(tree, atom, atom.value.text);
                value = spliceIntoString(value, 0, atom.value.index, text, offsets);
            } else if(atom.value.type === AuxOpType.delete) {
                value = spliceIntoString(value, atom.value.end - atom.value.start, atom.value.start, '', offsets);
            }
        }

        return value;
    }
}

function spliceIntoString(str: string, deleteCount: number, index: number, text: string, offsets: number[]): string {
    const startIndex = index;
    for (let i = 0; i < offsets.length; i += 2) {
        const oIndex = offsets[i];
        if (oIndex < startIndex) {
            index = Math.max(index + offsets[i + 1], 0);
        }
    }

    offsets.push(index, text.length - deleteCount);
    return splice(str, deleteCount, index, text);
}

function splice(str: string, deleteCount: number, index: number, text: string) {
    return str.slice(0, index) + text + str.slice(index + deleteCount);
}