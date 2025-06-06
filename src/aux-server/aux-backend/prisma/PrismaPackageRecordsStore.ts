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

import type {
    PackageRecord,
    PackageRecordsStore,
    PackageSubscriptionMetrics,
    SubscriptionFilter,
} from '@casual-simulation/aux-records';
import type {
    ListCrudStoreSuccess,
    ListCrudStoreByMarkerRequest,
} from '@casual-simulation/aux-records/crud';
import type { Prisma, PrismaClient } from './generated';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';
import { convertMarkers } from './Utils';
import type { PrismaMetricsStore } from './PrismaMetricsStore';

const TRACE_NAME = 'PrismaPackageRecordsStore';

/**
 * A Prisma-based implementation of the PackageRecordsStore.
 */
export class PrismaPackageRecordsStore implements PackageRecordsStore {
    private _client: PrismaClient;
    private _metrics: PrismaMetricsStore;

    constructor(prisma: PrismaClient, metrics: PrismaMetricsStore) {
        this._client = prisma;
        this._metrics = metrics;
    }

    @traced(TRACE_NAME)
    async getSubscriptionMetrics(
        filter: SubscriptionFilter
    ): Promise<PackageSubscriptionMetrics> {
        const metrics = await this._metrics.getSubscriptionRecordMetrics(
            filter
        );

        const where: Prisma.NotificationRecordWhereInput = {};
        const whereRun: Prisma.SentNotificationWhereInput = {};

        if (filter.ownerId) {
            where.record = {
                ownerId: filter.ownerId,
            };
            whereRun.record = {
                ownerId: filter.ownerId,
            };
        } else if (filter.studioId) {
            where.record = {
                studioId: filter.studioId,
            };
            whereRun.record = {
                studioId: filter.studioId,
            };
        } else {
            throw new Error('Invalid filter');
        }

        const [totalItems] = await Promise.all([
            this._client.notificationRecord.count({
                where,
            }),
        ]);

        return {
            ...metrics,
            totalItems,
        };
    }

    @traced(TRACE_NAME)
    async createItem(recordName: string, item: PackageRecord): Promise<void> {
        await this._client.packageRecord.create({
            data: {
                recordName: recordName,
                id: item.id,
                address: item.address,
                markers: item.markers,
            },
        });
    }

    @traced(TRACE_NAME)
    async getItemByAddress(
        recordName: string,
        address: string
    ): Promise<PackageRecord | null> {
        const packageRecord = await this._client.packageRecord.findUnique({
            where: {
                recordName_address: {
                    recordName,
                    address,
                },
            },
        });

        if (!packageRecord) {
            return null;
        }

        return {
            id: packageRecord.id,
            address: packageRecord.address,
            markers: packageRecord.markers,
        };
    }

    @traced(TRACE_NAME)
    async updateItem(
        recordName: string,
        item: Partial<PackageRecord>
    ): Promise<void> {
        await this._client.packageRecord.update({
            where: {
                recordName_address: {
                    recordName,
                    address: item.address,
                },
            },
            data: {
                markers: item.markers,
            },
        });
    }

    @traced(TRACE_NAME)
    async putItem(
        recordName: string,
        item: Partial<PackageRecord>
    ): Promise<void> {
        if (item.id) {
            await this._client.packageRecord.upsert({
                where: {
                    recordName_address: {
                        recordName,
                        address: item.address,
                    },
                },
                create: {
                    id: item.id,
                    recordName,
                    address: item.address,
                    markers: item.markers,
                },
                update: {
                    markers: item.markers,
                },
            });
        } else {
            await this._client.packageRecord.update({
                where: {
                    recordName_address: {
                        recordName,
                        address: item.address,
                    },
                },
                data: {
                    markers: item.markers,
                },
            });
        }
    }

    @traced(TRACE_NAME)
    async deleteItem(recordName: string, address: string): Promise<void> {
        await this._client.packageRecord.delete({
            where: {
                recordName_address: {
                    recordName,
                    address,
                },
            },
        });
    }

    @traced(TRACE_NAME)
    async listItems(
        recordName: string,
        address: string | null
    ): Promise<ListCrudStoreSuccess<PackageRecord>> {
        const query: Prisma.PackageRecordWhereInput = {
            recordName: recordName,
        };

        if (address) {
            query.address = {
                gt: address,
            };
        }

        const [count, items] = await Promise.all([
            this._client.packageRecord.count({
                where: {
                    recordName,
                },
            }),
            this._client.packageRecord.findMany({
                where: query,
                orderBy: {
                    address: 'asc',
                },
                select: {
                    id: true,
                    address: true,
                    markers: true,
                },
                take: 10,
            }),
        ]);

        return {
            success: true,
            items: items.map((item) => ({
                id: item.id,
                address: item.address,
                markers: convertMarkers(item.markers),
            })),
            totalCount: count,
            marker: null,
        };
    }

    @traced(TRACE_NAME)
    async listItemsByMarker(
        request: ListCrudStoreByMarkerRequest
    ): Promise<ListCrudStoreSuccess<PackageRecord>> {
        const query: Prisma.PackageRecordWhereInput = {
            recordName: request.recordName,
            markers: {
                has: request.marker,
            },
        };

        if (request.startingAddress) {
            if (request.sort === 'descending') {
                query.address = {
                    lt: request.startingAddress,
                };
            } else {
                query.address = {
                    gt: request.startingAddress,
                };
            }
        }

        const [count, items] = await Promise.all([
            this._client.packageRecord.count({
                where: {
                    recordName: request.recordName,
                    markers: { has: request.marker },
                },
            }),
            this._client.packageRecord.findMany({
                where: query,
                orderBy: {
                    address: request.sort === 'descending' ? 'desc' : 'asc',
                },
                select: {
                    id: true,
                    address: true,
                    markers: true,
                },
                take: 10,
            }),
        ]);

        return {
            success: true,
            items: items.map((item) => ({
                id: item.id,
                address: item.address,
                markers: convertMarkers(item.markers),
            })),
            totalCount: count,
            marker: request.marker,
        };
    }
}
