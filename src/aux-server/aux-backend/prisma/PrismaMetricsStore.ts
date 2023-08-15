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
        const result = await this._client.record.findUnique({
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

    getSubscriptionFileMetricsByRecordName(
        recordName: string
    ): Promise<FileSubscriptionMetrics> {
        throw new Error('Method not implemented.');
    }

    getSubscriptionEventMetricsByRecordName(
        recordName: string
    ): Promise<EventSubscriptionMetrics> {
        throw new Error('Method not implemented.');
    }

    getSubscriptionRecordMetrics(
        filter: SubscriptionFilter
    ): Promise<RecordSubscriptionMetrics> {
        throw new Error('Method not implemented.');
    }
}
