import { MemorySubCrudRecordsStore } from '../../crud/sub/MemorySubCrudRecordsStore';
import {
    PackageVersion,
    PackageRecordVersion,
    ListedPackageVersion,
    PackageVersionRecordsStore,
    PackageVersionSubscriptionMetrics,
    PackageRecordVersionKey,
    PackageVersionReview,
    GetPackageVersionByKeyResult,
    GrantedPackageEntitlement,
    ListedPackageEntitlement,
} from './PackageVersionRecordsStore';
import { SubscriptionFilter } from '../../MetricsStore';
import { CrudResult, ListSubCrudStoreSuccess } from '../../crud/sub';
import { isEqual, orderBy, sortBy } from 'lodash';
import { PackageRecord, PackageRecordsStore } from '../PackageRecordsStore';
import { Entitlement } from '@casual-simulation/aux-common';

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
    private _reviews: PackageVersionReview[] = [];
    private _grantedPackageEntitlements: GrantedPackageEntitlement[] = [];

    get itemStore(): PackageRecordsStore {
        return super.itemStore as PackageRecordsStore;
    }

    async getItemByKey(
        recordName: string,
        address: string,
        key: PackageRecordVersionKey
    ): Promise<GetPackageVersionByKeyResult> {
        const bucket = this.getItemRecord(recordName);
        const arr = bucket?.get(address);
        const item = arr?.find((i) => isEqual(this.getKey(i), key)) ?? null;
        const recordItem = (await this.itemStore.getItemByAddress(
            recordName,
            address
        )) as PackageRecord;

        return {
            item,
            markers: recordItem?.markers ?? null,
            packageId: recordItem?.id ?? null,
        };
    }

    async getItemById(id: string): Promise<GetPackageVersionByKeyResult> {
        const buckets = this.getItemRecords();
        for (let [recordName, record] of buckets) {
            for (let [address, versions] of record) {
                for (let item of versions) {
                    if (item.id === id) {
                        const recordItem =
                            (await this.itemStore.getItemByAddress(
                                recordName,
                                address
                            )) as PackageRecord;

                        return {
                            item,
                            markers: recordItem?.markers ?? null,
                            packageId: recordItem?.id ?? null,
                        };
                    }
                }
            }
        }

        return null;
    }

    async listReviewsForVersion(
        recordName: string,
        address: string,
        version: PackageRecordVersionKey
    ): Promise<PackageVersionReview[]> {
        const reviews = this._reviews.filter(
            (r) =>
                r.recordName === recordName &&
                r.address === address &&
                r.key.major === version.major &&
                r.key.minor === version.minor &&
                r.key.patch === version.patch &&
                r.key.tag === version.tag
        );
        return orderBy(reviews, (r) => r.createdAtMs, 'desc');
    }

    async putReviewForVersion(
        review: PackageVersionReview
    ): Promise<CrudResult> {
        this._reviews = this._reviews.filter((r) => r.id !== review.id);
        this._reviews.push(review);
        return { success: true };
    }

    async updatePackageVersionReviewStatus(
        id: string,
        reviewStatus: PackageVersionReview['reviewStatus'],
        comments: string
    ): Promise<CrudResult> {
        const index = this._reviews.findIndex((r) => r.id === id);
        if (index < 0) {
            return {
                success: false,
                errorCode: 'data_not_found',
                errorMessage: 'The review does not exist.',
            };
        }

        const review = this._reviews[index];
        this._reviews[index] = {
            ...review,
            reviewStatus,
            reviewComments: comments,
        };
        return { success: true };
    }

    async getPackageVersionReviewById(
        id: string
    ): Promise<PackageVersionReview | null> {
        return this._reviews.find((r) => r.id === id) || null;
    }

    async getMostRecentPackageVersionReview(
        recordName: string,
        address: string,
        version: PackageRecordVersionKey
    ): Promise<PackageVersionReview | null> {
        const reviews = await this.listReviewsForVersion(
            recordName,
            address,
            version
        );
        if (reviews.length === 0) {
            return null;
        }
        return reviews[0];
    }

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

    async listItems(
        recordName: string,
        address: string
    ): Promise<ListSubCrudStoreSuccess<PackageRecordVersion>> {
        const items = await super.listItems(recordName, address);

        return {
            success: true,
            items: orderBy(
                items.items,
                [
                    (i) => i.key.major,
                    (i) => i.key.minor,
                    (i) => i.key.patch,
                    (i) => i.key.tag,
                ],
                ['desc', 'desc', 'desc', 'asc']
            ),
            totalCount: items.totalCount,
        };
    }

    async saveGrantedPackageEntitlement(
        grantedEntitlement: GrantedPackageEntitlement
    ): Promise<void> {
        const existingIndex = this._grantedPackageEntitlements.findIndex(
            (e) => e.id === grantedEntitlement.id
        );

        if (existingIndex >= 0) {
            this._grantedPackageEntitlements[existingIndex] = {
                ...grantedEntitlement,
            };
        } else {
            this._grantedPackageEntitlements.push({
                ...grantedEntitlement,
            });
        }
    }

    async listEntitlementsByFeatureAndUserId(
        packageIds: string[],
        feature: Entitlement['feature'],
        userId: string
    ): Promise<ListedPackageEntitlement[]> {
        let listedPackageEntitlements: ListedPackageEntitlement[] = [];

        for (let id of packageIds) {
            const granted = this._grantedPackageEntitlements.find(
                (e) =>
                    e.userId === userId &&
                    e.feature === feature &&
                    e.packageId === id
            );

            if (granted) {
                listedPackageEntitlements.push({
                    id: granted.id,
                    granted: true,
                    grantingUserId: granted.userId,
                    packageId: granted.packageId,
                    feature: granted.feature,
                    designatedRecords: granted.designatedRecords,
                    scope: granted.scope,
                    expireTimeMs: granted.expireTimeMs,
                    createdAtMs: granted.createdAtMs,
                });
            } else {
                const pkg = await this.itemStore.getItemById(id);
                if (pkg) {
                    const record = this.getItemRecord(pkg.recordName);
                    const versions = record.get(pkg.item.address) ?? [];
                    for (let version of versions) {
                        for (let entitlement of version.entitlements) {
                            if (entitlement.feature === feature) {
                                listedPackageEntitlements.push({
                                    id: null,
                                    granted: false,
                                    grantingUserId: null,
                                    packageId: id,
                                    feature: feature,
                                    designatedRecords:
                                        entitlement.designatedRecords,
                                    scope: entitlement.scope,
                                    expireTimeMs: null,
                                    createdAtMs: null,
                                });
                            }
                        }
                    }
                }
            }
        }

        return listedPackageEntitlements;
    }
}
