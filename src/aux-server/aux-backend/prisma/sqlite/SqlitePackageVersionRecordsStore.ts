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

import type { SubscriptionFilter } from '@casual-simulation/aux-records';
import type {
    CrudResult,
    ListSubCrudStoreSuccess,
} from '@casual-simulation/aux-records/crud/sub';
import type {
    GetPackageVersionByKeyResult,
    PackageRecordVersion,
    PackageRecordVersionKey,
    PackageRecordVersionKeySpecifier,
    PackageVersionRecordsStore,
    PackageVersionReview,
    PackageVersionSubscriptionMetrics,
} from '@casual-simulation/aux-records/packages/version';
import type {
    Prisma,
    PrismaClient,
    PackageRecordVersion as PrismaPackageRecordVersion,
} from '../generated-sqlite';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';
import type { Entitlement } from '@casual-simulation/aux-common';
import { convertToDate, convertToMillis } from '../Utils';
import type { SqliteMetricsStore } from './SqliteMetricsStore';
import type { JsonObject } from '../generated-sqlite/runtime/library';

const TRACE_NAME = 'PrismaPackageVersionRecordsStore';

/**
 * A Prisma-based implementation of the PackageVersionRecordsStore.
 */
export class PrismaPackageVersionRecordsStore
    implements PackageVersionRecordsStore
{
    private _client: PrismaClient;
    private _metrics: SqliteMetricsStore;

    constructor(prisma: PrismaClient, metrics: SqliteMetricsStore) {
        this._client = prisma;
        this._metrics = metrics;
    }

    @traced(TRACE_NAME)
    async getItemByKey(
        recordName: string,
        address: string,
        key: PackageRecordVersionKey
    ): Promise<GetPackageVersionByKeyResult> {
        const item = await this._client.packageRecordVersion.findUnique({
            where: {
                recordName_address_major_minor_patch_tag: {
                    recordName,
                    address,
                    major: key.major,
                    minor: key.minor,
                    patch: key.patch,
                    tag: key.tag,
                },
            },
            include: {
                package: true,
            },
        });

        if (!item) {
            return {
                item: null,
                parentMarkers: null,
                recordName: null,
                packageId: null,
            };
        }

        return {
            item: this._convertToItem(item),
            parentMarkers: item.package.markers as string[],
            packageId: item.package.id,
            recordName: item.package.recordName,
        };
    }

    @traced(TRACE_NAME)
    async getItemBySpecifier(
        recordName: string,
        address: string,
        specifier: PackageRecordVersionKeySpecifier
    ): Promise<GetPackageVersionByKeyResult> {
        const where: Prisma.PackageRecordVersionWhereInput = {
            recordName,
            address,
        };

        if (typeof specifier.sha256 === 'string') {
            where.sha256 = specifier.sha256;
        } else {
            if (typeof specifier.major === 'number') {
                where.major = specifier.major;
            }
            if (typeof specifier.minor === 'number') {
                where.minor = specifier.minor;
            }
            if (typeof specifier.patch === 'number') {
                where.patch = specifier.patch;
            }
            if (typeof specifier.tag === 'string') {
                where.tag = specifier.tag;
            }
        }

        const item = await this._client.packageRecordVersion.findFirst({
            where,
            orderBy: [
                {
                    major: 'desc',
                },
                {
                    minor: 'desc',
                },
                {
                    patch: 'desc',
                },
                {
                    tag: 'asc',
                },
            ],
            include: {
                package: true,
            },
        });

        if (!item) {
            return {
                item: null,
                parentMarkers: null,
                recordName: null,
                packageId: null,
            };
        }

        return {
            item: this._convertToItem(item),
            parentMarkers: item.package.markers as string[],
            packageId: item.package.id,
            recordName: item.package.recordName,
        };
    }

    private _convertToItem(
        item: PrismaPackageRecordVersion
    ): PackageRecordVersion {
        return {
            id: item.id,
            address: item.address,
            key: {
                major: item.major,
                minor: item.minor,
                patch: item.patch,
                tag: item.tag,
            },
            auxFileName: item.auxFileName,
            auxSha256: item.auxSha256,
            sha256: item.sha256,
            entitlements: item.entitlements as unknown as Entitlement[],
            description: item.description,
            markers: item.markers as string[],
            sizeInBytes: item.sizeInBytes,
            requiresReview: item.requiresReview,
            createdFile: item.createdFile,
            createdAtMs: convertToMillis(item.createdAt),
        };
    }

    async getItemById(id: string): Promise<GetPackageVersionByKeyResult> {
        const item = await this._client.packageRecordVersion.findUnique({
            where: {
                id: id,
            },
            include: {
                package: true,
            },
        });

        if (!item) {
            return {
                item: null,
                parentMarkers: null,
                recordName: null,
                packageId: null,
            };
        }

        return {
            item: this._convertToItem(item),
            parentMarkers: item.package.markers as string[],
            packageId: item.package.id,
            recordName: item.package.recordName,
        };
    }

    @traced(TRACE_NAME)
    async getSubscriptionMetrics(
        filter: SubscriptionFilter
    ): Promise<PackageVersionSubscriptionMetrics> {
        const metrics = await this._metrics.getSubscriptionRecordMetrics(
            filter
        );

        const where: Prisma.PackageRecordVersionWhereInput = {};

        if (filter.ownerId) {
            where.record = {
                ownerId: filter.ownerId,
            };
        } else if (filter.studioId) {
            where.record = {
                studioId: filter.studioId,
            };
        } else {
            throw new Error('Invalid filter');
        }

        const result = await this._client.packageRecordVersion.aggregate({
            where,
            _count: true,
            _sum: {
                sizeInBytes: true,
            },
        });

        return {
            ...metrics,
            totalItems: result._count,
            totalPackageVersionBytes: result._sum.sizeInBytes || 0,
        };
    }

    @traced(TRACE_NAME)
    async putReviewForVersion(
        review: PackageVersionReview
    ): Promise<CrudResult> {
        await this._client.packageRecordVersionReview.upsert({
            where: {
                id: review.id,
            },
            create: {
                id: review.id,
                approved: review.approved,
                approvalType: review.approvalType,
                reviewComments: review.reviewComments,
                reviewStatus: review.reviewStatus,
                reviewingUserId: review.reviewingUserId,
                packageVersionId: review.packageVersionId,
                createdAt: convertToDate(review.createdAtMs),
                updatedAt: convertToDate(review.updatedAtMs),
            },
            update: {
                approved: review.approved,
                approvalType: review.approvalType,
                reviewComments: review.reviewComments,
                reviewStatus: review.reviewStatus,
                reviewingUserId: review.reviewingUserId,
                packageVersionId: review.packageVersionId,
                updatedAt: convertToDate(review.updatedAtMs),
            },
        });

        return {
            success: true,
        };
    }

    @traced(TRACE_NAME)
    async updatePackageVersionReviewStatus(
        id: string,
        reviewStatus: PackageVersionReview['reviewStatus'],
        comments: string
    ): Promise<CrudResult> {
        await this._client.packageRecordVersionReview.update({
            where: {
                id: id,
            },
            data: {
                reviewStatus: reviewStatus,
                reviewComments: comments,
            },
        });

        return {
            success: true,
        };
    }

    @traced(TRACE_NAME)
    async getPackageVersionReviewById(
        id: string
    ): Promise<PackageVersionReview | null> {
        const review = await this._client.packageRecordVersionReview.findUnique(
            {
                where: {
                    id: id,
                },
            }
        );

        if (!review) {
            return null;
        }

        return {
            id: review.id,
            approved: review.approved,
            approvalType:
                review.approvalType as PackageVersionReview['approvalType'],
            reviewComments: review.reviewComments,
            reviewStatus:
                review.reviewStatus as PackageVersionReview['reviewStatus'],
            reviewingUserId: review.reviewingUserId,
            packageVersionId: review.packageVersionId,
            createdAtMs: convertToMillis(review.createdAt),
            updatedAtMs: convertToMillis(review.updatedAt),
        };
    }

    @traced(TRACE_NAME)
    async getMostRecentPackageVersionReview(
        packageVersionId: string
    ): Promise<PackageVersionReview | null> {
        const review = await this._client.packageRecordVersionReview.findFirst({
            where: {
                packageVersionId: packageVersionId,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        if (!review) {
            return null;
        }

        return {
            id: review.id,
            approved: review.approved,
            approvalType:
                review.approvalType as PackageVersionReview['approvalType'],
            reviewComments: review.reviewComments,
            reviewStatus:
                review.reviewStatus as PackageVersionReview['reviewStatus'],
            reviewingUserId: review.reviewingUserId,
            packageVersionId: review.packageVersionId,
            createdAtMs: convertToMillis(review.createdAt),
            updatedAtMs: convertToMillis(review.updatedAt),
        };
    }

    @traced(TRACE_NAME)
    async createItem(
        recordName: string,
        item: PackageRecordVersion
    ): Promise<CrudResult> {
        await this._client.packageRecordVersion.create({
            data: {
                id: item.id,
                recordName: recordName,
                address: item.address,
                major: item.key.major,
                minor: item.key.minor,
                patch: item.key.patch,
                tag: item.key.tag,
                auxFileName: item.auxFileName,
                auxSha256: item.auxSha256,
                sha256: item.sha256,
                entitlements: item.entitlements as unknown as JsonObject[],
                description: item.description,
                markers: item.markers,
                sizeInBytes: item.sizeInBytes,
                requiresReview: item.requiresReview,
                createdFile: item.createdFile,
                createdAt: convertToDate(item.createdAtMs),
            },
        });

        return {
            success: true,
        };
    }

    @traced(TRACE_NAME)
    async updateItem(
        recordName: string,
        item: Partial<PackageRecordVersion>
    ): Promise<CrudResult> {
        await this._client.packageRecordVersion.update({
            where: {
                recordName_address_major_minor_patch_tag: {
                    recordName,
                    address: item.address,
                    major: item.key.major,
                    minor: item.key.minor,
                    patch: item.key.patch,
                    tag: item.key.tag,
                },
            },
            data: {
                auxFileName: item.auxFileName,
                auxSha256: item.auxSha256,
                sha256: item.sha256,
                entitlements: item.entitlements as unknown as string[],
                description: item.description,
                markers: item.markers,
                sizeInBytes: item.sizeInBytes,
                requiresReview: item.requiresReview,
                createdFile: item.createdFile,
            },
        });

        return {
            success: true,
        };
    }

    @traced(TRACE_NAME)
    async putItem(
        recordName: string,
        item: Partial<PackageRecordVersion>
    ): Promise<CrudResult> {
        await this._client.packageRecordVersion.upsert({
            where: {
                recordName_address_major_minor_patch_tag: {
                    recordName,
                    address: item.address,
                    major: item.key.major,
                    minor: item.key.minor,
                    patch: item.key.patch,
                    tag: item.key.tag,
                },
            },
            create: {
                id: item.id,
                recordName: recordName,
                address: item.address,
                major: item.key.major,
                minor: item.key.minor,
                patch: item.key.patch,
                tag: item.key.tag,
                auxFileName: item.auxFileName,
                auxSha256: item.auxSha256,
                sha256: item.sha256,
                entitlements: item.entitlements as unknown as JsonObject[],
                description: item.description,
                markers: item.markers,
                sizeInBytes: item.sizeInBytes,
                requiresReview: item.requiresReview,
                createdFile: item.createdFile,
                createdAt: convertToDate(item.createdAtMs),
            },
            update: {
                auxFileName: item.auxFileName,
                auxSha256: item.auxSha256,
                sha256: item.sha256,
                entitlements: item.entitlements as unknown as JsonObject[],
                description: item.description,
                markers: item.markers,
                sizeInBytes: item.sizeInBytes,
                requiresReview: item.requiresReview,
                createdFile: item.createdFile,
            },
        });

        return {
            success: true,
        };
    }

    @traced(TRACE_NAME)
    async deleteItem(
        recordName: string,
        address: string,
        key: PackageRecordVersionKey
    ): Promise<CrudResult> {
        await this._client.packageRecordVersion.delete({
            where: {
                recordName_address_major_minor_patch_tag: {
                    recordName,
                    address: address,
                    major: key.major,
                    minor: key.minor,
                    patch: key.patch,
                    tag: key.tag,
                },
            },
        });

        return {
            success: true,
        };
    }

    @traced(TRACE_NAME)
    async listItems(
        recordName: string,
        address: string
    ): Promise<ListSubCrudStoreSuccess<PackageRecordVersion>> {
        const items = await this._client.packageRecordVersion.findMany({
            where: {
                recordName,
                address: address,
            },
            orderBy: [
                {
                    major: 'desc',
                },
                {
                    minor: 'desc',
                },
                {
                    patch: 'desc',
                },
                {
                    tag: 'asc',
                },
            ],
        });

        return {
            success: true,
            items: items.map((i) => this._convertToItem(i)),
            totalCount: items.length,
        };
    }
}
