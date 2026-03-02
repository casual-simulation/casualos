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
import type { PrivoConfiguration } from './PrivoConfiguration';
import type { Cache } from './Cache';
import type {
    ConfigurationInput,
    ConfigurationKey,
    ConfigurationOutput,
} from './ConfigurationStore';
import {
    CONFIGURATION_SCHEMAS_MAP,
    MODERATION_CONFIG_KEY,
    PLAYER_WEB_MANIFEST_KEY,
    PRIVO_CONFIG_KEY,
    SUBSCRIPTIONS_CONFIG_KEY,
    WEB_CONFIG_KEY,
    type ConfigurationStore,
} from './ConfigurationStore';
import type { SubscriptionConfiguration } from './SubscriptionConfiguration';
import type { ModerationConfiguration } from './ModerationConfiguration';
import { traced } from './tracing/TracingDecorators';
import type { WebConfig } from '@casual-simulation/aux-common';
import type { WebManifest } from '@casual-simulation/aux-common/common/WebManifest';

const TRACE_NAME = 'CachingConfigStore';

/**
 * Defines a config store that uses a cache.
 */
export class CachingConfigStore implements ConfigurationStore {
    private _store: ConfigurationStore;
    private _cache: Cache;
    private _cacheSeconds: number;

    /**
     * Creates a new CachingConfigStore.
     * @param store The store.
     * @param cache The cache.
     * @param cacheSeconds The number of seconds that cache entries should be stored.
     */
    constructor(store: ConfigurationStore, cache: Cache, cacheSeconds: number) {
        this._store = store;
        this._cache = cache;
        this._cacheSeconds = cacheSeconds;
    }

    @traced(TRACE_NAME)
    async setConfiguration<TKey extends ConfigurationKey>(
        key: TKey,
        value: ConfigurationInput<TKey>
    ): Promise<void> {
        await this._cache.remove(key);
        await this._store.setConfiguration(key, value);
    }

    @traced(TRACE_NAME)
    async getConfiguration<TKey extends ConfigurationKey>(
        key: TKey,
        defaultValue?: ConfigurationInput<TKey>
    ): Promise<ConfigurationOutput<TKey> | null> {
        const cached = await this._cache.retrieve<ConfigurationOutput<TKey>>(
            key
        );

        if (typeof cached !== 'undefined') {
            if (cached) {
                const schema = CONFIGURATION_SCHEMAS_MAP[key];
                const parsed = schema.safeParse(cached);

                if (!parsed.success) {
                    console.warn(
                        `Cached configuration for key "${key}" is invalid:`,
                        parsed.error
                    );
                    await this._cache.remove(key);
                } else {
                    return parsed.data as ConfigurationOutput<TKey>;
                }
            } else {
                // If null is cached, return that instead of hitting the store again.
                return cached;
            }
        }

        const result = await this._store.getConfiguration(key, defaultValue);
        await this._cache.store(key, result, this._cacheSeconds);

        return result;
    }

    @traced(TRACE_NAME)
    private async _getConfiguration<TKey extends ConfigurationKey>(
        key: TKey,
        retrieve: () => Promise<ConfigurationOutput<TKey> | null>
    ): Promise<ConfigurationOutput<TKey> | null> {
        const cached = await this._cache.retrieve<ConfigurationOutput<TKey>>(
            key
        );

        if (typeof cached !== 'undefined') {
            if (cached) {
                const schema = CONFIGURATION_SCHEMAS_MAP[key];
                const parsed = schema.safeParse(cached);

                if (!parsed.success) {
                    console.warn(
                        `Cached configuration for key "${key}" is invalid:`,
                        parsed.error
                    );
                    await this._cache.remove(key);
                } else {
                    return parsed.data as ConfigurationOutput<TKey>;
                }
            } else {
                // If null is cached, return that instead of hitting the store again.
                return cached;
            }
        }

        const result = await retrieve();
        await this._cache.store(key, result, this._cacheSeconds);

        return result;
    }

    @traced(TRACE_NAME)
    async getWebConfig(): Promise<WebConfig | null> {
        return (await this._getConfiguration(
            WEB_CONFIG_KEY,
            async () =>
                (await this._store.getWebConfig()) as ConfigurationOutput<
                    typeof WEB_CONFIG_KEY
                > | null
        )) as WebConfig | null;
    }

    @traced(TRACE_NAME)
    async getPlayerWebManifest(): Promise<WebManifest | null> {
        return (await this._getConfiguration(
            PLAYER_WEB_MANIFEST_KEY,
            async () =>
                (await this._store.getPlayerWebManifest()) as ConfigurationOutput<
                    typeof PLAYER_WEB_MANIFEST_KEY
                > | null
        )) as WebManifest | null;
    }

    @traced(TRACE_NAME)
    async getSubscriptionConfiguration(): Promise<SubscriptionConfiguration | null> {
        return (await this._getConfiguration(
            SUBSCRIPTIONS_CONFIG_KEY,
            async () =>
                (await this._store.getSubscriptionConfiguration()) as ConfigurationOutput<
                    typeof SUBSCRIPTIONS_CONFIG_KEY
                > | null
        )) as SubscriptionConfiguration | null;
    }

    @traced(TRACE_NAME)
    async getPrivoConfiguration(): Promise<PrivoConfiguration> {
        return (await this._getConfiguration(
            PRIVO_CONFIG_KEY,
            async () =>
                (await this._store.getPrivoConfiguration()) as ConfigurationOutput<
                    typeof PRIVO_CONFIG_KEY
                > | null
        )) as PrivoConfiguration;
    }

    @traced(TRACE_NAME)
    async getModerationConfig(): Promise<ModerationConfiguration> {
        return (await this._getConfiguration(
            MODERATION_CONFIG_KEY,
            async () =>
                (await this._store.getModerationConfig()) as ConfigurationOutput<
                    typeof MODERATION_CONFIG_KEY
                > | null
        )) as ModerationConfiguration;
    }
}
