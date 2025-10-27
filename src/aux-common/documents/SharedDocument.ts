/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type { ClientError } from '../websockets';
import type { Action, CurrentVersion, StatusUpdate } from '../common';
import type { Observable, SubscriptionLike } from 'rxjs';
import type { InstUpdate } from '../bots';

/**
 * Defines an interface for objects that are able to synchronize data between multiple clients.
 *
 * @dochash types/documents
 * @doctitle Shared Documents
 * @docdescription Shared documents are used to synchronize data between multiple clients in real-time. They can be used to store maps, arrays, and text that can be shared and updated by multiple users.
 * @docsidebar Documents
 * @docname SharedDocument
 */
export interface SharedDocument extends SubscriptionLike {
    /**
     * The name of the record that the document is stored under.
     * If null, then the document is public.
     */
    recordName: string | null;

    /**
     * The address of the document.
     * If null, then the document is stored locally.
     */
    address: string | null;

    /**
     * The branch that was loaded for the document.
     */
    branch: string;

    /**
     * The ID of the remote client that the document is associated with.
     */
    clientId: number;

    /**
     * Gets an observable list that resolves whenever the partition state version is updated.
     */
    onVersionUpdated: Observable<CurrentVersion>;

    /**
     * Gets an observable list of errors from the partition.
     * That is, errors that the client cannot handle.
     */
    onError: Observable<any>;

    /**
     * Gets the observable list of remote events from the partition.
     */
    onEvents: Observable<Action[]>;

    /**
     * Gets the observable list of updates from the partition.
     */
    onUpdates: Observable<string[]>;

    /**
     * Gets the observable list of status updates from the partition.
     */
    onStatusUpdated: Observable<StatusUpdate>;

    /**
     * Gets the observable list of client errors from the document.
     * That is, errors that were caused by the client's behavior.
     */
    onClientError: Observable<ClientError>;

    /**
     * Tells the document to connect to its backing store.
     */
    connect(): void;

    /**
     * Gets a top-level map that can be used to store key/value data.
     * @param name The name of the map.
     */
    getMap<T = any>(name: string): SharedMap<T>;

    /**
     * Gets a top-level array that can be used to store a list of items.
     * @param name The name of the array.
     */
    getArray<T = any>(name: string): SharedArray<T>;

    /**
     * Gets a top-level text object that can be used to store rich text.
     * @param name The name of the text.
     */
    getText(name: string): SharedText;

    /**
     * Creates a new map that can be shared between multiple clients.
     */
    createMap<T = any>(): SharedMap<T>;

    /**
     * Creates a new array that can be shared between multiple clients.
     */
    createArray<T = any>(): SharedArray<T>;

    /**
     * Creates a new text object that can be shared between multiple clients.
     */
    createText(): SharedText;

    /**
     * Batches changes that occur within the given callback function into a single transaction.
     * This makes multiple updates more efficient.
     * @param callback The function to execute.
     */
    transact(callback: () => void): void;

    /**
     * Gets the update that represents the current state of the document.
     */
    getStateUpdate(): InstUpdate;

    /**
     * Applies the given inst updates to the document.
     * @param updates The updates to apply.
     */
    applyStateUpdates(updates: InstUpdate[]): void;

    /**
     * Applies the given raw updates to the document.
     * @param updates The updates to apply.
     */
    applyUpdates(updates: string[]): void;
}

/**
 * Defienes a type that can be shared between multiple clients.
 * This can be a map, array, or text.
 *
 * @dochash types/documents
 * @docid SharedType
 */
export type SharedType = SharedMap | SharedArray | SharedText;

/**
 * Defines the type of changes that can occur in a shared document.
 *
 * This can be a change to a map, array, or text.
 *
 * @dochash types/documents
 * @docid SharedTypeChanges
 */
export type SharedTypeChanges =
    | SharedMapChanges<any>
    | SharedArrayChanges<any>
    | SharedTextChanges;

export interface SharedTypeBase {
    /**
     * The document that the map is associated with.
     */
    readonly doc: SharedDocument;

    /**
     * The type that this map is stored in.
     */
    readonly parent: SharedType | null;
}

/**
 * Defines a [map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) that can be shared between multiple clients.
 *
 * @dochash types/documents
 * @docid SharedMap
 */
export interface SharedMap<T = any> extends SharedTypeBase {
    /**
     * Gets the number of keys that are in the map.
     */
    readonly size: number;

    /**
     * Sets the given key to the given value.
     * @param key The key to set.
     * @param value The value to set.
     */
    set(key: string, value: T): void;

    /**
     * Gets the value for the given key.
     * @param key The key to get.
     */
    get(key: string): T;

    /**
     * Deletes the given key from the map.
     * @param key Deletes the given key.
     */
    delete(key: string): void;

    /**
     * Determines if the given key exists in the map.
     * @param key The key.
     */
    has(key: string): boolean;

    /**
     * Clears the map.
     */
    clear(): void;

    /**
     * Creates a new map that is a clone of this map.
     */
    clone(): SharedMap;

    /**
     * Transforms this map into an object that can be serialized to JSON.
     */
    toJSON(): { [key: string]: T };

    /**
     * Execute the provided function once on every key/value pair.
     * @param callback The function to execute.
     */
    forEach(callback: (value: T, key: string, map: SharedMap<T>) => void): void;

    /**
     * Gets an iterator for the key/value pairs stored in the map.
     */
    [Symbol.iterator](): IterableIterator<[string, T]>;

    /**
     * Gets an iterator for the key/value pairs stored in the map.
     */
    entries(): IterableIterator<[string, T]>;

    /**
     * Gets an iterator for the keys stored in the map.
     */
    keys(): IterableIterator<string>;

    /**
     * Gets an iterator for the values stored in the map.
     */
    values(): IterableIterator<T>;

    /**
     * Gets an observable that resolves whenever the map is changed.
     */
    readonly changes: Observable<SharedMapChanges<T>>;

    /**
     * Gets an observable that resolves whenever this map or any children are changed.
     */
    readonly deepChanges: Observable<SharedTypeChanges[]>;
}

/**
 * Defines an [array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array) that can be shared between multiple clients.
 *
 * @dochash types/documents
 * @docid SharedArray
 */
export interface SharedArray<T = any> extends SharedTypeBase {
    /**
     * Gets the number of elements in the array.
     */
    readonly length: number;

    /**
     * Gets the number of elements in the array.
     */
    readonly size: number;

    /**
     * Insert items at the given index.
     * @param index The index to insert the items at. Items at or after this index will be pushed back to make space for the new items. If the index is greater than the length of the array, then the items are appended to the end of the array.
     * @param items The items to insert.
     */
    insert(index: number, items: T[]): void;

    /**
     * Deletes the given number of items, starting at the given index.
     * @param index The index of the first item to be deleted.
     * @param count The number of items to delete.
     */
    delete(index: number, count: number): void;

    /**
     * Applies the given delta to the array.
     * @param delta The delta to apply.
     */
    applyDelta(delta: SharedArrayOp<T>[]): void;

    /**
     * Append items to the end of the array.
     * @param items The items to add.
     */
    push(...items: T[]): void;

    /**
     * Removes the last item from the array and returns it.
     */
    pop(): T | undefined;

    /**
     * Prepend items to the beginning of the array.
     * @param items The items to add.
     */
    unshift(...items: T[]): void;

    /**
     * Removes the first item from the array and returns it.
     */
    shift(): T | undefined;

    /**
     * Gets the item at the given index.
     * @param index The index to get.
     */
    get(index: number): T;

    /**
     * Gets a range of items from the array.
     * Negative indexes can be used to start from the end of the array.
     * @param start The index of the first item to retrieve.
     * @param end The index of the last item to retrieve.
     */
    slice(start?: number, end?: number): T[];

    /**
     * Changes the contents of the array by removing or replacing existing elements and/or adding new elements.
     * Returns a JavaScript array containing the removed elements.
     * @param start The index at which to start changing the array.
     * @param deleteCount The number of elements in the array to remove from start.
     * @param items The elements to add to the array.
     */
    splice(start: number, deleteCount: number, ...items: T[]): T[];

    /**
     * Creates a new JavaScript array that is a clone of this array.
     */
    toArray(): T[];

    /**
     * Transforms this map into an array that can be serialized to JSON.
     */
    toJSON(): T[];

    /**
     * Execute the given callback function for each item in the array.
     * @param callback The function to execute.
     */
    forEach(
        callback: (value: T, index: number, array: SharedArray<T>) => void
    ): void;

    /**
     * Creates a new JavaScript array with the results of calling a provided function on every element in this array.
     * @param callback The function to execute.
     */
    map(callback: (value: T, index: number, array: SharedArray<T>) => T): T[];

    /**
     * Creates a new JavaScript array with all elements that pass the test implemented by the provided function.
     * @param predicate The function to execute.
     */
    filter(
        predicate: (value: T, index: number, array: SharedArray<T>) => boolean
    ): T[];

    /**
     * Gets an iterator for the items in the array.
     */
    [Symbol.iterator](): IterableIterator<T>;

    /**
     * Creates a new shared array that is a clone of this array.
     */
    clone(): SharedArray<T>;

    /**
     * Gets an observable that resolves whenever the array is changed.
     */
    readonly changes: Observable<SharedArrayChanges<T>>;

    /**
     * Gets an observable that resolves whenever this array or any children are changed.
     */
    readonly deepChanges: Observable<SharedTypeChanges[]>;
}

/**
 * Defines an object that represents rich text that can be shared between multiple clients.
 *
 * @dochash types/documents
 * @docid SharedText
 */
export interface SharedText extends SharedTypeBase {
    /**
     * Gets the length of the string in UTF-16 code units.
     */
    readonly length: number;

    /**
     * Insert text at the given index.
     * Optionally apply formatting to the inserted text.
     * @param index The index to insert the text at.
     * @param text The text to insert.
     * @param attribtues The formatting attributes to apply to the inserted text.
     */
    insert(index: number, text: string, attribtues?: Record<string, any>): void;

    /**
     * Deletes the given number of items, starting at the given index.
     * @param index The index of the first item to be deleted.
     * @param count The number of items to delete.
     */
    delete(index: number, count: number): void;

    /**
     * Applies the given delta to the text.
     * @param delta The delta to apply.
     */
    applyDelta(delta: SharedTextDelta): void;

    /**
     * Converts this text into a delta that can be applied to another text object.
     */
    toDelta(): SharedTextDelta;

    /**
     * Creates a relative position that is fixed to the code point at the given index.
     * @param index The index of the character to create the relative position for.
     * @param assoc The association of the relative position to the character. < 0 is before, >= 0 is after.
     */
    encodeRelativePosition(index: number, assoc?: number): RelativePosition;

    /**
     * Gets the index that the given relative position is associated with.
     * @param position The relative position to decode.
     */
    decodeRelativePosition(position: RelativePosition): number;

    /**
     * Gets a range of text from this object.
     * Negative indexes can be used to start from the end of the string.
     * @param start The index of the first code point to retrieve.
     * @param end The index of the last code point to retrieve.
     */
    slice(start?: number, end?: number): string;

    /**
     * Creates a new JavaScript string that is a clone of this text.
     */
    toString(): string;

    /**
     * Transforms this text into a string that can be serialized to JSON.
     */
    toJSON(): string;

    /**
     * Creates a new shared array that is a clone of this array.
     */
    clone(): SharedText;

    /**
     * Gets an observable that resolves whenever the array is changed.
     */
    readonly changes: Observable<SharedTextChanges>;

    /**
     * Gets an observable that resolves whenever this array or any children are changed.
     */
    readonly deepChanges: Observable<SharedTextChanges[]>;
}

/**
 * An object that represents changes that occurred in a shared map.
 *
 * @dochash types/documents
 * @docid SharedMapChanges
 */
export interface SharedMapChanges<T> {
    type: 'map';

    /**
     * The map that was changed.
     */
    target: SharedMap<T>;

    /**
     * The keys that were changed, along with their old values.
     */
    changes: Map<string, SharedMapChange<T>>;
}

/**
 * Defines an individual change that occurred in a shared map.
 *
 * @dochash types/documents
 * @docid SharedMapChange
 */
export interface SharedMapChange<T> {
    /**
     * The action that caused this change.
     */
    action: 'add' | 'update' | 'delete';

    /**
     * The old value of the key.
     */
    oldValue: T | undefined;
}

/**
 * An object that represents changes that occurred in a shared array.
 *
 * @dochash types/documents
 * @docid SharedArrayChanges
 */
export interface SharedArrayChanges<T> {
    type: 'array';

    /**
     * The array that was changed.
     */
    target: SharedArray<T>;

    /**
     * The array of changes that were made to the array.
     */
    delta: SharedArrayOp<T>[];
}

/**
 * The possible individual changes that were made to a shared array.
 *
 * @dochash types/documents
 * @docid SharedArrayOp
 */
export type SharedArrayOp<T> =
    | SharedArrayPreserveOp
    | SharedArrayInsertOp<T>
    | SharedArrayDeleteOp<T>;

/**
 * An object that represents no changes to one or more individual items in a shared array.
 *
 * @dochash types/documents
 * @docid SharedArrayPreserveOp
 */
export interface SharedArrayPreserveOp {
    type: 'preserve';

    /**
     * The number of items that were preserved.
     */
    count: number;
}

/**
 * An object that represents one or more items that were inserted into a shared array.
 *
 * @dochash types/documents
 * @docid SharedArrayInsertOp
 */
export interface SharedArrayInsertOp<T> {
    type: 'insert';

    /**
     * The values that were inserted.
     */
    values: T[];
}

/**
 * An object that represents one or more items that were deleted from a shared array.
 *
 * @dochash types/documents
 * @docid SharedArrayDeleteOp
 */
export interface SharedArrayDeleteOp<T> {
    type: 'delete';

    /**
     * The number of items that were deleted.
     */
    count: number;
}

/**
 * An object that represents changes that occurred in a shared text object.
 *
 * @dochash types/documents
 * @docid SharedTextChanges
 */
export interface SharedTextChanges {
    type: 'text';

    /**
     * The text that was changed.
     */
    target: SharedText;

    /**
     * The changes that were made to the array.
     */
    delta: SharedTextDelta;
}

/**
 * The array of changes that were made to the text.
 *
 * @dochash types/documents
 * @docid SharedTextDelta
 */
export type SharedTextDelta = SharedTextOp[];

/**
 * The possible individual changes that were made to the text.
 *
 * @dochash types/documents
 * @docid SharedTextOp
 */
export type SharedTextOp =
    | SharedTextPreserveOp
    | SharedTextInsertOp
    | SharedTextDeleteOp;

/**
 * An object that represents no changes to one or more individual characters in a shared text object.
 *
 * @dochash types/documents
 * @docid SharedTextPreserveOp
 */
export interface SharedTextPreserveOp {
    type: 'preserve';

    /**
     * The number of characters that were preserved.
     */
    count: number;
}

/**
 * An object that represents one or more characters that were inserted into a shared text object.
 *
 * @dochash types/documents
 * @docid SharedTextInsertOp
 */
export interface SharedTextInsertOp {
    type: 'insert';

    /**
     * The text that was inserted.
     */
    text: string;

    /**
     * The formatting that was applied to the inserted text.
     */
    attributes: Record<string, any>;
}

/**
 * An object that represents one or more characters that were deleted from a shared text object.
 *
 * @dochash types/documents
 * @docid SharedTextDeleteOp
 */
export interface SharedTextDeleteOp {
    type: 'delete';

    /**
     * The number of items that were deleted.
     */
    count: number;
}

/**
 * An object that represents a position in a shared text object that is relative to a specific character in the text.
 *
 * No properties are defined on this interface since the implementation is internal.
 *
 * @dochash types/documents
 * @docid RelativePosition
 */
export interface RelativePosition {}
