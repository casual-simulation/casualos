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
    ContractRecord as PrismaContractRecord,
} from '../generated-sqlite';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';
import type { SqliteMetricsStore } from './SqliteMetricsStore';
import type {
    ContractRecord,
    ContractRecordsStore,
    ContractStatus,
    ContractSubscriptionMetrics,
} from '@casual-simulation/aux-records/contracts';
import type {
    ListCrudStoreSuccess,
    ListCrudStoreByMarkerRequest,
} from '@casual-simulation/aux-records/crud';
import { convertMarkers } from '../Utils';

const TRACE_NAME = 'SqliteContractsRecordsStore';

export class SqliteContractsRecordsStore implements ContractRecordsStore {
    private _client: PrismaClient;
    private _metrics: SqliteMetricsStore;

    constructor(client: PrismaClient, metrics: SqliteMetricsStore) {
        this._client = client;
        this._metrics = metrics;
    }

    @traced(TRACE_NAME)
    async markPendingContractAsOpen(
        recordName: string,
        address: string
    ): Promise<void> {
        await this._client.contractRecord.update({
            where: {
                recordName_address: {
                    recordName: recordName,
                    address: address,
                },
                status: 'pending',
            },
            data: {
                status: 'open',
                updatedAt: Date.now(),
            },
        });
    }

    @traced(TRACE_NAME)
    async markContractAsClosed(
        recordName: string,
        address: string
    ): Promise<void> {
        await this._client.contractRecord.update({
            where: {
                recordName_address: {
                    recordName: recordName,
                    address: address,
                },
                status: { not: 'closed' },
            },
            data: {
                status: 'closed',
                closedAt: Date.now(),
                updatedAt: Date.now(),
            },
        });
    }

    @traced(TRACE_NAME)
    async getItemById(
        id: string
    ): Promise<{ recordName: string; contract: ContractRecord } | null> {
        const item = await this._client.contractRecord.findUnique({
            where: {
                id: id,
            },
        });

        if (!item) {
            return null;
        }

        return {
            recordName: item.recordName,
            contract: this._convertRecord(item),
        };
    }

    @traced(TRACE_NAME)
    async createItem(recordName: string, item: ContractRecord): Promise<void> {
        await this._client.contractRecord.create({
            data: {
                recordName: recordName,
                address: item.address,
                markers: item.markers,
                id: item.id,
                initialValue: item.initialValue,
                issuedAt: item.issuedAtMs,
                rate: item.rate,
                status: item.status,
                holdingUserId: item.holdingUserId,
                issuerUserId: item.issuingUserId,
                closedAt: item.closedAtMs,
                description: item.description,
                stripeCheckoutSessionId: item.stripeCheckoutSessionId,
                stripePaymentIntentId: item.stripePaymentIntentId,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
        });
    }

    @traced(TRACE_NAME)
    async getItemByAddress(
        recordName: string,
        address: string
    ): Promise<ContractRecord> {
        const item = await this._client.contractRecord.findUnique({
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
        item: Partial<ContractRecord>
    ): Promise<void> {
        await this._client.contractRecord.update({
            where: {
                recordName_address: {
                    recordName: recordName,
                    address: item.address,
                },
            },
            data: cleanupObject({
                markers: item.markers,
                initialValue: item.initialValue,
                issuedAt: item.issuedAtMs,
                rate: item.rate,
                status: item.status,
                holdingUserId: item.holdingUserId,
                issuerUserId: item.issuingUserId,
                closedAt: item.closedAtMs,
                description: item.description,
                stripeCheckoutSessionId: item.stripeCheckoutSessionId,
                stripePaymentIntentId: item.stripePaymentIntentId,
                updatedAt: Date.now(),
            }),
        });
    }

    @traced(TRACE_NAME)
    async putItem(
        recordName: string,
        item: Partial<ContractRecord>
    ): Promise<void> {
        await this._client.contractRecord.upsert({
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
                id: item.id,
                initialValue: item.initialValue,
                issuedAt: item.issuedAtMs,
                rate: item.rate,
                status: item.status,
                holdingUserId: item.holdingUserId,
                issuerUserId: item.issuingUserId,
                closedAt: item.closedAtMs,
                description: item.description,
                stripeCheckoutSessionId: item.stripeCheckoutSessionId,
                stripePaymentIntentId: item.stripePaymentIntentId,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
            update: cleanupObject({
                markers: item.markers,
                initialValue: item.initialValue,
                issuedAt: item.issuedAtMs,
                rate: item.rate,
                status: item.status,
                holdingUserId: item.holdingUserId,
                issuerUserId: item.issuingUserId,
                closedAt: item.closedAtMs,
                description: item.description,
                stripeCheckoutSessionId: item.stripeCheckoutSessionId,
                stripePaymentIntentId: item.stripePaymentIntentId,
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
    ): Promise<ListCrudStoreSuccess<ContractRecord>> {
        const filter: Prisma.ContractRecordWhereInput = {
            recordName: recordName,
        };

        if (address) {
            filter.address = {
                gt: address,
            };
        }

        const [count, records] = await Promise.all([
            this._client.contractRecord.count({
                where: {
                    recordName: recordName,
                },
            }),
            this._client.contractRecord.findMany({
                where: filter,
                orderBy: {
                    address: 'asc',
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
    ): Promise<ListCrudStoreSuccess<ContractRecord>> {
        const countPromise = this._client.$queryRaw<
            { count: number }[]
        >`SELECT COUNT(*) as count FROM "ContractRecord" WHERE "recordName" = ${request.recordName} AND ${request.marker} IN json_each("markers")`;

        const limit = 10;

        const recordsPromise: Prisma.PrismaPromise<PrismaContractRecord[]> =
            !!request.startingAddress
                ? request.sort === 'descending'
                    ? this._client
                          .$queryRaw`SELECT * FROM "ContractRecord" WHERE "recordName" = ${request.recordName} AND ${request.marker} IN json_each("markers") AND "address" < ${request.startingAddress} ORDER BY "address" DESC LIMIT ${limit}`
                    : this._client
                          .$queryRaw`SELECT * FROM "ContractRecord" WHERE "recordName" = ${request.recordName} AND ${request.marker} IN json_each("markers") AND "address" > ${request.startingAddress} ORDER BY "address" ASC LIMIT ${limit}`
                : this._client
                      .$queryRaw`SELECT * FROM "ContractRecord" WHERE "recordName" = ${request.recordName} AND ${request.marker} IN json_each("markers") ORDER BY "address" ASC LIMIT ${limit}`;

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

    @traced(TRACE_NAME)
    async getSubscriptionMetrics(
        filter: SubscriptionFilter
    ): Promise<ContractSubscriptionMetrics> {
        const metrics = await this._metrics.getSubscriptionRecordMetrics(
            filter
        );

        const where: Prisma.ContractRecordWhereInput = {};

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
            this._client.contractRecord.count({
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
            PrismaContractRecord,
            'recordName' | 'createdAt' | 'updatedAt'
        >
    ): ContractRecord {
        return {
            address: record.address,
            markers: convertMarkers(record.markers as string[]),
            id: record.id,
            initialValue: record.initialValue,
            rate: record.rate,
            status: record.status as ContractStatus,
            holdingUserId: record.holdingUserId,
            issuingUserId: record.issuerUserId,
            issuedAtMs: record.issuedAt?.toNumber(),
            closedAtMs: record.closedAt?.toNumber(),
            description: record.description,
            stripeCheckoutSessionId: record.stripeCheckoutSessionId,
            stripePaymentIntentId: record.stripePaymentIntentId,
        };
    }
}
