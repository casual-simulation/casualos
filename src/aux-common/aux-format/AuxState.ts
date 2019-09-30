import { Bot, Object, Workspace } from '../bots';
import { AtomId, Atom } from '@casual-simulation/causal-trees';
import { AuxOp, BotOp, ValueOp, TagOp } from './AuxOpTypes';

export type AuxBot = AuxObject;
export type AuxRef = Atom<AuxOp>;

/**
 * Defines an interface that contains state for an AUX Object.
 */
export interface AuxObject extends Object {
    /**
     * The metadata for the object.
     */
    metadata: AuxBotMetadata;
}

/**
 * Defines an interface that contains metadata for an AUX Object.
 */
export interface AuxBotMetadata {
    ref: Atom<BotOp>;
    tags: {
        [key: string]: AuxTagMetadata;
    };
}

/**
 * Defines an interface that contains metadata for an AUX tag.
 */
export interface AuxTagMetadata {
    ref: Atom<TagOp>;
    name: AuxSequenceMetadata;
    value: AuxValueMetadata;
}

/**
 * Defines an interface that contains metadata for an AUX tag value.
 */
export interface AuxValueMetadata {
    ref: Atom<ValueOp>;

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
 * Defines an interface that contains the state in an AUX.
 */
export interface AuxState {
    [id: string]: AuxBot;
}
