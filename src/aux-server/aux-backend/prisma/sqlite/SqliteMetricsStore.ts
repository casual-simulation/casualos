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
    AIChatMetrics,
    AIChatSubscriptionMetrics,
    AIImageMetrics,
    AIImageSubscriptionMetrics,
    AIOpenAIRealtimeMetrics,
    AIOpenAIRealtimeSubscriptionMetrics,
    AISkyboxMetrics,
    AISkyboxSubscriptionMetrics,
    AISloydMetrics,
    AISloydSubscriptionMetrics,
    ConfigurationStore,
    DataSubscriptionMetrics,
    EventSubscriptionMetrics,
    FileSubscriptionMetrics,
    InstSubscriptionMetrics,
    MetricsStore,
    RecordSubscriptionMetrics,
    SubscriptionFilter,
    StripeAccountStatus,
} from '@casual-simulation/aux-records';
import { isActiveSubscription } from '@casual-simulation/aux-records';
import type { PrismaClient, Prisma } from '../generated-sqlite';
import { v4 as uuid } from 'uuid';
import { DateTime } from 'luxon';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';

const TRACE_NAME = 'SqliteMetricsStore';

export class SqliteMetricsStore implements MetricsStore {
    private _client: PrismaClient;
    private _config: ConfigurationStore;

    constructor(client: PrismaClient, configStore: ConfigurationStore) {
        this._client = client;
        this._config = configStore;
    }

    @traced(TRACE_NAME)
    async getSubscriptionAiOpenAIRealtimeMetrics(
        filter: SubscriptionFilter
    ): Promise<AIOpenAIRealtimeSubscriptionMetrics> {
        const metrics = await this.getSubscriptionRecordMetrics(filter);

        const where: Prisma.AiOpenAIRealtimeMetricsWhereInput = {
            createdAt: {
                lt: metrics.currentPeriodEndMs,
                gte: metrics.currentPeriodStartMs,
            },
        };

        if (filter.ownerId) {
            where.userId = filter.ownerId;
        } else if (filter.studioId) {
            where.studioId = filter.studioId;
        } else {
            throw new Error('Invalid filter');
        }

        const realtimeMetrics =
            await this._client.aiOpenAIRealtimeMetrics.aggregate({
                where,
                _count: true,
            });

        return {
            ...metrics,
            totalSessionsInCurrentPeriod: realtimeMetrics._count,
        };
    }

    @traced(TRACE_NAME)
    async recordOpenAIRealtimeMetrics(
        metrics: AIOpenAIRealtimeMetrics
    ): Promise<void> {
        await this._client.aiOpenAIRealtimeMetrics.create({
            data: {
                sessionId: metrics.sessionId,
                userId: metrics.userId,
                studioId: metrics.studioId,
                createdAt: metrics.createdAtMs,
                request: metrics.request as object,
            },
        });
    }

    @traced(TRACE_NAME)
    async getSubscriptionAiSloydMetrics(
        filter: SubscriptionFilter
    ): Promise<AISloydSubscriptionMetrics> {
        const metrics = await this.getSubscriptionRecordMetrics(filter);

        const where: Prisma.AiSloydMetricsWhereInput = {
            createdAt: {
                lt: metrics.currentPeriodEndMs,
                gte: metrics.currentPeriodStartMs,
            },
        };

        if (filter.ownerId) {
            where.userId = filter.ownerId;
        } else if (filter.studioId) {
            where.studioId = filter.studioId;
        } else {
            throw new Error('Invalid filter');
        }

        const sloydMetrics = await this._client.aiSloydMetrics.aggregate({
            where,
            _sum: {
                modelsCreated: true,
            },
        });

        return {
            ...metrics,
            totalModelsInCurrentPeriod: sloydMetrics._sum.modelsCreated,
        };
    }

    @traced(TRACE_NAME)
    async recordSloydMetrics(metrics: AISloydMetrics): Promise<void> {
        await this._client.aiSloydMetrics.create({
            data: {
                id: uuid(),
                userId: metrics.userId,
                studioId: metrics.studioId,
                modelsCreated: metrics.modelsCreated,
                confidence: metrics.confidence,
                mimeType: metrics.mimeType,
                modelData: metrics.modelData,
                name: metrics.name,
                baseModelId: metrics.baseModelId,
                thumbnailBase64: metrics.thumbnailBase64,
                createdAt: metrics.createdAtMs,
            },
        });
    }

    @traced(TRACE_NAME)
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

        const [instCount, instSize] = await Promise.all([
            this._client.instRecord.aggregate({
                where,
                _count: {
                    _all: true,
                },
            }),
            this._client.branchUpdate.aggregate({
                where: where as Prisma.BranchUpdateWhereInput,
                _sum: {
                    sizeInBytes: true,
                },
            }),
        ]);

        return {
            ...metrics,
            totalInsts: instCount._count._all,
            totalInstBytes: instSize._sum.sizeInBytes || 0,
        };
    }

    @traced(TRACE_NAME)
    async getAllFileSubscriptionMetrics(): Promise<FileSubscriptionMetrics[]> {
        const allMetrics = await this._client.$queryRaw<
            FileSubscriptionMetrics[]
        >`
            SELECT 
                'user' as "subscriptionType",
                u.id as "userId",
                NULL as "studioId",
                u."subscriptionId" as "subscriptionId",
                u."subscriptionStatus" as "subscriptionStatus",
                u."subscriptionPeriodStart" as "subscriptionPeriodStart",
                u."subscriptionPeriodEnd" as "subscriptionPeriodEnd",
                u."stripeAccountId" as "stripeAccountId",
                u."stripeAccountStatus" as "stripeAccountStatus",
                SUM(fr."sizeInBytes") as "totalFileBytesReserved",
                COUNT(fr."id") as "totalFiles"
            FROM "User" u
            INNER JOIN "Record" r ON r."ownerId" = u.id
            INNER JOIN "FileRecord" fr ON fr."recordName" = r.name
            GROUP BY u.id
        UNION ALL
            SELECT 
                'studio' as "subscriptionType",
                NULL as "userId",
                s.id as "studioId",
                s."subscriptionId" as "subscriptionId",
                s."subscriptionStatus" as "subscriptionStatus",
                s."subscriptionPeriodStart" as "subscriptionPeriodStart",
                s."subscriptionPeriodEnd" as "subscriptionPeriodEnd",
                s."stripeAccountId" as "stripeAccountId",
                s."stripeAccountStatus" as "stripeAccountStatus",
                SUM(fr."sizeInBytes") as "totalFileBytesReserved",
                COUNT(fr."id") as "totalFiles"
            FROM "Studio" s
            INNER JOIN "Record" r ON r."studioId" = s.id
            INNER JOIN "FileRecord" fr ON fr."recordName" = r.name
            GROUP BY s.id;`;

        return allMetrics;
    }

    @traced(TRACE_NAME)
    async getAllSubscriptionInstMetrics(): Promise<InstSubscriptionMetrics[]> {
        const allMetrics = await this._client.$queryRaw<
            InstSubscriptionMetrics[]
        >`
            SELECT 
                'user' as "subscriptionType",
                u.id as "userId",
                NULL as "studioId",
                u."subscriptionId" as "subscriptionId",
                u."subscriptionStatus" as "subscriptionStatus",
                u."subscriptionPeriodStart" as "subscriptionPeriodStart",
                u."subscriptionPeriodEnd" as "subscriptionPeriodEnd",
                u."stripeAccountId" as "stripeAccountId",
                u."stripeAccountStatus" as "stripeAccountStatus",
                SUM(i."sizeInBytes") as "totalInstBytes",
                COUNT(i."id") as "totalInsts"
            FROM "User" u
            INNER JOIN "Record" r ON r."ownerId" = u.id
            INNER JOIN "InstRecord" i ON i."recordName" = r.name
            GROUP BY u.id
        UNION ALL
            SELECT 
                'studio' as "subscriptionType",
                NULL as "userId",
                s.id as "studioId",
                s."subscriptionId" as "subscriptionId",
                s."subscriptionStatus" as "subscriptionStatus",
                s."subscriptionPeriodStart" as "subscriptionPeriodStart",
                s."subscriptionPeriodEnd" as "subscriptionPeriodEnd",
                s."stripeAccountId" as "stripeAccountId",
                s."stripeAccountStatus" as "stripeAccountStatus",
                SUM(bu."sizeInBytes") as "totalInstBytes",
                COUNT(i."id") as "totalInsts"
            FROM "Studio" s
            INNER JOIN "Record" r ON r."studioId" = s.id
            INNER JOIN "InstRecord" i ON i."recordName" = r.name
            INNER JOIN "BranchUpdate" bu ON bu."recordName" = r.name
            GROUP BY s.id;`;

        return allMetrics;
    }

    @traced(TRACE_NAME)
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

        const [totalInsts, instSize] = await Promise.all([
            this._client.instRecord.count({
                where,
            }),
            this._client.branchUpdate.aggregate({
                where: where as Prisma.BranchUpdateWhereInput,
                _sum: {
                    sizeInBytes: true,
                },
            }),
        ]);

        return {
            recordName,
            ownerId: result.owner?.id,
            studioId: result.studio?.id,
            subscriptionId:
                result.owner?.subscriptionId || result.studio?.subscriptionId,
            subscriptionStatus:
                result.owner?.subscriptionStatus ||
                result.studio?.subscriptionStatus,

            stripeAccountId:
                result.owner?.stripeAccountId || result.studio?.stripeAccountId,
            stripeAccountStatus: (result.owner?.stripeAccountStatus ||
                result.studio?.stripeAccountStatus) as StripeAccountStatus,

            subscriptionType: result.owner ? 'user' : 'studio',
            totalInsts: totalInsts,
            totalInstBytes: instSize._sum.sizeInBytes || 0,
            ...(await this._getSubscriptionPeriod(
                result.owner?.subscriptionStatus ||
                    result.studio?.subscriptionStatus,

                result.owner?.subscriptionPeriodStart?.toNumber() ||
                    result.studio?.subscriptionPeriodStart?.toNumber(),
                result.owner?.subscriptionPeriodEnd?.toNumber() ||
                    result.studio?.subscriptionPeriodEnd?.toNumber()
            )),
        };
    }

    @traced(TRACE_NAME)
    async getSubscriptionAiImageMetrics(
        filter: SubscriptionFilter
    ): Promise<AIImageSubscriptionMetrics> {
        const metrics = await this.getSubscriptionRecordMetrics(filter);

        const where: Prisma.AiImageMetricsWhereInput = {
            createdAt: {
                lt: metrics.currentPeriodEndMs,
                gte: metrics.currentPeriodStartMs,
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

    @traced(TRACE_NAME)
    async recordImageMetrics(metrics: AIImageMetrics): Promise<void> {
        await this._client.aiImageMetrics.create({
            data: {
                id: uuid(),
                userId: metrics.userId,
                studioId: metrics.studioId,
                squarePixelsGenerated: metrics.squarePixels,
                createdAt: metrics.createdAtMs,
            },
        });
    }

    @traced(TRACE_NAME)
    async getSubscriptionAiSkyboxMetrics(
        filter: SubscriptionFilter
    ): Promise<AISkyboxSubscriptionMetrics> {
        const metrics = await this.getSubscriptionRecordMetrics(filter);

        const where: Prisma.AiSkyboxMetricsWhereInput = {
            createdAt: {
                lt: metrics.currentPeriodEndMs,
                gte: metrics.currentPeriodStartMs,
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

    @traced(TRACE_NAME)
    async recordSkyboxMetrics(metrics: AISkyboxMetrics): Promise<void> {
        await this._client.aiSkyboxMetrics.create({
            data: {
                id: uuid(),
                userId: metrics.userId,
                studioId: metrics.studioId,
                skyboxesGenerated: metrics.skyboxes,
                createdAt: metrics.createdAtMs,
            },
        });
    }

    @traced(TRACE_NAME)
    async recordChatMetrics(metrics: AIChatMetrics): Promise<void> {
        await this._client.aiChatMetrics.create({
            data: {
                id: uuid(),
                userId: metrics.userId,
                studioId: metrics.studioId,
                tokens: metrics.tokens,
                createdAt: metrics.createdAtMs,
            },
        });
    }

    @traced(TRACE_NAME)
    async getSubscriptionAiChatMetrics(
        filter: SubscriptionFilter
    ): Promise<AIChatSubscriptionMetrics> {
        const metrics = await this.getSubscriptionRecordMetrics(filter);

        const where: Prisma.AiChatMetricsWhereInput = {
            createdAt: {
                lt: metrics.currentPeriodEndMs,
                gte: metrics.currentPeriodStartMs,
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

    @traced(TRACE_NAME)
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
            stripeAccountId:
                result.owner?.stripeAccountId || result.studio?.stripeAccountId,
            stripeAccountStatus: (result.owner?.stripeAccountStatus ||
                result.studio?.stripeAccountStatus) as StripeAccountStatus,
            subscriptionType: result.owner ? 'user' : 'studio',
            totalItems: totalItems,
            ...(await this._getSubscriptionPeriod(
                result.owner?.subscriptionStatus ||
                    result.studio?.subscriptionStatus,

                result.owner?.subscriptionPeriodStart?.toNumber() ||
                    result.studio?.subscriptionPeriodStart?.toNumber(),
                result.owner?.subscriptionPeriodEnd?.toNumber() ||
                    result.studio?.subscriptionPeriodEnd?.toNumber()
            )),
        };
    }

    @traced(TRACE_NAME)
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
            stripeAccountId:
                result.owner?.stripeAccountId || result.studio?.stripeAccountId,
            stripeAccountStatus: (result.owner?.stripeAccountStatus ||
                result.studio?.stripeAccountStatus) as StripeAccountStatus,
            subscriptionType: result.owner ? 'user' : 'studio',
            totalFiles: stats._count._all,
            totalFileBytesReserved: Number(stats._sum.sizeInBytes),
            ...(await this._getSubscriptionPeriod(
                result.owner?.subscriptionStatus ||
                    result.studio?.subscriptionStatus,

                result.owner?.subscriptionPeriodStart?.toNumber() ||
                    result.studio?.subscriptionPeriodStart?.toNumber(),
                result.owner?.subscriptionPeriodEnd?.toNumber() ||
                    result.studio?.subscriptionPeriodEnd?.toNumber()
            )),
        };
    }

    @traced(TRACE_NAME)
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
            stripeAccountId:
                result.owner?.stripeAccountId || result.studio?.stripeAccountId,
            stripeAccountStatus: (result.owner?.stripeAccountStatus ||
                result.studio?.stripeAccountStatus) as StripeAccountStatus,
            subscriptionType: result.owner ? 'user' : 'studio',
            totalEventNames: stats._count._all,
            ...(await this._getSubscriptionPeriod(
                result.owner?.subscriptionStatus ||
                    result.studio?.subscriptionStatus,

                result.owner?.subscriptionPeriodStart?.toNumber() ||
                    result.studio?.subscriptionPeriodStart?.toNumber(),
                result.owner?.subscriptionPeriodEnd?.toNumber() ||
                    result.studio?.subscriptionPeriodEnd?.toNumber()
            )),
        };
    }

    @traced(TRACE_NAME)
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
                    stripeAccountId: true,
                    stripeAccountStatus: true,
                },
            });

            return {
                ownerId: user.id,
                studioId: null,
                subscriptionId: user.subscriptionId,
                subscriptionStatus: user.subscriptionStatus,
                stripeAccountId: user.stripeAccountId,
                stripeAccountStatus:
                    user.stripeAccountStatus as StripeAccountStatus,
                subscriptionType: 'user',
                totalRecords: user._count.records,
                ...(await this._getSubscriptionPeriod(
                    user.subscriptionStatus,
                    user.subscriptionPeriodStart?.toNumber(),
                    user.subscriptionPeriodEnd?.toNumber()
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
                    stripeAccountId: true,
                    stripeAccountStatus: true,
                },
            });

            return {
                ownerId: null,
                studioId: studio.id,
                subscriptionId: studio.subscriptionId,
                subscriptionStatus: studio.subscriptionStatus,
                stripeAccountId: studio.stripeAccountId,
                stripeAccountStatus:
                    studio.stripeAccountStatus as StripeAccountStatus,
                subscriptionType: 'studio',
                totalRecords: studio._count.records,
                ...(await this._getSubscriptionPeriod(
                    studio.subscriptionStatus,
                    studio.subscriptionPeriodStart?.toNumber(),
                    studio.subscriptionPeriodEnd?.toNumber()
                )),
            };
        }
    }

    @traced(TRACE_NAME)
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

    @traced(TRACE_NAME)
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
                        stripeAccountId: true,
                        stripeAccountStatus: true,
                    },
                },
                studio: {
                    select: {
                        id: true,
                        subscriptionId: true,
                        subscriptionStatus: true,
                        subscriptionPeriodStart: true,
                        subscriptionPeriodEnd: true,
                        stripeAccountId: true,
                        stripeAccountStatus: true,
                    },
                },
            },
        });
    }
}
