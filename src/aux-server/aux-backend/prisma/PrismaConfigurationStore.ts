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
import type {
    ConfigurationInput,
    ConfigurationKey,
    ConfigurationOutput,
    ConfigurationStore,
    DefaultConfiguration,
    ModerationConfiguration,
    SubscriptionConfiguration,
} from '@casual-simulation/aux-records';
import {
    CONFIGURATION_SCHEMAS_MAP,
    MODERATION_CONFIG_KEY,
    PLAYER_WEB_MANIFEST_KEY,
    PRIVO_CONFIG_KEY,
    SUBSCRIPTIONS_CONFIG_KEY,
    WEB_CONFIG_KEY,
    parseSubscriptionConfig,
} from '@casual-simulation/aux-records';
import type { PrivoConfiguration } from '@casual-simulation/aux-records/PrivoConfiguration';
import { parsePrivoConfiguration } from '@casual-simulation/aux-records/PrivoConfiguration';
import type { PrismaClient } from './generated';
import { parseModerationConfiguration } from '@casual-simulation/aux-records/ModerationConfiguration';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';
import { parseWebConfig, type WebConfig } from '@casual-simulation/aux-common';
import type { WebManifest } from '@casual-simulation/aux-common/common/WebManifest';
import { parseWebManifest } from '@casual-simulation/aux-common/common/WebManifest';

const TRACE_NAME = 'PrismaConfigurationStore';

export class PrismaConfigurationStore implements ConfigurationStore {
    private _client: PrismaClient;
    private _defaultConfiguration: DefaultConfiguration;

    constructor(client: PrismaClient, defaultConfig: DefaultConfiguration) {
        this._client = client;
        this._defaultConfiguration = defaultConfig;
    }

    private _getDefaultValue<TKey extends ConfigurationKey>(
        key: TKey
    ): ConfigurationOutput<TKey> | null {
        if (key === 'moderation') {
            return this._defaultConfiguration
                .moderation as ConfigurationOutput<TKey>;
        } else if (key === 'playerWebManifest') {
            return this._defaultConfiguration
                .playerWebManifest as ConfigurationOutput<TKey>;
        } else if (key === 'privo') {
            return this._defaultConfiguration
                .privo as ConfigurationOutput<TKey>;
        } else if (key === 'web') {
            return this._defaultConfiguration
                .webConfig as ConfigurationOutput<TKey>;
        } else if (key === 'subscriptions') {
            return this._defaultConfiguration
                .subscriptions as ConfigurationOutput<TKey>;
        } else if (key === 'metadata') {
            return this._defaultConfiguration.meta as ConfigurationOutput<TKey>;
        }

        console.warn(
            `[${TRACE_NAME}] No default value found for configuration key: ${key}`
        );
        return null;
    }

    @traced(TRACE_NAME)
    async setConfiguration<TKey extends ConfigurationKey>(
        key: TKey,
        value: ConfigurationInput<TKey> | null
    ): Promise<void> {
        const finalValue = value
            ? CONFIGURATION_SCHEMAS_MAP[key].parse(value)
            : null;
        await this._client.configuration.upsert({
            where: {
                key: key,
            },
            create: {
                key,
                data: finalValue as any,
            },
            update: {
                data: finalValue as any,
            },
        });
    }

    @traced(TRACE_NAME)
    async getConfiguration<TKey extends ConfigurationKey>(
        key: TKey,
        defaultValue?: ConfigurationInput<TKey>
    ): Promise<ConfigurationOutput<TKey> | null> {
        const result = await this._client.configuration.findUnique({
            where: {
                key,
            },
        });

        const schema = CONFIGURATION_SCHEMAS_MAP[key];
        if (result?.data) {
            return schema.parse(result.data) as ConfigurationOutput<TKey>;
        }

        if (defaultValue) {
            return schema.parse(defaultValue) as ConfigurationOutput<TKey>;
        }

        return this._getDefaultValue(key);
    }

    @traced(TRACE_NAME)
    async getWebConfig(): Promise<WebConfig | null> {
        const result = await this._client.configuration.findUnique({
            where: {
                key: WEB_CONFIG_KEY,
            },
        });

        return parseWebConfig(
            result?.data,
            this._defaultConfiguration.webConfig
        );
    }

    @traced(TRACE_NAME)
    async getPlayerWebManifest(): Promise<WebManifest | null> {
        const result = await this._client.configuration.findUnique({
            where: {
                key: PLAYER_WEB_MANIFEST_KEY,
            },
        });

        return parseWebManifest(
            result?.data,
            this._defaultConfiguration.playerWebManifest
        );
    }

    @traced(TRACE_NAME)
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

    @traced(TRACE_NAME)
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

    @traced(TRACE_NAME)
    async getModerationConfig(): Promise<ModerationConfiguration> {
        const result = await this._client.configuration.findUnique({
            where: {
                key: MODERATION_CONFIG_KEY,
            },
        });

        return parseModerationConfiguration(
            result?.data,
            this._defaultConfiguration.moderation
        );
    }
}
