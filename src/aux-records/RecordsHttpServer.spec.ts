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
import {
    formatV1OpenAiKey,
    formatV1SessionKey,
    parseSessionKey,
} from './AuthUtils';
import { AuthSession, AuthUser } from './AuthStore';
import { LivekitController } from './LivekitController';
import { isRecordKey, RecordsController } from './RecordsController';
import { RecordsStore } from './RecordsStore';
import { MemoryRecordsStore } from './MemoryRecordsStore';
import { EventRecordsController } from './EventRecordsController';
import { EventRecordsStore } from './EventRecordsStore';
import { MemoryEventRecordsStore } from './MemoryEventRecordsStore';
import { DataRecordsController } from './DataRecordsController';
import { DataRecordsStore } from './DataRecordsStore';
import { MemoryDataRecordsStore } from './MemoryDataRecordsStore';
import { FileRecordsController } from './FileRecordsController';
import { FileRecordsStore } from './FileRecordsStore';
import { MemoryFileRecordsStore } from './MemoryFileRecordsStore';
import { getHash } from '@casual-simulation/crypto';
import { SubscriptionController } from './SubscriptionController';
import { StripeInterface, StripeProduct } from './StripeInterface';

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
    let dataController: DataRecordsController;
    let dataStore: DataRecordsStore;
    let manualDataController: DataRecordsController;
    let manualDataStore: DataRecordsStore;

    let filesStore: FileRecordsStore;
    let filesController: FileRecordsController;

    let stripeMock: {
        publishableKey: string;
        getProductAndPriceInfo: jest.Mock<Promise<StripeProduct | null>>;
        listPricesForProduct: jest.Mock<any>;
        createCheckoutSession: jest.Mock<any>;
        createPortalSession: jest.Mock<any>;
        createCustomer: jest.Mock<any>;
        listActiveSubscriptionsForCustomer: jest.Mock<any>;
        constructWebhookEvent: jest.Mock<any>;
    };

    let stripe: StripeInterface;
    let subscriptionController: SubscriptionController;

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

        dataStore = new MemoryDataRecordsStore();
        dataController = new DataRecordsController(
            recordsController,
            dataStore
        );

        manualDataStore = new MemoryDataRecordsStore();
        manualDataController = new DataRecordsController(
            recordsController,
            manualDataStore
        );

        filesStore = new MemoryFileRecordsStore();
        filesController = new FileRecordsController(
            recordsController,
            filesStore
        );

        stripe = stripeMock = {
            publishableKey: 'publishable_key',
            getProductAndPriceInfo: jest.fn(),
            listPricesForProduct: jest.fn(),
            createCheckoutSession: jest.fn(),
            createPortalSession: jest.fn(),
            createCustomer: jest.fn(),
            listActiveSubscriptionsForCustomer: jest.fn(),
            constructWebhookEvent: jest.fn(),
        };

        stripeMock.getProductAndPriceInfo.mockImplementation(async (id) => {
            if (id === 'product_id') {
                return {
                    id,
                    default_price: {
                        id: 'price_id',
                        currency: 'usd',
                        recurring: {
                            interval: 'month',
                            interval_count: 1,
                        },
                        unit_amount: 100,
                    },
                    name: 'Product Name',
                    description: 'Product Description',
                };
            }
            return null;
        });

        subscriptionController = new SubscriptionController(
            stripe,
            authController,
            authStore,
            {
                subscriptions: [
                    {
                        id: 'sub_id',
                        eligibleProducts: ['product_id'],
                        featureList: ['Feature 1', 'Feature 2'],
                        product: 'product_id',
                        defaultSubscription: true,
                    },
                ],
                // lineItems: [
                //     {
                //         price: 'price_id',
                //         quantity: 1,
                //     },
                // ],
                // products: ['product_id'],
                webhookSecret: 'webhook_secret',
                cancelUrl: 'cancel_url',
                successUrl: 'success_url',
                returnUrl: 'return_url',
            }
        );

        server = new RecordsHttpServer(
            allowedAccountOrigins,
            allowedApiOrigins,
            authController,
            livekitController,
            recordsController,
            eventsController,
            dataController,
            manualDataController,
            filesController,
            subscriptionController
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

    describe('GET /api/{userId}/metadata', () => {
        it('should return the metadata for the given userId', async () => {
            const result = await server.handleRequest(
                httpGet(
                    `/api/{userId:${userId}}/metadata`,
                    authenticatedHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    email: 'test@example.com',
                    phoneNumber: null,
                    hasActiveSubscription: false,
                    openAiKey: null,
                },
                headers: accountCorsHeaders,
            });
        });

        it('should return the openAiKey for active subscriptions', async () => {
            const user = await authStore.findUser(userId);
            await authStore.saveUser({
                ...user,
                subscriptionStatus: 'active',
                openAiKey: 'api key',
            });
            const result = await server.handleRequest(
                httpGet(
                    `/api/{userId:${userId}}/metadata`,
                    authenticatedHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    email: 'test@example.com',
                    phoneNumber: null,
                    hasActiveSubscription: true,
                    openAiKey: 'api key',
                },
                headers: accountCorsHeaders,
            });
        });

        it('should be able to decode URI components for the userId', async () => {
            const userId =
                'did:ethr:0xA31b9288725d2B99137f4af10CaFdaA67B80C769';
            await authStore.saveNewUser({
                id: userId,
                email: 'other@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });
            let requestResult = await authController.requestLogin({
                address: 'other@example.com',
                addressType: 'email',
                ipAddress: '123.456.789',
            });

            if (!requestResult.success) {
                throw new Error('Unable to request a login!');
            }

            const message = authMessenger.messages.find(
                (m) => m.address === 'other@example.com'
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

            apiHeaders['authorization'] = authenticatedHeaders[
                'authorization'
            ] = `Bearer ${sessionKey}`;

            const result = await server.handleRequest(
                httpGet(
                    `/api/{userId:${encodeURIComponent(userId)}}/metadata`,
                    authenticatedHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    email: 'other@example.com',
                    phoneNumber: null,
                    hasActiveSubscription: false,
                    openAiKey: null,
                },
                headers: accountCorsHeaders,
            });
        });

        it('should return a 400 status code if given an invalid encoded user ID', async () => {
            const result = await server.handleRequest({
                method: 'GET',
                body: null,
                headers: authenticatedHeaders,
                pathParams: {
                    userId: 'invali%d',
                },
                path: '/api/invali%d/metadata',
                ipAddress: '123.456.789',
                query: {},
            });

            expectResponseBodyToEqual(result, {
                statusCode: 400,
                body: {
                    success: false,
                    errorCode: 'unacceptable_user_id',
                    errorMessage: expect.any(String),
                },
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

            const user = await authStore.findUser(userId);
            expect(user).toMatchObject({
                id: userId,
                name: 'Kal',
            });
        });

        it('should be able to update the openAiKey when the user has an active subscription', async () => {
            let user = await authStore.findUser(userId);
            await authStore.saveUser({
                ...user,
                subscriptionStatus: 'active',
            });
            const result = await server.handleRequest(
                httpPut(
                    `/api/{userId:${userId}}/metadata`,
                    JSON.stringify({
                        openAiKey: 'api key',
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

            user = await authStore.findUser(userId);
            expect(user).toMatchObject({
                id: userId,
                openAiKey: formatV1OpenAiKey('api key'),
            });
        });

        it('should be able to decode URI components for the userId', async () => {
            const userId =
                'did:ethr:0xA31b9288725d2B99137f4af10CaFdaA67B80C769';
            await authStore.saveNewUser({
                id: userId,
                email: 'other@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });
            let requestResult = await authController.requestLogin({
                address: 'other@example.com',
                addressType: 'email',
                ipAddress: '123.456.789',
            });

            if (!requestResult.success) {
                throw new Error('Unable to request a login!');
            }

            const message = authMessenger.messages.find(
                (m) => m.address === 'other@example.com'
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

            apiHeaders['authorization'] = authenticatedHeaders[
                'authorization'
            ] = `Bearer ${sessionKey}`;

            const result = await server.handleRequest(
                httpPut(
                    `/api/{userId:${encodeURIComponent(userId)}}/metadata`,
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

        it('should return a 400 status code if given an invalid encoded user ID', async () => {
            const result = await server.handleRequest({
                method: 'PUT',
                body: JSON.stringify({
                    name: 'Kal',
                }),
                headers: authenticatedHeaders,
                pathParams: {
                    userId: 'invali%d',
                },
                path: '/api/invali%d/metadata',
                ipAddress: '123.456.789',
                query: {},
            });

            expectResponseBodyToEqual(result, {
                statusCode: 400,
                body: {
                    success: false,
                    errorCode: 'unacceptable_user_id',
                    errorMessage: expect.any(String),
                },
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

    describe('GET /api/{userId}/subscription', () => {
        let user: AuthUser;
        beforeEach(async () => {
            user = await authStore.findUser(userId);
            await authStore.saveUser({
                ...user,
                stripeCustomerId: 'customerId',
            });
            user = await authStore.findUser(userId);
        });

        it('should return a list of subscriptions for the user', async () => {
            stripeMock.listActiveSubscriptionsForCustomer.mockResolvedValueOnce(
                {
                    subscriptions: [
                        {
                            id: 'subscription_id',
                            status: 'active',
                            start_date: 123,
                            ended_at: null,
                            cancel_at: null,
                            canceled_at: null,
                            current_period_start: 456,
                            current_period_end: 999,
                            items: [
                                {
                                    id: 'item_id',
                                    price: {
                                        id: 'price_id',
                                        interval: 'month',
                                        interval_count: 1,
                                        currency: 'usd',
                                        unit_amount: 123,

                                        product: {
                                            id: 'product_id',
                                            name: 'Product Name',
                                        },
                                    },
                                },
                            ],
                        },
                    ],
                }
            );

            const result = await server.handleRequest(
                httpGet(
                    `/api/{userId:${userId}}/subscription`,
                    authenticatedHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    publishableKey: 'publishable_key',
                    subscriptions: [
                        {
                            active: true,
                            statusCode: 'active',
                            productName: 'Product Name',
                            startDate: 123,
                            endedDate: null,
                            cancelDate: null,
                            canceledDate: null,
                            currentPeriodStart: 456,
                            currentPeriodEnd: 999,
                            renewalInterval: 'month',
                            intervalLength: 1,
                            intervalCost: 123,
                            currency: 'usd',
                        },
                    ],
                    purchasableSubscriptions: [],
                },
                headers: accountCorsHeaders,
            });
        });

        it('should return a list of purchasable subscriptions for the user', async () => {
            stripeMock.listActiveSubscriptionsForCustomer.mockResolvedValueOnce(
                {
                    subscriptions: [],
                }
            );

            const result = await server.handleRequest(
                httpGet(
                    `/api/{userId:${userId}}/subscription`,
                    authenticatedHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    publishableKey: 'publishable_key',
                    subscriptions: [],
                    purchasableSubscriptions: [
                        {
                            id: 'sub_id',
                            name: 'Product Name',
                            description: 'Product Description',
                            featureList: ['Feature 1', 'Feature 2'],
                            prices: [
                                {
                                    id: 'default',
                                    cost: 100,
                                    currency: 'usd',
                                    interval: 'month',
                                    intervalLength: 1,
                                },
                            ],
                        },
                    ],
                },
                headers: accountCorsHeaders,
            });
        });

        it('should return a 400 status code if given an invalid encoded user ID', async () => {
            const result = await server.handleRequest({
                method: 'GET',
                body: null,
                headers: authenticatedHeaders,
                pathParams: {
                    userId: 'invali%d',
                },
                path: '/api/invali%d/subscription',
                ipAddress: '123.456.789',
                query: {},
            });

            expectResponseBodyToEqual(result, {
                statusCode: 400,
                body: {
                    success: false,
                    errorCode: 'unacceptable_user_id',
                    errorMessage: expect.any(String),
                },
                headers: accountCorsHeaders,
            });
        });

        it('should return a 403 status code if the origin is invalid', async () => {
            authenticatedHeaders['origin'] = 'https://wrong.origin.com';
            const result = await server.handleRequest(
                httpGet(
                    `/api/{userId:${userId}}/subscription`,
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
                    `/api/{userId:${userId}}/subscription`,
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
                    `/api/{userId:${userId}}/subscription`,
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
                    `/api/{userId:${userId}}/subscription`,
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

    describe('POST /api/{userId}/subscription/manage', () => {
        let user: AuthUser;
        beforeEach(async () => {
            user = await authStore.findUser(userId);
            await authStore.saveUser({
                ...user,
                stripeCustomerId: 'customerId',
            });
            user = await authStore.findUser(userId);
        });

        it('should return the URL that the user should be redirected to', async () => {
            stripeMock.listActiveSubscriptionsForCustomer.mockResolvedValueOnce(
                {
                    subscriptions: [
                        {
                            id: 'subscription_id',
                            status: 'active',
                            start_date: 123,
                            ended_at: null,
                            cancel_at: null,
                            canceled_at: null,
                            current_period_start: 456,
                            current_period_end: 999,
                            items: [
                                {
                                    id: 'item_id',
                                    price: {
                                        id: 'price_id',
                                        interval: 'month',
                                        interval_count: 1,
                                        currency: 'usd',
                                        unit_amount: 123,

                                        product: {
                                            id: 'product_id',
                                            name: 'Product Name',
                                        },
                                    },
                                },
                            ],
                        },
                    ],
                }
            );

            stripeMock.createPortalSession.mockResolvedValueOnce({
                url: 'portal_url',
            });

            const result = await server.handleRequest(
                httpPost(
                    `/api/{userId:${userId}}/subscription/manage`,
                    '',
                    authenticatedHeaders
                )
            );

            expect(result).toEqual({
                statusCode: 200,
                body: JSON.stringify({
                    success: true,
                    url: 'portal_url',
                }),
                headers: accountCorsHeaders,
            });
        });

        it('should include the given Subscription ID and expected price info', async () => {
            stripeMock.listActiveSubscriptionsForCustomer.mockResolvedValueOnce(
                {
                    subscriptions: [],
                }
            );
            stripeMock.createCheckoutSession.mockResolvedValueOnce({
                url: 'create_url',
            });

            stripeMock.createPortalSession.mockResolvedValueOnce({
                url: 'portal_url',
            });

            const result = await server.handleRequest(
                httpPost(
                    `/api/{userId:${userId}}/subscription/manage`,
                    JSON.stringify({
                        subscriptionId: 'sub-1',
                        expectedPrice: {
                            currency: 'usd',
                            cost: 100,
                            interval: 'month',
                            intervalLength: 1,
                        },
                    }),
                    authenticatedHeaders
                )
            );

            expect(result).toEqual({
                statusCode: 200,
                body: JSON.stringify({
                    success: true,
                    url: 'create_url',
                }),
                headers: accountCorsHeaders,
            });
            expect(stripeMock.getProductAndPriceInfo).toHaveBeenCalledWith(
                'product_id'
            );
        });

        it('should return a price_does_not_match error if the expected price does not match', async () => {
            stripeMock.listActiveSubscriptionsForCustomer.mockResolvedValueOnce(
                {
                    subscriptions: [],
                }
            );
            stripeMock.createCheckoutSession.mockResolvedValueOnce({
                url: 'create_url',
            });

            stripeMock.createPortalSession.mockResolvedValueOnce({
                url: 'portal_url',
            });

            const result = await server.handleRequest(
                httpPost(
                    `/api/{userId:${userId}}/subscription/manage`,
                    JSON.stringify({
                        subscriptionId: 'sub-1',
                        expectedPrice: {
                            currency: 'usd',
                            cost: 1000,
                            interval: 'month',
                            intervalLength: 1,
                        },
                    }),
                    authenticatedHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 412,
                body: {
                    success: false,
                    errorCode: 'price_does_not_match',
                    errorMessage: expect.any(String),
                },
                headers: accountCorsHeaders,
            });
            expect(stripeMock.getProductAndPriceInfo).toHaveBeenCalledWith(
                'product_id'
            );
        });

        it('should return a 400 status code if given an invalid encoded user ID', async () => {
            const result = await server.handleRequest({
                method: 'POST',
                body: '',
                headers: authenticatedHeaders,
                pathParams: {
                    userId: 'invali%d',
                },
                path: '/api/invali%d/subscription/manage',
                ipAddress: '123.456.789',
                query: {},
            });

            expectResponseBodyToEqual(result, {
                statusCode: 400,
                body: {
                    success: false,
                    errorCode: 'unacceptable_user_id',
                    errorMessage: expect.any(String),
                },
                headers: accountCorsHeaders,
            });
        });

        it('should return a 403 status code if the origin is invalid', async () => {
            authenticatedHeaders['origin'] = 'https://wrong.origin.com';
            const result = await server.handleRequest(
                httpPost(
                    `/api/{userId:${userId}}/subscription/manage`,
                    '',
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
                httpPost(
                    `/api/{userId:${userId}}/subscription/manage`,
                    '',
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
                httpPost(
                    `/api/{userId:${userId}}/subscription/manage`,
                    '',
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
                httpPost(
                    `/api/{userId:${userId}}/subscription/manage`,
                    '',
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

    describe('POST /api/stripeWebhook', () => {
        let user: AuthUser;
        beforeEach(async () => {
            user = await authStore.findUser(userId);
            await authStore.saveUser({
                ...user,
                stripeCustomerId: 'customer_id',
            });
            user = await authStore.findUser(userId);
        });

        const eventTypes = [
            ['customer.subscription.created'],
            ['customer.subscription.updated'],
            ['customer.subscription.deleted'],
        ] as const;

        const statusTypes = [
            ['active', true] as const,
            ['trialing', true] as const,
            ['canceled', false] as const,
            ['ended', false] as const,
            ['past_due', false] as const,
            ['unpaid', false] as const,
            ['incomplete', false] as const,
            ['incomplete_expired', false] as const,
            ['paused', false] as const,
        ];

        describe.each(eventTypes)('should handle %s events', (type) => {
            it.each(statusTypes)(
                'should handle %s subscriptions',
                async (status, active) => {
                    stripeMock.constructWebhookEvent.mockReturnValueOnce({
                        id: 'event_id',
                        object: 'event',
                        account: 'account_id',
                        api_version: 'api_version',
                        created: 123,
                        data: {
                            object: {
                                id: 'subscription',
                                status: status,
                                customer: 'customer_id',
                                items: {
                                    object: 'list',
                                    data: [
                                        {
                                            price: {
                                                id: 'price_1',
                                                product: 'product_id',
                                            },
                                        },
                                    ],
                                },
                            },
                        },
                        livemode: true,
                        pending_webhooks: 1,
                        request: {},
                        type: type,
                    });

                    const response = await server.handleRequest(
                        httpPost('/api/stripeWebhook', 'request_body', {
                            ['stripe-signature']: 'request_signature',
                        })
                    );

                    expectResponseBodyToEqual(response, {
                        statusCode: 200,
                        body: {
                            success: true,
                        },
                        headers: {},
                    });

                    const user = await authStore.findUser(userId);
                    expect(user.subscriptionStatus).toBe(status);
                }
            );
        });
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

        it('should support subjectless records', async () => {
            const keyResult = await recordsController.createPublicRecordKey(
                recordName,
                'subjectless',
                userId
            );

            if (!keyResult.success) {
                throw new Error('Unable to create subjectless key');
            }

            delete apiHeaders['authorization'];
            const result = await server.handleRequest(
                httpPost(
                    `/api/v2/records/events/count`,
                    JSON.stringify({
                        recordKey: keyResult.recordKey,
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

    describe('DELETE /api/v2/records/manual/data', () => {
        beforeEach(async () => {
            await manualDataController.recordData(
                recordKey,
                'testAddress',
                'hello, world!',
                userId,
                null,
                null
            );
        });

        it('should delete the given manual data record', async () => {
            const result = await server.handleRequest(
                httpDelete(
                    `/api/v2/records/manual/data`,
                    JSON.stringify({
                        recordKey,
                        address: 'testAddress',
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    address: 'testAddress',
                },
                headers: apiCorsHeaders,
            });
        });

        it('should support subjectless records', async () => {
            const keyResult = await recordsController.createPublicRecordKey(
                recordName,
                'subjectless',
                userId
            );

            if (!keyResult.success) {
                throw new Error('Unable to create subjectless key');
            }

            delete apiHeaders['authorization'];
            const result = await server.handleRequest(
                httpDelete(
                    `/api/v2/records/manual/data`,
                    JSON.stringify({
                        recordKey: keyResult.recordKey,
                        address: 'testAddress',
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    address: 'testAddress',
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request result when given a non-string recordKey', async () => {
            const result = await server.handleRequest(
                httpDelete(
                    `/api/v2/records/manual/data`,
                    JSON.stringify({
                        recordKey: 123,
                        address: 'testAddress',
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

        it('should return an unacceptable_request result when given a non-string address', async () => {
            const result = await server.handleRequest(
                httpDelete(
                    `/api/v2/records/manual/data`,
                    JSON.stringify({
                        recordKey,
                        address: 123,
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 400,
                body: {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage: 'address is required and must be a string.',
                },
                headers: apiCorsHeaders,
            });
        });

        testOrigin('DELETE', '/api/v2/records/manual/data', () =>
            JSON.stringify({
                recordKey,
                address: 'testAddress',
            })
        );
        testAuthorization(
            () =>
                httpDelete(
                    '/api/v2/records/manual/data',
                    JSON.stringify({
                        recordKey,
                        address: 'testAddress',
                    }),
                    apiHeaders
                ),
            'The user must be logged in in order to erase data using the provided record key.'
        );
        testBodyIsJson((body) =>
            httpDelete('/api/v2/records/manual/data', body, apiHeaders)
        );
    });

    describe('GET /api/v2/records/manual/data', () => {
        beforeEach(async () => {
            await manualDataController.recordData(
                recordKey,
                'testAddress',
                'hello, world!',
                userId,
                null,
                null
            );
        });

        it('should be able to get the data from an address', async () => {
            const result = await server.handleRequest(
                httpGet(
                    `/api/v2/records/manual/data?recordName=${recordName}&address=testAddress`,
                    defaultHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    data: 'hello, world!',
                    deletePolicy: true,
                    updatePolicy: true,
                    subjectId: userId,
                    publisherId: userId,
                },
                headers: corsHeaders(defaultHeaders['origin']),
            });
        });

        it('should return an unacceptable_request result when not given a recordName', async () => {
            const result = await server.handleRequest(
                httpGet(
                    `/api/v2/records/manual/data?address=testAddress`,
                    defaultHeaders
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
                headers: corsHeaders(defaultHeaders['origin']),
            });
        });

        it('should return an unacceptable_request result when not given a address', async () => {
            const result = await server.handleRequest(
                httpGet(
                    `/api/v2/records/manual/data?recordName=${recordName}`,
                    defaultHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 400,
                body: {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage: 'address is required and must be a string.',
                },
                headers: corsHeaders(defaultHeaders['origin']),
            });
        });

        it('should return a 404 when trying to get data that doesnt exist', async () => {
            const result = await server.handleRequest(
                httpGet(
                    `/api/v2/records/manual/data?recordName=${recordName}&address=missing`,
                    defaultHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 404,
                body: {
                    success: false,
                    errorCode: 'data_not_found',
                    errorMessage: 'The data was not found.',
                },
                headers: corsHeaders(defaultHeaders['origin']),
            });
        });
    });

    describe('POST /api/v2/records/manual/data', () => {
        it('should save the given manual data record', async () => {
            const result = await server.handleRequest(
                httpPost(
                    `/api/v2/records/manual/data`,
                    JSON.stringify({
                        recordKey,
                        address: 'testAddress',
                        data: 'hello, world',
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    address: 'testAddress',
                },
                headers: apiCorsHeaders,
            });

            const data = await manualDataStore.getData(
                recordName,
                'testAddress'
            );
            expect(data).toEqual({
                success: true,
                data: 'hello, world',
                subjectId: userId,
                publisherId: userId,
                updatePolicy: true,
                deletePolicy: true,
            });
        });

        it('should support subjectless records', async () => {
            const keyResult = await recordsController.createPublicRecordKey(
                recordName,
                'subjectless',
                userId
            );

            if (!keyResult.success) {
                throw new Error('Unable to create subjectless key');
            }

            delete apiHeaders['authorization'];
            const result = await server.handleRequest(
                httpPost(
                    `/api/v2/records/manual/data`,
                    JSON.stringify({
                        recordKey: keyResult.recordKey,
                        address: 'testAddress',
                        data: 'hello, world',
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    address: 'testAddress',
                },
                headers: apiCorsHeaders,
            });

            const data = await manualDataStore.getData(
                recordName,
                'testAddress'
            );
            expect(data).toEqual({
                success: true,
                data: 'hello, world',
                subjectId: null,
                publisherId: userId,
                updatePolicy: true,
                deletePolicy: true,
            });
        });

        it('should return an unacceptable_request result when given a non-string address', async () => {
            const result = await server.handleRequest(
                httpPost(
                    `/api/v2/records/manual/data`,
                    JSON.stringify({
                        recordKey,
                        address: 123,
                        data: 'hello, world',
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 400,
                body: {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage: 'address is required and must be a string.',
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request result when given a non-string recordKey', async () => {
            const result = await server.handleRequest(
                httpPost(
                    `/api/v2/records/manual/data`,
                    JSON.stringify({
                        recordKey: 123,
                        address: 'testAddress',
                        data: 'hello, world',
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

        it('should return an unacceptable_request result when given undefined data', async () => {
            const result = await server.handleRequest(
                httpPost(
                    `/api/v2/records/manual/data`,
                    JSON.stringify({
                        recordKey,
                        address: 'testAddress',
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 400,
                body: {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage: 'data is required.',
                },
                headers: apiCorsHeaders,
            });
        });

        testOrigin('POST', `/api/v2/records/manual/data`, () =>
            JSON.stringify({
                recordKey,
                address: 'testAddress',
                data: 'hello, world',
            })
        );
        testAuthorization(
            () =>
                httpPost(
                    '/api/v2/records/manual/data',
                    JSON.stringify({
                        recordKey,
                        address: 'testAddress',
                        data: 'hello, world',
                    }),
                    apiHeaders
                ),
            'The user must be logged in in order to record data.'
        );
        testBodyIsJson((body) =>
            httpPost(`/api/v2/records/manual/data`, body, apiHeaders)
        );
    });

    describe('DELETE /api/v2/records/file', () => {
        let fileName: string;
        let fileUrl: string;

        beforeEach(async () => {
            const fileResult = await filesController.recordFile(
                recordKey,
                userId,
                {
                    fileSha256Hex: getHash('hello'),
                    fileByteLength: 10,
                    fileDescription: 'desc',
                    fileMimeType: 'application/json',
                    headers: {},
                }
            );
            if (!fileResult.success) {
                throw new Error('Unable to record file!');
            }
            fileName = fileResult.fileName;
            fileUrl = fileResult.uploadUrl;
        });

        it('should delete the file with the given name', async () => {
            const result = await server.handleRequest(
                httpDelete(
                    `/api/v2/records/file`,
                    JSON.stringify({
                        recordKey,
                        fileUrl,
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    fileName,
                },
                headers: apiCorsHeaders,
            });

            const data = await filesStore.getFileRecord(recordName, fileName);
            expect(data).toEqual({
                success: false,
                errorCode: 'file_not_found',
                errorMessage: expect.any(String),
            });
        });

        it('should support subjectless record keys', async () => {
            const keyResult = await recordsController.createPublicRecordKey(
                recordName,
                'subjectless',
                userId
            );

            if (!keyResult.success) {
                throw new Error('Unable to create subjectless record key!');
            }

            const result = await server.handleRequest(
                httpDelete(
                    `/api/v2/records/file`,
                    JSON.stringify({
                        recordKey: keyResult.recordKey,
                        fileUrl,
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    fileName,
                },
                headers: apiCorsHeaders,
            });

            const data = await filesStore.getFileRecord(recordName, fileName);
            expect(data).toEqual({
                success: false,
                errorCode: 'file_not_found',
                errorMessage: expect.any(String),
            });
        });

        it('should return an unacceptable_request if given a non-string recordKey', async () => {
            const result = await server.handleRequest(
                httpDelete(
                    `/api/v2/records/file`,
                    JSON.stringify({
                        recordKey: 123,
                        fileUrl,
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

        it('should return an unacceptable_request if given a non-string fileUrl', async () => {
            const result = await server.handleRequest(
                httpDelete(
                    `/api/v2/records/file`,
                    JSON.stringify({
                        recordKey,
                        fileUrl: 123,
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 400,
                body: {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage: 'fileUrl is required and must be a string.',
                },
                headers: apiCorsHeaders,
            });
        });

        testOrigin('DELETE', '/api/v2/records/file', () =>
            JSON.stringify({
                recordKey,
                fileUrl,
            })
        );
        testAuthorization(
            () =>
                httpDelete(
                    '/api/v2/records/file',
                    JSON.stringify({
                        recordKey,
                        fileUrl,
                    }),
                    apiHeaders
                ),
            'The user must be logged in in order to erase files.'
        );

        testBodyIsJson((body) =>
            httpDelete('/api/v2/records/file', body, apiHeaders)
        );
    });

    describe('POST /api/v2/records/file', () => {
        it('should create an un-uploaded file record', async () => {
            const hash = getHash('hello');
            const result = await server.handleRequest(
                httpPost(
                    `/api/v2/records/file`,
                    JSON.stringify({
                        recordKey,
                        fileSha256Hex: hash,
                        fileByteLength: 10,
                        fileMimeType: 'application/json',
                        fileDescription: 'description',
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    uploadUrl: `http://localhost:9191/${recordName}/${hash}.json`,
                    fileName: `${hash}.json`,
                    uploadMethod: 'POST',
                    uploadHeaders: {
                        'content-type': 'application/json',
                        'record-name': recordName,
                    },
                },
                headers: apiCorsHeaders,
            });

            const data = await filesStore.getFileRecord(
                recordName,
                `${hash}.json`
            );
            expect(data).toEqual({
                success: true,
                recordName: 'testRecord',
                fileName: `${hash}.json`,
                publisherId: userId,
                subjectId: userId,
                sizeInBytes: 10,
                description: 'description',
                url: `${recordName}/${hash}.json`,
                uploaded: false,
            });
        });

        it('should support subjectless record keys', async () => {
            const keyResult = await recordsController.createPublicRecordKey(
                recordName,
                'subjectless',
                userId
            );

            if (!keyResult.success) {
                throw new Error('Unable to create subjectless record key!');
            }

            const hash = getHash('hello');
            const result = await server.handleRequest(
                httpPost(
                    `/api/v2/records/file`,
                    JSON.stringify({
                        recordKey: keyResult.recordKey,
                        fileSha256Hex: hash,
                        fileByteLength: 10,
                        fileMimeType: 'application/json',
                        fileDescription: 'description',
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    uploadUrl: `http://localhost:9191/${recordName}/${hash}.json`,
                    fileName: `${hash}.json`,
                    uploadMethod: 'POST',
                    uploadHeaders: {
                        'content-type': 'application/json',
                        'record-name': recordName,
                    },
                },
                headers: apiCorsHeaders,
            });

            const data = await filesStore.getFileRecord(
                recordName,
                `${hash}.json`
            );
            expect(data).toEqual({
                success: true,
                recordName: 'testRecord',
                fileName: `${hash}.json`,
                publisherId: userId,
                subjectId: null,
                sizeInBytes: 10,
                description: 'description',
                url: `${recordName}/${hash}.json`,
                uploaded: false,
            });
        });

        it('should return an unacceptable_request if given a non-string recordKey', async () => {
            const hash = getHash('hello');
            const result = await server.handleRequest(
                httpPost(
                    `/api/v2/records/file`,
                    JSON.stringify({
                        recordKey: 123,
                        fileSha256Hex: hash,
                        fileByteLength: 10,
                        fileMimeType: 'application/json',
                        fileDescription: 'description',
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

        it('should return an unacceptable_request if given a non-string fileSha256Hex', async () => {
            const hash = getHash('hello');
            const result = await server.handleRequest(
                httpPost(
                    `/api/v2/records/file`,
                    JSON.stringify({
                        recordKey,
                        fileSha256Hex: 123,
                        fileByteLength: 10,
                        fileMimeType: 'application/json',
                        fileDescription: 'description',
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 400,
                body: {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage:
                        'fileSha256Hex is required and must be a string.',
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request if given a non-number fileByteLength', async () => {
            const hash = getHash('hello');
            const result = await server.handleRequest(
                httpPost(
                    `/api/v2/records/file`,
                    JSON.stringify({
                        recordKey,
                        fileSha256Hex: hash,
                        fileByteLength: 'abc',
                        fileMimeType: 'application/json',
                        fileDescription: 'description',
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 400,
                body: {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage:
                        'fileByteLength is required and must be a number.',
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request if given a non-string fileMimeType', async () => {
            const hash = getHash('hello');
            const result = await server.handleRequest(
                httpPost(
                    `/api/v2/records/file`,
                    JSON.stringify({
                        recordKey,
                        fileSha256Hex: hash,
                        fileByteLength: 10,
                        fileMimeType: 123,
                        fileDescription: 'description',
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 400,
                body: {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage:
                        'fileMimeType is required and must be a string.',
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request if given a non-string fileDescription', async () => {
            const hash = getHash('hello');
            const result = await server.handleRequest(
                httpPost(
                    `/api/v2/records/file`,
                    JSON.stringify({
                        recordKey,
                        fileSha256Hex: hash,
                        fileByteLength: 10,
                        fileMimeType: 'application/json',
                        fileDescription: 123,
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 400,
                body: {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage: 'fileDescription must be a string.',
                },
                headers: apiCorsHeaders,
            });
        });

        testOrigin('POST', '/api/v2/records/file', () =>
            JSON.stringify({
                recordKey,
                fileSha256Hex: 'hash',
                fileByteLength: 10,
                fileMimeType: 'application/json',
                fileDescription: 'description',
            })
        );

        testAuthorization(
            () =>
                httpPost(
                    '/api/v2/records/file',
                    JSON.stringify({
                        recordKey,
                        fileSha256Hex: 'hash',
                        fileByteLength: 10,
                        fileMimeType: 'application/json',
                        fileDescription: 'description',
                    }),
                    apiHeaders
                ),
            'The user must be logged in in order to record files.'
        );

        testBodyIsJson((body) =>
            httpPost('/api/v2/records/file', body, apiHeaders)
        );
    });

    describe('OPTIONS /api/v2/records/file/*', () => {
        it('should return Access-Control-Allow-Headers with the headers that the file store returns', async () => {
            const result = await server.handleRequest(
                httpRequest('OPTIONS', '/api/v2/records/file/hash.txt', null, {
                    'access-control-request-method': 'POST',
                    'access-control-request-headers':
                        'record-name, Content-Type',
                    origin: apiOrigin,
                })
            );

            expectResponseBodyToEqual(result, {
                statusCode: 204,
                headers: {
                    'Access-Control-Allow-Methods': 'POST',
                    'Access-Control-Allow-Headers':
                        'record-name, content-type, authorization',
                    'Access-Control-Allow-Origin': apiOrigin,
                    'Access-Control-Max-Age': '14400', // 4 hours in seconds
                },
            });
        });
    });

    describe('DELETE /api/v2/records/data', () => {
        beforeEach(async () => {
            await dataController.recordData(
                recordKey,
                'testAddress',
                'hello, world!',
                userId,
                null,
                null
            );
        });

        it('should delete the data at the given address', async () => {
            const result = await server.handleRequest(
                httpDelete(
                    '/api/v2/records/data',
                    JSON.stringify({
                        recordKey,
                        address: 'testAddress',
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    address: 'testAddress',
                },
                headers: apiCorsHeaders,
            });

            const data = await dataStore.getData(recordName, 'testAddress');

            expect(data).toEqual({
                success: false,
                errorCode: 'data_not_found',
                errorMessage: expect.any(String),
            });
        });

        it('should support subjectless records', async () => {
            const keyResult = await recordsController.createPublicRecordKey(
                recordName,
                'subjectless',
                userId
            );

            if (!keyResult.success) {
                throw new Error('Unable to create subjectless record key!');
            }

            const result = await server.handleRequest(
                httpDelete(
                    '/api/v2/records/data',
                    JSON.stringify({
                        recordKey: keyResult.recordKey,
                        address: 'testAddress',
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    address: 'testAddress',
                },
                headers: apiCorsHeaders,
            });

            const data = await dataStore.getData(recordName, 'testAddress');

            expect(data).toEqual({
                success: false,
                errorCode: 'data_not_found',
                errorMessage: expect.any(String),
            });
        });

        it('should return an unacceptable_request if given a non-string recordKey', async () => {
            const result = await server.handleRequest(
                httpDelete(
                    '/api/v2/records/data',
                    JSON.stringify({
                        recordKey: 123,
                        address: 'testAddress',
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

        it('should return an unacceptable_request if given a non-string address', async () => {
            const result = await server.handleRequest(
                httpDelete(
                    '/api/v2/records/data',
                    JSON.stringify({
                        recordKey,
                        address: 123,
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 400,
                body: {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage: 'address is required and must be a string.',
                },
                headers: apiCorsHeaders,
            });
        });

        testOrigin('DELETE', '/api/v2/records/data', () =>
            JSON.stringify({
                recordKey,
                address: 'testAddress',
            })
        );

        testAuthorization(
            () =>
                httpDelete(
                    '/api/v2/records/data',
                    JSON.stringify({
                        recordKey,
                        address: 'testAddress',
                    }),
                    apiHeaders
                ),
            'The user must be logged in in order to erase data using the provided record key.'
        );

        testBodyIsJson((body) =>
            httpDelete('/api/v2/records/data', body, apiHeaders)
        );
    });

    describe('GET /api/v2/records/data', () => {
        beforeEach(async () => {
            await dataController.recordData(
                recordKey,
                'testAddress',
                'hello, world!',
                userId,
                null,
                null
            );
        });

        it('should be able to get the data', async () => {
            const result = await server.handleRequest(
                httpGet(
                    `/api/v2/records/data?recordName=${recordName}&address=testAddress`,
                    defaultHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    data: 'hello, world!',
                    publisherId: userId,
                    subjectId: userId,
                    updatePolicy: true,
                    deletePolicy: true,
                },
                headers: corsHeaders(defaultHeaders['origin']),
            });
        });

        it('should return an unacceptable_request result when not given a recordName', async () => {
            const result = await server.handleRequest(
                httpGet(
                    `/api/v2/records/data?address=testAddress`,
                    defaultHeaders
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
                headers: corsHeaders(defaultHeaders['origin']),
            });
        });

        it('should return an unacceptable_request result when not given a address', async () => {
            const result = await server.handleRequest(
                httpGet(
                    `/api/v2/records/data?recordName=${recordName}`,
                    defaultHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 400,
                body: {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage: 'address is required and must be a string.',
                },
                headers: corsHeaders(defaultHeaders['origin']),
            });
        });

        it('should return a 404 when trying to get data that doesnt exist', async () => {
            const result = await server.handleRequest(
                httpGet(
                    `/api/v2/records/data?recordName=${recordName}&address=missing`,
                    defaultHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 404,
                body: {
                    success: false,
                    errorCode: 'data_not_found',
                    errorMessage: 'The data was not found.',
                },
                headers: corsHeaders(defaultHeaders['origin']),
            });
        });
    });

    describe('GET /api/v2/records/data/list', () => {
        beforeEach(async () => {
            await dataController.recordData(
                recordKey,
                'address3',
                'crazy message!',
                userId,
                null,
                null
            );
            await dataController.recordData(
                recordKey,
                'address1',
                'hello, world!',
                userId,
                null,
                null
            );
            await dataController.recordData(
                recordKey,
                'address2',
                'other message!',
                userId,
                null,
                null
            );
        });

        it('should return a list of data', async () => {
            const result = await server.handleRequest(
                httpGet(
                    `/api/v2/records/data/list?recordName=${recordName}`,
                    defaultHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    items: [
                        {
                            address: 'address3',
                            data: 'crazy message!',
                        },
                        {
                            address: 'address1',
                            data: 'hello, world!',
                        },
                        {
                            address: 'address2',
                            data: 'other message!',
                        },
                    ],
                },
                headers: corsHeaders(defaultHeaders['origin']),
            });
        });

        it('should be able to list data by address', async () => {
            const result = await server.handleRequest(
                httpGet(
                    `/api/v2/records/data/list?recordName=${recordName}&address=address1`,
                    defaultHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    items: [
                        {
                            address: 'address3',
                            data: 'crazy message!',
                        },
                        {
                            address: 'address2',
                            data: 'other message!',
                        },
                    ],
                },
                headers: corsHeaders(defaultHeaders['origin']),
            });
        });

        it('should return an unacceptable_request result when not given a recordName', async () => {
            const result = await server.handleRequest(
                httpGet(
                    `/api/v2/records/data/list?address=testAddress`,
                    defaultHeaders
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
                headers: corsHeaders(defaultHeaders['origin']),
            });
        });
    });

    describe('POST /api/v2/records/data', () => {
        it('should save the given manual data record', async () => {
            const result = await server.handleRequest(
                httpPost(
                    `/api/v2/records/data`,
                    JSON.stringify({
                        recordKey,
                        address: 'testAddress',
                        data: 'hello, world',
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    address: 'testAddress',
                },
                headers: apiCorsHeaders,
            });

            const data = await dataStore.getData(recordName, 'testAddress');
            expect(data).toEqual({
                success: true,
                data: 'hello, world',
                subjectId: userId,
                publisherId: userId,
                updatePolicy: true,
                deletePolicy: true,
            });
        });

        it('should support subjectless records', async () => {
            const keyResult = await recordsController.createPublicRecordKey(
                recordName,
                'subjectless',
                userId
            );

            if (!keyResult.success) {
                throw new Error('Unable to create subjectless key');
            }

            delete apiHeaders['authorization'];
            const result = await server.handleRequest(
                httpPost(
                    `/api/v2/records/data`,
                    JSON.stringify({
                        recordKey: keyResult.recordKey,
                        address: 'testAddress',
                        data: 'hello, world',
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    address: 'testAddress',
                },
                headers: apiCorsHeaders,
            });

            const data = await dataStore.getData(recordName, 'testAddress');
            expect(data).toEqual({
                success: true,
                data: 'hello, world',
                subjectId: null,
                publisherId: userId,
                updatePolicy: true,
                deletePolicy: true,
            });
        });

        it('should return an unacceptable_request result when given a non-string address', async () => {
            const result = await server.handleRequest(
                httpPost(
                    `/api/v2/records/data`,
                    JSON.stringify({
                        recordKey,
                        address: 123,
                        data: 'hello, world',
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 400,
                body: {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage: 'address is required and must be a string.',
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request result when given a non-string recordKey', async () => {
            const result = await server.handleRequest(
                httpPost(
                    `/api/v2/records/data`,
                    JSON.stringify({
                        recordKey: 123,
                        address: 'testAddress',
                        data: 'hello, world',
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

        it('should return an unacceptable_request result when given undefined data', async () => {
            const result = await server.handleRequest(
                httpPost(
                    `/api/v2/records/data`,
                    JSON.stringify({
                        recordKey,
                        address: 'testAddress',
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 400,
                body: {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage: 'data is required.',
                },
                headers: apiCorsHeaders,
            });
        });

        testOrigin('POST', `/api/v2/records/data`, () =>
            JSON.stringify({
                recordKey,
                address: 'testAddress',
                data: 'hello, world',
            })
        );
        testAuthorization(
            () =>
                httpPost(
                    '/api/v2/records/data',
                    JSON.stringify({
                        recordKey,
                        address: 'testAddress',
                        data: 'hello, world',
                    }),
                    apiHeaders
                ),
            'The user must be logged in in order to record data.'
        );
        testBodyIsJson((body) =>
            httpPost(`/api/v2/records/data`, body, apiHeaders)
        );
    });

    describe('POST /api/v2/records/key', () => {
        it('should create a record key', async () => {
            const result = await server.handleRequest(
                httpPost(
                    `/api/v2/records/key`,
                    JSON.stringify({
                        recordName: 'test',
                        policy: 'subjectfull',
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordKey: expect.any(String),
                    recordName: 'test',
                },
                headers: apiCorsHeaders,
            });

            const data = JSON.parse(result.body as string);

            expect(isRecordKey(data.recordKey)).toBe(true);

            const validation = await recordsController.validatePublicRecordKey(
                data.recordKey
            );
            expect(validation).toEqual({
                success: true,
                recordName: 'test',
                ownerId: userId,
                policy: 'subjectfull',
            });
        });

        it('should create a subjectless record key', async () => {
            const result = await server.handleRequest(
                httpPost(
                    `/api/v2/records/key`,
                    JSON.stringify({
                        recordName: 'test',
                        policy: 'subjectless',
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordKey: expect.any(String),
                    recordName: 'test',
                },
                headers: apiCorsHeaders,
            });

            const data = JSON.parse(result.body as string);

            expect(isRecordKey(data.recordKey)).toBe(true);

            const validation = await recordsController.validatePublicRecordKey(
                data.recordKey
            );
            expect(validation).toEqual({
                success: true,
                recordName: 'test',
                ownerId: userId,
                policy: 'subjectless',
            });
        });

        it('should return a unacceptable_request error if the recordName is not a string', async () => {
            const result = await server.handleRequest(
                httpPost(
                    `/api/v2/records/key`,
                    JSON.stringify({
                        recordName: 123,
                        policy: 'subjectfull',
                    }),
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

        testOrigin('POST', '/api/v2/records/key', () =>
            JSON.stringify({
                recordName: 'test',
                policy: 'subjectfull',
            })
        );

        testAuthorization(() =>
            httpPost(
                '/api/v2/records/key',
                JSON.stringify({
                    recordName: 'test',
                    policy: 'subjectfull',
                }),
                apiHeaders
            )
        );

        testBodyIsJson((body) =>
            httpPost('/api/v2/records/key', body, apiHeaders)
        );
    });

    describe('OPTIONS /api/v2/records', () => {
        it('should return a 204 response', async () => {
            const result = await server.handleRequest(
                httpRequest('OPTIONS', `/api/v2/records`, null, {
                    origin: apiHeaders['origin'],
                })
            );

            expectResponseBodyToEqual(result, {
                statusCode: 204,
                body: undefined,
                headers: {
                    'Access-Control-Allow-Origin': apiHeaders['origin'],
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers':
                        'Content-Type, Authorization',
                },
            });
        });
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
        const json = response.body
            ? JSON.parse(response.body as string)
            : undefined;

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
        getRequest: () => GenericHttpRequest,
        expectedMessage:
            | string
            | RegExp = /(The user is not logged in\. A session key must be provided for this operation\.)|(The user must be logged in in order to record events.)/
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
                    errorMessage: expect.stringMatching(expectedMessage),
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

    function corsHeaders(origin: string) {
        return {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        };
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

    function httpDelete(
        url: string,
        body: any,
        headers: GenericHttpHeaders = defaultHeaders,
        ipAddress: string = '123.456.789'
    ): GenericHttpRequest {
        return httpRequest('DELETE', url, body, headers, ipAddress);
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
