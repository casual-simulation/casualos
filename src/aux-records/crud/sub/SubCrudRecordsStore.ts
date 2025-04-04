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
import { KnownErrorCodes } from '@casual-simulation/aux-common';

/**
 * Defines an interface for a store that can be used to create, read, update, and delete sub-items in a record.
 * That is, items which are related to a parent resource kind. (subscription to notification, package version to package, etc.)
 *
 * @param TKey The type of the keys that the store uses to identify items.
 * @param T The type of the records that the store can manage.
 */
export interface SubCrudRecordsStore<TKey, T extends SubCrudRecord<TKey>> {
    /**
     * Creates a new item in the record.
     * @param recordName The name of the record.
     * @param item The item to create.
     */
    createItem(recordName: string, item: T): Promise<CrudResult>;

    /**
     * Reads the item with the given address. Always returns an object with the item and any markers that are related to the item.
     * @param recordName The name of the record that the item lives in.
     * @param address The address of the record item.
     * @param key The key of the item to read.
     */
    getItemByKey(
        recordName: string,
        address: string,
        key: TKey
    ): Promise<GetSubCrudItemResult<T>>;

    /**
     * Updates the record with the given ID.
     * Keys that are not present in the record will not be updated.
     * @param recordName The name of the record that the item lives in.
     * @param record The record to update.
     */
    updateItem(recordName: string, item: Partial<T>): Promise<CrudResult>;

    /**
     * Creates or updates the record with the given ID.
     * If updating a record, keys that are not present in the record will not be updated.
     * @param recordName The name of the record that the item lives in.
     * @param item The item to create or update.
     */
    putItem(recordName: string, item: Partial<T>): Promise<CrudResult>;

    /**
     * Deletes the item with the given key.
     * @param recordName The name of the record that the item lives in.
     * @param address The address of the record item that the item resides in.
     * @param key The key of the item to delete.
     */
    deleteItem(
        recordName: string,
        address: string,
        key: TKey
    ): Promise<CrudResult>;

    /**
     * Gets a list of the items for the given record and address.
     * @param recordName The name of the record.
     * @param address The address of the item to list.
     */
    listItems(
        recordName: string,
        address: string
    ): Promise<ListSubCrudStoreSuccess<T>>;
}

/**
 * Defines a base interface for an item that can be stored in a CrudStore.
 */
export interface SubCrudRecord<TKey> {
    /**
     * The address that the item is stored under.
     */
    address: string;

    /**
     * The key of the item.
     */
    key: TKey;
}

export interface GetSubCrudItemResult<T> {
    /**
     * The item that was read.
     * Null if the item does not exist.
     */
    item: T | null;

    /**
     * The markers that are related to the item's parent.
     * Null if the parent record item doesn't exist.
     */
    parentMarkers: string[] | null;
}

export interface ListSubCrudStoreSuccess<T> {
    success: true;
    /**
     * The items that were listed.
     */
    items: T[];

    /**
     * The total number of items in the record.
     */
    totalCount: number;
}

export type CrudResult = CrudSuccess | CrudFailure;

export interface CrudSuccess {
    success: true;
}

export interface CrudFailure {
    success: false;
    errorCode: 'data_not_found' | 'parent_not_found';
    errorMessage: string;
}
