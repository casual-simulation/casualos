import { MemoryStore } from '../MemoryStore';
import { MemoryCrudRecordsStore } from '../crud/MemoryCrudRecordsStore';
import {
    WebhookRecord,
    WebhookSubscriptionMetrics,
} from './WebhookRecordsStore';

export class MemoryWebhookRecordsStore extends MemoryCrudRecordsStore<
    WebhookRecord,
    WebhookSubscriptionMetrics
> {
    constructor(store: MemoryStore) {
        super(store);
    }

    async getSubscriptionMetricsByRecordName(
        recordName: string
    ): Promise<WebhookSubscriptionMetrics> {
        const info = await this.store.getSubscriptionInfoForRecord(recordName);

        let totalItems = 0;
        const records = await this.store.listRecordsForSubscriptionByRecordName(
            recordName
        );
        for (let record of records) {
            totalItems += this.getItemRecord(record.name).size;
        }

        return {
            ...info,
            totalItems,
        };
    }
}
