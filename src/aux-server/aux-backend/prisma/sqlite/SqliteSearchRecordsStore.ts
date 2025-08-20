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
    GetSearchRecordSyncByTargetResult,
    SearchRecord,
    SearchRecordsStore,
    SearchRecordSync,
    SearchRecordSyncHistory,
    SearchSubscriptionMetrics,
    SubscriptionFilter,
} from '@casual-simulation/aux-records';
import { cleanupObject } from '@casual-simulation/aux-records';
import type {
    ListCrudStoreSuccess,
    ListCrudStoreByMarkerRequest,
} from '@casual-simulation/aux-records/crud/CrudRecordsStore';
import type {
    Prisma,
    PrismaClient,
    SearchRecord as PrismaSearchRecord,
    SearchRecordSync as PrismaSearchRecordSync,
} from '../generated-sqlite';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';
import type { SqliteMetricsStore } from './SqliteMetricsStore';
import { z } from 'zod';
import type { ResourceKinds } from '@casual-simulation/aux-common';

const ERROR_RESULT_SCHEMA = z
    .object({
        success: z.literal(false),
        errorCode: z.string(),
        errorMessage: z.string(),
    })
    .passthrough()
    .optional()
    .nullable();

const TRACE_NAME = 'SqliteSearchRecordsStore';

export class SqliteSearchRecordsStore implements SearchRecordsStore {
    private _client: PrismaClient;
    private _metrics: SqliteMetricsStore;

    constructor(client: PrismaClient, metrics: SqliteMetricsStore) {
        this._client = client;
        this._metrics = metrics;
    }

    async getSync(syncId: string): Promise<SearchRecordSync | null> {
        const sync = await this._client.searchRecordSync.findUnique({
            where: {
                id: syncId,
            },
        });

        return this._mapSearchSync(sync);
    }

    async getSyncsByTarget(
        targetRecordName: string,
        targetResourceKind: ResourceKinds,
        markers: string[]
    ): Promise<GetSearchRecordSyncByTargetResult[]> {
        const syncs = await this._client.searchRecordSync.findMany({
            where: {
                targetRecordName: targetRecordName,
                targetResourceKind: targetResourceKind as any,
                targetMarker: {
                    in: markers,
                },
            },
            include: {
                searchRecord: true,
            },
        });

        return syncs.map((s) => ({
            sync: this._mapSearchSync(s),
            searchRecord: s.searchRecord
                ? this._convertRecord(s.searchRecord)
                : null,
        }));
    }

    /**
     * Saves a search record sync.
     * @param sync The search record sync to save.
     */
    @traced(TRACE_NAME)
    async saveSync(sync: SearchRecordSync): Promise<void> {
        await this._client.searchRecordSync.upsert({
            where: {
                id: sync.id,
            },
            create: {
                id: sync.id,
                searchRecordName: sync.searchRecordName,
                searchRecordAddress: sync.searchRecordAddress,
                targetRecordName: sync.targetRecordName,
                targetResourceKind: sync.targetResourceKind,
                targetMarker: sync.targetMarker,
                targetMapping: sync.targetMapping,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
            update: {
                searchRecordName: sync.searchRecordName,
                searchRecordAddress: sync.searchRecordAddress,
                targetRecordName: sync.targetRecordName,
                targetResourceKind: sync.targetResourceKind,
                targetMarker: sync.targetMarker,
                targetMapping: sync.targetMapping,
                updatedAt: Date.now(),
            },
        });
    }

    @traced(TRACE_NAME)
    async deleteSync(syncId: string): Promise<void> {
        await this._client.searchRecordSync.delete({
            where: {
                id: syncId,
            },
        });
    }

    @traced(TRACE_NAME)
    async listSyncsBySearchRecord(
        recordName: string,
        address: string
    ): Promise<SearchRecordSync[]> {
        const syncs = await this._client.searchRecordSync.findMany({
            where: {
                searchRecordName: recordName,
                searchRecordAddress: address,
            },
        });

        return syncs.map((sync) => this._mapSearchSync(sync));
    }

    private _mapSearchSync(sync: PrismaSearchRecordSync): SearchRecordSync {
        if (!sync) {
            return null;
        }
        return {
            id: sync.id,
            searchRecordName: sync.searchRecordName,
            searchRecordAddress: sync.searchRecordAddress,
            targetRecordName: sync.targetRecordName,
            targetResourceKind:
                sync.targetResourceKind as SearchRecordSync['targetResourceKind'],
            targetMarker: sync.targetMarker,
            targetMapping:
                sync.targetMapping as SearchRecordSync['targetMapping'],
        };
    }

    @traced(TRACE_NAME)
    async createSyncHistory(history: SearchRecordSyncHistory): Promise<void> {
        await this._client.searchRecordSyncHistory.create({
            data: {
                id: history.id,
                syncId: history.syncId,
                runId: history.runId,
                searchRecordName: history.searchRecordName,
                searchRecordAddress: history.searchRecordAddress,
                time: history.timeMs,
                status: history.status,
                success: history.success,
                numSynced: history.numSynced,
                numErrored: history.numErrored,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
        });
    }

    @traced(TRACE_NAME)
    async getSubscriptionMetrics(
        filter: SubscriptionFilter
    ): Promise<SearchSubscriptionMetrics> {
        const metrics = await this._metrics.getSubscriptionRecordMetrics(
            filter
        );

        const where: Prisma.SearchRecordWhereInput = {};

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
            this._client.searchRecord.count({
                where,
            }),
        ]);

        return {
            ...metrics,
            totalItems,
        };
    }

    @traced(TRACE_NAME)
    async createItem(recordName: string, item: SearchRecord): Promise<void> {
        await this._client.searchRecord.create({
            data: {
                recordName: recordName,
                address: item.address,
                markers: item.markers,
                collectionName: item.collectionName,
                searchApiKey: item.searchApiKey,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
        });
    }

    @traced(TRACE_NAME)
    async getItemByAddress(
        recordName: string,
        address: string
    ): Promise<SearchRecord> {
        const item = await this._client.searchRecord.findUnique({
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
        item: Partial<SearchRecord>
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
                collectionName: item.collectionName,
                searchApiKey: item.searchApiKey,
                updatedAt: Date.now(),
            }),
        });
    }

    @traced(TRACE_NAME)
    async putItem(
        recordName: string,
        item: Partial<SearchRecord>
    ): Promise<void> {
        await this._client.searchRecord.upsert({
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
                collectionName: item.collectionName,
                searchApiKey: item.searchApiKey,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
            update: cleanupObject({
                markers: item.markers,
                collectionName: item.collectionName,
                searchApiKey: item.searchApiKey,
                updatedAt: Date.now(),
            }),
        });
    }

    @traced(TRACE_NAME)
    async deleteItem(recordName: string, address: string): Promise<void> {
        await this._client.searchRecord.delete({
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
    ): Promise<ListCrudStoreSuccess<SearchRecord>> {
        const filter: Prisma.SearchRecordWhereInput = {
            recordName: recordName,
        };

        if (address) {
            filter.address = {
                gt: address,
            };
        }

        const [count, records] = await Promise.all([
            this._client.searchRecord.count({
                where: {
                    recordName: recordName,
                },
            }),
            this._client.searchRecord.findMany({
                where: filter,
                orderBy: {
                    address: 'asc',
                },
                select: {
                    address: true,
                    markers: true,
                    collectionName: true,
                    searchApiKey: true,
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
    ): Promise<ListCrudStoreSuccess<SearchRecord>> {
        const countPromise = this._client.$queryRaw<
            { count: number }[]
        >`SELECT COUNT(*) as count FROM "SearchRecord" WHERE "recordName" = ${request.recordName} AND ${request.marker} IN json_each("markers")`;

        const limit = 10;
        const recordsPromise: Prisma.PrismaPromise<PrismaSearchRecord[]> =
            !!request.startingAddress
                ? request.sort === 'descending'
                    ? this._client
                          .$queryRaw`SELECT "address", "markers", "collectionName", "searchApiKey" FROM "SearchRecord" WHERE "recordName" = ${request.recordName} AND ${request.marker} IN json_each("markers") AND "address" < ${request.startingAddress} ORDER BY "address" DESC LIMIT ${limit}`
                    : this._client
                          .$queryRaw`SELECT "address", "markers", "collectionName", "searchApiKey" FROM "SearchRecord" WHERE "recordName" = ${request.recordName} AND ${request.marker} IN json_each("markers") AND "address" > ${request.startingAddress} ORDER BY "address" ASC LIMIT ${limit}`
                : this._client
                      .$queryRaw`SELECT "address", "markers", "collectionName", "searchApiKey" FROM "SearchRecord" WHERE "recordName" = ${request.recordName} AND ${request.marker} IN json_each("markers") ORDER BY "address" ASC LIMIT ${limit}`;

        const [count, records] = await Promise.all([
            countPromise,
            recordsPromise,
        ]);

        return {
            success: true,
            items: records.map((r) => this._convertRecord(r)),
            totalCount: count[0].count,
            marker: null,
        };
    }

    private _convertRecord(
        record: Omit<
            PrismaSearchRecord,
            'recordName' | 'createdAt' | 'updatedAt'
        >
    ): SearchRecord {
        return {
            address: record.address,
            markers: record.markers as string[],
            collectionName: record.collectionName,
            searchApiKey: record.searchApiKey,
        };
    }
}
