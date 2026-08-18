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
import type { OpenIDProviderConfiguration } from './OpenIDConfiguration';
import type { Client } from 'openid-client';
import { Issuer, generators } from 'openid-client';
import { z } from 'zod';
import { traced } from './tracing/TracingDecorators';
import type { SpanOptions } from '@opentelemetry/api';
import { SpanKind } from '@opentelemetry/api';

/**
 * Defines an interface for objects that can perform the OpenID Connect
 * authorization code flow (with PKCE) against an arbitrary, dynamically
 * configured OpenID provider.
 */
export interface GenericOpenIDClientInterface {
    /**
     * Generates a URL that can be used to authorize a user with the given provider.
     * @param config The configuration of the provider that should be used.
     * @param state The state that should be included in the request.
     */
    generateAuthorizationUrl(
        config: OpenIDProviderConfiguration,
        state: string
    ): Promise<GenericOpenIDAuthorizationUrlResult>;

    /**
     * Processes the authorization callback from the given provider and exchanges the
     * authorization code for tokens and user info.
     * @param config The configuration of the provider that should be used.
     * @param request The request.
     */
    processAuthorizationCallback(
        config: OpenIDProviderConfiguration,
        request: ProcessGenericOpenIDCallbackRequest
    ): Promise<ProcessGenericOpenIDCallbackResponse>;
}

export interface GenericOpenIDAuthorizationUrlResult {
    /**
     * The URL that the user should be redirected to in order to authorize with the provider.
     */
    authorizationUrl: string;

    /**
     * The URL that the provider should redirect the user back to.
     */
    redirectUrl: string;

    /**
     * The PKCE code verifier that was generated for the request.
     */
    codeVerifier: string;

    /**
     * The PKCE code challenge method that was used for the request.
     */
    codeMethod: string;

    /**
     * The scope that was requested.
     */
    scope: string;

    /**
     * The nonce that was generated for the request.
     */
    nonce: string;
}

export interface ProcessGenericOpenIDCallbackRequest {
    /**
     * The authorization code that was received from the provider.
     */
    code: string;

    /**
     * The state that was received from the provider.
     */
    state: string;

    /**
     * The PKCE code verifier that was generated for the original request.
     */
    codeVerifier: string;

    /**
     * The nonce that was generated for the original request.
     */
    nonce: string;

    /**
     * The URL that the provider redirected the user back to.
     */
    redirectUrl: string;
}

export interface GenericOpenIDUserInfo {
    /**
     * The subject that the provider reported for the user.
     */
    sub: string;

    /**
     * The email address that the provider reported for the user.
     */
    email?: string | null;

    /**
     * The name that the provider reported for the user.
     */
    name?: string | null;
}

export interface ProcessGenericOpenIDCallbackResponse {
    accessToken: string;
    refreshToken: string;
    idToken: string;
    expiresIn: number;
    tokenType: string;
    userInfo: GenericOpenIDUserInfo;
}

const TRACE_NAME = 'GenericOpenIDClient';
const SPAN_OPTIONS: SpanOptions = {
    kind: SpanKind.CLIENT,
    attributes: {
        'peer.service': 'openid',
        'service.name': 'openid',
    },
};

/**
 * Defines a class that can perform the OpenID Connect authorization code flow
 * (with PKCE) against arbitrary, dynamically configured OpenID providers.
 *
 * Discovered issuers/clients are cached per provider ID so that discovery only
 * has to happen once per provider.
 */
export class GenericOpenIDClient implements GenericOpenIDClientInterface {
    private _clients: Map<string, Client> = new Map();

    private async _getClient(
        config: OpenIDProviderConfiguration
    ): Promise<Client> {
        let client = this._clients.get(config.id);
        if (!client) {
            let issuer: Issuer<Client>;
            if (config.issuer) {
                issuer = new Issuer(config.issuer);
            } else if (config.discoveryUri) {
                issuer = await Issuer.discover(config.discoveryUri);
            } else {
                throw new Error(
                    `The OpenID provider "${config.id}" must specify either a discoveryUri or an issuer.`
                );
            }
            client = new issuer.Client({
                client_id: config.clientId,
                client_secret: config.clientSecret,
                redirect_uris: [config.redirectUri],
                response_types: ['code'],
            });
            this._clients.set(config.id, client);
        }
        return client;
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async generateAuthorizationUrl(
        config: OpenIDProviderConfiguration,
        state: string
    ): Promise<GenericOpenIDAuthorizationUrlResult> {
        const client = await this._getClient(config);
        const codeVerifier = generators.codeVerifier();
        const codeChallenge = generators.codeChallenge(codeVerifier);
        const codeMethod = 'S256';
        const scope = config.requestScopes.join(' ');
        const nonce = generators.nonce();

        const url = client.authorizationUrl({
            scope,
            code_challenge: codeChallenge,
            code_challenge_method: codeMethod,
            state,
            nonce,
        });

        return {
            authorizationUrl: url,
            redirectUrl: config.redirectUri,
            codeMethod,
            codeVerifier,
            scope,
            nonce,
        };
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async processAuthorizationCallback(
        config: OpenIDProviderConfiguration,
        request: ProcessGenericOpenIDCallbackRequest
    ): Promise<ProcessGenericOpenIDCallbackResponse> {
        const client = await this._getClient(config);
        const tokens = await client.callback(
            request.redirectUrl,
            {
                code: request.code,
                state: request.state,
            },
            {
                state: request.state,
                code_verifier: request.codeVerifier,
                nonce: request.nonce,
            }
        );

        const data: any = await client.userinfo(tokens.access_token);

        const schema = z.object({
            sub: z.string(),
            email: z.string().optional().nullable(),
            name: z.string().optional().nullable(),
        });

        const validated = schema.parse(data);

        return {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            idToken: tokens.id_token,
            expiresIn: tokens.expires_in,
            tokenType: tokens.token_type,
            userInfo: {
                sub: validated.sub,
                email: validated.email,
                name: validated.name,
            },
        };
    }
}
