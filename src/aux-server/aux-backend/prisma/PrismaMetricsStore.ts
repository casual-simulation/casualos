import {
    AIChatMetrics,
    AIChatSubscriptionMetrics,
    AIImageMetrics,
    AIImageSubscriptionMetrics,
    AISkyboxMetrics,
    AISkyboxSubscriptionMetrics,
    ConfigurationStore,
    DataSubscriptionMetrics,
    EventSubscriptionMetrics,
    FileSubscriptionMetrics,
    MemoryConfiguration,
    MetricsStore,
    RecordSubscriptionMetrics,
    SUBSCRIPTIONS_CONFIG_KEY,
    SubscriptionConfiguration,
    SubscriptionFilter,
    parseSubscriptionConfig,
} from '@casual-simulation/aux-records';
import { PrismaClient, Prisma } from '@prisma/client';
import { convertToMillis } from './Utils';
import { v4 as uuid } from 'uuid';

export class PrismaMetricsStore implements MetricsStore {
    private _client: PrismaClient;

    constructor(client: PrismaClient) {
        this._client = client;
    }

    async getSubscriptionAiImageMetrics(
        filter: SubscriptionFilter
    ): Promise<AIImageSubscriptionMetrics> {
        const metrics = await this.getSubscriptionRecordMetrics(filter);

        const where: Prisma.AiImageMetricsWhereInput = {
            createdAt: {
                lt: new Date(metrics.currentPeriodEndMs),
                gte: new Date(metrics.currentPeriodStartMs),
            },
        };

        if (filter.ownerId) {
            where.userId = filter.ownerId;
        } else if (filter.studioId) {
            where.studioId = filter.studioId;
        } else {
            throw new Error('Invalid filter');
        }

        const chatMetrics = await this._client.aiImageMetrics.aggregate({
            where,
            _sum: {
                squarePixelsGenerated: true,
            },
        });

        return {
            ...metrics,
            totalSquarePixelsInCurrentPeriod:
                chatMetrics._sum.squarePixelsGenerated,
        };
    }

    async recordImageMetrics(metrics: AIImageMetrics): Promise<void> {
        await this._client.aiImageMetrics.create({
            data: {
                id: uuid(),
                userId: metrics.userId,
                studioId: metrics.studioId,
                squarePixelsGenerated: metrics.squarePixels,
                createdAt: new Date(metrics.createdAtMs),
            },
        });
    }

    async getSubscriptionAiSkyboxMetrics(
        filter: SubscriptionFilter
    ): Promise<AISkyboxSubscriptionMetrics> {
        const metrics = await this.getSubscriptionRecordMetrics(filter);

        const where: Prisma.AiSkyboxMetricsWhereInput = {
            createdAt: {
                lt: new Date(metrics.currentPeriodEndMs),
                gte: new Date(metrics.currentPeriodStartMs),
            },
        };

        if (filter.ownerId) {
            where.userId = filter.ownerId;
        } else if (filter.studioId) {
            where.studioId = filter.studioId;
        } else {
            throw new Error('Invalid filter');
        }

        const chatMetrics = await this._client.aiSkyboxMetrics.aggregate({
            where,
            _sum: {
                skyboxesGenerated: true,
            },
        });

        return {
            ...metrics,
            totalSkyboxesInCurrentPeriod: chatMetrics._sum.skyboxesGenerated,
        };
    }

    async recordSkyboxMetrics(metrics: AISkyboxMetrics): Promise<void> {
        await this._client.aiSkyboxMetrics.create({
            data: {
                id: uuid(),
                userId: metrics.userId,
                studioId: metrics.studioId,
                skyboxesGenerated: metrics.skyboxes,
                createdAt: new Date(metrics.createdAtMs),
            },
        });
    }

    async recordChatMetrics(metrics: AIChatMetrics): Promise<void> {
        await this._client.aiChatMetrics.create({
            data: {
                id: uuid(),
                userId: metrics.userId,
                studioId: metrics.studioId,
                tokens: metrics.tokens,
                createdAt: new Date(metrics.createdAtMs),
            },
        });
    }

    async getSubscriptionAiChatMetrics(
        filter: SubscriptionFilter
    ): Promise<AIChatSubscriptionMetrics> {
        const metrics = await this.getSubscriptionRecordMetrics(filter);

        const where: Prisma.AiChatMetricsWhereInput = {
            createdAt: {
                lt: new Date(metrics.currentPeriodEndMs),
                gte: new Date(metrics.currentPeriodStartMs),
            },
        };

        if (filter.ownerId) {
            where.userId = filter.ownerId;
        } else if (filter.studioId) {
            where.studioId = filter.studioId;
        } else {
            throw new Error('Invalid filter');
        }

        const chatMetrics = await this._client.aiChatMetrics.aggregate({
            where,
            _sum: {
                tokens: true,
            },
        });

        return {
            ...metrics,
            totalTokensInCurrentPeriod: chatMetrics._sum.tokens,
        };
    }

    async getSubscriptionDataMetricsByRecordName(
        recordName: string
    ): Promise<DataSubscriptionMetrics> {
        const result = await this._findSubscriptionInfoByRecordName(recordName);

        let filter: Prisma.DataRecordWhereInput = {};

        if (result.owner) {
            filter.record = {
                ownerId: result.owner.id,
            };
        } else {
            filter.record = {
                studioId: result.studio.id,
            };
        }
        const totalItems = await this._client.dataRecord.count({
            where: filter,
        });

        return {
            recordName,
            ownerId: result.owner?.id,
            studioId: result.studio?.id,
            subscriptionId:
                result.owner?.subscriptionId || result.studio?.subscriptionId,
            subscriptionStatus:
                result.owner?.subscriptionStatus ||
                result.studio?.subscriptionStatus,
            totalItems: totalItems,
            currentPeriodEndMs: convertToMillis(
                result.owner?.subscriptionPeriodEnd ||
                    result.studio?.subscriptionPeriodEnd
            ),
            currentPeriodStartMs: convertToMillis(
                result.owner?.subscriptionPeriodStart ||
                    result.studio?.subscriptionPeriodStart
            ),
        };
    }

    async getSubscriptionFileMetricsByRecordName(
        recordName: string
    ): Promise<FileSubscriptionMetrics> {
        const result = await this._findSubscriptionInfoByRecordName(recordName);

        let filter: Prisma.FileRecordWhereInput = {};

        if (result.owner) {
            filter.record = {
                ownerId: result.owner.id,
            };
        } else {
            filter.record = {
                studioId: result.studio.id,
            };
        }
        const stats = await this._client.fileRecord.aggregate({
            where: filter,
            _count: {
                _all: true,
            },
            _sum: {
                sizeInBytes: true,
            },
        });

        return {
            recordName,
            ownerId: result.owner?.id,
            studioId: result.studio?.id,
            subscriptionId:
                result.owner?.subscriptionId || result.studio?.subscriptionId,
            subscriptionStatus:
                result.owner?.subscriptionStatus ||
                result.studio?.subscriptionStatus,
            totalFiles: stats._count._all,
            totalFileBytesReserved: Number(stats._sum.sizeInBytes),
            currentPeriodEndMs: convertToMillis(
                result.owner?.subscriptionPeriodEnd ||
                    result.studio?.subscriptionPeriodEnd
            ),
            currentPeriodStartMs: convertToMillis(
                result.owner?.subscriptionPeriodStart ||
                    result.studio?.subscriptionPeriodStart
            ),
        };
    }

    async getSubscriptionEventMetricsByRecordName(
        recordName: string
    ): Promise<EventSubscriptionMetrics> {
        const result = await this._findSubscriptionInfoByRecordName(recordName);

        let filter: Prisma.EventRecordWhereInput = {};
        if (result.owner) {
            filter.record = {
                ownerId: result.owner.id,
            };
        } else {
            filter.record = {
                studioId: result.studio.id,
            };
        }

        const stats = await this._client.eventRecord.aggregate({
            where: filter,
            _count: {
                _all: true,
            },
        });

        return {
            recordName,
            ownerId: result.owner?.id,
            studioId: result.studio?.id,
            subscriptionId:
                result.owner?.subscriptionId || result.studio?.subscriptionId,
            subscriptionStatus:
                result.owner?.subscriptionStatus ||
                result.studio?.subscriptionStatus,
            totalEventNames: stats._count._all,
            currentPeriodEndMs: convertToMillis(
                result.owner?.subscriptionPeriodEnd ||
                    result.studio?.subscriptionPeriodEnd
            ),
            currentPeriodStartMs: convertToMillis(
                result.owner?.subscriptionPeriodStart ||
                    result.studio?.subscriptionPeriodStart
            ),
        };
    }

    async getSubscriptionRecordMetrics(
        filter: SubscriptionFilter
    ): Promise<RecordSubscriptionMetrics> {
        if (filter.ownerId) {
            const user = await this._client.user.findUnique({
                where: {
                    id: filter.ownerId,
                },
                select: {
                    _count: {
                        select: {
                            records: true,
                        },
                    },
                    id: true,
                    subscriptionId: true,
                    subscriptionStatus: true,
                    subscriptionPeriodEnd: true,
                    subscriptionPeriodStart: true,
                },
            });

            return {
                ownerId: user.id,
                studioId: null,
                subscriptionId: user.subscriptionId,
                subscriptionStatus: user.subscriptionStatus,
                totalRecords: user._count.records,
                currentPeriodStartMs: convertToMillis(
                    user.subscriptionPeriodStart
                ),
                currentPeriodEndMs: convertToMillis(user.subscriptionPeriodEnd),
            };
        } else {
            const studio = await this._client.studio.findUnique({
                where: {
                    id: filter.studioId,
                },
                select: {
                    _count: {
                        select: {
                            records: true,
                        },
                    },
                    id: true,
                    subscriptionId: true,
                    subscriptionStatus: true,
                    subscriptionPeriodEnd: true,
                    subscriptionPeriodStart: true,
                },
            });

            return {
                ownerId: studio.id,
                studioId: null,
                subscriptionId: studio.subscriptionId,
                subscriptionStatus: studio.subscriptionStatus,
                totalRecords: studio._count.records,
                currentPeriodStartMs: convertToMillis(
                    studio.subscriptionPeriodStart
                ),
                currentPeriodEndMs: convertToMillis(
                    studio.subscriptionPeriodEnd
                ),
            };
        }
    }

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
