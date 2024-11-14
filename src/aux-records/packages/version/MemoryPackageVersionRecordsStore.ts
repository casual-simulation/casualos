import { MemorySubCrudRecordsStore } from '../../crud/sub/MemorySubCrudRecordsStore';
import {
    PackageVersion,
    PackageRecordVersion,
    ListedPackageVersion,
    PackageVersionRecordsStore,
    PackageVersionSubscriptionMetrics,
    PackageRecordVersionKey,
} from './PackageVersionRecordsStore';
import { SubscriptionFilter } from '../../MetricsStore';

/**
 * A Memory-based implementation of the PackageRecordsStore.
 */
export class MemoryPackageVersionRecordsStore
    extends MemorySubCrudRecordsStore<
        PackageRecordVersionKey,
        PackageRecordVersion
    >
    implements PackageVersionRecordsStore
{
    async getSubscriptionMetrics(
        filter: SubscriptionFilter
    ): Promise<PackageVersionSubscriptionMetrics> {
        const info = await super.getSubscriptionMetrics(filter);

        let totalItems = 0;
        let totalPackageVersionBytes = 0;

        const records = filter.ownerId
            ? await this.store.listRecordsByOwnerId(filter.ownerId)
            : await this.store.listRecordsByStudioId(filter.studioId);
        for (let record of records) {
            const items = this.getItemRecord(record.name);
            totalItems += items.size;

            for (let versions of items.values()) {
                for (let version of versions) {
                    totalPackageVersionBytes += version.sizeInBytes;
                }
            }
        }

        return {
            ...info,
            totalItems,
            totalPackageVersionBytes,
        };
    }
}
