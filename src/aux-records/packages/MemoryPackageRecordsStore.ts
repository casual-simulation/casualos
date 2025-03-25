import { MemoryCrudRecordsStore } from '../crud/MemoryCrudRecordsStore';
import type {
    PackageRecordsStore,
    PackageRecord,
    PackageSubscriptionMetrics,
} from './PackageRecordsStore';
import type { SubscriptionFilter } from '../MetricsStore';

/**
 * A Memory-based implementation of the PackageRecordsStore.
 */
export class MemoryPackageRecordsStore
    extends MemoryCrudRecordsStore<PackageRecord>
    implements PackageRecordsStore
{
    async getSubscriptionMetrics(
        filter: SubscriptionFilter
    ): Promise<PackageSubscriptionMetrics> {
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
