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
} from '@casual-simulation/aux-records';
import {
    MODERATION_CONFIG_KEY,
    PLAYER_WEB_MANIFEST_KEY,
    PRIVO_CONFIG_KEY,
    SUBSCRIPTIONS_CONFIG_KEY,
    WEB_CONFIG_KEY,
    parseSubscriptionConfig,
} from '@casual-simulation/aux-records';
import type { SubscriptionConfiguration } from '@casual-simulation/aux-records/SubscriptionConfiguration';
import type { PrivoConfiguration } from '@casual-simulation/aux-records/PrivoConfiguration';
import { parsePrivoConfiguration } from '@casual-simulation/aux-records/PrivoConfiguration';
import type { Collection } from 'mongodb';
import type { ModerationConfiguration } from '@casual-simulation/aux-records/ModerationConfiguration';
import { parseModerationConfiguration } from '@casual-simulation/aux-records/ModerationConfiguration';
import type { WebConfig } from '@casual-simulation/aux-common';
import { parseWebConfig } from '@casual-simulation/aux-common';
import type { WebManifest } from '@casual-simulation/aux-common/common/WebManifest';
import { parseWebManifest } from '@casual-simulation/aux-common/common/WebManifest';

export class MongoDBConfigurationStore implements ConfigurationStore {
    private _defaultConfiguration: DefaultConfiguration;
    private _collection: Collection<MongoDBConfigItem>;

    constructor(
        defaultConfig: DefaultConfiguration,
        collection: Collection<MongoDBConfigItem>
    ) {
        this._defaultConfiguration = defaultConfig;
        this._collection = collection;
    }

    setConfiguration<TKey extends ConfigurationKey>(
        key: TKey,
        value: ConfigurationInput<TKey>
    ): Promise<void> {
        throw new Error('Method not implemented.');
    }

    getConfiguration<TKey extends ConfigurationKey>(
        key: TKey,
        defaultValue?: ConfigurationInput<TKey>
    ): Promise<ConfigurationOutput<TKey> | null> {
        throw new Error('Method not implemented.');
    }

    async getWebConfig(): Promise<WebConfig | null> {
        const result = await this._collection.findOne({
            _id: WEB_CONFIG_KEY,
        });

        return parseWebConfig(
            result?.data,
            this._defaultConfiguration.webConfig
        );
    }

    async getPlayerWebManifest(): Promise<WebManifest | null> {
        const result = await this._collection.findOne({
            _id: PLAYER_WEB_MANIFEST_KEY,
        });

        return parseWebManifest(
            result?.data,
            this._defaultConfiguration.playerWebManifest
        );
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

    async getPrivoConfiguration(): Promise<PrivoConfiguration> {
        const item = await this._collection.findOne({
            _id: PRIVO_CONFIG_KEY,
        });

        return parsePrivoConfiguration(
            item?.data,
            this._defaultConfiguration.privo
        );
    }

    async getModerationConfig(): Promise<ModerationConfiguration> {
        const item = await this._collection.findOne({
            _id: MODERATION_CONFIG_KEY,
        });

        return parseModerationConfiguration(
            item?.data,
            this._defaultConfiguration.moderation
        );
    }
}

export interface MongoDBConfigItem {
    _id: string;
    data: any;
}
