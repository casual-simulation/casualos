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
import type { ConfigurationStore } from './ConfigurationStore';
import type { OpenIDProviderConfiguration } from './OpenIDConfiguration';
import type { Privo2Configuration } from './Privo2Configuration';
import {
    Privo2ConsentClient,
    getPrivo2FeatureStatuses,
    type Privo2Account,
} from './Privo2ConsentClient';
import type { PrivacyFeatures } from '@casual-simulation/aux-common';
import { timingSafeEqual, createHash } from 'crypto';

export const PRIVO2_OPEN_ID_PROVIDER = 'privo2';

export interface Privo2ClientInterface {
    getConfiguration(): Promise<Privo2Configuration | null>;
    getOpenIDConfiguration(): Promise<OpenIDProviderConfiguration | null>;
    getClient(): Promise<Privo2ConsentClient>;
    getAccount(sid: string): Promise<Privo2Account>;
    getPrivacyFeatures(account: Privo2Account): Promise<PrivacyFeatures>;
    isAccountApproved(account: Privo2Account): Promise<boolean>;
    generateLogoutUrl(idToken: string): Promise<string>;
    verifyWebhookSecret(value: string | undefined): Promise<boolean>;
}

/** PRIVO2 configuration and consent operations, separate from the legacy client. */
export class Privo2Client implements Privo2ClientInterface {
    private _cachedConfig: string;
    private _client: Privo2ConsentClient;

    constructor(private _configStore: ConfigurationStore) {}

    async getConfiguration(): Promise<Privo2Configuration | null> {
        const config = (await this._configStore.getPrivoConfiguration())
            ?.privo2;
        return config?.enabled ? config : null;
    }

    async getOpenIDConfiguration(): Promise<OpenIDProviderConfiguration | null> {
        const config = await this.getConfiguration();
        if (!config) return null;
        return {
            id: PRIVO2_OPEN_ID_PROVIDER,
            name: 'PRIVO iD',
            discoveryUri: config.authEndpoint,
            redirectUri: config.redirectUri,
            clientId: config.clientId,
            clientSecret: config.clientSecret,
            tokenEndpointAuthMethod: 'client_secret_post',
            requestScopes: ['openid', 'profile', 'email'],
        };
    }

    async getClient(): Promise<Privo2ConsentClient> {
        const config = await this.getConfiguration();
        if (!config) throw new Error('PRIVO2 is not enabled.');
        const key = JSON.stringify(config);
        if (key !== this._cachedConfig) {
            this._client = new Privo2ConsentClient(config);
            this._cachedConfig = key;
        }
        return this._client;
    }

    async getAccount(sid: string): Promise<Privo2Account> {
        const account = await (await this.getClient()).getAccount(sid);
        if (account.sub !== sid)
            throw new Error(
                'PRIVO2 returned an unexpected account identifier.'
            );
        return account;
    }

    async getPrivacyFeatures(account: Privo2Account): Promise<PrivacyFeatures> {
        const config = await this.getConfiguration();
        if (!config?.featureIds)
            throw new Error('PRIVO2 features are not configured.');
        const granted = new Set(
            getPrivo2FeatureStatuses(account)
                .filter((f) => f.on)
                .map((f) => f.featureId)
        );
        const ids = config.featureIds;
        const accountOn = granted.has(ids.account);
        const publishData = accountOn && granted.has(ids.projectDevelopment);
        return {
            publishData,
            allowPublicData: publishData && granted.has(ids.publishProjects),
            allowPublicInsts:
                publishData && granted.has(ids.joinAndCollaborate),
            allowAI: accountOn && granted.has(ids.buildAIEggs),
        };
    }

    async isAccountApproved(account: Privo2Account): Promise<boolean> {
        const config = await this.getConfiguration();
        return (
            !!config?.featureIds &&
            account.features.some(
                (f) =>
                    f.feature_identifier === config.featureIds.account &&
                    f.state === 'on'
            )
        );
    }

    async generateLogoutUrl(idToken: string): Promise<string> {
        const config = await this.getConfiguration();
        if (!config || !idToken)
            throw new Error('PRIVO2 logout is unavailable.');
        const url = new URL('/openid-connect/logout', config.authEndpoint);
        url.searchParams.set('id_token_hint', idToken);
        return url.href;
    }

    async verifyWebhookSecret(value: string | undefined): Promise<boolean> {
        const config = await this.getConfiguration();
        if (!config?.webhookSecret || typeof value !== 'string') return false;
        // Hashes have equal length even when the supplied secret does not.
        const hash = (secret: string) =>
            createHash('sha256').update(secret).digest();
        return timingSafeEqual(hash(value), hash(config.webhookSecret));
    }
}
