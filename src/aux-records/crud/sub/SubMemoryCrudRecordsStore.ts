import { SubscriptionFilter } from '../../MetricsStore';
import { MemoryStore } from '../../MemoryStore';
import {
    GetSubCrudItemResult,
    ListSubCrudStoreSuccess,
    SubCrudRecord,
    SubCrudRecordsStore,
} from './SubCrudRecordsStore';
import { isEqual, orderBy, sortBy } from 'lodash';
import {
    CrudRecord,
    CrudRecordsStore,
    CrudSubscriptionMetrics,
} from '../CrudRecordsStore';

export abstract class MemorySubCrudRecordsStore<
    TKey,
    T extends SubCrudRecord<TKey>,
    TMetrics extends CrudSubscriptionMetrics = CrudSubscriptionMetrics
> implements SubCrudRecordsStore<TKey, T>
{
    private _itemBuckets: Map<string, Map<string, T[]>> = new Map();
    private _store: MemoryStore;
    private _itemStore: CrudRecordsStore<CrudRecord>;

    protected get store() {
        return this._store;
    }

    constructor(store: MemoryStore, itemStore: CrudRecordsStore<CrudRecord>) {
        this._store = store;
        this._itemStore = itemStore;
    }

    getKey(item: T): TKey {
        return item.key;
    }

    async createItem(recordName: string, item: T): Promise<void> {
        let bucket = this._itemBuckets.get(recordName);
        if (!bucket) {
            bucket = new Map();
            this._itemBuckets.set(recordName, bucket);
        }

        if (!bucket.has(item.address)) {
            bucket.set(item.address, []);
        }

        let arr = bucket.get(item.address);

        const index = arr.findIndex((i) => isEqual(i, this.getKey(item)));
        if (index < 0) {
            arr.push(item);
        }
    }

    async getItemByKey(
        recordName: string,
        address: string,
        key: TKey
    ): Promise<GetSubCrudItemResult<T>> {
        const bucket = this._itemBuckets.get(recordName);
        if (!bucket) {
            return {
                item: null,
                markers: [],
            };
        }

        const arr = bucket.get(address);
        if (!arr) {
            return {
                item: null,
                markers: [],
            };
        }

        const item = arr.find((i) => isEqual(this.getKey(i), key)) ?? null;
        const recordItem = await this._itemStore.getItemByAddress(
            recordName,
            address
        );

        return {
            item,
            markers: recordItem?.markers,
        };
    }

    async updateItem(recordName: string, item: Partial<T>): Promise<void> {
        const existing = await this.getItemByKey(
            recordName,
            item.address,
            item as unknown as TKey
        );
        if (!existing.item) {
            return;
        }

        const updated = {
            ...existing.item,
            ...item,
        };

        let bucket = this._itemBuckets.get(recordName);
        if (!bucket) {
            bucket = new Map();
            this._itemBuckets.set(recordName, bucket);
        }

        const arr = bucket.get(updated.address);
        const index = arr.findIndex((i) => isEqual(i, this.getKey(updated)));
        if (index >= 0) {
            arr[index] = updated as T;
        } else {
            // Do nothing if the item does not exist.
        }
    }

    async putItem(recordName: string, item: Partial<T>): Promise<void> {
        const existing = await this.getItemByKey(
            recordName,
            item.address,
            item as unknown as TKey
        );
        if (!existing.item) {
            await this.createItem(recordName, item as T);
            return;
        }

        await this.updateItem(recordName, item);
    }

    async deleteItem(
        recordName: string,
        address: string,
        key: TKey
    ): Promise<void> {
        const bucket = this._itemBuckets.get(recordName);
        if (!bucket) {
            return;
        }

        const arr = bucket.get(address);
        if (!arr) {
            return;
        }

        const index = arr.findIndex((i) => isEqual(this.getKey(i), key));
        if (index >= 0) {
            arr.splice(index, 1);
        }
    }

    async listItems(
        recordName: string,
        address: string
    ): Promise<ListSubCrudStoreSuccess<T>> {
        const record = this.getItemRecord(recordName);
        const items: T[] = record.get(address) ?? [];

        return {
            success: true,
            items,
            totalCount: items.length,
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

    protected getItemRecord(recordName: string): Map<string, T[]> {
        let record = this._itemBuckets.get(recordName);
        if (!record) {
            record = new Map();
            this._itemBuckets.set(recordName, record);
        }

        return record;
    }

    protected getItemRecords(): Map<string, Map<string, T[]>> {
        return this._itemBuckets;
    }
}
