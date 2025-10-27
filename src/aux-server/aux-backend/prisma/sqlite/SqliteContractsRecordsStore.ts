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
    ContractInvoice as PrismaContractInvoice,
} from '../generated-sqlite';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';
import type { SqliteMetricsStore } from './SqliteMetricsStore';
import type {
    ContractInvoice,
    ContractRecord,
    ContractRecordsStore,
    ContractStatus,
    ContractSubscriptionMetrics,
    InvoicePayoutDestination,
    InvoiceStatus,
} from '@casual-simulation/aux-records/contracts';
import type {
    ListCrudStoreSuccess,
    ListCrudStoreByMarkerRequest,
    PartialExcept,
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
    async createInvoice(invoice: ContractInvoice): Promise<void> {
        await this._client.contractInvoice.create({
            data: {
                id: invoice.id,
                contractId: invoice.contractId,
                amount: invoice.amount,
                status: invoice.status,
                openedAt: invoice.openedAtMs,
                note: invoice.note,
                paidAt: invoice.paidAtMs,
                voidedAt: invoice.voidedAtMs,
                payoutDestination: invoice.payoutDestination,

                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
        });
    }

    async getInvoiceById(
        id: string
    ): Promise<{ invoice: ContractInvoice; contract: ContractRecord } | null> {
        const invoice = await this._client.contractInvoice.findUnique({
            where: {
                id: id,
            },
            include: {
                contract: true,
            },
        });

        if (!invoice) {
            return null;
        }

        return {
            invoice: this._convertInvoice(invoice),
            contract: this._convertRecord(invoice.contract),
        };
    }

    private _convertInvoice(invoice: PrismaContractInvoice): ContractInvoice {
        return {
            id: invoice.id,
            contractId: invoice.contractId,
            amount: invoice.amount,
            status: invoice.status as InvoiceStatus,
            openedAtMs: invoice.openedAt?.toNumber(),
            note: invoice.note,
            paidAtMs: invoice.paidAt?.toNumber(),
            voidedAtMs: invoice.voidedAt?.toNumber(),
            payoutDestination:
                invoice.payoutDestination as InvoicePayoutDestination,
            createdAtMs: invoice.createdAt?.toNumber(),
            updatedAtMs: invoice.updatedAt?.toNumber(),
        };
    }

    async updateInvoice(
        invoice: PartialExcept<ContractInvoice, 'id'>
    ): Promise<void> {
        await this._client.contractInvoice.update({
            where: {
                id: invoice.id,
            },
            data: cleanupObject({
                contractId: invoice.contractId,
                amount: invoice.amount,
                status: invoice.status,
                openedAtMs: invoice.openedAtMs,
                note: invoice.note,
                paidAtMs: invoice.paidAtMs,
                voidedAtMs: invoice.voidedAtMs,
                payoutDestination: invoice.payoutDestination,

                updatedAt: Date.now(),
            }),
        });
    }

    async deleteInvoice(id: string): Promise<void> {
        await this._client.contractInvoice.delete({
            where: {
                id,
            },
        });
    }

    async listInvoicesForContract(
        contractId: string
    ): Promise<ContractInvoice[]> {
        const invoices = await this._client.contractInvoice.findMany({
            where: {
                contractId,
            },
        });

        return invoices.map((i) => this._convertInvoice(i));
    }

    async markOpenInvoiceAs(
        invoiceId: string,
        status: 'paid' | 'void'
    ): Promise<void> {
        await this._client.contractInvoice.update({
            where: {
                id: invoiceId,
                status: 'open',
            },
            data: cleanupObject({
                status: status,
                voidedAt: status === 'void' ? Date.now() : undefined,
                paidAt: status === 'paid' ? Date.now() : undefined,

                updatedAt: Date.now(),
            }),
        });
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
        await this._client.$transaction([
            this._client.contractRecord.update({
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
            }),
            this._client.contractInvoice.updateMany({
                where: {
                    contract: {
                        recordName: recordName,
                        address: address,
                    },
                    status: 'open',
                },
                data: {
                    status: 'void',
                    voidedAt: Date.now(),
                    updatedAt: Date.now(),
                },
            }),
        ]);
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
            closedAt: { equals: null },
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
            marker: request.marker,
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
