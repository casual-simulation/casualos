import { AtomReducer } from '../causal-trees/AtomReducer';
import {
    AuxOp,
    AuxOpType,
    TagOp,
    FileOp,
    InsertOp,
    DeleteOp,
    ValueOp,
} from './AuxOpTypes';
import { Weave } from '../causal-trees/Weave';
import { FilesState, File, Object, hasValue } from '../Files';
import { createFile, createWorkspace } from '../Files/FileCalculations';
import { WeaveTraverser } from '../causal-trees/WeaveTraverser';
import { merge, splice } from '../utils';
import { AtomFactory } from '../causal-trees/AtomFactory';
import {
    AuxFile,
    AuxObject,
    AuxState,
    AuxFileMetadata,
    AuxValueMetadata,
    AuxRef,
    AuxSequenceMetadata,
} from './AuxState';
import { flatMap, fill } from 'lodash';
import { MetaProperty } from 'estree';
import { Atom } from '../causal-trees/Atom';

/**
 * Defines a type for a map from weave references to their calculated values.
 */
export interface AuxReducerMetadata {
    cache: Map<Atom<AuxOp>, any>;
}

export interface AuxSequence {
    value: string;
    meta: AuxSequenceMetadata;
}

export interface AuxTag {
    name: AuxSequence;
    value: AuxTagValue;
}

export interface AuxTagValue {
    value: any;
    meta: AuxValueMetadata;
    hasValue: boolean;
}

/**
 * Defines an AtomReducer that is able to produce AuxState from a weave of Aux operations.
 */
export class AuxReducer
    implements AtomReducer<AuxOp, AuxState, AuxReducerMetadata> {
    // TODO: Improve Performance.
    //       On weaves with a large number of last write wins (LWW)
    //       atoms WeaveTraverser.skip() ends up being ~50% of the cost
    //       of this method.
    //       Clearly, this can be improved by simply removing old LWW atoms from the weave
    //       but it would still be nice to improve.
    eval(
        weave: Weave<AuxOp>,
        refs?: Atom<AuxOp>[],
        old?: AuxState,
        metadata?: AuxReducerMetadata
    ): [AuxState, AuxReducerMetadata] {
        let value: AuxState = {};
        metadata =
            refs && old && metadata
                ? metadata
                : {
                      cache: new Map(),
                  };
        let tree = new WeaveTraverser<AuxOp>(weave);

        if (refs) {
            for (let i = 0; i < refs.length; i++) {
                const chain = weave.referenceChain(refs[i]);
                for (let b = 0; b < chain.length; b++) {
                    metadata.cache.delete(chain[b]);
                }
            }
        }

        while (tree.peek()) {
            const ref = tree.next();

            if (ref.value.type === AuxOpType.file) {
                const id = ref.value.id;
                if (typeof value[id] === 'undefined') {
                    let file: AuxFile = metadata.cache.get(ref);
                    if (typeof file === 'undefined') {
                        file = this._evalFile(
                            tree,
                            <Atom<FileOp>>ref,
                            ref.value,
                            metadata
                        );
                        metadata.cache.set(ref, file);
                    } else {
                        tree.skip(ref.id);
                    }
                    if (file) {
                        value[id] = file;
                    }
                }
            }
        }

        return [value, metadata];
    }

    private _evalFile(
        tree: WeaveTraverser<AuxOp>,
        parent: Atom<FileOp>,
        file: FileOp,
        metadata: AuxReducerMetadata
    ): AuxFile {
        const id = file.id;
        let data: any = {};
        let meta: AuxFileMetadata = {
            ref: parent,
            tags: {},
        };

        while (tree.peek(parent.id)) {
            const ref = tree.next();
            if (ref.value.type === AuxOpType.delete) {
                tree.skip(parent.id);
                return null;
            } else if (ref.value.type === AuxOpType.tag) {
                let tag: AuxTag = metadata.cache.get(ref);
                if (typeof tag === 'undefined') {
                    tag = this._evalTag(
                        tree,
                        <Atom<TagOp>>ref,
                        ref.value,
                        metadata
                    );
                    if (typeof tag !== 'undefined') {
                        metadata.cache.set(ref, tag);
                    }
                } else {
                    tree.skip(ref.id);
                }

                if (
                    tag &&
                    tag.name.value &&
                    tag.value.hasValue &&
                    typeof meta.tags[tag.name.value] === 'undefined'
                ) {
                    if (hasValue(tag.value.value)) {
                        data[tag.name.value] = tag.value.value;
                    }
                    meta.tags[tag.name.value] = {
                        ref: <Atom<TagOp>>ref,
                        name: tag.name.meta,
                        value: tag.value.meta,
                    };
                }
            }
        }

        let auxFile: AuxObject = {
            id: id,
            metadata: meta,
            tags: {},
        };
        auxFile.tags = merge(auxFile.tags, data);
        return auxFile;
    }

    private _evalTag(
        tree: WeaveTraverser<AuxOp>,
        parent: Atom<TagOp>,
        tag: TagOp,
        metadata: AuxReducerMetadata
    ): AuxTag {
        let name = this.evalSequence(
            tree.fork(),
            parent,
            parent.value.name,
            metadata
        );
        let value = this._evalTagValue(tree, parent, parent.value, metadata);

        return {
            name,
            value,
        };
    }

    private _evalTagValue(
        tree: WeaveTraverser<AuxOp>,
        parent: Atom<AuxOp>,
        tag: TagOp,
        metadata: AuxReducerMetadata
    ): AuxTagValue {
        let value: any = null;
        let hasValue = false;
        let meta: AuxValueMetadata = {
            ref: null,
            sequence: null,
        };

        while (tree.peek(parent.id)) {
            const ref = tree.next();
            if (hasValue) {
                tree.skip(parent.id);
            } else if (ref.value.type === AuxOpType.value) {
                hasValue = true;
                meta.ref = <Atom<ValueOp>>ref;
                const { value: val, meta: valMeta } = this.evalSequence(
                    tree,
                    ref,
                    ref.value.value,
                    metadata
                );
                value = val;
                meta.sequence = valMeta;
            }
        }

        return { value, meta, hasValue };
    }

    public evalSequence(
        tree: WeaveTraverser<AuxOp>,
        parent: Atom<AuxOp>,
        value: any,
        metadata: AuxReducerMetadata
    ): AuxSequence {
        // list of number pairs
        let offsets: number[] = [];
        let meta: AuxSequenceMetadata = null;
        if (
            parent.value.type === AuxOpType.value ||
            parent.value.type === AuxOpType.tag
        ) {
            if (typeof value === 'string') {
                meta = createSequenceMeta(parent, value);
            }
        } else if (parent.value.type === AuxOpType.insert) {
            meta = createSequenceMeta(parent, value);
        }
        while (tree.peek(parent.id)) {
            const ref = tree.next();
            if (typeof value !== 'string') {
                value = value.toString();
                meta = createSequenceMeta(parent, value);
            }
            if (ref.value.type === AuxOpType.delete) {
                const start = Math.max(ref.value.start || 0, 0);
                const end = ref.value.end || value.length;
                const length = end - start;
                const offset = calculateOffsetForIndex(start, offsets, true);
                const index = start + offset;
                const deleteCount = length + offset;
                offsets.push(index, -deleteCount);
                meta.refs.splice(index, deleteCount);
                meta.indexes.splice(index, deleteCount);
                value = splice(value, index, deleteCount, '');
            } else if (ref.value.type === AuxOpType.insert) {
                let sequence: AuxSequence = metadata.cache.get(ref);
                if (typeof sequence === 'undefined') {
                    sequence = this.evalSequence(
                        tree,
                        ref,
                        ref.value.text,
                        metadata
                    );
                    metadata.cache.set(ref, sequence);
                } else {
                    tree.skip(ref.id);
                }
                const offset = calculateOffsetForIndex(
                    ref.value.index,
                    offsets,
                    false
                );
                const index = ref.value.index + offset;
                offsets.push(index, sequence.value.length);
                const newMetaRefs = sequence.meta.refs;
                const newMetaIndices = sequence.meta.indexes;
                meta.refs.splice(index, 0, ...newMetaRefs);
                meta.indexes.splice(index, 0, ...newMetaIndices);
                value = splice(value, index, 0, sequence.value);
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
export function calculateSequenceRef(
    meta: AuxSequenceMetadata,
    index: number
): SequenceRef {
    const refs = calculateSequenceRefs(meta, index);
    if (refs && refs.length > 0) {
        return refs[0];
    } else {
        return null;
    }
}

export function calculateSequenceRefs(
    meta: AuxSequenceMetadata,
    index: number,
    length?: number
): SequenceRef[] {
    // Check for nulls
    if (meta === null) {
        if (typeof length !== 'undefined') {
            return [{ ref: null, index, length }];
        } else {
            return [{ ref: null, index }];
        }
    } else if (index >= meta.indexes.length) {
        if (meta.indexes.length > 0) {
            return [
                {
                    ref: meta.refs[meta.refs.length - 1],
                    index: meta.indexes[meta.indexes.length - 1] + 1,
                },
            ];
        } else {
            return [{ ref: null, index: 0 }];
        }
    } else if (index < 0) {
        if (meta.indexes.length > 0) {
            return [
                {
                    ref: meta.refs[0],
                    index: meta.indexes[0],
                },
            ];
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
                    length: lastRefIndex - currentRefIndex + 1,
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
            length: lastRefIndex - currentRefIndex + 1,
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
        indexes,
    };
}

function fillIndexes(arr: number[]) {
    for (let i = 0; i < arr.length; i++) {
        arr[i] = i;
    }
}

function calculateOffsetForIndex(
    index: number,
    offsets: number[],
    isDelete: boolean
) {
    const startIndex = index;
    let offset = 0;
    for (let i = 0; i < offsets.length; i += 2) {
        const oIndex = offsets[i];
        if (isDelete) {
            if (oIndex <= startIndex) {
                offset += offsets[i + 1];
            }
        } else {
            if (oIndex < startIndex) {
                offset += +offsets[i + 1];
            }
        }
    }
    return offset;
}
