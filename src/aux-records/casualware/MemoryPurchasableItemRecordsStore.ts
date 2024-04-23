import { PurchasableItem, PurchasableItemMetrics, PurchasableItemRecordsStore } from './PurchasableItemRecordsStore';
import { MemoryCrudRecordsStore } from '../MemoryCrudRecordsStore';

export class MemoryPurchasableItemRecordsStore extends MemoryCrudRecordsStore<PurchasableItem, PurchasableItemMetrics> implements PurchasableItemRecordsStore {

    async getSubscriptionMetricsByRecordName(recordName: string): Promise<PurchasableItemMetrics> {
        const info = await this.store.getSubscriptionInfoForRecord(recordName);
        const records = await this.listItems(recordName, null);

        return {
            ...info,
            totalPurchasableItems: records.totalCount
        };
    }

}