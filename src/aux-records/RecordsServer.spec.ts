import {
    parseAuthorization,
    RecordsServer,
    validateOrigin,
    getSessionKey,
} from './RecordsServer';
import {
    GenericHttpHeaders,
    GenericHttpRequest,
    GenericHttpResponse,
    GenericPathParameters,
    GenericQueryStringParameters,
    GenericWebsocketRequest,
} from './GenericHttpInterface';
import { AuthController, INVALID_KEY_ERROR_MESSAGE } from './AuthController';
import { MemoryAuthMessenger } from './MemoryAuthMessenger';
import {
    formatV1OpenAiKey,
    formatV1SessionKey,
    generateV1ConnectionToken,
    parseSessionKey,
} from './AuthUtils';
import { AuthSession, AuthUser } from './AuthStore';
import { LivekitController } from './LivekitController';
import { isRecordKey, RecordsController } from './RecordsController';
import { RecordsStore, Studio } from './RecordsStore';
import { EventRecordsController } from './EventRecordsController';
import { EventRecordsStore } from './EventRecordsStore';
import { DataRecordsController } from './DataRecordsController';
import { DataRecordsStore } from './DataRecordsStore';
import { FileRecordsController } from './FileRecordsController';
import { FileRecordsStore } from './FileRecordsStore';
import { getHash } from '@casual-simulation/crypto';
import { SubscriptionController } from './SubscriptionController';
import { StripeInterface, StripeProduct } from './StripeInterface';
import {
    SubscriptionConfiguration,
    allowAllFeatures,
} from './SubscriptionConfiguration';
import { PolicyController } from './PolicyController';
import {
    ACCOUNT_MARKER,
    ADMIN_ROLE_NAME,
    PRIVATE_MARKER,
    PUBLIC_READ_MARKER,
} from '@casual-simulation/aux-common';
import { RateLimitController } from './RateLimitController';
import { MemoryRateLimiter } from './MemoryRateLimiter';
import { RateLimiter } from '@casual-simulation/rate-limit-redis';
import { createTestUser } from './TestUtils';
import { AIController } from './AIController';
import {
    AIChatInterfaceRequest,
    AIChatInterfaceResponse,
} from './AIChatInterface';
import {
    AIGenerateSkyboxInterfaceRequest,
    AIGenerateSkyboxInterfaceResponse,
    AIGetSkyboxInterfaceResponse,
} from './AIGenerateSkyboxInterface';
import {
    AIGenerateImageInterfaceRequest,
    AIGenerateImageInterfaceResponse,
} from './AIImageInterface';
import { sortBy } from 'lodash';
import { MemoryStore } from './MemoryStore';
import { WebsocketController } from './websockets/WebsocketController';
import { MemoryWebsocketConnectionStore } from './websockets/MemoryWebsocketConnectionStore';
import { MemoryWebsocketMessenger } from './websockets/MemoryWebsocketMessenger';
import { InstRecordsStore } from './websockets/InstRecordsStore';
import { TemporaryInstRecordsStore } from './websockets/TemporaryInstRecordsStore';
import { SplitInstRecordsStore } from './websockets/SplitInstRecordsStore';
import { MemoryTempInstRecordsStore } from './websockets/MemoryTempInstRecordsStore';
import {
    LoginMessage,
    WebsocketDownloadRequestEvent,
    WebsocketEventTypes,
    WebsocketMessage,
    WebsocketMessageEvent,
    WebsocketUploadRequestEvent,
} from '@casual-simulation/aux-common/websockets/WebsocketEvents';
import { botAdded, createBot, toast } from '@casual-simulation/aux-common/bots';
import {
    device,
    remote,
} from '@casual-simulation/aux-common/common/RemoteActions';
import { ConnectionInfo } from '@casual-simulation/aux-common/common/ConnectionInfo';
import {
    YjsPartitionImpl,
    constructInitializationUpdate,
} from '@casual-simulation/aux-common';

console.log = jest.fn();

describe('RecordsServer', () => {
    let store: MemoryStore;
    let authMessenger: MemoryAuthMessenger;
    let authController: AuthController;
    let server: RecordsServer;
    let defaultHeaders: GenericHttpHeaders;
    let authenticatedHeaders: GenericHttpHeaders;
    let apiHeaders: GenericHttpHeaders;
    let livekitController: LivekitController;
    let recordsController: RecordsController;
    let eventsController: EventRecordsController;
    let dataController: DataRecordsController;
    let manualDataController: DataRecordsController;
    let manualDataStore: DataRecordsStore;
    let websocketConnectionStore: MemoryWebsocketConnectionStore;
    let instStore: InstRecordsStore;
    let tempInstStore: TemporaryInstRecordsStore;
    let websocketMessenger: MemoryWebsocketMessenger;
    let websocketController: WebsocketController;

    let policyController: PolicyController;

    let rateLimiter: RateLimiter;
    let rateLimitController: RateLimitController;

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
        getSubscriptionById: jest.Mock<any>;
    };

    let aiController: AIController;
    let chatInterface: {
        chat: jest.Mock<
            Promise<AIChatInterfaceResponse>,
            [AIChatInterfaceRequest]
        >;
    };
    let skyboxInterface: {
        generateSkybox: jest.Mock<
            Promise<AIGenerateSkyboxInterfaceResponse>,
            [AIGenerateSkyboxInterfaceRequest]
        >;
        getSkybox: jest.Mock<Promise<AIGetSkyboxInterfaceResponse>, [string]>;
    };
    let imageInterface: {
        generateImage: jest.Mock<
            Promise<AIGenerateImageInterfaceResponse>,
            [AIGenerateImageInterfaceRequest]
        >;
    };

    let stripe: StripeInterface;
    let subscriptionController: SubscriptionController;

    let allowedAccountOrigins: Set<string>;
    let allowedApiOrigins: Set<string>;
    let sessionKey: string;
    let connectionKey: string;
    let userId: string;
    let sessionId: string;
    let ownerId: string;
    let ownerSessionId: string;
    let ownerConnectionKey: string;
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

        store = new MemoryStore({
            subscriptions: {
                subscriptions: [
                    {
                        id: 'sub_id',
                        eligibleProducts: ['product_id'],
                        featureList: ['Feature 1', 'Feature 2'],
                        product: 'product_id',
                        defaultSubscription: true,
                    },
                ],
                webhookSecret: 'webhook_secret',
                cancelUrl: 'http://cancel_url',
                successUrl: 'http://success_url',
                returnUrl: 'http://return_url',
                tiers: {},
                defaultFeatures: {
                    user: allowAllFeatures(),
                    studio: allowAllFeatures(),
                },
            },
        });
        manualDataStore = new MemoryStore({
            subscriptions: null as any,
        });

        authMessenger = new MemoryAuthMessenger();
        authController = new AuthController(store, authMessenger, store);
        livekitController = new LivekitController(
            livekitApiKey,
            livekitSecretKey,
            livekitEndpoint
        );

        // const memRecordsStore = (store = new MemoryRecordsStore(
        //     store
        // ));
        recordsController = new RecordsController({
            auth: store,
            store,
            config: store,
            metrics: store,
        });

        policyController = new PolicyController(
            authController,
            recordsController,
            store
        );

        eventsController = new EventRecordsController({
            config: store,
            metrics: store,
            policies: policyController,
            store,
        });

        dataController = new DataRecordsController({
            config: store,
            metrics: store,
            policies: policyController,
            store,
        });

        manualDataController = new DataRecordsController({
            config: store,
            metrics: store,
            policies: policyController,
            store: manualDataStore,
        });

        filesController = new FileRecordsController({
            config: store,
            metrics: store,
            policies: policyController,
            store,
        });

        rateLimiter = new MemoryRateLimiter();
        rateLimitController = new RateLimitController(rateLimiter, {
            maxHits: 5,
            windowMs: 1000,
        });

        websocketConnectionStore = new MemoryWebsocketConnectionStore();
        websocketMessenger = new MemoryWebsocketMessenger();
        instStore = new SplitInstRecordsStore(
            new MemoryTempInstRecordsStore(),
            store
        );
        tempInstStore = new MemoryTempInstRecordsStore();
        websocketController = new WebsocketController(
            websocketConnectionStore,
            websocketMessenger,
            instStore,
            tempInstStore,
            authController,
            policyController,
            store,
            store
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
            getSubscriptionById: jest.fn(),
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
            store,
            store,
            store
        );

        chatInterface = {
            chat: jest.fn(),
        };
        skyboxInterface = {
            generateSkybox: jest.fn(),
            getSkybox: jest.fn(),
        };
        imageInterface = {
            generateImage: jest.fn(),
        };
        aiController = new AIController({
            chat: {
                interface: chatInterface,
                options: {
                    defaultModel: 'default-model',
                    allowedChatModels: ['model-1', 'model-2'],
                    allowedChatSubscriptionTiers: ['beta'],
                },
            },
            generateSkybox: {
                interface: skyboxInterface,
                options: {
                    allowedSubscriptionTiers: ['beta'],
                },
            },
            images: {
                interfaces: {
                    openai: imageInterface,
                },
                options: {
                    allowedModels: {
                        openai: ['model-1', 'model-2'],
                    },
                    allowedSubscriptionTiers: ['beta'],
                    defaultHeight: 512,
                    defaultWidth: 512,
                    maxHeight: 1024,
                    maxWidth: 1024,
                    defaultModel: 'model-1',
                    maxImages: 3,
                    maxSteps: 50,
                },
            },
            config: store,
            metrics: store,
        });

        server = new RecordsServer(
            allowedAccountOrigins,
            allowedApiOrigins,
            authController,
            livekitController,
            recordsController,
            eventsController,
            dataController,
            manualDataController,
            filesController,
            subscriptionController,
            rateLimitController,
            policyController,
            aiController,
            websocketController
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
        connectionKey = loginResult.connectionKey;
        userId = loginResult.userId;

        const services = {
            authStore: store,
            auth: authController,
            authMessenger: authMessenger,
            policies: policyController,
            records: recordsController,
            store,
            recordsStore: store,
            policyStore: store,
            configStore: store,
        };
        const owner = await createTestUser(services, 'owner@example.com');

        ownerId = owner.userId;
        ownerConnectionKey = owner.connectionKey;
        ownerSessionId = owner.sessionId;

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

        const record = await services.store.getRecordByName(recordName);
        await services.store.updateRecord({
            name: recordName,
            ownerId: ownerId,
            studioId: null,
            secretHashes: record.secretHashes,
            secretSalt: record.secretSalt,
        });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('GET /api/{userId}/metadata', () => {
        it('should return the metadata for the given userId', async () => {
            const result = await server.handleHttpRequest(
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
                    subscriptionTier: null,
                },
                headers: accountCorsHeaders,
            });
        });

        it('should be able to decode URI components for the userId', async () => {
            const userId =
                'did:ethr:0xA31b9288725d2B99137f4af10CaFdaA67B80C769';
            await store.saveNewUser({
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

            const result = await server.handleHttpRequest(
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
                    subscriptionTier: null,
                },
                headers: accountCorsHeaders,
            });
        });

        it('should return a 400 status code if given an invalid encoded user ID', async () => {
            const result = await server.handleHttpRequest({
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
            const result = await server.handleHttpRequest(
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
            const result = await server.handleHttpRequest(
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
            const result = await server.handleHttpRequest(
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
            const result = await server.handleHttpRequest(
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

        testRateLimit('GET', `/api/{userId:${userId}}/metadata`);
    });

    describe('PUT /api/{userId}/metadata', () => {
        it('should update the metadata for the given userId', async () => {
            const result = await server.handleHttpRequest(
                httpPut(
                    `/api/{userId:${userId}}/metadata`,
                    JSON.stringify({
                        name: 'Kal',
                        avatarUrl: 'https://example.com/avatar.png',
                        avatarPortraitUrl:
                            'https://example.com/avatar-portrait.png',
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

            const user = await store.findUser(userId);
            expect(user).toMatchObject({
                id: userId,
                name: 'Kal',
                avatarUrl: 'https://example.com/avatar.png',
                avatarPortraitUrl: 'https://example.com/avatar-portrait.png',
            });
        });

        it('should be able to decode URI components for the userId', async () => {
            const userId =
                'did:ethr:0xA31b9288725d2B99137f4af10CaFdaA67B80C769';
            await store.saveNewUser({
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

            const result = await server.handleHttpRequest(
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
            const result = await server.handleHttpRequest({
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
        testRateLimit('PUT', `/api/{userId:${userId}}/metadata`, () =>
            JSON.stringify({
                name: 'Kal',
            })
        );
    });

    describe('GET /api/{userId}/subscription', () => {
        let user: AuthUser;
        beforeEach(async () => {
            user = await store.findUser(userId);
            await store.saveUser({
                ...user,
                stripeCustomerId: 'customerId',
            });
            user = await store.findUser(userId);
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

            const result = await server.handleHttpRequest(
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
                            featureList: ['Feature 1', 'Feature 2'],
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

            const result = await server.handleHttpRequest(
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
            const result = await server.handleHttpRequest({
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
            const result = await server.handleHttpRequest(
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
            const result = await server.handleHttpRequest(
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
            const result = await server.handleHttpRequest(
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
            const result = await server.handleHttpRequest(
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

        testRateLimit('GET', `/api/{userId:${userId}}/subscription`);
    });

    describe('POST /api/{userId}/subscription/manage', () => {
        let user: AuthUser;
        beforeEach(async () => {
            user = await store.findUser(userId);
            await store.saveUser({
                ...user,
                stripeCustomerId: 'customerId',
            });
            user = await store.findUser(userId);
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
                url: 'http://portal_url',
            });

            const result = await server.handleHttpRequest(
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
                    url: 'http://portal_url',
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
                url: 'http://create_url',
            });

            stripeMock.createPortalSession.mockResolvedValueOnce({
                url: 'http://portal_url',
            });

            const result = await server.handleHttpRequest(
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
                    url: 'http://create_url',
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
                url: 'http://create_url',
            });

            stripeMock.createPortalSession.mockResolvedValueOnce({
                url: 'http://portal_url',
            });

            const result = await server.handleHttpRequest(
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
            const result = await server.handleHttpRequest({
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
            const result = await server.handleHttpRequest(
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
            const result = await server.handleHttpRequest(
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
            const result = await server.handleHttpRequest(
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
            const result = await server.handleHttpRequest(
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

        testRateLimit(
            'POST',
            `/api/{userId:${userId}}/subscription/manage`,
            () => ''
        );
    });

    describe('POST /api/stripeWebhook', () => {
        let user: AuthUser;
        beforeEach(async () => {
            user = await store.findUser(userId);
            await store.saveUser({
                ...user,
                stripeCustomerId: 'customer_id',
            });
            user = await store.findUser(userId);
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

                    const response = await server.handleHttpRequest(
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

                    const user = await store.findUser(userId);
                    expect(user.subscriptionStatus).toBe(status);
                }
            );
        });
    });

    describe('GET /api/emailRules', () => {
        it('should return a 404', async () => {
            store.emailRules.push(
                {
                    type: 'allow',
                    pattern: 'hello',
                },
                {
                    type: 'deny',
                    pattern: 'other',
                }
            );

            const result = await server.handleHttpRequest(
                httpGet(`/api/emailRules`, defaultHeaders)
            );

            expectResponseBodyToEqual(result, {
                statusCode: 404,
                body: {
                    success: false,
                    errorCode: 'operation_not_found',
                    errorMessage:
                        'An operation could not be found for the given request.',
                },
                headers: {
                    'Access-Control-Allow-Origin': 'test.com',
                    'Access-Control-Allow-Headers':
                        'Content-Type, Authorization',
                },
            });
        });
    });

    describe('GET /api/smsRules', () => {
        it('should return a 404', async () => {
            store.smsRules.push(
                {
                    type: 'allow',
                    pattern: 'hello',
                },
                {
                    type: 'deny',
                    pattern: 'other',
                }
            );

            const result = await server.handleHttpRequest(
                httpGet(`/api/smsRules`, defaultHeaders)
            );

            expectResponseBodyToEqual(result, {
                statusCode: 404,
                body: {
                    success: false,
                    errorCode: 'operation_not_found',
                    errorMessage:
                        'An operation could not be found for the given request.',
                },
                headers: {
                    'Access-Control-Allow-Origin': 'test.com',
                    'Access-Control-Allow-Headers':
                        'Content-Type, Authorization',
                },
            });
        });
    });

    describe('GET /api/v2/sessions', () => {
        it('should return the list of sessions for the user', async () => {
            const result = await server.handleHttpRequest(
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
            const result = await server.handleHttpRequest(
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
        testRateLimit('GET', `/api/v2/sessions`);
    });

    describe('POST /api/v2/replaceSession', () => {
        it('should replace the current session', async () => {
            const result = await server.handleHttpRequest(
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
                connectionKey: expect.any(String),
            });

            const parsed = parseSessionKey(data.sessionKey);

            expect(parsed).not.toBe(null);

            const [uid, sid] = parsed;

            const session = await store.findSession(uid, sid);

            expect(session.ipAddress).toBe('999.999.999.999');

            const old = await store.findSession(userId, sessionId);
            expect(old.revokeTimeMs).toBeGreaterThanOrEqual(old.grantedTimeMs);
        });

        testOrigin('POST', '/api/v2/replaceSession', () => '');
        testAuthorization(() =>
            httpPost('/api/v2/replaceSession', '', authenticatedHeaders)
        );
        testRateLimit('POST', `/api/v2/replaceSession`, () => '');
    });

    describe('POST /api/v2/revokeAllSessions', () => {
        it('should revoke all the sessions', async () => {
            const result = await server.handleHttpRequest(
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

            const user = await store.findUser(userId);
            expect(user.allSessionRevokeTimeMs).toBeGreaterThan(0);
        });

        testUrl('POST', '/api/v2/revokeAllSessions', () =>
            JSON.stringify({
                userId,
            })
        );
        testRateLimit('POST', `/api/v2/revokeAllSessions`, () =>
            JSON.stringify({
                userId,
            })
        );
    });

    describe('POST /api/v2/revokeSession', () => {
        it('should revoke the given session ID for the given user', async () => {
            let session: AuthSession = await store.findSession(
                userId,
                sessionId
            );
            expect(session.revokeTimeMs).toBeNull();

            const result = await server.handleHttpRequest(
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

            session = await store.findSession(userId, sessionId);
            expect(session.revokeTimeMs).toBeGreaterThan(0);
        });

        it('should revoke the given session key', async () => {
            let session: AuthSession = await store.findSession(
                userId,
                sessionId
            );
            expect(session.revokeTimeMs).toBeNull();

            const result = await server.handleHttpRequest(
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

            session = await store.findSession(userId, sessionId);
            expect(session.revokeTimeMs).toBeGreaterThan(0);
        });

        testUrl('POST', '/api/v2/revokeSession', () =>
            JSON.stringify({
                userId,
                sessionId,
            })
        );
        testRateLimit('POST', `/api/v2/revokeSession`, () =>
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
            const result = await server.handleHttpRequest(
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
                    connectionKey: expect.any(String),
                },
                headers: accountCorsHeaders,
            });

            const data = JSON.parse(result.body as string);

            expect(parseSessionKey(data.sessionKey)).not.toBeNull();
            expect(data.expireTimeMs).toBeGreaterThan(0);
        });

        it('should return an invalid_code result if the code is wrong', async () => {
            const result = await server.handleHttpRequest(
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
            const result = await server.handleHttpRequest(
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
        testRateLimit('POST', `/api/v2/completeLogin`, () =>
            JSON.stringify({
                userId,
                requestId,
                code,
            })
        );
    });

    describe('POST /api/v2/login', () => {
        it('should return a login request and send a auth message with the code', async () => {
            const result = await server.handleHttpRequest(
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
        testRateLimit('POST', `/api/v2/login`, () =>
            JSON.stringify({
                address: 'test@example.com',
                addressType: 'email',
            })
        );
    });

    describe('POST /api/v2/meet/token', () => {
        const roomName = 'test';
        const userName = 'userName';

        it('should create a new livekit token', async () => {
            const result = await server.handleHttpRequest(
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
        testRateLimit('POST', `/api/v2/meet/token`, () =>
            JSON.stringify({
                roomName,
                userName,
            })
        );
    });

    describe('POST /api/v2/records', () => {
        it('should create a new record', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    '/api/v2/records',
                    JSON.stringify({
                        recordName: 'myRecord',
                        ownerId: userId,
                    }),
                    authenticatedHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: accountCorsHeaders,
            });
        });

        it('should be able to create a record for a studio', async () => {
            await store.addStudio({
                id: 'studioId',
                displayName: 'myStudio',
            });

            await store.addStudioAssignment({
                studioId: 'studioId',
                userId: userId,
                isPrimaryContact: true,
                role: 'admin',
            });

            const result = await server.handleHttpRequest(
                httpPost(
                    '/api/v2/records',
                    JSON.stringify({
                        recordName: 'myRecord',
                        studioId: 'studioId',
                    }),
                    authenticatedHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: accountCorsHeaders,
            });
        });

        it('should return a 403 status code if the user does not have admin permissions for the studio', async () => {
            await store.addStudio({
                id: 'studioId',
                displayName: 'myStudio',
            });

            const result = await server.handleHttpRequest(
                httpPost(
                    '/api/v2/records',
                    JSON.stringify({
                        recordName: 'myRecord',
                        studioId: 'studioId',
                    }),
                    authenticatedHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to create a record for this studio.',
                },
                headers: accountCorsHeaders,
            });
        });

        it('should return a 403 status code when the record already exists', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    '/api/v2/records',
                    JSON.stringify({
                        recordName,
                        ownerId: userId,
                    }),
                    authenticatedHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'record_already_exists',
                    errorMessage: 'A record with that name already exists.',
                },
                headers: accountCorsHeaders,
            });
        });

        testUrl('POST', '/api/v2/records', () =>
            JSON.stringify({
                recordName: 'myRecord',
                ownerId: userId,
            })
        );
    });

    describe('POST /api/v2/records/events/count', () => {
        it('should add to the record event count', async () => {
            const result = await server.handleHttpRequest(
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
                ownerId
            );

            if (!keyResult.success) {
                throw new Error('Unable to create subjectless key');
            }

            delete apiHeaders['authorization'];
            const result = await server.handleHttpRequest(
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
            const result = await server.handleHttpRequest(
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
                    errorMessage:
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'recordKey must be a string.',
                            path: ['recordKey'],
                            received: 'number',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request when given a non-string eventName', async () => {
            const result = await server.handleHttpRequest(
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
                    errorMessage:
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'eventName must be a string.',
                            path: ['eventName'],
                            received: 'number',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request when given a non-number count', async () => {
            const result = await server.handleHttpRequest(
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
                    errorMessage:
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'number',
                            message: 'count must be a number.',
                            path: ['count'],
                            received: 'string',
                        },
                    ],
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
        testRateLimit('POST', `/api/v2/records/events/count`, () =>
            JSON.stringify({
                recordKey,
                eventName: 'testEvent',
                count: 2,
            })
        );
    });

    describe('GET /api/v2/records/events/count', () => {
        beforeEach(async () => {
            await eventsController.addCount(recordKey, 'testEvent', 5, userId);

            delete apiHeaders['authorization'];
        });

        it('should get the current record event count', async () => {
            const result = await server.handleHttpRequest(
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
                    markers: [PUBLIC_READ_MARKER],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return 0 when the event name doesnt exist', async () => {
            const result = await server.handleHttpRequest(
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
                    markers: [PUBLIC_READ_MARKER],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request result if recordName is omitted', async () => {
            const result = await server.handleHttpRequest(
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
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'recordName is required.',
                            path: ['recordName'],
                            received: 'undefined',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request result if eventName is omitted', async () => {
            const result = await server.handleHttpRequest(
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
                    errorMessage:
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'eventName is required.',
                            path: ['eventName'],
                            received: 'undefined',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        testOrigin(
            'GET',
            `/api/v2/records/events/count?recordName=recordName&eventName=testEvent`
        );
        testRateLimit('GET', `/api/v2/records/events/count`);
    });

    describe('GET /api/v2/records/events/list', () => {
        let events: any[];
        beforeEach(async () => {
            events = [];
            for (let i = 0; i < 20; i++) {
                const name = `test${i.toString().padStart(2, '0')}`;
                await eventsController.addCount(recordKey, name, i, userId);
                events.push({
                    eventName: name,
                    count: i,
                    markers: [PUBLIC_READ_MARKER],
                });
            }
        });

        it('should get a list of events', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/events/list?recordName=${recordName}`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    events: events.slice(0, 10),
                    totalCount: 20,
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return the events that are listed after the given event name', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/events/list?recordName=${recordName}&eventName=${'test05'}`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    events: events.slice(6, 16),
                    totalCount: 20,
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an empty list if the inst doesnt have permission', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/events/list?recordName=${recordName}&instances=inst`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    events: [],
                    totalCount: 20,
                },
                headers: apiCorsHeaders,
            });
        });

        it('should get a list of events if the inst and user have permission', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
                ['inst']: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/events/list?recordName=${recordName}&instances=inst`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    events: events.slice(0, 10),
                    totalCount: 20,
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request result if recordName is omitted', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/events/list?eventName=${'testEvent'}`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 400,
                body: {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage:
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'recordName is required.',
                            path: ['recordName'],
                            received: 'undefined',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        testRateLimit('GET', `/api/v2/records/events/list`);
    });

    describe('POST /api/v2/records/events', () => {
        beforeEach(async () => {
            await eventsController.updateEvent({
                recordKeyOrRecordName: recordKey,
                eventName: 'testEvent',
                userId,
                count: 5,
                markers: [PUBLIC_READ_MARKER],
            });
        });

        it('should update the event markers', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/events`,
                    JSON.stringify({
                        recordKey,
                        eventName: 'testEvent',
                        markers: ['secret'],
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: apiCorsHeaders,
            });

            expect(await store.getEventCount(recordName, 'testEvent')).toEqual({
                success: true,
                count: 5,
                markers: ['secret'],
            });
        });

        it('should update the event count', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/events`,
                    JSON.stringify({
                        recordKey,
                        eventName: 'testEvent',
                        count: 15,
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: apiCorsHeaders,
            });

            expect(await store.getEventCount(recordName, 'testEvent')).toEqual({
                success: true,
                count: 15,
                markers: [PUBLIC_READ_MARKER],
            });
        });

        it('should support subjectless record keys', async () => {
            const keyResult = await recordsController.createPublicRecordKey(
                recordName,
                'subjectless',
                ownerId
            );

            if (!keyResult.success) {
                throw new Error('Unable to create subjectless key');
            }

            delete apiHeaders['authorization'];

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/events`,
                    JSON.stringify({
                        recordKey: keyResult.recordKey,
                        eventName: 'testEvent',
                        count: 10,
                        markers: ['secret'],
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: apiCorsHeaders,
            });

            expect(await store.getEventCount(recordName, 'testEvent')).toEqual({
                success: true,
                count: 10,
                markers: ['secret'],
            });
        });

        it('should return an unacceptable_request result if recordKey is omitted', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/events`,
                    JSON.stringify({
                        eventName: 'testEvent',
                        count: 15,
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
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'recordKey is required.',
                            path: ['recordKey'],
                            received: 'undefined',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request result if eventName is omitted', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/events`,
                    JSON.stringify({
                        recordKey,
                        count: 15,
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
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'eventName is required.',
                            path: ['eventName'],
                            received: 'undefined',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        testOrigin('POST', `/api/v2/records/events`, () =>
            JSON.stringify({
                recordKey,
                eventName: 'testEvent',
                markers: ['secret'],
            })
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
            const result = await server.handleHttpRequest(
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
                ownerId
            );

            if (!keyResult.success) {
                throw new Error('Unable to create subjectless key');
            }

            delete apiHeaders['authorization'];
            const result = await server.handleHttpRequest(
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

        it('should delete the data if the user has permission', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            await manualDataController.recordData(
                recordKey,
                'testAddress',
                'hello, world!',
                userId,
                null,
                null,
                ['secret']
            );

            const result = await server.handleHttpRequest(
                httpDelete(
                    '/api/v2/records/manual/data',
                    JSON.stringify({
                        recordKey: recordName,
                        address: 'testAddress',
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    address: 'testAddress',
                    recordName,
                },
                headers: apiCorsHeaders,
            });

            const data = await manualDataStore.getData(
                recordName,
                'testAddress'
            );

            expect(data).toEqual({
                success: false,
                errorCode: 'data_not_found',
                errorMessage: expect.any(String),
            });
        });

        it('should return not_authorized if the user does not have permission', async () => {
            await manualDataController.recordData(
                recordKey,
                'testAddress',
                'hello, world!',
                userId,
                null,
                null,
                ['secret']
            );

            const result = await server.handleHttpRequest(
                httpDelete(
                    '/api/v2/records/manual/data',
                    JSON.stringify({
                        recordKey: recordName,
                        address: 'testAddress',
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        permission: 'data.delete',
                        role: null,
                        marker: 'secret',
                    },
                },
                headers: apiCorsHeaders,
            });

            const data = await manualDataStore.getData(
                recordName,
                'testAddress'
            );

            expect(data).toEqual({
                success: true,
                data: 'hello, world!',
                publisherId: userId,
                subjectId: userId,
                deletePolicy: true,
                updatePolicy: true,
                markers: ['secret'],
            });
        });

        it('should return not_authorized if the inst does not have permission', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            await manualDataController.recordData(
                recordKey,
                'testAddress',
                'hello, world!',
                userId,
                null,
                null,
                ['secret']
            );

            const result = await server.handleHttpRequest(
                httpDelete(
                    '/api/v2/records/manual/data',
                    JSON.stringify({
                        recordKey: recordName,
                        address: 'testAddress',
                        instances: ['inst'],
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'inst',
                        id: 'inst',
                        permission: 'data.delete',
                        role: null,
                        marker: 'secret',
                    },
                },
                headers: apiCorsHeaders,
            });

            const data = await manualDataStore.getData(
                recordName,
                'testAddress'
            );

            expect(data).toEqual({
                success: true,
                data: 'hello, world!',
                publisherId: userId,
                subjectId: userId,
                deletePolicy: true,
                updatePolicy: true,
                markers: ['secret'],
            });
        });

        it('should return an unacceptable_request result when given a non-string recordKey', async () => {
            const result = await server.handleHttpRequest(
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
                    errorMessage:
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'recordKey must be a string.',
                            path: ['recordKey'],
                            received: 'number',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request result when given a non-string address', async () => {
            const result = await server.handleHttpRequest(
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
                    errorMessage:
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'address must be a string.',
                            path: ['address'],
                            received: 'number',
                        },
                    ],
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
        testRateLimit('DELETE', `/api/v2/records/manual/data`, () =>
            JSON.stringify({
                recordKey,
                address: 'testAddress',
            })
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
            const result = await server.handleHttpRequest(
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
                    markers: [PUBLIC_READ_MARKER],
                },
                headers: corsHeaders(defaultHeaders['origin']),
            });
        });

        it('should return a 401 when the user needs to be logged in', async () => {
            await manualDataController.recordData(
                recordKey,
                'testAddress',
                'hello, world!',
                userId,
                null,
                null,
                ['secret']
            );

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/manual/data?recordName=${recordName}&address=testAddress`,
                    defaultHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 401,
                body: {
                    success: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in. Please provide a sessionKey or a recordKey.',
                },
                headers: corsHeaders(defaultHeaders['origin']),
            });
        });

        it('should return a 403 when the user is not authorized', async () => {
            await manualDataController.recordData(
                recordKey,
                'testAddress',
                'hello, world!',
                userId,
                null,
                null,
                ['secret']
            );

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/manual/data?recordName=${recordName}&address=testAddress`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        permission: 'data.read',
                        marker: 'secret',
                        role: null,
                    },
                },
                headers: corsHeaders(apiHeaders['origin']),
            });
        });

        it('should return a 403 when the inst is not authorized', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            await manualDataController.recordData(
                recordKey,
                'testAddress',
                'hello, world!',
                userId,
                null,
                null,
                ['secret']
            );

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/manual/data?recordName=${recordName}&address=testAddress&instances=${'inst'}`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'inst',
                        id: 'inst',
                        permission: 'data.read',
                        marker: 'secret',
                        role: null,
                    },
                },
                headers: corsHeaders(apiHeaders['origin']),
            });
        });

        it('should return an unacceptable_request result when not given a recordName', async () => {
            const result = await server.handleHttpRequest(
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
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'recordName is required.',
                            path: ['recordName'],
                            received: 'undefined',
                        },
                    ],
                },
                headers: corsHeaders(defaultHeaders['origin']),
            });
        });

        it('should return an unacceptable_request result when not given a address', async () => {
            const result = await server.handleHttpRequest(
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
                    errorMessage:
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'address is required.',
                            path: ['address'],
                            received: 'undefined',
                        },
                    ],
                },
                headers: corsHeaders(defaultHeaders['origin']),
            });
        });

        it('should return a 404 when trying to get data that doesnt exist', async () => {
            const result = await server.handleHttpRequest(
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

        testRateLimit(() =>
            httpGet(
                `/api/v2/records/manual/data?recordName=${recordName}&address=testAddress`
            )
        );
    });

    describe('POST /api/v2/records/manual/data', () => {
        it('should save the given manual data record', async () => {
            const result = await server.handleHttpRequest(
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
                markers: [PUBLIC_READ_MARKER],
            });
        });

        it('should support subjectless records', async () => {
            const keyResult = await recordsController.createPublicRecordKey(
                recordName,
                'subjectless',
                ownerId
            );

            if (!keyResult.success) {
                throw new Error('Unable to create subjectless key');
            }

            delete apiHeaders['authorization'];
            const result = await server.handleHttpRequest(
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
                publisherId: ownerId,
                updatePolicy: true,
                deletePolicy: true,
                markers: [PUBLIC_READ_MARKER],
            });
        });

        it('should reject the request if the user is not authorized', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/manual/data`,
                    JSON.stringify({
                        recordKey: recordName,
                        address: 'testAddress',
                        data: 'hello, world',
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        permission: 'data.create',
                        marker: 'publicRead',
                        kind: 'user',
                        id: userId,
                        role: null,
                    },
                },
                headers: apiCorsHeaders,
            });

            const data = await store.getData(recordName, 'testAddress');
            expect(data).toEqual({
                success: false,
                errorCode: 'data_not_found',
                errorMessage: 'The data was not found.',
            });
        });

        it('should reject the request if the inst is not authorized', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/manual/data`,
                    JSON.stringify({
                        recordKey: recordName,
                        address: 'testAddress',
                        data: 'hello, world',
                        instances: ['inst'],
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        permission: 'data.create',
                        marker: 'publicRead',
                        kind: 'inst',
                        id: 'inst',
                        role: null,
                    },
                },
                headers: apiCorsHeaders,
            });

            const data = await store.getData(recordName, 'testAddress');
            expect(data).toEqual({
                success: false,
                errorCode: 'data_not_found',
                errorMessage: 'The data was not found.',
            });
        });

        it('should return an unacceptable_request result when given a non-string address', async () => {
            const result = await server.handleHttpRequest(
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
                    errorMessage:
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'address must be a string.',
                            path: ['address'],
                            received: 'number',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request result when given a non-string recordKey', async () => {
            const result = await server.handleHttpRequest(
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
                    errorMessage:
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'recordKey must be a string.',
                            path: ['recordKey'],
                            received: 'number',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request result when given undefined data', async () => {
            const result = await server.handleHttpRequest(
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
        testRateLimit('POST', `/api/v2/records/manual/data`, () =>
            JSON.stringify({
                recordKey,
                address: 'testAddress',
                data: 'hello, world',
            })
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
            const result = await server.handleHttpRequest(
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

            const data = await store.getFileRecord(recordName, fileName);
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
                ownerId
            );

            if (!keyResult.success) {
                throw new Error('Unable to create subjectless record key!');
            }

            const result = await server.handleHttpRequest(
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

            const data = await store.getFileRecord(recordName, fileName);
            expect(data).toEqual({
                success: false,
                errorCode: 'file_not_found',
                errorMessage: expect.any(String),
            });
        });

        it('should support instances', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpDelete(
                    `/api/v2/records/file`,
                    JSON.stringify({
                        recordKey: recordName,
                        fileUrl,
                        instances: ['inst'],
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'inst',
                        id: 'inst',
                        permission: 'file.delete',
                        role: null,
                        marker: PUBLIC_READ_MARKER,
                    },
                },
                headers: apiCorsHeaders,
            });

            const data = await store.getFileRecord(recordName, fileName);
            expect(data).toMatchObject({
                success: true,
            });
        });

        it('should return an unacceptable_request if given a non-string recordKey', async () => {
            const result = await server.handleHttpRequest(
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
                    errorMessage:
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'recordKey must be a string.',
                            path: ['recordKey'],
                            received: 'number',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request if given a non-string fileUrl', async () => {
            const result = await server.handleHttpRequest(
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
                    errorMessage:
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'fileUrl must be a string.',
                            path: ['fileUrl'],
                            received: 'number',
                        },
                    ],
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
        testRateLimit('DELETE', `/api/v2/records/file`, () =>
            JSON.stringify({
                recordKey,
                fileUrl,
            })
        );
    });

    describe('POST /api/v2/records/file', () => {
        it('should create an un-uploaded file record', async () => {
            const hash = getHash('hello');
            const result = await server.handleHttpRequest(
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
                    markers: [PUBLIC_READ_MARKER],
                },
                headers: apiCorsHeaders,
            });

            const data = await store.getFileRecord(recordName, `${hash}.json`);
            expect(data).toEqual({
                success: true,
                recordName: 'testRecord',
                fileName: `${hash}.json`,
                publisherId: userId,
                subjectId: userId,
                sizeInBytes: 10,
                description: 'description',
                url: `http://localhost:9191/${recordName}/${hash}.json`,
                uploaded: false,
                markers: [PUBLIC_READ_MARKER],
            });
        });

        it('should support subjectless record keys', async () => {
            const keyResult = await recordsController.createPublicRecordKey(
                recordName,
                'subjectless',
                ownerId
            );

            if (!keyResult.success) {
                throw new Error('Unable to create subjectless record key!');
            }

            const hash = getHash('hello');
            const result = await server.handleHttpRequest(
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
                    markers: [PUBLIC_READ_MARKER],
                },
                headers: apiCorsHeaders,
            });

            const data = await store.getFileRecord(recordName, `${hash}.json`);
            expect(data).toEqual({
                success: true,
                recordName: 'testRecord',
                fileName: `${hash}.json`,
                publisherId: ownerId,
                subjectId: null,
                sizeInBytes: 10,
                description: 'description',
                url: `http://localhost:9191/${recordName}/${hash}.json`,
                uploaded: false,
                markers: [PUBLIC_READ_MARKER],
            });
        });

        it('should support markers', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const hash = getHash('hello');
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/file`,
                    JSON.stringify({
                        recordKey: recordName,
                        fileSha256Hex: hash,
                        fileByteLength: 10,
                        fileMimeType: 'application/json',
                        fileDescription: 'description',
                        markers: ['secret'],
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
                    markers: ['secret'],
                },
                headers: apiCorsHeaders,
            });

            const data = await store.getFileRecord(recordName, `${hash}.json`);
            expect(data).toEqual({
                success: true,
                recordName: 'testRecord',
                fileName: `${hash}.json`,
                publisherId: userId,
                subjectId: userId,
                sizeInBytes: 10,
                description: 'description',
                url: `http://localhost:9191/${recordName}/${hash}.json`,
                uploaded: false,
                markers: ['secret'],
            });
        });

        it('should support instances', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const hash = getHash('hello');
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/file`,
                    JSON.stringify({
                        recordKey: recordName,
                        fileSha256Hex: hash,
                        fileByteLength: 10,
                        fileMimeType: 'application/json',
                        fileDescription: 'description',
                        instances: ['inst'],
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'inst',
                        id: 'inst',
                        permission: 'file.create',
                        role: null,
                        marker: PUBLIC_READ_MARKER,
                    },
                },
                headers: apiCorsHeaders,
            });

            const data = await store.getFileRecord(recordName, `${hash}.json`);
            expect(data).toMatchObject({
                success: false,
            });
        });

        it('should return an unacceptable_request if given a non-string recordKey', async () => {
            const hash = getHash('hello');
            const result = await server.handleHttpRequest(
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
                    errorMessage:
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'recordKey must be a string.',
                            path: ['recordKey'],
                            received: 'number',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request if given a non-string fileSha256Hex', async () => {
            const hash = getHash('hello');
            const result = await server.handleHttpRequest(
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
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'fileSha256Hex must be a string.',
                            path: ['fileSha256Hex'],
                            received: 'number',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request if given a non-number fileByteLength', async () => {
            const hash = getHash('hello');
            const result = await server.handleHttpRequest(
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
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'number',
                            message:
                                'fileByteLength must be a positive integer number.',
                            path: ['fileByteLength'],
                            received: 'string',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request if given a non-string fileMimeType', async () => {
            const hash = getHash('hello');
            const result = await server.handleHttpRequest(
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
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'fileMimeType must be a string.',
                            path: ['fileMimeType'],
                            received: 'number',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request if given a non-string fileDescription', async () => {
            const hash = getHash('hello');
            const result = await server.handleHttpRequest(
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
                    errorMessage:
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'fileDescription must be a string.',
                            path: ['fileDescription'],
                            received: 'number',
                        },
                    ],
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

        testRateLimit('POST', `/api/v2/records/file`, () =>
            JSON.stringify({
                recordKey,
                fileSha256Hex: 'hash',
                fileByteLength: 10,
                fileMimeType: 'application/json',
                fileDescription: 'description',
            })
        );
    });

    describe('GET /api/v2/records/file', () => {
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
                    markers: ['secret'],
                }
            );
            if (!fileResult.success) {
                throw new Error('Unable to record file!');
            }
            fileName = fileResult.fileName;
            fileUrl = fileResult.uploadUrl;
        });

        it('should get a link to the file with the given name', async () => {
            store.policies[recordName] = {
                ['secret']: {
                    document: {
                        permissions: [
                            {
                                type: 'file.read',
                                role: 'developer',
                            },
                        ],
                    },
                    markers: [ACCOUNT_MARKER],
                },
            };

            store.roles[recordName] = {
                [userId]: new Set(['developer']),
            };

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/file?recordName=${recordName}&fileName=${fileName}`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    requestUrl: `http://localhost:9191/${recordName}/${fileName}`,
                    requestMethod: 'GET',
                    requestHeaders: {
                        'record-name': recordName,
                    },
                },
                headers: apiCorsHeaders,
            });
        });

        it('should get a link to the file at the given URL', async () => {
            store.policies[recordName] = {
                ['secret']: {
                    document: {
                        permissions: [
                            {
                                type: 'file.read',
                                role: 'developer',
                            },
                        ],
                    },
                    markers: [ACCOUNT_MARKER],
                },
            };

            store.roles[recordName] = {
                [userId]: new Set(['developer']),
            };

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/file?fileUrl=${encodeURIComponent(
                        fileUrl
                    )}`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    requestUrl: `http://localhost:9191/${recordName}/${fileName}`,
                    requestMethod: 'GET',
                    requestHeaders: {
                        'record-name': recordName,
                    },
                },
                headers: apiCorsHeaders,
            });
        });

        it('should support subjectless record keys', async () => {
            const keyResult = await recordsController.createPublicRecordKey(
                recordName,
                'subjectless',
                ownerId
            );

            if (!keyResult.success) {
                throw new Error('Unable to create subjectless record key!');
            }

            delete apiHeaders['Authorization'];

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/file?recordName=${keyResult.recordKey}&fileName=${fileName}`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    requestUrl: `http://localhost:9191/${recordName}/${fileName}`,
                    requestMethod: 'GET',
                    requestHeaders: {
                        'record-name': recordName,
                    },
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request if given a fileName but no recordName', async () => {
            const result = await server.handleHttpRequest(
                httpGet(`/api/v2/records/file?fileName=${fileName}`, apiHeaders)
            );

            expectResponseBodyToEqual(result, {
                statusCode: 400,
                body: {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage:
                        'recordName is required when fileName is provided.',
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request if given given a recordName but no fileName', async () => {
            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/file?recordName=${recordName}`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 400,
                body: {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage:
                        'fileName is required when recordName is provided.',
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request if given neither a recordName or a fileName', async () => {
            const result = await server.handleHttpRequest(
                httpGet(`/api/v2/records/file`, apiHeaders)
            );

            expectResponseBodyToEqual(result, {
                statusCode: 400,
                body: {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage:
                        'fileUrl or both recordName and fileName are required.',
                },
                headers: apiCorsHeaders,
            });
        });

        testAuthorization(
            () =>
                httpGet(
                    `/api/v2/records/file?recordName=${recordName}&fileName=${fileName}`,
                    apiHeaders
                ),
            'The user must be logged in. Please provide a sessionKey or a recordKey.'
        );

        testRateLimit('GET', `/api/v2/records/file`);
    });

    describe('GET /api/v2/records/file/list', () => {
        beforeEach(async () => {
            await store.addFileRecord(
                recordName,
                'test1.txt',
                userId,
                userId,
                10,
                'description',
                [PUBLIC_READ_MARKER]
            );
            await store.addFileRecord(
                recordName,
                'test2.txt',
                userId,
                userId,
                10,
                'description',
                [PUBLIC_READ_MARKER]
            );
            await store.addFileRecord(
                recordName,
                'test3.txt',
                userId,
                userId,
                10,
                'description',
                [PUBLIC_READ_MARKER]
            );
            await store.setFileRecordAsUploaded(recordName, 'test1.txt');
            await store.setFileRecordAsUploaded(recordName, 'test2.txt');
            await store.setFileRecordAsUploaded(recordName, 'test3.txt');
        });

        it('should return a list of files', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/file/list?recordName=${recordName}`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    files: [
                        {
                            fileName: 'test1.txt',
                            sizeInBytes: 10,
                            description: 'description',
                            url: 'http://localhost:9191/testRecord/test1.txt',
                            uploaded: true,
                            markers: [PUBLIC_READ_MARKER],
                        },
                        {
                            fileName: 'test2.txt',
                            sizeInBytes: 10,
                            description: 'description',
                            url: 'http://localhost:9191/testRecord/test2.txt',
                            uploaded: true,
                            markers: [PUBLIC_READ_MARKER],
                        },
                        {
                            fileName: 'test3.txt',
                            sizeInBytes: 10,
                            description: 'description',
                            url: 'http://localhost:9191/testRecord/test3.txt',
                            uploaded: true,
                            markers: [PUBLIC_READ_MARKER],
                        },
                    ],
                    totalCount: 3,
                },
                headers: apiCorsHeaders,
            });
        });

        it('should be able to list files by name', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/file/list?recordName=${recordName}&fileName=test2`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    files: [
                        {
                            fileName: 'test2.txt',
                            sizeInBytes: 10,
                            description: 'description',
                            url: 'http://localhost:9191/testRecord/test2.txt',
                            uploaded: true,
                            markers: [PUBLIC_READ_MARKER],
                        },
                        {
                            fileName: 'test3.txt',
                            sizeInBytes: 10,
                            description: 'description',
                            url: 'http://localhost:9191/testRecord/test3.txt',
                            uploaded: true,
                            markers: [PUBLIC_READ_MARKER],
                        },
                    ],
                    totalCount: 3,
                },
                headers: apiCorsHeaders,
            });
        });

        it('should list what the user can access', async () => {
            store.roles[recordName] = {
                [userId]: new Set(['developer']),
            };

            store.policies[recordName] = {
                ['secret']: {
                    document: {
                        permissions: [
                            {
                                type: 'file.list',
                                role: 'developer',
                            },
                        ],
                    },
                    markers: [ACCOUNT_MARKER],
                },
            };

            await store.updateFileRecord(recordName, 'test1.txt', ['secret']);
            await store.updateFileRecord(recordName, 'test3.txt', ['secret']);

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/file/list?recordName=${recordName}`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    files: [
                        {
                            fileName: 'test1.txt',
                            sizeInBytes: 10,
                            description: 'description',
                            url: 'http://localhost:9191/testRecord/test1.txt',
                            uploaded: true,
                            markers: ['secret'],
                        },
                        {
                            fileName: 'test3.txt',
                            sizeInBytes: 10,
                            description: 'description',
                            url: 'http://localhost:9191/testRecord/test3.txt',
                            uploaded: true,
                            markers: ['secret'],
                        },
                    ],
                    totalCount: 3,
                },
                headers: apiCorsHeaders,
            });
        });

        it('should list what the inst can access', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
                ['inst']: new Set(['developer']),
            };

            store.policies[recordName] = {
                ['secret']: {
                    document: {
                        permissions: [
                            {
                                type: 'file.list',
                                role: 'developer',
                            },
                        ],
                    },
                    markers: [ACCOUNT_MARKER],
                },
            };
            await store.updateFileRecord(recordName, 'test1.txt', ['secret']);
            await store.updateFileRecord(recordName, 'test3.txt', ['secret']);

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/file/list?recordName=${recordName}&instances=${'inst'}`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    files: [
                        {
                            fileName: 'test1.txt',
                            sizeInBytes: 10,
                            description: 'description',
                            url: 'http://localhost:9191/testRecord/test1.txt',
                            uploaded: true,
                            markers: ['secret'],
                        },
                        {
                            fileName: 'test3.txt',
                            sizeInBytes: 10,
                            description: 'description',
                            url: 'http://localhost:9191/testRecord/test3.txt',
                            uploaded: true,
                            markers: ['secret'],
                        },
                    ],
                    totalCount: 3,
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request result when not given a recordName', async () => {
            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/file/list?fileName=testAddress`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 400,
                body: {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage:
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'recordName is required.',
                            path: ['recordName'],
                            received: 'undefined',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        testRateLimit(() =>
            httpGet(
                `/api/v2/records/file/list?recordName=${recordName}`,
                apiHeaders
            )
        );
    });

    describe('PUT /api/v2/records/file', () => {
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
                    markers: ['secret'],
                }
            );
            if (!fileResult.success) {
                throw new Error('Unable to record file!');
            }
            fileName = fileResult.fileName;
            fileUrl = fileResult.uploadUrl;

            store.policies[recordName] = {
                ['secret']: {
                    document: {
                        permissions: [
                            {
                                type: 'file.update',
                                role: 'developer',
                            },
                            {
                                type: 'policy.unassign',
                                role: 'developer',
                                policies: true,
                            },
                        ],
                    },
                    markers: [ACCOUNT_MARKER],
                },
                ['other']: {
                    document: {
                        permissions: [
                            {
                                type: 'file.update',
                                role: 'developer',
                            },
                            {
                                type: 'policy.assign',
                                role: 'developer',
                                policies: true,
                            },
                        ],
                    },
                    markers: [ACCOUNT_MARKER],
                },
            };

            store.roles[recordName] = {
                [userId]: new Set(['developer']),
            };
        });

        it('should update the markers on the file with the given URL', async () => {
            const result = await server.handleHttpRequest(
                httpPut(
                    `/api/v2/records/file`,
                    JSON.stringify({
                        recordKey,
                        fileUrl,
                        markers: ['other'],
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: apiCorsHeaders,
            });

            const data = await store.getFileRecord(recordName, fileName);
            expect(data).toEqual({
                success: true,
                recordName: 'testRecord',
                fileName: fileName,
                publisherId: userId,
                subjectId: userId,
                sizeInBytes: 10,
                description: 'desc',
                url: `http://localhost:9191/${recordName}/${fileName}`,
                uploaded: false,
                markers: ['other'],
            });
        });

        it('should support subjectless record keys', async () => {
            const keyResult = await recordsController.createPublicRecordKey(
                recordName,
                'subjectless',
                ownerId
            );

            if (!keyResult.success) {
                throw new Error('Unable to create subjectless record key!');
            }

            const result = await server.handleHttpRequest(
                httpPut(
                    `/api/v2/records/file`,
                    JSON.stringify({
                        recordKey: keyResult.recordKey,
                        fileUrl,
                        markers: ['other'],
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: apiCorsHeaders,
            });

            const data = await store.getFileRecord(recordName, fileName);
            expect(data).toEqual({
                success: true,
                recordName: 'testRecord',
                fileName: fileName,
                publisherId: userId,
                subjectId: userId,
                sizeInBytes: 10,
                description: 'desc',
                url: `http://localhost:9191/${recordName}/${fileName}`,
                uploaded: false,
                markers: ['other'],
            });
        });

        it('should return an unacceptable_request if given a non-string recordKey', async () => {
            const result = await server.handleHttpRequest(
                httpPut(
                    `/api/v2/records/file`,
                    JSON.stringify({
                        recordKey: 123,
                        fileUrl,
                        markers: ['other'],
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
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'recordKey must be a string.',
                            path: ['recordKey'],
                            received: 'number',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request if given a non-string fileUrl', async () => {
            const result = await server.handleHttpRequest(
                httpPut(
                    `/api/v2/records/file`,
                    JSON.stringify({
                        recordKey,
                        fileUrl: 123,
                        markers: ['other'],
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
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'fileUrl must be a string.',
                            path: ['fileUrl'],
                            received: 'number',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request if given a non-array markers', async () => {
            const result = await server.handleHttpRequest(
                httpPut(
                    `/api/v2/records/file`,
                    JSON.stringify({
                        recordKey,
                        fileUrl,
                        markers: 123,
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
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'array',
                            message: 'markers must be an array of strings.',
                            path: ['markers'],
                            received: 'number',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        testOrigin('PUT', '/api/v2/records/file', () =>
            JSON.stringify({
                recordKey,
                fileUrl,
                markers: ['test'],
            })
        );
        testAuthorization(
            () =>
                httpPut(
                    '/api/v2/records/file',
                    JSON.stringify({
                        recordKey,
                        fileUrl,
                        markers: ['test'],
                    }),
                    apiHeaders
                ),
            'The user must be logged in in order to update files.'
        );

        testBodyIsJson((body) =>
            httpPut('/api/v2/records/file', body, apiHeaders)
        );
        testRateLimit('PUT', `/api/v2/records/file`, () =>
            JSON.stringify({
                recordKey,
                fileUrl,
                markers: ['test'],
            })
        );
    });

    describe('OPTIONS /api/v2/records/file/*', () => {
        it('should return Access-Control-Allow-Headers with the headers that the file store returns', async () => {
            const result = await server.handleHttpRequest(
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
            const result = await server.handleHttpRequest(
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

            const data = await store.getData(recordName, 'testAddress');

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
                ownerId
            );

            if (!keyResult.success) {
                throw new Error('Unable to create subjectless record key!');
            }

            const result = await server.handleHttpRequest(
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

            const data = await store.getData(recordName, 'testAddress');

            expect(data).toEqual({
                success: false,
                errorCode: 'data_not_found',
                errorMessage: expect.any(String),
            });
        });

        it('should delete the data if the user has permission', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            await dataController.recordData(
                recordKey,
                'testAddress',
                'hello, world!',
                userId,
                null,
                null,
                ['secret']
            );

            const result = await server.handleHttpRequest(
                httpDelete(
                    '/api/v2/records/data',
                    JSON.stringify({
                        recordKey: recordName,
                        address: 'testAddress',
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    address: 'testAddress',
                    recordName,
                },
                headers: apiCorsHeaders,
            });

            const data = await store.getData(recordName, 'testAddress');

            expect(data).toEqual({
                success: false,
                errorCode: 'data_not_found',
                errorMessage: expect.any(String),
            });
        });

        it('should return not_authorized if the user does not have permission', async () => {
            await dataController.recordData(
                recordKey,
                'testAddress',
                'hello, world!',
                userId,
                null,
                null,
                ['secret']
            );

            const result = await server.handleHttpRequest(
                httpDelete(
                    '/api/v2/records/data',
                    JSON.stringify({
                        recordKey: recordName,
                        address: 'testAddress',
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        permission: 'data.delete',
                        role: null,
                        marker: 'secret',
                    },
                },
                headers: apiCorsHeaders,
            });

            const data = await store.getData(recordName, 'testAddress');

            expect(data).toEqual({
                success: true,
                data: 'hello, world!',
                publisherId: userId,
                subjectId: userId,
                deletePolicy: true,
                updatePolicy: true,
                markers: ['secret'],
            });
        });

        it('should return not_authorized if the inst does not have permission', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            await dataController.recordData(
                recordKey,
                'testAddress',
                'hello, world!',
                userId,
                null,
                null,
                ['secret']
            );

            const result = await server.handleHttpRequest(
                httpDelete(
                    '/api/v2/records/data',
                    JSON.stringify({
                        recordKey: recordName,
                        address: 'testAddress',
                        instances: ['inst'],
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'inst',
                        id: 'inst',
                        permission: 'data.delete',
                        role: null,
                        marker: 'secret',
                    },
                },
                headers: apiCorsHeaders,
            });

            const data = await store.getData(recordName, 'testAddress');

            expect(data).toEqual({
                success: true,
                data: 'hello, world!',
                publisherId: userId,
                subjectId: userId,
                deletePolicy: true,
                updatePolicy: true,
                markers: ['secret'],
            });
        });

        it('should return an unacceptable_request if given a non-string recordKey', async () => {
            const result = await server.handleHttpRequest(
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
                    errorMessage:
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'recordKey must be a string.',
                            path: ['recordKey'],
                            received: 'number',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request if given a non-string address', async () => {
            const result = await server.handleHttpRequest(
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
                    errorMessage:
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'address must be a string.',
                            path: ['address'],
                            received: 'number',
                        },
                    ],
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

        testRateLimit('DELETE', `/api/v2/records/data`, () =>
            JSON.stringify({
                recordKey,
                address: 'testAddress',
            })
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
            const result = await server.handleHttpRequest(
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
                    markers: [PUBLIC_READ_MARKER],
                },
                headers: corsHeaders(defaultHeaders['origin']),
            });
        });

        it('should return a 401 when the user needs to be logged in', async () => {
            await dataController.recordData(
                recordKey,
                'testAddress',
                'hello, world!',
                userId,
                null,
                null,
                ['secret']
            );

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/data?recordName=${recordName}&address=testAddress`,
                    defaultHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 401,
                body: {
                    success: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in. Please provide a sessionKey or a recordKey.',
                },
                headers: corsHeaders(defaultHeaders['origin']),
            });
        });

        it('should return a 403 when the user is not authorized', async () => {
            await dataController.recordData(
                recordKey,
                'testAddress',
                'hello, world!',
                userId,
                null,
                null,
                ['secret']
            );

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/data?recordName=${recordName}&address=testAddress`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        permission: 'data.read',
                        marker: 'secret',
                        role: null,
                    },
                },
                headers: corsHeaders(apiHeaders['origin']),
            });
        });

        it('should return a 403 when the inst is not authorized', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            await dataController.recordData(
                recordKey,
                'testAddress',
                'hello, world!',
                userId,
                null,
                null,
                ['secret']
            );

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/data?recordName=${recordName}&address=testAddress&instances=${'inst'}`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'inst',
                        id: 'inst',
                        permission: 'data.read',
                        marker: 'secret',
                        role: null,
                    },
                },
                headers: corsHeaders(apiHeaders['origin']),
            });
        });

        it('should return an unacceptable_request result when not given a recordName', async () => {
            const result = await server.handleHttpRequest(
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
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'recordName is required.',
                            path: ['recordName'],
                            received: 'undefined',
                        },
                    ],
                },
                headers: corsHeaders(defaultHeaders['origin']),
            });
        });

        it('should return an unacceptable_request result when not given a address', async () => {
            const result = await server.handleHttpRequest(
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
                    errorMessage:
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'address is required.',
                            path: ['address'],
                            received: 'undefined',
                        },
                    ],
                },
                headers: corsHeaders(defaultHeaders['origin']),
            });
        });

        it('should return a 404 when trying to get data that doesnt exist', async () => {
            const result = await server.handleHttpRequest(
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

        testRateLimit(() =>
            httpGet(
                `/api/v2/records/data?recordName=${recordName}&address=testAddress`,
                defaultHeaders
            )
        );
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
            const result = await server.handleHttpRequest(
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
                            markers: [PUBLIC_READ_MARKER],
                        },
                        {
                            address: 'address1',
                            data: 'hello, world!',
                            markers: [PUBLIC_READ_MARKER],
                        },
                        {
                            address: 'address2',
                            data: 'other message!',
                            markers: [PUBLIC_READ_MARKER],
                        },
                    ],
                    totalCount: 3,
                },
                headers: corsHeaders(defaultHeaders['origin']),
            });
        });

        it('should be able to list data by address', async () => {
            const result = await server.handleHttpRequest(
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
                            markers: [PUBLIC_READ_MARKER],
                        },
                        {
                            address: 'address2',
                            data: 'other message!',
                            markers: [PUBLIC_READ_MARKER],
                        },
                    ],
                    totalCount: 3,
                },
                headers: corsHeaders(defaultHeaders['origin']),
            });
        });

        it('should list what the user can access', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            await dataController.recordData(
                recordKey,
                'address3',
                'crazy message!',
                userId,
                null,
                null,
                ['secret']
            );
            await dataController.recordData(
                recordKey,
                'address1',
                'hello, world!',
                userId,
                null,
                null,
                ['secret']
            );
            await dataController.recordData(
                recordKey,
                'address2',
                'other message!',
                userId,
                null,
                null,
                ['secret']
            );

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/data/list?recordName=${recordName}`,
                    apiHeaders
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
                            markers: ['secret'],
                        },
                        {
                            address: 'address1',
                            data: 'hello, world!',
                            markers: ['secret'],
                        },
                        {
                            address: 'address2',
                            data: 'other message!',
                            markers: ['secret'],
                        },
                    ],
                    totalCount: 3,
                },
                headers: corsHeaders(apiHeaders['origin']),
            });
        });

        it('should list what the inst can access', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            await dataController.recordData(
                recordKey,
                'address3',
                'crazy message!',
                userId,
                null,
                null,
                ['secret']
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
                null,
                ['secret']
            );

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/data/list?recordName=${recordName}&instances=${'inst'}`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    items: [
                        {
                            address: 'address1',
                            data: 'hello, world!',
                            markers: [PUBLIC_READ_MARKER],
                        },
                    ],
                    totalCount: 3,
                },
                headers: corsHeaders(apiHeaders['origin']),
            });
        });

        it('should return an unacceptable_request result when not given a recordName', async () => {
            const result = await server.handleHttpRequest(
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
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'recordName is required.',
                            path: ['recordName'],
                            received: 'undefined',
                        },
                    ],
                },
                headers: corsHeaders(defaultHeaders['origin']),
            });
        });

        testRateLimit(() =>
            httpGet(
                `/api/v2/records/data/list?recordName=${recordName}`,
                defaultHeaders
            )
        );
    });

    describe('POST /api/v2/records/data', () => {
        it('should save the given data record', async () => {
            const result = await server.handleHttpRequest(
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

            const data = await store.getData(recordName, 'testAddress');
            expect(data).toEqual({
                success: true,
                data: 'hello, world',
                subjectId: userId,
                publisherId: userId,
                updatePolicy: true,
                deletePolicy: true,
                markers: [PUBLIC_READ_MARKER],
            });
        });

        it('should support subjectless records', async () => {
            const keyResult = await recordsController.createPublicRecordKey(
                recordName,
                'subjectless',
                ownerId
            );

            if (!keyResult.success) {
                throw new Error('Unable to create subjectless key');
            }

            delete apiHeaders['authorization'];
            const result = await server.handleHttpRequest(
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

            const data = await store.getData(recordName, 'testAddress');
            expect(data).toEqual({
                success: true,
                data: 'hello, world',
                subjectId: null,
                publisherId: ownerId,
                updatePolicy: true,
                deletePolicy: true,
                markers: [PUBLIC_READ_MARKER],
            });
        });

        it('should reject the request if the user is not authorized', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/data`,
                    JSON.stringify({
                        recordKey: recordName,
                        address: 'testAddress',
                        data: 'hello, world',
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        permission: 'data.create',
                        marker: 'publicRead',
                        kind: 'user',
                        id: userId,
                        role: null,
                    },
                },
                headers: apiCorsHeaders,
            });

            const data = await store.getData(recordName, 'testAddress');
            expect(data).toEqual({
                success: false,
                errorCode: 'data_not_found',
                errorMessage: 'The data was not found.',
            });
        });

        it('should reject the request if the inst is not authorized', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/data`,
                    JSON.stringify({
                        recordKey: recordName,
                        address: 'testAddress',
                        data: 'hello, world',
                        instances: ['inst'],
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        permission: 'data.create',
                        marker: 'publicRead',
                        kind: 'inst',
                        id: 'inst',
                        role: null,
                    },
                },
                headers: apiCorsHeaders,
            });

            const data = await store.getData(recordName, 'testAddress');
            expect(data).toEqual({
                success: false,
                errorCode: 'data_not_found',
                errorMessage: 'The data was not found.',
            });
        });

        it('should return an unacceptable_request result when given a non-string address', async () => {
            const result = await server.handleHttpRequest(
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
                    errorMessage:
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'address must be a string.',
                            path: ['address'],
                            received: 'number',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request result when given a non-string recordKey', async () => {
            const result = await server.handleHttpRequest(
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
                    errorMessage:
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'recordKey must be a string.',
                            path: ['recordKey'],
                            received: 'number',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request result when given undefined data', async () => {
            const result = await server.handleHttpRequest(
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
        testRateLimit(() =>
            httpPost(
                `/api/v2/records/data`,
                JSON.stringify({
                    recordKey,
                    address: 'testAddress',
                    data: 'hello, world',
                }),
                defaultHeaders
            )
        );
    });

    describe('POST /api/v2/records/key', () => {
        it('should create a record key', async () => {
            const result = await server.handleHttpRequest(
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
                keyCreatorId: userId,
                policy: 'subjectfull',
            });
        });

        it('should create a subjectless record key', async () => {
            const result = await server.handleHttpRequest(
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
                keyCreatorId: userId,
                policy: 'subjectless',
            });
        });

        it('should return a unacceptable_request error if the recordName is not a string', async () => {
            const result = await server.handleHttpRequest(
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
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'recordName must be a string.',
                            path: ['recordName'],
                            received: 'number',
                        },
                    ],
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

        testRateLimit(() =>
            httpPost(
                '/api/v2/records/key',
                JSON.stringify({
                    recordName: 'test',
                    policy: 'subjectfull',
                }),
                defaultHeaders
            )
        );
    });

    describe('GET /api/v2/records/list', () => {
        beforeEach(async () => {
            await store.addRecord({
                name: 'test0',
                ownerId: 'otherUserId',
                studioId: null,
                secretHashes: [],
                secretSalt: '',
            });
            await store.addRecord({
                name: 'test1',
                ownerId: userId,
                studioId: null,
                secretHashes: [],
                secretSalt: '',
            });
            await store.addRecord({
                name: 'test2',
                ownerId: userId,
                studioId: null,
                secretHashes: [],
                secretSalt: '',
            });
            await store.addRecord({
                name: 'test3',
                ownerId: userId,
                studioId: null,
                secretHashes: [],
                secretSalt: '',
            });
            await store.addRecord({
                name: 'test4',
                ownerId: 'otherUserId',
                studioId: null,
                secretHashes: [],
                secretSalt: '',
            });
        });

        it('should return the list of records for the user', async () => {
            const result = await server.handleHttpRequest(
                httpGet('/api/v2/records/list', apiHeaders)
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    records: [
                        {
                            name: 'test1',
                            ownerId: userId,
                            studioId: null,
                        },
                        {
                            name: 'test2',
                            ownerId: userId,
                            studioId: null,
                        },
                        {
                            name: 'test3',
                            ownerId: userId,
                            studioId: null,
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        describe('?studioId', () => {
            let studioId: string;
            beforeEach(async () => {
                studioId = 'studioId';
                await store.addStudio({
                    id: studioId,
                    displayName: 'my studio',
                });
                await store.addStudioAssignment({
                    studioId,
                    userId,
                    isPrimaryContact: true,
                    role: 'admin',
                });

                await store.addRecord({
                    name: 'test5',
                    ownerId: null,
                    studioId: studioId,
                    secretHashes: [],
                    secretSalt: '',
                });
                await store.addRecord({
                    name: 'test6',
                    ownerId: null,
                    studioId: studioId,
                    secretHashes: [],
                    secretSalt: '',
                });
                await store.addRecord({
                    name: 'test7',
                    ownerId: null,
                    studioId: studioId,
                    secretHashes: [],
                    secretSalt: '',
                });
                await store.addRecord({
                    name: 'test8',
                    ownerId: null,
                    studioId: 'otherStudio',
                    secretHashes: [],
                    secretSalt: '',
                });
                await store.addRecord({
                    name: 'test9',
                    ownerId: null,
                    studioId: studioId,
                    secretHashes: [],
                    secretSalt: '',
                });
            });

            it('should return the list of records for the studio', async () => {
                const result = await server.handleHttpRequest(
                    httpGet(
                        `/api/v2/records/list?studioId=${studioId}`,
                        apiHeaders
                    )
                );

                expectResponseBodyToEqual(result, {
                    statusCode: 200,
                    body: {
                        success: true,
                        records: [
                            {
                                name: 'test5',
                                ownerId: null,
                                studioId: studioId,
                            },
                            {
                                name: 'test6',
                                ownerId: null,
                                studioId: studioId,
                            },
                            {
                                name: 'test7',
                                ownerId: null,
                                studioId: studioId,
                            },
                            {
                                name: 'test9',
                                ownerId: null,
                                studioId: studioId,
                            },
                        ],
                    },
                    headers: apiCorsHeaders,
                });
            });
        });

        testAuthorization(() => httpGet('/api/v2/records/list', apiHeaders));
    });

    describe('OPTIONS /api/v2/records', () => {
        it('should return a 204 response', async () => {
            const result = await server.handleHttpRequest(
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

    describe('POST /api/v2/records/policy/grantPermission', () => {
        beforeEach(() => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };
        });

        it('should grant the given permission to the policy', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/policy/grantPermission`,
                    JSON.stringify({
                        recordName,
                        marker: 'test',
                        permission: {
                            type: 'data.read',
                            role: 'developer',
                            addresses: true,
                        },
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: apiCorsHeaders,
            });

            const data = await store.getUserPolicy(recordName, 'test');
            expect(data).toEqual({
                success: true,
                document: {
                    permissions: [
                        {
                            type: 'data.read',
                            role: 'developer',
                            addresses: true,
                        },
                    ],
                },
                markers: [ACCOUNT_MARKER],
            });
        });

        it('should deny the request if the user is not authorized', async () => {
            delete store.roles[recordName][userId];

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/policy/grantPermission`,
                    JSON.stringify({
                        recordName,
                        marker: 'test',
                        permission: {
                            type: 'data.read',
                            role: 'developer',
                            addresses: true,
                        },
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        id: userId,
                        kind: 'user',
                        marker: 'account',
                        permission: 'policy.grantPermission',
                        role: null,
                        type: 'missing_permission',
                    },
                },
                headers: apiCorsHeaders,
            });

            const policy = await store.getUserPolicy(recordName, 'test');

            expect(policy).toEqual({
                success: false,
                errorCode: 'policy_not_found',
                errorMessage: expect.any(String),
            });
        });

        it('should deny the request if the inst is not authorized', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/policy/grantPermission`,
                    JSON.stringify({
                        recordName,
                        marker: 'test',
                        permission: {
                            type: 'data.read',
                            role: 'developer',
                            addresses: true,
                        },
                        instances: ['inst'],
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        id: 'inst',
                        kind: 'inst',
                        marker: 'account',
                        permission: 'policy.grantPermission',
                        role: null,
                        type: 'missing_permission',
                    },
                },
                headers: apiCorsHeaders,
            });

            const policy = await store.getUserPolicy(recordName, 'test');

            expect(policy).toEqual({
                success: false,
                errorCode: 'policy_not_found',
                errorMessage: expect.any(String),
            });
        });

        it('should return an unacceptable_request result when given a non-string marker', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/policy/grantPermission`,
                    JSON.stringify({
                        recordName,
                        marker: 123,
                        permission: {
                            type: 'data.read',
                            role: 'developer',
                            addresses: true,
                        },
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
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'marker must be a string.',
                            path: ['marker'],
                            received: 'number',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request result when given a non-string recordName', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/policy/grantPermission`,
                    JSON.stringify({
                        recordName: 123,
                        marker: 'test',
                        permission: {
                            type: 'data.read',
                            role: 'developer',
                            addresses: true,
                        },
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
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'recordName must be a string.',
                            path: ['recordName'],
                            received: 'number',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request result when given undefined data', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/policy/grantPermission`,
                    JSON.stringify({
                        recordName,
                        marker: 'test',
                        permission: null,
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
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'object',
                            message: 'Expected object, received null',
                            path: ['permission'],
                            received: 'null',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        testOrigin('POST', `/api/v2/records/policy/grantPermission`, () =>
            JSON.stringify({
                recordName,
                marker: 'test',
                permission: {
                    type: 'data.read',
                    role: 'developer',
                    addresses: true,
                },
            })
        );
        testAuthorization(
            () =>
                httpPost(
                    '/api/v2/records/policy/grantPermission',
                    JSON.stringify({
                        recordName,
                        marker: 'test',
                        permission: {
                            type: 'data.read',
                            role: 'developer',
                            addresses: true,
                        },
                    }),
                    apiHeaders
                ),
            'The user is not logged in. A session key must be provided for this operation.'
        );
        testBodyIsJson((body) =>
            httpPost(`/api/v2/records/policy/grantPermission`, body, apiHeaders)
        );
        testRateLimit(() =>
            httpPost(
                `/api/v2/records/policy/grantPermission`,
                JSON.stringify({
                    recordName,
                    marker: 'test',
                    permission: {
                        type: 'data.read',
                        role: 'developer',
                        addresses: true,
                    },
                }),
                defaultHeaders
            )
        );
    });

    describe('POST /api/v2/records/policy/revokePermission', () => {
        beforeEach(() => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };
            store.policies[recordName] = {
                test: {
                    document: {
                        permissions: [
                            {
                                type: 'data.read',
                                role: 'developer',
                                addresses: true,
                            },
                        ],
                    },
                    markers: [ACCOUNT_MARKER],
                },
            };
        });

        it('should revoke the given permission to the policy', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/policy/revokePermission`,
                    JSON.stringify({
                        recordName,
                        marker: 'test',
                        permission: {
                            type: 'data.read',
                            role: 'developer',
                            addresses: true,
                        },
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: apiCorsHeaders,
            });

            const data = await store.getUserPolicy(recordName, 'test');
            expect(data).toEqual({
                success: true,
                document: {
                    permissions: [],
                },
                markers: [ACCOUNT_MARKER],
            });
        });

        it('should deny the request if the user is not authorized', async () => {
            delete store.roles[recordName][userId];

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/policy/revokePermission`,
                    JSON.stringify({
                        recordName,
                        marker: 'test',
                        permission: {
                            type: 'data.read',
                            role: 'developer',
                            addresses: true,
                        },
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        id: userId,
                        kind: 'user',
                        marker: 'account',
                        permission: 'policy.revokePermission',
                        role: null,
                        type: 'missing_permission',
                    },
                },
                headers: apiCorsHeaders,
            });

            const policy = await store.getUserPolicy(recordName, 'test');

            expect(policy).toEqual({
                success: true,
                document: {
                    permissions: [
                        {
                            type: 'data.read',
                            role: 'developer',
                            addresses: true,
                        },
                    ],
                },
                markers: [ACCOUNT_MARKER],
            });
        });

        it('should deny the request if the inst is not authorized', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/policy/revokePermission`,
                    JSON.stringify({
                        recordName,
                        marker: 'test',
                        permission: {
                            type: 'data.read',
                            role: 'developer',
                            addresses: true,
                        },
                        instances: ['inst'],
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        id: 'inst',
                        kind: 'inst',
                        marker: 'account',
                        permission: 'policy.revokePermission',
                        role: null,
                        type: 'missing_permission',
                    },
                },
                headers: apiCorsHeaders,
            });

            const policy = await store.getUserPolicy(recordName, 'test');

            expect(policy).toEqual({
                success: true,
                document: {
                    permissions: [
                        {
                            type: 'data.read',
                            role: 'developer',
                            addresses: true,
                        },
                    ],
                },
                markers: [ACCOUNT_MARKER],
            });
        });

        it('should return an unacceptable_request result when given a non-string marker', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/policy/revokePermission`,
                    JSON.stringify({
                        recordName,
                        marker: 123,
                        permission: {
                            type: 'data.read',
                            role: 'developer',
                            addresses: true,
                        },
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
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'marker must be a string.',
                            path: ['marker'],
                            received: 'number',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request result when given a non-string recordName', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/policy/revokePermission`,
                    JSON.stringify({
                        recordName: 123,
                        marker: 'test',
                        permission: {
                            type: 'data.read',
                            role: 'developer',
                            addresses: true,
                        },
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
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'recordName must be a string.',
                            path: ['recordName'],
                            received: 'number',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request result when given undefined data', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/policy/revokePermission`,
                    JSON.stringify({
                        recordName,
                        marker: 'test',
                        permission: null,
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
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'object',
                            message: 'Expected object, received null',
                            path: ['permission'],
                            received: 'null',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        testOrigin('POST', `/api/v2/records/policy/revokePermission`, () =>
            JSON.stringify({
                recordName,
                marker: 'test',
                permission: {
                    type: 'data.read',
                    role: 'developer',
                    addresses: true,
                },
            })
        );
        testAuthorization(
            () =>
                httpPost(
                    '/api/v2/records/policy/revokePermission',
                    JSON.stringify({
                        recordName,
                        marker: 'test',
                        permission: {
                            type: 'data.read',
                            role: 'developer',
                            addresses: true,
                        },
                    }),
                    apiHeaders
                ),
            'The user is not logged in. A session key must be provided for this operation.'
        );
        testBodyIsJson((body) =>
            httpPost(
                `/api/v2/records/policy/revokePermission`,
                body,
                apiHeaders
            )
        );
        testRateLimit(() =>
            httpPost(
                `/api/v2/records/policy/revokePermission`,
                JSON.stringify({
                    recordName,
                    marker: 'test',
                    permission: {
                        type: 'data.read',
                        role: 'developer',
                        addresses: true,
                    },
                }),
                defaultHeaders
            )
        );
    });

    describe('GET /api/v2/records/policy', () => {
        beforeEach(() => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };
            store.policies[recordName] = {
                test: {
                    document: {
                        permissions: [
                            {
                                type: 'data.read',
                                role: 'developer',
                                addresses: true,
                            },
                        ],
                    },
                    markers: [ACCOUNT_MARKER],
                },
            };
        });

        it('should get the policy for the given marker', async () => {
            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/policy?recordName=${recordName}&marker=test`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    document: {
                        permissions: [
                            {
                                type: 'data.read',
                                role: 'developer',
                                addresses: true,
                            },
                        ],
                    },
                    markers: [ACCOUNT_MARKER],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request result when not given a marker', async () => {
            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/policy?recordName=${recordName}`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 400,
                body: {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage:
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'marker is required.',
                            path: ['marker'],
                            received: 'undefined',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request result when not given a recordName', async () => {
            const result = await server.handleHttpRequest(
                httpGet(`/api/v2/records/policy?marker=test`, apiHeaders)
            );

            expectResponseBodyToEqual(result, {
                statusCode: 400,
                body: {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage:
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'recordName is required.',
                            path: ['recordName'],
                            received: 'undefined',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        testOrigin(
            'GET',
            `/api/v2/records/policy?recordName=${recordName}&marker=test`
        );
        testAuthorization(
            () =>
                httpGet(
                    '/api/v2/records/policy?recordName=${recordName}&marker=test',
                    apiHeaders
                ),
            'The user is not logged in. A session key must be provided for this operation.'
        );
        testRateLimit(() =>
            httpGet(
                `/api/v2/records/policy?recordName=${recordName}&marker=test`,
                defaultHeaders
            )
        );
    });

    describe('GET /api/v2/records/policy/list', () => {
        beforeEach(() => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };
            store.policies[recordName] = {
                test: {
                    document: {
                        permissions: [
                            {
                                type: 'data.read',
                                role: 'developer',
                                addresses: true,
                            },
                        ],
                    },
                    markers: [ACCOUNT_MARKER],
                },
                test2: {
                    document: {
                        permissions: [
                            {
                                type: 'data.create',
                                role: 'developer',
                                addresses: true,
                            },
                        ],
                    },
                    markers: [ACCOUNT_MARKER],
                },
                abc: {
                    document: {
                        permissions: [
                            {
                                type: 'file.create',
                                role: 'developer',
                            },
                        ],
                    },
                    markers: [ACCOUNT_MARKER],
                },
            };
        });

        it('should list the policies by marker', async () => {
            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/policy/list?recordName=${recordName}`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    policies: [
                        {
                            marker: 'abc',
                            document: {
                                permissions: [
                                    {
                                        type: 'file.create',
                                        role: 'developer',
                                    },
                                ],
                            },
                            markers: [ACCOUNT_MARKER],
                        },
                        {
                            marker: 'test',
                            document: {
                                permissions: [
                                    {
                                        type: 'data.read',
                                        role: 'developer',
                                        addresses: true,
                                    },
                                ],
                            },
                            markers: [ACCOUNT_MARKER],
                        },
                        {
                            marker: 'test2',
                            document: {
                                permissions: [
                                    {
                                        type: 'data.create',
                                        role: 'developer',
                                        addresses: true,
                                    },
                                ],
                            },
                            markers: [ACCOUNT_MARKER],
                        },
                    ],
                    totalCount: 3,
                },
                headers: apiCorsHeaders,
            });
        });

        it('should start the list after the given startingMarker', async () => {
            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/policy/list?recordName=${recordName}&startingMarker=abc`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    policies: [
                        {
                            marker: 'test',
                            document: {
                                permissions: [
                                    {
                                        type: 'data.read',
                                        role: 'developer',
                                        addresses: true,
                                    },
                                ],
                            },
                            markers: [ACCOUNT_MARKER],
                        },
                        {
                            marker: 'test2',
                            document: {
                                permissions: [
                                    {
                                        type: 'data.create',
                                        role: 'developer',
                                        addresses: true,
                                    },
                                ],
                            },
                            markers: [ACCOUNT_MARKER],
                        },
                    ],
                    totalCount: 2,
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request result when not given a recordName', async () => {
            const result = await server.handleHttpRequest(
                httpGet(`/api/v2/records/policy/list?marker=test`, apiHeaders)
            );

            expectResponseBodyToEqual(result, {
                statusCode: 400,
                body: {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage:
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'recordName is required.',
                            path: ['recordName'],
                            received: 'undefined',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        testOrigin(
            'GET',
            `/api/v2/records/policy/list?recordName=${recordName}`
        );
        testAuthorization(
            () =>
                httpGet(
                    '/api/v2/records/policy/list?recordName=${recordName}',
                    apiHeaders
                ),
            'The user is not logged in. A session key must be provided for this operation.'
        );
        testRateLimit(() =>
            httpGet(
                `/api/v2/records/policy/list?recordName=${recordName}`,
                defaultHeaders
            )
        );
    });

    describe('GET /api/v2/records/role/user/list', () => {
        beforeEach(() => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };
            store.roleAssignments[recordName] = {
                ['testId']: [
                    {
                        role: 'role1',
                        expireTimeMs: null,
                    },
                    {
                        role: 'abc',
                        expireTimeMs: null,
                    },
                ],
            };
        });

        it('should list the roles for the given user', async () => {
            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/role/user/list?recordName=${recordName}&userId=${'testId'}`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    roles: [
                        {
                            role: 'abc',
                            expireTimeMs: null,
                        },
                        {
                            role: 'role1',
                            expireTimeMs: null,
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should deny the request if the user is not authorized', async () => {
            delete store.roles[recordName][userId];

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/role/user/list?recordName=${recordName}&userId=${'testId'}`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        id: userId,
                        kind: 'user',
                        marker: 'account',
                        permission: 'role.list',
                        role: null,
                        type: 'missing_permission',
                    },
                },
                headers: apiCorsHeaders,
            });
        });

        it('should deny the request if the inst is not authorized', async () => {
            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/role/user/list?recordName=${recordName}&userId=${'testId'}&instances=${'inst'}`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        id: 'inst',
                        kind: 'inst',
                        marker: 'account',
                        permission: 'role.list',
                        role: null,
                        type: 'missing_permission',
                    },
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request result when not given a recordName', async () => {
            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/role/user/list?userId=${'testId'}`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 400,
                body: {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage:
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'recordName is required.',
                            path: ['recordName'],
                            received: 'undefined',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request result when not given a userId', async () => {
            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/role/user/list?recordName=${recordName}`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 400,
                body: {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage:
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'userId is required.',
                            path: ['userId'],
                            received: 'undefined',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        testOrigin(
            'GET',
            `/api/v2/records/role/user/list?recordName=${recordName}&userId=${'testId'}`
        );
        testAuthorization(
            () =>
                httpGet(
                    `/api/v2/records/role/user/list?recordName=${recordName}&userId=${'testId'}`,
                    apiHeaders
                ),
            'The user is not logged in. A session key must be provided for this operation.'
        );
        testRateLimit(() =>
            httpGet(
                `/api/v2/records/role/user/list?recordName=${recordName}&userId=${'testId'}`,
                defaultHeaders
            )
        );
    });

    describe('GET /api/v2/records/role/inst/list', () => {
        beforeEach(() => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };
            store.roleAssignments[recordName] = {
                ['testId']: [
                    {
                        role: 'role1',
                        expireTimeMs: null,
                    },
                    {
                        role: 'abc',
                        expireTimeMs: null,
                    },
                ],
            };
        });

        it('should list the roles for the given inst', async () => {
            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/role/inst/list?recordName=${recordName}&inst=${'testId'}`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    roles: [
                        {
                            role: 'abc',
                            expireTimeMs: null,
                        },
                        {
                            role: 'role1',
                            expireTimeMs: null,
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should deny the request if the user is not authorized', async () => {
            delete store.roles[recordName][userId];

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/role/inst/list?recordName=${recordName}&inst=${'testId'}`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        id: userId,
                        kind: 'user',
                        marker: 'account',
                        permission: 'role.list',
                        role: null,
                        type: 'missing_permission',
                    },
                },
                headers: apiCorsHeaders,
            });
        });

        it('should deny the request if the instance is not authorized', async () => {
            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/role/inst/list?recordName=${recordName}&inst=${'testId'}&instances=${'inst'}`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        id: 'inst',
                        kind: 'inst',
                        marker: 'account',
                        permission: 'role.list',
                        role: null,
                        type: 'missing_permission',
                    },
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request result when not given a recordName', async () => {
            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/role/inst/list?inst=${'testId'}`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 400,
                body: {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage:
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'recordName is required.',
                            path: ['recordName'],
                            received: 'undefined',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request result when not given an inst', async () => {
            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/role/inst/list?recordName=${recordName}`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 400,
                body: {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage:
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'inst is required.',
                            path: ['inst'],
                            received: 'undefined',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        testOrigin(
            'GET',
            `/api/v2/records/role/inst/list?recordName=${recordName}&inst=${'testId'}`
        );
        testAuthorization(
            () =>
                httpGet(
                    `/api/v2/records/role/inst/list?recordName=${recordName}&inst=${'testId'}`,
                    apiHeaders
                ),
            'The user is not logged in. A session key must be provided for this operation.'
        );
        testRateLimit(() =>
            httpGet(
                `/api/v2/records/role/inst/list?recordName=${recordName}&inst=${'testId'}`,
                defaultHeaders
            )
        );
    });

    describe('GET /api/v2/records/role/assignments/list', () => {
        beforeEach(() => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };
            store.roleAssignments[recordName] = {
                ['testId']: [
                    {
                        role: 'role1',
                        expireTimeMs: null,
                    },
                    {
                        role: 'abc',
                        expireTimeMs: null,
                    },
                ],
                ['testId2']: [
                    {
                        role: 'role1',
                        expireTimeMs: null,
                    },
                    {
                        role: 'role2',
                        expireTimeMs: null,
                    },
                ],
            };
        });

        it('should list the role assignments in the record', async () => {
            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/role/assignments/list?recordName=${recordName}`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    assignments: [
                        {
                            type: 'user',
                            userId: 'testId',
                            role: {
                                role: 'abc',
                                expireTimeMs: null,
                            },
                        },
                        {
                            type: 'user',
                            userId: userId,
                            role: {
                                role: ADMIN_ROLE_NAME,
                                expireTimeMs: null,
                            },
                        },
                        {
                            type: 'user',
                            userId: 'testId',
                            role: {
                                role: 'role1',
                                expireTimeMs: null,
                            },
                        },
                        {
                            type: 'user',
                            userId: 'testId2',
                            role: {
                                role: 'role1',
                                expireTimeMs: null,
                            },
                        },
                        {
                            type: 'user',
                            userId: 'testId2',
                            role: {
                                role: 'role2',
                                expireTimeMs: null,
                            },
                        },
                    ],
                    totalCount: 5,
                },
                headers: apiCorsHeaders,
            });
        });

        it('should list the role assignments after the given startingRole', async () => {
            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/role/assignments/list?recordName=${recordName}&startingRole=${'role1'}`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    assignments: [
                        {
                            type: 'user',
                            userId: 'testId2',
                            role: {
                                role: 'role2',
                                expireTimeMs: null,
                            },
                        },
                    ],
                    totalCount: 5,
                },
                headers: apiCorsHeaders,
            });
        });

        it('should deny the request if the user is not authorized', async () => {
            delete store.roles[recordName][userId];

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/role/assignments/list?recordName=${recordName}`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        id: userId,
                        kind: 'user',
                        marker: 'account',
                        permission: 'role.list',
                        role: null,
                        type: 'missing_permission',
                    },
                },
                headers: apiCorsHeaders,
            });
        });

        it('should deny the request if the inst is not authorized', async () => {
            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/role/assignments/list?recordName=${recordName}&instances=${'inst'}`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        id: 'inst',
                        kind: 'inst',
                        marker: 'account',
                        permission: 'role.list',
                        role: null,
                        type: 'missing_permission',
                    },
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request result when not given a recordName', async () => {
            const result = await server.handleHttpRequest(
                httpGet(`/api/v2/records/role/assignments/list`, apiHeaders)
            );

            expectResponseBodyToEqual(result, {
                statusCode: 400,
                body: {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage:
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'recordName is required.',
                            path: ['recordName'],
                            received: 'undefined',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        testOrigin(
            'GET',
            `/api/v2/records/role/assignments/list?recordName=${recordName}`
        );
        testAuthorization(
            () =>
                httpGet(
                    `/api/v2/records/role/assignments/list?recordName=${recordName}`,
                    apiHeaders
                ),
            'The user is not logged in. A session key must be provided for this operation.'
        );
        testRateLimit(() =>
            httpGet(
                `/api/v2/records/role/assignments/list?recordName=${recordName}`,
                defaultHeaders
            )
        );

        describe('?role', () => {
            it('should list the roles for the given inst', async () => {
                const result = await server.handleHttpRequest(
                    httpGet(
                        `/api/v2/records/role/assignments/list?recordName=${recordName}&role=${'role1'}`,
                        apiHeaders
                    )
                );

                expectResponseBodyToEqual(result, {
                    statusCode: 200,
                    body: {
                        success: true,
                        assignments: [
                            {
                                type: 'user',
                                userId: 'testId',
                                role: {
                                    role: 'role1',
                                    expireTimeMs: null,
                                },
                            },
                            {
                                type: 'user',
                                userId: 'testId2',
                                role: {
                                    role: 'role1',
                                    expireTimeMs: null,
                                },
                            },
                        ],
                    },
                    headers: apiCorsHeaders,
                });
            });

            it('should deny the request if the user is not authorized', async () => {
                delete store.roles[recordName][userId];

                const result = await server.handleHttpRequest(
                    httpGet(
                        `/api/v2/records/role/assignments/list?recordName=${recordName}&role=${'role1'}`,
                        apiHeaders
                    )
                );

                expectResponseBodyToEqual(result, {
                    statusCode: 403,
                    body: {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'You are not authorized to perform this action.',
                        reason: {
                            id: userId,
                            kind: 'user',
                            marker: 'account',
                            permission: 'role.list',
                            role: null,
                            type: 'missing_permission',
                        },
                    },
                    headers: apiCorsHeaders,
                });
            });

            it('should deny the request if the inst is not authorized', async () => {
                const result = await server.handleHttpRequest(
                    httpGet(
                        `/api/v2/records/role/assignments/list?recordName=${recordName}&role=${'role1'}&instances=${'inst'}`,
                        apiHeaders
                    )
                );

                expectResponseBodyToEqual(result, {
                    statusCode: 403,
                    body: {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'You are not authorized to perform this action.',
                        reason: {
                            id: 'inst',
                            kind: 'inst',
                            marker: 'account',
                            permission: 'role.list',
                            role: null,
                            type: 'missing_permission',
                        },
                    },
                    headers: apiCorsHeaders,
                });
            });

            it('should return an unacceptable_request result when not given a recordName', async () => {
                const result = await server.handleHttpRequest(
                    httpGet(
                        `/api/v2/records/role/assignments/list?role=${'role1'}`,
                        apiHeaders
                    )
                );

                expectResponseBodyToEqual(result, {
                    statusCode: 400,
                    body: {
                        success: false,
                        errorCode: 'unacceptable_request',
                        errorMessage:
                            'The request was invalid. One or more fields were invalid.',
                        issues: [
                            {
                                code: 'invalid_type',
                                expected: 'string',
                                message: 'recordName is required.',
                                path: ['recordName'],
                                received: 'undefined',
                            },
                        ],
                    },
                    headers: apiCorsHeaders,
                });
            });

            testOrigin(
                'GET',
                `/api/v2/records/role/assignments/list?recordName=${recordName}&role=${'role1'}`
            );
            testAuthorization(
                () =>
                    httpGet(
                        `/api/v2/records/role/assignments/list?recordName=${recordName}&role=${'role1'}`,
                        apiHeaders
                    ),
                'The user is not logged in. A session key must be provided for this operation.'
            );
            testRateLimit(() =>
                httpGet(
                    `/api/v2/records/role/assignments/list?recordName=${recordName}&role=${'role1'}`,
                    defaultHeaders
                )
            );
        });
    });

    describe('POST /api/v2/records/role/grant', () => {
        beforeEach(() => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };
        });

        it('should grant the role to the given user', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/role/grant`,
                    JSON.stringify({
                        recordName,
                        userId: 'testId',
                        role: 'role1',
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: apiCorsHeaders,
            });

            const roles = await store.listRolesForUser(recordName, 'testId');

            expect(roles).toEqual([
                {
                    role: 'role1',
                    expireTimeMs: null,
                },
            ]);
        });

        it('should grant the role to the given inst', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/role/grant`,
                    JSON.stringify({
                        recordName,
                        inst: 'testId',
                        role: 'role1',
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: apiCorsHeaders,
            });

            const roles = await store.listRolesForInst(recordName, 'testId');

            expect(roles).toEqual([
                {
                    role: 'role1',
                    expireTimeMs: null,
                },
            ]);
        });

        it('should deny the request if the user is not authorized', async () => {
            delete store.roles[recordName][userId];

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/role/grant`,
                    JSON.stringify({
                        recordName,
                        userId: 'testId',
                        role: 'role1',
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        id: userId,
                        kind: 'user',
                        marker: 'account',
                        permission: 'role.grant',
                        role: null,
                        type: 'missing_permission',
                    },
                },
                headers: apiCorsHeaders,
            });

            const roles = await store.listRolesForUser(recordName, 'testId');

            expect(roles).toEqual([]);
        });

        it('should deny the request if the inst is not authorized', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/role/grant`,
                    JSON.stringify({
                        recordName,
                        userId: 'testId',
                        role: 'role1',
                        instances: ['inst'],
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        id: 'inst',
                        kind: 'inst',
                        marker: 'account',
                        permission: 'role.grant',
                        role: null,
                        type: 'missing_permission',
                    },
                },
                headers: apiCorsHeaders,
            });

            const roles = await store.listRolesForUser(recordName, 'testId');

            expect(roles).toEqual([]);
        });

        it('should support setting an expiration time on role grants', async () => {
            const expireTime = Date.now() + 100000;
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/role/grant`,
                    JSON.stringify({
                        recordName,
                        userId: 'testId',
                        role: 'role1',
                        expireTimeMs: expireTime,
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: apiCorsHeaders,
            });

            const roles = await store.listRolesForUser(recordName, 'testId');

            expect(roles).toEqual([
                {
                    role: 'role1',
                    expireTimeMs: expireTime,
                },
            ]);
        });

        it('should return an unacceptable_request result when not given a recordName', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/role/grant`,
                    JSON.stringify({
                        userId: 'testId',
                        role: 'role1',
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
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'recordName is required.',
                            path: ['recordName'],
                            received: 'undefined',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request result when not given a role', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/role/grant`,
                    JSON.stringify({
                        recordName,
                        userId: 'testId',
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
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'role is required.',
                            path: ['role'],
                            received: 'undefined',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request result when given a non-number expire time', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/role/grant`,
                    JSON.stringify({
                        recordName,
                        userId: 'testId',
                        role: 'role1',
                        expireTimeMs: 'abc',
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
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'number',
                            message: 'expireTimeMs must be a number.',
                            path: ['expireTimeMs'],
                            received: 'string',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        testOrigin('POST', `/api/v2/records/role/grant`, () =>
            JSON.stringify({ recordName, userId: 'testId', role: 'role1' })
        );
        testAuthorization(
            () =>
                httpPost(
                    `/api/v2/records/role/grant`,
                    JSON.stringify({
                        recordName,
                        userId: 'testId',
                        role: 'role1',
                    }),
                    apiHeaders
                ),
            'The user is not logged in. A session key must be provided for this operation.'
        );
        testRateLimit(() =>
            httpPost(
                `/api/v2/records/role/grant`,
                JSON.stringify({
                    recordName,
                    userId: 'testId',
                    role: 'role1',
                }),
                defaultHeaders
            )
        );
    });

    describe('POST /api/v2/records/role/revoke', () => {
        beforeEach(() => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            store.roleAssignments[recordName] = {
                ['testId']: [
                    {
                        role: 'role1',
                        expireTimeMs: null,
                    },
                ],
            };
        });

        it('should revoke the role from the given user', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/role/revoke`,
                    JSON.stringify({
                        recordName,
                        userId: 'testId',
                        role: 'role1',
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: apiCorsHeaders,
            });

            const roles = await store.listRolesForUser(recordName, 'testId');

            expect(roles).toEqual([]);
        });

        it('should reject the request if the user is not authorized', async () => {
            delete store.roles[recordName][userId];

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/role/revoke`,
                    JSON.stringify({
                        recordName,
                        inst: 'testId',
                        role: 'role1',
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        id: userId,
                        kind: 'user',
                        marker: 'account',
                        permission: 'role.revoke',
                        role: null,
                        type: 'missing_permission',
                    },
                },
                headers: apiCorsHeaders,
            });

            const roles = await store.listRolesForInst(recordName, 'testId');

            expect(roles).toEqual([
                {
                    role: 'role1',
                    expireTimeMs: null,
                },
            ]);
        });

        it('should reject the request if the inst is not authorized', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/role/revoke`,
                    JSON.stringify({
                        recordName,
                        inst: 'testId',
                        role: 'role1',
                        instances: ['inst'],
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        id: 'inst',
                        kind: 'inst',
                        marker: 'account',
                        permission: 'role.revoke',
                        role: null,
                        type: 'missing_permission',
                    },
                },
                headers: apiCorsHeaders,
            });

            const roles = await store.listRolesForInst(recordName, 'testId');

            expect(roles).toEqual([
                {
                    role: 'role1',
                    expireTimeMs: null,
                },
            ]);
        });

        it('should revoke the role from the given inst', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/role/revoke`,
                    JSON.stringify({
                        recordName,
                        inst: 'testId',
                        role: 'role1',
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: apiCorsHeaders,
            });

            const roles = await store.listRolesForInst(recordName, 'testId');

            expect(roles).toEqual([]);
        });

        it('should return an unacceptable_request result when not given a recordName', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/role/revoke`,
                    JSON.stringify({
                        userId: 'testId',
                        role: 'role1',
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
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'recordName is required.',
                            path: ['recordName'],
                            received: 'undefined',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request result when not given a role', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/role/revoke`,
                    JSON.stringify({
                        recordName,
                        userId: 'testId',
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
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_type',
                            expected: 'string',
                            message: 'role is required.',
                            path: ['role'],
                            received: 'undefined',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        testOrigin('POST', `/api/v2/records/role/revoke`, () =>
            JSON.stringify({ recordName, userId: 'testId', role: 'role1' })
        );
        testAuthorization(
            () =>
                httpPost(
                    `/api/v2/records/role/revoke`,
                    JSON.stringify({
                        recordName,
                        userId: 'testId',
                        role: 'role1',
                    }),
                    apiHeaders
                ),
            'The user is not logged in. A session key must be provided for this operation.'
        );
        testRateLimit(() =>
            httpPost(
                `/api/v2/records/role/revoke`,
                JSON.stringify({
                    recordName,
                    userId: 'testId',
                    role: 'role1',
                }),
                defaultHeaders
            )
        );
    });

    describe('GET /api/v2/records/insts/list', () => {
        const inst1 = 'myInst';
        const inst2 = 'myInst2';
        const inst3 = 'myInst3';
        beforeEach(async () => {
            await store.saveInst({
                recordName,
                inst: inst1,
                markers: [PRIVATE_MARKER],
            });
            await store.saveInst({
                recordName,
                inst: inst2,
                markers: ['test'],
            });
            await store.saveInst({
                recordName,
                inst: inst3,
                markers: [PRIVATE_MARKER],
            });
        });

        it('should not_supported if the server has a null Websocket Controller', async () => {
            server = new RecordsServer(
                allowedAccountOrigins,
                allowedApiOrigins,
                authController,
                livekitController,
                recordsController,
                eventsController,
                dataController,
                manualDataController,
                filesController,
                subscriptionController,
                null as any,
                policyController,
                null,
                null
            );

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/insts/list?recordName=${recordName}`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 501,
                body: {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage:
                        'Inst features are not supported by this server.',
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return the list of insts for the given record', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/insts/list?recordName=${recordName}`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    insts: [
                        {
                            inst: inst1,
                            markers: [PRIVATE_MARKER],
                        },
                        {
                            inst: inst2,
                            markers: ['test'],
                        },
                        {
                            inst: inst3,
                            markers: [PRIVATE_MARKER],
                        },
                    ],
                    totalCount: 3,
                },
                headers: corsHeaders(apiHeaders['origin']),
            });
        });

        it('should return an empty list if not given a record name', async () => {
            const result = await server.handleHttpRequest(
                httpGet(`/api/v2/records/insts/list`, apiHeaders)
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    insts: [],
                    totalCount: 0,
                },
                headers: corsHeaders(apiHeaders['origin']),
            });
        });

        it('should return only the insts that the user has access to', async () => {
            store.policies[recordName] = {
                test: {
                    document: {
                        permissions: [
                            {
                                type: 'inst.list',
                                insts: true,
                                role: 'developer',
                            },
                        ],
                    },
                    markers: [ACCOUNT_MARKER],
                },
            };
            store.roles[recordName] = {
                [userId]: new Set(['developer']),
            };

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/insts/list?recordName=${recordName}`,
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    insts: [
                        {
                            inst: inst2,
                            markers: ['test'],
                        },
                    ],
                    totalCount: 3,
                },
                headers: corsHeaders(apiHeaders['origin']),
            });
        });

        testOrigin(
            'GET',
            `/api/v2/records/insts/list?recordName=${recordName}`
        );
        testAuthorization(() =>
            httpGet(
                `/api/v2/records/insts/list?recordName=${recordName}`,
                apiHeaders
            )
        );
        testRateLimit(() =>
            httpGet(
                `/api/v2/records/insts/list?recordName=${recordName}`,
                apiHeaders
            )
        );
    });

    describe('DELETE /api/v2/records/insts', () => {
        const inst = 'myInst';
        beforeEach(async () => {
            await store.saveInst({
                recordName,
                inst: inst,
                markers: [PRIVATE_MARKER],
            });

            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };
        });

        it('should delete the specified inst', async () => {
            const result = await server.handleHttpRequest(
                httpDelete(
                    '/api/v2/records/insts',
                    JSON.stringify({
                        recordName,
                        inst,
                    }),
                    authenticatedHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: accountCorsHeaders,
            });
            expect(await store.getInstByName(recordName, inst)).toBeNull();
        });

        it('should be able to use a recordKey to delete the inst', async () => {
            const result = await server.handleHttpRequest(
                httpDelete(
                    '/api/v2/records/insts',
                    JSON.stringify({
                        recordKey,
                        inst,
                    }),
                    authenticatedHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: accountCorsHeaders,
            });

            expect(await store.getInstByName(recordName, inst)).toBeNull();
        });

        it('should return a 403 status code when the user is not authorized', async () => {
            delete store.roles[recordName][userId];

            const result = await server.handleHttpRequest(
                httpDelete(
                    '/api/v2/records/insts',
                    JSON.stringify({
                        recordName,
                        inst,
                    }),
                    authenticatedHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        permission: 'inst.delete',
                        id: userId,
                        kind: 'user',
                        marker: PRIVATE_MARKER,
                        role: null,
                    },
                },
                headers: accountCorsHeaders,
            });
            expect(await store.getInstByName(recordName, inst)).not.toBeNull();
        });

        testUrl('DELETE', '/api/v2/records/insts', () =>
            JSON.stringify({
                recordName,
                inst,
            })
        );
    });

    describe('POST /api/v2/ai/chat', () => {
        beforeEach(async () => {
            const u = await store.findUser(userId);
            await store.saveUser({
                ...u,
                subscriptionId: 'sub_id',
                subscriptionStatus: 'active',
            });

            chatInterface.chat.mockResolvedValueOnce({
                choices: [
                    {
                        role: 'assistant',
                        content: 'hi!',
                    },
                ],
                totalTokens: 0,
            });
        });

        it('should return a not_supported result if the server has a null AI controller', async () => {
            server = new RecordsServer(
                allowedAccountOrigins,
                allowedApiOrigins,
                authController,
                livekitController,
                recordsController,
                eventsController,
                dataController,
                manualDataController,
                filesController,
                subscriptionController,
                null as any,
                policyController,
                null,
                null
            );

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/ai/chat`,
                    JSON.stringify({
                        model: 'model-1',
                        messages: [
                            {
                                role: 'user',
                                content: 'hello',
                            },
                        ],
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 501,
                body: {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage:
                        'AI features are not supported by this server.',
                },
                headers: apiCorsHeaders,
            });
        });

        it('should call the AI chat interface', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/ai/chat`,
                    JSON.stringify({
                        model: 'model-1',
                        messages: [
                            {
                                role: 'user',
                                content: 'hello',
                            },
                        ],
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    choices: [
                        {
                            role: 'assistant',
                            content: 'hi!',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should support using a default model', async () => {
            chatInterface.chat.mockResolvedValueOnce({
                choices: [
                    {
                        role: 'assistant',
                        content: 'hi!',
                    },
                ],
                totalTokens: 0,
            });

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/ai/chat`,
                    JSON.stringify({
                        messages: [
                            {
                                role: 'user',
                                content: 'hello',
                            },
                        ],
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    choices: [
                        {
                            role: 'assistant',
                            content: 'hi!',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
            expect(chatInterface.chat).toHaveBeenCalledWith({
                model: 'default-model',
                messages: [
                    {
                        role: 'user',
                        content: 'hello',
                    },
                ],
                userId,
            });
        });

        testOrigin('POST', `/api/v2/ai/chat`, () =>
            JSON.stringify({
                model: 'model-1',
                messages: [
                    {
                        role: 'user',
                        content: 'hello',
                    },
                ],
            })
        );
        testAuthorization(() =>
            httpPost(
                `/api/v2/ai/chat`,
                JSON.stringify({
                    model: 'model-1',
                    messages: [
                        {
                            role: 'user',
                            content: 'hello',
                        },
                    ],
                }),
                apiHeaders
            )
        );
        testRateLimit(() =>
            httpPost(
                `/api/v2/ai/chat`,
                JSON.stringify({
                    model: 'model-1',
                    messages: [
                        {
                            role: 'user',
                            content: 'hello',
                        },
                    ],
                }),
                apiHeaders
            )
        );
    });

    describe('POST /api/v2/ai/skybox', () => {
        beforeEach(async () => {
            const u = await store.findUser(userId);
            await store.saveUser({
                ...u,
                subscriptionId: 'sub_id',
                subscriptionStatus: 'active',
            });

            skyboxInterface.generateSkybox.mockResolvedValueOnce({
                success: true,
                skyboxId: 'skybox-id',
            });
        });

        it('should return a not_supported result if the server has a null AI controller', async () => {
            server = new RecordsServer(
                allowedAccountOrigins,
                allowedApiOrigins,
                authController,
                livekitController,
                recordsController,
                eventsController,
                dataController,
                manualDataController,
                filesController,
                subscriptionController,
                null as any,
                policyController,
                null,
                null
            );

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/ai/skybox`,
                    JSON.stringify({
                        prompt: 'a blue sky',
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 501,
                body: {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage:
                        'AI features are not supported by this server.',
                },
                headers: apiCorsHeaders,
            });
        });

        it('should call the AI skybox interface', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/ai/skybox`,
                    JSON.stringify({
                        prompt: 'a blue sky',
                        negativePrompt: 'a red sky',
                        blockadeLabs: {
                            skyboxStyleId: 1,
                            remixImagineId: 2,
                            seed: 3,
                        },
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    skyboxId: 'skybox-id',
                },
                headers: apiCorsHeaders,
            });
            expect(skyboxInterface.generateSkybox).toHaveBeenCalledWith({
                prompt: 'a blue sky',
                negativePrompt: 'a red sky',
                blockadeLabs: {
                    skyboxStyleId: 1,
                    remixImagineId: 2,
                    seed: 3,
                },
            });
        });

        testOrigin('POST', `/api/v2/ai/skybox`, () =>
            JSON.stringify({
                prompt: 'test',
            })
        );
        testAuthorization(() =>
            httpPost(
                `/api/v2/ai/skybox`,
                JSON.stringify({
                    prompt: 'test',
                }),
                apiHeaders
            )
        );
        testRateLimit(() =>
            httpPost(
                `/api/v2/ai/skybox`,
                JSON.stringify({
                    prompt: 'test',
                }),
                apiHeaders
            )
        );
    });

    describe('GET /api/v2/ai/skybox', () => {
        beforeEach(async () => {
            const u = await store.findUser(userId);
            await store.saveUser({
                ...u,
                subscriptionId: 'sub_id',
                subscriptionStatus: 'active',
            });

            skyboxInterface.getSkybox.mockResolvedValueOnce({
                success: true,
                status: 'generated',
                fileUrl: 'file-url',
                thumbnailUrl: 'thumbnail-url',
            });
        });

        it('should return a not_supported result if the server has a null AI controller', async () => {
            server = new RecordsServer(
                allowedAccountOrigins,
                allowedApiOrigins,
                authController,
                livekitController,
                recordsController,
                eventsController,
                dataController,
                manualDataController,
                filesController,
                subscriptionController,
                null as any,
                policyController,
                null,
                null
            );

            const result = await server.handleHttpRequest(
                httpGet(`/api/v2/ai/skybox`, apiHeaders)
            );

            expectResponseBodyToEqual(result, {
                statusCode: 501,
                body: {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage:
                        'AI features are not supported by this server.',
                },
                headers: apiCorsHeaders,
            });
        });

        it('should call the AI skybox interface', async () => {
            const result = await server.handleHttpRequest(
                httpGet(`/api/v2/ai/skybox?skyboxId=${'skybox-id'}`, apiHeaders)
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    status: 'generated',
                    fileUrl: 'file-url',
                    thumbnailUrl: 'thumbnail-url',
                },
                headers: apiCorsHeaders,
            });
            expect(skyboxInterface.getSkybox).toHaveBeenCalledWith('skybox-id');
        });

        testOrigin('GET', `/api/v2/ai/skybox?skyboxId=test-skybox`);
        testAuthorization(() =>
            httpGet(`/api/v2/ai/skybox?skyboxId=test-skybox`, apiHeaders)
        );
        testRateLimit(() =>
            httpGet(`/api/v2/ai/skybox?skyboxId=test-skybox`, apiHeaders)
        );
    });

    describe('POST /api/v2/ai/image', () => {
        beforeEach(async () => {
            const u = await store.findUser(userId);
            await store.saveUser({
                ...u,
                subscriptionId: 'sub_id',
                subscriptionStatus: 'active',
            });

            imageInterface.generateImage.mockResolvedValueOnce({
                images: [
                    {
                        base64: 'base64',
                        mimeType: 'image/png',
                    },
                ],
            });
        });

        it('should return a not_supported result if the server has a null AI controller', async () => {
            server = new RecordsServer(
                allowedAccountOrigins,
                allowedApiOrigins,
                authController,
                livekitController,
                recordsController,
                eventsController,
                dataController,
                manualDataController,
                filesController,
                subscriptionController,
                null as any,
                policyController,
                null,
                null
            );

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/ai/image`,
                    JSON.stringify({
                        prompt: 'a blue sky',
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 501,
                body: {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage:
                        'AI features are not supported by this server.',
                },
                headers: apiCorsHeaders,
            });
        });

        it('should call the AI image interface', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/ai/image`,
                    JSON.stringify({
                        prompt: 'a rabbit riding a bycicle',
                        negativePrompt: 'ugly, incorrect, wrong',
                    }),
                    apiHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    images: [
                        {
                            base64: 'base64',
                            mimeType: 'image/png',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
            expect(imageInterface.generateImage).toHaveBeenCalledWith({
                model: 'model-1',
                prompt: 'a rabbit riding a bycicle',
                negativePrompt: 'ugly, incorrect, wrong',
                width: 512,
                height: 512,
                steps: 30,
                numberOfImages: 1,
                userId,
            });
        });

        testOrigin('POST', `/api/v2/ai/image`, () =>
            JSON.stringify({
                prompt: 'test',
            })
        );
        testAuthorization(() =>
            httpPost(
                `/api/v2/ai/image`,
                JSON.stringify({
                    prompt: 'test',
                }),
                apiHeaders
            )
        );
        testRateLimit(() =>
            httpPost(
                `/api/v2/ai/image`,
                JSON.stringify({
                    prompt: 'test',
                }),
                apiHeaders
            )
        );
    });

    describe('POST /api/v2/studios', () => {
        it('should create a studio and return the ID', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    '/api/v2/studios',
                    JSON.stringify({
                        displayName: 'my studio',
                    }),
                    authenticatedHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    studioId: expect.any(String),
                },
                headers: accountCorsHeaders,
            });
        });

        testAuthorization(() =>
            httpPost(
                '/api/v2/studios',
                JSON.stringify({
                    displayName: 'my studio',
                }),
                authenticatedHeaders
            )
        );
        testOrigin('POST', '/api/v2/studios', () =>
            JSON.stringify({
                displayName: 'my studio',
            })
        );
        testRateLimit(() =>
            httpPost(
                '/api/v2/studios',
                JSON.stringify({
                    displayName: 'my studio',
                }),
                authenticatedHeaders
            )
        );
    });

    describe('GET /api/v2/studios/list', () => {
        beforeEach(async () => {
            await store.addStudio({
                id: 'studioId1',
                displayName: 'studio 1',
            });

            await store.addStudio({
                id: 'studioId2',
                displayName: 'studio 2',
            });

            await store.addStudio({
                id: 'studioId3',
                displayName: 'studio 3',
            });

            await store.addStudioAssignment({
                studioId: 'studioId2',
                userId: userId,
                isPrimaryContact: true,
                role: 'admin',
            });
            await store.addStudioAssignment({
                studioId: 'studioId3',
                userId: userId,
                isPrimaryContact: true,
                role: 'member',
            });
        });

        it('should list the studios that the user has access to', async () => {
            const result = await server.handleHttpRequest(
                httpGet(`/api/v2/studios/list`, apiHeaders)
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    studios: [
                        {
                            studioId: 'studioId2',
                            displayName: 'studio 2',
                            role: 'admin',
                            isPrimaryContact: true,
                            subscriptionTier: null,
                        },
                        {
                            studioId: 'studioId3',
                            displayName: 'studio 3',
                            role: 'member',
                            isPrimaryContact: true,
                            subscriptionTier: null,
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        testAuthorization(() => httpGet('/api/v2/studios/list', apiHeaders));
        testOrigin('GET', '/api/v2/studios/list');
        testRateLimit(() => httpGet('/api/v2/studios/list', apiHeaders));
    });

    describe('GET /api/v2/studios/members/list', () => {
        let studioId: string;
        beforeEach(async () => {
            studioId = 'studioId1';
            await store.saveUser({
                id: 'userId2',
                email: 'test2@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });

            await store.addStudio({
                id: studioId,
                displayName: 'studio 1',
            });

            await store.addStudioAssignment({
                studioId: studioId,
                userId: userId,
                isPrimaryContact: true,
                role: 'admin',
            });
            await store.addStudioAssignment({
                studioId: studioId,
                userId: 'userId2',
                isPrimaryContact: false,
                role: 'member',
            });
        });

        it('should list the members of the studio', async () => {
            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/studios/members/list?studioId=${studioId}`,
                    authenticatedHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    members: sortBy(
                        [
                            {
                                studioId,
                                userId: userId,
                                isPrimaryContact: true,
                                role: 'admin',
                                user: {
                                    id: userId,
                                    email: 'test@example.com',
                                    phoneNumber: null,
                                },
                            },
                            {
                                studioId,
                                userId: 'userId2',
                                isPrimaryContact: false,
                                role: 'member',
                                user: {
                                    id: 'userId2',
                                    email: 'test2@example.com',
                                    phoneNumber: null,
                                },
                            },
                        ],
                        (u) => u.userId
                    ),
                },
                headers: accountCorsHeaders,
            });
        });

        testAuthorization(() =>
            httpGet(
                '/api/v2/studios/members/list?studioId=studioId1',
                authenticatedHeaders
            )
        );
        testOrigin('GET', '/api/v2/studios/members/list?studioId=studioId1');
        testRateLimit(() =>
            httpGet(
                '/api/v2/studios/members/list?studioId=studioId1',
                authenticatedHeaders
            )
        );
    });

    describe('POST /api/v2/studios/members', () => {
        let studioId: string;
        beforeEach(async () => {
            studioId = 'studioId1';
            await store.saveUser({
                id: 'userId2',
                email: 'test2@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });

            await store.saveUser({
                id: 'userId3',
                email: null,
                phoneNumber: '555',
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });

            await store.addStudio({
                id: studioId,
                displayName: 'studio 1',
            });

            await store.addStudioAssignment({
                studioId: studioId,
                userId: userId,
                isPrimaryContact: true,
                role: 'admin',
            });
        });

        it('should add a member to the studio', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    '/api/v2/studios/members',
                    JSON.stringify({
                        studioId,
                        addedUserId: 'userId2',
                        role: 'member',
                    }),
                    authenticatedHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: accountCorsHeaders,
            });

            const list = await store.listStudioAssignments(studioId, {
                userId: 'userId2',
            });

            expect(list).toEqual([
                {
                    studioId,
                    userId: 'userId2',
                    role: 'member',
                    isPrimaryContact: false,
                    user: {
                        id: 'userId2',
                        email: 'test2@example.com',
                        phoneNumber: null,
                    },
                },
            ]);
        });

        it('should be able to add members by email address', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    '/api/v2/studios/members',
                    JSON.stringify({
                        studioId,
                        addedEmail: 'test2@example.com',
                        role: 'member',
                    }),
                    authenticatedHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: accountCorsHeaders,
            });

            const list = await store.listStudioAssignments(studioId, {
                userId: 'userId2',
            });

            expect(list).toEqual([
                {
                    studioId,
                    userId: 'userId2',
                    role: 'member',
                    isPrimaryContact: false,
                    user: {
                        id: 'userId2',
                        email: 'test2@example.com',
                        phoneNumber: null,
                    },
                },
            ]);
        });

        it('should be able to add members by phone number', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    '/api/v2/studios/members',
                    JSON.stringify({
                        studioId,
                        addedPhoneNumber: '555',
                        role: 'member',
                    }),
                    authenticatedHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: accountCorsHeaders,
            });

            const list = await store.listStudioAssignments(studioId, {
                userId: 'userId3',
            });

            expect(list).toEqual([
                {
                    studioId,
                    userId: 'userId3',
                    role: 'member',
                    isPrimaryContact: false,
                    user: {
                        id: 'userId3',
                        email: null,
                        phoneNumber: '555',
                    },
                },
            ]);
        });

        testUrl('POST', '/api/v2/studios/members', () =>
            JSON.stringify({
                studioId,
                addedUserId: 'userId2',
                role: 'member',
            })
        );
    });

    describe('DELETE /api/v2/studios/members', () => {
        let studioId: string;
        beforeEach(async () => {
            studioId = 'studioId1';
            await store.saveUser({
                id: 'userId2',
                email: 'test2@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });

            await store.saveUser({
                id: 'userId3',
                email: null,
                phoneNumber: '555',
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });

            await store.addStudio({
                id: studioId,
                displayName: 'studio 1',
            });

            await store.addStudioAssignment({
                studioId: studioId,
                userId: userId,
                isPrimaryContact: true,
                role: 'admin',
            });

            await store.addStudioAssignment({
                studioId: studioId,
                userId: 'userId2',
                isPrimaryContact: false,
                role: 'member',
            });
        });

        it('should remove the member from the studio', async () => {
            const result = await server.handleHttpRequest(
                httpDelete(
                    '/api/v2/studios/members',
                    JSON.stringify({
                        studioId,
                        removedUserId: 'userId2',
                    }),
                    authenticatedHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: accountCorsHeaders,
            });

            const list = await store.listStudioAssignments(studioId, {
                userId: 'userId2',
            });

            expect(list).toEqual([]);
        });

        testUrl('DELETE', '/api/v2/studios/members', () =>
            JSON.stringify({
                studioId,
                removedUserId: 'userId2',
            })
        );
    });

    describe('GET /api/v2/subscriptions', () => {
        describe('?userId', () => {
            let user: AuthUser;
            beforeEach(async () => {
                user = await store.findUser(userId);
                await store.saveUser({
                    ...user,
                    stripeCustomerId: 'customerId',
                });
                user = await store.findUser(userId);
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

                const result = await server.handleHttpRequest(
                    httpGet(
                        `/api/v2/subscriptions?userId=${userId}`,
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
                                featureList: ['Feature 1', 'Feature 2'],
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

                const result = await server.handleHttpRequest(
                    httpGet(
                        `/api/v2/subscriptions?userId=${userId}`,
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

            it('should return a 403 status code if the origin is invalid', async () => {
                authenticatedHeaders['origin'] = 'https://wrong.origin.com';
                const result = await server.handleHttpRequest(
                    httpGet(
                        `/api/v2/subscriptions?userId=${userId}`,
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
                const result = await server.handleHttpRequest(
                    httpGet(
                        `/api/v2/subscriptions?userId=${userId}`,
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
                const result = await server.handleHttpRequest(
                    httpGet(
                        `/api/v2/subscriptions?userId=${userId}`,
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
                const result = await server.handleHttpRequest(
                    httpGet(
                        `/api/v2/subscriptions?userId=${userId}`,
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

        describe('?studioId', () => {
            let studio: Studio;
            let studioId: string;
            beforeEach(async () => {
                studioId = 'studioId';
                studio = {
                    id: studioId,
                    displayName: 'my studio',
                    stripeCustomerId: 'customerId',
                };

                await store.addStudio(studio);
                await store.addStudioAssignment({
                    studioId,
                    userId,
                    isPrimaryContact: true,
                    role: 'admin',
                });
                studio = await store.getStudioById(studioId);
            });

            it('should return a list of subscriptions for the studio', async () => {
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

                const result = await server.handleHttpRequest(
                    httpGet(
                        `/api/v2/subscriptions?studioId=${studioId}`,
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
                                featureList: ['Feature 1', 'Feature 2'],
                            },
                        ],
                        purchasableSubscriptions: [],
                    },
                    headers: accountCorsHeaders,
                });
            });

            it('should return a list of purchasable subscriptions for the studio', async () => {
                stripeMock.listActiveSubscriptionsForCustomer.mockResolvedValueOnce(
                    {
                        subscriptions: [],
                    }
                );

                const result = await server.handleHttpRequest(
                    httpGet(
                        `/api/v2/subscriptions?studioId=${studioId}`,
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

            it('should return a 403 status code if the origin is invalid', async () => {
                authenticatedHeaders['origin'] = 'https://wrong.origin.com';
                const result = await server.handleHttpRequest(
                    httpGet(
                        `/api/v2/subscriptions?studioId=${studioId}`,
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
                const result = await server.handleHttpRequest(
                    httpGet(
                        `/api/v2/subscriptions?studioId=${studioId}`,
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
                const result = await server.handleHttpRequest(
                    httpGet(
                        `/api/v2/subscriptions?studioId=${studioId}`,
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
                const result = await server.handleHttpRequest(
                    httpGet(
                        `/api/v2/subscriptions?studioId=${studioId}`,
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

        testRateLimit('GET', `/api/v3/subscriptions`);
    });

    describe('POST /api/v2/subscriptions/manage', () => {
        describe('userId', () => {
            let user: AuthUser;
            beforeEach(async () => {
                user = await store.findUser(userId);
                await store.saveUser({
                    ...user,
                    stripeCustomerId: 'customerId',
                });
                user = await store.findUser(userId);
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
                    url: 'http://portal_url',
                });

                const result = await server.handleHttpRequest(
                    httpPost(
                        `/api/v2/subscriptions/manage`,
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
                        url: 'http://portal_url',
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
                    url: 'http://create_url',
                });

                stripeMock.createPortalSession.mockResolvedValueOnce({
                    url: 'http://portal_url',
                });

                const result = await server.handleHttpRequest(
                    httpPost(
                        `/api/v2/subscriptions/manage`,
                        JSON.stringify({
                            userId,
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
                        url: 'http://create_url',
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
                    url: 'http://create_url',
                });

                stripeMock.createPortalSession.mockResolvedValueOnce({
                    url: 'http://portal_url',
                });

                const result = await server.handleHttpRequest(
                    httpPost(
                        `/api/v2/subscriptions/manage`,
                        JSON.stringify({
                            userId,
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
                const result = await server.handleHttpRequest({
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
                const result = await server.handleHttpRequest(
                    httpPost(
                        `/api/v2/subscriptions/manage`,
                        JSON.stringify({
                            userId,
                        }),
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
                const result = await server.handleHttpRequest(
                    httpPost(
                        `/api/v2/subscriptions/manage`,
                        JSON.stringify({
                            userId,
                        }),
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
                const result = await server.handleHttpRequest(
                    httpPost(
                        `/api/v2/subscriptions/manage`,
                        JSON.stringify({
                            userId,
                        }),
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
                const result = await server.handleHttpRequest(
                    httpPost(
                        `/api/v2/subscriptions/manage`,
                        JSON.stringify({
                            userId,
                        }),
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

            testUrl('POST', '/api/v2/subscriptions/manage', () =>
                JSON.stringify({
                    userId,
                })
            );
        });

        describe('studioId', () => {
            let studio: Studio;
            let studioId: string;
            beforeEach(async () => {
                studioId = 'studioId';
                studio = {
                    id: studioId,
                    displayName: 'my studio',
                    stripeCustomerId: 'customerId',
                };
                await store.addStudio(studio);
                await store.addStudioAssignment({
                    userId,
                    studioId,
                    isPrimaryContact: true,
                    role: 'admin',
                });
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
                    url: 'http://portal_url',
                });

                const result = await server.handleHttpRequest(
                    httpPost(
                        `/api/v2/subscriptions/manage`,
                        JSON.stringify({
                            studioId,
                        }),
                        authenticatedHeaders
                    )
                );

                expect(result).toEqual({
                    statusCode: 200,
                    body: JSON.stringify({
                        success: true,
                        url: 'http://portal_url',
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
                    url: 'http://create_url',
                });

                stripeMock.createPortalSession.mockResolvedValueOnce({
                    url: 'http://portal_url',
                });

                const result = await server.handleHttpRequest(
                    httpPost(
                        `/api/v2/subscriptions/manage`,
                        JSON.stringify({
                            studioId,
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
                        url: 'http://create_url',
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
                    url: 'http://create_url',
                });

                stripeMock.createPortalSession.mockResolvedValueOnce({
                    url: 'http://portal_url',
                });

                const result = await server.handleHttpRequest(
                    httpPost(
                        `/api/v2/subscriptions/manage`,
                        JSON.stringify({
                            studioId,
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
                const result = await server.handleHttpRequest({
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
                const result = await server.handleHttpRequest(
                    httpPost(
                        `/api/v2/subscriptions/manage`,
                        JSON.stringify({
                            studioId,
                        }),
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
                const result = await server.handleHttpRequest(
                    httpPost(
                        `/api/v2/subscriptions/manage`,
                        JSON.stringify({
                            studioId,
                        }),
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
                const result = await server.handleHttpRequest(
                    httpPost(
                        `/api/v2/subscriptions/manage`,
                        JSON.stringify({
                            studioId,
                        }),
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
                const result = await server.handleHttpRequest(
                    httpPost(
                        `/api/v2/subscriptions/manage`,
                        JSON.stringify({
                            studioId,
                        }),
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

            testUrl('POST', '/api/v2/subscriptions/manage', () =>
                JSON.stringify({
                    studioId,
                })
            );
        });
    });

    describe('GET /instData', () => {
        it('should return the inst data that is stored', async () => {
            const update = constructInitializationUpdate({
                type: 'create_initialization_update',
                bots: [
                    createBot('test', {
                        test: true,
                    }),
                ],
            });

            await instStore.addUpdates(
                null,
                'inst',
                'branch',
                [update.update],
                update.update.length
            );

            const result = await server.handleHttpRequest(
                httpGet('/instData?inst=inst&branch=branch', defaultHeaders)
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    data: {
                        version: 1,
                        state: {
                            test: createBot('test', {
                                test: true,
                            }),
                        },
                    },
                },
                headers: corsHeaders(defaultHeaders['origin']),
            });
        });

        it('should return the inst data for private insts', async () => {
            store.policies[recordName] = {
                [PRIVATE_MARKER]: {
                    document: {
                        permissions: [
                            {
                                type: 'inst.read',
                                role: 'developer',
                                insts: true,
                            },
                        ],
                    },
                    markers: [ACCOUNT_MARKER],
                },
            };

            store.roles[recordName] = {
                [userId]: new Set(['developer']),
            };

            await instStore.saveInst({
                recordName,
                inst: 'inst',
                markers: [PRIVATE_MARKER],
            });

            const update = constructInitializationUpdate({
                type: 'create_initialization_update',
                bots: [
                    createBot('test', {
                        test: true,
                    }),
                ],
            });

            await instStore.addUpdates(
                recordName,
                'inst',
                'branch',
                [update.update],
                update.update.length
            );

            const result = await server.handleHttpRequest(
                httpGet(
                    `/instData?recordName=${recordName}&inst=inst&branch=branch`,
                    authenticatedHeaders
                )
            );

            expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    data: {
                        version: 1,
                        state: {
                            test: createBot('test', {
                                test: true,
                            }),
                        },
                    },
                },
                headers: accountCorsHeaders,
            });
        });

        testRateLimit(() =>
            httpGet('/instData?inst=inst&branch=branch', defaultHeaders)
        );
    });

    it('should return a 404 status code when accessing an endpoint that doesnt exist', async () => {
        const result = await server.handleHttpRequest(
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

    describe('handleWebsocketRequest()', () => {
        const connectionId = 'connectionId';

        describe('connect', () => {
            it('should do nothing', async () => {
                await server.handleWebsocketRequest(wsConnect(connectionId));

                const connection = await websocketConnectionStore.getConnection(
                    connectionId
                );

                expect(connection).toEqual(null);
            });
        });

        describe('login', () => {
            it('should return an error if the login message does not contain either a connectionToken or clientConnectionId', async () => {
                await server.handleWebsocketRequest(
                    wsMessage(
                        connectionId,
                        messageEvent(1, {
                            type: 'login',
                        } as any)
                    )
                );

                const errors = getWebSockerErrors(connectionId);

                expect(errors).toEqual([
                    [
                        WebsocketEventTypes.Error,
                        1,
                        {
                            success: false,
                            errorCode: 'unacceptable_connection_id',
                            errorMessage:
                                'A connection ID must be specified when logging in without a connection token.',
                        },
                    ],
                ]);
            });

            it('should return an error if the login message is improperly formattted', async () => {
                await server.handleWebsocketRequest(
                    wsMessage(connectionId, messageEvent(1, 123 as any))
                );

                const errors = getWebSockerErrors(connectionId);

                expect(errors).toEqual([
                    [
                        WebsocketEventTypes.Error,
                        1,
                        {
                            success: false,
                            errorCode: 'unacceptable_request',
                            errorMessage:
                                'The request was invalid. One or more fields were invalid.',
                            issues: [
                                {
                                    code: 'invalid_type',
                                    expected: 'object',
                                    message: 'Expected object, received number',
                                    path: [],
                                    received: 'number',
                                },
                            ],
                        },
                    ],
                ]);
            });

            it('should create a new connection for anonymous users', async () => {
                await server.handleWebsocketRequest(
                    wsMessage(
                        connectionId,
                        messageEvent(1, {
                            type: 'login',
                            connectionId: 'clientConnectionId',
                        })
                    )
                );

                expectNoWebSocketErrors(connectionId);

                const connection = await websocketConnectionStore.getConnection(
                    connectionId
                );

                expect(connection).toEqual({
                    serverConnectionId: connectionId,
                    clientConnectionId: 'clientConnectionId',
                    userId: null,
                    sessionId: null,
                    token: null,
                });
                expect(websocketMessenger.getMessages(connectionId)).toEqual([
                    {
                        type: 'login_result',
                        info: {
                            connectionId: 'clientConnectionId',
                            sessionId: null,
                            userId: null,
                        },
                    },
                ]);
            });

            it('should create a new connection for authenticated users', async () => {
                const connectionToken = generateV1ConnectionToken(
                    connectionKey,
                    'clientConnectionId',
                    'recordName',
                    'inst'
                );
                await server.handleWebsocketRequest(
                    wsMessage(
                        connectionId,
                        messageEvent(1, {
                            type: 'login',
                            connectionToken,
                        })
                    )
                );

                expectNoWebSocketErrors(connectionId);

                const connection = await websocketConnectionStore.getConnection(
                    connectionId
                );

                expect(connection).toEqual({
                    serverConnectionId: connectionId,
                    clientConnectionId: 'clientConnectionId',
                    userId: userId,
                    sessionId: sessionId,
                    token: connectionToken,
                });
            });
        });
        const cases = [['anonymous'] as const, ['authenticated'] as const];

        describe.each(cases)('%s', (c) => {
            let connectionToken: string | null;
            let recordName: string | null;
            const inst = 'inst';
            const clientConnectionId = 'clientConnectionId';
            const branch = 'shared';
            let connectionInfo: ConnectionInfo;

            const connection2 = 'connection2';
            const clientConnectionId2 = 'clientConnectionId2';
            let connectionInfo2: ConnectionInfo;
            let connectionToken2: string | null;

            beforeEach(async () => {
                if (c === 'authenticated') {
                    recordName = 'testRecord';
                    connectionToken = generateV1ConnectionToken(
                        connectionKey,
                        clientConnectionId,
                        recordName,
                        inst
                    );

                    await websocketController.login(connectionId, 1, {
                        type: 'login',
                        connectionToken,
                    });
                    connectionInfo = {
                        connectionId: clientConnectionId,
                        sessionId,
                        userId,
                    };

                    connectionToken2 = generateV1ConnectionToken(
                        ownerConnectionKey,
                        clientConnectionId2,
                        recordName,
                        inst
                    );

                    await websocketController.login(connection2, 99, {
                        type: 'login',
                        connectionToken: connectionToken2,
                    });

                    connectionInfo2 = {
                        connectionId: clientConnectionId2,
                        sessionId: ownerSessionId,
                        userId: ownerId,
                    };

                    store.policies[recordName] = {
                        [PRIVATE_MARKER]: {
                            document: {
                                permissions: [
                                    {
                                        type: 'inst.read',
                                        role: 'developer',
                                        insts: true,
                                    },
                                    {
                                        type: 'inst.create',
                                        role: 'developer',
                                        insts: true,
                                    },
                                    {
                                        type: 'policy.assign',
                                        role: 'developer',
                                        policies: true,
                                    },
                                    {
                                        type: 'inst.updateData',
                                        role: 'developer',
                                        insts: true,
                                    },
                                    {
                                        type: 'inst.sendAction',
                                        role: 'developer',
                                        insts: true,
                                    },
                                ],
                            },
                            markers: [ACCOUNT_MARKER],
                        },
                    };

                    store.roles[recordName] = {
                        [userId]: new Set(['developer']),
                    };
                } else {
                    recordName = null;
                    connectionToken = null;
                    await websocketController.login(connectionId, 1, {
                        type: 'login',
                        connectionId: clientConnectionId,
                    });
                    connectionInfo = {
                        connectionId: clientConnectionId,
                        sessionId: null,
                        userId: null,
                    };
                    connectionInfo2 = {
                        connectionId: clientConnectionId2,
                        sessionId: null,
                        userId: null,
                    };

                    await websocketController.login(connection2, 99, {
                        type: 'login',
                        connectionId: clientConnectionId2,
                    });
                }

                websocketMessenger.reset();
            });

            describe('repo/watch_branch', () => {
                it('should be able to connect to branches', async () => {
                    expectNoWebSocketErrors(connectionId);

                    await server.handleWebsocketRequest(
                        wsMessage(
                            connectionId,
                            messageEvent(2, {
                                type: 'repo/watch_branch',
                                recordName,
                                inst,
                                branch,
                            })
                        )
                    );

                    expectNoWebSocketErrors(connectionId);
                    expect(
                        websocketMessenger.getMessages(connectionId)
                    ).toEqual([
                        {
                            type: 'repo/add_updates',
                            recordName,
                            inst,
                            branch,
                            updates: [],
                            initial: true,
                        },
                    ]);
                });

                it('should send the initial updates', async () => {
                    expectNoWebSocketErrors(connectionId);

                    await instStore.addUpdates(
                        recordName,
                        inst,
                        branch,
                        ['abc'],
                        3
                    );

                    await server.handleWebsocketRequest(
                        wsMessage(
                            connectionId,
                            messageEvent(2, {
                                type: 'repo/watch_branch',
                                recordName,
                                inst,
                                branch,
                            })
                        )
                    );

                    expectNoWebSocketErrors(connectionId);
                    expect(
                        websocketMessenger.getMessages(connectionId)
                    ).toEqual([
                        {
                            type: 'repo/add_updates',
                            recordName,
                            inst,
                            branch,
                            updates: ['abc'],
                            initial: true,
                        },
                    ]);
                });

                it('should send updates when they are added', async () => {
                    expectNoWebSocketErrors(connectionId);

                    await server.handleWebsocketRequest(
                        wsMessage(
                            connectionId,
                            messageEvent(2, {
                                type: 'repo/watch_branch',
                                recordName,
                                inst,
                                branch,
                            })
                        )
                    );

                    expectNoWebSocketErrors(connectionId);

                    await websocketController.addUpdates(connection2, {
                        type: 'repo/add_updates',
                        recordName,
                        inst,
                        branch,
                        updates: ['abc'],
                    });

                    expectNoWebSocketErrors(connection2);

                    expect(
                        websocketMessenger.getMessages(connectionId)
                    ).toEqual([
                        {
                            type: 'repo/add_updates',
                            recordName,
                            inst,
                            branch,
                            updates: [],
                            initial: true,
                        },
                        {
                            type: 'repo/add_updates',
                            recordName,
                            inst,
                            branch,
                            updates: ['abc'],
                        },
                    ]);
                });
            });

            describe('repo/add_updates', () => {
                it('should add updates to the branch', async () => {
                    expectNoWebSocketErrors(connectionId);

                    await server.handleWebsocketRequest(
                        wsMessage(
                            connectionId,
                            messageEvent(2, {
                                type: 'repo/add_updates',
                                recordName,
                                inst,
                                branch,
                                updates: ['abc'],
                                updateId: 3,
                            })
                        )
                    );

                    expectNoWebSocketErrors(connectionId);
                    expect(
                        websocketMessenger.getMessages(connectionId)
                    ).toEqual([
                        {
                            type: 'repo/updates_received',
                            recordName,
                            inst,
                            branch,
                            updateId: 3,
                        },
                    ]);

                    expect(
                        await instStore.getCurrentUpdates(
                            recordName,
                            inst,
                            branch
                        )
                    ).toEqual({
                        updates: ['abc'],
                        timestamps: [expect.any(Number)],
                        instSizeInBytes: 3,
                    });
                });
            });

            describe('repo/unwatch_branch', () => {
                it('should stop sending updates', async () => {
                    expectNoWebSocketErrors(connectionId);

                    await server.handleWebsocketRequest(
                        wsMessage(
                            connectionId,
                            messageEvent(2, {
                                type: 'repo/watch_branch',
                                recordName,
                                inst,
                                branch,
                            })
                        )
                    );

                    expectNoWebSocketErrors(connectionId);

                    // await websocketController.login(connection2, 1, {
                    //     type: 'login',
                    //     connectionId: clientConnectionId2,
                    // });

                    await websocketController.addUpdates(connection2, {
                        type: 'repo/add_updates',
                        recordName,
                        inst,
                        branch,
                        updates: ['abc'],
                    });

                    expectNoWebSocketErrors(connection2);

                    await server.handleWebsocketRequest(
                        wsMessage(
                            connectionId,
                            messageEvent(3, {
                                type: 'repo/unwatch_branch',
                                recordName,
                                inst,
                                branch,
                            })
                        )
                    );

                    expectNoWebSocketErrors(connectionId);

                    await websocketController.addUpdates(connection2, {
                        type: 'repo/add_updates',
                        recordName,
                        inst,
                        branch,
                        updates: ['def'],
                    });

                    expectNoWebSocketErrors(connection2);

                    expect(
                        websocketMessenger.getMessages(connectionId)
                    ).toEqual([
                        {
                            type: 'repo/add_updates',
                            recordName,
                            inst,
                            branch,
                            updates: [],
                            initial: true,
                        },
                        {
                            type: 'repo/add_updates',
                            recordName,
                            inst,
                            branch,
                            updates: ['abc'],
                        },
                    ]);
                });
            });

            describe('repo/send_action', () => {
                it('should send an action to the specified device', async () => {
                    expectNoWebSocketErrors(connectionId);
                    await websocketController.watchBranch(connection2, {
                        type: 'repo/watch_branch',
                        recordName,
                        inst,
                        branch,
                    });

                    expectNoWebSocketErrors(connection2);

                    await server.handleWebsocketRequest(
                        wsMessage(
                            connectionId,
                            messageEvent(2, {
                                type: 'repo/send_action',
                                recordName,
                                inst,
                                branch,
                                action: remote(toast('hello!'), {
                                    connectionId: clientConnectionId2,
                                }),
                            })
                        )
                    );

                    expectNoWebSocketErrors(connectionId);

                    expect(
                        websocketMessenger.getMessages(connection2).slice(1)
                    ).toEqual([
                        {
                            type: 'repo/receive_action',
                            recordName,
                            inst,
                            branch,
                            action: device(connectionInfo, toast('hello!')),
                        },
                    ]);
                });

                it('should do nothing if no devices are matched by the selector', async () => {
                    expectNoWebSocketErrors(connectionId);
                    await websocketController.watchBranch(connection2, {
                        type: 'repo/watch_branch',
                        recordName,
                        inst,
                        branch,
                    });

                    expectNoWebSocketErrors(connection2);

                    await server.handleWebsocketRequest(
                        wsMessage(
                            connectionId,
                            messageEvent(2, {
                                type: 'repo/send_action',
                                recordName,
                                inst,
                                branch,
                                action: remote(toast('hello!'), {
                                    connectionId: 'missing',
                                }),
                            })
                        )
                    );

                    expectNoWebSocketErrors(connectionId);

                    expect(
                        websocketMessenger.getMessages(connection2).slice(1)
                    ).toEqual([]);
                });
            });

            describe('repo/watch_branch_devices', () => {
                it('should watch for connection events on the given branch', async () => {
                    expectNoWebSocketErrors(connectionId);

                    await server.handleWebsocketRequest(
                        wsMessage(
                            connectionId,
                            messageEvent(2, {
                                type: 'repo/watch_branch_devices',
                                recordName,
                                inst,
                                branch,
                            })
                        )
                    );

                    expectNoWebSocketErrors(connectionId);

                    await websocketController.watchBranch(connection2, {
                        type: 'repo/watch_branch',
                        recordName,
                        inst,
                        branch,
                    });

                    expectNoWebSocketErrors(connection2);

                    expect(
                        websocketMessenger.getMessages(connectionId)
                    ).toEqual([
                        {
                            type: 'repo/connected_to_branch',
                            broadcast: false,
                            branch: {
                                type: 'repo/watch_branch',
                                recordName,
                                inst,
                                branch,
                            },
                            connection: connectionInfo2,
                        },
                    ]);
                });

                it('should watch for disconnection events on the given branch', async () => {
                    expectNoWebSocketErrors(connectionId);

                    await server.handleWebsocketRequest(
                        wsMessage(
                            connectionId,
                            messageEvent(2, {
                                type: 'repo/watch_branch_devices',
                                recordName,
                                inst,
                                branch,
                            })
                        )
                    );

                    expectNoWebSocketErrors(connectionId);

                    await websocketController.watchBranch(connection2, {
                        type: 'repo/watch_branch',
                        recordName,
                        inst,
                        branch,
                    });

                    expectNoWebSocketErrors(connection2);

                    await websocketController.unwatchBranch(
                        connection2,
                        recordName,
                        inst,
                        branch
                    );

                    expectNoWebSocketErrors(connection2);

                    expect(
                        websocketMessenger.getMessages(connectionId)
                    ).toEqual([
                        {
                            type: 'repo/connected_to_branch',
                            broadcast: false,
                            branch: {
                                type: 'repo/watch_branch',
                                recordName,
                                inst,
                                branch,
                            },
                            connection: connectionInfo2,
                        },
                        {
                            type: 'repo/disconnected_from_branch',
                            broadcast: false,
                            recordName,
                            inst,
                            branch,
                            connection: connectionInfo2,
                        },
                    ]);
                });
            });

            describe('repo/unwatch_branch_devices', () => {
                it('should stop watching for connection events', async () => {
                    expectNoWebSocketErrors(connectionId);

                    await server.handleWebsocketRequest(
                        wsMessage(
                            connectionId,
                            messageEvent(2, {
                                type: 'repo/watch_branch_devices',
                                recordName,
                                inst,
                                branch,
                            })
                        )
                    );

                    expectNoWebSocketErrors(connectionId);

                    await server.handleWebsocketRequest(
                        wsMessage(
                            connectionId,
                            messageEvent(2, {
                                type: 'repo/unwatch_branch_devices',
                                recordName,
                                inst,
                                branch,
                            })
                        )
                    );

                    expectNoWebSocketErrors(connectionId);

                    await websocketController.watchBranch(connection2, {
                        type: 'repo/watch_branch',
                        recordName,
                        inst,
                        branch,
                    });

                    expectNoWebSocketErrors(connection2);

                    await websocketController.unwatchBranch(
                        connection2,
                        recordName,
                        inst,
                        branch
                    );

                    expectNoWebSocketErrors(connection2);

                    expect(
                        websocketMessenger.getMessages(connectionId)
                    ).toEqual([]);
                });
            });

            describe('repo/connection_count', () => {
                it('should return the connection count for the given branch', async () => {
                    expectNoWebSocketErrors(connectionId);

                    await websocketController.watchBranch(connection2, {
                        type: 'repo/watch_branch',
                        recordName,
                        inst,
                        branch,
                    });

                    expectNoWebSocketErrors(connection2);

                    await server.handleWebsocketRequest(
                        wsMessage(
                            connectionId,
                            messageEvent(2, {
                                type: 'repo/connection_count',
                                recordName,
                                inst,
                                branch,
                            })
                        )
                    );

                    expectNoWebSocketErrors(connectionId);

                    expect(
                        websocketMessenger.getMessages(connectionId)
                    ).toEqual([
                        {
                            type: 'repo/connection_count',
                            recordName,
                            inst,
                            branch,
                            count: 1,
                        },
                    ]);
                });
            });
        });

        describe('sync/time', () => {
            it('should return the current time', async () => {
                await server.handleWebsocketRequest(
                    wsMessage(
                        connectionId,
                        messageEvent(1, {
                            type: 'sync/time',
                            id: 100,
                            clientRequestTime: 123,
                        })
                    )
                );

                expectNoWebSocketErrors(connectionId);

                expect(websocketMessenger.getMessages(connectionId)).toEqual([
                    {
                        type: 'sync/time/response',
                        id: 100,
                        clientRequestTime: 123,
                        serverReceiveTime: expect.any(Number),
                        serverTransmitTime: expect.any(Number),
                    },
                ]);
            });
        });

        describe('download request', () => {
            it('should download and process the message', async () => {
                websocketMessenger.uploadedMessages = new Map([
                    [
                        'message 1',
                        JSON.stringify({
                            type: 'login',
                            connectionId: 'clientConnectionId',
                        } as LoginMessage),
                    ],
                ]);

                await server.handleWebsocketRequest(
                    wsMessage(
                        connectionId,
                        downloadRequestEvent(1, 'message 1', 'GET', {})
                    )
                );

                expectNoWebSocketErrors(connectionId);

                expect(websocketMessenger.getMessages(connectionId)).toEqual([
                    {
                        type: 'login_result',
                        info: {
                            connectionId: 'clientConnectionId',
                            sessionId: null,
                            userId: null,
                        },
                    },
                ]);
            });
        });

        describe('upload request', () => {
            it('should return a URL that the client can upload to', async () => {
                websocketMessenger.messageUploadUrl = 'upload_url';

                await server.handleWebsocketRequest(
                    wsMessage(connectionId, uploadRequestEvent(1))
                );

                expectNoWebSocketErrors(connectionId);

                const messages = websocketMessenger.getEvents(connectionId);
                expect(messages).toEqual([
                    [
                        WebsocketEventTypes.UploadResponse,
                        1,
                        'upload_url',
                        'POST',
                        {},
                    ],
                ]);
            });
        });
    });

    function expectNoWebSocketErrors(connectionId: string) {
        const errors = getWebSockerErrors(connectionId);
        expect(errors).toEqual([]);
    }

    function getWebSockerErrors(connectionId: string) {
        const events = websocketMessenger.getEvents(connectionId);
        const errors = events.filter((e) => e[0] === WebsocketEventTypes.Error);
        return errors;
    }

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
        testRateLimit(method, url, createBody);
    }

    function testOrigin(
        method: GenericHttpRequest['method'],
        url: string,
        createBody: () => string | null = () => null
    ) {
        it('should return a 403 status code if the request is made from a non-account origin', async () => {
            const result = await server.handleHttpRequest(
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
            const result = await server.handleHttpRequest(request);

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
            const result = await server.handleHttpRequest(request);

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

        it('should return a 403 status code when the session key is invalid', async () => {
            let request = getRequest();
            request.headers['authorization'] =
                'Bearer ' +
                formatV1SessionKey(userId, 'sessionId', 'wrong', 9999999999);
            const result = await server.handleHttpRequest(request);

            expect(result).toEqual({
                statusCode: 403,
                body: JSON.stringify({
                    success: false,
                    errorCode: 'invalid_key',
                    errorMessage: 'The session key is invalid.',
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
            const result = await server.handleHttpRequest(request);

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
            const result = await server.handleHttpRequest(request);

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

    function testRateLimit(createRequest: () => GenericHttpRequest): void;
    function testRateLimit(
        method: GenericHttpRequest['method'],
        url: string,
        createBody?: () => string | null
    ): void;
    function testRateLimit(
        createRequestOrMethod:
            | (() => GenericHttpRequest)
            | GenericHttpRequest['method'],
        url?: string,
        createBody?: () => string | null
    ): void {
        const createRequestBody = createBody ?? (() => null);
        const ip = '123.456.789';
        const createRequest: () => GenericHttpRequest =
            typeof createRequestOrMethod === 'function'
                ? createRequestOrMethod
                : () =>
                      httpRequest(
                          createRequestOrMethod,
                          url as string,
                          createRequestBody(),
                          defaultHeaders,
                          ip
                      );

        it('should return a 429 status code when the rate limit is exceeded', async () => {
            jest.useFakeTimers({
                now: 0,
            });

            await rateLimiter.increment(ip, 100);

            const request = createRequest();
            const result = await server.handleHttpRequest(request);

            expect(result).toEqual({
                statusCode: 429,
                body: JSON.stringify({
                    success: false,
                    errorCode: 'rate_limit_exceeded',
                    errorMessage: 'Rate limit exceeded.',
                    retryAfterSeconds: 1,
                    totalHits: 101,
                }),
                headers: {
                    'Access-Control-Allow-Origin': request.headers.origin,
                    'Access-Control-Allow-Headers':
                        'Content-Type, Authorization',
                },
            });
        });

        it('should skip rate limit checks if the server has no rate limiter', async () => {
            jest.useFakeTimers({
                now: 0,
            });

            server = new RecordsServer(
                allowedAccountOrigins,
                allowedApiOrigins,
                authController,
                livekitController,
                recordsController,
                eventsController,
                dataController,
                manualDataController,
                filesController,
                subscriptionController,
                null as any,
                policyController,
                aiController,
                websocketController
            );

            await rateLimiter.increment(ip, 100);

            const request = createRequest();
            const result = await server.handleHttpRequest(request);

            expect(result.statusCode).not.toEqual(429);
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

    function wsMessage(
        connectionId: string,
        body: string,
        ipAddress: string = '123.456.789'
    ): GenericWebsocketRequest {
        return {
            type: 'message',
            connectionId,
            body,
            ipAddress,
        };
    }

    function messageEvent(requestId: number, body: WebsocketMessage): string {
        const e: WebsocketMessageEvent = [
            WebsocketEventTypes.Message,
            requestId,
            body,
        ];
        return JSON.stringify(e);
    }

    function uploadRequestEvent(requestId: number): string {
        const e: WebsocketUploadRequestEvent = [
            WebsocketEventTypes.UploadRequest,
            requestId,
        ];

        return JSON.stringify(e);
    }

    function downloadRequestEvent(
        requestId: number,
        downloadUrl: string,
        downloadMethod: string,
        downloadHeaders: any
    ): string {
        const e: WebsocketDownloadRequestEvent = [
            WebsocketEventTypes.DownloadRequest,
            requestId,
            downloadUrl,
            downloadMethod,
            downloadHeaders,
        ];

        return JSON.stringify(e);
    }

    function wsConnect(
        connectionId: string,
        ipAddress: string = '123.456.789'
    ): GenericWebsocketRequest {
        return {
            type: 'connect',
            connectionId,
            body: null,
            ipAddress,
        };
    }

    function wsDisconnect(
        connectionId: string,
        ipAddress: string = '123.456.789'
    ): GenericWebsocketRequest {
        return {
            type: 'disconnect',
            connectionId,
            body: null,
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
