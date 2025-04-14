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
import type { APIGatewayProxyEvent } from 'aws-lambda';
import type {
    AuthController,
    ValidateSessionKeyResult,
} from '@casual-simulation/aux-records/AuthController';
import { allowedOrigins } from '../../../shared/EnvUtils';

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
