import {
    Atom,
    PrecalculatedOp,
    precalculatedOp,
    Weave,
} from '@casual-simulation/causal-trees';
import { AuxFile, AuxTagMetadata } from './AuxState';
import {
    InsertOp,
    DeleteOp,
    AuxOp,
    AuxOpType,
    FileOp,
    TagOp,
} from './AuxOpTypes';
import { calculateSequenceRef, calculateSequenceRefs } from './AuxReducer';
import { insert, del } from './AuxAtoms';

/**
 * Gets the File Atom that the given atom is childed under.
 */
export function getAtomTag(weave: Weave<AuxOp>, ref: Atom<AuxOp>): Atom<TagOp> {
    if (ref.value.type === AuxOpType.tag) {
        return <Atom<TagOp>>ref;
    }
    if (!ref.cause) {
        return null;
    }
    const cause = weave.getAtom(ref.cause);
    return getAtomTag(weave, cause);
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
