import {
    cleanupObject,
    SubscriptionFilter,
    WebhookRecord,
    WebhookRecordsStore,
    WebhookSubscriptionMetrics,
} from '@casual-simulation/aux-records';
import {
    ListCrudStoreSuccess,
    ListCrudStoreByMarkerRequest,
} from '@casual-simulation/aux-records/crud/CrudRecordsStore';
import {
    Prisma,
    PrismaClient,
    WebhookRecord as PrismaWebhookRecord,
} from './generated';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';
import { PrismaMetricsStore } from './PrismaMetricsStore';

const TRACE_NAME = 'PrismaWebhookRecordsStore';

export class PrismaWebhookRecordsStore implements WebhookRecordsStore {
    private _client: PrismaClient;
    private _metrics: PrismaMetricsStore;

    constructor(client: PrismaClient, metrics: PrismaMetricsStore) {
        this._client = client;
        this._metrics = metrics;
    }

    @traced(TRACE_NAME)
    async getSubscriptionMetrics(
        filter: SubscriptionFilter
    ): Promise<WebhookSubscriptionMetrics> {
        const metrics = await this._metrics.getSubscriptionRecordMetrics(
            filter
        );

        const where: Prisma.WebhookRecordWhereInput = {};

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

        const totalItems = await this._client.webhookRecord.count({
            where,
        });

        return {
            ...metrics,
            totalItems,
        };
    }

    @traced(TRACE_NAME)
    async createItem(recordName: string, item: WebhookRecord): Promise<void> {
        await this._client.webhookRecord.create({
            data: {
                recordName: recordName,
                address: item.address,
                markers: item.markers,
                targetRecordName: item.targetRecordName,
                targetDataRecordAddress:
                    item.targetResourceKind === 'data'
                        ? item.targetAddress
                        : null,
                targetFileRecordFileName:
                    item.targetResourceKind === 'file'
                        ? item.targetAddress
                        : null,
                userId: item.userId,
            },
        });
    }

    @traced(TRACE_NAME)
    async getItemByAddress(
        recordName: string,
        address: string
    ): Promise<WebhookRecord> {
        const item = await this._client.webhookRecord.findUnique({
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
        item: Partial<WebhookRecord>
    ): Promise<void> {
        await this._client.webhookRecord.update({
            where: {
                recordName_address: {
                    recordName: recordName,
                    address: item.address,
                },
            },
            data: cleanupObject({
                markers: item.markers,
                targetRecordName: item.targetRecordName,
                targetDataRecordAddress:
                    item.targetResourceKind === 'data'
                        ? item.targetAddress
                        : null,
                targetFileRecordFileName:
                    item.targetResourceKind === 'file'
                        ? item.targetAddress
                        : null,
                userId: item.userId,
            }),
        });
    }

    @traced(TRACE_NAME)
    async putItem(
        recordName: string,
        item: Partial<WebhookRecord>
    ): Promise<void> {
        await this._client.webhookRecord.upsert({
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
                targetRecordName: item.targetRecordName,
                targetDataRecordAddress:
                    item.targetResourceKind === 'data'
                        ? item.targetAddress
                        : null,
                targetFileRecordFileName:
                    item.targetResourceKind === 'file'
                        ? item.targetAddress
                        : null,
                userId: item.userId,
            },
            update: cleanupObject({
                markers: item.markers,
                targetRecordName: item.targetRecordName,
                targetDataRecordAddress:
                    item.targetResourceKind === 'data'
                        ? item.targetAddress
                        : null,
                targetFileRecordFileName:
                    item.targetResourceKind === 'file'
                        ? item.targetAddress
                        : null,
                userId: item.userId,
            }),
        });
    }

    @traced(TRACE_NAME)
    async deleteItem(recordName: string, address: string): Promise<void> {
        await this._client.webhookRecord.delete({
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
    ): Promise<ListCrudStoreSuccess<WebhookRecord>> {
        const filter: Prisma.WebhookRecordWhereInput = {
            recordName: recordName,
        };

        if (address) {
            filter.address = {
                gt: address,
            };
        }

        const [count, records] = await Promise.all([
            this._client.webhookRecord.count({
                where: {
                    recordName: recordName,
                },
            }),
            this._client.webhookRecord.findMany({
                where: filter,
                select: {
                    address: true,
                    markers: true,
                    targetRecordName: true,
                    targetDataRecordAddress: true,
                    targetFileRecordFileName: true,
                    userId: true,
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
    ): Promise<ListCrudStoreSuccess<WebhookRecord>> {
        let query: Prisma.WebhookRecordWhereInput = {
            recordName: request.recordName,
            markers: { has: request.marker },
        };
        if (!!request.startingAddress) {
            query.address = { gt: request.startingAddress };
        }

        const [count, records] = await Promise.all([
            this._client.webhookRecord.count({
                where: {
                    recordName: request.recordName,
                    markers: { has: request.marker },
                },
            }),
            this._client.webhookRecord.findMany({
                where: query,
                orderBy: {
                    address: 'asc',
                },
                select: {
                    address: true,
                    markers: true,
                    targetRecordName: true,
                    targetDataRecordAddress: true,
                    targetFileRecordFileName: true,
                    userId: true,
                },
                take: 10,
            }),
        ]);

        return {
            success: true,
            items: records.map((r) => this._convertRecord(r)),
            totalCount: count,
            marker: null,
        };
    }

    private _convertRecord(
        record: Omit<
            PrismaWebhookRecord,
            'recordName' | 'createdAt' | 'updatedAt'
        >
    ): WebhookRecord {
        return {
            address: record.address,
            markers: record.markers,
            targetRecordName: record.targetRecordName,
            targetResourceKind: record.targetDataRecordAddress
                ? 'data'
                : record.targetFileRecordFileName
                ? 'file'
                : null,
            targetAddress:
                record.targetDataRecordAddress ||
                record.targetFileRecordFileName ||
                '',
            userId: record.userId,
        };
    }

    @traced(TRACE_NAME)
    private async _findSubscriptionInfoByRecordName(recordName: string) {
        return await this._client.record.findUnique({
            where: {
                name: recordName,
            },
            select: {
                owner: {
                    select: {
                        id: true,
                        subscriptionId: true,
                        subscriptionStatus: true,
                        subscriptionPeriodStart: true,
                        subscriptionPeriodEnd: true,
                    },
                },
                studio: {
                    select: {
                        id: true,
                        subscriptionId: true,
                        subscriptionStatus: true,
                        subscriptionPeriodStart: true,
                        subscriptionPeriodEnd: true,
                    },
                },
            },
        });
    }
}
