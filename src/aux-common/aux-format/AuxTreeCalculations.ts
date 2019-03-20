
import { Atom, WeaveReference, AtomOp, PrecalculatedOp, precalculatedOp, RealtimeCausalTree, Weave } from "../causal-trees";
import { AuxFile, AuxTagMetadata, AuxObject, AuxState } from "./AuxState";
import { InsertOp, DeleteOp, AuxOp, AuxOpType, FileOp } from "./AuxOpTypes";
import { calculateSequenceRef, calculateSequenceRefs } from "./AuxReducer";
import { insert, del } from "./AuxAtoms";
import { AuxCausalTree } from "./AuxCausalTree";
import { map, startWith, flatMap } from "rxjs/operators";
import { flatMap as mapFlat, values } from 'lodash';
import { sortBy } from "lodash";
import { File, Object, calculateStateDiff, FilesState, PartialFile, createFile, FilesStateDiff } from "../Files";
import uuid from "uuid/v4";

/**
 * Builds the fileAdded, fileRemoved, and fileUpdated observables from the given channel connection.
 * @param connection The channel connection.
 */
export function fileChangeObservables(tree: RealtimeCausalTree<AuxCausalTree>) {

    const stateDiffs = tree.onUpdated.pipe(
        startWith(tree.tree.weave.atoms),
        map(events => {
            let addedFiles: AuxFile[] = [];
            let updatedFiles: AuxState = {};
            let deletedFiles: string[] = [];
            events.forEach((e: WeaveReference<AuxOp>) => {
                if (e.atom.value.type === AuxOpType.file) {
                    const id = e.atom.value.id;
                    const val = tree.tree.value[id];
                    if (val) {
                        addedFiles.push(val);
                    }
                    return;
                } else if(e.atom.value.type === AuxOpType.delete) {
                    let cause = tree.tree.weave.getAtom(e.atom.cause);
                    if (cause.atom.value.type === AuxOpType.file) {
                        const id = cause.atom.value.id;
                        deletedFiles.push(id);
                        return;
                    }
                }

                // Some update happened
                const file = getAtomFile(tree.tree.weave, e);
                if (file) {
                    const id = file.atom.value.id;
                    const val = tree.tree.value[id];
                    if(!updatedFiles[id] && val) {
                        updatedFiles[id] = val;
                    }
                }
            });


            let diff: FilesStateDiff = {
                addedFiles: addedFiles,
                removedFiles: deletedFiles,
                updatedFiles: values(updatedFiles)
            };

            return diff;
        }),
    );

    const fileAdded = stateDiffs.pipe(flatMap(diff => {
        // TODO: Work with all domains
        return sortBy(diff.addedFiles, 
            f => !f.tags['aux.builder.context'],
            f => f.id
        );
    }));

    const fileRemoved = stateDiffs.pipe(
      flatMap(diff => diff.removedFiles)
    );

    const fileUpdated = stateDiffs.pipe(flatMap(diff => diff.updatedFiles));

    return {
        fileAdded,
        fileRemoved,
        fileUpdated
    };
}

/**
 * Gets the File Atom that the given atom is childed under.
 */
export function getAtomFile(weave: Weave<AuxOp>, ref: WeaveReference<AuxOp>): WeaveReference<FileOp> {
    if (ref.atom.value.type === AuxOpType.file) {
        return <WeaveReference<FileOp>>ref;
    }
    if (!ref.atom.cause) {
        return null;
    }
    const cause = weave.getAtom(ref.atom.cause);
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
export function insertIntoTagValue(file: AuxFile, tag: string, text: string, index: number): PrecalculatedOp<InsertOp> {
    const tagMeta = getTagMetadata(file, tag);
    if (tagMeta) {
        const result = calculateSequenceRef(tagMeta.value.sequence, index);
        return precalculatedOp(insert(result.index, text), result.ref.atom);
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
export function insertIntoTagName(file: AuxFile, tag: string, text: string, index: number): PrecalculatedOp<InsertOp> {
    const tagMeta = getTagMetadata(file, tag);
    if (tagMeta) {
        const result = calculateSequenceRef(tagMeta.name, index);
        return precalculatedOp(insert(result.index, text), result.ref.atom);
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
export function deleteFromTagValue(file: AuxFile, tag: string, index: number, length: number): PrecalculatedOp<DeleteOp>[] {
    const tagMeta = getTagMetadata(file, tag);
    if (tagMeta) {
        const result = calculateSequenceRefs(tagMeta.value.sequence, index, length);
        return result.map(r => precalculatedOp(del(r.index, r.index + r.length), r.ref.atom, 1));
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
export function deleteFromTagName(file: AuxFile, tag: string, index: number, length: number): PrecalculatedOp<DeleteOp>[] {
    const tagMeta = getTagMetadata(file, tag);
    if (tagMeta) {
        const result = calculateSequenceRefs(tagMeta.name, index);
        return result.map(r =>  precalculatedOp(del(r.index, r.index + r.length), r.ref.atom, 1));
    } else {
        return null;
    }
}
