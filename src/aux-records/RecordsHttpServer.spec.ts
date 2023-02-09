import {
    GenericHttpHeaders,
    GenericHttpRequest,
    GenericPathParameters,
    GenericQueryStringParameters,
    parseAuthorization,
    RecordsHttpServer,
    validateOrigin,
    getSessionKey,
    GenericHttpResponse,
} from './RecordsHttpServer';
import { AuthController, INVALID_KEY_ERROR_MESSAGE } from './AuthController';
import { MemoryAuthStore } from './MemoryAuthStore';
import { MemoryAuthMessenger } from './MemoryAuthMessenger';
import { formatV1SessionKey, parseSessionKey } from './AuthUtils';
import { AuthSession } from './AuthStore';
import { LivekitController } from './LivekitController';
import { RecordsController } from './RecordsController';
import { RecordsStore } from './RecordsStore';
import { MemoryRecordsStore } from './MemoryRecordsStore';
import { EventRecordsController } from './EventRecordsController';
import { EventRecordsStore } from './EventRecordsStore';
import { MemoryEventRecordsStore } from './MemoryEventRecordsStore';

console.log = jest.fn();

describe('RecordsHttpServer', () => {
    let authStore: MemoryAuthStore;
    let authMessenger: MemoryAuthMessenger;
    let authController: AuthController;
    let server: RecordsHttpServer;
    let defaultHeaders: GenericHttpHeaders;
    let authenticatedHeaders: GenericHttpHeaders;
    let apiHeaders: GenericHttpHeaders;
    let livekitController: LivekitController;
    let recordsController: RecordsController;
    let recordsStore: RecordsStore;
    let eventsController: EventRecordsController;
    let eventsStore: EventRecordsStore;

    let allowedAccountOrigins: Set<string>;
    let allowedApiOrigins: Set<string>;
    let sessionKey: string;
    let userId: string;
    let sessionId: string;
    let expireTimeMs: number;
    let sessionSecret: string;
    let recordKey: string;

    const livekitEndpoint: string = 'https://livekit-endpoint.com';
    const livekitApiKey: string = 'livekit_api_key';
    const livekitSecretKey: string = 'livekit_secret_key';
    const accountCorsHeaders = {
        'Access-Control-Allow-Origin': 'https://account-origin.com',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    const apiCorsHeaders = {
        'Access-Control-Allow-Origin': 'https://api-origin.com',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    const accountOrigin = 'https://account-origin.com';
    const apiOrigin = 'https://api-origin.com';
    const recordName = 'testRecord';

    beforeEach(async () => {
        allowedAccountOrigins = new Set([accountOrigin]);

        allowedApiOrigins = new Set([apiOrigin]);

        authStore = new MemoryAuthStore();
        authMessenger = new MemoryAuthMessenger();
        authController = new AuthController(authStore, authMessenger);
        livekitController = new LivekitController(
            livekitApiKey,
            livekitSecretKey,
            livekitEndpoint
        );

        recordsStore = new MemoryRecordsStore();
        recordsController = new RecordsController(recordsStore);

        eventsStore = new MemoryEventRecordsStore();
        eventsController = new EventRecordsController(
            recordsController,
            eventsStore
        );

        server = new RecordsHttpServer(
            allowedAccountOrigins,
            allowedApiOrigins,
            authController,
            livekitController,
            recordsController,
            eventsController
        );
        defaultHeaders = {
            origin: 'test.com',
        };
        authenticatedHeaders = {
            ...defaultHeaders,
        };
        apiHeaders = {
            ...defaultHeaders,
        };

        authenticatedHeaders['origin'] = accountOrigin;
        apiHeaders['origin'] = apiOrigin;
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

        let [uid, sid, secret, expire] = parseSessionKey(sessionKey);
        sessionId = sid;
        sessionSecret = secret;
        expireTimeMs = expire;

        apiHeaders['authorization'] = authenticatedHeaders[
            'authorization'
        ] = `Bearer ${sessionKey}`;

        const recordKeyResult = await recordsController.createPublicRecordKey(
            recordName,
            'subjectfull',
            userId
        );
        if (!recordKeyResult.success) {
            throw new Error('Unable to create record key!');
        }

        recordKey = recordKeyResult.recordKey;
    });

    describe('GET /api/{token}/metadata', () => {
        it('should return the metadata for the given token', async () => {
            const result = await server.handleRequest(
                httpGet(
                    `/api/{userId:${userId}}/metadata`,
                    authenticatedHeaders
                )
            );

            expect(result).toEqual({
                statusCode: 200,
                body: JSON.stringify({
                    success: true,
                    email: 'test@example.com',
                    phoneNumber: null,
                }),
                headers: accountCorsHeaders,
            });
        });

        it('should return a 403 status code if the origin is invalid', async () => {
            authenticatedHeaders['origin'] = 'https://wrong.origin.com';
            const result = await server.handleRequest(
                httpGet(
                    `/api/{userId:${userId}}/metadata`,
                    authenticatedHeaders
                )
            );

            expect(result).toEqual({
                statusCode: 403,
                body: JSON.stringify({
                    success: false,
                    errorCode: 'invalid_origin',
                    errorMessage:
                        'The request must be made from an authorized origin.',
                }),
                headers: {},
            });
        });

        it('should return a 403 status code if the session key is invalid', async () => {
            authenticatedHeaders[
                'authorization'
            ] = `Bearer ${formatV1SessionKey(
                'wrong user',
                'wrong session',
                'wrong secret',
                1000
            )}`;
            const result = await server.handleRequest(
                httpGet(
                    `/api/{userId:${userId}}/metadata`,
                    authenticatedHeaders
                )
            );

            expect(result).toEqual({
                statusCode: 403,
                body: JSON.stringify({
                    success: false,
                    errorCode: 'invalid_key',
                    errorMessage: INVALID_KEY_ERROR_MESSAGE,
                }),
                headers: accountCorsHeaders,
            });
        });

        it('should return a 401 status code if no session key is provided', async () => {
            delete authenticatedHeaders['authorization'];
            const result = await server.handleRequest(
                httpGet(
                    `/api/{userId:${userId}}/metadata`,
                    authenticatedHeaders
                )
            );

            expect(result).toEqual({
                statusCode: 401,
                body: JSON.stringify({
                    success: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user is not logged in. A session key must be provided for this operation.',
                }),
                headers: accountCorsHeaders,
            });
        });

        it('should return a 400 status code if the session key is wrongly formatted', async () => {
            authenticatedHeaders['authorization'] = `Bearer wrong`;
            const result = await server.handleRequest(
                httpGet(
                    `/api/{userId:${userId}}/metadata`,
                    authenticatedHeaders
                )
            );

            expect(result).toEqual({
                statusCode: 400,
                body: JSON.stringify({
                    success: false,
                    errorCode: 'unacceptable_session_key',
                    errorMessage:
                        'The given session key is invalid. It must be a correctly formatted string.',
                }),
                headers: accountCorsHeaders,
            });
        });
    });

    describe('PUT /api/{userId}/metadata', () => {
        it('should update the metadata for the given userId', async () => {
            const result = await server.handleRequest(
                httpPut(
                    `/api/{userId:${userId}}/metadata`,
                    JSON.stringify({
                        name: 'Kal',
                    }),
                    authenticatedHeaders
                )
            );

            expect(result).toEqual({
                statusCode: 200,
                body: JSON.stringify({
                    success: true,
                    userId,
                }),
                headers: accountCorsHeaders,
            });
        });

        testOrigin('PUT', `/api/{userId:${userId}}/metadata`, () =>
            JSON.stringify({
                name: 'Kal',
            })
        );
        testAuthorization(() =>
            httpPut(
                `/api/{userId:${userId}}/metadata`,
                JSON.stringify({
                    name: 'Kal',
                }),
                authenticatedHeaders
            )
        );
        testBodyIsJson((body) =>
            httpPut(
                `/api/{userId:${userId}}/metadata`,
                body,
                authenticatedHeaders
            )
        );
    });

    describe('GET /api/emailRules', () => {
        it('should get the list of email rules', async () => {
            authStore.emailRules.push(
                {
                    type: 'allow',
                    pattern: 'hello',
                },
                {
                    type: 'deny',
                    pattern: 'other',
                }
            );

            const result = await server.handleRequest(
                httpGet(`/api/emailRules`, defaultHeaders)
            );

            expect(result).toEqual({
                statusCode: 200,
                body: JSON.stringify([
                    {
                        type: 'allow',
                        pattern: 'hello',
                    },
                    {
                        type: 'deny',
                        pattern: 'other',
                    },
                ]),
                headers: {},
            });
        });
    });

    describe('GET /api/smsRules', () => {
        it('should get the list of sms rules', async () => {
            authStore.smsRules.push(
                {
                    type: 'allow',
                    pattern: 'hello',
                },
                {
                    type: 'deny',
                    pattern: 'other',
                }
            );

            const result = await server.handleRequest(
                httpGet(`/api/smsRules`, defaultHeaders)
            );

            expect(result).toEqual({
                statusCode: 200,
                body: JSON.stringify([
                    {
                        type: 'allow',
                        pattern: 'hello',
                    },
                    {
                        type: 'deny',
                        pattern: 'other',
                    },
                ]),
                headers: {},
            });
        });
    });

    describe('GET /api/v2/sessions', () => {
        it('should return the list of sessions for the user', async () => {
            const result = await server.handleRequest(
                httpGet(`/api/v2/sessions`, authenticatedHeaders)
            );

            expect(result).toEqual({
                statusCode: 200,
                body: expect.any(String),
                headers: accountCorsHeaders,
            });

            expect(JSON.parse(result.body as string)).toEqual({
                success: true,
                sessions: [
                    {
                        userId: userId,
                        sessionId: sessionId,
                        grantedTimeMs: expect.any(Number),
                        expireTimeMs: expireTimeMs,
                        revokeTimeMs: null,
                        ipAddress: '123.456.789',
                        currentSession: true,
                        nextSessionId: null,
                    },
                ],
            });
        });

        it('should use the expireTimeMs query parameter', async () => {
            const result = await server.handleRequest(
                httpGet(
                    `/api/v2/sessions?expireTimeMs=${expireTimeMs}`,
                    authenticatedHeaders
                )
            );

            expect(result).toEqual({
                statusCode: 200,
                body: expect.any(String),
                headers: accountCorsHeaders,
            });

            expect(JSON.parse(result.body as string)).toEqual({
                success: true,
                sessions: [],
            });
        });

        testOrigin('GET', '/api/v2/sessions');
        testAuthorization(() =>
            httpGet('/api/v2/sessions', authenticatedHeaders)
        );
    });

    describe('POST /api/v2/replaceSession', () => {
        it('should replace the current session', async () => {
            const result = await server.handleRequest(
                httpPost(
                    `/api/v2/replaceSession`,
                    '',
                    authenticatedHeaders,
                    '999.999.999.999'
                )
            );

            expect(result).toEqual({
                statusCode: 200,
                body: expect.any(String),
                headers: accountCorsHeaders,
            });

            let data = JSON.parse(result.body as string);

            expect(data).toEqual({
                success: true,
                userId,
                sessionKey: expect.any(String),
                expireTimeMs: expect.any(Number),
            });

            const parsed = parseSessionKey(data.sessionKey);

            expect(parsed).not.toBe(null);

            const [uid, sid] = parsed;

            const session = await authStore.findSession(uid, sid);

            expect(session.ipAddress).toBe('999.999.999.999');

            const old = await authStore.findSession(userId, sessionId);
            expect(old.revokeTimeMs).toBeGreaterThanOrEqual(old.grantedTimeMs);
        });

        testOrigin('POST', '/api/v2/replaceSession', () => '');
        testAuthorization(() =>
            httpPost('/api/v2/replaceSession', '', authenticatedHeaders)
        );
    });

    describe('POST /api/v2/revokeAllSessions', () => {
        it('should revoke all the sessions', async () => {
            const result = await server.handleRequest(
                httpPost(
                    `/api/v2/revokeAllSessions`,
                    JSON.stringify({
                        userId,
                    }),
                    authenticatedHeaders
                )
            );

            expect(result).toEqual({
                statusCode: 200,
                body: JSON.stringify({
                    success: true,
                }),
                headers: accountCorsHeaders,
            });

            const user = await authStore.findUser(userId);
            expect(user.allSessionRevokeTimeMs).toBeGreaterThan(0);
        });

        testUrl('POST', '/api/v2/revokeAllSessions', () =>
            JSON.stringify({
                userId,
            })
        );
    });

    describe('POST /api/v2/revokeSession', () => {
        it('should revoke the given session ID for the given user', async () => {
            let session: AuthSession = await authStore.findSession(
                userId,
                sessionId
            );
            expect(session.revokeTimeMs).toBeNull();

            const result = await server.handleRequest(
                httpPost(
                    `/api/v2/revokeSession`,
                    JSON.stringify({
                        userId,
                        sessionId,
                    }),
                    authenticatedHeaders
                )
            );

            expect(result).toEqual({
                statusCode: 200,
                body: JSON.stringify({
                    success: true,
                }),
                headers: accountCorsHeaders,
            });

            session = await authStore.findSession(userId, sessionId);
            expect(session.revokeTimeMs).toBeGreaterThan(0);
        });

        it('should revoke the given session key', async () => {
            let session: AuthSession = await authStore.findSession(
                userId,
                sessionId
            );
            expect(session.revokeTimeMs).toBeNull();

            const result = await server.handleRequest(
                httpPost(
                    `/api/v2/revokeSession`,
                    JSON.stringify({
                        sessionKey,
                    }),
                    authenticatedHeaders
                )
            );

            expect(result).toEqual({
                statusCode: 200,
                body: JSON.stringify({
                    success: true,
                }),
                headers: accountCorsHeaders,
            });

            session = await authStore.findSession(userId, sessionId);
            expect(session.revokeTimeMs).toBeGreaterThan(0);
        });

        testUrl('POST', '/api/v2/revokeSession', () =>
            JSON.stringify({
                userId,
                sessionId,
            })
        );
    });

    describe('POST /api/v2/completeLogin', () => {
        let requestId: string;
        let code: string;
        beforeEach(async () => {
            const request = await authController.requestLogin({
                address: 'test@example.com',
                addressType: 'email',
                ipAddress: '123.456.789',
            });

            if (!request.success) {
                throw new Error('Unable to request login for user.');
            }

            requestId = request.requestId;

            const messages = authMessenger.messages.filter(
                (m) => m.address === 'test@example.com'
            );
            const message = messages[messages.length - 1];

            if (!message) {
                throw new Error('Message not found!');
            }

            code = message.code;
        });

        it('should return a session key after completing the login', async () => {
            const result = await server.handleRequest(
                httpPost(
                    `/api/v2/completeLogin`,
                    JSON.stringify({
                        userId,
                        requestId,
                        code,
                    }),
                    {
                        origin: 'https://account-origin.com',
                    }
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    userId,
                    sessionKey: expect.any(String),
                    expireTimeMs: expect.any(Number),
                },
                headers: accountCorsHeaders,
            });

            const data = JSON.parse(result.body as string);

            expect(parseSessionKey(data.sessionKey)).not.toBeNull();
            expect(data.expireTimeMs).toBeGreaterThan(0);
        });

        it('should return an invalid_code result if the code is wrong', async () => {
            const result = await server.handleRequest(
                httpPost(
                    `/api/v2/completeLogin`,
                    JSON.stringify({
                        userId,
                        requestId,
                        code: 'wrong',
                    }),
                    {
                        origin: 'https://account-origin.com',
                    }
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'invalid_code',
                    errorMessage: 'The code is invalid.',
                },
                headers: accountCorsHeaders,
            });
        });

        it('should return an invalid_request result if the request id is wrong', async () => {
            const result = await server.handleRequest(
                httpPost(
                    `/api/v2/completeLogin`,
                    JSON.stringify({
                        userId,
                        requestId: 'wrong',
                        code,
                    }),
                    {
                        origin: 'https://account-origin.com',
                    }
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: 'The login request is invalid.',
                },
                headers: accountCorsHeaders,
            });
        });

        testOrigin('POST', '/api/v2/completeLogin', () =>
            JSON.stringify({
                userId,
                requestId,
                code,
            })
        );
        testBodyIsJson((body) =>
            httpPost('/api/v2/completeLogin', body, authenticatedHeaders)
        );
    });

    describe('POST /api/v2/login', () => {
        it('should return a login request and send a auth message with the code', async () => {
            const result = await server.handleRequest(
                httpPost(
                    `/api/v2/login`,
                    JSON.stringify({
                        address: 'test@example.com',
                        addressType: 'email',
                    }),
                    {
                        origin: 'https://account-origin.com',
                    },
                    '123.456.789'
                )
            );

            expect(result).toEqual({
                statusCode: 200,
                body: expect.any(String),
                headers: accountCorsHeaders,
            });

            const data = JSON.parse(result.body as string);

            expect(data).toEqual({
                success: true,
                userId,
                requestId: expect.any(String),
                address: 'test@example.com',
                addressType: 'email',
                expireTimeMs: expect.any(Number),
            });

            const messages = authMessenger.messages.filter(
                (m) => m.address === 'test@example.com'
            );
            const lastMessage = messages[messages.length - 1];

            expect(lastMessage).not.toBeFalsy();

            const loginResult = await authController.completeLogin({
                code: lastMessage.code,
                ipAddress: '123.456.789',
                requestId: data.requestId,
                userId: data.userId,
            });

            expect(loginResult.success).toBe(true);
        });

        testOrigin('POST', '/api/v2/login', () =>
            JSON.stringify({
                address: 'test@example.com',
                addressType: 'email',
            })
        );
        testBodyIsJson((body) =>
            httpPost('/api/v2/login', body, authenticatedHeaders)
        );
    });

    describe('POST /api/v2/meet/token', () => {
        const roomName = 'test';
        const userName = 'userName';

        it('should create a new livekit token', async () => {
            const result = await server.handleRequest(
                httpPost(
                    `/api/v2/meet/token`,
                    JSON.stringify({
                        roomName,
                        userName,
                    }),
                    {
                        origin: 'https://api-origin.com',
                    }
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    roomName,
                    token: expect.any(String),
                    url: livekitEndpoint,
                },
                headers: apiCorsHeaders,
            });
        });

        testOrigin('POST', '/api/v2/meet/token', () =>
            JSON.stringify({
                roomName,
                userName,
            })
        );
        testBodyIsJson((body) =>
            httpPost('/api/v2/meet/token', body, {
                origin: apiOrigin,
            })
        );
    });

    describe('POST /api/v2/records/events/count', () => {
        it('should add to the record event count', async () => {
            const result = await server.handleRequest(
                httpPost(
                    `/api/v2/records/events/count`,
                    JSON.stringify({
                        recordKey,
                        eventName: 'testEvent',
                        count: 2,
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    eventName: 'testEvent',
                    countAdded: 2,
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request when given a non-string recordKey', async () => {
            const result = await server.handleRequest(
                httpPost(
                    `/api/v2/records/events/count`,
                    JSON.stringify({
                        recordKey: 123,
                        eventName: 'testEvent',
                        count: 2,
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 400,
                body: {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage: 'recordKey is required and must be a string.',
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request when given a non-string eventName', async () => {
            const result = await server.handleRequest(
                httpPost(
                    `/api/v2/records/events/count`,
                    JSON.stringify({
                        recordKey,
                        eventName: 123,
                        count: 2,
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 400,
                body: {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage: 'eventName is required and must be a string.',
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request when given a non-number count', async () => {
            const result = await server.handleRequest(
                httpPost(
                    `/api/v2/records/events/count`,
                    JSON.stringify({
                        recordKey,
                        eventName: 'testEvent',
                        count: 'abc',
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 400,
                body: {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage: 'count is required and must be a number.',
                },
                headers: apiCorsHeaders,
            });
        });

        testAuthorization(() =>
            httpPost(
                '/api/v2/records/events/count',
                JSON.stringify({
                    recordKey,
                    eventName: 'testEvent',
                    count: 2,
                }),
                apiHeaders
            )
        );
        testOrigin('POST', '/api/v2/records/events/count', () =>
            JSON.stringify({
                recordKey,
                eventName: 'testEvent',
                count: 2,
            })
        );
        testBodyIsJson((body) =>
            httpPost('/api/v2/records/events/count', body, apiHeaders)
        );
    });

    describe('GET /api/v2/records/events/count', () => {
        beforeEach(async () => {
            await eventsController.addCount(recordKey, 'testEvent', 5, userId);

            delete apiHeaders['authorization'];
        });

        it('should get the current record event count', async () => {
            const result = await server.handleRequest(
                httpGet(
                    `/api/v2/records/events/count?recordName=${recordName}&eventName=${'testEvent'}`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    eventName: 'testEvent',
                    count: 5,
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return 0 when the event name doesnt exist', async () => {
            const result = await server.handleRequest(
                httpGet(
                    `/api/v2/records/events/count?recordName=${recordName}&eventName=${'missing'}`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    eventName: 'missing',
                    count: 0,
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request result if recordName is omitted', async () => {
            const result = await server.handleRequest(
                httpGet(
                    `/api/v2/records/events/count?eventName=${'testEvent'}`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 400,
                body: {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage:
                        'recordName is required and must be a string.',
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request result if eventName is omitted', async () => {
            const result = await server.handleRequest(
                httpGet(
                    `/api/v2/records/events/count?recordName=${recordName}`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 400,
                body: {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage: 'eventName is required and must be a string.',
                },
                headers: apiCorsHeaders,
            });
        });

        testOrigin(
            'GET',
            `/api/v2/records/events/count?recordName=recordName&eventName=testEvent`
        );
    });

    it('should return a 404 status code when accessing an endpoint that doesnt exist', async () => {
        const result = await server.handleRequest(
            httpRequest('GET', `/api/missing`, null)
        );

        expect(result).toEqual({
            statusCode: 404,
            body: JSON.stringify({
                success: false,
                errorCode: 'operation_not_found',
                errorMessage:
                    'An operation could not be found for the given request.',
            }),
            headers: {
                'Access-Control-Allow-Origin': 'test.com',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        });
    });

    function expectResponseBodyToEqual(
        response: GenericHttpResponse,
        expected: any
    ) {
        const json = JSON.parse(response.body as string);

        expect({
            ...response,
            body: json,
        }).toEqual(expected);
    }

    function testUrl(
        method: GenericHttpRequest['method'],
        url: string,
        createBody: () => string
    ) {
        testOrigin(method, url, createBody);
        testAuthorization(() =>
            httpRequest(method, url, createBody(), authenticatedHeaders)
        );
        testBodyIsJson((body) =>
            httpRequest(method, url, body, authenticatedHeaders)
        );
    }

    function testOrigin(
        method: GenericHttpRequest['method'],
        url: string,
        createBody: () => string | null = () => null
    ) {
        it('should return a 403 status code if the request is made from a non-account origin', async () => {
            const result = await server.handleRequest(
                httpRequest(method, url, createBody(), defaultHeaders)
            );

            expect(result).toEqual({
                statusCode: 403,
                body: JSON.stringify({
                    success: false,
                    errorCode: 'invalid_origin',
                    errorMessage:
                        'The request must be made from an authorized origin.',
                }),
                headers: {},
            });
        });
    }

    function testAuthorization(
        getRequest: () => GenericHttpRequest
        // method: GenericHttpRequest['method'],
        // url: string,
        // createBody: () => string | null = () => null
    ) {
        it('should return a 401 status code when no session key is included', async () => {
            let request = getRequest();
            delete request.headers.authorization;
            const result = await server.handleRequest(request);

            expectResponseBodyToEqual(result, {
                statusCode: 401,
                body: {
                    success: false,
                    errorCode: 'not_logged_in',
                    errorMessage: expect.stringMatching(
                        /(The user is not logged in\. A session key must be provided for this operation\.)|(The user must be logged in in order to record events.)/
                    ),
                },
                headers: {
                    'Access-Control-Allow-Origin': request.headers.origin,
                    'Access-Control-Allow-Headers':
                        'Content-Type, Authorization',
                },
            });
        });

        it('should return a 400 status code when the session key is wrongly formatted', async () => {
            let request = getRequest();
            request.headers['authorization'] = 'Bearer wrong';
            const result = await server.handleRequest(request);

            expect(result).toEqual({
                statusCode: 400,
                body: JSON.stringify({
                    success: false,
                    errorCode: 'unacceptable_session_key',
                    errorMessage:
                        'The given session key is invalid. It must be a correctly formatted string.',
                }),
                headers: {
                    'Access-Control-Allow-Origin': request.headers.origin,
                    'Access-Control-Allow-Headers':
                        'Content-Type, Authorization',
                },
            });
        });
    }

    function testBodyIsJson(getRequest: (body: string) => GenericHttpRequest) {
        it('should return a 400 status code when the body is not JSON', async () => {
            const request = getRequest('{');
            const result = await server.handleRequest(request);

            expect(result).toEqual({
                statusCode: 400,
                body: JSON.stringify({
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage:
                        'The request body was not properly formatted. It should be valid JSON.',
                }),
                headers: {
                    'Access-Control-Allow-Origin': request.headers.origin,
                    'Access-Control-Allow-Headers':
                        'Content-Type, Authorization',
                },
            });
        });

        it('should return a 400 status code when the body is not a JSON object', async () => {
            const request = getRequest('true');
            const result = await server.handleRequest(request);

            expect(result).toEqual({
                statusCode: 400,
                body: JSON.stringify({
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage:
                        'The request body was not properly formatted. It should be valid JSON.',
                }),
                headers: {
                    'Access-Control-Allow-Origin': request.headers.origin,
                    'Access-Control-Allow-Headers':
                        'Content-Type, Authorization',
                },
            });
        });
    }

    function httpGet(
        url: string,
        headers: GenericHttpHeaders = defaultHeaders,
        ipAddress: string = '123.456.789'
    ): GenericHttpRequest {
        return httpRequest('GET', url, null, headers, ipAddress);
    }

    function httpPut(
        url: string,
        body: any,
        headers: GenericHttpHeaders = defaultHeaders,
        ipAddress: string = '123.456.789'
    ): GenericHttpRequest {
        return httpRequest('PUT', url, body, headers, ipAddress);
    }

    function httpPost(
        url: string,
        body: any,
        headers: GenericHttpHeaders = defaultHeaders,
        ipAddress: string = '123.456.789'
    ): GenericHttpRequest {
        return httpRequest('POST', url, body, headers, ipAddress);
    }

    function httpRequest(
        method: GenericHttpRequest['method'],
        url: string,
        body: GenericHttpRequest['body'],
        headers: GenericHttpHeaders = defaultHeaders,
        ipAddress: string = '123.456.789'
    ): GenericHttpRequest {
        const { path, pathParams, query } = parseUrl(url);

        return {
            path,
            body,
            headers,
            pathParams,
            method,
            query,
            ipAddress,
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
                    ipAddress: '123.456',
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
                    ipAddress: '123.456',
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
                    ipAddress: '123.456',
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
                    ipAddress: '123.456',
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
                    ipAddress: '123.456',
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
                ipAddress: '123.456',
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
                ipAddress: '123.456',
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
                ipAddress: '123.456',
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
        let p = decodeURI(segment);
        if (p.startsWith('{') && p.endsWith('}')) {
            let splitPoint = p.indexOf(':');
            let name = p.slice(1, splitPoint);
            let value = p.slice(splitPoint + 1, p.length - 1);
            result.push({
                name,
                value,
            });
        } else {
            result.push(segment);
        }
    }

    return result;
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
