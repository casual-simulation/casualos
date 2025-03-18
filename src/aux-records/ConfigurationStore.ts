import type { SubscriptionConfiguration } from './SubscriptionConfiguration';
import type { PrivoConfiguration } from './PrivoConfiguration';
import type { ModerationConfiguration } from './ModerationConfiguration';

export const SUBSCRIPTIONS_CONFIG_KEY = 'subscriptions';

export const PRIVO_CONFIG_KEY = 'privo';

export const MODERATION_CONFIG_KEY = 'moderation';

export const ConfigurationStore = Symbol.for('ConfigurationStore');

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

    /**
     * Retrieves the moderation configuration from the store.
     * Resolves with null if no configuration is found.
     */
    getModerationConfig(): Promise<ModerationConfiguration | null>;
}
