import { File, Object, Workspace } from '../Files';
import { AtomId } from 'channels-core/Atom';
import { WeaveReference } from 'channels-core/Weave';
import { AuxOp } from './AuxOpTypes';

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
    ref: AuxRef;
    tags: {
        [key: string]: AuxTagMetadata
    }
}

/**
 * Defines an interface that contains metadata for an AUX tag.
 */
export interface AuxTagMetadata {
    ref: AuxRef;
    name: AuxSequenceMetadata[];
    value: AuxValueMetadata;
}

/**
 * Defines an interface that contains metadata for an AUX tag value.
 */
export interface AuxValueMetadata {
    ref: AuxRef;

    /**
     * The sequence that this value is using.
     * The array is ordered from the youngest to the oldest
     * so that finding the correct parent for insertions and deletions is easy.
     */
    sequence: AuxSequenceMetadata[];
}

/**
 * Defines an interface that contains metadata for an AUX sequence.
 */
export interface AuxSequenceMetadata {
    ref: AuxRef;

    /**
     * The index in the string that this metadata starts at.
     */
    start: number;

    /**
     * The index in the string that this metadata ends at.
     */
    end: number;
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
