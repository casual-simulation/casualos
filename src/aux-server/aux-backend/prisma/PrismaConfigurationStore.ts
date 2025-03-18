import type {
    ConfigurationStore,
    MemoryConfiguration,
    SubscriptionConfiguration,
} from '@casual-simulation/aux-records';
import {
    MODERATION_CONFIG_KEY,
    PRIVO_CONFIG_KEY,
    SUBSCRIPTIONS_CONFIG_KEY,
    parseSubscriptionConfig,
} from '@casual-simulation/aux-records';
import type { PrivoConfiguration } from '@casual-simulation/aux-records/PrivoConfiguration';
import { parsePrivoConfiguration } from '@casual-simulation/aux-records/PrivoConfiguration';
import type { PrismaClient } from './generated';
import { parseModerationConfiguration } from '@casual-simulation/aux-records/ModerationConfiguration';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';

const TRACE_NAME = 'PrismaConfigurationStore';

export class PrismaConfigurationStore implements ConfigurationStore {
    private _client: PrismaClient;
    private _defaultConfiguration: MemoryConfiguration;

    constructor(client: PrismaClient, defaultConfig: MemoryConfiguration) {
        this._client = client;
        this._defaultConfiguration = defaultConfig;
    }

    @traced(TRACE_NAME)
    async getSubscriptionConfiguration(): Promise<SubscriptionConfiguration> {
        const result = await this._client.configuration.findUnique({
            where: {
                key: SUBSCRIPTIONS_CONFIG_KEY,
            },
        });

        return parseSubscriptionConfig(
            result?.data,
            this._defaultConfiguration.subscriptions
        );
    }

    @traced(TRACE_NAME)
    async getPrivoConfiguration(): Promise<PrivoConfiguration> {
        const result = await this._client.configuration.findUnique({
            where: {
                key: PRIVO_CONFIG_KEY,
            },
        });

        return parsePrivoConfiguration(
            result?.data,
            this._defaultConfiguration.privo
        );
    }

    @traced(TRACE_NAME)
    async getModerationConfig(): Promise<{
        allowUnauthenticatedReports?: boolean;
    }> {
        const result = await this._client.configuration.findUnique({
            where: {
                key: MODERATION_CONFIG_KEY,
            },
        });

        return parseModerationConfiguration(
            result?.data,
            this._defaultConfiguration.moderation
        );
    }
}
