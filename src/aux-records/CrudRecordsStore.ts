import { SubscriptionMetrics } from './MetricsStore';

/**
 * Defines an interface for a store that can be used to create, read, update, and delete items in a record.
 */
export interface CrudRecordsStore<
    T extends CrudRecord,
    TMetrics extends CrudSubscriptionMetrics = CrudSubscriptionMetrics
> {
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
    getItemByAddress(recordName: string, address: string): Promise<T>;

    /**
     * Updates the record with the given ID.
     * Keys that are not present in the record will not be updated.
     * @param recordName The name of the record that the item lives in.
     * @param record The record to update.
     */
    updateItem(recordName: string, item: Partial<T>): Promise<void>;

    /**
     * Creates or updates the record with the given ID.
     * If updating a record, keys that are not present in the record will not be updated.
     * @param recordName The name of the record that the item lives in.
     * @param item The item to create or update.
     */
    putItem(recordName: string, item: Partial<T>): Promise<void>;

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

    /**
     * Gets the item metrics for the subscription of the given record.
     * @param recordName The name of the record.
     */
    getSubscriptionMetricsByRecordName(recordName: string): Promise<TMetrics>;
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
    items: T[];
    totalCount: number;
    marker: string;
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
