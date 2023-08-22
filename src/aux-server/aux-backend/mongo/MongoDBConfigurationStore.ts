import {
    ConfigurationStore,
    MemoryConfiguration,
    SUBSCRIPTIONS_CONFIG_KEY,
    parseSubscriptionConfig,
} from '@casual-simulation/aux-records';
import { SubscriptionConfiguration } from '@casual-simulation/aux-records/SubscriptionConfiguration';
import { Collection } from 'mongodb';

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
}

export interface MongoDBConfigItem {
    _id: string;
    data: any;
}
