import { SubscriptionConfiguration } from './SubscriptionConfiguration';
import { PrivoConfiguration } from './PrivoConfiguration';

export const SUBSCRIPTIONS_CONFIG_KEY = 'subscriptions';

/**
 * Defines an interface that is used for storing configuration data.
 */
export interface ConfigurationStore {
    /**
     * Retrieves the subscription configuration from the store.
     */
    getSubscriptionConfiguration(): Promise<SubscriptionConfiguration | null>;

    /**
     * Retrieves the privo configuration from the store.
     */
    getPrivoConfiguration(): Promise<PrivoConfiguration | null>;
}
