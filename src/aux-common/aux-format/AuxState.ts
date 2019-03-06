import { File, Object, Workspace } from '../Files';
import { AtomId } from '../causal-trees/Atom';
import { WeaveReference } from '../causal-trees/Weave';
import { AuxOp, FileOp, ValueOp, TagOp } from './AuxOpTypes';

export type AuxFile = AuxObject | AuxWorkspace;
export type AuxRef = WeaveReference<AuxOp>;

/**
 * Defines an interface that contains state for an AUX Object.
 */
export interface AuxObject extends Object {
    /**
     * The metadata for the object.
     */
    metadata: AuxFileMetadata;
}

/**
 * Defines an interface that contains metadata for an AUX Object.
 */
export interface AuxFileMetadata {
    ref: WeaveReference<FileOp>;
    tags: {
        [key: string]: AuxTagMetadata
    }
}

/**
 * Defines an interface that contains metadata for an AUX tag.
 */
export interface AuxTagMetadata {
    ref: WeaveReference<TagOp>;
    name: AuxSequenceMetadata;
    value: AuxValueMetadata;
}

/**
 * Defines an interface that contains metadata for an AUX tag value.
 */
export interface AuxValueMetadata {
    ref: WeaveReference<ValueOp>;

    /**
     * The sequence that this value is using.
     * The array is ordered from the youngest to the oldest
     * so that finding the correct parent for insertions and deletions is easy.
     */
    sequence: AuxSequenceMetadata;
}

/**
 * Defines an interface that contains metadata for an AUX sequence.
 */
export interface AuxSequenceMetadata {

    /**
     * The list of indicies that relate a text position to
     * an index in a ref.
     */
    indexes: number[];

    /**
     * The list of refs.
     */
    refs: AuxRef[];
}

/**
 * Defines an interface that contains state for an AUX Workspace.
 */
export interface AuxWorkspace extends Workspace {
    /**
     * The metadata for the workspace.
     */
    metadata: AuxFileMetadata;
}

/**
 * Defines an interface that contains the state in an AUX.
 */
export interface AuxState {
    [id: string]: AuxFile;
}
