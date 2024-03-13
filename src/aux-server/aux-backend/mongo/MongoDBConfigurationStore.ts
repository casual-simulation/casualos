import {
    ConfigurationStore,
    MODERATION_CONFIG_KEY,
    MemoryConfiguration,
    PRIVO_CONFIG_KEY,
    SUBSCRIPTIONS_CONFIG_KEY,
    parseSubscriptionConfig,
} from '@casual-simulation/aux-records';
import { SubscriptionConfiguration } from '@casual-simulation/aux-records/SubscriptionConfiguration';
import {
    PrivoConfiguration,
    parsePrivoConfiguration,
} from '@casual-simulation/aux-records/PrivoConfiguration';
import { Collection } from 'mongodb';
import {
    ModerationConfiguration,
    parseModerationConfiguration,
} from '@casual-simulation/aux-records/ModerationConfiguration';

export class MongoDBConfigurationStore implements ConfigurationStore {
    private _defaultConfiguration: MemoryConfiguration;
    private _collection: Collection<MongoDBConfigItem>;

    constructor(
        defaultConfig: MemoryConfiguration,
        collection: Collection<MongoDBConfigItem>
    ) {
        this._defaultConfiguration = defaultConfig;
        this._collection = collection;
    }

    async getSubscriptionConfiguration(): Promise<SubscriptionConfiguration> {
        const item = await this._collection.findOne({
            _id: SUBSCRIPTIONS_CONFIG_KEY,
        });

        return parseSubscriptionConfig(
            item?.data,
            this._defaultConfiguration.subscriptions
        );
    }

    async getPrivoConfiguration(): Promise<PrivoConfiguration> {
        const item = await this._collection.findOne({
            _id: PRIVO_CONFIG_KEY,
        });

        return parsePrivoConfiguration(
            item?.data,
            this._defaultConfiguration.privo
        );
    }

    async getModerationConfig(): Promise<ModerationConfiguration> {
        const item = await this._collection.findOne({
            _id: MODERATION_CONFIG_KEY,
        });

        return parseModerationConfiguration(
            item?.data,
            this._defaultConfiguration.moderation
        );
    }
}

export interface MongoDBConfigItem {
    _id: string;
    data: any;
}
