import {
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

export class PrismaMetricsStore implements MetricsStore {
    private _client: PrismaClient;

    constructor(client: PrismaClient) {
        this._client = client;
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
            totalItems: stats._count._all,
            totalFileBytesReserved: Number(stats._sum.sizeInBytes),
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
                },
            });

            return {
                ownerId: user.id,
                studioId: null,
                subscriptionId: user.subscriptionId,
                subscriptionStatus: user.subscriptionStatus,
                totalRecords: user._count.records,
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
                },
            });

            return {
                ownerId: studio.id,
                studioId: null,
                subscriptionId: studio.subscriptionId,
                subscriptionStatus: studio.subscriptionStatus,
                totalRecords: studio._count.records,
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
                    },
                },
                studio: {
                    select: {
                        id: true,
                        subscriptionId: true,
                        subscriptionStatus: true,
                    },
                },
            },
        });
    }
}