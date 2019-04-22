import {
    Atom,
    AtomOp,
    PrecalculatedOp,
    precalculatedOp,
    RealtimeCausalTree,
    Weave,
} from '@casual-simulation/causal-trees';
import { AuxFile, AuxTagMetadata, AuxObject, AuxState } from './AuxState';
import { InsertOp, DeleteOp, AuxOp, AuxOpType, FileOp } from './AuxOpTypes';
import { calculateSequenceRef, calculateSequenceRefs } from './AuxReducer';
import { insert, del } from './AuxAtoms';
import { AuxCausalTree } from './AuxCausalTree';
import { map, startWith, flatMap, share } from 'rxjs/operators';
import { flatMap as mapFlat, values } from 'lodash';
import { sortBy } from 'lodash';
import {
    File,
    Object,
    calculateStateDiff,
    FilesState,
    PartialFile,
    createFile,
    FilesStateDiff,
    getFileConfigContexts,
    tagsOnFile,
    isConfigTag,
} from '../Files';
import uuid from 'uuid/v4';

/**
 * Builds the fileAdded, fileRemoved, and fileUpdated observables from the given channel connection.
 * @param connection The channel connection.
 */
export function fileChangeObservables(tree: RealtimeCausalTree<AuxCausalTree>) {
    const stateDiffs = tree.onUpdated.pipe(
        startWith(tree.tree.weave.atoms),
        map(events => {
            let addedIds: { [key: string]: boolean } = {};
            let addedFiles: AuxFile[] = [];
            let updatedFiles: AuxState = {};
            let deletedFiles: string[] = [];
            events.forEach((e: Atom<AuxOp>) => {
                if (e.value.type === AuxOpType.file) {
                    const id = e.value.id;
                    const val = tree.tree.value[id];
                    const existing = addedIds[id];
                    if (!existing && val) {
                        addedFiles.push(val);
                        addedIds[id] = true;
                    }
                    return;
                } else if (e.value.type === AuxOpType.delete) {
                    let cause = tree.tree.weave.getAtom(e.cause);
                    if (cause.value.type === AuxOpType.file) {
                        const id = cause.value.id;
                        deletedFiles.push(id);
                        return;
                    }
                }

                // Some update happened
                const file = getAtomFile(tree.tree.weave, e);
                if (file) {
                    const id = file.value.id;
                    const val = tree.tree.value[id];
                    if (!updatedFiles[id] && val) {
                        updatedFiles[id] = val;
                    }
                }
            });

            let diff: FilesStateDiff = {
                addedFiles: addedFiles,
                removedFiles: deletedFiles,
                updatedFiles: values(updatedFiles),
            };

            return diff;
        }),
        share()
    );

    const filesAdded = stateDiffs.pipe(
        map(diff => {
            // TODO: Work with all domains
            return sortBy(
                diff.addedFiles,
                f => {
                    let tags = tagsOnFile(f);
                    return tags.length > 0 && tags.some(t => isConfigTag(t))
                        ? 0
                        : 1;
                },
                f => f.id
            );
        })
    );

    const filesRemoved = stateDiffs.pipe(map(diff => diff.removedFiles));

    const filesUpdated = stateDiffs.pipe(map(diff => diff.updatedFiles));

    return {
        filesAdded,
        filesRemoved,
        filesUpdated,
    };
}

/**
 * Gets the File Atom that the given atom is childed under.
 */
export function getAtomFile(
    weave: Weave<AuxOp>,
    ref: Atom<AuxOp>
): Atom<FileOp> {
    if (ref.value.type === AuxOpType.file) {
        return <Atom<FileOp>>ref;
    }
    if (!ref.cause) {
        return null;
    }
    const cause = weave.getAtom(ref.cause);
    return getAtomFile(weave, cause);
}

/**
 * Gets the metadata for the given tag.
 * If the tag does not exist, then null is returned.
 * @param file The file that the metadata should come from.
 * @param tag The name of the tag.
 */
export function getTagMetadata(file: AuxFile, tag: string): AuxTagMetadata {
    if (file && file.metadata && file.metadata.tags[tag]) {
        return file.metadata.tags[tag];
    } else {
        return null;
    }
}

/**
 * Inserts the given text into the given tag or value on the given file.
 * @param file The file that the text should be inserted into.
 * @param tag The tag that the text should be inserted into.
 * @param text The text that should be inserted.
 * @param index The index that the text should be inserted at.
 */
export function insertIntoTagValue(
    file: AuxFile,
    tag: string,
    text: string,
    index: number
): PrecalculatedOp<InsertOp> {
    const tagMeta = getTagMetadata(file, tag);
    if (tagMeta) {
        const result = calculateSequenceRef(tagMeta.value.sequence, index);
        return precalculatedOp(insert(result.index, text), result.ref);
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
export function insertIntoTagName(
    file: AuxFile,
    tag: string,
    text: string,
    index: number
): PrecalculatedOp<InsertOp> {
    const tagMeta = getTagMetadata(file, tag);
    if (tagMeta) {
        const result = calculateSequenceRef(tagMeta.name, index);
        return precalculatedOp(insert(result.index, text), result.ref);
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
export function deleteFromTagValue(
    file: AuxFile,
    tag: string,
    index: number,
    length: number
): PrecalculatedOp<DeleteOp>[] {
    const tagMeta = getTagMetadata(file, tag);
    if (tagMeta) {
        const result = calculateSequenceRefs(
            tagMeta.value.sequence,
            index,
            length
        );
        return result.map(r =>
            precalculatedOp(del(r.index, r.index + r.length), r.ref, 1)
        );
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
export function deleteFromTagName(
    file: AuxFile,
    tag: string,
    index: number,
    length: number
): PrecalculatedOp<DeleteOp>[] {
    const tagMeta = getTagMetadata(file, tag);
    if (tagMeta) {
        const result = calculateSequenceRefs(tagMeta.name, index);
        return result.map(r =>
            precalculatedOp(del(r.index, r.index + r.length), r.ref, 1)
        );
    } else {
        return null;
    }
}
