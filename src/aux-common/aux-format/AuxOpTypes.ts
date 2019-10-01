import { AtomOp } from '@casual-simulation/causal-trees';

/**
 * The list of operation types.
 */
export enum AuxOpType {
    root = 0,
    bot = 1,
    tag = 2,
    value = 3,
    delete = 4,
    insert = 5,
}

/**
 * Defines a union of all the possible op types.
 */
export type AuxOp = RootOp | BotOp | TagOp | ValueOp | InsertOp | DeleteOp;

/**
 * Defines an interface for all the AUX atom values.
 */
export interface AuxOpBase extends AtomOp {
    /**
     * The type of the operation.
     */
    type: AuxOpType;

    /**
     * The unix time in miliseconds that the atom was created on.
     */
    unix: number;
}

/**
 * Defines the root atom value.
 */
export interface RootOp extends AuxOpBase {
    type: AuxOpType.root;
}

/**
 * Defines an atom value that instructs the system to create a bot.
 */
export interface BotOp extends AuxOpBase {
    type: AuxOpType.bot;

    /**
     *  The ID of the bot.
     */
    id: string;
}

/**
 * Defines an atom value that instructs the system to create or rename a tag on a bot.
 *
 * When two tags exist with the same name
 */
export interface TagOp extends AuxOpBase {
    type: AuxOpType.tag;

    /**
     * The name of the tag.
     */
    name: string;
}

/**
 * Defines an atom value that serves as the root for changes to the value of a tag.
 */
export interface ValueOp extends AuxOpBase {
    type: AuxOpType.value;

    /**
     * The initial value.
     */
    value: any;
}

/**
 * Defines an atom value that instructs the system to insert a set of text into a tag.
 * When inserting into a ValueOp this acts as inserting text into the value part of a tag.
 * When inserting into a TagOp this acts as inserting text into the name part of a tag.
 */
export interface InsertOp extends AuxOpBase {
    type: AuxOpType.insert;

    /**
     * The index that the text should be inserted into.
     * Note that this index refers to the previous insertion operation and
     * not the full text string.
     */
    index: number;

    /**
     * The text to insert.
     */
    text: string;
}

/**
 * Defines an atom value that instructs the system to delete an item.
 * If applied onto a bot, the bot will be deleted.
 * If applied to an insert operation, the specified substring will be deleted from that insertion's text.
 */
export interface DeleteOp extends AuxOpBase {
    type: AuxOpType.delete;

    /**
     * The start index of the substring to delete.
     * If not specified the entire parent element will be tombstoned.
     */
    start?: number;

    /**
     * The end index of the substring to delete.
     */
    end?: number;
}
