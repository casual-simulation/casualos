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
    PurchasableItem,
    PurchasableItemMetrics,
} from '@casual-simulation/aux-records/purchasable-items/PurchasableItemRecordsStore';
import type { PrismaClient, Prisma } from './generated';
import type { PrismaMetricsStore } from './PrismaMetricsStore';
import type {
    CrudRecordsStore,
    ListCrudStoreByMarkerRequest,
    ListCrudStoreSuccess,
} from '@casual-simulation/aux-records/crud';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';
import type { SubscriptionFilter } from '@casual-simulation/aux-records';

const TRACE_NAME = 'PrismaPurchasableItemRecordsStore';

export class PrismaPurchasableItemRecordsStore
    implements CrudRecordsStore<PurchasableItem>
{
    private _client: PrismaClient;
    private _metrics: PrismaMetricsStore;

    constructor(client: PrismaClient, metrics: PrismaMetricsStore) {
        this._client = client;
        this._metrics = metrics;
    }

    @traced(TRACE_NAME)
    async createItem(recordName: string, item: PurchasableItem): Promise<void> {
        await this._client.purchasableItemRecord.create({
            data: {
                recordName: recordName,
                address: item.address,
                name: item.name,
                description: item.description,
                imageUrls: item.imageUrls,
                cost: item.cost,
                currency: item.currency,
                taxCode: item.taxCode,
                roleName: item.roleName,
                roleGrantTimeMs: item.roleGrantTimeMs,
                markers: item.markers,
            },
        });
    }

    @traced(TRACE_NAME)
    async getItemByAddress(
        recordName: string,
        address: string
    ): Promise<PurchasableItem> {
        const item = await this._client.purchasableItemRecord.findUnique({
            where: {
                recordName_address: {
                    recordName: recordName,
                    address: address,
                },
            },
        });

        return item;
    }

    @traced(TRACE_NAME)
    async updateItem(
        recordName: string,
        item: Partial<PurchasableItem>
    ): Promise<void> {
        await this._client.purchasableItemRecord.update({
            where: {
                recordName_address: {
                    recordName: recordName,
                    address: item.address,
                },
            },
            data: {
                name: item.name,
                description: item.description,
                imageUrls: item.imageUrls,
                cost: item.cost,
                currency: item.currency,
                taxCode: item.taxCode,
                roleName: item.roleName,
                roleGrantTimeMs: item.roleGrantTimeMs,
                markers: item.markers,
            },
        });
    }

    @traced(TRACE_NAME)
    async putItem(
        recordName: string,
        item: Partial<PurchasableItem>
    ): Promise<void> {
        await this._client.purchasableItemRecord.upsert({
            where: {
                recordName_address: {
                    recordName: recordName,
                    address: item.address,
                },
            },
            create: {
                recordName: recordName,
                address: item.address,
                name: item.name,
                description: item.description,
                imageUrls: item.imageUrls,
                cost: item.cost,
                currency: item.currency,
                taxCode: item.taxCode,
                roleName: item.roleName,
                roleGrantTimeMs: item.roleGrantTimeMs,
                markers: item.markers,
            },
            update: {
                name: item.name,
                description: item.description,
                imageUrls: item.imageUrls,
                cost: item.cost,
                currency: item.currency,
                taxCode: item.taxCode,
                roleName: item.roleName,
                roleGrantTimeMs: item.roleGrantTimeMs,
                markers: item.markers,
            },
        });
    }

    @traced(TRACE_NAME)
    async deleteItem(recordName: string, address: string): Promise<void> {
        await this._client.purchasableItemRecord.delete({
            where: {
                recordName_address: {
                    recordName: recordName,
                    address: address,
                },
            },
        });
    }

    @traced(TRACE_NAME)
    async listItems(
        recordName: string,
        address: string
    ): Promise<ListCrudStoreSuccess<PurchasableItem>> {
        let query: Prisma.PurchasableItemRecordWhereInput = {
            recordName: recordName,
        };

        if (address) {
            query.address = {
                gt: address,
            };
        }

        const [count, items] = await Promise.all([
            this._client.purchasableItemRecord.count({
                where: {
                    recordName: recordName,
                },
            }),
            this._client.purchasableItemRecord.findMany({
                where: query,
                orderBy: {
                    address: 'asc',
                },
                take: 50,
            }),
        ]);

        return {
            success: true,
            items,
            marker: null,
            totalCount: count,
        };
    }

    @traced(TRACE_NAME)
    async listItemsByMarker(
        request: ListCrudStoreByMarkerRequest
    ): Promise<ListCrudStoreSuccess<PurchasableItem>> {
        let query: Prisma.PurchasableItemRecordWhereInput = {
            recordName: request.recordName,
            markers: { has: request.marker },
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
            this._client.purchasableItemRecord.count({
                where: {
                    recordName: request.recordName,
                    markers: { has: request.marker },
                },
            }),
            this._client.purchasableItemRecord.findMany({
                where: query,
                orderBy: {
                    address: request.sort === 'descending' ? 'desc' : 'asc',
                },
                take: 50,
            }),
        ]);

        return {
            success: true,
            items,
            marker: request.marker,
            totalCount: count,
        };
    }

    /**
     * Gets the item metrics for the subscription of the given record.
     * @param recordName The name of the record.
     */
    @traced(TRACE_NAME)
    async getSubscriptionMetrics(
        filter: SubscriptionFilter
    ): Promise<PurchasableItemMetrics> {
        const metrics = await this._metrics.getSubscriptionRecordMetrics(
            filter
        );

        const where: Prisma.PurchasableItemRecordWhereInput = {};

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

        const [totalItems] = await Promise.all([
            this._client.purchasableItemRecord.count({
                where,
            }),
        ]);

        return {
            ...metrics,
            totalPurchasableItems: totalItems,
        };
    }
}
