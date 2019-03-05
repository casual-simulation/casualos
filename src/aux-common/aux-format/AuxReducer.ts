import { AtomReducer } from "../causal-trees/AtomReducer";
import { AuxOp, AuxOpType, TagOp, FileOp, InsertOp, DeleteOp, ValueOp } from "./AuxOpTypes";
import { Weave, WeaveReference } from '../causal-trees/Weave';
import { FilesState, File, Object } from "../Files";
import { createFile, createWorkspace } from "../Files/FileCalculations";
import { WeaveTraverser } from "../causal-trees/WeaveTraverser";
import { merge, splice } from "../utils";
import { AtomFactory } from "../causal-trees/AtomFactory";
import { AuxFile, AuxObject, AuxWorkspace, AuxState, AuxFileMetadata, AuxValueMetadata, AuxRef, AuxSequenceMetadata } from "./AuxState";
import { flatMap, fill } from 'lodash';
import { MetaProperty } from "estree";

/**
 * Defines a type for a map from weave references to their calculated values.
 */
export type AuxReducerMetadata = Map<WeaveReference<AuxOp>, any>;

/**
 * Defines an AtomReducer that is able to produce AuxState from a weave of Aux operations.
 */
export class AuxReducer implements AtomReducer<AuxOp, AuxState, AuxReducerMetadata> {
    
    eval(weave: Weave<AuxOp>, refs: WeaveReference<AuxOp>[], old?: AuxState, metadata?: AuxReducerMetadata): [AuxState, AuxReducerMetadata] {
        let value: AuxState = {};
        let tree = new WeaveTraverser<AuxOp>(weave);

        while (tree.peek()) {
            const ref = tree.next();

            if (ref.atom.value.type === AuxOpType.file) {
                const id = ref.atom.value.id;
                if (typeof value[id] === 'undefined') {
                    const file = this._evalFile(tree, <WeaveReference<FileOp>>ref, ref.atom.value);
                    if (file) {
                        value[id] = file;
                    }
                }
            }
        }

        return [value, null];
    }

    private _evalFile(tree: WeaveTraverser<AuxOp>, parent: WeaveReference<FileOp>, file: FileOp): AuxFile {
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
                    let { value, meta: valueMeta, hasValue } = this._evalTag(tree, ref, ref.atom.value);
                    if (hasValue) {
                        data[name] = value;
                        meta.tags[name] = {
                            ref: <WeaveReference<TagOp>>ref,
                            name: nameMeta,
                            value: valueMeta
                        };
                    }
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

    private _evalTag(tree: WeaveTraverser<AuxOp>, parent: WeaveReference<AuxOp>, tag: TagOp): { value: any, meta: AuxValueMetadata, hasValue: boolean } {
        let value: any = null;
        let hasValue = false;
        let meta: AuxValueMetadata = {
            ref: null,
            sequence: null
        };

        while (tree.peek(parent.atom.id)) {
            const ref = tree.next();
            if (!hasValue && ref.atom.value.type === AuxOpType.value) {
                hasValue = true;
                meta.ref = <WeaveReference<ValueOp>>ref;
                const { value: val, meta: valMeta } = this.evalSequence(tree, ref, ref.atom.value.value);
                value = val;
                meta.sequence = valMeta;
            }
        }

        return { value, meta, hasValue };
    }

    public evalSequence(tree: WeaveTraverser<AuxOp>, parent: WeaveReference<AuxOp>, value: any): {value: string, meta: AuxSequenceMetadata } {

        // list of number pairs
        let offsets: number[] = [];
        let meta: AuxSequenceMetadata = null;
        if (parent.atom.value.type === AuxOpType.value || parent.atom.value.type === AuxOpType.tag) {
            if (typeof value === 'string') {
                meta = createSequenceMeta(parent, value);
            }
        } else if(parent.atom.value.type === AuxOpType.insert) {
            meta = createSequenceMeta(parent, value);
        }
        while (tree.peek(parent.atom.id)) {
            const ref = tree.next();
            if (typeof value !== 'string') {
                value = value.toString();
                meta = createSequenceMeta(parent, value);
            }
            if (ref.atom.value.type === AuxOpType.delete) {
                const start = Math.max(ref.atom.value.start || 0, 0);
                const end = ref.atom.value.end || value.length;
                const length = end - start;
                const offset = calculateOffsetForIndex(start, offsets, true);
                const index = start + offset;
                const deleteCount = length + offset;
                offsets.push(index, -deleteCount);
                meta.refs.splice(index, deleteCount);
                meta.indexes.splice(index, deleteCount);
                value = splice(value, index, deleteCount, '');
            } else if (ref.atom.value.type === AuxOpType.insert) {
                const { value: text, meta: refMeta } = this.evalSequence(tree, ref, ref.atom.value.text);
                const offset = calculateOffsetForIndex(ref.atom.value.index, offsets, false);
                const index = ref.atom.value.index + offset;
                offsets.push(index, text.length);
                const newMetaRefs = refMeta.refs;
                const newMetaIndices = refMeta.indexes;
                meta.refs.splice(index, 0, ...newMetaRefs);
                meta.indexes.splice(index, 0, ...newMetaIndices);
                value = splice(value, index, 0, text);
            }
        }

        return { value, meta };
    }
}

/**
 * Defines an interface for objects that refer to a specific index in
 * a tag name, tag value, or insert op.
 * 
 * Can represent a span or just a location.
 */
export interface SequenceRef {
    ref: AuxRef;
    index: number;
    length?: number;
}

/**
 * Calculates the ref and index within said ref that the given index falls at.
 * @param meta The metadata for the sequence.
 * @param index The index in the final text that the value should be inserted at.
 */
export function calculateSequenceRef(meta: AuxSequenceMetadata, index: number): SequenceRef {
    const refs = calculateSequenceRefs(meta, index);
    if (refs && refs.length > 0) {
        return refs[0];
    } else {
        return null;
    }
}


export function calculateSequenceRefs(meta: AuxSequenceMetadata, index: number, length?: number): SequenceRef[] {
    // Check for nulls
    if (meta === null) {
        if (typeof length !== 'undefined') {
            return [{ ref: null, index, length }];
        } else {
            return [{ ref: null, index }];
        }
    } else if (index >= meta.indexes.length) {
        if (meta.indexes.length > 0) {
            return [{ 
                ref: meta.refs[meta.refs.length - 1],
                index: meta.indexes[meta.indexes.length - 1] + 1,
            }];
        } else {
            return [{ ref: null, index: 0 }];
        }
    } else if (index < 0) {
        if (meta.indexes.length > 0) {
            return [{ 
                ref: meta.refs[0],
                index: meta.indexes[0]
            }];
        } else {
            return [{ ref: null, index: 0 }];
        }
    }
    let refs: SequenceRef[] = [];
    const ref = meta.refs[index];
    const idx = meta.indexes[index];
    
    if (length <= 0 || typeof length === 'undefined') {
        refs.push({ ref, index: idx });
    } else {
        let start = index;
        let currentRef = ref;
        let currentRefIndex = idx;
        let lastRefIndex = idx;
        for (let counter = 0; counter < length; counter++) {
            let i = start + counter;
            let nextRef = meta.refs[i];
            if (currentRef !== nextRef) {
                refs.push({
                    ref: currentRef,
                    index: currentRefIndex,
                    length: (lastRefIndex - currentRefIndex) + 1
                });
                currentRef = nextRef;
                currentRefIndex = meta.indexes[i];
                lastRefIndex = currentRefIndex;
            } else {
                lastRefIndex = meta.indexes[i];
            }
        }

        refs.push({ 
            ref: currentRef, 
            index: currentRefIndex, 
            length: (lastRefIndex - currentRefIndex) + 1
        });
    }

    return refs;
}

function createSequenceMeta(ref: AuxRef, value: string): AuxSequenceMetadata {
    let refs = new Array<AuxRef>(value.length);
    let indexes = new Array<number>(value.length);
    fill(refs, ref, 0, value.length);
    fillIndexes(indexes);
    return {
        refs,
        indexes
    };
}

function fillIndexes(arr: number[]) {
    for (let i = 0; i < arr.length; i++) {
        arr[i] = i;
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