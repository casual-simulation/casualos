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
import type { PrivoConfiguration } from './PrivoConfiguration';
import type { PrivoClientCredentials, PrivoStore } from './PrivoStore';
import type { Client, TokenSet } from 'openid-client';
import { Issuer, generators } from 'openid-client';
import { v4 as uuid } from 'uuid';
import type { RawAxiosRequestHeaders } from 'axios';
import axios from 'axios';
import { DateTime } from 'luxon';
import { z } from 'zod';
import type { ServerError } from '@casual-simulation/aux-common';
import { traced } from './tracing/TracingDecorators';
import type { SpanOptions } from '@opentelemetry/api';
import { SpanKind } from '@opentelemetry/api';

/**
 * Defines an interface for objects that can interface with the Privo API.
 */
export interface PrivoClientInterface {
    // /**
    //  * Gets the client credentials that should be used to authenticate with the Privo API.
    //  */
    // getClientCredentials(): Promise<PrivoClientCredentials | null>;

    /**
     * Attempts to create a new child account.
     * @param request The request for the child account.
     */
    createChildAccount(
        request: CreateChildAccountRequest
    ): Promise<CreateChildAccountResponse>;

    /**
     * Attempts to create a new adult account.
     * @param request The request for the adult account.
     */
    createAdultAccount(
        request: CreateAdultAccountRequest
    ): Promise<CreateAdultAccountResponse>;

    /**
     * Gets the user info for the given service ID.
     * @param serviceId The ID of the service.
     */
    getUserInfo(serviceId: string): Promise<PrivoGetUserInfoResponse>;

    /**
     * Attempts to lookup the service ID for the given request.
     * Can be used to lookup the service ID by one of: user name, display name, email, phone, or user ID.
     * Only once of these fields should be provided at a time.
     * If multiple are provided, then the first one provided from the list above will be used for the search.
     * @param request The request.
     */
    lookupServiceId(request: LookupServiceIdRequest): Promise<string | null>;

    /**
     * Resends the consent email for the given requester and approver service IDs.
     * @param requesterServiceId The ID of the requester (child).
     * @param approverServiceId The ID of the approver (parent).
     */
    resendConsentRequest(
        requesterServiceId: string,
        approverServiceId: string
    ): Promise<ResendConsentRequestResponse>;

    /**
     * Generates a URL that can be used to authorize a user.
     * @param state The state that should be included in the request.
     */
    generateAuthorizationUrl(
        state?: string
    ): Promise<GeneratedAuthorizationUrl>;

    processAuthorizationCallback(
        request: ProcessAuthorizationCallbackRequest
    ): Promise<ProcessAuthorizationCallbackResponse>;

    /**
     * Generates a URL that can be used to log out the user with the given token.
     * @param token The token that should be revoked.
     */
    generateLogoutUrl(token: string): Promise<string>;

    /**
     * Checks whether the given email address is available and allowed.
     * @param email The email.
     */
    checkEmail(email: string): Promise<CheckEmailResult>;

    /**
     * Checks whether the given display name is available and allowed.
     * @param displayName The display name.
     */
    checkDisplayName(displayName: string): Promise<CheckDisplayNameResult>;
}

export interface CheckEmailResult {
    /**
     * Whether the email is available to be used.
     */
    available: boolean;

    /**
     * Suggested alternate email addresses.
     */
    suggestions?: string[];

    /**
     * Whether the email contains profanity.
     */
    profanity?: boolean;
}

export interface CheckDisplayNameResult {
    /**
     * Whether the display name is allowed.
     */
    available: boolean;

    /**
     * Suggested alternate display names.
     */
    suggestions?: string[];

    /**
     * Whether the display name contains profanity.
     */
    profanity?: boolean;
}

export interface GeneratedAuthorizationUrl {
    /**
     * The code verifier that was generated.
     */
    codeVerifier: string;

    /**
     * The method that was used for the code challenge.
     */
    codeMethod: string;

    /**
     * The URL that was generated.
     */
    authorizationUrl: string;

    /**
     * The URL that the user should be redirected to after a successful login.
     */
    redirectUrl: string;

    /**
     * The scope that was requested.
     */
    scope: string;
}

export interface ProcessAuthorizationCallbackRequest {
    /**
     * The code that was provided.
     */
    code: string;

    /**
     * The state that was provided.
     */
    state: string;

    /**
     * The code verifier that was stored for the request.
     */
    codeVerifier: string;

    /**
     * The URL that the user should be redirected to after a successful login.
     */
    redirectUrl: string;
}

export interface ProcessAuthorizationCallbackResponse {
    /**
     * The access token that was generated.
     */
    accessToken: string;

    /**
     * The refresh token that was generated.
     */
    refreshToken: string;

    /**
     * The ID token that was generated.
     */
    idToken: string;

    /**
     * The number of seconds until the access token expires.
     */
    expiresIn: number;

    /**
     * The type of the token.
     */
    tokenType: string;

    /**
     * The user info that was returned.
     */
    userInfo: PrivoGetUserInfoResponse;
}

export interface LookupServiceIdRequest {
    userName?: string;
    displayName?: string;
    email?: string;
    phoneNumber?: string;
    externalUserIdentifier?: string;
}

const TRACE_NAME = 'PrivoClient';
const SPAN_OPTIONS: SpanOptions = {
    kind: SpanKind.CLIENT,
    attributes: {
        'peer.service': 'privo',
        'service.name': 'privo',
    },
};

/**
 * Defines a class that implements PrivoClientInterface.
 */
export class PrivoClient implements PrivoClientInterface {
    private _store: PrivoStore;
    private _config: ConfigurationStore;
    private _issuer: Issuer<Client>;
    private _openid: Client;
    private _redirectUri: string;

    constructor(store: PrivoStore, configStore: ConfigurationStore) {
        this._store = store;
        this._config = configStore;
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async init(): Promise<void> {
        const config = await this._config.getPrivoConfiguration();
        this._issuer = await Issuer.discover(config.publicEndpoint);
        this._redirectUri = config.redirectUri;
        this._openid = new this._issuer.Client({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            redirect_uris: [this._redirectUri],
            response_types: ['code'],
        });
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async resendConsentRequest(
        requesterServiceId: string,
        approverServiceId: string
    ): Promise<ResendConsentRequestResponse> {
        const config = await this._config.getPrivoConfiguration();

        if (!config) {
            throw new Error('No Privo configuration found.');
        }
        const headers = await this._getRequestHeaders(config);
        const url = `${config.gatewayEndpoint}/api/v1.0/consent/resend`;
        const result = await axios.post(
            url,
            {
                requester_service_id: requesterServiceId,
                approver_service_id: approverServiceId,
            },
            {
                headers,
                validateStatus: (status) => status < 500,
            }
        );

        if (result.status >= 400) {
            console.error(
                `[PrivoClient] [resendConsentRequest] Error resending consent request: ${result.status} ${result.statusText}`,
                result.data
            );

            return {
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage:
                    'The request contains one or more invalid fields.',
            };
        }

        return {
            success: true,
        };
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async createChildAccount(
        request: CreateChildAccountRequest
    ): Promise<CreateChildAccountResponse> {
        const config = await this._config.getPrivoConfiguration();

        if (!config) {
            throw new Error('No Privo configuration found.');
        }

        const headers = await this._getRequestHeaders(config);
        const url = `${config.gatewayEndpoint}/api/v1.0/account/parent`;
        const result = await axios.post(
            url,
            {
                role_identifier: config.roleIds.parent,
                email: request.parentEmail,
                send_congratulations_email: true,
                minor_registrations: [
                    {
                        send_parent_email: true,
                        role_identifier: config.roleIds.child,
                        first_name: request.childFirstName,
                        email: request.childEmail,
                        birth_date_yyyymmdd: DateTime.fromJSDate(
                            request.childDateOfBirth
                        ).toFormat('yyyyMMdd'),
                        features: request.featureIds.map((f) => ({
                            feature_identifier: f,
                        })),
                        attributes: [
                            {
                                name: 'displayName',
                                value: request.childDisplayName,
                            },
                        ],
                    },
                ],
            },
            {
                headers,
                validateStatus: (status) => status < 500,
            }
        );

        if (result.status >= 400) {
            console.error(
                `[PrivoClient] [createChildAccount] Error creating child account: ${result.status} ${result.statusText}`,
                result.data
            );

            if (result.status === 412) {
                return {
                    success: false,
                    errorCode: 'child_email_already_exists',
                    errorMessage: 'The child email already exists.',
                };
            }

            return {
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage:
                    'The request contains one or more invalid fields.',
            };
        }

        const data = result.data;

        const schema = z.object({
            to: z.object({
                service_id: z.string(),
                connected_profiles: z
                    .array(
                        z.object({
                            service_id: z.string(),
                            update_password_link: z.string(),
                            features: z.array(
                                z.object({
                                    feature_identifier: z.string(),
                                    on: z.boolean(),
                                })
                            ),
                            consent_meta: z
                                .object({
                                    consent_url: z
                                        .string()
                                        .optional()
                                        .nullable(),
                                })
                                .optional()
                                .nullable(),
                        })
                    )
                    .min(1),
            }),
        });

        const validated = schema.parse(data);

        return {
            success: true,
            parentServiceId: validated.to.service_id,
            childServiceId: validated.to.connected_profiles[0].service_id,
            updatePasswordLink:
                validated.to.connected_profiles[0].update_password_link,
            features: validated.to.connected_profiles[0].features.map(
                (f: any) => ({
                    featureId: f.feature_identifier,
                    on: f.on === true || f.on === 'true',
                })
            ),
            consentUrl:
                validated.to.connected_profiles[0].consent_meta?.consent_url,
        };
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async createAdultAccount(
        request: CreateAdultAccountRequest
    ): Promise<CreateAdultAccountResponse> {
        const config = await this._config.getPrivoConfiguration();

        if (!config) {
            throw new Error('No Privo configuration found.');
        }

        const headers = await this._getRequestHeaders(config);
        const url = `${config.gatewayEndpoint}/api/v1.0/account`;
        const result = await axios.post(
            url,
            {
                role_identifier: config.roleIds.adult,
                email: request.adultEmail,
                send_registration_email: true,
                send_congratulations_email: true,
                birth_date_yyyymmdd: DateTime.fromJSDate(
                    request.adultDateOfBirth
                ).toFormat('yyyyMMdd'),
                first_name: request.adultFirstName,
                features: request.featureIds.map((f) => ({
                    feature_identifier: f,
                })),
                attributes: [
                    {
                        name: 'displayName',
                        value: request.adultDisplayName,
                    },
                ],
            },
            {
                headers,
                validateStatus: (status) => status < 500,
            }
        );

        if (result.status >= 400) {
            console.error(
                `[PrivoClient] [createAdultAccount] Error creating adult account: ${result.status} ${result.statusText}`,
                result.data
            );

            if (result.status === 412) {
                return {
                    success: false,
                    errorCode: 'email_already_exists',
                    errorMessage: 'The email already exists.',
                };
            }

            return {
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage:
                    'The request contains one or more invalid fields.',
            };
        }

        const data = result.data;

        const schema = z.object({
            to: z.object({
                service_id: z.string(),
                features: z.array(
                    z.object({
                        feature_identifier: z.string(),
                        on: z.boolean(),
                    })
                ),
                update_password_link: z.string(),
                consent_meta: z
                    .object({
                        consent_url: z.string().optional().nullable(),
                    })
                    .optional()
                    .nullable(),
            }),
        });

        const validated = schema.parse(data);

        return {
            success: true,
            adultServiceId: validated.to.service_id,
            updatePasswordLink: validated.to.update_password_link,
            features: validated.to.features.map((f: any) => ({
                featureId: f.feature_identifier,
                on: f.on === true || f.on === 'true',
            })),
            consentUrl: validated.to.consent_meta?.consent_url,
        };
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async getUserInfo(serviceId: string): Promise<PrivoGetUserInfoResponse> {
        const config = await this._config.getPrivoConfiguration();

        if (!config) {
            throw new Error('No Privo configuration found.');
        }

        const headers = await this._getRequestHeaders(config);
        const url = `${config.gatewayEndpoint}/userinfo`;
        const result = await axios.get(url, {
            params: {
                service_id: serviceId,
            },
            headers,
        });

        const data = result.data;

        const schema = z.object({
            sub: z.string(),
            locale: z.string(),
            given_name: z.string(),
            email: z.string().optional().nullable(),
            email_verified: z.boolean(),
            role_identifier: z.string(),
            display_name: z.string(),
            permissions: z.array(
                z.object({
                    on: z.boolean(),
                    consent_date: z.number(),
                    feature_identifier: z.string(),
                    category: z.string(),
                    active: z.boolean(),
                })
            ),
        });

        const validated = schema.parse(data);

        return {
            serviceId: validated.sub,
            locale: validated.locale,
            givenName: validated.given_name,
            email: validated.email,
            emailVerified: validated.email_verified,
            roleIdentifier: validated.role_identifier,
            displayName: validated.display_name,
            permissions: validated.permissions.map((p) => ({
                on: p.on,
                consentDateSeconds: p.consent_date,
                featureId: p.feature_identifier,
                category: p.category,
                active: p.active,
            })),
        };
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async lookupServiceId(
        request: LookupServiceIdRequest
    ): Promise<string | null> {
        const config = await this._config.getPrivoConfiguration();
        if (!config) {
            throw new Error('No Privo configuration found.');
        }

        const headers = await this._getRequestHeaders(config);
        const url = `${config.gatewayEndpoint}/api/v1.0/account/lookup`;

        const params: Record<string, string> = {};
        if (request.userName) {
            params.user_name = request.userName;
        } else if (request.displayName) {
            params.display_name = request.displayName;
        } else if (request.email) {
            params.email = request.email;
        } else if (request.phoneNumber) {
            params.phone = request.phoneNumber;
        } else if (request.externalUserIdentifier) {
            params.external_user_identifier = request.externalUserIdentifier;
        }

        const result = await axios.get(url, {
            params,
            headers,
        });

        if (result.status === 404) {
            return null;
        }

        const data = result.data;

        const schema = z.object({
            sid: z.string(),
        });

        const validated = schema.parse(data);
        return validated.sid;
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async generateAuthorizationUrl(
        state?: string
    ): Promise<GeneratedAuthorizationUrl> {
        const codeVerifier = generators.codeVerifier();
        const codeChallenge = generators.codeChallenge(codeVerifier);
        const codeMethod = 'S256';
        const config = await this._config.getPrivoConfiguration();

        const scope = config.userTokenScopes;
        const url = this._openid.authorizationUrl({
            scope: scope,
            code_challenge: codeChallenge,
            code_challenge_method: codeMethod,
            state,
        });

        return {
            authorizationUrl: url,
            redirectUrl: this._redirectUri,
            codeMethod,
            codeVerifier: codeVerifier,
            scope: scope,
        };
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async processAuthorizationCallback(
        request: ProcessAuthorizationCallbackRequest
    ): Promise<ProcessAuthorizationCallbackResponse> {
        const tokens = await this._openid.callback(
            request.redirectUrl,
            {
                code: request.code,
                state: request.state,
            },
            {
                state: request.state,
                code_verifier: request.codeVerifier,
            }
        );

        const data: any = await this._openid.userinfo(tokens.access_token);

        const schema = z.object({
            sub: z.string(),
            locale: z.string(),
            given_name: z.string().optional().nullable(),
            email: z.string().optional().nullable(),
            email_verified: z.boolean(),
            role_identifier: z.string(),
            preferred_username: z.string().optional().nullable(),
            permissions: z
                .array(
                    z.object({
                        on: z.boolean(),
                        consent_time: z.number().nullable().optional(),
                        request_time: z.number(),
                        feature_identifier: z.string(),
                        feature_category: z.string(),
                        feature_active: z.boolean(),
                    })
                )
                .optional()
                .nullable(),
        });

        const validated = schema.parse(data);

        return {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            idToken: tokens.id_token,
            expiresIn: tokens.expires_in,
            tokenType: tokens.token_type,
            userInfo: {
                serviceId: validated.sub,
                locale: validated.locale,
                givenName: validated.given_name,
                email: validated.email,
                emailVerified: validated.email_verified,
                roleIdentifier: validated.role_identifier,
                displayName: validated.preferred_username,
                permissions: validated.permissions.map((p) => ({
                    on: p.on,
                    consentDateSeconds: p.consent_time,
                    featureId: p.feature_identifier,
                    category: p.feature_category,
                    active: p.feature_active,
                })),
            },
        };
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async generateLogoutUrl(token: string): Promise<string> {
        const config = await this._config.getPrivoConfiguration();
        if (!config) {
            throw new Error('No Privo configuration found.');
        }

        const url = new URL('/logout', config.publicEndpoint);
        url.searchParams.set('id_token_hint', token);
        return url.href;
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async checkEmail(email: string): Promise<CheckEmailResult> {
        const config = await this._config.getPrivoConfiguration();

        if (!config) {
            throw new Error('No Privo configuration found.');
        }
        const headers = await this._getRequestHeaders(config);
        const url = `${config.gatewayEndpoint}/api/v1.0/account/check/email`;

        const result = await axios.post(url, { email }, { headers });

        const data = result.data;

        // Privo's email API returns invalid profanity information.
        const schema = z.object({
            available: z.boolean(),
            suggestions: z.array(z.string()).optional(),
        });

        const validated = schema.parse(data);

        return {
            available: validated.available,
            suggestions: validated.suggestions,
        };
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async checkDisplayName(
        displayName: string
    ): Promise<CheckDisplayNameResult> {
        const config = await this._config.getPrivoConfiguration();

        if (!config) {
            throw new Error('No Privo configuration found.');
        }
        const headers = await this._getRequestHeaders(config);
        const url = `${config.gatewayEndpoint}/api/v1.0/account/check/display-name`;

        const result = await axios.post(
            url,
            {
                display_name: displayName,
                suggest: true,
            },
            { headers }
        );

        const data = result.data;

        const schema = z.object({
            available: z.boolean(),
            suggestions: z.array(z.string()).optional(),
            profanity: z.boolean().optional(),
        });

        const validated = schema.parse(data);

        return {
            available: validated.available,
            profanity: validated.profanity,
            suggestions: validated.suggestions,
        };
    }

    private async _getRequestHeaders(
        config: PrivoConfiguration
    ): Promise<RawAxiosRequestHeaders> {
        const credentials = await this._getClientCredentials(config);
        if (!credentials) {
            throw new Error('No Privo credentials found.');
        }

        return {
            Authorization: `Bearer ${credentials.accessToken}`,
        };
    }

    private async _getClientCredentials(
        config: PrivoConfiguration
    ): Promise<PrivoClientCredentials | null> {
        const creds = await this._store.getStoredCredentials();

        if (creds) {
            const expired = creds.expiresAtSeconds < Date.now() / 1000;
            if (!expired) {
                return creds;
            } else {
                const tokens = await this._openid.refresh(creds.refreshToken);
                return this._saveTokenSet(tokens);
            }
        } else {
            const tokens = await this._openid.grant({
                grant_type: 'client_credentials',
                scope: config.clientTokenScopes,
            });
            return this._saveTokenSet(tokens);
        }
    }

    private async _saveTokenSet(
        set: TokenSet
    ): Promise<PrivoClientCredentials> {
        const creds: PrivoClientCredentials = {
            id: uuid(),
            accessToken: set.access_token,
            expiresAtSeconds: set.expires_at,
            refreshToken: set.refresh_token,
            scope: set.scope,
        };

        await this._store.saveCredentials(creds);

        return creds;
    }
}

export interface CreateChildAccountRequest {
    /**
     * The email address of the parent.
     */
    parentEmail: string;

    /**
     * The name of the child's first name.
     */
    childFirstName: string;

    /**
     * The date of birth of the child.
     */
    childDateOfBirth: Date;

    /**
     * The username that the child will use to log in.
     */
    childEmail: string;

    /**
     * The display name that the child can use to log in.
     */
    childDisplayName: string;

    /**
     * The list of feature IDs that are being requested.
     */
    featureIds: string[];
}

export type CreateChildAccountResponse =
    | CreateChildAccountSuccess
    | CreateChildAccountFailure;

export interface CreateChildAccountSuccess {
    success: true;

    /**
     * The parent service ID.
     */
    parentServiceId: string;

    /**
     * The child service ID.
     */
    childServiceId: string;

    /**
     * The URL that can be used to set the initial password of the child account.
     */
    updatePasswordLink: string;

    /**
     * The list of features and statuses for the child account.
     */
    features: PrivoFeatureStatus[];

    /**
     * The URL that can be used to grant consent for the child account.
     */
    consentUrl: string;
}

export interface CreateChildAccountFailure {
    success: false;
    errorCode:
        | ServerError
        | 'unacceptable_request'
        | 'child_email_already_exists';
    errorMessage: string;
}

export interface PrivoFeatureStatus {
    /**
     * The ID of the feature.
     */
    featureId: string;

    /**
     * Whether the feature is enabled or not.
     */
    on: boolean;
}

export interface CreateAdultAccountRequest {
    /**
     * The email address of the adult.
     */
    adultEmail: string;

    /**
     * The name of the adult.
     */
    adultFirstName: string;

    /**
     * The name that the user can use to sign in.
     */
    adultDisplayName: string;

    /**
     * The birth date of the adult.
     */
    adultDateOfBirth: Date;

    /**
     * The list of feature IDs that the adult should have access to.
     */
    featureIds: string[];
}

export type CreateAdultAccountResponse =
    | CreateAdultAccountSuccess
    | CreateAdultAccountFailure;

export interface CreateAdultAccountSuccess {
    success: true;

    /**
     * The adult's service ID.
     */
    adultServiceId: string;

    /**
     * The URL that can be used to set the initial password of the child account.
     */
    updatePasswordLink: string;

    /**
     * The list of features and statuses for the child account.
     */
    features: PrivoFeatureStatus[];

    /**
     * The URL that can be used to grant consent for the account.
     */
    consentUrl: string;
}

export interface CreateAdultAccountFailure {
    success: false;
    errorCode: ServerError | 'unacceptable_request' | 'email_already_exists';
    errorMessage: string;
}

export interface PrivoGetUserInfoResponse {
    serviceId: string;
    locale: string;

    /**
     * The given name of the user.
     * This is the name that the user provided when they signed up.
     * The user may not have a given name if their role does not require that they provide one. (e.g. parent accounts)
     */
    givenName: string | null | undefined;
    emailVerified: boolean;
    email: string;

    /**
     * The role identifier that the user has.
     */
    roleIdentifier: string;

    /**
     * The display name of the user.
     * The user may not have a display name if their role does not require that they provide one. (e.g. parent accounts)
     */
    displayName: string | null | undefined;

    /**
     * The Privo permissions that the user has.
     * The user may not have permissions if their role does not have any (e.g. parent accounts).
     */
    permissions: PrivoPermission[] | null | undefined;
}

export interface PrivoPermission {
    /**
     * Whether the feature has been granted or not.
     */
    on: boolean;

    /**
     * The number of seconds since the Unix Epoch that consent for this permission was given on.
     */
    consentDateSeconds: number;

    /**
     * The ID of the feature.
     */
    featureId: string;

    /**
     * The category that this feature exists in.
     */
    category: string;

    /**
     * Whether the feature is active and available in the system.
     */
    active: boolean;
}

export type ResendConsentRequestResponse =
    | ResendConsentRequestSuccess
    | ResendConsentRequestFailure;

export interface ResendConsentRequestSuccess {
    success: true;
}

export interface ResendConsentRequestFailure {
    success: false;
    errorCode: ServerError | 'unacceptable_request';
    errorMessage: string;
}
