import { PurchasableItem, PurchasableItemMetrics, PurchasableItemRecordsStore } from './PurchasableItemRecordsStore';
import { MemoryCrudRecordsStore } from '../MemoryCrudRecordsStore';

export class MemoryPurchasableItemRecordsStore extends MemoryCrudRecordsStore<PurchasableItem, PurchasableItemMetrics> implements PurchasableItemRecordsStore {

    async getSubscriptionMetricsByRecordName(recordName: string): Promise<PurchasableItemMetrics> {
        const info = await this.store.getSubscriptionInfoForRecord(recordName);
        const studio = await this.store.getStudioById(info.studioId);
        const records = await this.listItems(recordName, null);

        return {
            ...info,
            totalPurchasableItems: records.totalCount,
            stripeAccountId: studio?.stripeAccountId,
            stripeAccountStatus: studio?.stripeAccountStatus,
        };
    }

}