import { SubscriptionFilter } from '../MetricsStore';
import { MemoryStore } from '../MemoryStore';
import { MemoryCrudRecordsStore } from '../crud/MemoryCrudRecordsStore';
import {
    WebhookRecord,
    WebhookRecordsStore,
    WebhookRunInfo,
    WebhookSubscriptionMetrics,
} from './WebhookRecordsStore';
import { ListCrudStoreSuccess } from '../crud/CrudRecordsStore';

export class MemoryWebhookRecordsStore
    extends MemoryCrudRecordsStore<WebhookRecord, WebhookSubscriptionMetrics>
    implements WebhookRecordsStore
{
    private _webhookRuns: Map<string, WebhookRunInfo> = new Map();

    constructor(store: MemoryStore) {
        super(store);
    }

    async recordWebhookRun(run: WebhookRunInfo): Promise<void> {
        this._webhookRuns.set(run.runId, run);
    }

    async listWebhookRunsForWebhook(
        recordName: string,
        webhookAddress: string
    ): Promise<ListCrudStoreSuccess<WebhookRunInfo>> {
        const runs = Array.from(this._webhookRuns.values()).filter(
            (r) =>
                r.recordName === recordName &&
                r.webhookAddress === webhookAddress
        );
        return {
            success: true,
            items: runs,
            totalCount: runs.length,
            marker: null,
        };
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
