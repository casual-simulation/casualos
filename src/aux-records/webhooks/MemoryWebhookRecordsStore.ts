import { SubscriptionFilter } from '../MetricsStore';
import { MemoryStore } from '../MemoryStore';
import { MemoryCrudRecordsStore } from '../crud/MemoryCrudRecordsStore';
import {
    WebhookRecord,
    WebhookRecordsStore,
    WebhookSubscriptionMetrics,
} from './WebhookRecordsStore';

export class MemoryWebhookRecordsStore
    extends MemoryCrudRecordsStore<WebhookRecord, WebhookSubscriptionMetrics>
    implements WebhookRecordsStore
{
    constructor(store: MemoryStore) {
        super(store);
    }

    async getSubscriptionMetrics(
        filter: SubscriptionFilter
    ): Promise<WebhookSubscriptionMetrics> {
        const info = await super.getSubscriptionMetrics(filter);

        let totalItems = 0;

        const records = filter.ownerId
            ? await this.store.listRecordsByOwnerId(filter.ownerId)
            : await this.store.listRecordsByStudioId(filter.studioId);
        for (let record of records) {
            totalItems += this.getItemRecord(record.name).size;
        }

        return {
            ...info,
            totalItems,
        };
    }
}
