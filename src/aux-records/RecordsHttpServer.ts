import { getStatusCode } from './Utils';
import { AuthController, ValidateSessionKeyResult } from './AuthController';

/**
 * Defines an interface for a generic HTTP request.
 */
export interface GenericHttpRequest {
    /**
     * The path that the HTTP request is for.
     * Does not include the query string parameters.
     */
    path: string;

    /**
     * The query string parameters.
     */
    query: GenericQueryStringParameters;

    /**
     * The path parameters.
     * i.e. These are parameters that are calculated from the path of the
     */
    pathParams: GenericPathParameters;

    /**
     * The method that the HTTP request uses.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods
     */
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD';

    /**
     * The headers for the request.
     */
    headers: GenericHttpHeaders;

    /**
     * The body of the HTTP request.
     */
    body: string | Uint8Array | null;
}

/**
 * Defines an interface for a generic HTTP response.
 */
export interface GenericHttpResponse {
    /**
     * The status code for the response.
     * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status
     *
     */
    statusCode: number;

    /**
     * The list of headers to include in the response.
     */
    headers?: GenericHttpHeaders;

    /**
     * The body of the response.
     */
    body?: string | null;
}

export interface GenericHttpHeaders {
    [key: string]: string;
}

export interface GenericQueryStringParameters {
    [key: string]: string;
}

export interface GenericPathParameters {
    [key: string]: string;
}

/**
 * Defines a class that represents a generic HTTP server suitable for Records HTTP Requests.
 */
export class RecordsHttpServer {
    private _auth: AuthController;

    /**
     * The set of origins that are allowed for API requests.
     */
    private _allowedApiOrigins: Set<string>;

    /**
     * The set of origins that are allowed for account management requests.
     */
    private _allowedAccountOrigins: Set<string>;

    constructor(
        allowedAccountOrigins: Set<string>,
        allowedApiOrigins: Set<string>,
        authController: AuthController
    ) {
        this._allowedAccountOrigins = allowedAccountOrigins;
        this._allowedApiOrigins = allowedApiOrigins;
        this._auth = authController;
    }

    /**
     * Handles the given request and returns the specified response.
     * @param request The request that should be handled.
     */
    async handleRequest(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (
            request.method === 'GET' &&
            request.path.startsWith('/api/') &&
            request.path.endsWith('/metadata') &&
            !!request.pathParams.token
        ) {
            return this._getUserInfo(request);
        }

        return null;
    }

    /**
     * Endpoint to retrieve info about a user.
     * @param request The request.
     */
    private async _getUserInfo(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (request.method !== 'GET') {
            throw new Error(
                `getIssuerMetadata only accept GET method, you tried: ${request.method}`
            );
        }

        if (!validateOrigin(request, this._allowedAccountOrigins)) {
            return {
                statusCode: 403,
                body: 'Invalid origin.',
            };
        }

        const validation = await this._validateSessionKey(request);
        if (validation.success === false) {
            return {
                statusCode: getStatusCode(validation),
                body: JSON.stringify(validation),
            };
        }

        const issuer = decodeURIComponent(request.pathParams.token);

        if (validation.userId !== issuer) {
            return {
                statusCode: 403,
                body: JSON.stringify({
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage: 'You are not authorized.',
                }),
            };
        }

        // get all items from the table (only first 1MB data, you can use `LastEvaluatedKey` to get the rest of data)
        // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB/DocumentClient.html#scan-property
        // https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Scan.html
        const data = await docClient
            .get({
                TableName: USERS_TABLE,
                Key: { id: issuer },
            })
            .promise();
        const item = data.Item;

        if (!item) {
            return {
                statusCode: 404,
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                name: item.name,
                avatarUrl: item.avatarUrl,
                avatarPortraitUrl: item.avatarPortraitUrl,
                email: item.email,
                phoneNumber: item.phoneNumber,
            }),
        };
    }

    private async _validateSessionKey(
        event: GenericHttpRequest
    ): Promise<ValidateSessionKeyResult | NoSessionKeyResult> {
        const sessionKey = getSessionKey(event);
        if (!sessionKey) {
            return {
                success: false,
                userId: null,
                errorCode: 'no_session_key',
                errorMessage:
                    'A session key was not provided, but it is required for this operation.',
            };
        }
        return await this._auth.validateSessionKey(sessionKey);
    }
}

/**
 * Validates that the given request comes from one of the specified allowed origins.
 * Returns true if the request has an "origin" header set to one of the allowed origins. Returns false otherwise.
 * @param request The request.
 * @param origins The allowed origins.
 */
export function validateOrigin(
    request: GenericHttpRequest,
    origins: Set<string>
): boolean {
    const origin = request.headers.origin;
    return (
        origins.has(origin) ||
        // If the origin is not included, then the request is a same-origin request
        // if the method is either GET or HEAD.
        (!origin && (request.method === 'GET' || request.method === 'HEAD'))
    );
}

/**
 * Gets the session key from the given HTTP Request. Returns null if no session key was included.
 * @param event The event.
 */
export function getSessionKey(event: GenericHttpRequest): string {
    const authorization = event.headers.authorization;
    return parseAuthorization(authorization);
}

/**
 * Parses the given authorization header and returns the bearer value.
 * Returns null if the authorization header is invalid.
 * @param authorization The authorization header value.
 */
export function parseAuthorization(authorization: string): string {
    if (
        typeof authorization === 'string' &&
        authorization.startsWith('Bearer ')
    ) {
        const authToken = authorization.substring('Bearer '.length);
        return authToken;
    }
    return null;
}

export interface NoSessionKeyResult {
    success: false;
    userId: null;
    errorCode: 'no_session_key';
    errorMessage: string;
}
