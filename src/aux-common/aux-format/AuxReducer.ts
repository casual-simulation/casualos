import { AtomReducer } from "../channels-core/AtomReducer";
import { AuxOp, AuxOpType, TagOp, FileOp, InsertOp, DeleteOp } from "./AuxOpTypes";
import { Weave, WeaveReference } from '../channels-core/Weave';
import { FilesState, File, Object } from "../Files";
import { createFile, createWorkspace } from "../Files/FileCalculations";
import { WeaveTraverser } from "../channels-core/WeaveTraverser";
import { merge, splice } from "../utils";
import { AtomFactory } from "../channels-core/AtomFactory";
import { AuxFile, AuxObject, AuxWorkspace, AuxState, AuxSequenceMetadata, AuxFileMetadata, AuxValueMetadata } from "./AuxState";
import { flatMap } from 'lodash';

export class AuxReducer implements AtomReducer<AuxOp, AuxState> {
    
    eval(weave: Weave<AuxOp>): AuxState {
        let value: AuxState = {};
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

    private _evalFile(tree: WeaveTraverser<AuxOp>, parent: WeaveReference<AuxOp>, file: FileOp): AuxFile {
        const id = file.id;
        let data: any = {};
        let meta: AuxFileMetadata = {
            ref: parent,
            tags: {}
        };

        while (tree.peek(parent.atom.id)) {
            const ref = tree.next();
            if (ref.atom.value.type === AuxOpType.delete) {
                tree.skip(parent.atom.id);
                return null;
            } else if(ref.atom.value.type === AuxOpType.tag) {
                let { value: name, meta: nameMeta } = this.evalSequence(tree.fork(), ref, ref.atom.value.name);
                if (name && typeof data[name] === 'undefined') {
                    let { value, meta: valueMeta } = this._evalTag(tree, ref, ref.atom.value);
                    data[name] = value;
                    meta.tags[name] = {
                        ref: ref,
                        name: nameMeta,
                        value: valueMeta
                    };
                }
            }
        }

        if (file.fileType === 'object') {
            let file: AuxObject = {
                ...createFile(id),
                metadata: meta
            };
            file.tags = merge(file.tags, data);
            return file;
        } else {
            let workspace: AuxWorkspace = {
                ...createWorkspace(id),
                metadata: meta
            };
            workspace = merge(workspace, data);
            return workspace;
        }
    }

    private _evalTag(tree: WeaveTraverser<AuxOp>, parent: WeaveReference<AuxOp>, tag: TagOp): { value: any, meta: AuxValueMetadata } {
        let value: any = null;
        let hasValue = false;
        let meta: AuxValueMetadata = {
            ref: null,
            sequence: []
        };

        while (tree.peek(parent.atom.id)) {
            const ref = tree.next();
            if (!hasValue && ref.atom.value.type === AuxOpType.value) {
                hasValue = true;
                meta.ref = ref;
                value = ref.atom.value.value;
            }
        }

        return { value, meta };
    }

    public evalSequence(tree: WeaveTraverser<AuxOp>, parent: WeaveReference<AuxOp>, value: string): {value: string, meta: AuxSequenceMetadata[] } {

        // list of number pairs
        let offsets: number[] = [];
        let meta: AuxSequenceMetadata[] = [];
        if (parent.atom.value.type === AuxOpType.value || parent.atom.value.type === AuxOpType.tag) {
            meta.unshift({ start: 0, end: value.length, ref: parent });
        } else if(parent.atom.value.type === AuxOpType.insert) {
            meta.unshift({ start: parent.atom.value.index, end: parent.atom.value.index + value.length, ref: parent });
        }
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
                if (deleteCount > 0) {
                    meta[0].end -= deleteCount;
                }
                value = splice(value, index, deleteCount, '');
            } else if (ref.atom.value.type === AuxOpType.insert) {
                const { value: text, meta: refMeta } = this.evalSequence(tree, ref, ref.atom.value.text);
                const offset = calculateOffsetForIndex(ref.atom.value.index, offsets, false);
                const index = ref.atom.value.index + offset;
                offsets.push(index, text.length);
                meta.unshift(...refMeta.map(m => {
                    return { start: m.start + offset, end: m.end + offset, ref: m.ref };
                }));
                value = splice(value, index, 0, text);
            }
        }

        return { value, meta: flatMap(meta) };
    }
}

/**
 * Calculates the ref and index within said ref that the given index falls at.
 * @param meta The metadata for the sequence.
 * @param index The index in the final text that the value should be inserted at.
 */
export function calculateSequenceRef(meta: AuxSequenceMetadata[], index: number) {
    for (let i = 0; i < meta.length; i++) {
        const part = meta[i];
        if (part.start <= index && part.end >= index) {
            return { ref: part.ref, index: index - part.start };
        } else if (part.end <= index) {
            index -= part.end;
        }
    }
    const last = meta[meta.length - 1];
    if (index < 0) {
        return { ref: last.ref, index: last.start };
    } else {
        return { ref: last.ref, index: last.end };
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