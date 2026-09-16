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
    ProxyRecord,
    ProxyRecordData,
    ProxyRecordsStore,
    ProxyRequestInfo,
    ProxySubscriptionMetrics,
} from '@casual-simulation/aux-records/proxy/ProxyRecordsStore';
import type {
    PrismaClient,
    Prisma,
    ProxyRecord as PrismaProxyRecord,
} from '../generated-sqlite';
import type { SqliteMetricsStore } from './SqliteMetricsStore';
import { convertMarkers } from '../Utils';
import type {
    ListCrudStoreByMarkerRequest,
    ListCrudStoreSuccess,
} from '@casual-simulation/aux-records/crud';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';
import type { SubscriptionFilter } from '@casual-simulation/aux-records';
import { v7 as uuidv7 } from 'uuid';

const TRACE_NAME = 'SqliteProxyRecordsStore';

export class SqliteProxyRecordsStore implements ProxyRecordsStore {
    private _client: PrismaClient;
    private _metrics: SqliteMetricsStore;

    constructor(client: PrismaClient, metrics: SqliteMetricsStore) {
        this._client = client;
        this._metrics = metrics;
    }

    @traced(TRACE_NAME)
    async createItem(recordName: string, item: ProxyRecord): Promise<void> {
        await this._client.proxyRecord.create({
            data: {
                recordName: recordName,
                address: item.address,
                host: item.host,
                data: (item.data ?? {}) as Prisma.InputJsonValue,
                markers: item.markers,

                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
        });
    }

    @traced(TRACE_NAME)
    async getItemByAddress(
        recordName: string,
        address: string
    ): Promise<ProxyRecord | null> {
        const item = await this._client.proxyRecord.findUnique({
            where: {
                recordName_address: {
                    recordName: recordName,
                    address: address,
                },
            },
        });

        if (!item) {
            return null;
        }

        return this._convertToItem(item);
    }

    @traced(TRACE_NAME)
    async updateItem(
        recordName: string,
        item: Partial<ProxyRecord>
    ): Promise<void> {
        await this._client.proxyRecord.update({
            where: {
                recordName_address: {
                    recordName: recordName,
                    address: item.address,
                },
            },
            data: {
                host: item.host,
                data: item.data as Prisma.InputJsonValue,
                markers: item.markers,

                updatedAt: Date.now(),
            },
        });
    }

    @traced(TRACE_NAME)
    async putItem(
        recordName: string,
        item: Partial<ProxyRecord>
    ): Promise<void> {
        await this._client.proxyRecord.upsert({
            where: {
                recordName_address: {
                    recordName: recordName,
                    address: item.address,
                },
            },
            create: {
                recordName: recordName,
                address: item.address,
                host: item.host,
                data: (item.data ?? {}) as Prisma.InputJsonValue,
                markers: item.markers,

                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
            update: {
                host: item.host,
                data: item.data as Prisma.InputJsonValue,
                markers: item.markers,

                updatedAt: Date.now(),
            },
        });
    }

    @traced(TRACE_NAME)
    async deleteItem(recordName: string, address: string): Promise<void> {
        await this._client.proxyRecord.delete({
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
        address: string | null
    ): Promise<ListCrudStoreSuccess<ProxyRecord>> {
        let query: Prisma.ProxyRecordWhereInput = {
            recordName: recordName,
        };

        if (address) {
            query.address = {
                gt: address,
            };
        }

        const [count, items] = await Promise.all([
            this._client.proxyRecord.count({
                where: {
                    recordName: recordName,
                },
            }),
            this._client.proxyRecord.findMany({
                where: query,
                orderBy: {
                    address: 'asc',
                },
                take: 10,
            }),
        ]);

        return {
            success: true,
            items: items.map((i) => this._convertToItem(i)),
            marker: null,
            totalCount: count,
        };
    }

    @traced(TRACE_NAME)
    async listItemsByMarker(
        request: ListCrudStoreByMarkerRequest
    ): Promise<ListCrudStoreSuccess<ProxyRecord>> {
        const countPromise = this._client.$queryRaw<
            { count: number }[]
        >`SELECT COUNT(*) as count FROM "ProxyRecord" WHERE "recordName" = ${request.recordName} AND ${request.marker} IN json_each("markers")`;

        const limit = 10;
        const recordsPromise: Prisma.PrismaPromise<PrismaProxyRecord[]> =
            !!request.startingAddress
                ? request.sort === 'descending'
                    ? this._client
                          .$queryRaw`SELECT * FROM "ProxyRecord" WHERE "recordName" = ${request.recordName} AND ${request.marker} IN json_each("markers") AND "address" < ${request.startingAddress} ORDER BY "address" DESC LIMIT ${limit}`
                    : this._client
                          .$queryRaw`SELECT * FROM "ProxyRecord" WHERE "recordName" = ${request.recordName} AND ${request.marker} IN json_each("markers") AND "address" > ${request.startingAddress} ORDER BY "address" ASC LIMIT ${limit}`
                : this._client
                      .$queryRaw`SELECT * FROM "ProxyRecord" WHERE "recordName" = ${request.recordName} AND ${request.marker} IN json_each("markers") ORDER BY "address" ASC LIMIT ${limit}`;

        const [count, items] = await Promise.all([
            countPromise,
            recordsPromise,
        ]);

        return {
            success: true,
            items: items.map((i) => this._convertToItem(i)),
            totalCount: count[0].count,
            marker: request.marker,
        };
    }

    @traced(TRACE_NAME)
    async recordProxyRequest(request: ProxyRequestInfo): Promise<void> {
        await this._client.proxyRequest.create({
            data: {
                id: uuidv7(),
                recordName: request.recordName,
                proxyAddress: request.proxyAddress,
                requestTime: request.requestTimeMs,

                createdAt: Date.now(),
            },
        });
    }

    @traced(TRACE_NAME)
    async getSubscriptionMetrics(
        filter: SubscriptionFilter
    ): Promise<ProxySubscriptionMetrics> {
        const metrics = await this._metrics.getSubscriptionRecordMetrics(
            filter
        );

        const where: Prisma.ProxyRecordWhereInput = {};
        const whereRequest: Prisma.ProxyRequestWhereInput = {};

        if (filter.ownerId) {
            where.record = {
                ownerId: filter.ownerId,
            };
            whereRequest.record = {
                ownerId: filter.ownerId,
            };
        } else if (filter.studioId) {
            where.record = {
                studioId: filter.studioId,
            };
            whereRequest.record = {
                studioId: filter.studioId,
            };
        } else {
            throw new Error('Invalid filter');
        }

        const [totalItems, totalRequestsInPeriod, totalRequestsInLastHour] =
            await Promise.all([
                this._client.proxyRecord.count({
                    where,
                }),
                this._client.proxyRequest.count({
                    where: {
                        ...whereRequest,
                        requestTime: {
                            lt: metrics.currentPeriodEndMs,
                            gte: metrics.currentPeriodStartMs,
                        },
                    },
                }),
                this._client.proxyRequest.count({
                    where: {
                        ...whereRequest,
                        requestTime: {
                            gte: Date.now() - 60 * 60 * 1000,
                        },
                    },
                }),
            ]);

        return {
            ...metrics,
            totalItems,
            totalRequestsInPeriod,
            totalRequestsInLastHour,
        };
    }

    private _convertToItem(item: PrismaProxyRecord): ProxyRecord {
        return {
            address: item.address,
            host: item.host,
            data: (item.data ?? {}) as ProxyRecordData,
            markers: convertMarkers(item.markers as string[]),
        };
    }
}
