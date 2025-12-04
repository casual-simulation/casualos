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
import {
    PLAYER_WEB_MANIFEST_KEY,
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
    async getWebConfig(): Promise<WebConfig | null> {
        const cached = await this._cache.retrieve<WebConfig>(WEB_CONFIG_KEY);

        if (cached) {
            return cached;
        }

        const result = await this._store.getWebConfig();
        if (result) {
            await this._cache.store(WEB_CONFIG_KEY, result, this._cacheSeconds);
        }

        return result;
    }

    @traced(TRACE_NAME)
    async getPlayerWebManifest(): Promise<WebManifest | null> {
        const cached = await this._cache.retrieve<WebManifest>(
            PLAYER_WEB_MANIFEST_KEY
        );

        if (cached) {
            return cached;
        }

        const result = await this._store.getPlayerWebManifest();
        if (result) {
            await this._cache.store(
                PLAYER_WEB_MANIFEST_KEY,
                result,
                this._cacheSeconds
            );
        }

        return result;
    }

    @traced(TRACE_NAME)
    async getSubscriptionConfiguration(): Promise<SubscriptionConfiguration> {
        const cached = await this._cache.retrieve<SubscriptionConfiguration>(
            'subscriptions'
        );

        if (cached) {
            return cached;
        }

        const result = await this._store.getSubscriptionConfiguration();
        if (result) {
            await this._cache.store(
                'subscriptions',
                result,
                this._cacheSeconds
            );
        }

        return result;
    }

    @traced(TRACE_NAME)
    async getPrivoConfiguration(): Promise<PrivoConfiguration> {
        const cached = await this._cache.retrieve<PrivoConfiguration>('privo');

        if (cached) {
            return cached;
        }

        const result = await this._store.getPrivoConfiguration();
        if (result) {
            await this._cache.store('privo', result, this._cacheSeconds);
        }

        return result;
    }

    @traced(TRACE_NAME)
    async getModerationConfig(): Promise<ModerationConfiguration> {
        const cached = await this._cache.retrieve<ModerationConfiguration>(
            'moderation'
        );

        if (cached) {
            return cached;
        }

        const result = await this._store.getModerationConfig();
        if (result) {
            await this._cache.store('moderation', result, this._cacheSeconds);
        }

        return result;
    }
}
