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
import {
    cleanupObject,
    type SubscriptionFilter,
} from '@casual-simulation/aux-records';
import type {
    Prisma,
    PrismaClient,
    DatabaseRecord as PrismaDatabaseRecord,
} from '../generated-sqlite';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';
import type { SqliteMetricsStore } from './SqliteMetricsStore';
import type {
    DatabaseRecord,
    DatabaseRecordsStore,
    DatabaseSubscriptionMetrics,
} from '@casual-simulation/aux-records/database';
import type {
    ListCrudStoreSuccess,
    ListCrudStoreByMarkerRequest,
} from '@casual-simulation/aux-records/crud';

const TRACE_NAME = 'SqliteDatabaseRecordsStore';

export class SqliteDatabaseRecordsStore implements DatabaseRecordsStore {
    private _client: PrismaClient;
    private _metrics: SqliteMetricsStore;

    constructor(client: PrismaClient, metrics: SqliteMetricsStore) {
        this._client = client;
        this._metrics = metrics;
    }

    @traced(TRACE_NAME)
    async createItem(recordName: string, item: DatabaseRecord): Promise<void> {
        await this._client.databaseRecord.create({
            data: {
                recordName: recordName,
                address: item.address,
                markers: item.markers,
                databaseInfo: item.databaseInfo as any,
                databaseName: item.databaseName,
                databaseProvider: item.databaseProvider,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
        });
    }

    @traced(TRACE_NAME)
    async getItemByAddress(
        recordName: string,
        address: string
    ): Promise<DatabaseRecord> {
        const item = await this._client.databaseRecord.findUnique({
            where: {
                recordName_address: {
                    recordName: recordName,
                    address: address,
                },
            },
        });

        if (item) {
            return this._convertRecord(item);
        }

        return null;
    }

    @traced(TRACE_NAME)
    async updateItem(
        recordName: string,
        item: Partial<DatabaseRecord>
    ): Promise<void> {
        await this._client.searchRecord.update({
            where: {
                recordName_address: {
                    recordName: recordName,
                    address: item.address,
                },
            },
            data: cleanupObject({
                markers: item.markers,
                databaseInfo: item.databaseInfo as any,
                databaseName: item.databaseName,
                databaseProvider: item.databaseProvider,
                updatedAt: Date.now(),
            }),
        });
    }

    @traced(TRACE_NAME)
    async putItem(
        recordName: string,
        item: Partial<DatabaseRecord>
    ): Promise<void> {
        await this._client.databaseRecord.upsert({
            where: {
                recordName_address: {
                    recordName: recordName,
                    address: item.address,
                },
            },
            create: {
                recordName: recordName,
                address: item.address,
                markers: item.markers,
                databaseInfo: item.databaseInfo as any,
                databaseName: item.databaseName,
                databaseProvider: item.databaseProvider,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
            update: cleanupObject({
                markers: item.markers,
                databaseInfo: item.databaseInfo as any,
                databaseName: item.databaseName,
                databaseProvider: item.databaseProvider,
                updatedAt: Date.now(),
            }),
        });
    }

    @traced(TRACE_NAME)
    async deleteItem(recordName: string, address: string): Promise<void> {
        await this._client.databaseRecord.delete({
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
    ): Promise<ListCrudStoreSuccess<DatabaseRecord>> {
        const filter: Prisma.DatabaseRecordWhereInput = {
            recordName: recordName,
        };

        if (address) {
            filter.address = {
                gt: address,
            };
        }

        const [count, records] = await Promise.all([
            this._client.databaseRecord.count({
                where: {
                    recordName: recordName,
                },
            }),
            this._client.databaseRecord.findMany({
                where: filter,
                orderBy: {
                    address: 'asc',
                },
                select: {
                    address: true,
                    markers: true,
                    databaseInfo: true,
                    databaseName: true,
                    databaseProvider: true,
                },
                take: 10,
            }),
        ]);

        return {
            success: true,
            totalCount: count,
            items: records.map((r) => this._convertRecord(r)),
            marker: null,
        };
    }

    @traced(TRACE_NAME)
    async listItemsByMarker(
        request: ListCrudStoreByMarkerRequest
    ): Promise<ListCrudStoreSuccess<DatabaseRecord>> {
        const countPromise = this._client.$queryRaw<
            { count: number }[]
        >`SELECT COUNT(*) as count FROM "DatabaseRecord" WHERE "recordName" = ${request.recordName} AND ${request.marker} IN json_each("markers")`;

        const limit = 10;
        const recordsPromise: Prisma.PrismaPromise<PrismaDatabaseRecord[]> =
            !!request.startingAddress
                ? request.sort === 'descending'
                    ? this._client
                          .$queryRaw`SELECT "address", "markers", "databaseInfo", "databaseName", "databaseProvider" FROM "DatabaseRecord" WHERE "recordName" = ${request.recordName} AND ${request.marker} IN json_each("markers") AND "address" < ${request.startingAddress} ORDER BY "address" DESC LIMIT ${limit}`
                    : this._client
                          .$queryRaw`SELECT "address", "markers", "databaseInfo", "databaseName", "databaseProvider" FROM "DatabaseRecord" WHERE "recordName" = ${request.recordName} AND ${request.marker} IN json_each("markers") AND "address" > ${request.startingAddress} ORDER BY "address" ASC LIMIT ${limit}`
                : this._client
                      .$queryRaw`SELECT "address", "markers", "databaseInfo", "databaseName", "databaseProvider" FROM "DatabaseRecord" WHERE "recordName" = ${request.recordName} AND ${request.marker} IN json_each("markers") ORDER BY "address" ASC LIMIT ${limit}`;

        const [count, records] = await Promise.all([
            countPromise,
            recordsPromise,
        ]);

        return {
            success: true,
            items: records.map((r) => this._convertRecord(r)),
            totalCount: count[0].count,
            marker: request.marker,
        };
    }

    @traced(TRACE_NAME)
    async getSubscriptionMetrics(
        filter: SubscriptionFilter
    ): Promise<DatabaseSubscriptionMetrics> {
        const metrics = await this._metrics.getSubscriptionRecordMetrics(
            filter
        );

        const where: Prisma.DatabaseRecordWhereInput = {};

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
            this._client.databaseRecord.count({
                where,
            }),
        ]);

        return {
            ...metrics,
            totalItems,
        };
    }

    private _convertRecord(
        record: Omit<
            PrismaDatabaseRecord,
            'recordName' | 'createdAt' | 'updatedAt'
        >
    ): DatabaseRecord {
        return {
            address: record.address,
            markers: record.markers as string[],
            databaseInfo: record.databaseInfo as any,
            databaseName: record.databaseName,
            databaseProvider: record.databaseProvider as 'sqlite' | 'turso',
        };
    }
}
