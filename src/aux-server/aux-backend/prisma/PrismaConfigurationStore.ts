import {
    ConfigurationStore,
    MemoryConfiguration,
    PRIVO_CONFIG_KEY,
    SUBSCRIPTIONS_CONFIG_KEY,
    SubscriptionConfiguration,
    parseSubscriptionConfig,
} from '@casual-simulation/aux-records';
import {
    PrivoConfiguration,
    parsePrivoConfiguration,
} from '@casual-simulation/aux-records/PrivoConfiguration';
import { PrismaClient } from '@prisma/client';

export class PrismaConfigurationStore implements ConfigurationStore {
    private _client: PrismaClient;
    private _defaultConfiguration: MemoryConfiguration;

    constructor(client: PrismaClient, defaultConfig: MemoryConfiguration) {
        this._client = client;
        this._defaultConfiguration = defaultConfig;
    }

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
}
