import { MemoryCrudRecordsStore } from '../crud/MemoryCrudRecordsStore';
import {
    PackageRecordsStore,
    PackageRecord,
    PackageSubscriptionMetrics,
    PackageVersion,
    PackageRecordVersion,
    ListedPackageVersion,
} from './PackageRecordsStore';
import { SubscriptionFilter } from '../MetricsStore';

/**
 * A Memory-based implementation of the PackageRecordsStore.
 */
export class MemoryPackageRecordsStore
    extends MemoryCrudRecordsStore<PackageRecord>
    implements PackageRecordsStore
{
    private _packageVersions: PackageRecordVersion[] = [];

    async addPackageVersion(version: PackageRecordVersion): Promise<void> {
        const index = this._packageVersions.findIndex(
            (v) =>
                v.recordName === version.recordName &&
                v.address === version.address &&
                v.version.major === version.version.major &&
                v.version.minor === version.version.minor &&
                v.version.patch === version.version.patch &&
                v.version.tag === version.version.tag
        );

        if (index >= 0) {
            throw new Error('Version already exists');
        }

        this._packageVersions.push(version);
    }

    async listPackageVersions(
        recordName: string,
        address: string
    ): Promise<ListedPackageVersion[]> {
        const versions = this._packageVersions.filter(
            (v) => v.recordName === recordName && v.address === address
        );
        return versions.map((v) => ({
            recordName: v.recordName,
            address: v.address,
            version: v.version,
            sha256: v.sha256,
            auxSha256: v.auxSha256,
            scriptSha256: v.scriptSha256,
            entitlements: v.entitlements,
            sizeInBytes: v.sizeInBytes,
            createdAtMs: v.createdAtMs,
        }));
    }

    async getSubscriptionMetrics(
        filter: SubscriptionFilter
    ): Promise<PackageSubscriptionMetrics> {
        const info = await super.getSubscriptionMetrics(filter);

        let totalPackages = 0;
        let totalPackageVersions = 0;
        let totalPackageVersionBytes = 0;

        const records = filter.ownerId
            ? await this.store.listRecordsByOwnerId(filter.ownerId)
            : await this.store.listRecordsByStudioId(filter.studioId);
        for (let record of records) {
            totalPackages += this.getItemRecord(record.name).size;

            for (let version of this._packageVersions) {
                if (version.recordName !== record.name) {
                    continue;
                }

                totalPackageVersions++;
                totalPackageVersionBytes += version.sizeInBytes;
            }
        }

        return {
            ...info,
            totalPackages,
            totalPackageVersions,
            totalPackageVersionBytes,
        };
    }
}
