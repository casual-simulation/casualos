import {
    cleanupObject,
    SubscriptionFilter,
    WebhookRecord,
    WebhookRecordsStore,
    WebhookRunInfo,
    WebhookRunInfoWithWebhook,
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
    WebhookRun as PrismaWebhookRun,
} from './generated';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';
import { PrismaMetricsStore } from './PrismaMetricsStore';
import { convertToDate, convertToMillis } from './Utils';
import { z } from 'zod';

const ERROR_RESULT_SCHEMA = z
    .object({
        success: z.literal(false),
        errorCode: z.string(),
        errorMessage: z.string(),
    })
    .passthrough()
    .optional()
    .nullable();

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
        const whereRun: Prisma.WebhookRunWhereInput = {};

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

        const [totalItems, totalRunsInPeriod, totalRunsInLastHour] =
            await Promise.all([
                this._client.webhookRecord.count({
                    where,
                }),
                this._client.webhookRun.count({
                    where: {
                        ...whereRun,
                        requestTime: {
                            lt: new Date(metrics.currentPeriodEndMs),
                            gte: new Date(metrics.currentPeriodStartMs),
                        },
                    },
                }),
                this._client.webhookRun.count({
                    where: {
                        ...whereRun,
                        requestTime: {
                            gte: new Date(Date.now() - 60 * 60 * 1000),
                        },
                    },
                }),
            ]);

        return {
            ...metrics,
            totalItems,
            totalRunsInPeriod,
            totalRunsInLastHour,
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
                targetInstRecordName:
                    item.targetResourceKind === 'inst' && item.targetRecordName
                        ? item.targetAddress
                        : null,
                targetPublicInstRecordName:
                    item.targetResourceKind === 'inst' && !item.targetRecordName
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
                targetInstRecordName:
                    item.targetResourceKind === 'inst' && item.targetRecordName
                        ? item.targetAddress
                        : null,
                targetPublicInstRecordName:
                    item.targetResourceKind === 'inst' && !item.targetRecordName
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
                targetInstRecordName:
                    item.targetResourceKind === 'inst' && item.targetRecordName
                        ? item.targetAddress
                        : null,
                targetPublicInstRecordName:
                    item.targetResourceKind === 'inst' && !item.targetRecordName
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
                targetInstRecordName:
                    item.targetResourceKind === 'inst' && item.targetRecordName
                        ? item.targetAddress
                        : null,
                targetPublicInstRecordName:
                    item.targetResourceKind === 'inst' && !item.targetRecordName
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
                orderBy: {
                    address: 'asc',
                },
                select: {
                    address: true,
                    markers: true,
                    targetRecordName: true,
                    targetDataRecordAddress: true,
                    targetFileRecordFileName: true,
                    targetInstRecordName: true,
                    targetPublicInstRecordName: true,
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
                    address: request.sort === 'descending' ? 'desc' : 'asc',
                },
                select: {
                    address: true,
                    markers: true,
                    targetRecordName: true,
                    targetDataRecordAddress: true,
                    targetFileRecordFileName: true,
                    targetInstRecordName: true,
                    targetPublicInstRecordName: true,
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

    @traced(TRACE_NAME)
    async recordWebhookRun(run: WebhookRunInfo): Promise<void> {
        await this._client.webhookRun.create({
            data: {
                id: run.runId,
                recordName: run.recordName,
                webhookAddress: run.webhookAddress,
                requestTime: convertToDate(run.requestTimeMs),
                responseTime: convertToDate(run.responseTimeMs),
                statusCode: run.statusCode,
                stateSha256: run.stateSha256,
                errorResult: run.errorResult,
                infoFileRecordName: run.infoRecordName,
                infoFileName: run.infoFileName,
            },
        });
    }

    @traced(TRACE_NAME)
    async listWebhookRunsForWebhook(
        recordName: string,
        webhookAddress: string,
        startingRequestTime: number = null
    ): Promise<ListCrudStoreSuccess<WebhookRunInfo>> {
        const filter: Prisma.WebhookRunWhereInput = {
            recordName: recordName,
            webhookAddress: webhookAddress,
        };

        if (startingRequestTime) {
            filter.requestTime = {
                lt: convertToDate(startingRequestTime),
            };
        }

        const [count, records] = await Promise.all([
            this._client.webhookRun.count({
                where: {
                    recordName: recordName,
                    webhookAddress: webhookAddress,
                },
            }),
            this._client.webhookRun.findMany({
                where: filter,
                orderBy: {
                    requestTime: 'desc',
                },
                take: 10,
            }),
        ]);

        return {
            success: true,
            totalCount: count,
            items: records.map((r) => this._convertWebhookRun(r)),
            marker: null,
        };
    }

    @traced(TRACE_NAME)
    async getWebhookRunInfo(
        runId: string
    ): Promise<WebhookRunInfoWithWebhook | null> {
        const run = await this._client.webhookRun.findUnique({
            where: {
                id: runId,
            },
            include: {
                webhook: true,
            },
        });

        if (!run) {
            return null;
        }

        return {
            run: this._convertWebhookRun(run),
            webhook: this._convertRecord(run.webhook),
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
                : record.targetInstRecordName ||
                  record.targetPublicInstRecordName
                ? 'inst'
                : null,
            targetAddress:
                record.targetDataRecordAddress ||
                record.targetFileRecordFileName ||
                record.targetInstRecordName ||
                record.targetPublicInstRecordName ||
                '',
            userId: record.userId,
        };
    }

    private _convertWebhookRun(r: PrismaWebhookRun): WebhookRunInfo {
        return {
            runId: r.id,
            recordName: r.recordName,
            webhookAddress: r.webhookAddress,
            requestTimeMs: convertToMillis(r.requestTime),
            responseTimeMs: convertToMillis(r.responseTime),
            statusCode: r.statusCode,
            errorResult: ERROR_RESULT_SCHEMA.parse(
                r.errorResult
            ) as WebhookRunInfo['errorResult'],
            stateSha256: r.stateSha256,
            infoRecordName: r.infoFileRecordName,
            infoFileName: r.infoFileName,
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
