import { z } from 'zod';
import { SubscriptionConfiguration } from './SubscriptionConfiguration';

export const SUBSCRIPTIONS_CONFIG_KEY = 'subscriptions';

/**
 * Defines an interface that is used for storing configuration data.
 */
export interface ConfigurationStore {
    /**
     * Retrieves the subscription configuration from the store.
     */
    getSubscriptionConfiguration(): Promise<SubscriptionConfiguration | null>;
}
