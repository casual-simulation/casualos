import { GenericQueryStringParameters } from './GenericHttpInterface';

/**
 * Defines an interface that represents an OpenID provider.
 * That is, an integration with a particular OpenID service.
 */
export interface OpenIDProvider {
    /**
     * Constructs an authorization URL for the given options.
     * After construction, the user should be redirected to the resulting URL to initiate the authorization flow.
     * @param options The options for the URL.
     */
    constructAuthorizationUrl(
        options: OpenIDAuthorizationUrlOptions
    ): Promise<OpenIDAuthorizationUrlResult>;

    /**
     * Processes the callback from the OpenID provider. This should be called after the user has been redirected back to the site.
     * @param options The options.
     */
    processCallback(
        options: OpenIDProcessCallbackOptions
    ): Promise<OpenIDProcessCallbackResult>;

    /**
     * Gets the user info for the given access token.
     * @param accessToken The access token.
     */
    getUserInfo(accessToken: string): Promise<OpenIDUserInfo>;

    /**
     * Requests a new access token using the client credentials flow.
     * @param options The options for the flow.
     */
    requestClientCredentials(
        options: OpenIDClientCredentialsOptions
    ): Promise<OpenIDClientCredentialsResult>;
}

export interface OpenIDAuthorizationUrlOptions {
    /**
     * The scope that should be requested.
     */
    scope: string;

    /**
     * The state that should be sent with the authorization URL.
     */
    state?: string;

    /**
     * The login hint that should be sent with the authorization URL.
     */
    login_hint?: string;
}

export interface OpenIDAuthorizationUrlResult {
    url: string;
    redirectUri: string;
    codeVerifier: string;
    codeMethod: string;
}

export interface OpenIDProcessCallbackOptions {
    redirectUri: string;
    query: GenericQueryStringParameters;
    codeVerifier: string;
}

export interface OpenIDTokenResult {
    /**
     * The access token that was granted.
     */
    accessToken: string;

    /**
     * The type of token that was granted.
     */
    tokenType: string;

    /**
     * The ID token that was granted.
     */
    idToken: string;

    /**
     * The refresh token that was granted.
     */
    refreshToken: string;

    /**
     * The number of seconds until the access token expires.
     */
    expiresIn: number;

    /**
     * The scope of the token.
     */
    scope: string;
}

export interface OpenIDProcessCallbackResult extends OpenIDTokenResult {}

export interface OpenIDUserInfo {
    sub: string;
    name?: string;
    givenName?: string;
    familyName?: string;
    middleName?: string;
    nickname?: string;
    preferredUsername?: string;
    profile?: string;
    picure?: string;
}

export interface OpenIDClientCredentialsOptions {
    /**
     * The scope that should be requested.
     */
    scope: string;
}

export interface OpenIDClientCredentialsResult extends OpenIDTokenResult {}
