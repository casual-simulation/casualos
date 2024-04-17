import {
    AIChatInterfaceRequest,
    AIChatInterfaceResponse,
    AIGenerateImageInterfaceRequest,
    AIGenerateImageInterfaceResponse,
    AIGenerateSkyboxInterfaceRequest,
    AIGenerateSkyboxInterfaceResponse,
    AIGetSkyboxInterfaceResponse,
    AuthController,
    DataRecordsController,
    DataRecordsStore,
    EventRecordsController,
    FileRecordsController,
    InstRecordsStore,
    MemoryRateLimiter,
    MemoryStore,
    MemoryTempInstRecordsStore,
    MemoryWebsocketConnectionStore,
    MemoryWebsocketMessenger,
    ModerationController,
    PolicyController,
    RateLimitController,
    RecordsController,
    RecordsServer,
    SplitInstRecordsStore,
    StripeInterface,
    StripeProduct,
    SubscriptionController,
    TemporaryInstRecordsStore,
    WebsocketController,
    allowAllFeatures,
} from '@casual-simulation/aux-records';
import { AIController } from '@casual-simulation/aux-records/AIController';
import { parseSessionKey } from '@casual-simulation/aux-records/AuthUtils';
import { LivekitController } from '@casual-simulation/aux-records/LivekitController';
import { MemoryAuthMessenger } from '@casual-simulation/aux-records/MemoryAuthMessenger';
import { PrivoClientInterface } from '@casual-simulation/aux-records/PrivoClient';
import {
    createTestControllers,
    createTestUser,
} from '@casual-simulation/aux-records/TestUtils';
import { configureRoutes } from './CasualWareApi';
import {
    GenericHttpHeaders,
    GenericHttpRequest,
    GenericHttpResponse,
    GenericPathParameters,
    GenericQueryStringParameters,
    GenericWebsocketRequest,
    WebsocketDownloadRequestEvent,
    WebsocketEventTypes,
    WebsocketHttpResponseMessage,
    WebsocketMessage,
    WebsocketMessageEvent,
    WebsocketUploadRequestEvent,
} from '@casual-simulation/aux-common';
import { RateLimiter } from '@casual-simulation/rate-limit-redis';

console.log = jest.fn();

describe('CasualWareApi', () => {
    let savedMemoryStore: MemoryStore;
    let savedSessionKey: string;
    let savedConnectionKey: string;
    let savedUserId: string;
    let savedSessionId: string;
    let savedOwnerId: string;
    let savedOwnerSessionId: string;
    let savedOwnerConnectionKey: string;
    let savedExpireTimeMs: number;
    let savedSessionSecret: string;
    let savedRecordKey: string;

    beforeAll(async () => {
        const services = createTestControllers();
        let requestResult = await services.auth.requestLogin({
            address: 'test@example.com',
            addressType: 'email',
            ipAddress: '123.456.789',
        });

        if (!requestResult.success) {
            throw new Error('Unable to request a login!');
        }

        const message = services.authMessenger.messages.find(
            (m) => m.address === 'test@example.com'
        );

        if (!message) {
            throw new Error('Message not found!');
        }

        const loginResult = await services.auth.completeLogin({
            code: message.code,
            ipAddress: '123.456.789',
            requestId: requestResult.requestId,
            userId: requestResult.userId,
        });

        if (!loginResult.success) {
            throw new Error('Unable to login!');
        }

        savedSessionKey = loginResult.sessionKey;
        savedConnectionKey = loginResult.connectionKey;
        savedUserId = loginResult.userId;

        const owner = await createTestUser(services, 'owner@example.com');

        savedOwnerId = owner.userId;
        savedOwnerConnectionKey = owner.connectionKey;
        savedOwnerSessionId = owner.sessionId;

        let [uid, sid, secret, expire] = parseSessionKey(savedSessionKey);
        savedSessionId = sid;
        savedSessionSecret = secret;
        savedExpireTimeMs = expire;

        const recordKeyResult = await services.records.createPublicRecordKey(
            recordName,
            'subjectfull',
            savedUserId
        );
        if (!recordKeyResult.success) {
            throw new Error('Unable to create record key!');
        }

        savedRecordKey = recordKeyResult.recordKey;

        const record = await services.store.getRecordByName(recordName);
        await services.store.updateRecord({
            name: recordName,
            ownerId: savedOwnerId,
            studioId: null,
            secretHashes: record.secretHashes,
            secretSalt: record.secretSalt,
        });

        savedMemoryStore = services.store;
    });

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
    let moderationController: ModerationController;

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
    let privoClient: PrivoClientInterface;
    let privoClientMock: {
        createChildAccount: jest.Mock<
            ReturnType<PrivoClientInterface['createChildAccount']>
        >;
        createAdultAccount: jest.Mock<
            ReturnType<PrivoClientInterface['createAdultAccount']>
        >;
        getUserInfo: jest.Mock<ReturnType<PrivoClientInterface['getUserInfo']>>;
        generateAuthorizationUrl: jest.Mock<
            ReturnType<PrivoClientInterface['generateAuthorizationUrl']>
        >;
        processAuthorizationCallback: jest.Mock<
            ReturnType<PrivoClientInterface['processAuthorizationCallback']>
        >;
        checkEmail: jest.Mock<ReturnType<PrivoClientInterface['checkEmail']>>;
        checkDisplayName: jest.Mock<
            ReturnType<PrivoClientInterface['checkDisplayName']>
        >;
    };

    beforeEach(async () => {
        allowedAccountOrigins = new Set([accountOrigin]);

        allowedApiOrigins = new Set([apiOrigin]);

        store = savedMemoryStore.clone();
        store.subscriptionConfiguration = {
            subscriptions: [
                {
                    id: 'sub_id',
                    eligibleProducts: ['product_id'],
                    featureList: ['Feature 1', 'Feature 2'],
                    product: 'product_id',
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
        };

        sessionKey = savedSessionKey;
        connectionKey = savedConnectionKey;
        userId = savedUserId;
        sessionId = savedSessionId;
        ownerId = savedOwnerId;
        ownerSessionId = savedOwnerSessionId;
        ownerConnectionKey = savedOwnerConnectionKey;
        expireTimeMs = savedExpireTimeMs;
        sessionSecret = savedSessionSecret;
        recordKey = savedRecordKey;

        manualDataStore = new MemoryStore({
            subscriptions: null as any,
        });

        authMessenger = new MemoryAuthMessenger();
        privoClient = privoClientMock = {
            createAdultAccount: jest.fn(),
            createChildAccount: jest.fn(),
            getUserInfo: jest.fn(),
            generateAuthorizationUrl: jest.fn(),
            processAuthorizationCallback: jest.fn(),
            checkEmail: jest.fn(),
            checkDisplayName: jest.fn(),
        };
        authController = new AuthController(
            store,
            authMessenger,
            store,
            undefined,
            privoClient
        );
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
            messenger: store,
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
                interfaces: {
                    openai: chatInterface,
                },
                options: {
                    defaultModel: 'default-model',
                    allowedChatModels: [
                        {
                            model: 'model-1',
                            provider: 'openai',
                        },
                        {
                            model: 'model-2',
                            provider: 'openai',
                        },
                    ],
                    allowedChatSubscriptionTiers: ['beta'],
                    defaultModelProvider: 'openai',
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
            policies: store,
        });
        moderationController = new ModerationController(store, store, store);

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
            websocketController,
            moderationController
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
        apiHeaders['authorization'] = authenticatedHeaders[
            'authorization'
        ] = `Bearer ${sessionKey}`;

        configureRoutes(server, {
            authController,
            dataController,
            recordsController,
            eventsController,
            filesController,
            subscriptionController,
            rateLimitController,
            dynamodbClient: null as any,
            filesStore: store,
            manualDataController,
            policyController,
            // aiController: aiController,
            websocketController,
            // moderationController,
            websocketMessenger,
            websocketRateLimitController: rateLimitController,
            mongoClient: null as any,
            mongoDatabase: null as any,
            redisClient: null as any,
            server: server,
        });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('GET /api/casualware/supported', () => {
        it('should return a 200 response with a success body', async () => {
            const response = await server.handleHttpRequest(
                httpGet('/api/casualware/supported')
            );

            expectResponseBodyToEqual(response, {
                statusCode: 200,
                headers: corsHeaders(defaultHeaders['origin']),
                body: {
                    success: true,
                },
            });
        });
    });

    function corsHeaders(origin: string) {
        return {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        };
    }

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

    function expectWebsocketHttpResponseBodyToEqual(
        message: WebsocketHttpResponseMessage,
        expected: any
    ) {
        const response = message.response;
        const json = response.body
            ? JSON.parse(response.body as string)
            : undefined;

        expect({
            ...response,
            body: json,
        }).toEqual(expected);
    }

    function getWebsocketHttpResponse(
        connectionId: string,
        id: number
    ): WebsocketHttpResponseMessage {
        const messages = websocketMessenger.getMessages(connectionId);
        return messages.find(
            (m) => m.type === 'http_response' && m.id === id
        ) as WebsocketHttpResponseMessage;
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
        ipAddress: string = '123.456.789',
        origin: string = 'https://test.com'
    ): GenericWebsocketRequest {
        return {
            type: 'message',
            connectionId,
            body,
            ipAddress,
            origin,
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
        ipAddress: string = '123.456.789',
        origin: string = 'https://test.com'
    ): GenericWebsocketRequest {
        return {
            type: 'connect',
            connectionId,
            body: null,
            ipAddress,
            origin,
        };
    }

    function wsDisconnect(
        connectionId: string,
        ipAddress: string = '123.456.789',
        origin: string = 'https://test.com'
    ): GenericWebsocketRequest {
        return {
            type: 'disconnect',
            connectionId,
            body: null,
            ipAddress,
            origin,
        };
    }
});

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
