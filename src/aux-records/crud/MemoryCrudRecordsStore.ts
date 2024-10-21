import { SubscriptionFilter } from '../MetricsStore';
import { MemoryStore } from '../MemoryStore';
import {
    CrudRecord,
    CrudRecordsStore,
    CrudSubscriptionMetrics,
    ListCrudStoreByMarkerRequest,
    ListCrudStoreSuccess,
} from './CrudRecordsStore';
import { orderBy, sortBy } from 'lodash';

export class MemoryCrudRecordsStore<
    T extends CrudRecord,
    TMetrics extends CrudSubscriptionMetrics = CrudSubscriptionMetrics
> implements CrudRecordsStore<T>
{
    private _itemBuckets: Map<string, Map<string, T>> = new Map();
    private _store: MemoryStore;

    protected get store() {
        return this._store;
    }

    constructor(store: MemoryStore) {
        this._store = store;
    }

    async createItem(recordName: string, item: T): Promise<void> {
        let bucket = this._itemBuckets.get(recordName);
        if (!bucket) {
            bucket = new Map();
            this._itemBuckets.set(recordName, bucket);
        }

        if (!bucket.has(item.address)) {
            bucket.set(item.address, item);
        }
    }

    async getItemByAddress(recordName: string, address: string): Promise<T> {
        const bucket = this._itemBuckets.get(recordName);
        if (!bucket) {
            return null;
        }

        return bucket.get(address) || null;
    }

    async updateItem(recordName: string, item: Partial<T>): Promise<void> {
        const existing = await this.getItemByAddress(recordName, item.address);
        if (!existing) {
            return;
        }

        const updated = {
            ...existing,
            ...item,
        };

        let bucket = this._itemBuckets.get(recordName);
        if (!bucket) {
            bucket = new Map();
            this._itemBuckets.set(recordName, bucket);
        }
        bucket.set(updated.address, updated as T);
    }

    async putItem(recordName: string, item: Partial<T>): Promise<void> {
        const existing = await this.getItemByAddress(recordName, item.address);
        if (!existing) {
            await this.createItem(recordName, item as T);
            return;
        }

        await this.updateItem(recordName, item);
    }

    async deleteItem(recordName: string, address: string): Promise<void> {
        const bucket = this._itemBuckets.get(recordName);
        if (!bucket) {
            return;
        }

        bucket.delete(address);
    }

    async listItems(
        recordName: string,
        address: string
    ): Promise<ListCrudStoreSuccess<T>> {
        const record = this.getItemRecord(recordName);
        let items: T[] = [];
        const count = record.size;
        for (let [key, item] of record.entries()) {
            if (!address || key > address) {
                items.push(item);
            }

            if (items.length >= 10) {
                break;
            }
        }

        return {
            success: true,
            items,
            totalCount: count,
            marker: null,
        };
    }

    async listItemsByMarker(
        request: ListCrudStoreByMarkerRequest
    ): Promise<ListCrudStoreSuccess<T>> {
        const marker = request.marker;
        let record = this.getItemRecord(request.recordName);
        let items = [] as T[];
        const address = request.startingAddress;
        const sortAscending = (request.sort ?? 'ascending') === 'ascending';

        let count = 0;
        for (let [key, item] of record.entries()) {
            if (item.markers.includes(marker)) {
                count += 1;
                if (
                    !address ||
                    (sortAscending && key > address) ||
                    (!sortAscending && key < address)
                ) {
                    items.push(item);
                }
            }
        }

        if (request.sort) {
            if (request.sort === 'ascending') {
                items = sortBy(items, (i) => i.address);
            } else if (request.sort === 'descending') {
                items = orderBy(items, (i) => i.address, 'desc');
            }
        }

        return {
            success: true,
            items: items.slice(0, 10),
            totalCount: count,
            marker: marker,
        };
    }

    async getSubscriptionMetricsByRecordName(
        recordName: string
    ): Promise<TMetrics> {
        const info = await this._store.getSubscriptionInfoForRecord(recordName);

        return {
            ...info,
        } as unknown as TMetrics;
    }

    async getSubscriptionMetrics(
        filter: SubscriptionFilter
    ): Promise<TMetrics> {
        const info = await this._store.getSubscriptionRecordMetrics(filter);

        return {
            ...info,
        } as unknown as TMetrics;
    }

    protected getItemRecord(recordName: string): Map<string, T> {
        let record = this._itemBuckets.get(recordName);
        if (!record) {
            record = new Map();
            this._itemBuckets.set(recordName, record);
        }

        return record;
    }

    protected getItemRecords(): Map<string, Map<string, T>> {
        return this._itemBuckets;
    }
}
