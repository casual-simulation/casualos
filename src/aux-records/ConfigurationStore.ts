/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import {
    subscriptionConfigSchema,
    type SubscriptionConfiguration,
} from './SubscriptionConfiguration';
import { privoSchema, type PrivoConfiguration } from './PrivoConfiguration';
import {
    moderationSchema,
    type ModerationConfiguration,
} from './ModerationConfiguration';
import {
    WEB_CONFIG_SCHEMA,
    type WebConfig,
} from '@casual-simulation/aux-common';
import {
    WEB_MANIFEST_SCHEMA,
    type WebManifest,
} from '@casual-simulation/aux-common/common/WebManifest';
import type z from 'zod';

export const SUBSCRIPTIONS_CONFIG_KEY = 'subscriptions';

export const PRIVO_CONFIG_KEY = 'privo';

export const MODERATION_CONFIG_KEY = 'moderation';

export const WEB_CONFIG_KEY = 'web';

export const PLAYER_WEB_MANIFEST_KEY = 'playerWebManifest';

/**
 * The default configuration values used when no configuration is found in the store.
 */
export interface DefaultConfiguration {
    /**
     * The default subscriptions configuration.
     */
    subscriptions: SubscriptionConfiguration;

    /**
     * The default privo configuration.
     */
    privo: PrivoConfiguration;

    /**
     * The default moderation configuration.
     */
    moderation: ModerationConfiguration;

    /**
     * The default web configuration.
     */
    webConfig: WebConfig;

    /**
     * The default player web manifest.
     */
    playerWebManifest: WebManifest | null;
}

export const CONFIGURATION_SCHEMAS = [
    {
        key: SUBSCRIPTIONS_CONFIG_KEY,
        schema: subscriptionConfigSchema,
    } as const,
    { key: PRIVO_CONFIG_KEY, schema: privoSchema } as const,
    { key: MODERATION_CONFIG_KEY, schema: moderationSchema } as const,
    { key: WEB_CONFIG_KEY, schema: WEB_CONFIG_SCHEMA } as const,
    { key: PLAYER_WEB_MANIFEST_KEY, schema: WEB_MANIFEST_SCHEMA } as const,
];

/**
 * The schemas for the different configuration values.
 */
export const CONFIGURATION_SCHEMAS_MAP = {
    [SUBSCRIPTIONS_CONFIG_KEY]: subscriptionConfigSchema,
    [PRIVO_CONFIG_KEY]: privoSchema,
    [MODERATION_CONFIG_KEY]: moderationSchema,
    [WEB_CONFIG_KEY]: WEB_CONFIG_SCHEMA,
    [PLAYER_WEB_MANIFEST_KEY]: WEB_MANIFEST_SCHEMA,
};

export const CONFIGURATION_KEYS: ConfigurationKey[] = CONFIGURATION_SCHEMAS.map(
    (c) => c.key
);

export type ConfigurationKey = (typeof CONFIGURATION_SCHEMAS)[number]['key'];
export type ConfigurationSchemaType<TKey extends ConfigurationKey> = Extract<
    (typeof CONFIGURATION_SCHEMAS)[number],
    { key: TKey }
>['schema'];
export type ConfigurationInput<TKey extends ConfigurationKey> = z.input<
    ConfigurationSchemaType<TKey>
>;
export type ConfigurationOutput<TKey extends ConfigurationKey> = z.infer<
    ConfigurationSchemaType<TKey>
>;

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

    /**
     * Retrieves the web configuration from the store.
     * Resolves with null if no configuration is found.
     */
    getWebConfig(): Promise<WebConfig | null>;

    /**
     * Retrieves the PWA web manifest that should be served for the player.
     * Resolves with null if no manifest is found.
     */
    getPlayerWebManifest(): Promise<WebManifest | null>;

    /**
     * Updates the stored configuration value for the given key.
     * @param key The key to set.
     * @param value The value to set.
     */
    setConfiguration<TKey extends ConfigurationKey>(
        key: TKey,
        value: ConfigurationInput<TKey>
    ): Promise<void>;

    /**
     * Gets the stored configuration value for the given key.
     * @param key The key to get.
     * @param defaultValue The default value to use if no value is found.
     */
    getConfiguration<TKey extends ConfigurationKey>(
        key: TKey,
        defaultValue?: ConfigurationInput<TKey>
    ): Promise<ConfigurationOutput<TKey> | null>;
}
