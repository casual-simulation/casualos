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
import type { SubscriptionConfiguration } from './SubscriptionConfiguration';
import type { PrivoConfiguration } from './PrivoConfiguration';
import type { ModerationConfiguration } from './ModerationConfiguration';
import type { WebConfig } from '@casual-simulation/aux-common';
import type { WebManifest } from '@casual-simulation/aux-common/common/WebManifest';

export const SUBSCRIPTIONS_CONFIG_KEY = 'subscriptions';

export const PRIVO_CONFIG_KEY = 'privo';

export const MODERATION_CONFIG_KEY = 'moderation';

export const WEB_CONFIG_KEY = 'web';

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
}

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
}
