import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { Magic } from '@magic-sdk/admin';
import { AuthController } from '@casual-simulation/aux-records/AuthController';

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
    return origins.has(origin);
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
    if (origins === true || (origins instanceof Set && origins.has(origin))) {
        headers['Access-Control-Allow-Origin'] = origin;
        headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    }

    return {
        ...response,
        headers,
    };
}

/**
 * Validates the session key contained in the given event and returns the validation result.
 * @param event The event that the session key should be retrieved from.
 * @param auth The auth controller that should be used to validate the session key.
 */
export async function validateSessionKey(
    event: APIGatewayProxyEvent,
    auth: AuthController
) {
    const sessionKey = getSessionKey(event);
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
