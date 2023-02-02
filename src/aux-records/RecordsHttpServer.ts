import { getStatusCode, tryParseJson } from './Utils';
import {
    AuthController,
    INVALID_KEY_ERROR_MESSAGE,
    ValidateSessionKeyResult,
} from './AuthController';
import { parseSessionKey } from './AuthUtils';

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

const NOT_LOGGED_IN_RESULT = {
    success: false,
    errorCode: 'not_logged_in',
    errorMessage:
        'The user is not logged in. A session key must be provided for this operation.',
};

const UNACCEPTABLE_SESSION_KEY = {
    success: false,
    errorCode: 'unacceptable_session_key',
    errorMessage: INVALID_KEY_ERROR_MESSAGE,
};

const INVALID_ORIGIN_RESULT = {
    success: false,
    errorCode: 'invalid_origin',
    errorMessage: 'The request must be made from an authorized origin.',
};

const OPERATION_NOT_FOUND_RESULT = {
    success: false,
    errorCode: 'operation_not_found',
    errorMessage: 'An operation could not be found for the given request.',
};

const UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON = {
    success: false,
    errorCode: 'unacceptable_request',
    errorMessage:
        'The request body was not properly formatted. It should be valid JSON.',
};

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
            !!request.pathParams.userId
        ) {
            return this._getUserInfo(request);
        } else if (
            request.method === 'PUT' &&
            request.path.startsWith('/api/') &&
            request.path.endsWith('/metadata') &&
            !!request.pathParams.userId
        ) {
            return this._putUserInfo(request);
        } else if (
            request.method === 'GET' &&
            request.path === '/api/emailRules'
        ) {
            return this._getEmailRules(request);
        } else if (
            request.method === 'GET' &&
            request.path === '/api/smsRules'
        ) {
            return this._getSmsRules(request);
        } else if (
            request.method === 'GET' &&
            request.path === '/api/v2/sessions'
        ) {
            return this._getSessions(request);
        }

        return returnResult(OPERATION_NOT_FOUND_RESULT);
    }

    private async _getSessions(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedAccountOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        const expireTime = request.query.expireTimeMs;
        const expireTimeMs = !!expireTime ? parseInt(expireTime) : null;
        const sessionKey = getSessionKey(request);

        if (!sessionKey) {
            return returnResult(NOT_LOGGED_IN_RESULT);
        }

        const parsed = parseSessionKey(sessionKey);

        if (!parsed) {
            return returnResult(UNACCEPTABLE_SESSION_KEY);
        }

        const [userId] = parsed;

        const result = await this._auth.listSessions({
            userId,
            sessionKey,
            expireTimeMs,
        });

        return returnResult(result);
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
                `getUserInfo only accept GET method, you tried: ${request.method}`
            );
        }

        if (!validateOrigin(request, this._allowedAccountOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        const sessionKey = getSessionKey(request);

        if (!sessionKey) {
            return returnResult(NOT_LOGGED_IN_RESULT);
        }

        const result = await this._auth.getUserInfo({
            sessionKey: sessionKey,
            userId: request.pathParams.userId,
        });

        if (!result.success) {
            return returnResult(result);
        }

        return returnResult({
            success: true,
            name: result.name,
            avatarUrl: result.avatarUrl,
            avatarPortraitUrl: result.avatarPortraitUrl,
            email: result.email,
            phoneNumber: result.phoneNumber,
        });
    }

    private async _putUserInfo(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (request.method !== 'PUT') {
            throw new Error(
                `putUserInfo only accept PUT method, you tried: ${request.method}`
            );
        }

        if (!validateOrigin(request, this._allowedAccountOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        const sessionKey = getSessionKey(request);

        if (!sessionKey) {
            return returnResult(NOT_LOGGED_IN_RESULT);
        }

        if (typeof request.body !== 'string') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const jsonResult = tryParseJson(request.body);

        if (!jsonResult.success) {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const result = await this._auth.updateUserInfo({
            sessionKey: sessionKey,
            userId: request.pathParams.userId,
            update: jsonResult.value,
        });

        if (!result.success) {
            return returnResult(result);
        }

        return returnResult({
            success: true,
            userId: result.userId,
        });
    }

    private async _getEmailRules(request: GenericHttpRequest) {
        const result = await this._auth.listEmailRules();

        if (!result.success) {
            return returnResult(result);
        }

        return {
            statusCode: 200,
            body: JSON.stringify(
                result.rules.map((rule) => ({
                    type: rule.type,
                    pattern: rule.pattern,
                }))
            ),
        };
    }

    private async _getSmsRules(request: GenericHttpRequest) {
        const result = await this._auth.listSmsRules();

        if (!result.success) {
            return returnResult(result);
        }

        return {
            statusCode: 200,
            body: JSON.stringify(
                result.rules.map((rule) => ({
                    type: rule.type,
                    pattern: rule.pattern,
                }))
            ),
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

export function returnResult<
    T extends { success: false; errorCode: string } | { success: true }
>(result: T): GenericHttpResponse {
    return {
        statusCode: getStatusCode(result),
        body: JSON.stringify(result),
    };
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
