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
    ConfigurationStore,
    DefaultConfiguration,
    SubscriptionConfiguration,
} from '@casual-simulation/aux-records';
import {
    MODERATION_CONFIG_KEY,
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

const TRACE_NAME = 'PrismaConfigurationStore';

export class PrismaConfigurationStore implements ConfigurationStore {
    private _client: PrismaClient;
    private _defaultConfiguration: DefaultConfiguration;

    constructor(client: PrismaClient, defaultConfig: DefaultConfiguration) {
        this._client = client;
        this._defaultConfiguration = defaultConfig;
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
    async getModerationConfig(): Promise<{
        allowUnauthenticatedReports?: boolean;
    }> {
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
