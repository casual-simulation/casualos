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
    InstSubscriptionMetrics,
    MemoryConfiguration,
    MetricsStore,
    RecordSubscriptionMetrics,
    SUBSCRIPTIONS_CONFIG_KEY,
    SubscriptionConfiguration,
    SubscriptionFilter,
    isActiveSubscription,
    parseSubscriptionConfig,
} from '@casual-simulation/aux-records';
import { PrismaClient, Prisma } from './generated';
import { convertToMillis } from './Utils';
import { v4 as uuid } from 'uuid';
import { DateTime } from 'luxon';

export class PrismaMetricsStore implements MetricsStore {
    private _client: PrismaClient;
    private _config: ConfigurationStore;

    constructor(client: PrismaClient, configStore: ConfigurationStore) {
        this._client = client;
        this._config = configStore;
    }

    async getSubscriptionInstMetrics(
        filter: SubscriptionFilter
    ): Promise<InstSubscriptionMetrics> {
        const metrics = await this.getSubscriptionRecordMetrics(filter);

        const where: Prisma.InstRecordWhereInput = {};

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

        const instMetrics = await this._client.instRecord.aggregate({
            where,
            _count: {
                _all: true,
            },
        });

        return {
            ...metrics,
            totalInsts: instMetrics._count._all,
        };
    }

    async getSubscriptionInstMetricsByRecordName(
        recordName: string
    ): Promise<InstSubscriptionMetrics> {
        const result = await this._findSubscriptionInfoByRecordName(recordName);

        const where: Prisma.InstRecordWhereInput = {};

        if (result.owner) {
            where.record = {
                ownerId: result.owner.id,
            };
        } else if (result.studio) {
            where.record = {
                studioId: result.studio.id,
            };
        } else {
            throw new Error('Invalid filter');
        }

        const totalInsts = await this._client.instRecord.count({
            where,
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
            subscriptionType: result.owner ? 'user' : 'studio',
            totalInsts: totalInsts,
            ...(await this._getSubscriptionPeriod(
                result.owner?.subscriptionStatus ||
                    result.studio?.subscriptionStatus,
                convertToMillis(
                    result.owner?.subscriptionPeriodStart ||
                        result.studio?.subscriptionPeriodStart
                ),
                convertToMillis(
                    result.owner?.subscriptionPeriodEnd ||
                        result.studio?.subscriptionPeriodEnd
                )
            )),
        };
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
            subscriptionType: result.owner ? 'user' : 'studio',
            totalItems: totalItems,
            ...(await this._getSubscriptionPeriod(
                result.owner?.subscriptionStatus ||
                    result.studio?.subscriptionStatus,
                convertToMillis(
                    result.owner?.subscriptionPeriodStart ||
                        result.studio?.subscriptionPeriodStart
                ),
                convertToMillis(
                    result.owner?.subscriptionPeriodEnd ||
                        result.studio?.subscriptionPeriodEnd
                )
            )),
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
            subscriptionType: result.owner ? 'user' : 'studio',
            totalFiles: stats._count._all,
            totalFileBytesReserved: Number(stats._sum.sizeInBytes),
            ...(await this._getSubscriptionPeriod(
                result.owner?.subscriptionStatus ||
                    result.studio?.subscriptionStatus,
                convertToMillis(
                    result.owner?.subscriptionPeriodStart ||
                        result.studio?.subscriptionPeriodStart
                ),
                convertToMillis(
                    result.owner?.subscriptionPeriodEnd ||
                        result.studio?.subscriptionPeriodEnd
                )
            )),
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
            subscriptionType: result.owner ? 'user' : 'studio',
            totalEventNames: stats._count._all,
            ...(await this._getSubscriptionPeriod(
                result.owner?.subscriptionStatus ||
                    result.studio?.subscriptionStatus,
                convertToMillis(
                    result.owner?.subscriptionPeriodStart ||
                        result.studio?.subscriptionPeriodStart
                ),
                convertToMillis(
                    result.owner?.subscriptionPeriodEnd ||
                        result.studio?.subscriptionPeriodEnd
                )
            )),
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
                subscriptionType: 'user',
                totalRecords: user._count.records,
                ...(await this._getSubscriptionPeriod(
                    user.subscriptionStatus,
                    convertToMillis(user.subscriptionPeriodStart),
                    convertToMillis(user.subscriptionPeriodEnd)
                )),
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
                ownerId: null,
                studioId: studio.id,
                subscriptionId: studio.subscriptionId,
                subscriptionStatus: studio.subscriptionStatus,
                subscriptionType: 'studio',
                totalRecords: studio._count.records,
                ...(await this._getSubscriptionPeriod(
                    studio.subscriptionStatus,
                    convertToMillis(studio.subscriptionPeriodStart),
                    convertToMillis(studio.subscriptionPeriodEnd)
                )),
            };
        }
    }

    /**
     * Gets the period for a subscription with the given status, start time, and end time.
     * @param status The status of the subscription.
     * @param startMs The start time of the subscription in unix time in miliseconds.
     * @param endMs The end time of the subscription in unix time in miliseconds.
     */
    getSubscriptionPeriod(status: string, startMs: number, endMs: number) {
        return this._getSubscriptionPeriod(status, startMs, endMs);
    }

    private async _getSubscriptionPeriod(
        status: string,
        startMs: number,
        endMs: number
    ) {
        if (!isActiveSubscription(status) || !startMs || !endMs) {
            return await this._getDefaultSubscriptionPeriod();
        }

        return {
            currentPeriodStartMs: startMs,
            currentPeriodEndMs: endMs,
        };
    }

    private async _getDefaultSubscriptionPeriod() {
        const config = await this._config.getSubscriptionConfiguration();
        let currentPeriodStartMs: number = null;
        let currentPeriodEndMs: number = null;

        if (config?.defaultFeatures?.defaultPeriodLength) {
            const now = DateTime.utc();
            const periodStart = now.minus(
                config.defaultFeatures.defaultPeriodLength
            );

            currentPeriodStartMs = periodStart.toMillis();
            currentPeriodEndMs = now.toMillis();
        }

        return {
            currentPeriodStartMs,
            currentPeriodEndMs,
        };
    }

    findSubscriptionInfoByRecordName(recordName: string) {
        return this._findSubscriptionInfoByRecordName(recordName);
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
