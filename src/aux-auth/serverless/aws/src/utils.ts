import type { APIGatewayProxyEvent } from 'aws-lambda';
import {
    AuthController,
    ValidateSessionKeyResult,
} from '@casual-simulation/aux-records/AuthController';
import { ConsoleAuthMessenger } from '@casual-simulation/aux-records/ConsoleAuthMessenger';
import {
    DynamoDBAuthStore,
    TextItAuthMessenger,
} from '@casual-simulation/aux-records-aws';
import { AuthMessenger } from '@casual-simulation/aux-records/AuthMessenger';

export const allowedOrigins = new Set([
    'http://localhost:3002',
    'https://casualos.me',
    'https://ab1.link',
    ...getAllowedOrigins(),
]);

export function findHeader(request: APIGatewayProxyEvent, header: string) {
    let headerKey = Object.keys(request.headers).find(
        (key) => key.toLowerCase() === header.toLowerCase()
    );
    if (headerKey) {
        return request.headers[headerKey];
    }
    return undefined;
}

export function validateOrigin(
    request: APIGatewayProxyEvent,
    origins = allowedOrigins
) {
    const origin = findHeader(request, 'origin');
    return (
        origins.has(origin) ||
        // If the origin is not included, then the request is a same-origin request
        // if the method is either GET or HEAD.
        (!origin &&
            (request.httpMethod === 'GET' || request.httpMethod === 'HEAD'))
    );
}

export function formatStatusCode(
    response: { success: false; errorCode: string } | { success: true }
) {
    if (response.success === false) {
        if (response.errorCode === 'not_logged_in') {
            return 401;
        } else if (response.errorCode === 'not_supported') {
            return 501;
        } else if (response.errorCode === 'data_not_found') {
            return 404;
        } else if (response.errorCode === 'data_too_large') {
            return 400;
        } else if (response.errorCode === 'record_not_found') {
            return 404;
        } else if (response.errorCode === 'file_not_found') {
            return 404;
        } else if (response.errorCode === 'session_not_found') {
            return 404;
        } else if (response.errorCode === 'session_already_revoked') {
            return 200;
        } else if (response.errorCode === 'invalid_code') {
            return 403;
        } else if (response.errorCode === 'invalid_key') {
            return 403;
        } else if (response.errorCode === 'invalid_request') {
            return 403;
        } else if (response.errorCode === 'session_expired') {
            return 401;
        } else if (response.errorCode === 'unacceptable_address') {
            return 400;
        } else if (response.errorCode === 'unacceptable_user_id') {
            return 400;
        } else if (response.errorCode === 'unacceptable_code') {
            return 400;
        } else if (response.errorCode === 'unacceptable_session_key') {
            return 400;
        } else if (response.errorCode === 'unacceptable_session_id') {
            return 400;
        } else if (response.errorCode === 'unacceptable_request_id') {
            return 400;
        } else if (response.errorCode === 'unacceptable_ip_address') {
            return 500;
        } else if (response.errorCode === 'unacceptable_address_type') {
            return 400;
        } else if (response.errorCode === 'unacceptable_expire_time') {
            return 400;
        } else if (response.errorCode === 'address_type_not_supported') {
            return 501;
        } else if (response.errorCode === 'server_error') {
            return 500;
        } else {
            return 400;
        }
    }

    return 200;
}

export function formatResponse(
    request: APIGatewayProxyEvent,
    response: any,
    origins: Set<string> | boolean = allowedOrigins
) {
    const origin = findHeader(request, 'origin');
    let headers = {} as any;
    if (
        origins === true ||
        (typeof origins === 'object' && validateOrigin(request, origins))
    ) {
        headers['Access-Control-Allow-Origin'] = origin;
        headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    }

    return {
        ...response,
        headers,
    };
}

export function getAuthController(docClient: any): AuthController {
    const USERS_TABLE = process.env.USERS_TABLE;
    const USER_ADDRESSES_TABLE = process.env.USER_ADDRESSES_TABLE;
    const LOGIN_REQUESTS_TABLE = process.env.LOGIN_REQUESTS_TABLE;
    const SESSIONS_TABLE = process.env.SESSIONS_TABLE;

    const authStore = new DynamoDBAuthStore(
        docClient,
        USERS_TABLE,
        USER_ADDRESSES_TABLE,
        LOGIN_REQUESTS_TABLE,
        SESSIONS_TABLE,
        'ExpireTimeIndex'
    );

    const messenger = getAuthMessenger();

    return new AuthController(authStore, messenger);
}

function getAuthMessenger(): AuthMessenger {
    const API_KEY = process.env.TEXT_IT_API_KEY;
    const FLOW_ID = process.env.TEXT_IT_FLOW_ID;

    if (API_KEY && FLOW_ID) {
        console.log('[utils] Using TextIt Auth Messenger.');
        return new TextItAuthMessenger(API_KEY, FLOW_ID);
    } else {
        console.log('[utils] Using Console Auth Messenger.');
        return new ConsoleAuthMessenger();
    }
}

export interface NoSessionKeyResult {
    success: false;
    userId: null;
    errorCode: 'no_session_key';
    errorMessage: string;
}

/**
 * Validates the session key contained in the given event and returns the validation result.
 * @param event The event that the session key should be retrieved from.
 * @param auth The auth controller that should be used to validate the session key.
 */
export async function validateSessionKey(
    event: APIGatewayProxyEvent,
    auth: AuthController
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
    return await auth.validateSessionKey(sessionKey);
}

/**
 * Gets the session key from the authorization header contained in the given event.
 * Returns null if there is no valid session key.
 * @param event The event that the header should be pulled from.
 */
export function getSessionKey(event: APIGatewayProxyEvent) {
    const authorization = findHeader(event, 'authorization');
    return parseAuthorization(authorization);
}

/**
 * Parses the given authorization header and returns the bearer value.
 * Returns null if the authorization header is invalid.
 * @param authorization The authorization header value.
 */
export function parseAuthorization(authorization: string) {
    if (
        typeof authorization === 'string' &&
        authorization.startsWith('Bearer ')
    ) {
        const authToken = authorization.substring('Bearer '.length);
        return authToken;
    }
    return null;
}

/**
 * Gets the list of API origins that are allowed to make requests.
 */
export function getAllowedAPIOrigins(): string[] {
    const origins = process.env.ALLOWED_API_ORIGINS;
    if (origins) {
        const values = origins.split(' ');
        return values.filter((v) => !!v);
    }

    return [];
}

/**
 * Gets the list of API origins that are allowed to make requests.
 */
function getAllowedOrigins(): string[] {
    const origins = process.env.ALLOWED_ORIGINS;
    if (origins) {
        const values = origins.split(' ');
        return values.filter((v) => !!v);
    }

    return [];
}
