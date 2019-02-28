
import { Atom, WeaveReference, AtomOp, PrecalculatedOp, precalculatedOp, RealtimeCausalTree } from "../causal-trees";
import { AuxFile, AuxTagMetadata, AuxObject } from "./AuxState";
import { InsertOp, DeleteOp, AuxOp } from "./AuxOpTypes";
import { calculateSequenceRef, calculateSequenceRefs } from "./AuxReducer";
import { insert, del } from "./AuxAtoms";
import { AuxCausalTree } from "./AuxCausalTree";
import { map, startWith, pairwise, flatMap } from "rxjs/operators";
import { sortBy } from "lodash";
import { File, Object, calculateStateDiff, FilesState, PartialFile, createFile } from "../Files";
import uuid from "uuid/v4";

/**
 * Builds the fileAdded, fileRemoved, and fileUpdated observables from the given channel connection.
 * @param connection The channel connection.
 */
export function fileChangeObservables(tree: RealtimeCausalTree<AuxCausalTree>) {
    const states = tree.onUpdated.pipe(
        map(e => ({ state: tree.tree.value, event: <WeaveReference<AuxOp>[]>e })), 
        startWith({ state: <FilesState>null, event: <WeaveReference<AuxOp>[]>null })
    );

    // pair new states with their previous values
    const statePairs = states.pipe(pairwise());

    // calculate the difference between the current state and new state.
    const stateDiffs = statePairs.pipe(
        map(pair => {
            const prev = pair[0];
            const curr = pair[1];

            return calculateStateDiff(prev.state, curr.state, curr.event);
        })
    );

    const fileAdded = stateDiffs.pipe(flatMap(diff => {
        return sortBy(diff.addedFiles, f => f.type === 'object');
    }));

    const fileRemoved = stateDiffs.pipe(
      flatMap(diff => diff.removedFiles),
      map(f => f.id)
    );

    const fileUpdated = stateDiffs.pipe(flatMap(diff => diff.updatedFiles));

    return {
        fileAdded,
        fileRemoved,
        fileUpdated
    };
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