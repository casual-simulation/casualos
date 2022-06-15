import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { Magic } from '@magic-sdk/admin';

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
    if (response.success === false && response.errorCode === 'not_logged_in') {
        return 401;
    } else if (
        response.success === false &&
        response.errorCode === 'not_supported'
    ) {
        return 501;
    } else if (response.success === false) {
        return 400;
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
 * Parses the given authorization header and returns the ID of the user.
 * Returns null if the authorization header is invalid.
 * @param magic The magic.link client.
 * @param authorization The authorization header value.
 */
export function parseAuthorization(magic: Magic, authorization: string) {
    if (
        typeof authorization === 'string' &&
        authorization.startsWith('Bearer ')
    ) {
        const authToken = authorization.substring('Bearer '.length);
        const issuer = magic.token.getIssuer(authToken);
        return issuer;
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
