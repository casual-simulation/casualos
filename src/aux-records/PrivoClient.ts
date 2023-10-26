import { ConfigurationStore } from 'ConfigurationStore';
import { PrivoConfiguration } from './PrivoConfiguration';
import { PrivoClientCredentials, PrivoStore } from './PrivoStore';
import { Client, Issuer, TokenSet } from 'openid-client';
import { v4 as uuid } from 'uuid';
import axios, { AxiosRequestHeaders } from 'axios';
import { DateTime } from 'luxon';

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
}

/**
 * Defines a class that implements PrivoClientInterface.
 */
export class PrivoClient implements PrivoClientInterface {
    private _store: PrivoStore;
    private _config: ConfigurationStore;
    private _issuer: Issuer<Client>;
    private _openid: Client;

    constructor(store: PrivoStore, configStore: ConfigurationStore) {
        this._store = store;
        this._config = configStore;
    }

    async init(): Promise<void> {
        const config = await this._config.getPrivoConfiguration();
        this._issuer = await Issuer.discover(config.publicEndpoint);
        this._openid = new this._issuer.Client({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            redirect_uris: [config.redirectUri],
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
        const url = `${config.publicEndpoint}/api/v1.0/account/parent`;
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
                        birth_date_yyymmdd: DateTime.fromJSDate(
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

        console.log('privo data', data);

        return {
            parentServiceId: data.to.service_id,
            childServiceId: data.to.connected_profiles[0].service_id,
            updatePasswordLink:
                data.to.connected_profiles[0].update_password_link,
            features: data.to.connected_profiles[0].features.map((f: any) => ({
                featureId: f.feature_identifier,
                on: f.on === true || f.on === 'true',
            })),
        };
    }

    async createAdultAccount(
        request: CreateAdultAccountRequest
    ): Promise<CreateAdultAccountResponse> {
        throw new Error('Method not implemented.');
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
                scope: config.tokenScopes,
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
