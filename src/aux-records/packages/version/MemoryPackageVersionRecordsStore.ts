/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import { MemorySubCrudRecordsStore } from '../../crud/sub/MemorySubCrudRecordsStore';
import type {
    PackageRecordVersion,
    PackageVersionRecordsStore,
    PackageVersionSubscriptionMetrics,
    PackageRecordVersionKey,
    PackageVersionReview,
    GetPackageVersionByKeyResult,
    PackageRecordVersionKeySpecifier,
} from './PackageVersionRecordsStore';

import type { SubscriptionFilter } from '../../MetricsStore';
import type { CrudResult, ListSubCrudStoreSuccess } from '../../crud/sub';
import { isEqual, orderBy } from 'es-toolkit/compat';
import type { PackageRecord } from '../PackageRecordsStore';

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
            recordName: recordName,
            parentMarkers: recordItem?.markers ?? null,
            packageId: recordItem?.id ?? null,
        };
    }

    async getItemBySpecifier(
        recordName: string,
        address: string,
        specifier: PackageRecordVersionKeySpecifier
    ): Promise<GetPackageVersionByKeyResult> {
        const bucket = this.getItemRecord(recordName);
        const arr = bucket?.get(address);
        const sorted = orderBy(
            arr ?? [],
            [
                (i) => i.key.major,
                (i) => i.key.minor,
                (i) => i.key.patch,
                (i) => i.key.tag,
            ],
            ['desc', 'desc', 'desc', 'asc']
        );
        const item =
            sorted.find((i) => {
                if (typeof specifier.sha256 === 'string') {
                    return i.sha256 === specifier.sha256;
                }
                if (
                    typeof specifier.major === 'number' &&
                    i.key.major !== specifier.major
                ) {
                    return false;
                }
                if (
                    typeof specifier.minor === 'number' &&
                    i.key.minor !== specifier.minor
                ) {
                    return false;
                }
                if (
                    typeof specifier.patch === 'number' &&
                    i.key.patch !== specifier.patch
                ) {
                    return false;
                }
                if (
                    typeof specifier.tag === 'string' &&
                    i.key.tag !== specifier.tag
                ) {
                    return false;
                }

                return true;
            }) ?? null;
        const recordItem = (await this.itemStore.getItemByAddress(
            recordName,
            address
        )) as PackageRecord;

        return {
            item,
            recordName: recordName,
            parentMarkers: recordItem?.markers ?? null,
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
                            recordName: recordName,
                            parentMarkers: recordItem?.markers ?? null,
                            packageId: recordItem?.id ?? null,
                        };
                    }
                }
            }
        }

        return {
            item: null,
            recordName: null,
            parentMarkers: null,
            packageId: null,
        };
    }

    async listReviewsForVersion(
        packageVersionId: string
    ): Promise<PackageVersionReview[]> {
        const reviews = this._reviews.filter(
            (r) => r.packageVersionId === packageVersionId
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
        packageVersionId: string
    ): Promise<PackageVersionReview | null> {
        const reviews = await this.listReviewsForVersion(packageVersionId);
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
            : await this.store.listRecordsByStudioId(filter.studioId!);
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
