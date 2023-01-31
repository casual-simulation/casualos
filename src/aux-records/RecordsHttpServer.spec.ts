import {
    GenericHttpHeaders,
    GenericHttpRequest,
    GenericPathParameters,
    GenericQueryStringParameters,
    parseAuthorization,
    RecordsHttpServer,
    validateOrigin,
    getSessionKey,
} from './RecordsHttpServer';
import { AuthController } from './AuthController';
import { MemoryAuthStore } from './MemoryAuthStore';
import { MemoryAuthMessenger } from './MemoryAuthMessenger';

describe('RecordsHttpServer', () => {
    let authStore: MemoryAuthStore;
    let authMessenger: MemoryAuthMessenger;
    let authController: AuthController;
    let server: RecordsHttpServer;
    let defaultHeaders: GenericHttpHeaders;
    let authenticatedHeaders: GenericHttpHeaders;

    let allowedAccountOrigins: Set<string>;
    let allowedApiOrigins: Set<string>;

    beforeEach(() => {
        allowedAccountOrigins = new Set(['https://account-origin.com']);

        allowedApiOrigins = new Set(['https://api-origin.com']);

        authStore = new MemoryAuthStore();
        authMessenger = new MemoryAuthMessenger();
        authController = new AuthController(authStore, authMessenger);
        server = new RecordsHttpServer(
            allowedAccountOrigins,
            allowedApiOrigins,
            authController
        );
        defaultHeaders = {
            origin: 'test.com',
        };
        authenticatedHeaders = {
            ...defaultHeaders,
        };
    });

    describe('GET /api/{token}/metadata', () => {
        let sessionKey: string;
        let userId: string;

        beforeEach(async () => {
            let requestResult = await authController.requestLogin({
                address: 'test@example.com',
                addressType: 'email',
                ipAddress: '123.456.789',
            });

            if (!requestResult.success) {
                throw new Error('Unable to request a login!');
            }

            const message = authMessenger.messages.find(
                (m) => m.address === 'test@example.com'
            );

            if (!message) {
                throw new Error('Message not found!');
            }

            const loginResult = await authController.completeLogin({
                code: message.code,
                ipAddress: '123.456.789',
                requestId: requestResult.requestId,
                userId: requestResult.userId,
            });

            if (!loginResult.success) {
                throw new Error('Unable to login!');
            }

            sessionKey = loginResult.sessionKey;
            userId = loginResult.userId;
            authenticatedHeaders['authorization'] = `Bearer ${sessionKey}`;
        });

        it('should return the metadata for the given token', async () => {
            const result = await server.handleRequest(
                httpGet(`/api/{token:${userId}}/metadata`, authenticatedHeaders)
            );

            expect(result).toEqual({
                statusCode: 200,
                body: JSON.stringify({
                    name: null,
                    avatarURL: null,
                    avatarPortraitUrl: null,
                    email: 'test@example.com',
                    phoneNumber: null,
                }),
            });
        });
    });

    function httpGet(
        url: string,
        headers: GenericHttpHeaders = defaultHeaders
    ): GenericHttpRequest {
        const { path, pathParams, query } = parseUrl(url);

        return {
            path,
            body: null,
            headers,
            pathParams,
            method: 'GET',
            query,
        };
    }
});

describe('validateOrigin()', () => {
    it('should return true if the request is from an allowed origin', () => {
        const origins = new Set([
            'https://test.com',
            'https://other.com',
            'https://example.com',
        ]);

        expect(
            validateOrigin(
                {
                    path: '/api/test',
                    method: 'POST',
                    body: null,
                    query: {},
                    pathParams: {},
                    headers: {
                        origin: 'https://example.com',
                    },
                },
                origins
            )
        ).toBe(true);
    });

    it('should return false if the request is not from an allowed origin', () => {
        const origins = new Set([
            'https://test.com',
            'https://other.com',
            'https://example.com',
        ]);

        expect(
            validateOrigin(
                {
                    path: '/api/test',
                    method: 'POST',
                    body: null,
                    query: {},
                    pathParams: {},
                    headers: {
                        origin: 'https://wrong.com',
                    },
                },
                origins
            )
        ).toBe(false);
    });

    it('should return true if the request has no origin header and is a GET request', () => {
        const origins = new Set([
            'https://test.com',
            'https://other.com',
            'https://example.com',
        ]);

        expect(
            validateOrigin(
                {
                    path: '/api/test',
                    method: 'GET',
                    body: null,
                    query: {},
                    pathParams: {},
                    headers: {},
                },
                origins
            )
        ).toBe(true);
    });

    it('should return true if the request has no origin header and is a HEAD request', () => {
        const origins = new Set([
            'https://test.com',
            'https://other.com',
            'https://example.com',
        ]);

        expect(
            validateOrigin(
                {
                    path: '/api/test',
                    method: 'HEAD',
                    body: null,
                    query: {},
                    pathParams: {},
                    headers: {},
                },
                origins
            )
        ).toBe(true);
    });

    it('should return false if the request has no origin header and is a POST request', () => {
        const origins = new Set([
            'https://test.com',
            'https://other.com',
            'https://example.com',
        ]);

        expect(
            validateOrigin(
                {
                    path: '/api/test',
                    method: 'POST',
                    body: null,
                    query: {},
                    pathParams: {},
                    headers: {},
                },
                origins
            )
        ).toBe(false);
    });
});

describe('getSessionKey()', () => {
    it('should return the session key from the authorization header', () => {
        expect(
            getSessionKey({
                path: '/api/test',
                method: 'POST',
                body: null,
                query: {},
                pathParams: {},
                headers: {
                    authorization: 'Bearer abc',
                },
            })
        ).toBe('abc');
    });

    it('should return null if there is no authorization header', () => {
        expect(
            getSessionKey({
                path: '/api/test',
                method: 'POST',
                body: null,
                query: {},
                pathParams: {},
                headers: {},
            })
        ).toBe(null);
    });

    it('should return null if the authorization header isnt formatted as a Bearer token', () => {
        expect(
            getSessionKey({
                path: '/api/test',
                method: 'POST',
                body: null,
                query: {},
                pathParams: {},
                headers: {
                    authorization: 'Wrong abc',
                },
            })
        ).toBe(null);
    });
});

describe('parseAuthorization()', () => {
    it('should return null if given null or undefined', () => {
        expect(parseAuthorization(null)).toBe(null);
        expect(parseAuthorization(undefined)).toBe(null);
    });

    it('should return null if the string doesnt start with Bearer', () => {
        expect(parseAuthorization('Wrong abc')).toBe(null);
    });

    it('should return token value from the Bearer token', () => {
        expect(parseAuthorization('Bearer abc')).toBe('abc');
    });
});

function validateNoError<T extends { success: boolean }>(result: T): T {
    expect(result).toMatchObject({
        success: true,
    });

    return result;
}

type Path = (string | PathParam)[];

function parseUrl(url: string): {
    path: string;
    query: GenericQueryStringParameters;
    pathParams: GenericPathParameters;
} {
    let uri = new URL(url, 'http://example.com');

    const pathParams = parsePathParams(uri.pathname);
    const finalPath = pathParams
        .map((p) => (typeof p === 'string' ? p : p.value))
        .join('/');
    const params = getPathParams(pathParams);

    let query = {} as GenericQueryStringParameters;

    uri.searchParams.forEach((value, key) => {
        query[key] = value;
    });

    return {
        path: finalPath,
        pathParams: params,
        query,
    };
}

function parsePathParams(path: string | string[]): (string | PathParam)[] {
    if (typeof path === 'string') {
        return parsePathParams(path.split('/'));
    }
    let result = [] as (string | PathParam)[];
    for (let segment of path) {
        if (segment.startsWith('{') && segment.endsWith('}')) {
            let splitPoint = segment.indexOf(':');
            let name = segment.slice(1, splitPoint);
            let value = segment.slice(splitPoint + 1, segment.length - 1);
            result.push({
                name,
                value,
            });
        } else {
            result.push(segment);
        }
    }
}

function getPathParams(path: (string | PathParam)[]) {
    let result = {} as GenericPathParameters;
    for (let p of path) {
        if (typeof p === 'string') {
            continue;
        }
        result[p.name] = p.value;
    }

    return result;
}

interface PathParam {
    value: string;
    name: string;
}
