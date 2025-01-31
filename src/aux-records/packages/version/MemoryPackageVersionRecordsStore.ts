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
} from './PackageVersionRecordsStore';
import { SubscriptionFilter } from '../../MetricsStore';
import { CrudResult, ListSubCrudStoreSuccess } from '../../crud/sub';
import { isEqual, orderBy, sortBy } from 'lodash';
import { PackageRecord } from '../PackageRecordsStore';

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
        for (let [recordName, r] of this.getItemRecords()) {
            for (let i of r.values()) {
                for (let v of i) {
                    if (v.id === id) {
                        const recordItem =
                            (await this.itemStore.getItemByAddress(
                                recordName,
                                v.address
                            )) as PackageRecord;
                        return {
                            item: v,
                            markers: recordItem?.markers ?? null,
                            packageId: recordItem?.id ?? null,
                        };
                    }
                }
            }
        }

        return {
            item: null,
            markers: null,
            packageId: null,
        };
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
}
