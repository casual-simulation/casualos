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
import type { SubscriptionMetrics } from '../MetricsStore';

/**
 * Maps the given type to a new type where all properties are optional except for the given keys.
 */
export type PartialExcept<T, K extends keyof T> = Partial<T> & Pick<T, K>;

/**
 * Defines an interface for a store that can be used to create, read, update, and delete items in a record.
 *
 * @param T The type of the records that the store can manage.
 * @param TMetrics The type of the metrics that the store can provide.
 */
export interface CrudRecordsStore<T extends CrudRecord> {
    /**
     * Creates a new record.
     * @param recordName The name of the record.
     * @param item The item to create.
     */
    createItem(recordName: string, item: T): Promise<void>;

    /**
     * Reads the item with the given address. Returns null if the item does not exist.
     * @param recordName The name of the record that the item lives in.
     * @param address The address of the item to read.
     */
    getItemByAddress(recordName: string, address: string): Promise<T | null>;

    /**
     * Updates the record with the given ID.
     * Keys that are not present in the record will not be updated.
     * @param recordName The name of the record that the item lives in.
     * @param record The record to update.
     */
    updateItem(
        recordName: string,
        item: PartialExcept<T, 'address'>
    ): Promise<void>;

    /**
     * Creates or updates the record with the given ID.
     * If updating a record, keys that are not present in the record will not be updated.
     * @param recordName The name of the record that the item lives in.
     * @param item The item to create or update.
     */
    putItem(
        recordName: string,
        item: PartialExcept<T, 'address'>
    ): Promise<void>;

    /**
     * Deletes the item with the given ID.
     * @param recordName The name of the record that the item lives in.
     * @param address The address of the item to delete.
     */
    deleteItem(recordName: string, address: string): Promise<void>;

    /**
     * Gets a list of the items in the record starting after the given address.
     * @param recordName The name of the record.
     * @param address The address to start listing items after.
     */
    listItems(
        recordName: string,
        address: string | null
    ): Promise<ListCrudStoreSuccess<T>>;

    /**
     * Gets a list of the items in the record that have the given marker starting after the given address.
     * @param request The request to list items by marker.
     */
    listItemsByMarker(
        request: ListCrudStoreByMarkerRequest
    ): Promise<ListCrudStoreSuccess<T>>;
}

/**
 * Defines a base interface for a record that can be stored in a CrudStore.
 */
export interface CrudRecord {
    /**
     * The address of the record.
     */
    address: string;

    /**
     * The markers that are associated with the record.
     */
    markers: string[];
}

export interface ListCrudStoreSuccess<T> {
    success: true;
    /**
     * The items that were listed.
     */
    items: T[];

    /**
     * The total number of items in the record.
     */
    totalCount: number;

    /**
     * The marker that was listed.
     */
    marker: string | null;
}

export interface ListCrudStoreByMarkerRequest {
    /**
     * The name of the record that the data is in.
     */
    recordName: string;

    /**
     * The marker that each item should have.
     */
    marker: string;

    /**
     * The address to start listing items at.
     * If null, then the first item in the record should be returned.
     */
    startingAddress: string | null;

    /**
     * How the items should be sorted by address.
     * "ascending": The items should be sorted in ascending order.
     * "descending": The items should be sorted in descending order.
     *
     * Defaults to "ascending".
     */
    sort?: 'ascending' | 'descending';
}

/**
 * Defines an interface for the metrics of a subscription for some CRUD items.
 */
export interface CrudSubscriptionMetrics extends SubscriptionMetrics {}
