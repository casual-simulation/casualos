import { ConfigurationStore } from 'ConfigurationStore';
import { PrivoConfiguration } from './PrivoConfiguration';
import { PrivoClientCredentials, PrivoStore } from './PrivoStore';
import { Client, Issuer, TokenSet, generators } from 'openid-client';
import { v4 as uuid } from 'uuid';
import axios, { AxiosRequestHeaders } from 'axios';
import { DateTime } from 'luxon';
import { z } from 'zod';

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
     * Generates a URL that can be used to authorize a user.
     * @param state The state that should be included in the request.
     */
    generateAuthorizationUrl(
        state?: string
    ): Promise<GeneratedAuthorizationUrl>;

    processAuthorizationCallback(
        request: ProcessAuthorizationCallbackRequest
    ): Promise<ProcessAuthorizationCallbackResponse>;
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
                    },
                ],
            },
            {
                headers,
            }
        );

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
                        })
                    )
                    .min(1),
            }),
        });

        const validated = schema.parse(data);

        console.log('privo data', data);
        console.log('connected profiles', data.to.connected_profiles);

        return {
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
        };
    }

    async createAdultAccount(
        request: CreateAdultAccountRequest
    ): Promise<CreateAdultAccountResponse> {
        throw new Error('Method not implemented.');
    }

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
            email: z.string(),
            email_verified: z.boolean(),
            role_identifier: z.string(),
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

        console.log('user data', data);
        // console.log('connected profiles', data.to.connected_profiles);

        return {
            serviceId: validated.sub,
            locale: validated.locale,
            givenName: validated.given_name,
            email: validated.email,
            emailVerified: validated.email_verified,
            roleIdentifier: validated.role_identifier,
            permissions: validated.permissions.map((p) => ({
                on: p.on,
                consentDateSeconds: p.consent_date,
                featureIdentifier: p.feature_identifier,
                category: p.category,
                active: p.active,
            })),
        };
    }

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
            given_name: z.string(),
            email: z.string(),
            email_verified: z.boolean(),
            role_identifier: z.string(),
            permissions: z.array(
                z.object({
                    on: z.boolean(),
                    consent_time: z.number(),
                    request_time: z.number(),
                    feature_identifier: z.string(),
                    feature_category: z.string(),
                    feature_active: z.boolean(),
                })
            ),
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
                permissions: validated.permissions.map((p) => ({
                    on: p.on,
                    consentDateSeconds: p.consent_time,
                    featureIdentifier: p.feature_identifier,
                    category: p.feature_category,
                    active: p.feature_active,
                })),
            },
        };
    }

    private async _getRequestHeaders(
        config: PrivoConfiguration
    ): Promise<AxiosRequestHeaders> {
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
     * The list of feature IDs that are being requested.
     */
    featureIds: string[];
}

export interface CreateChildAccountResponse {
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
     * The birth date of the adult.
     */
    adultDateOfBirth: Date;

    /**
     * The list of feature IDs that the adult should have access to.
     */
    featureIds: string[];
}

export interface CreateAdultAccountResponse {
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
}

export interface PrivoGetUserInfoResponse {
    serviceId: string;
    locale: string;
    givenName: string;
    emailVerified: boolean;
    email: string;
    roleIdentifier: string;
    permissions: PrivoPermission[];
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
    featureIdentifier: string;

    /**
     * The category that this feature exists in.
     */
    category: string;

    /**
     * Whether the feature is active and available in the system.
     */
    active: boolean;
}
