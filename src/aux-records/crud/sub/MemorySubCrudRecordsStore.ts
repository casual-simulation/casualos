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
import type { SubscriptionFilter } from '../../MetricsStore';
import type { MemoryStore } from '../../MemoryStore';
import type {
    CrudResult,
    GetSubCrudItemResult,
    ListSubCrudStoreSuccess,
    SubCrudRecord,
    SubCrudRecordsStore,
} from './SubCrudRecordsStore';
import { isEqual } from 'es-toolkit/compat';
import type {
    CrudRecord,
    CrudRecordsStore,
    CrudSubscriptionMetrics,
} from '../CrudRecordsStore';

export class MemorySubCrudRecordsStore<
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

    protected get itemStore() {
        return this._itemStore;
    }

    constructor(store: MemoryStore, itemStore: CrudRecordsStore<CrudRecord>) {
        this._store = store;
        this._itemStore = itemStore;
    }

    getKey(item: T): TKey {
        return item.key;
    }

    async createItem(recordName: string, item: T): Promise<CrudResult> {
        const recordItem = this._itemStore.getItemByAddress(
            recordName,
            item.address
        );

        if (!recordItem) {
            return {
                success: false,
                errorCode: 'parent_not_found',
                errorMessage: 'The parent item was not found.',
            };
        }

        let bucket = this._itemBuckets.get(recordName);
        if (!bucket) {
            bucket = new Map();
            this._itemBuckets.set(recordName, bucket);
        }

        if (!bucket.has(item.address)) {
            bucket.set(item.address, []);
        }

        let arr = bucket.get(item.address);

        const index = arr.findIndex((i) =>
            isEqual(this.getKey(i), this.getKey(item))
        );
        if (index < 0) {
            arr.push(item);
        }

        return {
            success: true,
        };
    }

    async getItemByKey(
        recordName: string,
        address: string,
        key: TKey
    ): Promise<GetSubCrudItemResult<T>> {
        const bucket = this._itemBuckets.get(recordName);
        const arr = bucket?.get(address);
        const item = arr?.find((i) => isEqual(this.getKey(i), key)) ?? null;
        const recordItem = await this._itemStore.getItemByAddress(
            recordName,
            address
        );

        return {
            item,
            parentMarkers: recordItem?.markers ?? null,
        };
    }

    async updateItem(
        recordName: string,
        item: Partial<T>
    ): Promise<CrudResult> {
        const existing = await this.getItemByKey(
            recordName,
            item.address,
            item.key
        );
        if (!existing.item) {
            return {
                success: false,
                errorCode: 'data_not_found',
                errorMessage: 'Item not found',
            };
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
        const index = arr.findIndex((i) =>
            isEqual(this.getKey(i), this.getKey(updated))
        );
        if (index >= 0) {
            arr[index] = updated as T;
        } else {
            // Do nothing if the item does not exist.
        }

        return {
            success: true,
        };
    }

    async putItem(recordName: string, item: Partial<T>): Promise<CrudResult> {
        const existing = await this.getItemByKey(
            recordName,
            item.address,
            item.key
        );
        if (!existing.item) {
            return await this.createItem(recordName, item as T);
        }

        return await this.updateItem(recordName, item);
    }

    async deleteItem(
        recordName: string,
        address: string,
        key: TKey
    ): Promise<CrudResult> {
        const bucket = this._itemBuckets.get(recordName);
        if (!bucket) {
            return {
                success: true,
            };
        }

        const arr = bucket.get(address);
        if (!arr) {
            return {
                success: true,
            };
        }

        const index = arr.findIndex((i) => isEqual(this.getKey(i), key));
        if (index >= 0) {
            arr.splice(index, 1);
        }

        return {
            success: true,
        };
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
