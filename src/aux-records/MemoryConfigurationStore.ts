import { SubscriptionConfiguration } from './SubscriptionConfiguration';
import { ConfigurationStore } from './ConfigurationStore';

export class MemoryConfigurationStore implements ConfigurationStore {
    private _subscriptionConfiguration: SubscriptionConfiguration | null;

    constructor(config: MemoryConfiguration | null) {
        this._subscriptionConfiguration = config.subscriptions;
    }

    get subscriptionConfiguration() {
        return this._subscriptionConfiguration;
    }

    set subscriptionConfiguration(value: SubscriptionConfiguration | null) {
        this._subscriptionConfiguration = value;
    }

    async getSubscriptionConfiguration(): Promise<SubscriptionConfiguration | null> {
        return this._subscriptionConfiguration;
    }
}

export interface MemoryConfiguration {
    subscriptions: SubscriptionConfiguration;
}
