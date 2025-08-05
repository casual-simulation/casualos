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
import {
    parseAuthorization,
    RecordsServer,
    validateOrigin,
    getSessionKey,
} from './RecordsServer';
import type {
    GenericHttpHeaders,
    GenericHttpRequest,
    GenericHttpResponse,
    GenericPathParameters,
    GenericQueryStringParameters,
    GenericWebsocketRequest,
    UserRole,
} from '@casual-simulation/aux-common';
import {
    DEFAULT_BRANCH_NAME,
    formatV1SessionKey,
    generateV1ConnectionToken,
    getStateFromUpdates,
    isFailure,
    isRecordKey,
    parseSessionKey,
    SUBSCRIPTION_ID_NAMESPACE,
} from '@casual-simulation/aux-common';
import type { RelyingParty } from './AuthController';
import {
    AuthController,
    INVALID_KEY_ERROR_MESSAGE,
    PRIVO_OPEN_ID_PROVIDER,
} from './AuthController';
import { MemoryAuthMessenger } from './MemoryAuthMessenger';
import type { AuthSession, AuthUser } from './AuthStore';
import { LivekitController } from './LivekitController';
import type { CreateStudioSuccess } from './RecordsController';
import { RecordsController } from './RecordsController';
import type { Studio } from './RecordsStore';
import { EventRecordsController } from './EventRecordsController';
import { DataRecordsController } from './DataRecordsController';
import type { DataRecordsStore } from './DataRecordsStore';
import { FileRecordsController } from './FileRecordsController';
import { getHash } from '@casual-simulation/crypto';
import { SubscriptionController } from './SubscriptionController';
import type { StripeInterface, StripeProduct } from './StripeInterface';

import { MemoryNotificationRecordsStore } from './notifications/MemoryNotificationRecordsStore';
import { MemoryPackageRecordsStore } from './packages/MemoryPackageRecordsStore';
import { MemoryPackageVersionRecordsStore } from './packages/version/MemoryPackageVersionRecordsStore';
import { PackageRecordsController } from './packages/PackageRecordsController';
import { PackageVersionRecordsController } from './packages/version/PackageVersionRecordsController';
import { PolicyController } from './PolicyController';
import {
    ACCOUNT_MARKER,
    ADMIN_ROLE_NAME,
    PRIVATE_MARKER,
    PUBLIC_READ_MARKER,
} from '@casual-simulation/aux-common';
import { RateLimitController } from './RateLimitController';
import { MemoryRateLimiter } from './MemoryRateLimiter';
import type { RateLimiter } from '@casual-simulation/rate-limit-redis';
import {
    asyncIterable,
    createTestControllers,
    createTestSubConfiguration,
    createTestUser,
    unwindAndCaptureAsync,
} from './TestUtils';
import { AIController } from './AIController';
import type {
    AIChatInterfaceRequest,
    AIChatInterfaceResponse,
    AIChatInterfaceStreamResponse,
} from './AIChatInterface';
import type {
    AIGenerateSkyboxInterfaceRequest,
    AIGenerateSkyboxInterfaceResponse,
    AIGetSkyboxInterfaceResponse,
} from './AIGenerateSkyboxInterface';
import type {
    AIGenerateImageInterfaceRequest,
    AIGenerateImageInterfaceResponse,
} from './AIImageInterface';
import { sortBy } from 'lodash';
import { MemoryStore } from './MemoryStore';
import { WebsocketController } from './websockets/WebsocketController';
import { MemoryWebsocketConnectionStore } from './websockets/MemoryWebsocketConnectionStore';
import { MemoryWebsocketMessenger } from './websockets/MemoryWebsocketMessenger';
import type { InstRecordsStore } from './websockets/InstRecordsStore';
import type { TemporaryInstRecordsStore } from './websockets/TemporaryInstRecordsStore';
import { SplitInstRecordsStore } from './websockets/SplitInstRecordsStore';
import { MemoryTempInstRecordsStore } from './websockets/MemoryTempInstRecordsStore';
import type {
    LoginMessage,
    WebsocketDownloadRequestEvent,
    WebsocketHttpPartialResponseMessage,
    WebsocketHttpResponseMessage,
    WebsocketMessage,
    WebsocketMessageEvent,
    WebsocketUploadRequestEvent,
} from '@casual-simulation/aux-common/websockets/WebsocketEvents';
import { WebsocketEventTypes } from '@casual-simulation/aux-common/websockets/WebsocketEvents';
import type {
    StoredAuxVersion1,
    StoredAux,
} from '@casual-simulation/aux-common/bots';
import {
    createBot,
    getInstStateFromUpdates,
    toast,
} from '@casual-simulation/aux-common/bots';
import {
    device,
    remote,
} from '@casual-simulation/aux-common/common/RemoteActions';
import type { ConnectionInfo } from '@casual-simulation/aux-common/common/ConnectionInfo';
import {
    constructInitializationUpdate,
    tryParseJson,
} from '@casual-simulation/aux-common';
import type { PrivoClientInterface } from './PrivoClient';
import { DateTime } from 'luxon';
import { ModerationController } from './ModerationController';
import type {
    AssignPermissionToSubjectAndMarkerSuccess,
    AssignPermissionToSubjectAndResourceSuccess,
} from './PolicyStore';
import type {
    GenerateAuthenticationOptionsOpts,
    GenerateRegistrationOptionsOpts,
    VerifiedAuthenticationResponse,
    VerifiedRegistrationResponse,
    VerifyAuthenticationResponseOpts,
} from '@simplewebauthn/server';
import {
    generateAuthenticationOptions,
    generateRegistrationOptions,
    verifyAuthenticationResponse,
    verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type {
    PublicKeyCredentialCreationOptionsJSON,
    PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/types';
import { fromByteArray } from 'base64-js';
import { z } from 'zod';
import type { AIHumeInterfaceGetAccessTokenResult } from './AIHumeInterface';
import * as jose from 'jose';
import { LoomController } from './LoomController';
import type {
    AISloydInterfaceCreateModelRequest,
    AISloydInterfaceCreateModelResponse,
    AISloydInterfaceEditModelRequest,
    AISloydInterfaceEditModelResponse,
} from './AISloydInterface';
import { MemoryModerationJobProvider } from './MemoryModerationJobProvider';
import { buildSubscriptionConfig } from './SubscriptionConfigBuilder';
import { WebhookRecordsController } from './webhooks/WebhookRecordsController';
import { MemoryWebhookRecordsStore } from './webhooks/MemoryWebhookRecordsStore';
import type {
    HandleHttpRequestRequest,
    HandleHttpRequestResult,
} from './webhooks/WebhookEnvironment';
import { NotificationRecordsController } from './notifications/NotificationRecordsController';
import type { WebPushInterface } from './notifications/WebPushInterface';
import { v5 as uuidv5 } from 'uuid';
import type { AIOpenAIRealtimeInterface } from './AIOpenAIRealtimeInterface';
import type { PackageRecordVersionKey } from './packages/version/PackageVersionRecordsStore';
import { version } from './packages/version/PackageVersionRecordsStore';
import { SearchRecordsController } from './search/SearchRecordsController';
import { MemorySearchRecordsStore } from './search/MemorySearchRecordsStore';
import { MemorySearchInterface } from './search/MemorySearchInterface';

jest.mock('@simplewebauthn/server');
let verifyRegistrationResponseMock: jest.Mock<
    Promise<VerifiedRegistrationResponse>,
    [VerifyAuthenticationResponseOpts]
> = verifyRegistrationResponse as any;
let generateRegistrationOptionsMock: jest.Mock<
    Promise<PublicKeyCredentialCreationOptionsJSON>,
    [GenerateRegistrationOptionsOpts]
> = generateRegistrationOptions as any;
let generateAuthenticationOptionsMock: jest.Mock<
    Promise<PublicKeyCredentialRequestOptionsJSON>,
    [GenerateAuthenticationOptionsOpts]
> = generateAuthenticationOptions as any;

let verifyAuthenticationResponseMock: jest.Mock<
    Promise<VerifiedAuthenticationResponse>,
    [VerifyAuthenticationResponseOpts]
> = verifyAuthenticationResponse as any;

generateRegistrationOptionsMock.mockImplementation(async (opts) => {
    const generateRegistrationOptions = jest.requireActual(
        '@simplewebauthn/server'
    ).generateRegistrationOptions;
    return generateRegistrationOptions(opts);
});

verifyRegistrationResponseMock.mockImplementation(async (opts) => {
    const verifyRegistrationResponse = jest.requireActual(
        '@simplewebauthn/server'
    ).verifyRegistrationResponse;
    return verifyRegistrationResponse(opts);
});

generateAuthenticationOptionsMock.mockImplementation(async (opts) => {
    const generateAuthenticationOptions = jest.requireActual(
        '@simplewebauthn/server'
    ).generateAuthenticationOptions;
    return generateAuthenticationOptions(opts);
});

verifyAuthenticationResponseMock.mockImplementation(async (opts) => {
    const verifyAuthenticationResponse = jest.requireActual(
        '@simplewebauthn/server'
    ).verifyAuthenticationResponse;
    return verifyAuthenticationResponse(opts);
});

console.log = jest.fn();
// console.error = jest.fn();

describe('RecordsServer', () => {
    let savedMemoryStore: MemoryStore;
    let savedSessionKey: string;
    let savedConnectionKey: string;
    let savedUserId: string;
    let savedSessionId: string;
    let savedOwnerId: string;
    let savedOwnerSessionId: string;
    let savedOwnerConnectionKey: string;
    let savedOwnerSessionKey: string;
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
        savedOwnerSessionKey = owner.sessionKey;

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
    let jobProvider: MemoryModerationJobProvider;
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
    let loomController: LoomController;

    let policyController: PolicyController;
    let webhookController: WebhookRecordsController;
    let webhookStore: MemoryWebhookRecordsStore;
    let webhookEnvironment: {
        handleHttpRequest: jest.Mock<
            Promise<HandleHttpRequestResult>,
            [HandleHttpRequestRequest]
        >;
    };

    let notificationStore: MemoryNotificationRecordsStore;
    let notificationController: NotificationRecordsController;
    let webPushInterface: jest.Mocked<WebPushInterface>;

    let packageStore: MemoryPackageRecordsStore;
    let packageController: PackageRecordsController;
    let packageVersionsStore: MemoryPackageVersionRecordsStore;
    let packageVersionController: PackageVersionRecordsController;

    let searchRecordsStore: MemorySearchRecordsStore;
    let searchInterface: MemorySearchInterface;
    let searchRecordsController: SearchRecordsController;

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
        chatStream: jest.Mock<
            AsyncIterable<AIChatInterfaceStreamResponse>,
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
    let humeInterface: {
        getAccessToken: jest.Mock<Promise<AIHumeInterfaceGetAccessTokenResult>>;
    };
    let sloydInterface: {
        createModel: jest.Mock<
            Promise<AISloydInterfaceCreateModelResponse>,
            [AISloydInterfaceCreateModelRequest]
        >;
        editModel: jest.Mock<
            Promise<AISloydInterfaceEditModelResponse>,
            [AISloydInterfaceEditModelRequest]
        >;
    };
    let realtimeInterface: jest.Mocked<AIOpenAIRealtimeInterface>;

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
    let ownerSessionKey: string;
    let expireTimeMs: number;
    let sessionSecret: string;
    let recordKey: string;
    let relyingParty: RelyingParty;

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
    let privoClientMock: jest.MockedObject<PrivoClientInterface>;

    beforeEach(async () => {
        allowedAccountOrigins = new Set([accountOrigin]);

        allowedApiOrigins = new Set([apiOrigin]);

        store = savedMemoryStore.clone();
        store.subscriptionConfiguration = createTestSubConfiguration((config) =>
            config
                .addSubscription('sub_id', (sub) =>
                    sub
                        .withProduct('product_id')
                        .withEligibleProducts(['product_id'])
                        .withFeaturesList(['Feature 1', 'Feature 2'])
                        .withAllDefaultFeatures()
                )
                .withUserDefaultFeatures((features) =>
                    features.withAllDefaultFeatures().withWebhooks()
                )
                .withStudioDefaultFeatures((features) =>
                    features.withAllDefaultFeatures().withWebhooks()
                )
        );

        sessionKey = savedSessionKey;
        connectionKey = savedConnectionKey;
        userId = savedUserId;
        sessionId = savedSessionId;
        ownerId = savedOwnerId;
        ownerSessionId = savedOwnerSessionId;
        ownerConnectionKey = savedOwnerConnectionKey;
        ownerSessionKey = savedOwnerSessionKey;
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
            generateLogoutUrl: jest.fn(),
            resendConsentRequest: jest.fn(),
            lookupServiceId: jest.fn(),
        };
        relyingParty = {
            id: 'relying_party_id',
            name: 'Relying Party',
            origin: accountOrigin,
        };
        authController = new AuthController(
            store,
            authMessenger,
            store,
            undefined,
            privoClient,
            [relyingParty]
        );

        // manually disable the Privo flag for tests
        // (it is automatically set to true because a privo client is specified, but most tests
        // assume privo isn't enabled)
        authController.privoEnabled = false;

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
            privo: privoClient,
        });

        websocketConnectionStore = new MemoryWebsocketConnectionStore();
        websocketMessenger = new MemoryWebsocketMessenger();
        instStore = new SplitInstRecordsStore(
            new MemoryTempInstRecordsStore(),
            store
        );
        tempInstStore = new MemoryTempInstRecordsStore();

        packageStore = new MemoryPackageRecordsStore(store);
        packageVersionsStore = new MemoryPackageVersionRecordsStore(
            store,
            packageStore
        );

        policyController = new PolicyController(
            authController,
            recordsController,
            store,
            instStore,
            packageVersionsStore
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

        packageController = new PackageRecordsController({
            config: store,
            policies: policyController,
            store: packageStore,
        });

        packageVersionController = new PackageVersionRecordsController({
            config: store,
            policies: policyController,
            recordItemStore: packageStore,
            store: packageVersionsStore,
            files: filesController,
            systemNotifications: store,
            packages: packageController,
        });

        searchInterface = new MemorySearchInterface();
        searchRecordsStore = new MemorySearchRecordsStore(store);
        searchRecordsController = new SearchRecordsController({
            config: store,
            policies: policyController,
            searchInterface,
            store: searchRecordsStore,
        });

        websocketController = new WebsocketController(
            websocketConnectionStore,
            websocketMessenger,
            instStore,
            tempInstStore,
            authController,
            policyController,
            store,
            store,
            store,
            packageVersionController
        );

        webhookStore = new MemoryWebhookRecordsStore(store);
        webhookEnvironment = {
            handleHttpRequest: jest.fn(),
        };
        webhookController = new WebhookRecordsController({
            config: store,
            store: webhookStore,
            data: dataController,
            files: filesController,
            policies: policyController,
            environment: webhookEnvironment,
            auth: authController,
            websockets: websocketController,
        });

        notificationStore = new MemoryNotificationRecordsStore(store);
        webPushInterface = {
            getServerApplicationKey: jest.fn(),
            sendNotification: jest.fn(),
        };
        notificationController = new NotificationRecordsController({
            config: store,
            policies: policyController,
            store: notificationStore,
            pushInterface: webPushInterface,
        });

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
            chatStream: jest.fn(),
        };
        skyboxInterface = {
            generateSkybox: jest.fn(),
            getSkybox: jest.fn(),
        };
        imageInterface = {
            generateImage: jest.fn(),
        };
        humeInterface = {
            getAccessToken: jest.fn(),
        };
        sloydInterface = {
            createModel: jest.fn(),
            editModel: jest.fn(),
        };
        realtimeInterface = {
            createRealtimeSessionToken: jest.fn(),
        };
        aiController = new AIController({
            chat: {
                interfaces: {
                    provider1: chatInterface,
                },
                options: {
                    defaultModel: 'default-model',
                    defaultModelProvider: 'provider1',
                    allowedChatModels: [
                        {
                            model: 'model-1',
                            provider: 'provider1',
                        },
                        {
                            model: 'model-2',
                            provider: 'provider1',
                        },
                    ],
                    allowedChatSubscriptionTiers: ['beta'],
                    tokenModifierRatio: { default: 1.0 },
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
            hume: {
                interface: humeInterface,
                config: {
                    apiKey: 'globalApiKey',
                    secretKey: 'globalSecretKey',
                },
            },
            sloyd: {
                interface: sloydInterface,
            },
            openai: {
                realtime: {
                    interface: realtimeInterface,
                },
            },
            config: store,
            metrics: store,
            policies: store,
            policyController: policyController,
            records: store,
        });
        jobProvider = new MemoryModerationJobProvider();
        moderationController = new ModerationController(
            store,
            store,
            store,
            jobProvider
        );
        loomController = new LoomController({
            config: store,
            store: store,
            metrics: store,
            policies: policyController,
        });

        server = new RecordsServer({
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
            moderationController,
            loomController,
            websocketRateLimitController: rateLimitController,
            webhooksController: webhookController,
            notificationsController: notificationController,
            packagesController: packageController,
            packageVersionController: packageVersionController,
            searchRecordsController: searchRecordsController,
        });
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
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    interface TestNotificationSubscription {
        id: string;
        userId: string | null;
        recordName: string;
        notificationAddress: string;
        pushSubscription: {
            endpoint: string;
            keys: any;
        };
        active?: boolean;
    }

    async function saveTestNotificationSubscription(
        sub: TestNotificationSubscription
    ) {
        const pushSubId = uuidv5(
            sub.pushSubscription.endpoint,
            SUBSCRIPTION_ID_NAMESPACE
        );
        await notificationStore.savePushSubscription({
            id: pushSubId,
            active: sub.active ?? true,
            endpoint: sub.pushSubscription.endpoint,
            keys: sub.pushSubscription.keys,
        });
        if (sub.userId) {
            await notificationStore.savePushSubscriptionUser({
                userId: sub.userId,
                pushSubscriptionId: pushSubId,
            });
        }
        await notificationStore.saveSubscription({
            id: sub.id,
            recordName: sub.recordName,
            notificationAddress: sub.notificationAddress,
            userId: sub.userId,
            pushSubscriptionId: !sub.userId ? pushSubId : null,
        });
    }

    describe('GET /api/v2/procedures', () => {
        it('should return the list of procedures', async () => {
            const result = await server.handleHttpRequest(
                httpGet('/api/v2/procedures', defaultHeaders)
            );

            const body = await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    procedures: expect.any(Object),
                },
                headers: corsHeaders(defaultHeaders.origin),
            });

            expect(body).toMatchSnapshot();
        });

        it('should support procedures', async () => {
            const result = await server.handleHttpRequest(
                procedureRequest('listProcedures', {}, defaultHeaders)
            );

            const body = await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    procedures: expect.any(Object),
                },
                headers: corsHeaders(defaultHeaders.origin),
            });

            expect(body).toMatchSnapshot();
        });
    });

    describe('GET /api/{userId}/metadata', () => {
        it('should return the metadata for the given userId', async () => {
            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/{userId:${userId}}/metadata`,
                    authenticatedHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    email: 'test@example.com',
                    phoneNumber: null,
                    hasActiveSubscription: false,
                    subscriptionTier: null,
                    privacyFeatures: {
                        publishData: true,
                        allowPublicData: true,
                        allowAI: true,
                        allowPublicInsts: true,
                    },
                    displayName: null,
                    role: 'none',
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

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    email: 'other@example.com',
                    phoneNumber: null,
                    hasActiveSubscription: false,
                    subscriptionTier: null,
                    privacyFeatures: {
                        publishData: true,
                        allowPublicData: true,
                        allowAI: true,
                        allowPublicInsts: true,
                    },
                    displayName: null,
                    role: 'none',
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

            await expectResponseBodyToEqual(result, {
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

        it('should support procedures', async () => {
            const result = await server.handleHttpRequest(
                procedureRequest(
                    'getUserInfo',
                    {
                        userId,
                    },
                    authenticatedHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    email: 'test@example.com',
                    phoneNumber: null,
                    hasActiveSubscription: false,
                    subscriptionTier: null,
                    privacyFeatures: {
                        publishData: true,
                        allowPublicData: true,
                        allowAI: true,
                        allowPublicInsts: true,
                    },
                    displayName: null,
                    role: 'none',
                },
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

        it('should return the list of subscriptions if the current user is a super user', async () => {
            const owner = await store.findUser(ownerId);
            await store.saveUser({
                ...owner,
                role: 'superUser',
            });

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
                httpGet(`/api/{userId:${userId}}/subscription`, {
                    ...authenticatedHeaders,
                    authorization: `Bearer ${ownerSessionKey}`,
                })
            );

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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
                        subscriptionId: 'sub_id',
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
                        subscriptionId: 'sub_id',
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

                    await expectResponseBodyToEqual(response, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

    describe('POST /api/v2/email/valid', () => {
        let accountHeaders: GenericHttpHeaders;
        beforeEach(() => {
            accountHeaders = {
                origin: accountOrigin,
            };
        });

        it('should return whether the email is valid', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    '/api/v2/email/valid',
                    JSON.stringify({
                        email: 'test@example.com',
                    }),
                    accountHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    allowed: true,
                },
                headers: accountCorsHeaders,
            });
        });

        it('should support procedures', async () => {
            const result = await server.handleHttpRequest(
                procedureRequest(
                    'isEmailValid',
                    {
                        email: 'test@example.com',
                    },
                    accountHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    allowed: true,
                },
                headers: accountCorsHeaders,
            });
        });

        testOrigin('POST', '/api/v2/email/valid', () =>
            JSON.stringify({
                email: 'test@example.com',
            })
        );
        testBodyIsJson((body) =>
            httpPost('/api/v2/email/valid', body, accountHeaders)
        );
        testRateLimit('POST', `/api/v2/email/valid`, () =>
            JSON.stringify({
                email: 'test@example.com',
            })
        );
    });

    describe('POST /api/v2/displayName/valid', () => {
        let accountHeaders: GenericHttpHeaders;
        beforeEach(() => {
            accountHeaders = {
                origin: accountOrigin,
            };
        });

        it('should return whether the display name is valid', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    '/api/v2/displayName/valid',
                    JSON.stringify({
                        displayName: 'test123',
                    }),
                    accountHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    allowed: true,
                },
                headers: accountCorsHeaders,
            });
        });

        it('should support procedures', async () => {
            const result = await server.handleHttpRequest(
                procedureRequest(
                    'isDisplayNameValid',
                    {
                        displayName: 'test123',
                    },
                    accountHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    allowed: true,
                },
                headers: accountCorsHeaders,
            });
        });

        testOrigin('POST', '/api/v2/displayName/valid', () =>
            JSON.stringify({
                displayName: 'test123',
            })
        );
        testBodyIsJson((body) =>
            httpPost('/api/v2/displayName/valid', body, accountHeaders)
        );
        testRateLimit('POST', `/api/v2/displayName/valid`, () =>
            JSON.stringify({
                displayName: 'test123',
            })
        );
    });

    describe('POST /api/v2/createAccount', () => {
        beforeEach(async () => {
            const user = await store.findUser(userId);
            await store.saveUser({
                ...user,
                role: 'superUser',
            });
        });

        it('should create a new account', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    '/api/v2/createAccount',
                    JSON.stringify({}),
                    authenticatedHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    userId: expect.any(String),
                    expireTimeMs: null,
                    connectionKey: expect.any(String),
                    sessionKey: expect.any(String),
                    metadata: expect.any(Object),
                },
                headers: accountCorsHeaders,
            });
        });

        it('should support procedures', async () => {
            const result = await server.handleHttpRequest(
                procedureRequest('createAccount', {}, authenticatedHeaders)
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    userId: expect.any(String),
                    expireTimeMs: null,
                    connectionKey: expect.any(String),
                    sessionKey: expect.any(String),
                    metadata: expect.any(Object),
                },
                headers: accountCorsHeaders,
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

        it('should allow listing other user sessions if the user is a super user', async () => {
            const owner = await store.findUser(ownerId);
            await store.saveUser({
                ...owner,
                role: 'superUser',
            });

            const result = await server.handleHttpRequest(
                httpGet(`/api/v2/sessions?userId=${userId}`, {
                    authorization: `Bearer ${ownerSessionKey}`,
                    origin: accountOrigin,
                })
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    sessions: [
                        {
                            userId: userId,
                            sessionId: sessionId,
                            grantedTimeMs: expect.any(Number),
                            expireTimeMs: expireTimeMs,
                            revokeTimeMs: null,
                            ipAddress: '123.456.789',
                            currentSession: false,
                            nextSessionId: null,
                        },
                    ],
                },
                headers: accountCorsHeaders,
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

        it('should should support procedures', async () => {
            const result = await server.handleHttpRequest(
                procedureRequest(
                    `listSessions`,
                    undefined,
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
                metadata: expect.any(Object),
            });

            const parsed = parseSessionKey(data.sessionKey);

            expect(parsed).not.toBe(null);

            const [uid, sid] = parsed;

            const session = await store.findSession(uid, sid);

            expect(session.ipAddress).toBe('999.999.999.999');

            const old = await store.findSession(userId, sessionId);
            expect(old.revokeTimeMs).toBeGreaterThanOrEqual(old.grantedTimeMs);
        });

        it('should support procedures', async () => {
            const result = await server.handleHttpRequest(
                procedureRequest(
                    `replaceSession`,
                    null,
                    authenticatedHeaders,
                    undefined,
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
                metadata: expect.any(Object),
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

        it('should support procedures', async () => {
            let session: AuthSession = await store.findSession(
                userId,
                sessionId
            );
            expect(session.revokeTimeMs).toBeNull();

            const result = await server.handleHttpRequest(
                procedureRequest(
                    `revokeSession`,
                    {
                        userId,
                        sessionId,
                    },
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

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    userId,
                    sessionKey: expect.any(String),
                    expireTimeMs: expect.any(Number),
                    connectionKey: expect.any(String),
                    metadata: expect.any(Object),
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: 'The login request is invalid.',
                },
                headers: accountCorsHeaders,
            });
        });

        it('should support procedures', async () => {
            const result = await server.handleHttpRequest(
                procedureRequest(
                    `completeLogin`,
                    {
                        userId,
                        requestId,
                        code,
                    },
                    {
                        origin: 'https://account-origin.com',
                    }
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    userId,
                    sessionKey: expect.any(String),
                    expireTimeMs: expect.any(Number),
                    connectionKey: expect.any(String),
                    metadata: expect.any(Object),
                },
                headers: accountCorsHeaders,
            });

            const data = JSON.parse(result.body as string);

            expect(parseSessionKey(data.sessionKey)).not.toBeNull();
            expect(data.expireTimeMs).toBeGreaterThan(0);
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

        it('should support procedures', async () => {
            const result = await server.handleHttpRequest(
                procedureRequest(
                    `requestLogin`,
                    {
                        address: 'test@example.com',
                        addressType: 'email',
                    },
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

    describe('POST /api/v2/login/privo', () => {
        let tenYearsAgo: DateTime;

        beforeEach(() => {
            tenYearsAgo = DateTime.now().minus({ years: 10 });

            store.privoConfiguration = {
                gatewayEndpoint: 'endpoint',
                featureIds: {
                    adultPrivoSSO: 'adultAccount',
                    childPrivoSSO: 'childAccount',
                    joinAndCollaborate: 'joinAndCollaborate',
                    publishProjects: 'publish',
                    projectDevelopment: 'dev',
                    buildAIEggs: 'buildaieggs',
                },
                clientId: 'clientId',
                clientSecret: 'clientSecret',
                publicEndpoint: 'publicEndpoint',
                roleIds: {
                    child: 'childRole',
                    adult: 'adultRole',
                    parent: 'parentRole',
                },
                clientTokenScopes: 'scope1 scope2',
                userTokenScopes: 'scope1 scope2',
                redirectUri: 'redirectUri',
                ageOfConsent: 18,
            };

            authController.privoEnabled = true;
        });

        it('should return a login request with the authorization URL', async () => {
            privoClientMock.generateAuthorizationUrl.mockResolvedValueOnce({
                authorizationUrl: 'https://authorization_url',
                codeMethod: 'method',
                codeVerifier: 'verifier',
                redirectUrl: 'https://redirect_url',
                scope: 'scope1 scope2',
            });

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/login/privo`,
                    JSON.stringify({}),
                    {
                        origin: 'https://account-origin.com',
                    },
                    '123.456.789'
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    authorizationUrl: 'https://authorization_url',
                    requestId: expect.any(String),
                },
                headers: accountCorsHeaders,
            });
        });

        it('should support procedures', async () => {
            privoClientMock.generateAuthorizationUrl.mockResolvedValueOnce({
                authorizationUrl: 'https://authorization_url',
                codeMethod: 'method',
                codeVerifier: 'verifier',
                redirectUrl: 'https://redirect_url',
                scope: 'scope1 scope2',
            });

            const result = await server.handleHttpRequest(
                procedureRequest(
                    `requestPrivoLogin`,
                    {},
                    {
                        origin: 'https://account-origin.com',
                    },
                    '123.456.789'
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    authorizationUrl: 'https://authorization_url',
                    requestId: expect.any(String),
                },
                headers: accountCorsHeaders,
            });
        });

        testOrigin('POST', '/api/v2/login/privo', () => JSON.stringify({}));
        testBodyIsJson((body) =>
            httpPost('/api/v2/login/privo', body, authenticatedHeaders)
        );
        testRateLimit('POST', `/api/v2/login/privo`, () => JSON.stringify({}));
    });

    describe('POST /api/v2/oauth/code', () => {
        let tenYearsAgo: DateTime;

        beforeEach(() => {
            tenYearsAgo = DateTime.now().minus({ years: 10 });

            store.privoConfiguration = {
                gatewayEndpoint: 'endpoint',
                featureIds: {
                    adultPrivoSSO: 'adultAccount',
                    childPrivoSSO: 'childAccount',
                    joinAndCollaborate: 'joinAndCollaborate',
                    publishProjects: 'publish',
                    projectDevelopment: 'dev',
                    buildAIEggs: 'buildaieggs',
                },
                clientId: 'clientId',
                clientSecret: 'clientSecret',
                publicEndpoint: 'publicEndpoint',
                roleIds: {
                    child: 'childRole',
                    adult: 'adultRole',
                    parent: 'parentRole',
                },
                clientTokenScopes: 'scope1 scope2',
                userTokenScopes: 'scope1 scope2',
                redirectUri: 'redirectUri',
                ageOfConsent: 18,
            };

            authController.privoEnabled = true;
        });

        it('should save the authorization code', async () => {
            privoClientMock.processAuthorizationCallback.mockResolvedValueOnce({
                accessToken: 'accessToken',
                refreshToken: 'refreshToken',
                tokenType: 'Bearer',
                idToken: 'idToken',
                expiresIn: 1000,
                userInfo: {
                    roleIdentifier: 'roleIdentifier',
                    serviceId: 'serviceId',
                    email: 'test@example.com',
                    emailVerified: true,
                    givenName: 'name',
                    locale: 'en-US',
                    permissions: [],
                    displayName: 'displayName',
                },
            });
            const expireTime = Date.now() + 10000000;

            await store.saveOpenIDLoginRequest({
                requestId: 'requestId',
                state: 'state',
                authorizationUrl: 'https://mock_authorization_url',
                redirectUrl: 'https://redirect_url',
                codeVerifier: 'verifier',
                codeMethod: 'method',
                requestTimeMs:
                    DateTime.utc(2023, 1, 1, 0, 0, 0).toMillis() - 100,
                expireTimeMs: expireTime,
                completedTimeMs: null,
                ipAddress: '123.456.789',
                provider: PRIVO_OPEN_ID_PROVIDER,
                scope: 'scope1 scope2',
            });

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/oauth/code`,
                    JSON.stringify({
                        code: 'code',
                        state: 'state',
                    }),
                    {
                        origin: 'https://account-origin.com',
                    },
                    '123.456.789'
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: accountCorsHeaders,
            });

            expect(await store.findOpenIDLoginRequest('requestId')).toEqual({
                requestId: 'requestId',
                state: 'state',
                authorizationUrl: 'https://mock_authorization_url',
                redirectUrl: 'https://redirect_url',
                codeVerifier: 'verifier',
                codeMethod: 'method',
                requestTimeMs:
                    DateTime.utc(2023, 1, 1, 0, 0, 0).toMillis() - 100,
                expireTimeMs: expireTime,
                authorizationCode: 'code',
                authorizationTimeMs: expect.any(Number),
                completedTimeMs: null,
                ipAddress: '123.456.789',
                provider: PRIVO_OPEN_ID_PROVIDER,
                scope: 'scope1 scope2',
            });
        });

        it('should support procedures', async () => {
            privoClientMock.processAuthorizationCallback.mockResolvedValueOnce({
                accessToken: 'accessToken',
                refreshToken: 'refreshToken',
                tokenType: 'Bearer',
                idToken: 'idToken',
                expiresIn: 1000,
                userInfo: {
                    roleIdentifier: 'roleIdentifier',
                    serviceId: 'serviceId',
                    email: 'test@example.com',
                    emailVerified: true,
                    givenName: 'name',
                    locale: 'en-US',
                    permissions: [],
                    displayName: 'displayName',
                },
            });
            const expireTime = Date.now() + 10000000;

            await store.saveOpenIDLoginRequest({
                requestId: 'requestId',
                state: 'state',
                authorizationUrl: 'https://mock_authorization_url',
                redirectUrl: 'https://redirect_url',
                codeVerifier: 'verifier',
                codeMethod: 'method',
                requestTimeMs:
                    DateTime.utc(2023, 1, 1, 0, 0, 0).toMillis() - 100,
                expireTimeMs: expireTime,
                completedTimeMs: null,
                ipAddress: '123.456.789',
                provider: PRIVO_OPEN_ID_PROVIDER,
                scope: 'scope1 scope2',
            });

            const result = await server.handleHttpRequest(
                procedureRequest(
                    `processOAuthCode`,
                    {
                        code: 'code',
                        state: 'state',
                    },
                    {
                        origin: 'https://account-origin.com',
                    },
                    '123.456.789'
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: accountCorsHeaders,
            });

            expect(await store.findOpenIDLoginRequest('requestId')).toEqual({
                requestId: 'requestId',
                state: 'state',
                authorizationUrl: 'https://mock_authorization_url',
                redirectUrl: 'https://redirect_url',
                codeVerifier: 'verifier',
                codeMethod: 'method',
                requestTimeMs:
                    DateTime.utc(2023, 1, 1, 0, 0, 0).toMillis() - 100,
                expireTimeMs: expireTime,
                authorizationCode: 'code',
                authorizationTimeMs: expect.any(Number),
                completedTimeMs: null,
                ipAddress: '123.456.789',
                provider: PRIVO_OPEN_ID_PROVIDER,
                scope: 'scope1 scope2',
            });
        });

        testOrigin('POST', '/api/v2/oauth/code', () =>
            JSON.stringify({
                code: 'code',
                state: 'requestId',
            })
        );
        testBodyIsJson((body) =>
            httpPost('/api/v2/oauth/code', body, authenticatedHeaders)
        );
        testRateLimit('POST', `/api/v2/oauth/code`, () =>
            JSON.stringify({
                code: 'code',
                state: 'requestId',
            })
        );
    });

    describe('POST /api/v2/oauth/complete', () => {
        let tenYearsAgo: DateTime;

        beforeEach(() => {
            tenYearsAgo = DateTime.now().minus({ years: 10 });

            store.privoConfiguration = {
                gatewayEndpoint: 'endpoint',
                featureIds: {
                    adultPrivoSSO: 'adultAccount',
                    childPrivoSSO: 'childAccount',
                    joinAndCollaborate: 'joinAndCollaborate',
                    publishProjects: 'publish',
                    projectDevelopment: 'dev',
                    buildAIEggs: 'buildaieggs',
                },
                clientId: 'clientId',
                clientSecret: 'clientSecret',
                publicEndpoint: 'publicEndpoint',
                roleIds: {
                    child: 'childRole',
                    adult: 'adultRole',
                    parent: 'parentRole',
                },
                clientTokenScopes: 'scope1 scope2',
                userTokenScopes: 'scope1 scope2',
                redirectUri: 'redirectUri',
                ageOfConsent: 18,
            };
        });

        it('should return the session key', async () => {
            privoClientMock.processAuthorizationCallback.mockResolvedValueOnce({
                accessToken: 'accessToken',
                refreshToken: 'refreshToken',
                tokenType: 'Bearer',
                idToken: 'idToken',
                expiresIn: 1000,
                userInfo: {
                    roleIdentifier: 'adultRole',
                    serviceId: 'serviceId',
                    email: 'test@example.com',
                    emailVerified: true,
                    givenName: 'name',
                    locale: 'en-US',
                    permissions: [],
                    displayName: 'displayName',
                },
            });

            const expireTime = Date.now() + 10000000;
            await store.saveOpenIDLoginRequest({
                requestId: 'requestId',
                state: 'state',
                authorizationUrl: 'https://mock_authorization_url',
                redirectUrl: 'https://redirect_url',
                codeVerifier: 'verifier',
                codeMethod: 'method',
                requestTimeMs:
                    DateTime.utc(2023, 1, 1, 0, 0, 0).toMillis() - 100,
                expireTimeMs: expireTime,
                authorizationCode: 'code',
                authorizationTimeMs: DateTime.utc(
                    2023,
                    1,
                    1,
                    0,
                    0,
                    0
                ).toMillis(),
                completedTimeMs: null,
                ipAddress: '123.456.789',
                provider: PRIVO_OPEN_ID_PROVIDER,
                scope: 'scope1 scope2',
            });

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/oauth/complete`,
                    JSON.stringify({
                        requestId: 'requestId',
                    }),
                    {
                        origin: 'https://account-origin.com',
                    },
                    '123.456.789'
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    userId,
                    sessionKey: expect.any(String),
                    expireTimeMs: expect.any(Number),
                    connectionKey: expect.any(String),
                    metadata: expect.any(Object),
                },
                headers: accountCorsHeaders,
            });
        });

        it('should support procedures', async () => {
            privoClientMock.processAuthorizationCallback.mockResolvedValueOnce({
                accessToken: 'accessToken',
                refreshToken: 'refreshToken',
                tokenType: 'Bearer',
                idToken: 'idToken',
                expiresIn: 1000,
                userInfo: {
                    roleIdentifier: 'adultRole',
                    serviceId: 'serviceId',
                    email: 'test@example.com',
                    emailVerified: true,
                    givenName: 'name',
                    locale: 'en-US',
                    permissions: [],
                    displayName: 'displayName',
                },
            });

            const expireTime = Date.now() + 10000000;
            await store.saveOpenIDLoginRequest({
                requestId: 'requestId',
                state: 'state',
                authorizationUrl: 'https://mock_authorization_url',
                redirectUrl: 'https://redirect_url',
                codeVerifier: 'verifier',
                codeMethod: 'method',
                requestTimeMs:
                    DateTime.utc(2023, 1, 1, 0, 0, 0).toMillis() - 100,
                expireTimeMs: expireTime,
                authorizationCode: 'code',
                authorizationTimeMs: DateTime.utc(
                    2023,
                    1,
                    1,
                    0,
                    0,
                    0
                ).toMillis(),
                completedTimeMs: null,
                ipAddress: '123.456.789',
                provider: PRIVO_OPEN_ID_PROVIDER,
                scope: 'scope1 scope2',
            });

            const result = await server.handleHttpRequest(
                procedureRequest(
                    `completeOAuthLogin`,
                    {
                        requestId: 'requestId',
                    },
                    {
                        origin: 'https://account-origin.com',
                    },
                    '123.456.789'
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    userId,
                    sessionKey: expect.any(String),
                    expireTimeMs: expect.any(Number),
                    connectionKey: expect.any(String),
                    metadata: expect.any(Object),
                },
                headers: accountCorsHeaders,
            });
        });

        testOrigin('POST', '/api/v2/oauth/complete', () =>
            JSON.stringify({
                requestId: 'requestId',
            })
        );
        testBodyIsJson((body) =>
            httpPost('/api/v2/oauth/complete', body, authenticatedHeaders)
        );
        testRateLimit('POST', `/api/v2/oauth/complete`, () =>
            JSON.stringify({
                requestId: 'requestId',
            })
        );
    });

    describe('POST /api/v2/register/privo', () => {
        let tenYearsAgo: DateTime;

        beforeEach(() => {
            tenYearsAgo = DateTime.now().minus({ years: 10 });

            store.privoConfiguration = {
                gatewayEndpoint: 'endpoint',
                featureIds: {
                    adultPrivoSSO: 'adultAccount',
                    childPrivoSSO: 'childAccount',
                    joinAndCollaborate: 'joinAndCollaborate',
                    publishProjects: 'publish',
                    projectDevelopment: 'dev',
                    buildAIEggs: 'buildaieggs',
                },
                clientId: 'clientId',
                clientSecret: 'clientSecret',
                publicEndpoint: 'publicEndpoint',
                roleIds: {
                    child: 'childRole',
                    adult: 'adultRole',
                    parent: 'parentRole',
                },
                clientTokenScopes: 'scope1 scope2',
                userTokenScopes: 'scope1 scope2',
                // verificationIntegration: 'verificationIntegration',
                // verificationServiceId: 'verificationServiceId',
                // verificationSiteId: 'verificationSiteId',
                redirectUri: 'redirectUri',
                ageOfConsent: 18,
            };

            authController.privoEnabled = true;
        });

        it('should return a 200 status code with the registration results', async () => {
            privoClientMock.createChildAccount.mockResolvedValue({
                success: true,
                childServiceId: 'childServiceId',
                parentServiceId: 'parentServiceId',
                features: [],
                updatePasswordLink: 'link',
                consentUrl: 'consentUrl',
            });

            const response = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/register/privo`,
                    JSON.stringify({
                        name: 'Test',
                        email: 'child@example.com',
                        dateOfBirth: tenYearsAgo.toFormat('yyyy-MM-dd'),
                        parentEmail: 'parent@example.com',
                        displayName: 'displayName',
                    }),
                    {
                        origin: 'https://account-origin.com',
                    },
                    '123.456.789'
                )
            );

            await expectResponseBodyToEqual(response, {
                statusCode: 200,
                body: {
                    success: true,
                    userId: expect.any(String),
                    sessionKey: expect.any(String),
                    connectionKey: expect.any(String),
                    expireTimeMs: expect.any(Number),
                    updatePasswordUrl: 'link',
                    metadata: expect.any(Object),
                },
                headers: accountCorsHeaders,
            });
        });

        it('should return a 400 status code if the display name contains spaces', async () => {
            privoClientMock.createChildAccount.mockResolvedValue({
                success: true,
                childServiceId: 'childServiceId',
                parentServiceId: 'parentServiceId',
                features: [],
                updatePasswordLink: 'link',
                consentUrl: 'consentUrl',
            });

            const response = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/register/privo`,
                    JSON.stringify({
                        name: 'Test',
                        email: 'child@example.com',
                        dateOfBirth: tenYearsAgo.toFormat('yyyy-MM-dd'),
                        parentEmail: 'parent@example.com',
                        displayName: 'display name',
                    }),
                    {
                        origin: 'https://account-origin.com',
                    },
                    '123.456.789'
                )
            );

            await expectResponseBodyToEqual(response, {
                statusCode: 400,
                body: {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage:
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_string',
                            message: 'The value cannot not contain spaces.',
                            path: ['displayName'],
                            validation: 'regex',
                        },
                    ],
                },
                headers: accountCorsHeaders,
            });
        });

        it('should return a 400 status code if the name contains spaces', async () => {
            privoClientMock.createChildAccount.mockResolvedValue({
                success: true,
                childServiceId: 'childServiceId',
                parentServiceId: 'parentServiceId',
                features: [],
                updatePasswordLink: 'link',
                consentUrl: 'consentUrl',
            });

            const response = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/register/privo`,
                    JSON.stringify({
                        name: 'Test Name',
                        email: 'child@example.com',
                        dateOfBirth: tenYearsAgo.toFormat('yyyy-MM-dd'),
                        parentEmail: 'parent@example.com',
                        displayName: 'displayName',
                    }),
                    {
                        origin: 'https://account-origin.com',
                    },
                    '123.456.789'
                )
            );

            await expectResponseBodyToEqual(response, {
                statusCode: 400,
                body: {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage:
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'invalid_string',
                            message: 'The value cannot not contain spaces.',
                            path: ['name'],
                            validation: 'regex',
                        },
                    ],
                },
                headers: accountCorsHeaders,
            });
        });

        it('should return a 400 status code if no name or display name is provided', async () => {
            privoClientMock.createChildAccount.mockResolvedValue({
                success: true,
                childServiceId: 'childServiceId',
                parentServiceId: 'parentServiceId',
                features: [],
                updatePasswordLink: 'link',
                consentUrl: 'consentUrl',
            });

            const response = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/register/privo`,
                    JSON.stringify({
                        name: '',
                        email: 'child@example.com',
                        dateOfBirth: tenYearsAgo.toFormat('yyyy-MM-dd'),
                        parentEmail: 'parent@example.com',
                        displayName: '',
                    }),
                    {
                        origin: 'https://account-origin.com',
                    },
                    '123.456.789'
                )
            );

            await expectResponseBodyToEqual(response, {
                statusCode: 400,
                body: {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage:
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'too_small',
                            exact: false,
                            inclusive: true,
                            message:
                                'String must contain at least 1 character(s)',
                            minimum: 1,
                            path: ['name'],
                            type: 'string',
                        },
                        {
                            code: 'too_small',
                            exact: false,
                            inclusive: true,
                            message:
                                'String must contain at least 1 character(s)',
                            minimum: 1,
                            path: ['displayName'],
                            type: 'string',
                        },
                    ],
                },
                headers: accountCorsHeaders,
            });
        });

        it('should support procedures', async () => {
            privoClientMock.createChildAccount.mockResolvedValue({
                success: true,
                childServiceId: 'childServiceId',
                parentServiceId: 'parentServiceId',
                features: [],
                updatePasswordLink: 'link',
                consentUrl: 'consentUrl',
            });

            const response = await server.handleHttpRequest(
                procedureRequest(
                    `requestPrivoSignUp`,
                    {
                        name: 'Test',
                        email: 'child@example.com',
                        dateOfBirth: tenYearsAgo.toFormat('yyyy-MM-dd'),
                        parentEmail: 'parent@example.com',
                        displayName: 'displayName',
                    },
                    {
                        origin: 'https://account-origin.com',
                    },
                    '123.456.789'
                )
            );

            await expectResponseBodyToEqual(response, {
                statusCode: 200,
                body: {
                    success: true,
                    userId: expect.any(String),
                    sessionKey: expect.any(String),
                    connectionKey: expect.any(String),
                    expireTimeMs: expect.any(Number),
                    updatePasswordUrl: 'link',
                    metadata: expect.any(Object),
                },
                headers: accountCorsHeaders,
            });
        });

        testOrigin('POST', '/api/v2/register/privo', () =>
            JSON.stringify({
                name: 'Test',
                email: 'child@example.com',
                dateOfBirth: tenYearsAgo.toFormat('yyyy-MM-dd'),
                parentEmail: 'parent@example.com',
                displayName: 'displayName',
            })
        );
        testBodyIsJson((body) =>
            httpPost('/api/v2/register/privo', body, authenticatedHeaders)
        );
        testRateLimit('POST', `/api/v2/register/privo`, () =>
            JSON.stringify({
                name: 'Test',
                email: 'child@example.com',
                dateOfBirth: tenYearsAgo.toFormat('yyyy-MM-dd'),
                parentEmail: 'parent@example.com',
                displayName: 'displayName',
            })
        );
    });

    describe('POST /api/v2/privacyFeatures/change', () => {
        let tenYearsAgo: DateTime;

        beforeEach(async () => {
            tenYearsAgo = DateTime.now().minus({ years: 10 });

            store.privoConfiguration = {
                gatewayEndpoint: 'endpoint',
                featureIds: {
                    adultPrivoSSO: 'adultAccount',
                    childPrivoSSO: 'childAccount',
                    joinAndCollaborate: 'joinAndCollaborate',
                    publishProjects: 'publish',
                    projectDevelopment: 'dev',
                    buildAIEggs: 'buildaieggs',
                },
                clientId: 'clientId',
                clientSecret: 'clientSecret',
                publicEndpoint: 'publicEndpoint',
                roleIds: {
                    child: 'childRole',
                    adult: 'adultRole',
                    parent: 'parentRole',
                },
                clientTokenScopes: 'scope1 scope2',
                userTokenScopes: 'scope1 scope2',
                // verificationIntegration: 'verificationIntegration',
                // verificationServiceId: 'verificationServiceId',
                // verificationSiteId: 'verificationSiteId',
                redirectUri: 'redirectUri',
                ageOfConsent: 18,
            };

            const user = await store.findUser(userId);
            await store.saveUser({
                ...user,
                privoServiceId: 'serviceId',
            });

            privoClientMock.resendConsentRequest.mockResolvedValue({
                success: true,
            });

            authController.privoEnabled = true;
        });

        it('should return a 200 status code', async () => {
            const response = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/privacyFeatures/change`,
                    JSON.stringify({
                        userId: userId,
                    }),
                    authenticatedHeaders
                )
            );

            await expectResponseBodyToEqual(response, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: accountCorsHeaders,
            });

            expect(privoClientMock.resendConsentRequest).toHaveBeenCalledWith(
                'serviceId',
                'serviceId'
            );
        });

        testUrl(
            'POST',
            '/api/v2/privacyFeatures/change',
            () =>
                JSON.stringify({
                    userId,
                }),
            () => authenticatedHeaders
        );
    });

    describe('GET /api/v2/webauthn/register/options', () => {
        it('should return the webauthn registration options', async () => {
            const result = await server.handleHttpRequest(
                httpGet(
                    '/api/v2/webauthn/register/options',
                    authenticatedHeaders
                )
            );

            const response = await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    options: {
                        attestation: 'none',
                        authenticatorSelection: {
                            authenticatorAttachment: 'platform',
                            requireResidentKey: false,
                            residentKey: 'preferred',
                            userVerification: 'preferred',
                        },
                        challenge: expect.any(String),
                        excludeCredentials: [],
                        extensions: {
                            credProps: true,
                        },
                        pubKeyCredParams: [
                            {
                                alg: -8,
                                type: 'public-key',
                            },
                            {
                                alg: -7,
                                type: 'public-key',
                            },
                            {
                                alg: -257,
                                type: 'public-key',
                            },
                        ],
                        rp: {
                            id: 'relying_party_id',
                            name: 'Relying Party',
                        },
                        timeout: 60000,
                        user: {
                            displayName: 'test@example.com',
                            id: userId,
                            name: 'test@example.com',
                        },
                    },
                },
                headers: accountCorsHeaders,
            });

            const user = await store.findUser(userId);
            expect(user.currentWebAuthnChallenge).toBe(
                response.options.challenge
            );
        });

        it('should support procedures', async () => {
            const result = await server.handleHttpRequest(
                procedureRequest(
                    'getWebAuthnRegistrationOptions',
                    undefined,
                    authenticatedHeaders
                )
            );

            const response = await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    options: {
                        attestation: 'none',
                        authenticatorSelection: {
                            authenticatorAttachment: 'platform',
                            requireResidentKey: false,
                            residentKey: 'preferred',
                            userVerification: 'preferred',
                        },
                        challenge: expect.any(String),
                        excludeCredentials: [],
                        extensions: {
                            credProps: true,
                        },
                        pubKeyCredParams: [
                            {
                                alg: -8,
                                type: 'public-key',
                            },
                            {
                                alg: -7,
                                type: 'public-key',
                            },
                            {
                                alg: -257,
                                type: 'public-key',
                            },
                        ],
                        rp: {
                            id: 'relying_party_id',
                            name: 'Relying Party',
                        },
                        timeout: 60000,
                        user: {
                            displayName: 'test@example.com',
                            id: userId,
                            name: 'test@example.com',
                        },
                    },
                },
                headers: accountCorsHeaders,
            });

            const user = await store.findUser(userId);
            expect(user.currentWebAuthnChallenge).toBe(
                response.options.challenge
            );
        });

        testOrigin(
            'GET',
            '/api/v2/webauthn/register/options',
            undefined,
            true,
            true
        );
        testAuthorization(() =>
            httpGet('/api/v2/webauthn/register/options', authenticatedHeaders)
        );
        testRateLimit('GET', `/api/v2/webauthn/register/options`);
    });

    describe('POST /api/v2/webauthn/register', () => {
        it('should register the authenticator', async () => {
            verifyRegistrationResponseMock.mockResolvedValueOnce({
                verified: true,
                registrationInfo: {
                    credentialID: new Uint8Array([1, 2, 3]),
                    credentialPublicKey: new Uint8Array([4, 5, 6]),
                    counter: 100,
                    origin: relyingParty.origin,
                    userVerified: true,
                    credentialBackedUp: false,
                    credentialDeviceType: 'singleDevice',
                    credentialType: 'public-key',
                    attestationObject: new Uint8Array([7, 8, 9]),
                    aaguid: 'aaguid',
                    fmt: 'tpm',
                    authenticatorExtensionResults: {},
                    rpID: relyingParty.id,
                },
            });
            const result = await server.handleHttpRequest(
                httpPost(
                    '/api/v2/webauthn/register',
                    JSON.stringify({
                        response: {
                            id: 'id',
                            rawId: 'rawId',
                            response: {
                                attestationObject: 'attestation',
                                clientDataJSON: 'clientDataJSON',
                                authenticatorData: 'authenticatorData',
                                publicKey: 'publicKey',
                                publicKeyAlgorithm: -7,
                                transports: ['usb'],
                            },
                            clientExtensionResults: {},
                            type: 'public-key',
                            authenticatorAttachment: 'platform',
                        },
                    }),
                    authenticatedHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: accountCorsHeaders,
            });

            const user = await store.findUser(userId);
            expect(user.currentWebAuthnChallenge).toBe(null);

            const authenticators = await store.listUserAuthenticators(userId);
            expect(authenticators).toEqual([
                {
                    id: expect.any(String),
                    userId: userId,
                    credentialId: fromByteArray(new Uint8Array([1, 2, 3])),
                    credentialPublicKey: new Uint8Array([4, 5, 6]),
                    counter: 100,
                    credentialDeviceType: 'singleDevice',
                    credentialBackedUp: false,
                    transports: ['usb'],
                    aaguid: 'aaguid',
                    createdAtMs: expect.any(Number),
                },
            ]);
        });

        it('should support procedures', async () => {
            verifyRegistrationResponseMock.mockResolvedValueOnce({
                verified: true,
                registrationInfo: {
                    credentialID: new Uint8Array([1, 2, 3]),
                    credentialPublicKey: new Uint8Array([4, 5, 6]),
                    counter: 100,
                    origin: relyingParty.origin,
                    userVerified: true,
                    credentialBackedUp: false,
                    credentialDeviceType: 'singleDevice',
                    credentialType: 'public-key',
                    attestationObject: new Uint8Array([7, 8, 9]),
                    aaguid: 'aaguid',
                    fmt: 'tpm',
                    authenticatorExtensionResults: {},
                    rpID: relyingParty.id,
                },
            });
            const result = await server.handleHttpRequest(
                procedureRequest(
                    'registerWebAuthn',
                    {
                        response: {
                            id: 'id',
                            rawId: 'rawId',
                            response: {
                                attestationObject: 'attestation',
                                clientDataJSON: 'clientDataJSON',
                                authenticatorData: 'authenticatorData',
                                publicKey: 'publicKey',
                                publicKeyAlgorithm: -7,
                                transports: ['usb'],
                            },
                            clientExtensionResults: {},
                            type: 'public-key',
                            authenticatorAttachment: 'platform',
                        },
                    },
                    authenticatedHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: accountCorsHeaders,
            });

            const user = await store.findUser(userId);
            expect(user.currentWebAuthnChallenge).toBe(null);

            const authenticators = await store.listUserAuthenticators(userId);
            expect(authenticators).toEqual([
                {
                    id: expect.any(String),
                    userId: userId,
                    credentialId: fromByteArray(new Uint8Array([1, 2, 3])),
                    credentialPublicKey: new Uint8Array([4, 5, 6]),
                    counter: 100,
                    credentialDeviceType: 'singleDevice',
                    credentialBackedUp: false,
                    transports: ['usb'],
                    aaguid: 'aaguid',
                    createdAtMs: expect.any(Number),
                },
            ]);
        });

        testOrigin(
            'POST',
            '/api/v2/webauthn/register',
            () =>
                JSON.stringify({
                    response: {
                        id: 'id',
                        rawId: 'rawId',
                        response: {
                            attestationObject: 'attestation',
                            clientDataJSON: 'clientDataJSON',
                            authenticatorData: 'authenticatorData',
                            publicKey: 'publicKey',
                            publicKeyAlgorithm: -7,
                            transports: ['usb'],
                        },
                        clientExtensionResults: {},
                        type: 'public-key',
                        authenticatorAttachment: 'platform',
                    },
                }),
            true,
            true
        );
        testAuthorization(() =>
            httpPost(
                '/api/v2/webauthn/register',
                JSON.stringify({
                    response: {
                        id: 'id',
                        rawId: 'rawId',
                        response: {
                            attestationObject: 'attestation',
                            clientDataJSON: 'clientDataJSON',
                            authenticatorData: 'authenticatorData',
                            publicKey: 'publicKey',
                            publicKeyAlgorithm: -7,
                            transports: ['usb'],
                        },
                        clientExtensionResults: {},
                        type: 'public-key',
                        authenticatorAttachment: 'platform',
                    },
                }),
                authenticatedHeaders
            )
        );
        testRateLimit('POST', `/api/v2/webauthn/register`);
    });

    describe('GET /api/v2/webauthn/login/options', () => {
        beforeEach(() => {
            delete authenticatedHeaders['authorization'];
        });

        it('should return the webauthn login options', async () => {
            const result = await server.handleHttpRequest(
                httpGet('/api/v2/webauthn/login/options', authenticatedHeaders)
            );

            const response = await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    requestId: expect.any(String),
                    options: {
                        userVerification: 'preferred',
                        challenge: expect.any(String),
                        rpId: relyingParty.id,
                        timeout: 60000,
                    },
                },
                headers: accountCorsHeaders,
            });

            const loginRequest = await store.findWebAuthnLoginRequest(
                response.requestId
            );
            expect(loginRequest).toEqual({
                requestId: response.requestId,
                userId: null,
                challenge: response.options.challenge,
                requestTimeMs: expect.any(Number),
                expireTimeMs: expect.any(Number),
                completedTimeMs: null,
                ipAddress: '123.456.789',
            });
        });

        it('should support procedures', async () => {
            const result = await server.handleHttpRequest(
                procedureRequest(
                    'getWebAuthnLoginOptions',
                    undefined,
                    authenticatedHeaders
                )
            );

            const response = await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    requestId: expect.any(String),
                    options: {
                        userVerification: 'preferred',
                        challenge: expect.any(String),
                        rpId: relyingParty.id,
                        timeout: 60000,
                    },
                },
                headers: accountCorsHeaders,
            });

            const loginRequest = await store.findWebAuthnLoginRequest(
                response.requestId
            );
            expect(loginRequest).toEqual({
                requestId: response.requestId,
                userId: null,
                challenge: response.options.challenge,
                requestTimeMs: expect.any(Number),
                expireTimeMs: expect.any(Number),
                completedTimeMs: null,
                ipAddress: '123.456.789',
            });
        });

        testOrigin('GET', '/api/v2/webauthn/login/options', undefined, true);
        testRateLimit('GET', `/api/v2/webauthn/login/options`);
    });

    describe('POST /api/v2/webauthn/login', () => {
        beforeEach(() => {
            delete authenticatedHeaders['authorization'];
        });

        it('should return the login result', async () => {
            const requestId = 'requestId';
            await store.saveWebAuthnLoginRequest({
                requestId: requestId,
                challenge: 'challenge',
                requestTimeMs: 300,
                expireTimeMs: Date.now() + 1000 * 60,
                completedTimeMs: null,
                ipAddress: '123.456.789',
                userId: null,
            });

            await store.saveUserAuthenticator({
                id: 'authenticatorId',
                userId: userId,
                credentialId: fromByteArray(new Uint8Array([1, 2, 3])),
                counter: 0,
                credentialBackedUp: true,
                credentialDeviceType: 'singleDevice',
                credentialPublicKey: new Uint8Array([4, 5, 6]),
                transports: ['usb'],
                aaguid: '',
                registeringUserAgent: 'ua',
                createdAtMs: 100,
            });

            verifyAuthenticationResponseMock.mockResolvedValueOnce({
                verified: true,
                authenticationInfo: {} as any,
            });

            const result = await server.handleHttpRequest(
                httpPost(
                    '/api/v2/webauthn/login',
                    JSON.stringify({
                        requestId: requestId,
                        response: {
                            id: fromByteArray(new Uint8Array([1, 2, 3])),
                            rawId: 'rawId',
                            clientExtensionResults: {},
                            response: {
                                authenticatorData: 'authenticatorData',
                                clientDataJSON: 'clientDataJSON',
                                signature: 'signature',
                            },
                            type: 'public-key',
                            authenticatorAttachment: 'platform',
                        },
                    }),
                    authenticatedHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    userId: userId,
                    sessionKey: expect.any(String),
                    connectionKey: expect.any(String),
                    expireTimeMs: expect.any(Number),
                    metadata: expect.any(Object),
                },
                headers: accountCorsHeaders,
            });
        });

        it('should support procedures', async () => {
            const requestId = 'requestId';
            await store.saveWebAuthnLoginRequest({
                requestId: requestId,
                challenge: 'challenge',
                requestTimeMs: 300,
                expireTimeMs: Date.now() + 1000 * 60,
                completedTimeMs: null,
                ipAddress: '123.456.789',
                userId: null,
            });

            await store.saveUserAuthenticator({
                id: 'authenticatorId',
                userId: userId,
                credentialId: fromByteArray(new Uint8Array([1, 2, 3])),
                counter: 0,
                credentialBackedUp: true,
                credentialDeviceType: 'singleDevice',
                credentialPublicKey: new Uint8Array([4, 5, 6]),
                transports: ['usb'],
                aaguid: '',
                registeringUserAgent: 'ua',
                createdAtMs: 100,
            });

            verifyAuthenticationResponseMock.mockResolvedValueOnce({
                verified: true,
                authenticationInfo: {} as any,
            });

            const result = await server.handleHttpRequest(
                procedureRequest(
                    'completeWebAuthnLogin',
                    {
                        requestId: requestId,
                        response: {
                            id: fromByteArray(new Uint8Array([1, 2, 3])),
                            rawId: 'rawId',
                            clientExtensionResults: {},
                            response: {
                                authenticatorData: 'authenticatorData',
                                clientDataJSON: 'clientDataJSON',
                                signature: 'signature',
                            },
                            type: 'public-key',
                            authenticatorAttachment: 'platform',
                        },
                    },
                    authenticatedHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    userId: userId,
                    sessionKey: expect.any(String),
                    connectionKey: expect.any(String),
                    expireTimeMs: expect.any(Number),
                    metadata: expect.any(Object),
                },
                headers: accountCorsHeaders,
            });
        });

        testOrigin(
            'POST',
            '/api/v2/webauthn/login',
            () =>
                JSON.stringify({
                    requestId: 'requestId',
                    response: {
                        id: fromByteArray(new Uint8Array([1, 2, 3])),
                        rawId: 'rawId',
                        clientExtensionResults: {},
                        response: {
                            authenticatorData: 'authenticatorData',
                            clientDataJSON: 'clientDataJSON',
                            signature: 'signature',
                        },
                        type: 'public-key',
                        authenticatorAttachment: 'platform',
                    },
                }),
            true
        );
        testRateLimit('POST', `/api/v2/webauthn/login`, () =>
            JSON.stringify({
                requestId: 'requestId',
                response: {
                    id: fromByteArray(new Uint8Array([1, 2, 3])),
                    rawId: 'rawId',
                    clientExtensionResults: {},
                    response: {
                        authenticatorData: 'authenticatorData',
                        clientDataJSON: 'clientDataJSON',
                        signature: 'signature',
                    },
                    type: 'public-key',
                    authenticatorAttachment: 'platform',
                },
            })
        );
    });

    describe('GET /api/v2/webauthn/authenticators', () => {
        it('should return the list of authenticators that the user has registered', async () => {
            const requestId = 'requestId';
            await store.saveWebAuthnLoginRequest({
                requestId: requestId,
                challenge: 'challenge',
                requestTimeMs: 300,
                expireTimeMs: Date.now() + 1000 * 60,
                completedTimeMs: null,
                ipAddress: '123.456.789',
                userId: null,
            });

            await store.saveUserAuthenticator({
                id: 'authenticatorId',
                userId: userId,
                credentialId: fromByteArray(new Uint8Array([1, 2, 3])),
                counter: 0,
                credentialBackedUp: true,
                credentialDeviceType: 'singleDevice',
                credentialPublicKey: new Uint8Array([4, 5, 6]),
                transports: ['usb'],
                aaguid: 'aaguid1',
                registeringUserAgent: 'ua1',
                createdAtMs: 100,
            });

            await store.saveUserAuthenticator({
                id: 'authenticatorId2',
                userId: userId,
                credentialId: fromByteArray(new Uint8Array([1, 2, 3, 4])),
                counter: 0,
                credentialBackedUp: true,
                credentialDeviceType: 'singleDevice',
                credentialPublicKey: new Uint8Array([4, 5, 6, 7]),
                transports: ['usb'],
                aaguid: 'aaguid2',
                registeringUserAgent: 'ua2',
                createdAtMs: 100,
            });

            verifyAuthenticationResponseMock.mockResolvedValueOnce({
                verified: true,
                authenticationInfo: {} as any,
            });

            const result = await server.handleHttpRequest(
                httpGet('/api/v2/webauthn/authenticators', authenticatedHeaders)
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    authenticators: [
                        {
                            id: 'authenticatorId',
                            userId: userId,
                            credentialId: fromByteArray(
                                new Uint8Array([1, 2, 3])
                            ),
                            counter: 0,
                            credentialBackedUp: true,
                            credentialDeviceType: 'singleDevice',
                            transports: ['usb'],
                            aaguid: 'aaguid1',
                            registeringUserAgent: 'ua1',
                            createdAtMs: 100,
                        },
                        {
                            id: 'authenticatorId2',
                            userId: userId,
                            credentialId: fromByteArray(
                                new Uint8Array([1, 2, 3, 4])
                            ),
                            counter: 0,
                            credentialBackedUp: true,
                            credentialDeviceType: 'singleDevice',
                            transports: ['usb'],
                            aaguid: 'aaguid2',
                            registeringUserAgent: 'ua2',
                            createdAtMs: 100,
                        },
                    ],
                },
                headers: accountCorsHeaders,
            });
        });

        it('should support procedures', async () => {
            const requestId = 'requestId';
            await store.saveWebAuthnLoginRequest({
                requestId: requestId,
                challenge: 'challenge',
                requestTimeMs: 300,
                expireTimeMs: Date.now() + 1000 * 60,
                completedTimeMs: null,
                ipAddress: '123.456.789',
                userId: null,
            });

            await store.saveUserAuthenticator({
                id: 'authenticatorId',
                userId: userId,
                credentialId: fromByteArray(new Uint8Array([1, 2, 3])),
                counter: 0,
                credentialBackedUp: true,
                credentialDeviceType: 'singleDevice',
                credentialPublicKey: new Uint8Array([4, 5, 6]),
                transports: ['usb'],
                aaguid: 'aaguid1',
                registeringUserAgent: 'ua1',
                createdAtMs: 100,
            });

            await store.saveUserAuthenticator({
                id: 'authenticatorId2',
                userId: userId,
                credentialId: fromByteArray(new Uint8Array([1, 2, 3, 4])),
                counter: 0,
                credentialBackedUp: true,
                credentialDeviceType: 'singleDevice',
                credentialPublicKey: new Uint8Array([4, 5, 6, 7]),
                transports: ['usb'],
                aaguid: 'aaguid2',
                registeringUserAgent: 'ua2',
                createdAtMs: 100,
            });

            verifyAuthenticationResponseMock.mockResolvedValueOnce({
                verified: true,
                authenticationInfo: {} as any,
            });

            const result = await server.handleHttpRequest(
                procedureRequest(
                    'listUserAuthenticators',
                    undefined,
                    authenticatedHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    authenticators: [
                        {
                            id: 'authenticatorId',
                            userId: userId,
                            credentialId: fromByteArray(
                                new Uint8Array([1, 2, 3])
                            ),
                            counter: 0,
                            credentialBackedUp: true,
                            credentialDeviceType: 'singleDevice',
                            transports: ['usb'],
                            aaguid: 'aaguid1',
                            registeringUserAgent: 'ua1',
                            createdAtMs: 100,
                        },
                        {
                            id: 'authenticatorId2',
                            userId: userId,
                            credentialId: fromByteArray(
                                new Uint8Array([1, 2, 3, 4])
                            ),
                            counter: 0,
                            credentialBackedUp: true,
                            credentialDeviceType: 'singleDevice',
                            transports: ['usb'],
                            aaguid: 'aaguid2',
                            registeringUserAgent: 'ua2',
                            createdAtMs: 100,
                        },
                    ],
                },
                headers: accountCorsHeaders,
            });
        });

        testOrigin('GET', '/api/v2/webauthn/authenticators');
        testRateLimit('GET', `/api/v2/webauthn/authenticators`);
        testAuthorization(() =>
            httpGet('/api/v2/webauthn/authenticators', authenticatedHeaders)
        );
    });

    describe('POST /api/v2/webauthn/authenticators/delete', () => {
        it('should delete the given authenticator', async () => {
            const requestId = 'requestId';
            await store.saveWebAuthnLoginRequest({
                requestId: requestId,
                challenge: 'challenge',
                requestTimeMs: 300,
                expireTimeMs: Date.now() + 1000 * 60,
                completedTimeMs: null,
                ipAddress: '123.456.789',
                userId: null,
            });

            await store.saveUserAuthenticator({
                id: 'authenticatorId',
                userId: userId,
                credentialId: fromByteArray(new Uint8Array([1, 2, 3])),
                counter: 0,
                credentialBackedUp: true,
                credentialDeviceType: 'singleDevice',
                credentialPublicKey: new Uint8Array([4, 5, 6]),
                transports: ['usb'],
                aaguid: 'aaguid1',
                registeringUserAgent: 'ua1',
                createdAtMs: 100,
            });

            await store.saveUserAuthenticator({
                id: 'authenticatorId2',
                userId: userId,
                credentialId: fromByteArray(new Uint8Array([1, 2, 3, 4])),
                counter: 0,
                credentialBackedUp: true,
                credentialDeviceType: 'singleDevice',
                credentialPublicKey: new Uint8Array([4, 5, 6, 7]),
                transports: ['usb'],
                aaguid: 'aaguid2',
                registeringUserAgent: 'ua2',
                createdAtMs: 100,
            });

            verifyAuthenticationResponseMock.mockResolvedValueOnce({
                verified: true,
                authenticationInfo: {} as any,
            });

            const result = await server.handleHttpRequest(
                httpPost(
                    '/api/v2/webauthn/authenticators/delete',
                    JSON.stringify({
                        authenticatorId: 'authenticatorId',
                    }),
                    authenticatedHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: accountCorsHeaders,
            });

            const authenticators = await store.listUserAuthenticators(userId);
            expect(authenticators).toEqual([
                {
                    id: 'authenticatorId2',
                    userId: userId,
                    credentialId: fromByteArray(new Uint8Array([1, 2, 3, 4])),
                    counter: 0,
                    credentialBackedUp: true,
                    credentialDeviceType: 'singleDevice',
                    credentialPublicKey: new Uint8Array([4, 5, 6, 7]),
                    transports: ['usb'],
                    aaguid: 'aaguid2',
                    registeringUserAgent: 'ua2',
                    createdAtMs: 100,
                },
            ]);
        });

        it('should support procedures', async () => {
            const requestId = 'requestId';
            await store.saveWebAuthnLoginRequest({
                requestId: requestId,
                challenge: 'challenge',
                requestTimeMs: 300,
                expireTimeMs: Date.now() + 1000 * 60,
                completedTimeMs: null,
                ipAddress: '123.456.789',
                userId: null,
            });

            await store.saveUserAuthenticator({
                id: 'authenticatorId',
                userId: userId,
                credentialId: fromByteArray(new Uint8Array([1, 2, 3])),
                counter: 0,
                credentialBackedUp: true,
                credentialDeviceType: 'singleDevice',
                credentialPublicKey: new Uint8Array([4, 5, 6]),
                transports: ['usb'],
                aaguid: 'aaguid1',
                registeringUserAgent: 'ua1',
                createdAtMs: 100,
            });

            await store.saveUserAuthenticator({
                id: 'authenticatorId2',
                userId: userId,
                credentialId: fromByteArray(new Uint8Array([1, 2, 3, 4])),
                counter: 0,
                credentialBackedUp: true,
                credentialDeviceType: 'singleDevice',
                credentialPublicKey: new Uint8Array([4, 5, 6, 7]),
                transports: ['usb'],
                aaguid: 'aaguid2',
                registeringUserAgent: 'ua2',
                createdAtMs: 100,
            });

            verifyAuthenticationResponseMock.mockResolvedValueOnce({
                verified: true,
                authenticationInfo: {} as any,
            });

            const result = await server.handleHttpRequest(
                procedureRequest(
                    'deleteUserAuthenticator',
                    {
                        authenticatorId: 'authenticatorId',
                    },
                    authenticatedHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: accountCorsHeaders,
            });

            const authenticators = await store.listUserAuthenticators(userId);
            expect(authenticators).toEqual([
                {
                    id: 'authenticatorId2',
                    userId: userId,
                    credentialId: fromByteArray(new Uint8Array([1, 2, 3, 4])),
                    counter: 0,
                    credentialBackedUp: true,
                    credentialDeviceType: 'singleDevice',
                    credentialPublicKey: new Uint8Array([4, 5, 6, 7]),
                    transports: ['usb'],
                    aaguid: 'aaguid2',
                    registeringUserAgent: 'ua2',
                    createdAtMs: 100,
                },
            ]);
        });

        testUrl(
            'POST',
            '/api/v2/webauthn/authenticators/delete',
            () =>
                JSON.stringify({
                    authenticatorId: 'authenticatorId',
                }),
            () => authenticatedHeaders
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

        testAuthorization(
            () =>
                httpPost(
                    '/api/v2/records/events/count',
                    JSON.stringify({
                        recordKey,
                        eventName: 'testEvent',
                        count: 2,
                    }),
                    apiHeaders
                ),
            'You must be logged in in order to use this record key.'
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    events: events.slice(6, 16),
                    totalCount: 20,
                },
                headers: apiCorsHeaders,
            });
        });

        // TODO: This test always fails because events do not support listing by a marker
        it.skip('should return an empty list if the inst doesnt have permission', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/events/list?recordName=${recordName}&instances=inst`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
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
                ['/inst']: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/events/list?recordName=${recordName}&instances=inst`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    events: events.slice(0, 10),
                    totalCount: 20,
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return 403 not_authorized if the user does not have access to the account marker', async () => {
            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/events/list?recordName=${recordName}`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'event',
                        action: 'list',
                        subjectType: 'user',
                        subjectId: userId,
                    },
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

            await expectResponseBodyToEqual(result, {
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
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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
                        markers: [PUBLIC_READ_MARKER],
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: apiCorsHeaders,
            });

            expect(await store.getEventCount(recordName, 'testEvent')).toEqual({
                success: true,
                count: 10,
                markers: [PUBLIC_READ_MARKER],
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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
                recordName,
                'testAddress',
                'hello, world!',
                ownerId,
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

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'data',
                        resourceId: 'testAddress',
                        action: 'delete',
                        subjectType: 'user',
                        subjectId: userId,
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
                publisherId: ownerId,
                subjectId: ownerId,
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

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'data',
                        resourceId: 'testAddress',
                        action: 'delete',
                        subjectType: 'inst',
                        subjectId: '/inst',
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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
                recordName,
                'testAddress',
                'hello, world!',
                ownerId,
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

            await expectResponseBodyToEqual(result, {
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
                recordName,
                'testAddress',
                'hello, world!',
                ownerId,
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

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'data',
                        resourceId: 'testAddress',
                        action: 'read',
                        subjectType: 'user',
                        subjectId: userId,
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
                recordName,
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

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'data',
                        resourceId: 'testAddress',
                        action: 'read',
                        subjectType: 'inst',
                        subjectId: '/inst',
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'data',
                        resourceId: 'testAddress',
                        action: 'create',
                        subjectType: 'user',
                        subjectId: userId,
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

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'data',
                        resourceId: 'testAddress',
                        action: 'create',
                        subjectType: 'inst',
                        subjectId: '/inst',
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'file',
                        resourceId: fileName,
                        action: 'delete',
                        subjectType: 'inst',
                        subjectId: '/inst',
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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
            'You must be logged in in order to use this record key.'
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'file',
                        resourceId: `${hash}.json`,
                        action: 'create',
                        subjectType: 'inst',
                        subjectId: '/inst',
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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
            'You must be logged in in order to use this record key.'
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
                recordName,
                ownerId,
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
            await store.assignPermissionToSubjectAndMarker(
                recordName,
                'role',
                'developer',
                'file',
                'secret',
                'read',
                {},
                null
            );

            store.roles[recordName] = {
                [userId]: new Set(['developer']),
            };

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/file?recordName=${recordName}&fileName=${fileName}`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
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
            await store.assignPermissionToSubjectAndMarker(
                recordName,
                'role',
                'developer',
                'file',
                'secret',
                'read',
                {},
                null
            );

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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

        // this only applies to listing by marker
        // file records don't support this yet, so this test is disabled
        it.skip('should list what the user can access', async () => {
            store.roles[recordName] = {
                [userId]: new Set(['developer']),
            };

            await store.assignPermissionToSubjectAndMarker(
                recordName,
                'role',
                'developer',
                'file',
                PUBLIC_READ_MARKER,
                'list',
                {},
                null
            );

            await store.updateFileRecord(recordName, 'test1.txt', [
                PUBLIC_READ_MARKER,
            ]);
            await store.updateFileRecord(recordName, 'test3.txt', [
                PUBLIC_READ_MARKER,
            ]);

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/file/list?recordName=${recordName}`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
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

        // this only applies to listing by marker
        // file records don't support this yet, so this test is disabled
        it.skip('should list what the inst can access', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
                ['inst']: new Set(['developer']),
            };

            await store.assignPermissionToSubjectAndMarker(
                recordName,
                'role',
                'developer',
                'file',
                PUBLIC_READ_MARKER,
                'list',
                {},
                null
            );

            await store.updateFileRecord(recordName, 'test1.txt', [
                PUBLIC_READ_MARKER,
            ]);
            await store.updateFileRecord(recordName, 'test3.txt', [
                PUBLIC_READ_MARKER,
            ]);

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/file/list?recordName=${recordName}&instances=${'inst'}`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
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

        it('should return 403 not_authorized if the user does not have access to the account marker', async () => {
            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/file/list?recordName=${recordName}`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'file',
                        action: 'list',
                        subjectType: 'user',
                        subjectId: userId,
                    },
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

            await expectResponseBodyToEqual(result, {
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
                recordName,
                ownerId,
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

            await store.assignPermissionToSubjectAndMarker(
                recordName,
                'role',
                'developer',
                'file',
                'secret',
                'update',
                {},
                null
            );
            await store.assignPermissionToSubjectAndMarker(
                recordName,
                'role',
                'developer',
                'marker',
                ACCOUNT_MARKER,
                'assign',
                {},
                null
            );
            await store.assignPermissionToSubjectAndMarker(
                recordName,
                'role',
                'developer',
                'marker',
                ACCOUNT_MARKER,
                'unassign',
                {},
                null
            );
            await store.assignPermissionToSubjectAndMarker(
                recordName,
                'role',
                'developer',
                'file',
                'other',
                'update',
                {},
                null
            );

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

            await expectResponseBodyToEqual(result, {
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
                publisherId: ownerId,
                subjectId: ownerId,
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

            await expectResponseBodyToEqual(result, {
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
                publisherId: ownerId,
                subjectId: ownerId,
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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
        testAuthorization(() =>
            httpPut(
                '/api/v2/records/file',
                JSON.stringify({
                    recordKey,
                    fileUrl,
                    markers: ['test'],
                }),
                apiHeaders
            )
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

            await expectResponseBodyToEqual(result, {
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

    describe('POST /api/v2/records/file/scan', () => {
        beforeEach(async () => {
            store.moderationConfiguration = {
                allowUnauthenticatedReports: true,
                jobs: {
                    files: {
                        enabled: true,
                        bannedLabels: [
                            {
                                label: 'banned',
                                threshold: 0.7,
                                actions: ['notify'],
                            },
                        ],
                        fileExtensions: [
                            '.png',
                            '.webp',
                            '.jpg',
                            '.jpeg',
                            '.gif',
                        ],
                    },
                },
            };
        });

        describe('superUser', () => {
            beforeEach(async () => {
                const user = await store.findUser(userId);
                await store.saveUser({
                    ...user,
                    role: 'superUser',
                });
            });

            it('should scan the file with the given name', async () => {
                const result = await server.handleHttpRequest(
                    httpPost(
                        '/api/v2/records/file/scan',
                        JSON.stringify({
                            recordName,
                            fileName: 'hash.png',
                        }),
                        authenticatedHeaders
                    )
                );

                await expectResponseBodyToEqual(result, {
                    statusCode: 200,
                    body: {
                        success: true,
                        result: {
                            id: expect.any(String),
                            recordName,
                            fileName: 'hash.png',
                            labels: [],
                            appearsToMatchBannedContent: false,
                            createdAtMs: expect.any(Number),
                            updatedAtMs: expect.any(Number),
                            modelVersion: 'memory',
                        },
                    },
                    headers: accountCorsHeaders,
                });
            });
        });

        it('should return not_authorized if the user is not a superUser', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    '/api/v2/records/file/scan',
                    JSON.stringify({
                        recordName,
                        fileName: 'hash.png',
                    }),
                    authenticatedHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                },
                headers: accountCorsHeaders,
            });
        });

        testUrl(
            'POST',
            '/api/v2/records/file/scan',
            () =>
                JSON.stringify({
                    recordName,
                    fileName: 'hash.png',
                }),
            () => authenticatedHeaders
        );
    });

    describe('POST /api/v2/moderation/schedule/scan', () => {
        beforeEach(async () => {
            store.moderationConfiguration = {
                allowUnauthenticatedReports: true,
                jobs: {
                    files: {
                        enabled: true,
                        bannedLabels: [
                            {
                                label: 'banned',
                                threshold: 0.7,
                                actions: ['notify'],
                            },
                        ],
                        fileExtensions: [
                            '.png',
                            '.webp',
                            '.jpg',
                            '.jpeg',
                            '.gif',
                        ],
                    },
                },
            };
        });

        describe('superUser', () => {
            beforeEach(async () => {
                const user = await store.findUser(userId);
                await store.saveUser({
                    ...user,
                    role: 'superUser',
                });
            });

            it('should schedule the moderation scan', async () => {
                const result = await server.handleHttpRequest(
                    httpPost(
                        '/api/v2/moderation/schedule/scan',
                        JSON.stringify({}),
                        authenticatedHeaders
                    )
                );

                await expectResponseBodyToEqual(result, {
                    statusCode: 200,
                    body: {
                        success: true,
                        jobs: [
                            {
                                id: expect.any(String),
                                type: 'files',
                                filter: {
                                    fileExtensions: [
                                        '.png',
                                        '.webp',
                                        '.jpg',
                                        '.jpeg',
                                        '.gif',
                                    ],
                                },
                                createdAtMs: expect.any(Number),
                                updatedAtMs: expect.any(Number),
                            },
                        ],
                    },
                    headers: accountCorsHeaders,
                });

                expect(jobProvider.jobs).toEqual([
                    {
                        id: expect.any(String),
                        type: 'files',
                        filter: {
                            fileExtensions: [
                                '.png',
                                '.webp',
                                '.jpg',
                                '.jpeg',
                                '.gif',
                            ],
                        },
                        createdAtMs: expect.any(Number),
                        updatedAtMs: expect.any(Number),
                    },
                ]);
            });
        });

        it('should return not_authorized if the user is not a superUser', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    '/api/v2/moderation/schedule/scan',
                    JSON.stringify({}),
                    authenticatedHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                },
                headers: accountCorsHeaders,
            });
        });

        testUrl(
            'POST',
            '/api/v2/moderation/schedule/scan',
            () => JSON.stringify({}),
            () => authenticatedHeaders
        );
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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
                recordName,
                'testAddress',
                'hello, world!',
                ownerId,
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

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'data',
                        resourceId: 'testAddress',
                        action: 'delete',
                        subjectType: 'user',
                        subjectId: userId,
                    },
                },
                headers: apiCorsHeaders,
            });

            const data = await store.getData(recordName, 'testAddress');

            expect(data).toEqual({
                success: true,
                data: 'hello, world!',
                publisherId: ownerId,
                subjectId: ownerId,
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

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'data',
                        resourceId: 'testAddress',
                        action: 'delete',
                        subjectType: 'inst',
                        subjectId: '/inst',
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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
                recordName,
                'testAddress',
                'hello, world!',
                ownerId,
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

            await expectResponseBodyToEqual(result, {
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
                recordName,
                'testAddress',
                'hello, world!',
                ownerId,
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

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'data',
                        resourceId: 'testAddress',
                        action: 'read',
                        subjectType: 'user',
                        subjectId: userId,
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

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'data',
                        resourceId: 'testAddress',
                        action: 'read',
                        subjectType: 'inst',
                        subjectId: '/inst',
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

        describe('?marker', () => {
            it('should return a list of data', async () => {
                const result = await server.handleHttpRequest(
                    httpGet(
                        `/api/v2/records/data/list?recordName=${recordName}&marker=${PUBLIC_READ_MARKER}`,
                        defaultHeaders
                    )
                );

                await expectResponseBodyToEqual(result, {
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
                        marker: PUBLIC_READ_MARKER,
                    },
                    headers: corsHeaders(defaultHeaders['origin']),
                });
            });

            it('should be able to list data by address', async () => {
                const result = await server.handleHttpRequest(
                    httpGet(
                        `/api/v2/records/data/list?recordName=${recordName}&address=address1&marker=${PUBLIC_READ_MARKER}`,
                        defaultHeaders
                    )
                );

                await expectResponseBodyToEqual(result, {
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
                        marker: PUBLIC_READ_MARKER,
                    },
                    headers: corsHeaders(defaultHeaders['origin']),
                });
            });

            it('should be able to sort by address', async () => {
                const result = await server.handleHttpRequest(
                    httpGet(
                        `/api/v2/records/data/list?recordName=${recordName}&marker=${PUBLIC_READ_MARKER}&sort=descending`,
                        defaultHeaders
                    )
                );

                await expectResponseBodyToEqual(result, {
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
                            {
                                address: 'address1',
                                data: 'hello, world!',
                                markers: [PUBLIC_READ_MARKER],
                            },
                        ],
                        totalCount: 3,
                        marker: PUBLIC_READ_MARKER,
                    },
                    headers: corsHeaders(defaultHeaders['origin']),
                });
            });

            it('should be able to list custom markers', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                    ['/inst']: new Set([ADMIN_ROLE_NAME]),
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
                        `/api/v2/records/data/list?recordName=${recordName}&marker=${'secret'}&instances=${'inst'}`,
                        apiHeaders
                    )
                );

                await expectResponseBodyToEqual(result, {
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
                        marker: 'secret',
                    },
                    headers: corsHeaders(apiHeaders['origin']),
                });
            });

            it('return a not_authorized error if the user is not authorized to access the marker', async () => {
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
                        `/api/v2/records/data/list?recordName=${recordName}&instances=${'inst'}&marker=${'secret'}`,
                        apiHeaders
                    )
                );

                await expectResponseBodyToEqual(result, {
                    statusCode: 403,
                    body: {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'You are not authorized to perform this action.',
                        reason: {
                            type: 'missing_permission',
                            recordName,
                            resourceKind: 'data',
                            action: 'list',
                            subjectType: 'user',
                            subjectId: userId,
                        },
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

                await expectResponseBodyToEqual(result, {
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
        });

        it('should be able to list all data', async () => {
            await dataController.recordData(
                recordKey,
                'address2',
                'other message!',
                ownerId,
                null,
                null,
                ['secret']
            );

            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/data/list?recordName=${recordName}`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
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
                            markers: ['secret'],
                        },
                    ],
                    totalCount: 3,
                },
                headers: corsHeaders(apiHeaders['origin']),
            });
        });

        it('should return 403 not_authorized if the user does not have access to the account marker', async () => {
            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/data/list?recordName=${recordName}`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'data',
                        action: 'list',
                        subjectType: 'user',
                        subjectId: userId,
                    },
                },
                headers: corsHeaders(apiHeaders['origin']),
            });
        });

        testRateLimit(() =>
            httpGet(
                `/api/v2/records/data/list?recordName=${recordName}`,
                authenticatedHeaders
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'data',
                        resourceId: 'testAddress',
                        action: 'create',
                        subjectType: 'user',
                        subjectId: userId,
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

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'data',
                        resourceId: 'testAddress',
                        action: 'create',
                        subjectType: 'inst',
                        subjectId: '/inst',
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

    describe('POST /api/v2/records/webhook', () => {
        it('should return not_implemented if the server doesnt have a webhooks controller', async () => {
            server = new RecordsServer({
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
                policyController,
            });

            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/webhook`,
                    JSON.stringify({
                        recordName,
                        item: {
                            address: 'testAddress',
                            targetResourceKind: 'data',
                            targetRecordName: recordName,
                            targetAddress: 'data1',
                            userId: null,
                        },
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 501,
                body: {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This feature is not supported.',
                },
                headers: apiCorsHeaders,
            });

            const item = await webhookStore.getItemByAddress(
                recordName,
                'testAddress'
            );
            expect(item).toEqual(null);
        });

        it('should save the given webhook record', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/webhook`,
                    JSON.stringify({
                        recordName,
                        item: {
                            address: 'testAddress',
                            targetResourceKind: 'data',
                            targetRecordName: recordName,
                            targetAddress: 'data1',
                        },
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    address: 'testAddress',
                },
                headers: apiCorsHeaders,
            });

            const item = await webhookStore.getItemByAddress(
                recordName,
                'testAddress'
            );
            expect(item).toEqual({
                address: 'testAddress',
                targetResourceKind: 'data',
                targetRecordName: recordName,
                targetAddress: 'data1',

                // Should default to the private marker
                markers: [PRIVATE_MARKER],
                userId: expect.any(String),
            });
        });

        it('should be able to save webhooks pointing to public insts', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/webhook`,
                    JSON.stringify({
                        recordName,
                        item: {
                            address: 'testAddress',
                            targetResourceKind: 'inst',
                            targetRecordName: null,
                            targetAddress: 'instName',
                        },
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    address: 'testAddress',
                },
                headers: apiCorsHeaders,
            });

            const item = await webhookStore.getItemByAddress(
                recordName,
                'testAddress'
            );
            expect(item).toEqual({
                address: 'testAddress',
                targetResourceKind: 'inst',
                targetRecordName: null,
                targetAddress: 'instName',

                // Should default to the private marker
                markers: [PRIVATE_MARKER],
                userId: expect.any(String),
            });
        });

        const recordlessCases = [['data'], ['file']];

        it.each(recordlessCases)(
            'should reject the request if trying to save a %s webhook without a record name',
            async (kind) => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await server.handleHttpRequest(
                    httpPost(
                        `/api/v2/records/webhook`,
                        JSON.stringify({
                            recordName,
                            item: {
                                address: 'testAddress',
                                targetResourceKind: kind,
                                targetRecordName: null,
                                targetAddress: 'data',
                            },
                        }),
                        apiHeaders
                    )
                );

                await expectResponseBodyToEqual(result, {
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
                                received: 'null',
                                message: 'recordName must be a string.',
                                path: ['item', 'targetRecordName'],
                            },
                        ],
                    },
                    headers: apiCorsHeaders,
                });
            }
        );

        it('should reject the request if the user is not authorized', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/webhook`,
                    JSON.stringify({
                        recordName,
                        item: {
                            address: 'testAddress',
                            targetResourceKind: 'data',
                            targetRecordName: recordName,
                            targetAddress: 'data1',
                            userId: null,
                        },
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'webhook',
                        resourceId: 'testAddress',
                        action: 'create',
                        subjectType: 'user',
                        subjectId: userId,
                    },
                },
                headers: apiCorsHeaders,
            });

            const item = await webhookStore.getItemByAddress(
                recordName,
                'testAddress'
            );
            expect(item).toEqual(null);
        });

        testUrl(
            'POST',
            '/api/v2/records/webhook',
            () =>
                JSON.stringify({
                    recordName,
                    item: {
                        address: 'testAddress',
                        targetResourceKind: 'data',
                        targetRecordName: recordName,
                        targetAddress: 'data1',
                        userId: null,
                    },
                }),
            () => apiHeaders
        );
    });

    describe('GET /api/v2/records/webhook', () => {
        beforeEach(async () => {
            await webhookStore.createItem(recordName, {
                address: 'testAddress',
                markers: [PRIVATE_MARKER],
                targetResourceKind: 'data',
                targetAddress: 'data1',
                targetRecordName: recordName,
                userId: null,
            });
        });

        it('should return not_implemented if the server doesnt have a webhooks controller', async () => {
            server = new RecordsServer({
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
                policyController,
            });

            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/webhook?recordName=${recordName}&address=testAddress`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 501,
                body: {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This feature is not supported.',
                },
                headers: apiCorsHeaders,
            });
        });

        it('should get the given webhook record', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/webhook?recordName=${recordName}&address=testAddress`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    item: {
                        address: 'testAddress',
                        targetResourceKind: 'data',
                        targetRecordName: recordName,
                        targetAddress: 'data1',
                        markers: [PRIVATE_MARKER],
                        userId: null,
                    },
                },
                headers: apiCorsHeaders,
            });
        });

        it('should reject the request if the user is not authorized', async () => {
            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/webhook?recordName=${recordName}&address=testAddress`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'webhook',
                        resourceId: 'testAddress',
                        action: 'read',
                        subjectType: 'user',
                        subjectId: userId,
                    },
                },
                headers: apiCorsHeaders,
            });
        });

        testOrigin(
            'GET',
            `/api/v2/records/webhook?recordName=${recordName}&address=testAddress`
        );
        testAuthorization(() =>
            httpRequest(
                'GET',
                `/api/v2/records/webhook?recordName=${recordName}&address=testAddress`,
                undefined,
                apiHeaders
            )
        );
        testRateLimit(
            'GET',
            `/api/v2/records/webhook?recordName=${recordName}&address=testAddress`
        );
    });

    describe('GET /api/v2/records/webhook/list', () => {
        beforeEach(async () => {
            await webhookStore.createItem(recordName, {
                address: 'testAddress3',
                markers: [PRIVATE_MARKER],
                targetResourceKind: 'data',
                targetAddress: 'data3',
                targetRecordName: recordName,
                userId: null,
            });

            await webhookStore.createItem(recordName, {
                address: 'testAddress',
                markers: [PRIVATE_MARKER],
                targetResourceKind: 'data',
                targetAddress: 'data1',
                targetRecordName: recordName,
                userId: null,
            });

            await webhookStore.createItem(recordName, {
                address: 'testAddress2',
                markers: [PUBLIC_READ_MARKER],
                targetResourceKind: 'data',
                targetAddress: 'data2',
                targetRecordName: recordName,
                userId: null,
            });
        });

        it('should return not_implemented if the server doesnt have a webhooks controller', async () => {
            server = new RecordsServer({
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
                policyController,
            });

            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/webhook/list?recordName=${recordName}`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 501,
                body: {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This feature is not supported.',
                },
                headers: apiCorsHeaders,
            });
        });

        it('should list the webhooks', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/webhook/list?recordName=${recordName}`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    totalCount: 3,
                    items: [
                        {
                            address: 'testAddress3',
                            targetResourceKind: 'data',
                            targetRecordName: recordName,
                            targetAddress: 'data3',
                            markers: [PRIVATE_MARKER],
                            userId: null,
                        },
                        {
                            address: 'testAddress',
                            targetResourceKind: 'data',
                            targetRecordName: recordName,
                            targetAddress: 'data1',
                            markers: [PRIVATE_MARKER],
                            userId: null,
                        },
                        {
                            address: 'testAddress2',
                            targetResourceKind: 'data',
                            targetRecordName: recordName,
                            targetAddress: 'data2',
                            markers: [PUBLIC_READ_MARKER],
                            userId: null,
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should list the webhooks after the given address', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/webhook/list?recordName=${recordName}&address=testAddress`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    totalCount: 3,
                    items: [
                        {
                            address: 'testAddress3',
                            targetResourceKind: 'data',
                            targetRecordName: recordName,
                            targetAddress: 'data3',
                            markers: [PRIVATE_MARKER],
                            userId: null,
                        },
                        {
                            address: 'testAddress2',
                            targetResourceKind: 'data',
                            targetRecordName: recordName,
                            targetAddress: 'data2',
                            markers: [PUBLIC_READ_MARKER],
                            userId: null,
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should be able to list webhooks by marker', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/webhook/list?recordName=${recordName}&marker=${PUBLIC_READ_MARKER}`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    totalCount: 1,
                    items: [
                        {
                            address: 'testAddress2',
                            targetResourceKind: 'data',
                            targetRecordName: recordName,
                            targetAddress: 'data2',
                            markers: [PUBLIC_READ_MARKER],
                            userId: null,
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should reject the request if the user is not authorized', async () => {
            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/webhook/list?recordName=${recordName}`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'webhook',
                        action: 'list',
                        subjectType: 'user',
                        subjectId: userId,
                    },
                },
                headers: apiCorsHeaders,
            });
        });

        it('should support procedures', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                procedureRequest(
                    'listWebhooks',
                    {
                        recordName,
                        address: null,
                    },
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    totalCount: 3,
                    items: [
                        {
                            address: 'testAddress3',
                            targetResourceKind: 'data',
                            targetRecordName: recordName,
                            targetAddress: 'data3',
                            markers: [PRIVATE_MARKER],
                            userId: null,
                        },
                        {
                            address: 'testAddress',
                            targetResourceKind: 'data',
                            targetRecordName: recordName,
                            targetAddress: 'data1',
                            markers: [PRIVATE_MARKER],
                            userId: null,
                        },
                        {
                            address: 'testAddress2',
                            targetResourceKind: 'data',
                            targetRecordName: recordName,
                            targetAddress: 'data2',
                            markers: [PUBLIC_READ_MARKER],
                            userId: null,
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        testOrigin(
            'GET',
            `/api/v2/records/webhook/list?recordName=${recordName}&address=testAddress`
        );
        testAuthorization(() =>
            httpRequest(
                'GET',
                `/api/v2/records/webhook/list?recordName=${recordName}&address=testAddress`,
                undefined,
                apiHeaders
            )
        );
        testRateLimit(
            'GET',
            `/api/v2/records/webhook/list?recordName=${recordName}&address=testAddress`
        );
    });

    describe('DELETE /api/v2/records/webhook', () => {
        beforeEach(async () => {
            await webhookStore.createItem(recordName, {
                address: 'testAddress',
                markers: [PRIVATE_MARKER],
                targetResourceKind: 'data',
                targetAddress: 'data1',
                targetRecordName: recordName,
                userId: null,
            });
        });

        it('should return not_implemented if the server doesnt have a webhooks controller', async () => {
            server = new RecordsServer({
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
                policyController,
            });

            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpDelete(
                    `/api/v2/records/webhook`,
                    JSON.stringify({
                        recordName,
                        address: 'testAddress',
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 501,
                body: {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This feature is not supported.',
                },
                headers: apiCorsHeaders,
            });

            const item = await webhookStore.getItemByAddress(
                recordName,
                'testAddress'
            );
            expect(item).not.toBe(null);
        });

        it('should delete the given webhook record', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpDelete(
                    `/api/v2/records/webhook`,
                    JSON.stringify({
                        recordName,
                        address: 'testAddress',
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: apiCorsHeaders,
            });

            const item = await webhookStore.getItemByAddress(
                recordName,
                'testAddress'
            );
            expect(item).toBe(null);
        });

        it('should reject the request if the user is not authorized', async () => {
            const result = await server.handleHttpRequest(
                httpDelete(
                    `/api/v2/records/webhook`,
                    JSON.stringify({
                        recordName,
                        address: 'testAddress',
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'webhook',
                        resourceId: 'testAddress',
                        action: 'delete',
                        subjectType: 'user',
                        subjectId: userId,
                    },
                },
                headers: apiCorsHeaders,
            });

            const item = await webhookStore.getItemByAddress(
                recordName,
                'testAddress'
            );
            expect(item).not.toBe(null);
        });

        testUrl(
            'DELETE',
            '/api/v2/records/webhook',
            () =>
                JSON.stringify({
                    recordName,
                    address: 'testAddress',
                }),
            () => apiHeaders
        );
    });

    describe('POST /api/v2/records/webhook/run', () => {
        let aux: StoredAuxVersion1;

        beforeEach(async () => {
            aux = {
                version: 1,
                state: {
                    test1: createBot('test1'),
                },
            };

            await store.setData(
                recordName,
                'data1',
                JSON.stringify(aux),
                userId,
                userId,
                true,
                true,
                [PUBLIC_READ_MARKER]
            );
            await webhookStore.createItem(recordName, {
                address: 'testAddress',
                markers: [PRIVATE_MARKER],
                targetResourceKind: 'data',
                targetAddress: 'data1',
                targetRecordName: recordName,
                userId: null,
            });
        });

        it('should return not_implemented if the server doesnt have a webhooks controller', async () => {
            server = new RecordsServer({
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
                policyController,
            });

            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/webhook/run?recordName=${recordName}&address=testAddress`,
                    JSON.stringify({
                        data: 'hello, world',
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 501,
                body: {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This feature is not supported.',
                },
                headers: apiCorsHeaders,
            });

            expect(webhookEnvironment.handleHttpRequest).not.toHaveBeenCalled();
        });

        it('should run the given webhook record', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            webhookEnvironment.handleHttpRequest.mockResolvedValue({
                success: true,
                response: {
                    statusCode: 200,
                    body: 'hello, world',
                },
                logs: ['abc'],
            });

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/webhook/run?recordName=${recordName}&address=testAddress&other=def`,
                    JSON.stringify({
                        data: 'hello, world',
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: 'hello, world',
                headers: apiCorsHeaders,
            });

            expect(webhookEnvironment.handleHttpRequest).toHaveBeenCalledWith({
                recordName,
                state: {
                    type: 'aux',
                    state: aux,
                },
                options: {
                    addStateTimeoutMs: 1000,
                    fetchTimeoutMs: 5000,
                    initTimeoutMs: 5000,
                    requestTimeoutMs: 5000,
                },
                request: httpPost(
                    `/api/v2/records/webhook/run?other=def`,
                    JSON.stringify({
                        data: 'hello, world',
                    }),
                    {
                        origin: apiHeaders['origin'],
                    }
                ),
                requestUserId: userId,
            });
        });

        it('should support procedures', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            webhookEnvironment.handleHttpRequest.mockResolvedValue({
                success: true,
                response: {
                    statusCode: 200,
                    body: 'hello, world',
                },
                logs: ['abc'],
            });

            const result = await server.handleHttpRequest(
                procedureRequest(
                    'runWebhook',
                    {
                        value: 'abc',
                    },
                    apiHeaders,
                    {
                        recordName,
                        address: 'testAddress',
                        other: 'def',
                    }
                )
            );

            const body = await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    response: {
                        statusCode: 200,
                        body: 'hello, world',
                        headers: {},
                    },
                },
                headers: apiCorsHeaders,
            });

            expect(body).toMatchSnapshot();

            expect(webhookEnvironment.handleHttpRequest).toHaveBeenCalledWith({
                recordName,
                state: {
                    type: 'aux',
                    state: aux,
                },
                options: {
                    addStateTimeoutMs: 1000,
                    fetchTimeoutMs: 5000,
                    initTimeoutMs: 5000,
                    requestTimeoutMs: 5000,
                },
                request: {
                    method: 'POST',
                    path: `/api/v2/records/webhook/run`,
                    ipAddress: '123.456.789',
                    body: JSON.stringify({
                        value: 'abc',
                    }),
                    headers: {
                        origin: apiHeaders['origin'],
                    },
                    query: {
                        other: 'def',
                    },
                    pathParams: {},
                },
                requestUserId: userId,
            });
        });

        testUrl(
            'POST',
            `/api/v2/records/webhook/run?recordName=${recordName}&address=testAddress`,
            () =>
                JSON.stringify({
                    data: 'hello, world',
                }),
            () => apiHeaders
        );
    });

    describe('GET /api/v2/records/webhook/runs/list', () => {
        let aux: StoredAuxVersion1;
        const webhookUserId = 'webhookUserId';

        beforeEach(async () => {
            aux = {
                version: 1,
                state: {
                    test1: createBot('test1'),
                },
            };

            await store.setData(
                recordName,
                'data1',
                JSON.stringify(aux),
                userId,
                userId,
                true,
                true,
                [PUBLIC_READ_MARKER]
            );

            await store.saveUser({
                id: webhookUserId,
                email: null,
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });

            await webhookStore.createItem(recordName, {
                address: 'testAddress',
                markers: [PRIVATE_MARKER],
                targetResourceKind: 'data',
                targetAddress: 'data1',
                targetRecordName: recordName,
                userId: webhookUserId,
            });

            await webhookStore.recordWebhookRun({
                runId: 'run1',
                recordName,
                webhookAddress: 'testAddress',
                errorResult: null,
                requestTimeMs: 1000,
                responseTimeMs: 2000,
                statusCode: 200,
                stateSha256: 'sha256',
                infoRecordName: webhookUserId,
                infoFileName: 'info.json',
            });
        });

        it('should return not_implemented if the server doesnt have a webhooks controller', async () => {
            server = new RecordsServer({
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
                policyController,
            });

            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/webhook/runs/list?recordName=${recordName}&address=testAddress`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 501,
                body: {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This feature is not supported.',
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return the list of runs for the webhook', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/webhook/runs/list?recordName=${recordName}&address=testAddress`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    items: [
                        {
                            runId: 'run1',
                            recordName,
                            webhookAddress: 'testAddress',
                            errorResult: null,
                            requestTimeMs: 1000,
                            responseTimeMs: 2000,
                            statusCode: 200,
                            stateSha256: 'sha256',
                            infoRecordName: webhookUserId,
                            infoFileName: 'info.json',
                        },
                    ],
                    totalCount: 1,
                    marker: null,
                },
                headers: apiCorsHeaders,
            });
        });

        testUrl(
            'GET',
            `/api/v2/records/webhook/runs/list?recordName=${recordName}&address=testAddress`,
            () => undefined,
            () => apiHeaders
        );
    });

    describe('GET /api/v2/records/webhook/runs/info', () => {
        let aux: StoredAuxVersion1;
        const webhookUserId = 'webhookUserId';

        beforeEach(async () => {
            aux = {
                version: 1,
                state: {
                    test1: createBot('test1'),
                },
            };

            await store.setData(
                recordName,
                'data1',
                JSON.stringify(aux),
                userId,
                userId,
                true,
                true,
                [PUBLIC_READ_MARKER]
            );

            await store.saveUser({
                id: webhookUserId,
                email: null,
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });

            await webhookStore.createItem(recordName, {
                address: 'testAddress',
                markers: [PRIVATE_MARKER],
                targetResourceKind: 'data',
                targetAddress: 'data1',
                targetRecordName: recordName,
                userId: webhookUserId,
            });

            await webhookStore.recordWebhookRun({
                runId: 'run1',
                recordName,
                webhookAddress: 'testAddress',
                errorResult: null,
                requestTimeMs: 1000,
                responseTimeMs: 2000,
                statusCode: 200,
                stateSha256: 'sha256',
                infoRecordName: webhookUserId,
                infoFileName: 'info.json',
            });

            await store.addFileRecord(
                recordName,
                'info.json',
                webhookUserId,
                webhookUserId,
                123,
                'info',
                ['private:logs']
            );
        });

        it('should return not_implemented if the server doesnt have a webhooks controller', async () => {
            server = new RecordsServer({
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
                policyController,
            });

            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/webhook/runs/info?runId=${'run1'}`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 501,
                body: {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This feature is not supported.',
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return the info for the run', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/webhook/runs/info?runId=${'run1'}`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    run: {
                        runId: 'run1',
                        recordName,
                        webhookAddress: 'testAddress',
                        errorResult: null,
                        requestTimeMs: 1000,
                        responseTimeMs: 2000,
                        statusCode: 200,
                        stateSha256: 'sha256',
                        infoRecordName: webhookUserId,
                        infoFileName: 'info.json',
                    },
                    infoFileResult: {
                        success: true,
                        requestMethod: 'GET',
                        requestUrl: `http://localhost:9191/${webhookUserId}/info.json`,
                        requestHeaders: {
                            'record-name': webhookUserId,
                        },
                    },
                },
                headers: apiCorsHeaders,
            });
        });

        testUrl(
            'GET',
            `/api/v2/records/webhook/runs/info?runId=${'run1'}`,
            () => undefined,
            () => apiHeaders
        );
    });

    describe('POST /api/v2/records/notification', () => {
        it('should return not_implemented if the server doesnt have a notification controller', async () => {
            server = new RecordsServer({
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
                policyController,
            });

            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/notification`,
                    JSON.stringify({
                        recordName,
                        item: {
                            address: 'testAddress',
                            description: 'my notification',
                        },
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 501,
                body: {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This feature is not supported.',
                },
                headers: apiCorsHeaders,
            });

            const item = await webhookStore.getItemByAddress(
                recordName,
                'testAddress'
            );
            expect(item).toEqual(null);
        });

        it('should save the given notification record', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/notification`,
                    JSON.stringify({
                        recordName,
                        item: {
                            address: 'testAddress',
                            description: 'my notification',
                        },
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    address: 'testAddress',
                },
                headers: apiCorsHeaders,
            });

            const item = await notificationStore.getItemByAddress(
                recordName,
                'testAddress'
            );
            expect(item).toEqual({
                address: 'testAddress',
                description: 'my notification',

                // Should default to the private marker
                markers: [PRIVATE_MARKER],
            });
        });

        it('should be able to save notifications with custom markers', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/notification`,
                    JSON.stringify({
                        recordName,
                        item: {
                            address: 'testAddress',
                            description: 'my notification',
                            markers: ['custom'],
                        },
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    address: 'testAddress',
                },
                headers: apiCorsHeaders,
            });

            const item = await notificationStore.getItemByAddress(
                recordName,
                'testAddress'
            );
            expect(item).toEqual({
                address: 'testAddress',
                description: 'my notification',

                // Should default to the private marker
                markers: ['custom'],
            });
        });

        it('should reject the request if the user is not authorized', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/notification`,
                    JSON.stringify({
                        recordName,
                        item: {
                            address: 'testAddress',
                            description: 'my notification',
                        },
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'notification',
                        resourceId: 'testAddress',
                        action: 'create',
                        subjectType: 'user',
                        subjectId: userId,
                    },
                },
                headers: apiCorsHeaders,
            });

            const item = await notificationStore.getItemByAddress(
                recordName,
                'testAddress'
            );
            expect(item).toEqual(null);
        });

        testUrl(
            'POST',
            '/api/v2/records/notification',
            () =>
                JSON.stringify({
                    recordName,
                    item: {
                        address: 'testAddress',
                        description: 'my notification',
                    },
                }),
            () => apiHeaders
        );
    });

    describe('GET /api/v2/records/notification', () => {
        beforeEach(async () => {
            await notificationStore.createItem(recordName, {
                address: 'testAddress',
                description: 'my notification',
                markers: [PRIVATE_MARKER],
            });
        });

        it('should return not_implemented if the server doesnt have a notifications controller', async () => {
            server = new RecordsServer({
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
                policyController,
            });

            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/notification?recordName=${recordName}&address=testAddress`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 501,
                body: {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This feature is not supported.',
                },
                headers: apiCorsHeaders,
            });
        });

        it('should get the given notification record', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/notification?recordName=${recordName}&address=testAddress`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    item: {
                        address: 'testAddress',
                        description: 'my notification',
                        markers: [PRIVATE_MARKER],
                    },
                },
                headers: apiCorsHeaders,
            });
        });

        it('should reject the request if the user is not authorized', async () => {
            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/notification?recordName=${recordName}&address=testAddress`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'notification',
                        resourceId: 'testAddress',
                        action: 'read',
                        subjectType: 'user',
                        subjectId: userId,
                    },
                },
                headers: apiCorsHeaders,
            });
        });

        testOrigin(
            'GET',
            `/api/v2/records/notification?recordName=${recordName}&address=testAddress`
        );
        testAuthorization(() =>
            httpRequest(
                'GET',
                `/api/v2/records/notification?recordName=${recordName}&address=testAddress`,
                undefined,
                apiHeaders
            )
        );
        testRateLimit(
            'GET',
            `/api/v2/records/notification?recordName=${recordName}&address=testAddress`
        );
    });

    describe('GET /api/v2/records/notification/list', () => {
        beforeEach(async () => {
            await notificationStore.createItem(recordName, {
                address: 'testAddress3',
                description: 'my notification 3',
                markers: [PRIVATE_MARKER],
            });

            await notificationStore.createItem(recordName, {
                address: 'testAddress',
                description: 'my notification',
                markers: [PRIVATE_MARKER],
            });

            await notificationStore.createItem(recordName, {
                address: 'testAddress2',
                description: 'my notification 2',
                markers: [PUBLIC_READ_MARKER],
            });
        });

        it('should return not_implemented if the server doesnt have a notifications controller', async () => {
            server = new RecordsServer({
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
                policyController,
            });

            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/notification/list?recordName=${recordName}`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 501,
                body: {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This feature is not supported.',
                },
                headers: apiCorsHeaders,
            });
        });

        it('should list the notifications', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/notification/list?recordName=${recordName}`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    totalCount: 3,
                    items: [
                        {
                            address: 'testAddress3',
                            description: 'my notification 3',
                            markers: [PRIVATE_MARKER],
                        },
                        {
                            address: 'testAddress',
                            description: 'my notification',
                            markers: [PRIVATE_MARKER],
                        },
                        {
                            address: 'testAddress2',
                            description: 'my notification 2',
                            markers: [PUBLIC_READ_MARKER],
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should list the notifications after the given address', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/notification/list?recordName=${recordName}&address=testAddress`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    totalCount: 3,
                    items: [
                        {
                            address: 'testAddress3',
                            description: 'my notification 3',
                            markers: [PRIVATE_MARKER],
                        },
                        {
                            address: 'testAddress2',
                            description: 'my notification 2',
                            markers: [PUBLIC_READ_MARKER],
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should be able to list notifications by marker', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/notification/list?recordName=${recordName}&marker=${PUBLIC_READ_MARKER}`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    totalCount: 1,
                    items: [
                        {
                            address: 'testAddress2',
                            description: 'my notification 2',
                            markers: [PUBLIC_READ_MARKER],
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should reject the request if the user is not authorized', async () => {
            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/notification/list?recordName=${recordName}`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'notification',
                        action: 'list',
                        subjectType: 'user',
                        subjectId: userId,
                    },
                },
                headers: apiCorsHeaders,
            });
        });

        it('should support procedures', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                procedureRequest(
                    'listNotifications',
                    {
                        recordName,
                        address: null,
                    },
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    totalCount: 3,
                    items: [
                        {
                            address: 'testAddress3',
                            description: 'my notification 3',
                            markers: [PRIVATE_MARKER],
                        },
                        {
                            address: 'testAddress',
                            description: 'my notification',
                            markers: [PRIVATE_MARKER],
                        },
                        {
                            address: 'testAddress2',
                            description: 'my notification 2',
                            markers: [PUBLIC_READ_MARKER],
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        testOrigin(
            'GET',
            `/api/v2/records/notification/list?recordName=${recordName}&address=testAddress`
        );
        testAuthorization(() =>
            httpRequest(
                'GET',
                `/api/v2/records/notification/list?recordName=${recordName}&address=testAddress`,
                undefined,
                apiHeaders
            )
        );
        testRateLimit(
            'GET',
            `/api/v2/records/notification/list?recordName=${recordName}&address=testAddress`
        );
    });

    describe('GET /api/v2/records/notification/list/subscriptions', () => {
        beforeEach(async () => {
            await notificationStore.createItem(recordName, {
                address: 'testAddress',
                description: 'my notification',
                markers: [PRIVATE_MARKER],
            });

            await saveTestNotificationSubscription({
                id: 'sub1',
                recordName,
                notificationAddress: 'testAddress',
                userId: 'otherUserId',
                active: true,
                pushSubscription: {
                    endpoint: 'endpoint1',
                    keys: {},
                },
            });

            await saveTestNotificationSubscription({
                id: 'sub2',
                recordName,
                notificationAddress: 'testAddress',
                userId: userId,
                active: true,
                pushSubscription: {
                    endpoint: 'endpoint2',
                    keys: {},
                },
            });
        });

        it('should return not_implemented if the server doesnt have a webhooks controller', async () => {
            server = new RecordsServer({
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
                policyController,
            });

            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/notification/list/subscriptions?recordName=${recordName}&address=${'testAddress'}`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 501,
                body: {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This feature is not supported.',
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return the list of subscriptions for the notification', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/notification/list/subscriptions?recordName=${recordName}&address=${'testAddress'}`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    subscriptions: [
                        {
                            id: 'sub1',
                            recordName,
                            notificationAddress: 'testAddress',
                            userId: 'otherUserId',
                            pushSubscriptionId: null,
                        },
                        {
                            id: 'sub2',
                            recordName,
                            notificationAddress: 'testAddress',
                            userId: userId,
                            pushSubscriptionId: null,
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return not_authorized if the user doesnt have the listSubscriptions permission', async () => {
            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/notification/list/subscriptions?recordName=${recordName}&address=${'testAddress'}`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'notification',
                        resourceId: 'testAddress',
                        action: 'listSubscriptions',
                        subjectType: 'user',
                        subjectId: userId,
                    },
                },
                headers: apiCorsHeaders,
            });
        });

        testUrl(
            'GET',
            `/api/v2/records/notification/list/subscriptions?recordName=${recordName}&address=${'testAddress'}`,
            undefined,
            () => apiHeaders
        );
    });

    describe('GET /api/v2/records/notification/list/user/subscriptions', () => {
        beforeEach(async () => {
            await notificationStore.createItem(recordName, {
                address: 'testAddress',
                description: 'my notification',
                markers: [PRIVATE_MARKER],
            });

            await notificationStore.createItem(recordName, {
                address: 'testAddress2',
                description: 'my notification',
                markers: [PRIVATE_MARKER],
            });

            await saveTestNotificationSubscription({
                id: 'sub1',
                recordName,
                notificationAddress: 'testAddress',
                userId: userId,
                active: true,
                pushSubscription: {
                    endpoint: 'endpoint1',
                    keys: {},
                },
            });

            await saveTestNotificationSubscription({
                id: 'sub2',
                recordName,
                notificationAddress: 'testAddress2',
                userId: userId,
                active: true,
                pushSubscription: {
                    endpoint: 'endpoint2',
                    keys: {},
                },
            });
        });

        it('should return not_implemented if the server doesnt have a webhooks controller', async () => {
            server = new RecordsServer({
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
                policyController,
            });

            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/notification/list/user/subscriptions`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 501,
                body: {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This feature is not supported.',
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return the list of subscriptions for the user', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/notification/list/user/subscriptions`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    subscriptions: [
                        {
                            id: 'sub1',
                            recordName,
                            notificationAddress: 'testAddress',
                            userId: userId,
                            pushSubscriptionId: null,
                        },
                        {
                            id: 'sub2',
                            recordName,
                            notificationAddress: 'testAddress2',
                            userId: userId,
                            pushSubscriptionId: null,
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        testUrl(
            'GET',
            `/api/v2/records/notification/list/user/subscriptions`,
            undefined,
            () => apiHeaders
        );
    });

    describe('DELETE /api/v2/records/notification', () => {
        beforeEach(async () => {
            await notificationStore.createItem(recordName, {
                address: 'testAddress',
                description: 'my notification',
                markers: [PRIVATE_MARKER],
            });
        });

        it('should return not_implemented if the server doesnt have a webhooks controller', async () => {
            server = new RecordsServer({
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
                policyController,
            });

            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpDelete(
                    `/api/v2/records/notification`,
                    JSON.stringify({
                        recordName,
                        address: 'testAddress',
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 501,
                body: {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This feature is not supported.',
                },
                headers: apiCorsHeaders,
            });

            const item = await notificationStore.getItemByAddress(
                recordName,
                'testAddress'
            );
            expect(item).not.toBe(null);
        });

        it('should delete the given notification record', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpDelete(
                    `/api/v2/records/notification`,
                    JSON.stringify({
                        recordName,
                        address: 'testAddress',
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: apiCorsHeaders,
            });

            const item = await notificationStore.getItemByAddress(
                recordName,
                'testAddress'
            );
            expect(item).toBe(null);
        });

        it('should reject the request if the user is not authorized', async () => {
            const result = await server.handleHttpRequest(
                httpDelete(
                    `/api/v2/records/notification`,
                    JSON.stringify({
                        recordName,
                        address: 'testAddress',
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'notification',
                        resourceId: 'testAddress',
                        action: 'delete',
                        subjectType: 'user',
                        subjectId: userId,
                    },
                },
                headers: apiCorsHeaders,
            });

            const item = await notificationStore.getItemByAddress(
                recordName,
                'testAddress'
            );
            expect(item).not.toBe(null);
        });

        testUrl(
            'DELETE',
            '/api/v2/records/notification',
            () =>
                JSON.stringify({
                    recordName,
                    address: 'testAddress',
                }),
            () => apiHeaders
        );
    });

    describe('POST /api/v2/records/notification/register', () => {
        beforeEach(async () => {
            // await notificationStore.createItem(recordName, {
            //     address: 'testAddress',
            //     description: 'my notification',
            //     markers: [PRIVATE_MARKER],
            // });
        });

        it('should return not_implemented if the server doesnt have a webhooks controller', async () => {
            server = new RecordsServer({
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
                policyController,
            });

            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/notification/register`,
                    JSON.stringify({
                        pushSubscription: {
                            endpoint: 'https://example.com',
                            keys: {
                                p256dh: 'p256dh',
                                auth: 'auth',
                            },
                        },
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 501,
                body: {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This feature is not supported.',
                },
                headers: apiCorsHeaders,
            });

            expect(notificationStore.pushSubscriptions).toEqual([]);
        });

        it('should support registering a push subscription', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/notification/register`,
                    JSON.stringify({
                        pushSubscription: {
                            endpoint: 'https://example.com',
                            keys: {
                                p256dh: 'p256dh',
                                auth: 'auth',
                            },
                        },
                    }),
                    apiHeaders
                )
            );

            const body = await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: apiCorsHeaders,
            });

            expect(notificationStore.pushSubscriptions).toEqual([
                {
                    id: expect.any(String),
                    endpoint: 'https://example.com',
                    keys: {
                        p256dh: 'p256dh',
                        auth: 'auth',
                    },
                    active: true,
                },
            ]);

            expect(notificationStore.pushSubscriptionUsers).toEqual([
                {
                    pushSubscriptionId: expect.any(String),
                    userId,
                },
            ]);
        });

        testUrl(
            'POST',
            '/api/v2/records/notification/register',
            () =>
                JSON.stringify({
                    pushSubscription: {
                        endpoint: 'https://example.com',
                        keys: {
                            p256dh: 'p256dh',
                            auth: 'auth',
                        },
                    },
                }),
            () => apiHeaders
        );
    });

    describe('POST /api/v2/records/notification/subscribe', () => {
        beforeEach(async () => {
            await notificationStore.createItem(recordName, {
                address: 'testAddress',
                description: 'my notification',
                markers: [PRIVATE_MARKER],
            });
        });

        it('should return not_implemented if the server doesnt have a webhooks controller', async () => {
            server = new RecordsServer({
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
                policyController,
            });

            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/notification/subscribe`,
                    JSON.stringify({
                        recordName,
                        address: 'testAddress',
                        pushSubscription: {
                            endpoint: 'https://example.com',
                            keys: {
                                p256dh: 'p256dh',
                                auth: 'auth',
                            },
                        },
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 501,
                body: {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This feature is not supported.',
                },
                headers: apiCorsHeaders,
            });

            const items =
                await notificationStore.listActivePushSubscriptionsForNotification(
                    recordName,
                    'testAddress'
                );
            expect(items).toEqual([]);
        });

        it('should support subscribing to a notification', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/notification/subscribe`,
                    JSON.stringify({
                        recordName,
                        address: 'testAddress',
                        pushSubscription: {
                            endpoint: 'https://example.com',
                            keys: {
                                p256dh: 'p256dh',
                                auth: 'auth',
                            },
                        },
                    }),
                    apiHeaders
                )
            );

            const body = await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    subscriptionId: expect.any(String),
                },
                headers: apiCorsHeaders,
            });

            const subs =
                await notificationStore.listSubscriptionsForNotification(
                    recordName,
                    'testAddress'
                );
            expect(subs).toEqual([
                {
                    id: body.subscriptionId,
                    recordName,
                    notificationAddress: 'testAddress',
                    userId,
                    pushSubscriptionId: null,
                },
            ]);

            expect(notificationStore.pushSubscriptions).toEqual([
                {
                    id: expect.any(String),
                    endpoint: 'https://example.com',
                    keys: {
                        p256dh: 'p256dh',
                        auth: 'auth',
                    },
                    active: true,
                },
            ]);

            expect(notificationStore.pushSubscriptionUsers).toEqual([
                {
                    pushSubscriptionId: expect.any(String),
                    userId,
                },
            ]);
        });

        it('should return not_authorized if the user doesnt have access', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/notification/subscribe`,
                    JSON.stringify({
                        recordName,
                        address: 'testAddress',
                        pushSubscription: {
                            endpoint: 'https://example.com',
                            keys: {
                                p256dh: 'p256dh',
                                auth: 'auth',
                            },
                        },
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'notification',
                        resourceId: 'testAddress',
                        action: 'subscribe',
                        subjectType: 'user',
                        subjectId: userId,
                    },
                },
                headers: apiCorsHeaders,
            });

            const items =
                await notificationStore.listActivePushSubscriptionsForNotification(
                    recordName,
                    'testAddress'
                );
            expect(items).toEqual([]);
        });

        it('should allow anonymous users to subscribe to publicRead notifications', async () => {
            delete apiHeaders['authorization'];
            await notificationStore.createItem(recordName, {
                address: 'publicAddress',
                description: 'my notification',
                markers: [PUBLIC_READ_MARKER],
            });

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/notification/subscribe`,
                    JSON.stringify({
                        recordName,
                        address: 'publicAddress',
                        pushSubscription: {
                            endpoint: 'https://example.com',
                            keys: {
                                p256dh: 'p256dh',
                                auth: 'auth',
                            },
                        },
                    }),
                    apiHeaders
                )
            );

            const body = await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    subscriptionId: expect.any(String),
                },
                headers: apiCorsHeaders,
            });

            const items =
                await notificationStore.listActivePushSubscriptionsForNotification(
                    recordName,
                    'publicAddress'
                );
            expect(items).toEqual([
                {
                    id: expect.any(String),
                    userId: null,
                    endpoint: 'https://example.com',
                    keys: {
                        p256dh: 'p256dh',
                        auth: 'auth',
                    },
                    active: true,
                    subscriptionId: body.subscriptionId,
                },
            ]);
        });

        testUrl(
            'POST',
            '/api/v2/records/notification/subscribe',
            () =>
                JSON.stringify({
                    recordName,
                    address: 'testAddress',
                    pushSubscription: {
                        endpoint: 'https://example.com',
                        keys: {
                            p256dh: 'p256dh',
                            auth: 'auth',
                        },
                    },
                }),
            () => apiHeaders
        );
    });

    describe('POST /api/v2/records/notification/unsubscribe', () => {
        beforeEach(async () => {
            await notificationStore.createItem(recordName, {
                address: 'testAddress',
                description: 'my notification',
                markers: [PRIVATE_MARKER],
            });

            await saveTestNotificationSubscription({
                id: 'sub1',
                recordName,
                notificationAddress: 'testAddress',
                pushSubscription: {
                    endpoint: 'https://example.com',
                    keys: {},
                },
                active: true,
                userId,
            });
        });

        it('should return not_implemented if the server doesnt have a notifications controller', async () => {
            server = new RecordsServer({
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
                policyController,
            });

            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/notification/unsubscribe`,
                    JSON.stringify({
                        subscriptionId: 'sub1',
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 501,
                body: {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This feature is not supported.',
                },
                headers: apiCorsHeaders,
            });

            const items =
                await notificationStore.listActivePushSubscriptionsForNotification(
                    recordName,
                    'testAddress'
                );
            expect(items).toEqual([
                {
                    id: expect.any(String),
                    endpoint: 'https://example.com',
                    keys: {},
                    active: true,
                    userId,
                    subscriptionId: 'sub1',
                },
            ]);
        });

        it('should support unsubscribing from a notification', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/notification/unsubscribe`,
                    JSON.stringify({
                        subscriptionId: 'sub1',
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: apiCorsHeaders,
            });

            const items =
                await notificationStore.listActivePushSubscriptionsForNotification(
                    recordName,
                    'testAddress'
                );
            expect(items).toEqual([]);
        });

        it('should allow the owner to unsubscribe a subscription', async () => {
            apiHeaders['authorization'] = `Bearer ${ownerSessionKey}`;

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/notification/unsubscribe`,
                    JSON.stringify({
                        subscriptionId: 'sub1',
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: apiCorsHeaders,
            });

            const items =
                await notificationStore.listActivePushSubscriptionsForNotification(
                    recordName,
                    'testAddress'
                );
            expect(items).toEqual([]);
        });

        it('should return not_authorized if the user doesnt have access', async () => {
            await saveTestNotificationSubscription({
                id: 'sub2',
                recordName,
                notificationAddress: 'testAddress',
                pushSubscription: {
                    endpoint: 'https://example.com',
                    keys: {},
                },
                active: true,
                userId: 'otherUserId',
            });

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/notification/unsubscribe`,
                    JSON.stringify({
                        subscriptionId: 'sub2',
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'notification',
                        resourceId: 'testAddress',
                        action: 'unsubscribe',
                        subjectType: 'user',
                        subjectId: userId,
                    },
                },
                headers: apiCorsHeaders,
            });

            const items =
                await notificationStore.listActivePushSubscriptionsForNotification(
                    recordName,
                    'testAddress'
                );
            expect(items).toEqual([
                {
                    id: expect.any(String),
                    endpoint: 'https://example.com',
                    keys: {},
                    active: true,
                    subscriptionId: 'sub1',
                    userId: userId,
                },
            ]);

            expect(notificationStore.pushSubscriptionUsers).toEqual([
                {
                    pushSubscriptionId: expect.any(String),
                    userId: userId,
                },
                {
                    pushSubscriptionId: expect.any(String),
                    userId: 'otherUserId',
                },
            ]);
        });

        testUrl(
            'POST',
            '/api/v2/records/notification/unsubscribe',
            () =>
                JSON.stringify({
                    subscriptionId: 'sub1',
                }),
            () => apiHeaders
        );
    });

    describe('POST /api/v2/records/notification/send', () => {
        beforeEach(async () => {
            await notificationStore.createItem(recordName, {
                address: 'testAddress',
                description: 'my notification',
                markers: [PRIVATE_MARKER],
            });

            await saveTestNotificationSubscription({
                id: 'sub1',
                recordName,
                notificationAddress: 'testAddress',
                pushSubscription: {
                    endpoint: 'https://example.com',
                    keys: {},
                },
                active: true,
                userId,
            });

            webPushInterface.sendNotification.mockResolvedValue({
                success: true,
            });
        });

        it('should return not_implemented if the server doesnt have a webhooks controller', async () => {
            server = new RecordsServer({
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
                policyController,
            });

            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/notification/send`,
                    JSON.stringify({
                        recordName,
                        address: 'testAddress',
                        payload: {
                            title: 'A message',
                            body: 'You have recieved a message!',
                            icon: 'https://example.com/icon.png',
                            badge: 'https://example.com/badge.png',
                            silent: true,
                            tag: 'message',
                            timestamp: 123,
                            action: {
                                type: 'open_url',
                                url: 'https://example.com',
                            },
                            actions: [
                                {
                                    title: 'Open',
                                    action: {
                                        type: 'open_url',
                                        url: 'https://example.com',
                                    },
                                },
                            ],
                        },
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 501,
                body: {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This feature is not supported.',
                },
                headers: apiCorsHeaders,
            });

            expect(notificationStore.sentNotifications).toEqual([]);
        });

        it('should send a notification to the subscribed users', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/notification/send`,
                    JSON.stringify({
                        recordName,
                        address: 'testAddress',
                        payload: {
                            title: 'A message',
                            body: 'You have recieved a message!',
                            icon: 'https://example.com/icon.png',
                            badge: 'https://example.com/badge.png',
                            silent: true,
                            tag: 'message',
                            timestamp: 123,
                            action: {
                                type: 'open_url',
                                url: 'https://example.com',
                            },
                            actions: [
                                {
                                    title: 'Open',
                                    action: {
                                        type: 'open_url',
                                        url: 'https://example.com',
                                    },
                                },
                            ],
                        },
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: apiCorsHeaders,
            });

            expect(notificationStore.sentNotifications).toEqual([
                {
                    id: expect.any(String),
                    recordName,
                    notificationAddress: 'testAddress',
                    title: 'A message',
                    body: 'You have recieved a message!',
                    icon: 'https://example.com/icon.png',
                    badge: 'https://example.com/badge.png',
                    silent: true,
                    tag: 'message',
                    timestamp: 123,
                    defaultAction: {
                        type: 'open_url',
                        url: 'https://example.com',
                    },
                    actions: [
                        {
                            title: 'Open',
                            action: {
                                type: 'open_url',
                                url: 'https://example.com',
                            },
                        },
                    ],
                    sentTimeMs: expect.any(Number),
                },
            ]);

            expect(notificationStore.sentPushNotifications).toEqual([
                {
                    id: expect.any(String),
                    sentNotificationId: expect.any(String),
                    pushSubscriptionId: expect.any(String),
                    subscriptionId: 'sub1',
                    userId: userId,
                    success: true,
                    errorCode: null,
                },
            ]);
        });

        it('should return not_authorized if the user is not authorized', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/notification/send`,
                    JSON.stringify({
                        recordName,
                        address: 'testAddress',
                        payload: {
                            title: 'A message',
                            body: 'You have recieved a message!',
                            icon: 'https://example.com/icon.png',
                            badge: 'https://example.com/badge.png',
                            silent: true,
                            tag: 'message',
                            timestamp: 123,
                            action: {
                                type: 'open_url',
                                url: 'https://example.com',
                            },
                            actions: [
                                {
                                    title: 'Open',
                                    action: {
                                        type: 'open_url',
                                        url: 'https://example.com',
                                    },
                                },
                            ],
                        },
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'notification',
                        resourceId: 'testAddress',
                        action: 'send',
                        subjectType: 'user',
                        subjectId: userId,
                    },
                },
                headers: apiCorsHeaders,
            });

            expect(notificationStore.sentNotifications).toEqual([]);
            expect(notificationStore.sentPushNotifications).toEqual([]);
        });

        testUrl(
            'POST',
            '/api/v2/records/notification/send',
            () =>
                JSON.stringify({
                    recordName,
                    address: 'testAddress',
                    payload: {
                        title: 'A message',
                        body: 'You have recieved a message!',
                        icon: 'https://example.com/icon.png',
                        badge: 'https://example.com/badge.png',
                        silent: true,
                        tag: 'message',
                        timestamp: 123,
                        action: {
                            type: 'open_url',
                            url: 'https://example.com',
                        },
                        actions: [
                            {
                                title: 'Open',
                                action: {
                                    type: 'open_url',
                                    url: 'https://example.com',
                                },
                            },
                        ],
                    },
                }),
            () => apiHeaders
        );
    });

    describe('GET /api/v2/records/notification/applicationServerKey', () => {
        it('should return not_implemented if the server doesnt have a webhooks controller', async () => {
            server = new RecordsServer({
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
                policyController,
            });

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/notification/applicationServerKey`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 501,
                body: {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This feature is not supported.',
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return the configured VAPID public key', async () => {
            webPushInterface.getServerApplicationKey.mockReturnValue('testKey');

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/notification/applicationServerKey`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    key: 'testKey',
                },
                headers: apiCorsHeaders,
            });
        });
    });

    describe('GET /api/v2/records/package', () => {
        beforeEach(async () => {
            await packageStore.createItem(recordName, {
                id: 'packageId',
                address: 'address',
                markers: [PUBLIC_READ_MARKER],
            });
        });

        it('should return the given package', async () => {
            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/package?recordName=${recordName}&address=${'address'}`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    item: {
                        id: 'packageId',
                        address: 'address',
                        markers: [PUBLIC_READ_MARKER],
                    },
                },
                headers: apiCorsHeaders,
            });
        });

        testOrigin(
            'GET',
            `/api/v2/records/package?recordName=${recordName}&address=address`
        );
        testRateLimit(
            'GET',
            `/api/v2/records/package?recordName=${recordName}&address=address`
        );
    });

    describe('POST /api/v2/records/package', () => {
        beforeEach(async () => {
            // await packageStore.createItem(recordName, {
            //     address: 'address',
            //     markers: [PUBLIC_READ_MARKER],
            // });
        });

        it('should store the given package', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/package`,
                    JSON.stringify({
                        recordName,
                        item: {
                            address: 'test',
                            markers: [PUBLIC_READ_MARKER],
                        },
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    address: 'test',
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return not_authorized if the user is not authorized', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/package`,
                    JSON.stringify({
                        recordName,
                        item: {
                            address: 'test',
                            markers: [PUBLIC_READ_MARKER],
                        },
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        subjectType: 'user',
                        subjectId: userId,
                        action: 'create',
                        resourceKind: 'package',
                        resourceId: 'test',
                    },
                },
                headers: apiCorsHeaders,
            });
        });

        testUrl(
            'POST',
            '/api/v2/records/package',
            () =>
                JSON.stringify({
                    recordName,
                    item: {
                        address: 'test',
                        markers: [PUBLIC_READ_MARKER],
                    },
                }),
            () => apiHeaders
        );
    });

    describe('DELETE /api/v2/records/package', () => {
        beforeEach(async () => {
            await packageStore.createItem(recordName, {
                id: 'packageId',
                address: 'address',
                markers: [PUBLIC_READ_MARKER],
            });
        });

        it('should delete the given package', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpDelete(
                    `/api/v2/records/package`,
                    JSON.stringify({
                        recordName,
                        address: 'address',
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: apiCorsHeaders,
            });

            expect(
                await packageStore.getItemByAddress(recordName, 'address')
            ).toBe(null);
        });

        testUrl(
            'DELETE',
            '/api/v2/records/package',
            () =>
                JSON.stringify({
                    recordName,
                    address: 'address',
                }),
            () => apiHeaders
        );
    });

    describe('GET /api/v2/records/package/list', () => {
        beforeEach(async () => {
            await packageStore.createItem(recordName, {
                id: 'packageId',
                address: 'address',
                markers: [PUBLIC_READ_MARKER],
            });

            await packageStore.createItem(recordName, {
                id: 'packageId2',
                address: 'address2',
                markers: [PUBLIC_READ_MARKER],
            });

            await packageStore.createItem(recordName, {
                id: 'packageId3',
                address: 'address3',
                markers: [PUBLIC_READ_MARKER],
            });

            await packageStore.createItem(recordName, {
                id: 'packageId4',
                address: 'address4',
                markers: [PRIVATE_MARKER],
            });
        });

        it('should return the list of packages', async () => {
            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/package/list?recordName=${recordName}&marker=${PUBLIC_READ_MARKER}`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    totalCount: 3,
                    items: [
                        {
                            id: 'packageId',
                            address: 'address',
                            markers: [PUBLIC_READ_MARKER],
                        },
                        {
                            id: 'packageId2',
                            address: 'address2',
                            markers: [PUBLIC_READ_MARKER],
                        },
                        {
                            id: 'packageId3',
                            address: 'address3',
                            markers: [PUBLIC_READ_MARKER],
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        testOrigin(
            'GET',
            `/api/v2/records/package/list?recordName=${recordName}&marker=${PUBLIC_READ_MARKER}`
        );
        testRateLimit(
            'GET',
            `/api/v2/records/package/list?recordName=${recordName}&marker=${PUBLIC_READ_MARKER}`
        );
    });

    describe('GET /api/v2/records/package/version', () => {
        beforeEach(async () => {
            await packageStore.createItem(recordName, {
                id: 'packageId',
                address: 'address',
                markers: [PUBLIC_READ_MARKER],
            });

            await store.addFileRecord(
                recordName,
                'test.aux',
                userId,
                userId,
                123,
                '',
                [PUBLIC_READ_MARKER]
            );
            await store.setFileRecordAsUploaded(recordName, 'test.aux');

            await packageVersionsStore.createItem(recordName, {
                id: 'packageVersionId',
                address: 'address',
                key: {
                    major: 1,
                    minor: 0,
                    patch: 0,
                    tag: '',
                },
                auxFileName: 'test.aux',
                auxSha256: 'auxSha256',
                sizeInBytes: 123,
                createdAtMs: 999,
                createdFile: true,
                entitlements: [],
                description: '',
                requiresReview: false,
                sha256: 'sha256',
                markers: [PUBLIC_READ_MARKER],
            });
        });

        it('should get the package version', async () => {
            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/package/version?recordName=${recordName}&address=${'address'}&major=1`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    item: {
                        id: 'packageVersionId',
                        packageId: 'packageId',
                        address: 'address',
                        key: {
                            major: 1,
                            minor: 0,
                            patch: 0,
                            tag: '',
                        },
                        auxFileName: 'test.aux',
                        auxSha256: 'auxSha256',
                        sizeInBytes: 123,
                        createdAtMs: 999,
                        createdFile: true,
                        entitlements: [],
                        description: '',
                        requiresReview: false,
                        sha256: 'sha256',
                        approved: true,
                        approvalType: 'normal',
                        markers: [PUBLIC_READ_MARKER],
                    },
                    auxFile: {
                        success: true,
                        requestMethod: 'GET',
                        requestUrl: expect.any(String),
                        requestHeaders: expect.any(Object),
                    },
                },
                headers: apiCorsHeaders,
            });
        });

        it('should get the latest package version', async () => {
            await packageVersionsStore.createItem(recordName, {
                id: 'packageVersionId2',
                address: 'address',
                key: {
                    major: 2,
                    minor: 0,
                    patch: 0,
                    tag: '',
                },
                auxFileName: 'test.aux',
                auxSha256: 'auxSha256',
                sizeInBytes: 123,
                createdAtMs: 999,
                createdFile: true,
                entitlements: [],
                description: '',
                requiresReview: false,
                sha256: 'sha256',
                markers: [PUBLIC_READ_MARKER],
            });

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/package/version?recordName=${recordName}&address=${'address'}`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    item: {
                        id: 'packageVersionId2',
                        packageId: 'packageId',
                        address: 'address',
                        key: {
                            major: 2,
                            minor: 0,
                            patch: 0,
                            tag: '',
                        },
                        auxFileName: 'test.aux',
                        auxSha256: 'auxSha256',
                        sizeInBytes: 123,
                        createdAtMs: 999,
                        createdFile: true,
                        entitlements: [],
                        description: '',
                        requiresReview: false,
                        sha256: 'sha256',
                        approved: true,
                        approvalType: 'normal',
                        markers: [PUBLIC_READ_MARKER],
                    },
                    auxFile: {
                        success: true,
                        requestMethod: 'GET',
                        requestUrl: expect.any(String),
                        requestHeaders: expect.any(Object),
                    },
                },
                headers: apiCorsHeaders,
            });
        });

        it('should get the package version by SHA-256', async () => {
            await packageVersionsStore.createItem(recordName, {
                id: 'packageVersionId2',
                address: 'address',
                key: {
                    major: 2,
                    minor: 0,
                    patch: 0,
                    tag: '',
                },
                auxFileName: 'test.aux',
                auxSha256: 'auxSha256',
                sizeInBytes: 123,
                createdAtMs: 999,
                createdFile: true,
                entitlements: [],
                description: '',
                requiresReview: false,
                sha256: 'test',
                markers: [PUBLIC_READ_MARKER],
            });

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/package/version?recordName=${recordName}&address=${'address'}&sha256=test`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    item: {
                        id: 'packageVersionId2',
                        packageId: 'packageId',
                        address: 'address',
                        key: {
                            major: 2,
                            minor: 0,
                            patch: 0,
                            tag: '',
                        },
                        auxFileName: 'test.aux',
                        auxSha256: 'auxSha256',
                        sizeInBytes: 123,
                        createdAtMs: 999,
                        createdFile: true,
                        entitlements: [],
                        description: '',
                        requiresReview: false,
                        sha256: 'test',
                        approved: true,
                        approvalType: 'normal',
                        markers: [PUBLIC_READ_MARKER],
                    },
                    auxFile: {
                        success: true,
                        requestMethod: 'GET',
                        requestUrl: expect.any(String),
                        requestHeaders: expect.any(Object),
                    },
                },
                headers: apiCorsHeaders,
            });
        });

        it('should get the latest version that matches the given major number', async () => {
            await packageVersionsStore.createItem(recordName, {
                id: 'packageVersionId2',
                address: 'address',
                key: {
                    major: 2,
                    minor: 0,
                    patch: 0,
                    tag: '',
                },
                auxFileName: 'test.aux',
                auxSha256: 'auxSha256',
                sizeInBytes: 123,
                createdAtMs: 999,
                createdFile: true,
                entitlements: [],
                description: '',
                requiresReview: false,
                sha256: 'test',
                markers: [PUBLIC_READ_MARKER],
            });

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/package/version?recordName=${recordName}&address=${'address'}&major=1`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    item: {
                        id: 'packageVersionId',
                        packageId: 'packageId',
                        address: 'address',
                        key: {
                            major: 1,
                            minor: 0,
                            patch: 0,
                            tag: '',
                        },
                        auxFileName: 'test.aux',
                        auxSha256: 'auxSha256',
                        sizeInBytes: 123,
                        createdAtMs: 999,
                        createdFile: true,
                        entitlements: [],
                        description: '',
                        requiresReview: false,
                        sha256: 'sha256',
                        approved: true,
                        approvalType: 'normal',
                        markers: [PUBLIC_READ_MARKER],
                    },
                    auxFile: {
                        success: true,
                        requestMethod: 'GET',
                        requestUrl: expect.any(String),
                        requestHeaders: expect.any(Object),
                    },
                },
                headers: apiCorsHeaders,
            });
        });

        it('should get the package version by key', async () => {
            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/package/version?recordName=${recordName}&address=${'address'}&key=v1.0.0`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    item: {
                        id: 'packageVersionId',
                        packageId: 'packageId',
                        address: 'address',
                        key: {
                            major: 1,
                            minor: 0,
                            patch: 0,
                            tag: '',
                        },
                        auxFileName: 'test.aux',
                        auxSha256: 'auxSha256',
                        sizeInBytes: 123,
                        createdAtMs: 999,
                        createdFile: true,
                        entitlements: [],
                        description: '',
                        requiresReview: false,
                        sha256: 'sha256',
                        approved: true,
                        approvalType: 'normal',
                        markers: [PUBLIC_READ_MARKER],
                    },
                    auxFile: {
                        success: true,
                        requestMethod: 'GET',
                        requestUrl: expect.any(String),
                        requestHeaders: expect.any(Object),
                    },
                },
                headers: apiCorsHeaders,
            });
        });

        testOrigin(
            'GET',
            `/api/v2/records/package/version?recordName=${recordName}&address=${'address'}&major=1`
        );
        testRateLimit(
            'GET',
            `/api/v2/records/package/version?recordName=${recordName}&address=${'address'}&major=1`
        );
    });

    describe('POST /api/v2/records/package/version', () => {
        beforeEach(async () => {
            await packageStore.createItem(recordName, {
                id: 'packageId',
                address: 'address',
                markers: [PUBLIC_READ_MARKER],
            });
        });

        it('should save the given package version and return a file upload result', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/package/version`,
                    JSON.stringify({
                        recordName,
                        item: {
                            address: 'address',
                            key: {
                                major: 1,
                                minor: 0,
                                patch: 0,
                                tag: '',
                            },
                            auxFileRequest: {
                                fileByteLength: 123,
                                fileDescription: 'description',
                                fileMimeType: 'application/json',
                                fileSha256Hex: getHash('aux'),
                                headers: {},
                            },
                            entitlements: [],
                            description: 'description',
                            markers: [PUBLIC_READ_MARKER],
                        },
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    address: 'address',
                    auxFileResult: {
                        success: true,
                        fileName: expect.any(String),
                        markers: [PRIVATE_MARKER],
                        uploadHeaders: {
                            'content-type': 'application/json',
                            'record-name': recordName,
                        },
                        uploadMethod: 'POST',
                        uploadUrl: expect.any(String),
                    },
                },
                headers: apiCorsHeaders,
            });
        });

        it('should allow markers to be optional', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/package/version`,
                    JSON.stringify({
                        recordName,
                        item: {
                            address: 'address',
                            key: {
                                major: 1,
                                minor: 0,
                                patch: 0,
                                tag: '',
                            },
                            auxFileRequest: {
                                fileByteLength: 123,
                                fileDescription: 'description',
                                fileMimeType: 'application/json',
                                fileSha256Hex: getHash('aux'),
                                headers: {},
                            },
                            entitlements: [],
                            description: 'description',
                        },
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    address: 'address',
                    auxFileResult: {
                        success: true,
                        fileName: expect.any(String),
                        markers: [PRIVATE_MARKER],
                        uploadHeaders: {
                            'content-type': 'application/json',
                            'record-name': recordName,
                        },
                        uploadMethod: 'POST',
                        uploadUrl: expect.any(String),
                    },
                },
                headers: apiCorsHeaders,
            });
        });

        testUrl(
            'POST',
            `/api/v2/records/package/version`,
            () =>
                JSON.stringify({
                    recordName,
                    item: {
                        address: 'address',
                        key: {
                            major: 1,
                            minor: 0,
                            patch: 0,
                            tag: '',
                        },
                        auxFileRequest: {
                            fileByteLength: 123,
                            fileDescription: 'description',
                            fileMimeType: 'application/json',
                            fileSha256Hex: getHash('aux'),
                            headers: {},
                        },
                        entitlements: [],
                        description: 'description',
                        markers: [PUBLIC_READ_MARKER],
                    },
                }),
            () => apiHeaders
        );
    });

    describe('GET /api/v2/records/package/version/list', () => {
        beforeEach(async () => {
            await packageStore.createItem(recordName, {
                id: 'packageId',
                address: 'address',
                markers: [PUBLIC_READ_MARKER],
            });

            for (let i = 1; i <= 3; i++) {
                await packageVersionsStore.createItem(recordName, {
                    id: `packageVersionId${i}`,
                    address: 'address',
                    key: {
                        major: i,
                        minor: 0,
                        patch: 0,
                        tag: '',
                    },
                    auxFileName: 'test.aux',
                    auxSha256: 'auxSha256',
                    sizeInBytes: 123,
                    createdAtMs: 999,
                    createdFile: true,
                    entitlements: [],
                    description: '',
                    requiresReview: false,
                    sha256: 'sha256',
                    markers: [PUBLIC_READ_MARKER],
                });
            }
        });

        it('should return the list of versions for a package', async () => {
            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/package/version/list?recordName=${recordName}&address=${'address'}`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    totalCount: 3,
                    items: [
                        {
                            id: 'packageVersionId3',
                            address: 'address',
                            key: {
                                major: 3,
                                minor: 0,
                                patch: 0,
                                tag: '',
                            },
                            auxFileName: 'test.aux',
                            auxSha256: 'auxSha256',
                            sizeInBytes: 123,
                            createdAtMs: 999,
                            createdFile: true,
                            entitlements: [],
                            description: '',
                            requiresReview: false,
                            sha256: 'sha256',
                            markers: [PUBLIC_READ_MARKER],
                        },
                        {
                            id: 'packageVersionId2',
                            address: 'address',
                            key: {
                                major: 2,
                                minor: 0,
                                patch: 0,
                                tag: '',
                            },
                            auxFileName: 'test.aux',
                            auxSha256: 'auxSha256',
                            sizeInBytes: 123,
                            createdAtMs: 999,
                            createdFile: true,
                            entitlements: [],
                            description: '',
                            requiresReview: false,
                            sha256: 'sha256',
                            markers: [PUBLIC_READ_MARKER],
                        },
                        {
                            id: 'packageVersionId1',
                            address: 'address',
                            key: {
                                major: 1,
                                minor: 0,
                                patch: 0,
                                tag: '',
                            },
                            auxFileName: 'test.aux',
                            auxSha256: 'auxSha256',
                            sizeInBytes: 123,
                            createdAtMs: 999,
                            createdFile: true,
                            entitlements: [],
                            description: '',
                            requiresReview: false,
                            sha256: 'sha256',
                            markers: [PUBLIC_READ_MARKER],
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        testOrigin(
            'GET',
            `/api/v2/records/package/version/list?recordName=${recordName}&address=${'address'}`
        );
        testRateLimit(
            'GET',
            `/api/v2/records/package/version/list?recordName=${recordName}&address=${'address'}`
        );
    });

    describe('DELETE /api/v2/records/package/version', () => {
        beforeEach(async () => {
            await packageStore.createItem(recordName, {
                id: 'packageId',
                address: 'address',
                markers: [PUBLIC_READ_MARKER],
            });

            for (let i = 1; i <= 3; i++) {
                await packageVersionsStore.createItem(recordName, {
                    id: `packageVersionId${i}`,
                    address: 'address',
                    key: {
                        major: i,
                        minor: 0,
                        patch: 0,
                        tag: '',
                    },
                    auxFileName: 'test.aux',
                    auxSha256: 'auxSha256',
                    sizeInBytes: 123,
                    createdAtMs: 999,
                    createdFile: true,
                    entitlements: [],
                    description: '',
                    requiresReview: false,
                    sha256: 'sha256',
                    markers: [PUBLIC_READ_MARKER],
                });
            }
        });

        it('should delete the given package version', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpDelete(
                    `/api/v2/records/package/version`,
                    JSON.stringify({
                        recordName,
                        address: 'address',
                        key: {
                            major: 1,
                            minor: 0,
                            patch: 0,
                            tag: '',
                        },
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: apiCorsHeaders,
            });

            expect(
                await packageVersionsStore.getItemByKey(recordName, 'address', {
                    major: 1,
                    minor: 0,
                    patch: 0,
                    tag: '',
                })
            ).toEqual({
                item: null,
                recordName,
                parentMarkers: [PUBLIC_READ_MARKER],
                packageId: 'packageId',
            });
        });

        testUrl(
            'DELETE',
            '/api/v2/records/package/version',
            () =>
                JSON.stringify({
                    recordName,
                    address: 'address',
                    key: {
                        major: 1,
                        minor: 0,
                        patch: 0,
                        tag: '',
                    },
                }),
            () => apiHeaders
        );
    });

    describe('POST /api/v2/records/package/version/review', () => {
        beforeEach(async () => {
            await packageStore.createItem(recordName, {
                id: 'packageId',
                address: 'address',
                markers: [PUBLIC_READ_MARKER],
            });

            await packageVersionsStore.createItem(recordName, {
                id: 'packageVersionId',
                address: 'address',
                key: {
                    major: 1,
                    minor: 0,
                    patch: 0,
                    tag: '',
                },
                auxFileName: 'test.aux',
                auxSha256: 'auxSha256',
                sizeInBytes: 123,
                createdAtMs: 999,
                createdFile: true,
                entitlements: [],
                description: '',
                requiresReview: false,
                sha256: 'sha256',
                markers: [PUBLIC_READ_MARKER],
            });
        });

        const roleCases: [UserRole][] = [
            ['superUser'],
            ['system'],
            ['moderator'],
        ];

        it.each(roleCases)(
            'should allow %s to save a review for the given version',
            async (role) => {
                const user = await store.findUser(userId);
                await store.saveUser({
                    ...user,
                    role,
                });

                const result = await server.handleHttpRequest(
                    httpPost(
                        '/api/v2/records/package/version/review',
                        JSON.stringify({
                            packageVersionId: 'packageVersionId',
                            review: {
                                approved: true,
                                approvalType: 'normal',
                                reviewComments: 'good',
                                reviewStatus: 'approved',
                            },
                        }),
                        apiHeaders
                    )
                );

                await expectResponseBodyToEqual(result, {
                    statusCode: 200,
                    body: {
                        success: true,
                        reviewId: expect.any(String),
                    },
                    headers: apiCorsHeaders,
                });
            }
        );

        it('should not allow regular users to save a review for the given version', async () => {
            const user = await store.findUser(userId);
            await store.saveUser({
                ...user,
                role: 'none',
            });

            const result = await server.handleHttpRequest(
                httpPost(
                    '/api/v2/records/package/version/review',
                    JSON.stringify({
                        packageVersionId: 'packageVersionId',
                        review: {
                            approved: true,
                            approvalType: 'normal',
                            reviewComments: 'good',
                            reviewStatus: 'approved',
                        },
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to submit reviews for package versions.',
                },
                headers: apiCorsHeaders,
            });
        });

        testUrl(
            'POST',
            '/api/v2/records/package/version/review',
            () =>
                JSON.stringify({
                    packageVersionId: 'packageVersionId',
                    review: {
                        approved: true,
                        approvalType: 'normal',
                        reviewComments: 'good',
                        reviewStatus: 'approved',
                    },
                }),
            () => apiHeaders
        );
    });

    describe('POST /api/v2/records/package/install', () => {
        const inst = 'myInst';

        async function recordPackage(
            recordName: string,
            address: string,
            markers: string[],
            key: PackageRecordVersionKey,
            aux: StoredAux
        ) {
            const r = await store.getRecordByName(recordName);
            if (!r) {
                await recordsController.createRecord({
                    recordName,
                    userId: ownerId,
                    ownerId: ownerId,
                });
            }
            await packageStore.createItem(recordName, {
                id: address,
                address: address,
                markers,
            });

            const json = JSON.stringify(aux);
            const sha256 = getHash(json);

            const result = await packageVersionController.recordItem({
                recordKeyOrRecordName: recordName,
                userId: ownerId,
                item: {
                    address,
                    key,
                    description: '',
                    entitlements: [],
                    auxFileRequest: {
                        fileSha256Hex: sha256,
                        fileByteLength: json.length,
                        fileDescription: 'aux.json',
                        fileMimeType: 'application/json',
                        headers: {},
                    },
                },
                instances: [],
            });
            expect(result).toMatchObject({
                success: true,
            });
            if (!result.success) {
                console.error(result);
                throw new Error('Failed to record package');
            }

            if (!result.auxFileResult.success) {
                console.error(result.auxFileResult);
                throw new Error('Failed to record file');
            }

            files.set(result.auxFileResult.uploadUrl, json);
        }

        let originalFetch: typeof fetch;
        let fetchMock: jest.Mock;
        let files: Map<string, string>;

        beforeEach(async () => {
            files = new Map();

            originalFetch = global.fetch;
            fetchMock = global.fetch = jest.fn(async (request) => {
                const url =
                    typeof request === 'string'
                        ? request
                        : request instanceof URL
                        ? request.href
                        : request.url;

                const text = files.get(url);
                return {
                    status: text ? 200 : 404,
                    text: async () => text,
                } as Response;
            });

            await recordPackage(
                recordName,
                'public',
                [PUBLIC_READ_MARKER],
                version(1),
                {
                    version: 1,
                    state: {
                        test: createBot('test', {
                            abc: 'def',
                        }),
                    },
                }
            );
        });

        afterEach(() => {
            global.fetch = originalFetch;
        });

        it('should install the package version', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    '/api/v2/records/package/install',
                    JSON.stringify({
                        recordName: null,
                        inst,
                        package: {
                            recordName,
                            address: 'public',
                            key: version(1),
                        },
                    }),
                    apiHeaders
                )
            );

            const { package: p } = await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    packageLoadId: expect.any(String),
                    package: {
                        id: expect.any(String),
                        packageId: 'public',
                        address: 'public',
                        key: version(1),
                        entitlements: [],
                        description: '',
                        markers: [PUBLIC_READ_MARKER],
                        createdAtMs: expect.any(Number),
                        sha256: expect.any(String),
                        auxSha256: expect.any(String),
                        auxFileName: expect.any(String),
                        createdFile: true,
                        requiresReview: false,
                        sizeInBytes: expect.any(Number),
                        approved: true,
                        approvalType: 'normal',
                    },
                },
                headers: apiCorsHeaders,
            });

            const updates = await instStore.getCurrentUpdates(
                null,
                inst,
                DEFAULT_BRANCH_NAME
            );
            const state = getStateFromUpdates(
                getInstStateFromUpdates(
                    updates!.updates.map((u, index) => ({
                        id: index,
                        update: u,
                        timestamp: 123,
                    }))
                )
            );

            expect(state).toEqual({
                test: createBot('test', {
                    abc: 'def',
                }),
            });

            expect(await instStore.listLoadedPackages(null, inst)).toEqual([
                {
                    id: expect.any(String),
                    recordName: null,
                    inst,
                    packageId: 'public',
                    packageVersionId: p.id,
                    userId: userId,
                    branch: DEFAULT_BRANCH_NAME,
                },
            ]);
        });

        it('should support string version keys', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    '/api/v2/records/package/install',
                    JSON.stringify({
                        recordName: null,
                        inst,
                        package: {
                            recordName,
                            address: 'public',
                            key: 'v1.0.0',
                        },
                    }),
                    apiHeaders
                )
            );

            const { package: p } = await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    packageLoadId: expect.any(String),
                    package: {
                        id: expect.any(String),
                        packageId: 'public',
                        address: 'public',
                        key: version(1),
                        entitlements: [],
                        description: '',
                        markers: [PUBLIC_READ_MARKER],
                        createdAtMs: expect.any(Number),
                        sha256: expect.any(String),
                        auxSha256: expect.any(String),
                        auxFileName: expect.any(String),
                        createdFile: true,
                        requiresReview: false,
                        sizeInBytes: expect.any(Number),
                        approved: true,
                        approvalType: 'normal',
                    },
                },
                headers: apiCorsHeaders,
            });

            const updates = await instStore.getCurrentUpdates(
                null,
                inst,
                DEFAULT_BRANCH_NAME
            );
            const state = getStateFromUpdates(
                getInstStateFromUpdates(
                    updates!.updates.map((u, index) => ({
                        id: index,
                        update: u,
                        timestamp: 123,
                    }))
                )
            );

            expect(state).toEqual({
                test: createBot('test', {
                    abc: 'def',
                }),
            });

            expect(await instStore.listLoadedPackages(null, inst)).toEqual([
                {
                    id: expect.any(String),
                    recordName: null,
                    inst,
                    packageId: 'public',
                    packageVersionId: p.id,
                    userId: userId,
                    branch: DEFAULT_BRANCH_NAME,
                },
            ]);
        });

        it('should support installing into private insts', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpPost(
                    '/api/v2/records/package/install',
                    JSON.stringify({
                        recordName,
                        inst,
                        package: {
                            recordName,
                            address: 'public',
                            key: version(1),
                        },
                    }),
                    apiHeaders
                )
            );

            const { package: p } = await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    packageLoadId: expect.any(String),
                    package: {
                        id: expect.any(String),
                        packageId: 'public',
                        address: 'public',
                        key: version(1),
                        entitlements: [],
                        description: '',
                        markers: [PUBLIC_READ_MARKER],
                        createdAtMs: expect.any(Number),
                        sha256: expect.any(String),
                        auxSha256: expect.any(String),
                        auxFileName: expect.any(String),
                        createdFile: true,
                        requiresReview: false,
                        sizeInBytes: expect.any(Number),
                        approved: true,
                        approvalType: 'normal',
                    },
                },
                headers: apiCorsHeaders,
            });

            const updates = await instStore.getCurrentUpdates(
                recordName,
                inst,
                DEFAULT_BRANCH_NAME
            );
            const state = getStateFromUpdates(
                getInstStateFromUpdates(
                    updates!.updates.map((u, index) => ({
                        id: index,
                        update: u,
                        timestamp: 123,
                    }))
                )
            );

            expect(state).toEqual({
                test: createBot('test', {
                    abc: 'def',
                }),
            });

            expect(
                await instStore.listLoadedPackages(recordName, inst)
            ).toEqual([
                {
                    id: expect.any(String),
                    recordName,
                    inst,
                    packageId: 'public',
                    packageVersionId: p.id,
                    userId: userId,
                    branch: DEFAULT_BRANCH_NAME,
                },
            ]);
        });

        it('should support anonymous users', async () => {
            delete apiHeaders['authorization'];

            const result = await server.handleHttpRequest(
                httpPost(
                    '/api/v2/records/package/install',
                    JSON.stringify({
                        recordName: null,
                        inst,
                        package: {
                            recordName,
                            address: 'public',
                            key: version(1),
                        },
                    }),
                    apiHeaders
                )
            );

            const { package: p } = await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    packageLoadId: expect.any(String),
                    package: {
                        id: expect.any(String),
                        packageId: 'public',
                        address: 'public',
                        key: version(1),
                        entitlements: [],
                        description: '',
                        markers: [PUBLIC_READ_MARKER],
                        createdAtMs: expect.any(Number),
                        sha256: expect.any(String),
                        auxSha256: expect.any(String),
                        auxFileName: expect.any(String),
                        createdFile: true,
                        requiresReview: false,
                        sizeInBytes: expect.any(Number),
                        approved: true,
                        approvalType: 'normal',
                    },
                },
                headers: apiCorsHeaders,
            });

            const updates = await instStore.getCurrentUpdates(
                null,
                inst,
                DEFAULT_BRANCH_NAME
            );
            const state = getStateFromUpdates(
                getInstStateFromUpdates(
                    updates!.updates.map((u, index) => ({
                        id: index,
                        update: u,
                        timestamp: 123,
                    }))
                )
            );

            expect(state).toEqual({
                test: createBot('test', {
                    abc: 'def',
                }),
            });

            expect(await instStore.listLoadedPackages(null, inst)).toEqual([
                {
                    id: expect.any(String),
                    recordName: null,
                    inst,
                    packageId: 'public',
                    packageVersionId: p.id,
                    userId: null,
                    branch: DEFAULT_BRANCH_NAME,
                },
            ]);
        });

        testOrigin('POST', '/api/v2/records/package/install', () =>
            JSON.stringify({
                recordName: null,
                inst,
                package: {
                    recordName,
                    address: 'public',
                    key: version(1),
                },
            })
        );
        testBodyIsJson((body) =>
            httpPost('/api/v2/records/package/install', body, apiHeaders)
        );
        testRateLimit(() =>
            httpPost(
                '/api/v2/records/package/install',
                JSON.stringify({
                    recordName: null,
                    inst,
                    package: {
                        recordName,
                        address: 'public',
                        key: version(1),
                    },
                }),
                apiHeaders
            )
        );
    });

    describe('GET /api/v2/records/package/install/list', () => {
        const inst = 'myInst';

        beforeEach(async () => {
            await instStore.saveLoadedPackage({
                id: 'loadedPackageId',
                recordName: null,
                inst: inst,
                branch: DEFAULT_BRANCH_NAME,
                packageId: 'public',
                packageVersionId: 'public@1.0.0',
                userId: userId,
            });

            await instStore.saveLoadedPackage({
                id: 'loadedPackageId2',
                recordName: null,
                inst: inst,
                branch: DEFAULT_BRANCH_NAME,
                packageId: 'public',
                packageVersionId: 'public@1.0.1',
                userId: userId,
            });

            await instStore.saveInst({
                recordName,
                inst: inst,
                markers: [PRIVATE_MARKER],
            });

            await instStore.saveLoadedPackage({
                id: 'loadedPackageId3',
                recordName,
                inst: inst,
                branch: DEFAULT_BRANCH_NAME,
                packageId: 'public',
                packageVersionId: 'public@1.0.0',
                userId: userId,
            });

            await instStore.saveLoadedPackage({
                id: 'loadedPackageId4',
                recordName,
                inst: inst,
                branch: DEFAULT_BRANCH_NAME,
                packageId: 'public',
                packageVersionId: 'public@1.0.1',
                userId: userId,
            });
        });

        it('should list the installed packages from a public inst', async () => {
            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/package/install/list?inst=${inst}`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    packages: [
                        {
                            id: 'loadedPackageId',
                            recordName: null,
                            inst: inst,
                            branch: DEFAULT_BRANCH_NAME,
                            packageId: 'public',
                            packageVersionId: 'public@1.0.0',
                            userId: userId,
                        },
                        {
                            id: 'loadedPackageId2',
                            recordName: null,
                            inst: inst,
                            branch: DEFAULT_BRANCH_NAME,
                            packageId: 'public',
                            packageVersionId: 'public@1.0.1',
                            userId: userId,
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should allow anonymous users to list packages in a public inst', async () => {
            delete apiHeaders['authorization'];

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/package/install/list?inst=${inst}`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    packages: [
                        {
                            id: 'loadedPackageId',
                            recordName: null,
                            inst: inst,
                            branch: DEFAULT_BRANCH_NAME,
                            packageId: 'public',
                            packageVersionId: 'public@1.0.0',
                            userId: userId,
                        },
                        {
                            id: 'loadedPackageId2',
                            recordName: null,
                            inst: inst,
                            branch: DEFAULT_BRANCH_NAME,
                            packageId: 'public',
                            packageVersionId: 'public@1.0.1',
                            userId: userId,
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should list the installed packages from a private inst', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/package/install/list?recordName=${recordName}&inst=${inst}`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    packages: [
                        {
                            id: 'loadedPackageId3',
                            recordName,
                            inst: inst,
                            branch: DEFAULT_BRANCH_NAME,
                            packageId: 'public',
                            packageVersionId: 'public@1.0.0',
                            userId: userId,
                        },
                        {
                            id: 'loadedPackageId4',
                            recordName,
                            inst: inst,
                            branch: DEFAULT_BRANCH_NAME,
                            packageId: 'public',
                            packageVersionId: 'public@1.0.1',
                            userId: userId,
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return 403 if the user is not allowed to read the inst', async () => {
            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/package/install/list?recordName=${recordName}&inst=${inst}`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'inst',
                        resourceId: inst,
                        subjectType: 'user',
                        subjectId: userId,
                        action: 'read',
                    },
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return 403 if the inst is not allowed to read the inst', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/package/install/list?recordName=${recordName}&inst=${inst}&instances=/otherInst`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'inst',
                        resourceId: inst,
                        subjectType: 'inst',
                        subjectId: '/otherInst',
                        action: 'read',
                    },
                },
                headers: apiCorsHeaders,
            });
        });

        testUrl(
            'GET',
            `/api/v2/records/package/install/list?recordName=${recordName}&inst=${inst}`,
            () => null,
            () => apiHeaders
        );
    });

    describe('POST /api/v2/records/search/collection', () => {
        it('should return not_supported if the search controller is null', async () => {
            server = new RecordsServer({
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
                policyController,
            });

            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/search/collection`,
                    JSON.stringify({
                        recordName,
                        item: {
                            address: 'address',
                            markers: [PUBLIC_READ_MARKER],
                            schema: {
                                '.*': {
                                    type: 'auto',
                                },
                            },
                        },
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 501,
                body: {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This feature is not supported.',
                },
                headers: apiCorsHeaders,
            });
        });

        it('should create a search record', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/search/collection`,
                    JSON.stringify({
                        recordName,
                        item: {
                            address: 'address',
                            markers: [PUBLIC_READ_MARKER],
                            schema: {
                                '.*': {
                                    type: 'auto',
                                },
                            },
                        },
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    address: 'address',
                },
                headers: apiCorsHeaders,
            });
        });

        testUrl(
            'POST',
            '/api/v2/records/search/collection',
            () =>
                JSON.stringify({
                    recordName,
                    item: {
                        address: 'address',
                        markers: [PUBLIC_READ_MARKER],
                        schema: {
                            '.*': {
                                type: 'auto',
                            },
                        },
                    },
                }),
            () => apiHeaders
        );
    });

    describe('GET /api/v2/records/search/collection', () => {
        beforeEach(async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            await searchRecordsController.recordItem({
                recordKeyOrRecordName: recordName,
                userId,
                instances: [],
                item: {
                    address: 'address',
                    markers: [PUBLIC_READ_MARKER],
                    schema: {
                        '.*': {
                            type: 'auto',
                        },
                    },
                },
            });

            await searchRecordsController.recordItem({
                recordKeyOrRecordName: recordName,
                userId,
                instances: [],
                item: {
                    address: 'address2',
                    markers: [PRIVATE_MARKER],
                    schema: {
                        '.*': {
                            type: 'auto',
                        },
                    },
                },
            });
        });

        it('should return the info about the search collection', async () => {
            const item = await searchRecordsStore.getItemByAddress(
                recordName,
                'address'
            );

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/search/collection?recordName=${recordName}&address=${'address'}`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    item: {
                        address: 'address',
                        collectionName: item?.collectionName,
                        searchApiKey: item?.searchApiKey,
                        markers: [PUBLIC_READ_MARKER],
                        schema: {
                            '.*': {
                                type: 'auto',
                            },
                        },
                        nodes: [],
                    },
                },
                headers: apiCorsHeaders,
            });
        });

        testRateLimit(() =>
            httpGet(
                `/api/v2/records/search/collection?recordName=${recordName}&address=${'address'}`,
                apiHeaders
            )
        );

        testAuthorization(() =>
            httpGet(
                `/api/v2/records/search/collection?recordName=${recordName}&address=${'address2'}`,
                apiHeaders
            )
        );
    });

    describe('DELETE /api/v2/records/search/collection', () => {
        beforeEach(async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            await searchRecordsController.recordItem({
                recordKeyOrRecordName: recordName,
                userId,
                instances: [],
                item: {
                    address: 'address',
                    markers: [PUBLIC_READ_MARKER],
                    schema: {
                        '.*': {
                            type: 'auto',
                        },
                    },
                },
            });

            await searchRecordsController.recordItem({
                recordKeyOrRecordName: recordName,
                userId,
                instances: [],
                item: {
                    address: 'address2',
                    markers: [PRIVATE_MARKER],
                    schema: {
                        '.*': {
                            type: 'auto',
                        },
                    },
                },
            });
        });

        it('should return not_supported if the search controller is null', async () => {
            server = new RecordsServer({
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
                policyController,
            });

            const result = await server.handleHttpRequest(
                httpDelete(
                    `/api/v2/records/search/collection`,
                    JSON.stringify({
                        recordName,
                        address: 'address',
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 501,
                body: {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This feature is not supported.',
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return 403 if the user is not authorized', async () => {
            delete store.roles[recordName];

            const result = await server.handleHttpRequest(
                httpDelete(
                    `/api/v2/records/search/collection`,
                    JSON.stringify({
                        recordName,
                        address: 'address',
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'search',
                        resourceId: 'address',
                        subjectType: 'user',
                        subjectId: userId,
                        action: 'delete',
                    },
                },
                headers: apiCorsHeaders,
            });

            // Verify the search record was not deleted
            const item = await searchRecordsStore.getItemByAddress(
                recordName,
                'address'
            );
            expect(item).toBeTruthy();
        });

        it('should delete a search record', async () => {
            const result = await server.handleHttpRequest(
                httpDelete(
                    `/api/v2/records/search/collection`,
                    JSON.stringify({
                        recordName,
                        address: 'address',
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: apiCorsHeaders,
            });

            // Verify the search record was deleted
            const item = await searchRecordsStore.getItemByAddress(
                recordName,
                'address'
            );
            expect(item).toBeNull();
        });

        it('should return not_found if the search record does not exist', async () => {
            const result = await server.handleHttpRequest(
                httpDelete(
                    `/api/v2/records/search/collection`,
                    JSON.stringify({
                        recordName,
                        address: 'nonexistent',
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 404,
                body: {
                    success: false,
                    errorCode: 'data_not_found',
                    errorMessage: 'The item was not found.',
                },
                headers: apiCorsHeaders,
            });
        });

        testUrl(
            'DELETE',
            '/api/v2/records/search/collection',
            () =>
                JSON.stringify({
                    recordName,
                    address: 'address',
                }),
            () => apiHeaders
        );
    });

    describe('GET /api/v2/records/search/collection/list', () => {
        beforeEach(async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            await searchRecordsController.recordItem({
                recordKeyOrRecordName: recordName,
                userId,
                instances: [],
                item: {
                    address: 'address1',
                    markers: [PUBLIC_READ_MARKER],
                    schema: {
                        '.*': {
                            type: 'auto',
                        },
                    },
                },
            });

            await searchRecordsController.recordItem({
                recordKeyOrRecordName: recordName,
                userId,
                instances: [],
                item: {
                    address: 'address2',
                    markers: [PRIVATE_MARKER],
                    schema: {
                        '.*': {
                            type: 'auto',
                        },
                    },
                },
            });

            await searchRecordsController.recordItem({
                recordKeyOrRecordName: recordName,
                userId,
                instances: [],
                item: {
                    address: 'address3',
                    markers: ['secret'],
                    schema: {
                        '.*': {
                            type: 'auto',
                        },
                    },
                },
            });
        });

        it('should list all search collections when no marker is specified', async () => {
            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/search/collection/list?recordName=${recordName}`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    items: [
                        {
                            address: 'address1',
                            collectionName: expect.any(String),
                            searchApiKey: expect.any(String),
                            markers: [PUBLIC_READ_MARKER],
                        },
                        {
                            address: 'address2',
                            collectionName: expect.any(String),
                            searchApiKey: expect.any(String),
                            markers: [PRIVATE_MARKER],
                        },
                        {
                            address: 'address3',
                            collectionName: expect.any(String),
                            searchApiKey: expect.any(String),
                            markers: ['secret'],
                        },
                    ],
                    totalCount: 3,
                },
                headers: apiCorsHeaders,
            });
        });

        describe('?marker', () => {
            it('should list search collections filtered by marker', async () => {
                const result = await server.handleHttpRequest(
                    httpGet(
                        `/api/v2/records/search/collection/list?recordName=${recordName}&marker=${PUBLIC_READ_MARKER}`,
                        apiHeaders
                    )
                );

                await expectResponseBodyToEqual(result, {
                    statusCode: 200,
                    body: {
                        success: true,
                        recordName,
                        items: [
                            {
                                address: 'address1',
                                collectionName: expect.any(String),
                                searchApiKey: expect.any(String),
                                markers: [PUBLIC_READ_MARKER],
                            },
                        ],
                        totalCount: 1,
                    },
                    headers: apiCorsHeaders,
                });
            });

            it('should return not_authorized if the user does not have access to the marker', async () => {
                delete store.roles[recordName];

                const result = await server.handleHttpRequest(
                    httpGet(
                        `/api/v2/records/search/collection/list?recordName=${recordName}&marker=secret`,
                        apiHeaders
                    )
                );

                await expectResponseBodyToEqual(result, {
                    statusCode: 403,
                    body: {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'You are not authorized to perform this action.',
                        reason: {
                            type: 'missing_permission',
                            recordName,
                            resourceKind: 'search',
                            action: 'list',
                            subjectType: 'user',
                            subjectId: userId,
                        },
                    },
                    headers: apiCorsHeaders,
                });
            });
        });

        it('should return not_authorized if the user does not have access to the record', async () => {
            delete store.roles[recordName];

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/search/collection/list?recordName=${recordName}`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'search',
                        action: 'list',
                        subjectType: 'user',
                        subjectId: userId,
                    },
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return not_supported if the search controller is null', async () => {
            server = new RecordsServer({
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
                policyController,
            });

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/search/collection/list?recordName=${recordName}`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 501,
                body: {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This feature is not supported.',
                },
                headers: apiCorsHeaders,
            });
        });

        testUrl(
            'GET',
            `/api/v2/records/search/collection/list?recordName=${recordName}`,
            () => null,
            () => apiHeaders
        );
    });

    describe('POST /api/v2/records/search/document', () => {
        beforeEach(async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            // Create a search collection first
            await searchRecordsController.recordItem({
                recordKeyOrRecordName: recordName,
                userId,
                instances: [],
                item: {
                    address: 'test-collection',
                    markers: [PUBLIC_READ_MARKER],
                    schema: {
                        '.*': {
                            type: 'auto',
                        },
                    },
                },
            });
        });

        it('should return not_supported if the search controller is null', async () => {
            server = new RecordsServer({
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
                policyController,
            });

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/search/document`,
                    JSON.stringify({
                        recordName,
                        address: 'test-collection',
                        document: {
                            title: 'Test Document',
                            content: 'This is a test document',
                            tags: ['test', 'example'],
                        },
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 501,
                body: {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This feature is not supported.',
                },
                headers: apiCorsHeaders,
            });
        });

        it('should store a document in a search collection', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/search/document`,
                    JSON.stringify({
                        recordName,
                        address: 'test-collection',
                        document: {
                            title: 'Test Document',
                            content: 'This is a test document',
                            tags: ['test', 'example'],
                            score: 95,
                        },
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    id: expect.any(String),
                    title: 'Test Document',
                    content: 'This is a test document',
                    tags: ['test', 'example'],
                    score: 95,
                },
                headers: apiCorsHeaders,
            });

            expect(searchInterface.documents).toEqual([
                [
                    expect.any(String),
                    [
                        {
                            id: '1',
                            title: 'Test Document',
                            content: 'This is a test document',
                            tags: ['test', 'example'],
                            score: 95,
                        },
                    ],
                ],
            ]);
        });

        it('should return not_authorized if the user does not have permission', async () => {
            delete store.roles[recordName];

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/search/document`,
                    JSON.stringify({
                        recordName,
                        address: 'test-collection',
                        document: {
                            title: 'Test Document',
                            content: 'This is a test document',
                        },
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        action: 'update',
                        resourceKind: 'search',
                        resourceId: 'test-collection',
                        subjectType: 'user',
                        subjectId: userId,
                    },
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return data_not_found if the search collection does not exist', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/search/document`,
                    JSON.stringify({
                        recordName,
                        address: 'nonexistent-collection',
                        document: {
                            title: 'Test Document',
                            content: 'This is a test document',
                        },
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 404,
                body: {
                    success: false,
                    errorCode: 'not_found',
                    errorMessage: 'The Search record was not found.',
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return not_logged_in if no session key is provided', async () => {
            delete apiHeaders['authorization'];

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/search/document`,
                    JSON.stringify({
                        recordName,
                        address: 'test-collection',
                        document: {
                            title: 'Test Document',
                            content: 'This is a test document',
                        },
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 401,
                body: {
                    success: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user is not logged in. A session key must be provided for this operation.',
                },
                headers: apiCorsHeaders,
            });
        });

        testUrl(
            'POST',
            '/api/v2/records/search/document',
            () =>
                JSON.stringify({
                    recordName,
                    address: 'test-collection',
                    document: {
                        title: 'Test Document',
                        content: 'This is a test document',
                        tags: ['test', 'example'],
                    },
                }),
            () => apiHeaders
        );
    });

    describe('DELETE /api/v2/records/search/document', () => {
        let collectionName: string;
        let documentId: string;

        beforeEach(async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            // Create a search collection first
            const collectionResult = await searchRecordsController.recordItem({
                recordKeyOrRecordName: recordName,
                userId,
                instances: [],
                item: {
                    address: 'test-collection',
                    markers: [PUBLIC_READ_MARKER],
                    schema: {
                        '.*': {
                            type: 'auto',
                        },
                    },
                },
            });

            if (collectionResult.success === false) {
                throw new Error(
                    'Failed to create item: ' + collectionResult.errorMessage
                );
            }

            const itemResult = await searchRecordsStore.getItemByAddress(
                recordName,
                'test-collection'
            );
            collectionName = itemResult!.collectionName;

            const result = await searchRecordsController.storeDocument({
                recordName,
                address: 'test-collection',
                document: {
                    title: 'Test Document',
                    content: 'This is a test document',
                    tags: ['test', 'example'],
                    score: 95,
                },
                userId,
                instances: [],
            });

            if (isFailure(result)) {
                throw new Error(
                    `Failed to create document: ${result.error.errorMessage}`
                );
            }

            documentId = result.value.id;
        });

        it('should return not_supported if the search controller is null', async () => {
            server = new RecordsServer({
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
                policyController,
            });

            const result = await server.handleHttpRequest(
                httpDelete(
                    `/api/v2/records/search/document`,
                    JSON.stringify({
                        recordName,
                        address: 'test-collection',
                        documentId,
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 501,
                body: {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This feature is not supported.',
                },
                headers: apiCorsHeaders,
            });
        });

        it('should delete a document in a search collection', async () => {
            const result = await server.handleHttpRequest(
                httpDelete(
                    `/api/v2/records/search/document`,
                    JSON.stringify({
                        recordName,
                        address: 'test-collection',
                        documentId,
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    id: '1',
                    score: 95,
                    title: 'Test Document',
                    content: 'This is a test document',
                    tags: ['test', 'example'],
                },
                headers: apiCorsHeaders,
            });

            expect(searchInterface.documents).toEqual([[collectionName, []]]);
        });

        it('should return not_authorized if the user does not have permission', async () => {
            delete store.roles[recordName];

            const result = await server.handleHttpRequest(
                httpDelete(
                    `/api/v2/records/search/document`,
                    JSON.stringify({
                        recordName,
                        address: 'test-collection',
                        documentId,
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        action: 'update',
                        resourceKind: 'search',
                        resourceId: 'test-collection',
                        subjectType: 'user',
                        subjectId: userId,
                    },
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return data_not_found if the search collection does not exist', async () => {
            const result = await server.handleHttpRequest(
                httpDelete(
                    `/api/v2/records/search/document`,
                    JSON.stringify({
                        recordName,
                        address: 'nonexistent-collection',
                        documentId,
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 404,
                body: {
                    success: false,
                    errorCode: 'not_found',
                    errorMessage: 'The Search record was not found.',
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return not_logged_in if no session key is provided', async () => {
            delete apiHeaders['authorization'];

            const result = await server.handleHttpRequest(
                httpDelete(
                    `/api/v2/records/search/document`,
                    JSON.stringify({
                        recordName,
                        address: 'test-collection',
                        documentId,
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 401,
                body: {
                    success: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user is not logged in. A session key must be provided for this operation.',
                },
                headers: apiCorsHeaders,
            });
        });

        testUrl(
            'DELETE',
            '/api/v2/records/search/document',
            () =>
                JSON.stringify({
                    recordName,
                    address: 'test-collection',
                    documentId,
                }),
            () => apiHeaders
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

                await expectResponseBodyToEqual(result, {
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

        describe('?userId', () => {
            beforeEach(async () => {
                const user = await store.findUser(ownerId);
                await store.saveUser({
                    ...user,
                    role: 'superUser',
                });
            });

            it('should return the list of records for the given user if the current user is a super user', async () => {
                const result = await server.handleHttpRequest(
                    httpGet(`/api/v2/records/list?userId=${userId}`, {
                        authorization: `Bearer ${ownerSessionKey}`,
                        origin: apiOrigin,
                    })
                );

                await expectResponseBodyToEqual(result, {
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

            it('should return 403 not_authorized if the current user is not a super user', async () => {
                const result = await server.handleHttpRequest(
                    httpGet(
                        `/api/v2/records/list?userId=${'different'}`,
                        apiHeaders
                    )
                );

                await expectResponseBodyToEqual(result, {
                    statusCode: 403,
                    body: {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'You are not authorized to perform this action.',
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

            await expectResponseBodyToEqual(result, {
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

    describe('POST /api/v2/records/permissions', () => {
        beforeEach(() => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };
        });

        describe('marker', () => {
            it('should grant the given permission to the marker', async () => {
                const result = await server.handleHttpRequest(
                    httpPost(
                        `/api/v2/records/permissions`,
                        JSON.stringify({
                            recordName,
                            permission: {
                                marker: 'test',
                                resourceKind: 'data',
                                action: 'read',
                                subjectType: 'user',
                                subjectId: 'otherUserId',
                                userId: 'otherUserId',
                                expireTimeMs: null,
                            },
                        }),
                        apiHeaders
                    )
                );

                await expectResponseBodyToEqual(result, {
                    statusCode: 200,
                    body: {
                        success: true,
                    },
                    headers: apiCorsHeaders,
                });

                const data = await store.listPermissionsForMarker(
                    recordName,
                    'test'
                );
                expect(data).toEqual([
                    {
                        id: expect.any(String),
                        recordName: recordName,
                        marker: 'test',
                        resourceKind: 'data',
                        action: 'read',
                        subjectType: 'user',
                        subjectId: 'otherUserId',
                        userId: 'otherUserId',
                        expireTimeMs: null,
                    },
                ]);
            });

            it('should deny the request if the user is not authorized', async () => {
                delete store.roles[recordName][userId];

                const result = await server.handleHttpRequest(
                    httpPost(
                        `/api/v2/records/permissions`,
                        JSON.stringify({
                            recordName,
                            permission: {
                                marker: 'test',
                                resourceKind: 'data',
                                action: 'read',
                                subjectType: 'user',
                                subjectId: 'otherUserId',
                                userId: 'otherUserId',
                                expireTimeMs: null,
                            },
                        }),
                        apiHeaders
                    )
                );

                await expectResponseBodyToEqual(result, {
                    statusCode: 403,
                    body: {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'You are not authorized to perform this action.',
                        reason: {
                            type: 'missing_permission',
                            resourceKind: 'marker',
                            resourceId: 'test',
                            action: 'grantPermission',
                            subjectType: 'user',
                            subjectId: userId,
                            recordName: recordName,
                        },
                    },
                    headers: apiCorsHeaders,
                });

                const data = await store.listPermissionsForMarker(
                    recordName,
                    'test'
                );
                expect(data).toEqual([]);
            });

            it('should deny the request if the inst is not authorized', async () => {
                const result = await server.handleHttpRequest(
                    httpPost(
                        `/api/v2/records/permissions`,
                        JSON.stringify({
                            recordName,
                            permission: {
                                marker: 'test',
                                resourceKind: 'data',
                                action: 'read',
                                subjectType: 'user',
                                subjectId: 'otherUserId',
                                userId: 'otherUserId',
                                expireTimeMs: null,
                            },
                            instances: ['inst'],
                        }),
                        apiHeaders
                    )
                );

                await expectResponseBodyToEqual(result, {
                    statusCode: 403,
                    body: {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'You are not authorized to perform this action.',
                        reason: {
                            type: 'missing_permission',
                            resourceKind: 'marker',
                            resourceId: 'test',
                            action: 'grantPermission',
                            subjectType: 'inst',
                            subjectId: '/inst',
                            recordName: recordName,
                        },
                    },
                    headers: apiCorsHeaders,
                });

                const data = await store.listPermissionsForMarker(
                    recordName,
                    'test'
                );
                expect(data).toEqual([]);
            });

            it('should return an unacceptable_request result when given a non-string marker', async () => {
                const result = await server.handleHttpRequest(
                    httpPost(
                        `/api/v2/records/permissions`,
                        JSON.stringify({
                            recordName,
                            permission: {
                                marker: 123,
                                resourceKind: 'data',
                                action: 'read',
                                subjectType: 'user',
                                subjectId: 'otherUserId',
                                userId: 'otherUserId',
                                expireTimeMs: null,
                            },
                        }),
                        apiHeaders
                    )
                );

                await expectResponseBodyToEqual(result, {
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
                                message: 'Expected string, received number',
                                path: ['permission', 'marker'],
                                received: 'number',
                            },
                        ],
                    },
                    headers: apiCorsHeaders,
                });
            });
        });

        describe('resourceId', () => {
            it('should grant the given permission to the resourceId', async () => {
                const result = await server.handleHttpRequest(
                    httpPost(
                        `/api/v2/records/permissions`,
                        JSON.stringify({
                            recordName,
                            permission: {
                                resourceKind: 'data',
                                resourceId: 'test',
                                action: 'read',
                                subjectType: 'user',
                                subjectId: 'otherUserId',
                                userId: 'otherUserId',
                                expireTimeMs: null,
                            },
                        }),
                        apiHeaders
                    )
                );

                await expectResponseBodyToEqual(result, {
                    statusCode: 200,
                    body: {
                        success: true,
                    },
                    headers: apiCorsHeaders,
                });

                const data = await store.listPermissionsForResource(
                    recordName,
                    'data',
                    'test'
                );
                expect(data).toEqual([
                    {
                        id: expect.any(String),
                        recordName: recordName,
                        resourceKind: 'data',
                        resourceId: 'test',
                        action: 'read',
                        subjectType: 'user',
                        subjectId: 'otherUserId',
                        userId: 'otherUserId',
                        expireTimeMs: null,
                    },
                ]);
            });

            it('should deny the request if the user is not authorized', async () => {
                delete store.roles[recordName][userId];

                const result = await server.handleHttpRequest(
                    httpPost(
                        `/api/v2/records/permissions`,
                        JSON.stringify({
                            recordName,
                            permission: {
                                resourceKind: 'data',
                                resourceId: 'test',
                                action: 'read',
                                subjectType: 'user',
                                subjectId: 'otherUserId',
                                userId: 'otherUserId',
                                expireTimeMs: null,
                            },
                        }),
                        apiHeaders
                    )
                );

                await expectResponseBodyToEqual(result, {
                    statusCode: 403,
                    body: {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'You are not authorized to perform this action.',
                        reason: {
                            type: 'missing_permission',
                            resourceKind: 'marker',
                            resourceId: ACCOUNT_MARKER,
                            action: 'grantPermission',
                            subjectType: 'user',
                            subjectId: userId,
                            recordName: recordName,
                        },
                    },
                    headers: apiCorsHeaders,
                });

                const data = await store.listPermissionsForResource(
                    recordName,
                    'data',
                    'test'
                );
                expect(data).toEqual([]);
            });

            it('should deny the request if the inst is not authorized', async () => {
                const result = await server.handleHttpRequest(
                    httpPost(
                        `/api/v2/records/permissions`,
                        JSON.stringify({
                            recordName,
                            permission: {
                                resourceKind: 'data',
                                resourceId: 'test',
                                action: 'read',
                                subjectType: 'user',
                                subjectId: 'otherUserId',
                                userId: 'otherUserId',
                                expireTimeMs: null,
                            },
                            instances: ['inst'],
                        }),
                        apiHeaders
                    )
                );

                await expectResponseBodyToEqual(result, {
                    statusCode: 403,
                    body: {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'You are not authorized to perform this action.',
                        reason: {
                            type: 'missing_permission',
                            resourceKind: 'marker',
                            resourceId: ACCOUNT_MARKER,
                            action: 'grantPermission',
                            subjectType: 'inst',
                            subjectId: '/inst',
                            recordName: recordName,
                        },
                    },
                    headers: apiCorsHeaders,
                });

                const data = await store.listPermissionsForResource(
                    recordName,
                    'data',
                    'test'
                );
                expect(data).toEqual([]);
            });

            it('should return an unacceptable_request result when given a non-string resourceId', async () => {
                const result = await server.handleHttpRequest(
                    httpPost(
                        `/api/v2/records/permissions`,
                        JSON.stringify({
                            recordName,
                            permission: {
                                resourceKind: 'data',
                                resourceId: 123,
                                action: 'read',
                                subjectType: 'user',
                                subjectId: 'otherUserId',
                                userId: 'otherUserId',
                                expireTimeMs: null,
                            },
                        }),
                        apiHeaders
                    )
                );

                await expectResponseBodyToEqual(result, {
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
                                message: 'Expected string, received number',
                                path: ['permission', 'resourceId'],
                                received: 'number',
                            },
                        ],
                    },
                    headers: apiCorsHeaders,
                });
            });
        });

        it('should return an unacceptable_request result when given a non-string recordName', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/permissions`,
                    JSON.stringify({
                        recordName: 123,
                        permission: {
                            marker: 'test',
                            resourceKind: 'data',
                            action: 'read',
                            subjectType: 'user',
                            subjectId: 'otherUserId',
                            userId: 'otherUserId',
                            expireTimeMs: null,
                        },
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
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
                    `/api/v2/records/permissions`,
                    JSON.stringify({
                        recordName,
                        permission: null,
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
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

        testOrigin('POST', `/api/v2/records/permissions`, () =>
            JSON.stringify({
                recordName,
                permission: {
                    marker: 'test',
                    resourceKind: 'data',
                    action: 'read',
                    subjectType: 'user',
                    subjectId: 'otherUserId',
                    userId: 'otherUserId',
                    expireTimeMs: null,
                },
            })
        );
        testAuthorization(
            () =>
                httpPost(
                    '/api/v2/records/permissions',
                    JSON.stringify({
                        recordName,
                        permission: {
                            marker: 'test',
                            resourceKind: 'data',
                            action: 'read',
                            subjectType: 'user',
                            subjectId: 'otherUserId',
                            userId: 'otherUserId',
                            expireTimeMs: null,
                        },
                    }),
                    apiHeaders
                ),
            'The user is not logged in. A session key must be provided for this operation.'
        );
        testBodyIsJson((body) =>
            httpPost(`/api/v2/records/permissions`, body, apiHeaders)
        );
        testRateLimit(() =>
            httpPost(
                `/api/v2/records/permissions`,
                JSON.stringify({
                    recordName,
                    permission: {
                        marker: 'test',
                        resourceKind: 'data',
                        action: 'read',
                        subjectType: 'user',
                        subjectId: 'otherUserId',
                        userId: 'otherUserId',
                        expireTimeMs: null,
                    },
                }),
                defaultHeaders
            )
        );
    });

    describe('POST /api/v2/records/permissions/revoke', () => {
        let markerPermissionId: string;
        let resourcePermissionId: string;

        beforeEach(async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const markerResult =
                (await store.assignPermissionToSubjectAndMarker(
                    recordName,
                    'user',
                    userId,
                    'data',
                    'test',
                    'read',
                    {},
                    null
                )) as AssignPermissionToSubjectAndMarkerSuccess;
            markerPermissionId = markerResult.permissionAssignment.id;

            const resourceResult =
                (await store.assignPermissionToSubjectAndResource(
                    recordName,
                    'user',
                    userId,
                    'data',
                    'test',
                    'read',
                    {},
                    null
                )) as AssignPermissionToSubjectAndResourceSuccess;
            resourcePermissionId = resourceResult.permissionAssignment.id;
        });

        it('should revoke the given permission for the marker', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/permissions/revoke`,
                    JSON.stringify({
                        permissionId: markerPermissionId,
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: apiCorsHeaders,
            });

            const data = await store.listPermissionsForMarker(
                recordName,
                'test'
            );
            expect(data).toEqual([]);
        });

        it('should revoke the given permission for the resource', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/permissions/revoke`,
                    JSON.stringify({
                        permissionId: resourcePermissionId,
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: apiCorsHeaders,
            });

            const data = await store.listPermissionsForResource(
                recordName,
                'data',
                'test'
            );
            expect(data).toEqual([]);
        });

        it('should deny the request if the user is not authorized', async () => {
            delete store.roles[recordName][userId];

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/permissions/revoke`,
                    JSON.stringify({
                        permissionId: markerPermissionId,
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'marker',
                        resourceId: 'test',
                        action: 'revokePermission',
                        subjectType: 'user',
                        subjectId: userId,
                    },
                },
                headers: apiCorsHeaders,
            });

            const data = await store.listPermissionsForMarker(
                recordName,
                'test'
            );
            expect(data).toHaveLength(1);
        });

        testUrl(
            'POST',
            `/api/v2/records/permissions/revoke`,
            () =>
                JSON.stringify({
                    permissionId: markerPermissionId,
                }),
            () => apiHeaders
        );
    });

    describe('GET /api/v2/records/permissions/list', () => {
        beforeEach(async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            await store.assignPermissionToSubjectAndMarker(
                recordName,
                'role',
                'developer',
                'data',
                'test',
                'read',
                {},
                null
            );
            await store.assignPermissionToSubjectAndMarker(
                recordName,
                'role',
                'developer',
                'data',
                'test2',
                'create',
                {},
                null
            );
            await store.assignPermissionToSubjectAndMarker(
                recordName,
                'role',
                'developer',
                'file',
                'abc',
                'create',
                {},
                null
            );
            await store.assignPermissionToSubjectAndResource(
                recordName,
                'user',
                userId,
                'file',
                'fileName',
                'read',
                {},
                null
            );
        });

        it('should list the permissions in the record', async () => {
            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/permissions/list?recordName=${recordName}`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    recordName,
                    resourcePermissions: [
                        {
                            id: expect.any(String),
                            recordName: recordName,
                            resourceKind: 'file',
                            resourceId: 'fileName',
                            action: 'read',
                            subjectType: 'user',
                            subjectId: userId,
                            options: {},
                            expireTimeMs: null,
                        },
                    ],
                    markerPermissions: [
                        {
                            id: expect.any(String),
                            marker: 'test',
                            recordName: recordName,
                            resourceKind: 'data',
                            action: 'read',
                            subjectType: 'role',
                            subjectId: 'developer',
                            options: {},
                            expireTimeMs: null,
                        },
                        {
                            id: expect.any(String),
                            marker: 'test2',
                            recordName: recordName,
                            resourceKind: 'data',
                            action: 'create',
                            subjectType: 'role',
                            subjectId: 'developer',
                            options: {},
                            expireTimeMs: null,
                        },
                        {
                            id: expect.any(String),
                            marker: 'abc',
                            recordName: recordName,
                            resourceKind: 'file',
                            action: 'create',
                            subjectType: 'role',
                            subjectId: 'developer',
                            options: {},
                            expireTimeMs: null,
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return a 403 not_authorized result when the user is not authorized', async () => {
            delete store.roles[recordName][userId];

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/permissions/list?recordName=${recordName}`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'marker',
                        action: 'list',
                        subjectType: 'user',
                        subjectId: userId,
                    },
                },
                headers: apiCorsHeaders,
            });
        });

        describe('?marker', () => {
            it('should list the permissions for the given marker', async () => {
                const result = await server.handleHttpRequest(
                    httpGet(
                        `/api/v2/records/permissions/list?recordName=${recordName}&marker=test`,
                        apiHeaders
                    )
                );

                await expectResponseBodyToEqual(result, {
                    statusCode: 200,
                    body: {
                        success: true,
                        recordName,
                        markerPermissions: [
                            {
                                id: expect.any(String),
                                marker: 'test',
                                recordName: recordName,
                                resourceKind: 'data',
                                action: 'read',
                                subjectType: 'role',
                                subjectId: 'developer',
                                options: {},
                                expireTimeMs: null,
                            },
                        ],
                    },
                    headers: apiCorsHeaders,
                });
            });
        });

        describe('?resourceKind&resourceId', () => {
            it('should list the permissions for the given resource', async () => {
                const result = await server.handleHttpRequest(
                    httpGet(
                        `/api/v2/records/permissions/list?recordName=${recordName}&resourceKind=file&resourceId=fileName`,
                        apiHeaders
                    )
                );

                await expectResponseBodyToEqual(result, {
                    statusCode: 200,
                    body: {
                        success: true,
                        recordName,
                        resourcePermissions: [
                            {
                                id: expect.any(String),
                                recordName: recordName,
                                resourceKind: 'file',
                                resourceId: 'fileName',
                                action: 'read',
                                subjectType: 'user',
                                subjectId: userId,
                                options: {},
                                expireTimeMs: null,
                            },
                        ],
                    },
                    headers: apiCorsHeaders,
                });
            });
        });

        testOrigin(
            'GET',
            `/api/v2/records/permissions/list?recordName=${recordName}`
        );
        testRateLimit(() =>
            httpGet(
                `/api/v2/records/permissions/list?recordName=${recordName}`,
                apiHeaders
            )
        );
        testAuthorization(() =>
            httpGet(
                `/api/v2/records/permissions/list?recordName=${recordName}`,
                apiHeaders
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'role',
                        action: 'list',
                        subjectType: 'user',
                        subjectId: userId,
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

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'role',
                        action: 'list',
                        subjectType: 'inst',
                        subjectId: '/inst',
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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
                ['/testId']: [
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'role',
                        action: 'list',
                        subjectType: 'user',
                        subjectId: userId,
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

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'role',
                        action: 'list',
                        subjectType: 'inst',
                        subjectId: '/inst',
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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
        testAuthorization(() =>
            httpGet(
                `/api/v2/records/role/inst/list?recordName=${recordName}&inst=${'testId'}`,
                apiHeaders
            )
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'role',
                        action: 'list',
                        subjectType: 'user',
                        subjectId: userId,
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

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'role',
                        action: 'list',
                        subjectType: 'inst',
                        subjectId: '/inst',
                    },
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return an unacceptable_request result when not given a recordName', async () => {
            const result = await server.handleHttpRequest(
                httpGet(`/api/v2/records/role/assignments/list`, apiHeaders)
            );

            await expectResponseBodyToEqual(result, {
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

                await expectResponseBodyToEqual(result, {
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

                await expectResponseBodyToEqual(result, {
                    statusCode: 403,
                    body: {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'You are not authorized to perform this action.',
                        reason: {
                            type: 'missing_permission',
                            recordName,
                            resourceKind: 'role',
                            action: 'list',
                            subjectType: 'user',
                            subjectId: userId,
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

                await expectResponseBodyToEqual(result, {
                    statusCode: 403,
                    body: {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'You are not authorized to perform this action.',
                        reason: {
                            type: 'missing_permission',
                            recordName,
                            resourceKind: 'role',
                            action: 'list',
                            subjectType: 'inst',
                            subjectId: '/inst',
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

                await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: apiCorsHeaders,
            });

            const roles = await store.listRolesForInst(recordName, '/testId');

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

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'role',
                        resourceId: 'role1',
                        action: 'grant',
                        subjectType: 'user',
                        subjectId: userId,
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

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'role',
                        resourceId: 'role1',
                        action: 'grant',
                        subjectType: 'inst',
                        subjectId: '/inst',
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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
                ['/testId']: [
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'role',
                        resourceId: 'role1',
                        action: 'revoke',
                        subjectType: 'user',
                        subjectId: userId,
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

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'role',
                        resourceId: 'role1',
                        action: 'revoke',
                        subjectType: 'inst',
                        subjectId: '/inst',
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

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: apiCorsHeaders,
            });

            const roles = await store.listRolesForInst(recordName, '/testId');

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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

    describe('GET /api/v2/records/entitlement/grants/list', () => {
        beforeEach(async () => {
            await packageStore.createItem(recordName, {
                id: 'packageId',
                address: 'address',
                markers: [PUBLIC_READ_MARKER],
            });

            await packageVersionsStore.createItem(recordName, {
                id: `packageVersionId`,
                address: 'address',
                key: {
                    major: 1,
                    minor: 0,
                    patch: 0,
                    tag: '',
                },
                auxFileName: 'test.aux',
                auxSha256: 'auxSha256',
                sizeInBytes: 123,
                createdAtMs: 999,
                createdFile: true,
                entitlements: [],
                description: '',
                requiresReview: false,
                sha256: 'sha256',
                markers: [PUBLIC_READ_MARKER],
            });

            await store.saveGrantedPackageEntitlement({
                id: 'grantId',
                userId: userId,
                recordName,
                packageId: 'packageId',
                feature: 'data',
                scope: 'designated',
                expireTimeMs: Date.now() + 1000 * 60,
                revokeTimeMs: null,
                createdAtMs: Date.now(),
            });

            await store.saveGrantedPackageEntitlement({
                id: 'grantId2',
                userId: userId,
                recordName,
                packageId: 'packageId',
                feature: 'file',
                scope: 'designated',
                expireTimeMs: Date.now() + 1000 * 60,
                revokeTimeMs: null,
                createdAtMs: Date.now(),
            });

            await store.saveGrantedPackageEntitlement({
                id: 'grantId3',
                userId: userId,
                recordName,
                packageId: 'packageId2',
                feature: 'file',
                scope: 'designated',
                expireTimeMs: Date.now() + 1000 * 60,
                revokeTimeMs: null,
                createdAtMs: Date.now(),
            });
        });

        it('should return the list of grants for a package and user', async () => {
            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/entitlement/grants/list?packageId=${'packageId'}`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    grants: [
                        {
                            id: 'grantId',
                            userId: userId,
                            recordName,
                            packageId: 'packageId',
                            feature: 'data',
                            scope: 'designated',
                            expireTimeMs: expect.any(Number),
                            revokeTimeMs: null,
                            createdAtMs: expect.any(Number),
                        },
                        {
                            id: 'grantId2',
                            userId: userId,
                            recordName,
                            packageId: 'packageId',
                            feature: 'file',
                            scope: 'designated',
                            expireTimeMs: expect.any(Number),
                            revokeTimeMs: null,
                            createdAtMs: expect.any(Number),
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return the list of grants for the user', async () => {
            const result = await server.handleHttpRequest(
                httpGet(`/api/v2/records/entitlement/grants/list`, apiHeaders)
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    grants: [
                        {
                            id: 'grantId',
                            userId: userId,
                            recordName,
                            packageId: 'packageId',
                            feature: 'data',
                            scope: 'designated',
                            expireTimeMs: expect.any(Number),
                            revokeTimeMs: null,
                            createdAtMs: expect.any(Number),
                        },
                        {
                            id: 'grantId2',
                            userId: userId,
                            recordName,
                            packageId: 'packageId',
                            feature: 'file',
                            scope: 'designated',
                            expireTimeMs: expect.any(Number),
                            revokeTimeMs: null,
                            createdAtMs: expect.any(Number),
                        },
                        {
                            id: 'grantId3',
                            userId: userId,
                            recordName,
                            packageId: 'packageId2',
                            feature: 'file',
                            scope: 'designated',
                            expireTimeMs: expect.any(Number),
                            revokeTimeMs: null,
                            createdAtMs: expect.any(Number),
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return 401 not_logged_in if the user is not logged in', async () => {
            delete apiHeaders['authorization'];

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/entitlement/grants/list?packageId=${'packageId'}`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 401,
                body: {
                    success: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user is not logged in. A session key must be provided for this operation.',
                },
                headers: apiCorsHeaders,
            });
        });

        testOrigin(
            'GET',
            `/api/v2/records/entitlement/grants/list?packageId=${'packageId'}`
        );
        testRateLimit(() =>
            httpGet(
                `/api/v2/records/entitlement/grants/list?packageId=${'packageId'}`,
                apiHeaders
            )
        );
        testAuthorization(() =>
            httpGet(
                `/api/v2/records/entitlement/grants/list?packageId=${'packageId'}`,
                apiHeaders
            )
        );
    });

    describe('POST /api/v2/records/entitlement/grants', () => {
        beforeEach(async () => {
            await packageStore.createItem(recordName, {
                id: 'packageId',
                address: 'address',
                markers: [PUBLIC_READ_MARKER],
            });

            await packageVersionsStore.createItem(recordName, {
                id: `packageVersionId`,
                address: 'address',
                key: {
                    major: 1,
                    minor: 0,
                    patch: 0,
                    tag: '',
                },
                auxFileName: 'test.aux',
                auxSha256: 'auxSha256',
                sizeInBytes: 123,
                createdAtMs: 999,
                createdFile: true,
                entitlements: [],
                description: '',
                requiresReview: false,
                sha256: 'sha256',
                markers: [PUBLIC_READ_MARKER],
            });
        });

        it('should save the given entitlement grant', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/entitlement/grants`,
                    JSON.stringify({
                        packageId: 'packageId',
                        recordName,
                        feature: 'data',
                        scope: 'designated',
                        expireTimeMs: Date.now() + 1000 * 60,
                    }),
                    apiHeaders
                )
            );

            const { grantId } = await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    feature: 'data',
                    grantId: expect.any(String),
                },
                headers: apiCorsHeaders,
            });

            expect(store.grantedPackageEntitlements).toEqual([
                {
                    id: grantId,
                    packageId: 'packageId',
                    userId,
                    recordName,
                    feature: 'data',
                    scope: 'designated',
                    expireTimeMs: expect.any(Number),
                    createdAtMs: expect.any(Number),
                    revokeTimeMs: null,
                },
            ]);
        });

        it('should save the entitlement grant for the given user if the current user is a super user', async () => {
            const owner = await store.findUser(ownerId);
            await store.saveUser({
                ...owner,
                role: 'superUser',
            });

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/entitlement/grants`,
                    JSON.stringify({
                        packageId: 'packageId',
                        userId,
                        recordName,
                        feature: 'data',
                        scope: 'designated',
                        expireTimeMs: Date.now() + 1000 * 60,
                    }),
                    {
                        ...apiHeaders,
                        authorization: `Bearer ${ownerSessionKey}`,
                    }
                )
            );

            const { grantId } = await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    feature: 'data',
                    grantId: expect.any(String),
                },
                headers: apiCorsHeaders,
            });

            expect(store.grantedPackageEntitlements).toEqual([
                {
                    id: grantId,
                    packageId: 'packageId',
                    userId,
                    recordName,
                    feature: 'data',
                    scope: 'designated',
                    expireTimeMs: expect.any(Number),
                    createdAtMs: expect.any(Number),
                    revokeTimeMs: null,
                },
            ]);
        });

        it('should return not_authorized if the user isnt a super user and trying to grant an entitlement for someone else', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/entitlement/grants`,
                    JSON.stringify({
                        packageId: 'packageId',
                        userId,
                        recordName,
                        feature: 'data',
                        scope: 'designated',
                        expireTimeMs: Date.now() + 1000 * 60,
                    }),
                    {
                        ...apiHeaders,
                        authorization: `Bearer ${ownerSessionKey}`,
                    }
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                },
                headers: apiCorsHeaders,
            });

            expect(store.grantedPackageEntitlements).toEqual([]);
        });

        testUrl(
            'POST',
            '/api/v2/records/entitlement/grants',
            () =>
                JSON.stringify({
                    packageId: 'packageId',
                    userId,
                    recordName,
                    feature: 'data',
                    scope: 'designated',
                    expireTimeMs: Date.now() + 1000 * 60,
                }),
            () => apiHeaders
        );
    });

    describe('POST /api/v2/records/entitlement/revoke', () => {
        beforeEach(async () => {
            await packageStore.createItem(recordName, {
                id: 'packageId',
                address: 'address',
                markers: [PUBLIC_READ_MARKER],
            });

            await packageVersionsStore.createItem(recordName, {
                id: `packageVersionId`,
                address: 'address',
                key: {
                    major: 1,
                    minor: 0,
                    patch: 0,
                    tag: '',
                },
                auxFileName: 'test.aux',
                auxSha256: 'auxSha256',
                sizeInBytes: 123,
                createdAtMs: 999,
                createdFile: true,
                entitlements: [],
                description: '',
                requiresReview: false,
                sha256: 'sha256',
                markers: [PUBLIC_READ_MARKER],
            });

            await store.saveGrantedPackageEntitlement({
                id: 'grantId',
                userId: userId,
                recordName,
                packageId: 'packageId',
                feature: 'data',
                scope: 'designated',
                expireTimeMs: Date.now() + 1000 * 60,
                revokeTimeMs: null,
                createdAtMs: Date.now(),
            });

            await store.saveGrantedPackageEntitlement({
                id: 'grantId2',
                userId: userId,
                recordName,
                packageId: 'packageId',
                feature: 'file',
                scope: 'designated',
                expireTimeMs: Date.now() + 1000 * 60,
                revokeTimeMs: null,
                createdAtMs: Date.now(),
            });
        });

        it('should revoke the given entitlement grant', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/entitlement/revoke`,
                    JSON.stringify({
                        grantId: 'grantId',
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: apiCorsHeaders,
            });

            expect(store.grantedPackageEntitlements).toEqual([
                {
                    id: 'grantId',
                    userId: userId,
                    recordName,
                    packageId: 'packageId',
                    feature: 'data',
                    scope: 'designated',
                    expireTimeMs: expect.any(Number),
                    revokeTimeMs: expect.any(Number),
                    createdAtMs: expect.any(Number),
                },
                {
                    id: 'grantId2',
                    userId: userId,
                    recordName,
                    packageId: 'packageId',
                    feature: 'file',
                    scope: 'designated',
                    expireTimeMs: expect.any(Number),
                    revokeTimeMs: null,
                    createdAtMs: expect.any(Number),
                },
            ]);
        });

        it('should revoke the grant for other users if the current user is a super user', async () => {
            const owner = await store.findUser(ownerId);
            await store.saveUser({
                ...owner,
                role: 'superUser',
            });

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/entitlement/revoke`,
                    JSON.stringify({
                        grantId: 'grantId',
                    }),
                    {
                        ...apiHeaders,
                        authorization: `Bearer ${ownerSessionKey}`,
                    }
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: apiCorsHeaders,
            });

            expect(store.grantedPackageEntitlements).toEqual([
                {
                    id: 'grantId',
                    userId: userId,
                    recordName,
                    packageId: 'packageId',
                    feature: 'data',
                    scope: 'designated',
                    expireTimeMs: expect.any(Number),
                    revokeTimeMs: expect.any(Number),
                    createdAtMs: expect.any(Number),
                },
                {
                    id: 'grantId2',
                    userId: userId,
                    recordName,
                    packageId: 'packageId',
                    feature: 'file',
                    scope: 'designated',
                    expireTimeMs: expect.any(Number),
                    revokeTimeMs: null,
                    createdAtMs: expect.any(Number),
                },
            ]);
        });

        it('should return not_authorized if the user is trying to revoke a grant for someone else', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/records/entitlement/revoke`,
                    JSON.stringify({
                        grantId: 'grantId',
                    }),
                    {
                        ...apiHeaders,
                        authorization: `Bearer ${ownerSessionKey}`,
                    }
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                },
                headers: apiCorsHeaders,
            });

            expect(store.grantedPackageEntitlements).toEqual([
                {
                    id: 'grantId',
                    userId: userId,
                    recordName,
                    packageId: 'packageId',
                    feature: 'data',
                    scope: 'designated',
                    expireTimeMs: expect.any(Number),
                    revokeTimeMs: null,
                    createdAtMs: expect.any(Number),
                },
                {
                    id: 'grantId2',
                    userId: userId,
                    recordName,
                    packageId: 'packageId',
                    feature: 'file',
                    scope: 'designated',
                    expireTimeMs: expect.any(Number),
                    revokeTimeMs: null,
                    createdAtMs: expect.any(Number),
                },
            ]);
        });

        testUrl(
            'POST',
            '/api/v2/records/entitlement/revoke',
            () =>
                JSON.stringify({
                    grantId: 'grantId',
                }),
            () => apiHeaders
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
                markers: [PUBLIC_READ_MARKER],
            });
            await store.saveInst({
                recordName,
                inst: inst2,
                markers: [PUBLIC_READ_MARKER],
            });
            await store.saveInst({
                recordName,
                inst: inst3,
                markers: [PUBLIC_READ_MARKER],
            });
        });

        it('should not_supported if the server has a null Websocket Controller', async () => {
            server = new RecordsServer({
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
                policyController,
            });

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/insts/list?recordName=${recordName}`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    insts: [
                        {
                            inst: inst1,
                            markers: [PUBLIC_READ_MARKER],
                            recordName,
                        },
                        {
                            inst: inst2,
                            markers: [PUBLIC_READ_MARKER],
                            recordName,
                        },
                        {
                            inst: inst3,
                            markers: [PUBLIC_READ_MARKER],
                            recordName,
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

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    insts: [],
                    totalCount: 0,
                },
                headers: corsHeaders(apiHeaders['origin']),
            });
        });

        // TODO: Requires the ability to list insts by marker
        it.skip('should return only the insts that the user has access to', async () => {
            await store.assignPermissionToSubjectAndMarker(
                recordName,
                'role',
                'developer',
                'inst',
                PUBLIC_READ_MARKER,
                'list',
                {},
                null
            );
            store.roles[recordName] = {
                [userId]: new Set(['developer']),
            };

            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/insts/list?recordName=${recordName}`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    insts: [
                        {
                            inst: inst1,
                            markers: [PUBLIC_READ_MARKER],
                        },
                        {
                            inst: inst2,
                            markers: [PUBLIC_READ_MARKER],
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

        it('should return 403 not_authorized if the user does not have access to the account marker', async () => {
            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/records/insts/list?recordName=${recordName}`,
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'inst',
                        action: 'list',
                        subjectType: 'user',
                        subjectId: userId,
                    },
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'inst',
                        resourceId: inst,
                        action: 'delete',
                        subjectType: 'user',
                        subjectId: userId,
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

    describe('POST /api/v2/records/insts/report', () => {
        beforeEach(() => {
            store.moderationConfiguration = {
                allowUnauthenticatedReports: false,
            };
        });

        it('should return a 200 status code if the report is successfully submitted', async () => {
            store.moderationConfiguration = {
                allowUnauthenticatedReports: true,
            };

            const result = await server.handleHttpRequest(
                httpPost(
                    '/api/v2/records/insts/report',
                    JSON.stringify({
                        recordName: null,
                        inst: 'myInst',
                        reportReason: 'spam',
                        reportReasonText: 'This is spam',
                        reportedUrl: 'https://example.com',
                        reportedPermalink: 'https://example.com',
                        automaticReport: false,
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    id: expect.any(String),
                },
                headers: apiCorsHeaders,
            });

            expect(store.userInstReports).toEqual([
                {
                    id: expect.any(String),
                    recordName: null,
                    inst: 'myInst',
                    reportReason: 'spam',
                    reportReasonText: 'This is spam',
                    reportedUrl: 'https://example.com',
                    reportedPermalink: 'https://example.com',
                    automaticReport: false,
                    reportingIpAddress: '123.456.789',
                    reportingUserId: userId,
                    createdAtMs: expect.any(Number),
                    updatedAtMs: expect.any(Number),
                },
            ]);
        });

        it('should return a 501 status code if moderation is disabled', async () => {
            store.moderationConfiguration = null;

            const result = await server.handleHttpRequest(
                httpPost(
                    '/api/v2/records/insts/report',
                    JSON.stringify({
                        recordName: null,
                        inst: 'myInst',
                        reportReason: 'spam',
                        reportReasonText: 'This is spam',
                        reportedUrl: 'https://example.com',
                        reportedPermalink: 'https://example.com',
                        automaticReport: false,
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 501,
                body: {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This operation is not supported.',
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return a 400 status code if unauthenticated reports are not allowed', async () => {
            store.moderationConfiguration = {
                allowUnauthenticatedReports: false,
            };

            delete apiHeaders['authorization'];

            const result = await server.handleHttpRequest(
                httpPost(
                    '/api/v2/records/insts/report',
                    JSON.stringify({
                        recordName: null,
                        inst: 'myInst',
                        reportReason: 'spam',
                        reportReasonText: 'This is spam',
                        reportedUrl: 'https://example.com',
                        reportedPermalink: 'https://example.com',
                        automaticReport: false,
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 401,
                body: {
                    success: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in to report an inst.',
                },
                headers: apiCorsHeaders,
            });
        });

        it('should support unauthenticated reports', async () => {
            store.moderationConfiguration = {
                allowUnauthenticatedReports: true,
            };

            delete apiHeaders['authorization'];

            const result = await server.handleHttpRequest(
                httpPost(
                    '/api/v2/records/insts/report',
                    JSON.stringify({
                        recordName: null,
                        inst: 'myInst',
                        reportReason: 'spam',
                        reportReasonText: 'This is spam',
                        reportedUrl: 'https://example.com',
                        reportedPermalink: 'https://example.com',
                        automaticReport: false,
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    id: expect.any(String),
                },
                headers: apiCorsHeaders,
            });

            expect(store.userInstReports).toEqual([
                {
                    id: expect.any(String),
                    recordName: null,
                    inst: 'myInst',
                    reportReason: 'spam',
                    reportReasonText: 'This is spam',
                    reportedUrl: 'https://example.com',
                    reportedPermalink: 'https://example.com',
                    automaticReport: false,
                    reportingIpAddress: '123.456.789',
                    reportingUserId: null,
                    createdAtMs: expect.any(Number),
                    updatedAtMs: expect.any(Number),
                },
            ]);
        });

        testOrigin('POST', '/api/v2/records/insts/report', () =>
            JSON.stringify({
                recordName: null,
                inst: 'myInst',
                reportReason: 'spam',
                reportReasonText: 'This is spam',
                reportedUrl: 'https://example.com',
                reportedPermalink: 'https://example.com',
                automaticReport: false,
            })
        );
        testBodyIsJson((body) =>
            httpPost('/api/v2/records/insts/report', body, apiHeaders)
        );
        testRateLimit(() =>
            httpPost(
                '/api/v2/records/insts/report',
                JSON.stringify({
                    recordName: null,
                    inst: 'myInst',
                    reportReason: 'spam',
                    reportReasonText: 'This is spam',
                    reportedUrl: 'https://example.com',
                    reportedPermalink: 'https://example.com',
                    automaticReport: false,
                }),
                apiHeaders
            )
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
            server = new RecordsServer({
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
                policyController,
            });

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

            await expectResponseBodyToEqual(result, {
                statusCode: 501,
                body: {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage:
                        'AI features are not supported by this server.',
                },
                headers: {
                    ...apiCorsHeaders,
                },
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

    describe('POST /api/v2/ai/chat/stream', () => {
        beforeEach(async () => {
            const u = await store.findUser(userId);
            await store.saveUser({
                ...u,
                subscriptionId: 'sub_id',
                subscriptionStatus: 'active',
            });

            chatInterface.chatStream.mockReturnValueOnce(
                asyncIterable([
                    Promise.resolve({
                        choices: [
                            {
                                role: 'assistant',
                                content: 'hi!',
                            },
                        ],
                        totalTokens: 0,
                    }),
                ])
            );
        });

        it('should return a not_supported result if the server has a null AI controller', async () => {
            server = new RecordsServer({
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
                policyController,
            });

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/ai/chat/stream`,
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

            await await expectResponseBodyToEqual(result, {
                statusCode: 501,
                body: {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage:
                        'AI features are not supported by this server.',
                },
                headers: {
                    ...apiCorsHeaders,
                },
            });
        });

        it('should call the AI chat interface', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/ai/chat/stream`,
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

            await await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: [
                    {
                        choices: [
                            {
                                role: 'assistant',
                                content: 'hi!',
                            },
                        ],
                    },
                    {
                        success: true,
                    },
                ],
                headers: {
                    ...apiCorsHeaders,
                    'content-type': 'application/x-ndjson',
                },
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
                    `/api/v2/ai/chat/stream`,
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

            await await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: [
                    {
                        choices: [
                            {
                                role: 'assistant',
                                content: 'hi!',
                            },
                        ],
                    },
                    {
                        success: true,
                    },
                ],
                headers: {
                    ...apiCorsHeaders,
                    'content-type': 'application/x-ndjson',
                },
            });
            expect(chatInterface.chatStream).toHaveBeenCalledWith({
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

        testOrigin('POST', `/api/v2/ai/chat/stream`, () =>
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
                `/api/v2/ai/chat/stream`,
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
                `/api/v2/ai/chat/stream`,
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
            server = new RecordsServer({
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
                policyController,
            });

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/ai/skybox`,
                    JSON.stringify({
                        prompt: 'a blue sky',
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

        it('should return a unacceptable_request result if given a prompt over 600 characters long', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/ai/skybox`,
                    JSON.stringify({
                        prompt: 'a'.repeat(601),
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

            await expectResponseBodyToEqual(result, {
                statusCode: 400,
                body: {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage:
                        'The request was invalid. One or more fields were invalid.',
                    issues: [
                        {
                            code: 'too_big',
                            exact: false,
                            inclusive: true,
                            maximum: 600,
                            message:
                                'String must contain at most 600 character(s)',
                            path: ['prompt'],
                            type: 'string',
                        },
                    ],
                },
                headers: apiCorsHeaders,
            });
            expect(skyboxInterface.generateSkybox).not.toHaveBeenCalled();
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
            server = new RecordsServer({
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
                policyController,
            });

            const result = await server.handleHttpRequest(
                httpGet(`/api/v2/ai/skybox?skyboxId=id`, apiHeaders)
            );

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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
                success: true,
                images: [
                    {
                        base64: 'base64',
                        mimeType: 'image/png',
                    },
                ],
            });
        });

        it('should return a not_supported result if the server has a null AI controller', async () => {
            server = new RecordsServer({
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
                policyController,
            });

            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/ai/image`,
                    JSON.stringify({
                        prompt: 'a blue sky',
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

    describe('GET /api/v2/ai/hume/token', () => {
        beforeEach(async () => {
            const u = await store.findUser(userId);
            await store.saveUser({
                ...u,
                subscriptionId: 'sub_id',
                subscriptionStatus: 'active',
            });

            humeInterface.getAccessToken.mockResolvedValueOnce({
                success: true,
                accessToken: 'token',
                expiresIn: 3600,
                issuedAt: 1234567890,
                tokenType: 'Bearer',
            });
        });

        it('should be able to retrive a token that can be used to access Hume', async () => {
            const result = await server.handleHttpRequest(
                httpGet(`/api/v2/ai/hume/token`, apiHeaders)
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    accessToken: 'token',
                    expiresIn: 3600,
                    issuedAt: 1234567890,
                    tokenType: 'Bearer',
                },
                headers: apiCorsHeaders,
            });
            expect(humeInterface.getAccessToken).toHaveBeenCalledWith({
                apiKey: 'globalApiKey',
                secretKey: 'globalSecretKey',
            });
        });

        describe('studio', () => {
            const studioId = 'studioId';

            beforeEach(async () => {
                await store.createStudioForUser(
                    {
                        id: studioId,
                        displayName: 'myStudio',
                        subscriptionId: 'sub1',
                        subscriptionStatus: 'active',
                    },
                    userId
                );

                await store.updateStudioHumeConfig(studioId, {
                    apiKey: 'apiKey',
                    secretKey: 'secretKey',
                });
            });

            it('should be able to use a studios hume token', async () => {
                const result = await server.handleHttpRequest(
                    httpGet(
                        `/api/v2/ai/hume/token?recordName=${studioId}`,
                        apiHeaders
                    )
                );

                await expectResponseBodyToEqual(result, {
                    statusCode: 200,
                    body: {
                        success: true,
                        accessToken: 'token',
                        expiresIn: 3600,
                        issuedAt: 1234567890,
                        tokenType: 'Bearer',
                    },
                    headers: apiCorsHeaders,
                });
                expect(humeInterface.getAccessToken).toHaveBeenCalledWith({
                    apiKey: 'apiKey',
                    secretKey: 'secretKey',
                });
            });
        });

        testOrigin('GET', `/api/v2/ai/hume/token`, () =>
            JSON.stringify({
                prompt: 'test',
            })
        );
        testAuthorization(() => httpGet(`/api/v2/ai/hume/token`, apiHeaders));
        testRateLimit(() => httpGet(`/api/v2/ai/hume/token`, apiHeaders));
    });

    describe('POST /api/v2/ai/sloyd/model', () => {
        beforeEach(async () => {
            const u = await store.findUser(userId);
            await store.saveUser({
                ...u,
                subscriptionId: 'sub_id',
                subscriptionStatus: 'active',
            });

            sloydInterface.createModel.mockResolvedValueOnce({
                success: true,
                name: 'model-1',
                confidenceScore: 0.5,
                interactionId: 'model-1',
                modelMimeType: 'model/gltf+json',
                modelData: 'json',
            });
            sloydInterface.editModel.mockResolvedValueOnce({
                success: true,
                // confidenceScore: 0.5,
                interactionId: 'model-2',
                modelMimeType: 'model/gltf+json',
                modelData: 'json',
            });
        });

        it('should be able to call the sloyd interface to create a model', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/ai/sloyd/model`,
                    JSON.stringify({
                        recordName: userId,
                        prompt: 'a blue sky',
                        outputMimeType: 'model/gltf+json',
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    modelId: 'model-1',
                    mimeType: 'model/gltf+json',
                    confidence: 0.5,
                    name: 'model-1',
                    modelData: 'json',
                },
                headers: apiCorsHeaders,
            });

            expect(sloydInterface.createModel).toHaveBeenCalledWith({
                prompt: 'a blue sky',
                modelMimeType: 'model/gltf+json',
            });
        });

        it('should use the user record if no record name is specified', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/ai/sloyd/model`,
                    JSON.stringify({
                        prompt: 'a blue sky',
                        outputMimeType: 'model/gltf+json',
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    modelId: 'model-1',
                    mimeType: 'model/gltf+json',
                    confidence: 0.5,
                    name: 'model-1',
                    modelData: 'json',
                },
                headers: apiCorsHeaders,
            });

            expect(sloydInterface.createModel).toHaveBeenCalledWith({
                prompt: 'a blue sky',
                modelMimeType: 'model/gltf+json',
            });
        });

        it('should default outputMimeType to gltf+json', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/ai/sloyd/model`,
                    JSON.stringify({
                        recordName: userId,
                        prompt: 'a blue sky',
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    modelId: 'model-1',
                    mimeType: 'model/gltf+json',
                    confidence: 0.5,
                    name: 'model-1',
                    modelData: 'json',
                },
                headers: apiCorsHeaders,
            });

            expect(sloydInterface.createModel).toHaveBeenCalledWith({
                prompt: 'a blue sky',
                modelMimeType: 'model/gltf+json',
            });
        });

        it('should be able to include additional options', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/ai/sloyd/model`,
                    JSON.stringify({
                        recordName: userId,
                        prompt: 'a blue sky',
                        outputMimeType: 'model/gltf+json',
                        levelOfDetail: 1,
                        thumbnail: {
                            type: 'image/png',
                            width: 64,
                            height: 64,
                        },
                        baseModelId: 'model-5',
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    modelId: 'model-2',
                    mimeType: 'model/gltf+json',
                    modelData: 'json',
                },
                headers: apiCorsHeaders,
            });

            expect(sloydInterface.editModel).toHaveBeenCalledWith({
                interactionId: 'model-5',
                prompt: 'a blue sky',
                modelMimeType: 'model/gltf+json',
                levelOfDetail: 1,
                thumbnailPreviewExportType: 'image/png',
                thumbnailPreviewSizeX: 64,
                thumbnailPreviewSizeY: 64,
            });
        });

        testOrigin('POST', `/api/v2/ai/sloyd/model`, () =>
            JSON.stringify({
                recordName: userId,
                prompt: 'a blue sky',
                outputMimeType: 'model/gltf+json',
            })
        );
        testAuthorization(() =>
            httpPost(
                `/api/v2/ai/sloyd/model`,
                JSON.stringify({
                    recordName: userId,
                    prompt: 'a blue sky',
                    outputMimeType: 'model/gltf+json',
                }),
                apiHeaders
            )
        );
        testRateLimit(() =>
            httpPost(
                `/api/v2/ai/sloyd/model`,
                JSON.stringify({
                    recordName: userId,
                    prompt: 'a blue sky',
                    outputMimeType: 'model/gltf+json',
                }),
                apiHeaders
            )
        );
    });

    describe('POST /api/v2/ai/openai/realtime/session', () => {
        beforeEach(async () => {
            const u = await store.findUser(userId);
            await store.saveUser({
                ...u,
                subscriptionId: 'sub_id',
                subscriptionStatus: 'active',
            });

            realtimeInterface.createRealtimeSessionToken.mockResolvedValueOnce({
                success: true,
                sessionId: 'sessionId',
                clientSecret: {
                    value: 'secret',
                    expiresAt: Date.now() + 10000000,
                },
            });
        });

        it('should be able to call the realtime interface to create a session token', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    `/api/v2/ai/openai/realtime/session`,
                    JSON.stringify({
                        recordName: userId,
                        request: {
                            model: 'test-model',
                            instructions: 'my instructions',
                            modalities: ['audio', 'text'],
                            maxResponseOutputTokens: 100,
                            inputAudioFormat: 'pcm16',
                            inputAudioNoiseReduction: {
                                type: 'near_field',
                            },
                            inputAudioTranscription: {
                                language: 'en',
                                model: 'transcription-model',
                                prompt: 'my prompt',
                            },
                            outputAudioFormat: 'pcm16',
                            temperature: 1,
                            toolChoice: 'auto',
                            tools: [
                                {
                                    name: 'tool-1',
                                    parameters: {
                                        type: 'array',
                                        items: {
                                            type: 'string',
                                        },
                                    },
                                    type: 'function',
                                },
                            ],
                            turnDetection: {
                                createResponse: true,
                                eagerness: 'low',
                                interruptResponse: true,
                                prefixPaddingMs: 30,
                                silenceDurationMs: 1000,
                                threshold: 0.5,
                                type: 'semantic_vad',
                            },
                            voice: 'echo',
                        },
                    }),
                    apiHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    sessionId: 'sessionId',
                    clientSecret: {
                        value: 'secret',
                        expiresAt: expect.any(Number),
                    },
                },
                headers: apiCorsHeaders,
            });

            expect(
                realtimeInterface.createRealtimeSessionToken
            ).toHaveBeenCalledWith({
                model: 'test-model',
                instructions: 'my instructions',
                modalities: ['audio', 'text'],
                maxResponseOutputTokens: 100,
                inputAudioFormat: 'pcm16',
                inputAudioNoiseReduction: {
                    type: 'near_field',
                },
                inputAudioTranscription: {
                    language: 'en',
                    model: 'transcription-model',
                    prompt: 'my prompt',
                },
                outputAudioFormat: 'pcm16',
                temperature: 1,
                toolChoice: 'auto',
                tools: [
                    {
                        name: 'tool-1',
                        parameters: {
                            type: 'array',
                            items: {
                                type: 'string',
                            },
                        },
                        type: 'function',
                    },
                ],
                turnDetection: {
                    createResponse: true,
                    eagerness: 'low',
                    interruptResponse: true,
                    prefixPaddingMs: 30,
                    silenceDurationMs: 1000,
                    threshold: 0.5,
                    type: 'semantic_vad',
                },
                voice: 'echo',
            });
        });

        testUrl(
            'POST',
            '/api/v2/ai/openai/realtime/session',
            () =>
                JSON.stringify({
                    recordName: userId,
                    request: {
                        model: 'test-model',
                    },
                }),
            () => apiHeaders
        );
    });

    describe('GET /api/v2/loom/token', () => {
        // Generated with:
        // $ openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -sha256 -days 36500 -nodes
        const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIJQwIBADANBgkqhkiG9w0BAQEFAASCCS0wggkpAgEAAoICAQDPSLxozFzuxHyy
vz7985cSOqt5vv42h40XR/GQ8j4hKCiyDaYCImvPDAn4Tt4sZP0N1+g5lrtyQXxG
KLnMzJgP1vOSLZcTJ79zXl5lClBUwQ2/D0RkL/66Sb94S7XELZS1+2vlKJibNQWq
5ViAxr9zxFLUn9I+XDFVWUkAdE4BJ7HmSAuPrJafyEbnDv3XvG92EC4oBrlsfltu
N6e9drmVLVPHKPxmaCrTtirCme0nu+/uJVURY6p6Kuq2G/oaIzJcsCD8MgEpSUd9
aC0XepO6kzJDNIaNOndOTwtxXjtEx79cNsp7LSVUl/fYgDsYh7WZKoeGWv7C3bJz
rypctJAQWhpcRJrvi4onm+4+2i6tDN02RPJjy5kwrnHObVLSzHDMIrmPG3qY0Rh7
F2A7GNLPhIQx72Zop7mzEXDtoSZeE+1VThbIxoAt6yEux1jOfTULRWDCuDwzGpoz
rS2sQfU39y1dtphH7t/jSvE4OqqRSMAQSD0bItUhjNxOH/JD2Eukh7u7xx+3xaSU
bu7N6dbyPMMl41pT9iWm1Q+VSSVQcAc/uPZ9r0YZjt7katSJ5XWvEhA0SSrnhi7Y
2hpPL7eVrMJGZYY8dvAoUftKadMvvEmF2EAENi7orLQ8p1kpreOvuBlTYDMTvLtY
Lk4KQYhOuF4Vh0irHGjGx4GYu+PJJQIDAQABAoICAF5dI4CmAGymQIpzK+8aVJz0
3plnDH2wideeZedxkD0x9gzQz9FK8D9qoKNM7DHTq6wArXSCHUVvcG7UHXmRbmxP
k8TpQkxzHOIdhOWEo3tiA6sF/UGK4/DUn/jYpp/vjDKoib7iE08c/T6GeBrv37qJ
Fpg7RdAj0kWjhutRBy3Zb1CBXdoDXPLSjwyjM4Zh/3AE/64zGXi9sUvkxFUpVmUG
JIyXKQhJxa1p0d+TiXY8RYbpsedfsv04ym8rH1mEymmNuQZ2kTbFaGk74sM8h0I5
vnj/0X07r5KTw4bRujOep4wIWXdn3wW6xRbnkX+iUFaxGM9eX3pAyPuHM8bOYIJv
HlFezP3hyyvX678baHQf93qZBo0uqpP3sHJhRn/XKXugDDpkVB2xd7d+CbuYX94C
ZJ/YwRag478tlH3er0n4IPU4pfV8eFE+qCAANNr0Jv8OBp8/pl0/97x5KBcg41tF
fnPMvb57SZL5EigCpSEfo6viCHjtwJoTBX6Vavm1kyJk3bbJ9FQJedoOQiHXWTwU
SaNGNUFhV87GEONKgkGUTP/FiLPB9RfzlTjniE4qbqj8CTgYJoKBAExxFWGFnIcr
XZ5+VDOXw5hZxaupT2EKcToPoPl3pLFNS3PuBitI46fnXnSqeMcvrcINBJAKWd09
66gJl5hgwiwTjd+wsyKlAoIBAQDz2GKx+q27LzrHkWK8sq1oVuiURa7Wau9Grz6u
sLLewQxy5v01pU5w0j8UIYZC9vF2EGfS5qbwyngfWnB7uM2M9xMCjzAS3LXyMPAD
07Am3jBWyvhaxtbdYoY0uVU4pWC5WVosnhnIMydGmB0WXEWA7CPA1fYUC0RjIpXf
EWPuleDK28BCD+M6KYIfw+WIDYjO1jH7HmYshYNRJ/fYQeFuypoAqfyv8D75zh4f
kd2Jf64czzfxH+uLKnWX7OqqM5VdcdQX7cVAPVpoLTNJstmd+hpChOyow+dIu9BR
frfA+fRIxL1Mx3XPWwXBq3OawC20P1UsnkGdRfsfMfzzUqP3AoIBAQDZnc7d0GWE
8MLpsotyxR4F0GQ34G/kJoB4SocmPFDXIlW/QGfMBMIAMda/VjP43QomSJfTgUxD
uHXOJZhlfSQkmp/grMHx0sRW3cY0WusIw18QNNY2YtPFhyEncw8dVayWyOzeGJip
Lx8zzBn+ZVhlXAYVkhLOGGuNLW54YYwRYQ7TcwncVVdW6KhN8pNjQxAX0ouwfY5m
vfAaER2unt/cFjtRGvl/JMHAxfK+Q3CFWKi374eYF2LZG8zY4O0obNGJzQl1Rkg1
t/o4URF/MIrAvL++cfNluR1LY6kiBHp2ap0K3dTaA0oKRHI3lcTH+NgXkID3ug39
qN4gBuLv1TzDAoIBAQDiuefKpNK0oQ1+UegEm/4wbd6DPud55qPkjT0zIIiwJb91
duEo6DMvI84S4bj8uq94n3hp2JyQdzGJtYWxA/vbfj/muUxxvVZPgsEoTcQT37QC
f2a8wPU3k0xF6a0bpmlw7Wuy4K4IP8fdE8K378OQRABaZJcRvAgyRQ4lAv5v8Fu7
QuhYhH06ry2Wa4cYIb161B5U58cIzntzEj6YjWkWorresy+IR1HG46eOownhtx4l
G2dgg9V26Fu+j0MCTkQrRpN2TFaDjIhrJNvzQqClCs8v2nhR0xVRw4/GtpQUklRY
9NUudqdLzc5kbQ5obRgR6HFBs0Q+/7qnHsubUtOxAoIBAQC5kfar9F/9w4mS26xK
jIkTkCdF9t+zgJmg+nzRQDH3otHYK0XYFl6Q5+8mbo4XM/bJurGtrN6qCQx8ZFbW
hKZjiG+5mdgxLPg80xWH49f1OxU/rq7U5eWM1bSR/W3wJ/TrCB/lLLhR3VsQQoYQ
B8Affx+5GT1r/isI0qsXgKd+0nNgIQNRnnzCIdgT0D2bMb7xcZupPwhF2MZ8lAfp
tpVTCqo+eXA02dVXW/WqBbxYGciWQW4xZg/m7+v5LaVPCayNhAkCtpIxLNf1Wjw/
Z9eKj+o6rtVN81NlzHCYD5WWkUel0pEF8DQdGU0E1XReyncLcTBpD4GKw4vXZ8fx
mLcdAoIBAHmJJfw9Q1SJb4SiU5SGYu/OtXJJaq4THLxL4wj7TXBZE1CjbQN2dwuK
t+vPhPPdYrEpPFxDrvhGn3RAIWG8yWrH0JGDivBf3+YCwzdMA2Ud2cAQM+JaTQyM
TJVH+HSU+8G3YCTe72ZUglDd5t82litcMrq3UkwPwKL7BJfhMPExfjCoLmDAyv1U
2892oqfCUh/i1d7MAQBjy7TR5s2g33XwYCIS0lDzb1AqCbKEcbhREX3RP4bPiyOR
8i4UUMPzETsh9xvht/YM2L422zym7vZ26YCeo7f5EmxUhryGHKjoCRvgBcjtEVtQ
iW7ByiIykfraimQSzn7Il6dpcvug0Io=
-----END PRIVATE KEY-----`;

        beforeEach(async () => {
            const u = await store.findUser(userId);
            await store.saveUser({
                ...u,
                subscriptionId: 'sub_id',
                subscriptionStatus: 'active',
            });

            await store.createStudioForUser(
                {
                    id: 'studioId',
                    displayName: 'studio',
                    subscriptionId: 'sub1',
                    subscriptionStatus: 'active',
                },
                userId
            );

            await store.updateStudioLoomConfig('studioId', {
                appId: 'appId',
                privateKey: PRIVATE_KEY,
            });

            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withLoom()
                    )
            );
        });

        it('should return a not_supported result if the server has a null AI controller', async () => {
            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/loom/token?recordName=${'studioId'}`,
                    apiHeaders
                )
            );

            const { token } = await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    token: expect.any(String),
                },
                headers: apiCorsHeaders,
            });

            const decoded = jose.decodeJwt(token) as any;
            expect(decoded).toMatchObject({
                iss: 'appId',
                iat: expect.any(Number),
                exp: expect.any(Number),
            });
        });

        testOrigin('GET', `/api/v2/loom/token?recordName=${'studioId'}`);
        testAuthorization(() =>
            httpGet(`/api/v2/loom/token?recordName=${'studioId'}`, apiHeaders)
        );
        testRateLimit(() =>
            httpGet(`/api/v2/loom/token?recordName=${'studioId'}`, apiHeaders)
        );
    });

    describe('GET /api/v2/studios', () => {
        beforeEach(async () => {
            await store.createStudioForUser(
                {
                    id: 'studioId',
                    displayName: 'my studio',
                    comId: 'comId',
                    logoUrl: 'logoUrl',
                    comIdConfig: {
                        allowedStudioCreators: 'anyone',
                    },
                    playerConfig: {
                        ab1BootstrapURL: 'ab1BootstrapURL',
                    },
                    subscriptionId: 'sub1',
                    subscriptionStatus: 'active',
                    stripeCustomerId: 'customerId',
                },
                userId
            );
        });

        it('should get the data for the studio', async () => {
            const result = await server.handleHttpRequest(
                httpGet(
                    `/api/v2/studios?studioId=${'studioId'}`,
                    authenticatedHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    studio: {
                        id: 'studioId',
                        displayName: 'my studio',
                        comId: 'comId',
                        logoUrl: 'logoUrl',
                        comIdConfig: {
                            allowedStudioCreators: 'anyone',
                        },
                        playerConfig: {
                            ab1BootstrapURL: 'ab1BootstrapURL',
                        },
                        comIdFeatures: {
                            allowed: false,
                        },
                        loomFeatures: {
                            allowed: false,
                        },
                        humeFeatures: {
                            allowed: true,
                        },
                    },
                },
                headers: accountCorsHeaders,
            });
        });

        testAuthorization(() =>
            httpGet(
                `/api/v2/studios?studioId=${'studioId'}`,
                authenticatedHeaders
            )
        );
        testOrigin('GET', '/api/v2/studios');
        testRateLimit(() =>
            httpGet(
                `/api/v2/studios?studioId=${'studioId'}`,
                authenticatedHeaders
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

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    studioId: expect.any(String),
                },
                headers: accountCorsHeaders,
            });
        });

        describe('comId', () => {
            beforeEach(async () => {
                store.subscriptionConfiguration = buildSubscriptionConfig(
                    (config) =>
                        config.addSubscription('sub1', (sub) =>
                            sub
                                .withTier('tier1')
                                .withAllDefaultFeatures()
                                .withComId({
                                    allowed: true,
                                    maxStudios: 1,
                                })
                        )
                );

                await store.createStudioForUser(
                    {
                        id: 'studioId1',
                        displayName: 'studio 1',
                        comId: 'comId1',
                        subscriptionId: 'sub1',
                        subscriptionStatus: 'active',
                    },
                    userId
                );
            });

            it('should be able to create a studio in the given comId', async () => {
                const result = await server.handleHttpRequest(
                    httpPost(
                        '/api/v2/studios',
                        JSON.stringify({
                            displayName: 'my studio',
                            ownerStudioComId: 'comId1',
                        }),
                        authenticatedHeaders
                    )
                );

                await expectResponseBodyToEqual(result, {
                    statusCode: 200,
                    body: {
                        success: true,
                        studioId: expect.any(String),
                    },
                    headers: accountCorsHeaders,
                });

                const resultBody = JSON.parse(
                    result.body as string
                ) as CreateStudioSuccess;
                const studio = await store.getStudioById(resultBody.studioId);

                expect(studio).toEqual({
                    id: resultBody.studioId,
                    displayName: 'my studio',
                    ownerStudioComId: 'comId1',
                });
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

    describe('PUT /api/v2/studios', () => {
        beforeEach(async () => {
            await store.createStudioForUser(
                {
                    id: 'studioId',
                    displayName: 'my studio',
                    comId: 'comId',
                    logoUrl: 'logoUrl',
                    comIdConfig: {
                        allowedStudioCreators: 'anyone',
                    },
                    playerConfig: {
                        ab1BootstrapURL: 'ab1BootstrapURL',
                    },
                    subscriptionId: 'sub1',
                    subscriptionStatus: 'active',
                    stripeCustomerId: 'customerId',
                },
                userId
            );
        });

        it('should update the given studio', async () => {
            const result = await server.handleHttpRequest(
                httpPut(
                    '/api/v2/studios',
                    JSON.stringify({
                        id: 'studioId',
                        displayName: 'new name',
                        logoUrl: 'http://example.com/new-url',
                        comIdConfig: {
                            allowedStudioCreators: 'only-members',
                        },
                        playerConfig: {
                            ab1BootstrapURL: 'new bootstrap',
                        },
                    }),
                    authenticatedHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: accountCorsHeaders,
            });

            const studio = await store.getStudioById('studioId');

            expect(studio).toEqual({
                id: 'studioId',
                displayName: 'new name',
                logoUrl: 'http://example.com/new-url',
                comIdConfig: {
                    allowedStudioCreators: 'only-members',
                },
                playerConfig: {
                    ab1BootstrapURL: 'new bootstrap',
                },
                comId: 'comId',
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
                stripeCustomerId: 'customerId',
            });
        });

        it('should update the loom config', async () => {
            const result = await server.handleHttpRequest(
                httpPut(
                    '/api/v2/studios',
                    JSON.stringify({
                        id: 'studioId',
                        displayName: 'new name',
                        logoUrl: 'http://example.com/new-url',
                        comIdConfig: {
                            allowedStudioCreators: 'only-members',
                        },
                        playerConfig: {
                            ab1BootstrapURL: 'new bootstrap',
                        },
                        loomConfig: {
                            appId: 'appId',
                            privateKey: 'secret',
                        },
                    }),
                    authenticatedHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: accountCorsHeaders,
            });

            const studio = await store.getStudioById('studioId');

            expect(studio).toEqual({
                id: 'studioId',
                displayName: 'new name',
                logoUrl: 'http://example.com/new-url',
                comIdConfig: {
                    allowedStudioCreators: 'only-members',
                },
                playerConfig: {
                    ab1BootstrapURL: 'new bootstrap',
                },
                comId: 'comId',
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
                stripeCustomerId: 'customerId',
            });

            const loomConfig = await store.getStudioLoomConfig('studioId');
            expect(loomConfig).toEqual({
                appId: 'appId',
                privateKey: 'secret',
            });
        });

        it('should update the hume config', async () => {
            const result = await server.handleHttpRequest(
                httpPut(
                    '/api/v2/studios',
                    JSON.stringify({
                        id: 'studioId',
                        displayName: 'new name',
                        logoUrl: 'http://example.com/new-url',
                        comIdConfig: {
                            allowedStudioCreators: 'only-members',
                        },
                        playerConfig: {
                            ab1BootstrapURL: 'new bootstrap',
                        },
                        humeConfig: {
                            apiKey: 'apiKey',
                            secretKey: 'secretKey',
                        },
                    }),
                    authenticatedHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: accountCorsHeaders,
            });

            const studio = await store.getStudioById('studioId');

            expect(studio).toEqual({
                id: 'studioId',
                displayName: 'new name',
                logoUrl: 'http://example.com/new-url',
                comIdConfig: {
                    allowedStudioCreators: 'only-members',
                },
                playerConfig: {
                    ab1BootstrapURL: 'new bootstrap',
                },
                comId: 'comId',
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
                stripeCustomerId: 'customerId',
            });

            const humeConfig = await store.getStudioHumeConfig('studioId');
            expect(humeConfig).toEqual({
                apiKey: 'apiKey',
                secretKey: 'secretKey',
            });
        });

        testAuthorization(() =>
            httpPut(
                '/api/v2/studios',
                JSON.stringify({
                    id: 'studioId',
                    displayName: 'new name',
                }),
                authenticatedHeaders
            )
        );
        testOrigin('PUT', '/api/v2/studios', () =>
            JSON.stringify({
                id: 'studioId',
                displayName: 'new name',
            })
        );
        testRateLimit(() =>
            httpPut(
                '/api/v2/studios',
                JSON.stringify({
                    id: 'studioId',
                    displayName: 'new name',
                }),
                authenticatedHeaders
            )
        );
    });

    describe('POST /api/v2/studios/requestComId', () => {
        beforeEach(async () => {
            await store.createStudioForUser(
                {
                    id: 'studioId',
                    displayName: 'my studio',
                    comId: 'comId',
                    logoUrl: 'logoUrl',
                    comIdConfig: {
                        allowedStudioCreators: 'anyone',
                    },
                    playerConfig: {
                        ab1BootstrapURL: 'ab1BootstrapURL',
                    },
                    subscriptionId: 'sub1',
                    subscriptionStatus: 'active',
                    stripeCustomerId: 'customerId',
                },
                userId
            );
        });

        it('should create a studio_com_id_request request', async () => {
            const result = await server.handleHttpRequest(
                httpPost(
                    '/api/v2/studios/requestComId',
                    JSON.stringify({
                        studioId: 'studioId',
                        comId: 'newComId',
                    }),
                    authenticatedHeaders
                )
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: accountCorsHeaders,
            });

            expect(store.comIdRequests).toEqual([
                {
                    id: expect.any(String),
                    studioId: 'studioId',
                    userId: userId,
                    requestedComId: 'newComId',
                    createdAtMs: expect.any(Number),
                    updatedAtMs: expect.any(Number),
                    requestingIpAddress: '123.456.789',
                },
            ]);
            expect(store.recordsNotifications).toEqual([
                {
                    resource: 'studio_com_id_request',
                    resourceId: 'studioId',
                    action: 'created',
                    recordName: null,
                    request: {
                        id: expect.any(String),
                        studioId: 'studioId',
                        userId: userId,
                        requestedComId: 'newComId',
                        requestingIpAddress: '123.456.789',
                        createdAtMs: expect.any(Number),
                        updatedAtMs: expect.any(Number),
                    },

                    timeMs: expect.any(Number),
                },
            ]);
        });

        testAuthorization(() =>
            httpPost(
                '/api/v2/studios/requestComId',
                JSON.stringify({
                    studioId: 'studioId',
                    comId: 'newComId',
                }),
                authenticatedHeaders
            )
        );
        testOrigin('POST', '/api/v2/studios/requestComId', () =>
            JSON.stringify({
                studioId: 'studioId',
                comId: 'newComId',
            })
        );
        testRateLimit(() =>
            httpPost(
                '/api/v2/studios/requestComId',
                JSON.stringify({
                    studioId: 'studioId',
                    comId: 'newComId',
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

            await expectResponseBodyToEqual(result, {
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

        describe('?comId', () => {
            beforeEach(async () => {
                await store.updateStudio({
                    id: 'studioId1',
                    displayName: 'studio 1',
                    comId: 'comId1',
                });

                await store.updateStudio({
                    id: 'studioId2',
                    displayName: 'studio 2',
                    ownerStudioComId: 'comId1',
                });

                await store.updateStudio({
                    id: 'studioId3',
                    displayName: 'studio 3',
                    ownerStudioComId: 'comId1',
                });

                await store.addStudio({
                    id: 'studioId4',
                    displayName: 'studio 4',
                });

                await store.addStudio({
                    id: 'studioId5',
                    displayName: 'studio 5',
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
                await store.addStudioAssignment({
                    studioId: 'studioId4',
                    userId: userId,
                    isPrimaryContact: true,
                    role: 'member',
                });
                await store.addStudioAssignment({
                    studioId: 'studioId5',
                    userId: userId,
                    isPrimaryContact: true,
                    role: 'member',
                });
            });

            it('should list the studios that the user has access to', async () => {
                const result = await server.handleHttpRequest(
                    httpGet(
                        `/api/v2/studios/list?comId=${'comId1'}`,
                        apiHeaders
                    )
                );

                await expectResponseBodyToEqual(result, {
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
                                ownerStudioComId: 'comId1',
                            },
                            {
                                studioId: 'studioId3',
                                displayName: 'studio 3',
                                role: 'member',
                                isPrimaryContact: true,
                                subscriptionTier: null,
                                ownerStudioComId: 'comId1',
                            },
                        ],
                    },
                    headers: apiCorsHeaders,
                });
            });

            describe('?userId', () => {
                beforeEach(async () => {
                    const owner = await store.findUser(ownerId);
                    await store.saveUser({
                        ...owner,
                        role: 'superUser',
                    });
                });

                it('should list the studios that the user has access to if the current user is a super user', async () => {
                    const result = await server.handleHttpRequest(
                        httpGet(
                            `/api/v2/studios/list?userId=${userId}&comId=${'comId1'}`,
                            {
                                authorization: `Bearer ${ownerSessionKey}`,
                                origin: apiOrigin,
                            }
                        )
                    );

                    await expectResponseBodyToEqual(result, {
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
                                    ownerStudioComId: 'comId1',
                                },
                                {
                                    studioId: 'studioId3',
                                    displayName: 'studio 3',
                                    role: 'member',
                                    isPrimaryContact: true,
                                    subscriptionTier: null,
                                    ownerStudioComId: 'comId1',
                                },
                            ],
                        },
                        headers: apiCorsHeaders,
                    });
                });

                it('should return a 403 if the user is not a super user', async () => {
                    const owner = await store.findUser(ownerId);
                    await store.saveUser({
                        ...owner,
                        role: 'none',
                    });

                    const result = await server.handleHttpRequest(
                        httpGet(
                            `/api/v2/studios/list?userId=${userId}&comId=${'comId1'}`,
                            {
                                authorization: `Bearer ${ownerSessionKey}`,
                                origin: apiOrigin,
                            }
                        )
                    );

                    await expectResponseBodyToEqual(result, {
                        statusCode: 403,
                        body: {
                            success: false,
                            errorCode: 'not_authorized',
                            errorMessage:
                                'You are not authorized to perform this action.',
                        },
                        headers: apiCorsHeaders,
                    });
                });
            });
        });

        describe('?userId', () => {
            beforeEach(async () => {
                const owner = await store.findUser(ownerId);
                await store.saveUser({
                    ...owner,
                    role: 'superUser',
                });
            });

            it('should list the studios that the user has access to if the current user is a super user', async () => {
                const result = await server.handleHttpRequest(
                    httpGet(`/api/v2/studios/list?userId=${userId}`, {
                        authorization: `Bearer ${ownerSessionKey}`,
                        origin: apiOrigin,
                    })
                );

                await expectResponseBodyToEqual(result, {
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

            it('should return a 403 if the user is not a super user', async () => {
                const owner = await store.findUser(ownerId);
                await store.saveUser({
                    ...owner,
                    role: 'none',
                });

                const result = await server.handleHttpRequest(
                    httpGet(`/api/v2/studios/list?userId=${userId}`, {
                        authorization: `Bearer ${ownerSessionKey}`,
                        origin: apiOrigin,
                    })
                );

                await expectResponseBodyToEqual(result, {
                    statusCode: 403,
                    body: {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'You are not authorized to perform this action.',
                    },
                    headers: apiCorsHeaders,
                });
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

            await expectResponseBodyToEqual(result, {
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

        it('should list the members of the studio if the user is a super user', async () => {
            const owner = await store.findUser(ownerId);
            await store.saveUser({
                ...owner,
                role: 'superUser',
            });

            const result = await server.handleHttpRequest(
                httpGet(`/api/v2/studios/members/list?studioId=${studioId}`, {
                    ...authenticatedHeaders,
                    authorization: `Bearer ${ownerSessionKey}`,
                })
            );

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

            await expectResponseBodyToEqual(result, {
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

        describe('privo', () => {
            it('should be able to add members by email address', async () => {
                await store.saveNewUser({
                    id: 'testUser4',
                    email: null,
                    phoneNumber: null,
                    privoServiceId: 'serviceId',
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                });

                privoClientMock.lookupServiceId.mockResolvedValueOnce(
                    'serviceId'
                );

                const result = await server.handleHttpRequest(
                    httpPost(
                        '/api/v2/studios/members',
                        JSON.stringify({
                            studioId,
                            addedEmail: 'test4@example.com',
                            role: 'member',
                        }),
                        authenticatedHeaders
                    )
                );

                await expectResponseBodyToEqual(result, {
                    statusCode: 200,
                    body: {
                        success: true,
                    },
                    headers: accountCorsHeaders,
                });

                const list = await store.listStudioAssignments(studioId, {
                    userId: 'testUser4',
                });

                expect(list).toEqual([
                    {
                        studioId,
                        userId: 'testUser4',
                        role: 'member',
                        isPrimaryContact: false,
                        user: {
                            id: 'testUser4',
                            email: null,
                            phoneNumber: null,
                            privoServiceId: 'serviceId',
                        },
                    },
                ]);
                expect(privoClientMock.lookupServiceId).toHaveBeenCalledWith({
                    email: 'test4@example.com',
                });
            });

            it('should be able to add members by phone number', async () => {
                await store.saveNewUser({
                    id: 'testUser4',
                    email: null,
                    phoneNumber: null,
                    privoServiceId: 'serviceId',
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                });

                privoClientMock.lookupServiceId.mockResolvedValueOnce(
                    'serviceId'
                );

                const result = await server.handleHttpRequest(
                    httpPost(
                        '/api/v2/studios/members',
                        JSON.stringify({
                            studioId,
                            addedPhoneNumber: '+1111',
                            role: 'member',
                        }),
                        authenticatedHeaders
                    )
                );

                await expectResponseBodyToEqual(result, {
                    statusCode: 200,
                    body: {
                        success: true,
                    },
                    headers: accountCorsHeaders,
                });

                const list = await store.listStudioAssignments(studioId, {
                    userId: 'testUser4',
                });

                expect(list).toEqual([
                    {
                        studioId,
                        userId: 'testUser4',
                        role: 'member',
                        isPrimaryContact: false,
                        user: {
                            id: 'testUser4',
                            email: null,
                            phoneNumber: null,
                            privoServiceId: 'serviceId',
                        },
                    },
                ]);
                expect(privoClientMock.lookupServiceId).toHaveBeenCalledWith({
                    phoneNumber: '+1111',
                });
            });

            it('should be able to add members by display name', async () => {
                await store.saveNewUser({
                    id: 'testUser4',
                    email: null,
                    phoneNumber: null,
                    privoServiceId: 'serviceId',
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                });

                privoClientMock.lookupServiceId.mockResolvedValueOnce(
                    'serviceId'
                );

                const result = await server.handleHttpRequest(
                    httpPost(
                        '/api/v2/studios/members',
                        JSON.stringify({
                            studioId,
                            addedDisplayName: 'test user',
                            role: 'member',
                        }),
                        authenticatedHeaders
                    )
                );

                await expectResponseBodyToEqual(result, {
                    statusCode: 200,
                    body: {
                        success: true,
                    },
                    headers: accountCorsHeaders,
                });

                const list = await store.listStudioAssignments(studioId, {
                    userId: 'testUser4',
                });

                expect(list).toEqual([
                    {
                        studioId,
                        userId: 'testUser4',
                        role: 'member',
                        isPrimaryContact: false,
                        user: {
                            id: 'testUser4',
                            email: null,
                            phoneNumber: null,
                            privoServiceId: 'serviceId',
                        },
                    },
                ]);
                expect(privoClientMock.lookupServiceId).toHaveBeenCalledWith({
                    displayName: 'test user',
                });
            });
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

            await expectResponseBodyToEqual(result, {
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

    describe('GET /api/v2/player/config', () => {
        beforeEach(async () => {
            await store.addStudio({
                id: 'studioId1',
                comId: 'comId',
                displayName: 'studio 1',
                logoUrl: 'http://example.com/logo.png',
                playerConfig: {
                    ab1BootstrapURL: 'ab1BootstrapURL',
                },
            });

            delete apiHeaders['authorization'];
        });

        it('should return the player config', async () => {
            const result = await server.handleHttpRequest(
                httpGet(`/api/v2/player/config?comId=${'comId'}`, apiHeaders)
            );

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                    comId: 'comId',
                    displayName: 'studio 1',
                    logoUrl: 'http://example.com/logo.png',
                    playerConfig: {
                        ab1BootstrapURL: 'ab1BootstrapURL',
                    },
                },
                headers: apiCorsHeaders,
            });
        });

        testOrigin('GET', `/api/v2/player/config?comId=${'comId'}`);
        testRateLimit(() =>
            httpGet(`/api/v2/player/config?comId=${'comId'}`, apiHeaders)
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

                await expectResponseBodyToEqual(result, {
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

                await expectResponseBodyToEqual(result, {
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

            it('should include default subscriptions in the list of purchasable subscriptions', async () => {
                store.subscriptionConfiguration.subscriptions = [
                    {
                        id: 'sub_id',
                        eligibleProducts: ['product_id'],
                        featureList: ['Feature 1', 'Feature 2'],
                        product: 'product_id',
                    },
                    {
                        id: 'default',
                        name: 'name',
                        description: 'description',
                        defaultSubscription: true,
                        featureList: ['default feature 1'],
                    },
                ];
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

                await expectResponseBodyToEqual(result, {
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
                            {
                                id: 'default',
                                name: 'name',
                                description: 'description',
                                featureList: ['default feature 1'],
                                prices: [],
                                defaultSubscription: true,
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

            it('should allow super users to get subscription info for any user', async () => {
                const owner = await store.findUser(ownerId);
                await store.saveUser({
                    ...owner,
                    role: 'superUser',
                });

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
                    httpGet(`/api/v2/subscriptions?userId=${userId}`, {
                        ...authenticatedHeaders,
                        authorization: `Bearer ${ownerSessionKey}`,
                    })
                );

                await expectResponseBodyToEqual(result, {
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

                await expectResponseBodyToEqual(result, {
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

                await expectResponseBodyToEqual(result, {
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

            it('should include default subscriptions in the list of purchasable subscriptions', async () => {
                store.subscriptionConfiguration.subscriptions = [
                    {
                        id: 'sub_id',
                        eligibleProducts: ['product_id'],
                        featureList: ['Feature 1', 'Feature 2'],
                        product: 'product_id',
                    },
                    {
                        id: 'default',
                        name: 'name',
                        description: 'description',
                        defaultSubscription: true,
                        featureList: ['default feature 1'],
                    },
                ];
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

                await expectResponseBodyToEqual(result, {
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
                            {
                                id: 'default',
                                name: 'name',
                                description: 'description',
                                featureList: ['default feature 1'],
                                prices: [],
                                defaultSubscription: true,
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

            it('should allow super users to get subscription info for any studio', async () => {
                const owner = await store.findUser(ownerId);
                await store.saveUser({
                    ...owner,
                    role: 'superUser',
                });

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
                    httpGet(`/api/v2/subscriptions?studioId=${studioId}`, {
                        ...authenticatedHeaders,
                        authorization: `Bearer ${ownerSessionKey}`,
                    })
                );

                await expectResponseBodyToEqual(result, {
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
                            subscriptionId: 'sub_id',
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
                            subscriptionId: 'sub_id',
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

                await expectResponseBodyToEqual(result, {
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

                await expectResponseBodyToEqual(result, {
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
                            subscriptionId: 'sub_id',
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
                            subscriptionId: 'sub_id',
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

                await expectResponseBodyToEqual(result, {
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

                await expectResponseBodyToEqual(result, {
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

    describe('POST /api/v2/subscriptions/update', () => {
        beforeEach(async () => {
            const owner = await store.findUser(ownerId);
            await store.saveUser({
                ...owner,
                role: 'superUser',
            });
        });

        describe('userId', () => {
            it('should update the subscription of the given user', async () => {
                const result = await server.handleHttpRequest(
                    httpPost(
                        `/api/v2/subscriptions/update`,
                        JSON.stringify({
                            userId,
                            subscriptionId: 'sub_id',
                            subscriptionStatus: 'active',
                            subscriptionPeriodStartMs: 123,
                            subscriptionPeriodEndMs: 999,
                        }),
                        {
                            ...authenticatedHeaders,
                            authorization: `Bearer ${ownerSessionKey}`,
                        }
                    )
                );

                await expectResponseBodyToEqual(result, {
                    statusCode: 200,
                    body: {
                        success: true,
                    },
                    headers: accountCorsHeaders,
                });

                expect(await store.findUser(userId)).toEqual({
                    id: userId,
                    email: expect.any(String),
                    phoneNumber: null,
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: expect.any(String),
                    subscriptionId: 'sub_id',
                    subscriptionStatus: 'active',
                    subscriptionPeriodStartMs: 123,
                    subscriptionPeriodEndMs: 999,
                    subscriptionInfoId: null,
                });
            });

            it('should return 403 if the current user is not a super user', async () => {
                const result = await server.handleHttpRequest(
                    httpPost(
                        `/api/v2/subscriptions/update`,
                        JSON.stringify({
                            userId,
                            subscriptionId: 'sub_id',
                            subscriptionStatus: 'active',
                            subscriptionPeriodStartMs: 123,
                            subscriptionPeriodEndMs: 999,
                        }),
                        authenticatedHeaders
                    )
                );

                await expectResponseBodyToEqual(result, {
                    statusCode: 403,
                    body: {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'You are not authorized to perform this action.',
                    },
                    headers: accountCorsHeaders,
                });

                expect(await store.findUser(userId)).toEqual({
                    id: userId,
                    email: expect.any(String),
                    phoneNumber: null,
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: expect.any(String),
                });
            });

            testUrl(
                'POST',
                '/api/v2/subscriptions/manage',
                () =>
                    JSON.stringify({
                        userId,
                        subscriptionId: 'sub_id',
                        subscriptionStatus: 'active',
                        subscriptionPeriodStartMs: 123,
                        subscriptionPeriodEndMs: 999,
                    }),
                () => ({
                    ...authenticatedHeaders,
                    authorization: `Bearer ${ownerSessionKey}`,
                })
            );
        });

        describe('studioId', () => {
            let studio: Studio;

            beforeEach(async () => {
                studio = {
                    id: 'studioId',
                    displayName: 'my studio',
                };
                await store.addStudio(studio);
            });

            it('should update the subscription of the given studio', async () => {
                const result = await server.handleHttpRequest(
                    httpPost(
                        `/api/v2/subscriptions/update`,
                        JSON.stringify({
                            studioId: studio.id,
                            subscriptionId: 'sub_id',
                            subscriptionStatus: 'active',
                            subscriptionPeriodStartMs: 123,
                            subscriptionPeriodEndMs: 999,
                        }),
                        {
                            ...authenticatedHeaders,
                            authorization: `Bearer ${ownerSessionKey}`,
                        }
                    )
                );

                await expectResponseBodyToEqual(result, {
                    statusCode: 200,
                    body: {
                        success: true,
                    },
                    headers: accountCorsHeaders,
                });

                expect(await store.getStudioById(studio.id)).toEqual({
                    id: studio.id,
                    displayName: studio.displayName,
                    subscriptionId: 'sub_id',
                    subscriptionStatus: 'active',
                    subscriptionPeriodStartMs: 123,
                    subscriptionPeriodEndMs: 999,
                    subscriptionInfoId: null,
                });
            });

            it('should return 403 if the current user is not a super user', async () => {
                const result = await server.handleHttpRequest(
                    httpPost(
                        `/api/v2/subscriptions/update`,
                        JSON.stringify({
                            studioId: studio.id,
                            subscriptionId: 'sub_id',
                            subscriptionStatus: 'active',
                            subscriptionPeriodStartMs: 123,
                            subscriptionPeriodEndMs: 999,
                        }),
                        authenticatedHeaders
                    )
                );

                await expectResponseBodyToEqual(result, {
                    statusCode: 403,
                    body: {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'You are not authorized to perform this action.',
                    },
                    headers: accountCorsHeaders,
                });

                expect(await store.getStudioById(studio.id)).toEqual({
                    id: studio.id,
                    displayName: studio.displayName,
                });
            });

            testUrl(
                'POST',
                '/api/v2/subscriptions/manage',
                () =>
                    JSON.stringify({
                        studioId: studio.id,
                        subscriptionId: 'sub_id',
                        subscriptionStatus: 'active',
                        subscriptionPeriodStartMs: 123,
                        subscriptionPeriodEndMs: 999,
                    }),
                () => ({
                    ...authenticatedHeaders,
                    authorization: `Bearer ${ownerSessionKey}`,
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

            await expectResponseBodyToEqual(result, {
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
            await store.assignPermissionToSubjectAndMarker(
                recordName,
                'role',
                'developer',
                'inst',
                PRIVATE_MARKER,
                'read',
                {},
                null
            );

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

            await expectResponseBodyToEqual(result, {
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

    describe('addRoute()', () => {
        it('should call the given handler when a request is matched to the route', async () => {
            const handler = jest.fn<
                Promise<GenericHttpResponse>,
                [GenericHttpRequest]
            >();

            server.addRoute({
                method: 'GET',
                path: '/api/custom-route',
                handler,
            });

            handler.mockResolvedValueOnce({
                statusCode: 200,
                body: JSON.stringify({
                    success: true,
                }),
            });

            const request = httpGet('/api/custom-route', defaultHeaders);
            const result = await server.handleHttpRequest(request);

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: corsHeaders(defaultHeaders['origin']),
            });

            expect(handler).toHaveBeenCalledWith(request);
        });

        it('should use the given schema', async () => {
            const handler = jest.fn<
                Promise<GenericHttpResponse>,
                [GenericHttpRequest]
            >();

            server.addRoute({
                method: 'POST',
                path: '/api/custom-route',
                schema: z.object({
                    type: z.literal('custom'),
                }),
                handler,
            });

            handler.mockResolvedValueOnce({
                statusCode: 200,
                body: JSON.stringify({
                    success: true,
                }),
            });

            const request = httpPost(
                '/api/custom-route',
                JSON.stringify({ type: 'custom', value: 123 }),
                defaultHeaders
            );
            const result = await server.handleHttpRequest(request);

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: corsHeaders(defaultHeaders['origin']),
            });

            expect(handler).toHaveBeenCalledWith(
                request,
                { type: 'custom' },
                undefined
            );
        });

        it('should be able to use schemas for GET requests', async () => {
            const handler = jest.fn<
                Promise<GenericHttpResponse>,
                [GenericHttpRequest]
            >();

            server.addRoute({
                method: 'GET',
                path: '/api/custom-route',
                schema: z.object({
                    type: z.literal('custom'),
                }),
                handler,
            });

            handler.mockResolvedValueOnce({
                statusCode: 200,
                body: JSON.stringify({
                    success: true,
                }),
            });

            const request = httpGet(
                `/api/custom-route?value=${encodeURIComponent(
                    123
                )}&type=${'custom'}`,
                defaultHeaders
            );
            const result = await server.handleHttpRequest(request);

            await expectResponseBodyToEqual(result, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: corsHeaders(defaultHeaders['origin']),
            });

            expect(handler).toHaveBeenCalledWith(
                request,
                { type: 'custom' },
                undefined
            );
        });

        it('should be able to use the account origins', async () => {
            const handler = jest.fn<
                Promise<GenericHttpResponse>,
                [GenericHttpRequest]
            >();

            server.addRoute({
                method: 'POST',
                path: '/api/custom-route',
                schema: z.object({
                    type: z.literal('custom'),
                }),
                handler,
                allowedOrigins: 'account',
            });

            handler.mockResolvedValueOnce({
                statusCode: 200,
                body: JSON.stringify({
                    success: true,
                }),
            });

            const request = httpPost(
                '/api/custom-route',
                { type: 'custom', value: 123 },
                defaultHeaders
            );
            const result = await server.handleHttpRequest(request);

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'invalid_origin',
                    errorMessage:
                        'The request must be made from an authorized origin.',
                },
                headers: {},
            });

            expect(handler).not.toHaveBeenCalled();

            const request2 = httpPost(
                '/api/custom-route',
                JSON.stringify({ type: 'custom', value: 123 }),
                authenticatedHeaders
            );
            const result2 = await server.handleHttpRequest(request2);

            await expectResponseBodyToEqual(result2, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: accountCorsHeaders,
            });
        });

        it('should be able to use the API origins', async () => {
            const handler = jest.fn<
                Promise<GenericHttpResponse>,
                [GenericHttpRequest]
            >();

            server.addRoute({
                method: 'POST',
                path: '/api/custom-route',
                schema: z.object({
                    type: z.literal('custom'),
                }),
                handler,
                allowedOrigins: 'api',
            });

            handler.mockResolvedValueOnce({
                statusCode: 200,
                body: JSON.stringify({
                    success: true,
                }),
            });

            const request = httpPost(
                '/api/custom-route',
                JSON.stringify({ type: 'custom', value: 123 }),
                defaultHeaders
            );
            const result = await server.handleHttpRequest(request);

            await expectResponseBodyToEqual(result, {
                statusCode: 403,
                body: {
                    success: false,
                    errorCode: 'invalid_origin',
                    errorMessage:
                        'The request must be made from an authorized origin.',
                },
                headers: {},
            });

            expect(handler).not.toHaveBeenCalled();

            const request2 = httpPost(
                '/api/custom-route',
                JSON.stringify({ type: 'custom', value: 123 }),
                apiHeaders
            );
            const result2 = await server.handleHttpRequest(request2);

            await expectResponseBodyToEqual(result2, {
                statusCode: 200,
                body: {
                    success: true,
                },
                headers: apiCorsHeaders,
            });
        });

        it('should return a 500 server error if the route throws an error', async () => {
            const handler = jest.fn<
                Promise<GenericHttpResponse>,
                [GenericHttpRequest]
            >();

            server.addRoute({
                method: 'POST',
                path: '/api/custom-route',
                schema: z.object({
                    type: z.literal('custom'),
                }),
                handler,
            });

            handler.mockImplementation(() => {
                throw new Error('test error');
            });

            const request = httpPost(
                '/api/custom-route',
                JSON.stringify({ type: 'custom', value: 123 }),
                defaultHeaders
            );
            const result = await server.handleHttpRequest(request);

            await expectResponseBodyToEqual(result, {
                statusCode: 500,
                body: {
                    success: false,
                    errorCode: 'server_error',
                    errorMessage: 'A server error occurred.',
                },
                headers: corsHeaders(defaultHeaders['origin']),
            });
        });

        describe('schema', () => {
            let handler = jest.fn<
                Promise<GenericHttpResponse>,
                [GenericHttpRequest]
            >();
            beforeEach(() => {
                handler = jest.fn<
                    Promise<GenericHttpResponse>,
                    [GenericHttpRequest]
                >();

                server.addRoute({
                    method: 'POST',
                    path: '/api/custom-route',
                    schema: z.object({
                        type: z.literal('custom'),
                    }),
                    handler,
                });

                handler.mockResolvedValueOnce({
                    statusCode: 200,
                    body: JSON.stringify({
                        success: true,
                    }),
                });
            });

            testBodyIsJson((body) =>
                httpPost('/api/custom-route', body, defaultHeaders)
            );
        });
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

                expect(websocketMessenger.getMessages(connectionId)).toEqual([
                    {
                        type: 'login_result',
                        success: false,
                        errorCode: 'unacceptable_connection_id',
                        errorMessage:
                            'A connection ID must be specified when logging in without a connection token.',
                    },
                ]);
                const errors = getWebSockerErrors(connectionId);

                expect(errors).toEqual([]);
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
                        success: true,
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

                    await store.assignPermissionToSubjectAndMarker(
                        recordName,
                        'role',
                        'developer',
                        'inst',
                        PRIVATE_MARKER,
                        'read',
                        {},
                        null
                    );
                    await store.assignPermissionToSubjectAndMarker(
                        recordName,
                        'role',
                        'developer',
                        'inst',
                        PRIVATE_MARKER,
                        'create',
                        {},
                        null
                    );
                    await store.assignPermissionToSubjectAndMarker(
                        recordName,
                        'role',
                        'developer',
                        'inst',
                        PRIVATE_MARKER,
                        'updateData',
                        {},
                        null
                    );
                    await store.assignPermissionToSubjectAndMarker(
                        recordName,
                        'role',
                        'developer',
                        'inst',
                        PRIVATE_MARKER,
                        'sendAction',
                        {},
                        null
                    );
                    await store.assignPermissionToSubjectAndMarker(
                        recordName,
                        'role',
                        'developer',
                        'marker',
                        ACCOUNT_MARKER,
                        'assign',
                        {},
                        null
                    );

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
                        {
                            type: 'repo/watch_branch_result',
                            success: true,
                            recordName,
                            inst,
                            branch,
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
                        {
                            type: 'repo/watch_branch_result',
                            success: true,
                            recordName,
                            inst,
                            branch,
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
                            type: 'repo/watch_branch_result',
                            success: true,
                            recordName,
                            inst,
                            branch,
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

            describe('repo/get_updates', () => {
                it('should get the updates for the branch', async () => {
                    expectNoWebSocketErrors(connectionId);

                    if (recordName) {
                        await instStore.saveInst({
                            recordName,
                            inst,
                            markers: [PRIVATE_MARKER],
                        });
                    }

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
                                type: 'repo/get_updates',
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
                            timestamps: [expect.any(Number)],
                        },
                    ]);
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
                            type: 'repo/watch_branch_result',
                            success: true,
                            recordName,
                            inst,
                            branch,
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
                        websocketMessenger.getMessages(connection2).slice(2)
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
                        websocketMessenger.getMessages(connection2).slice(2)
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

            if (c !== 'anonymous') {
                describe('permission/request/missing', () => {
                    it('should emit a permissions request to all the connected devices', async () => {
                        expectNoWebSocketErrors(connectionId);

                        await websocketController.watchBranch(connectionId, {
                            type: 'repo/watch_branch',
                            recordName,
                            inst,
                            branch: DEFAULT_BRANCH_NAME,
                        });

                        expectNoWebSocketErrors(connectionId);

                        await server.handleWebsocketRequest(
                            wsMessage(
                                connection2,
                                messageEvent(2, {
                                    type: 'permission/request/missing',
                                    reason: {
                                        type: 'missing_permission',
                                        recordName,
                                        resourceKind: 'inst',
                                        resourceId: inst,
                                        subjectType: 'user',
                                        subjectId: connectionInfo2.userId,
                                        action: 'read',
                                    },
                                })
                            )
                        );

                        expectNoWebSocketErrors(connection2);

                        expect(
                            websocketMessenger.getMessages(connection2)
                        ).toEqual([]);
                        expect(
                            websocketMessenger
                                .getMessages(connectionId)
                                .slice(2)
                        ).toEqual([
                            {
                                type: 'permission/request/missing',
                                reason: {
                                    type: 'missing_permission',
                                    recordName,
                                    resourceKind: 'inst',
                                    resourceId: inst,
                                    subjectType: 'user',
                                    subjectId: connectionInfo2.userId,
                                    action: 'read',
                                },
                                connection: connectionInfo2,
                                user: {
                                    userId: connectionInfo2.userId,
                                    email: 'owner@example.com',
                                    displayName: null,
                                },
                            },
                        ]);
                    });
                });

                describe('permission/request/missing/response', () => {
                    it('should emit a permissions response to the requesting device', async () => {
                        expectNoWebSocketErrors(connectionId);

                        await websocketController.watchBranch(connectionId, {
                            type: 'repo/watch_branch',
                            recordName,
                            inst,
                            branch: DEFAULT_BRANCH_NAME,
                        });

                        expectNoWebSocketErrors(connectionId);

                        await server.handleWebsocketRequest(
                            wsMessage(
                                connection2,
                                messageEvent(2, {
                                    type: 'permission/request/missing',
                                    reason: {
                                        type: 'missing_permission',
                                        recordName,
                                        resourceKind: 'inst',
                                        resourceId: inst,
                                        subjectType: 'user',
                                        subjectId: connectionInfo2.userId,
                                        action: 'read',
                                    },
                                })
                            )
                        );

                        expectNoWebSocketErrors(connection2);

                        expect(
                            websocketMessenger.getMessages(connection2)
                        ).toEqual([]);
                        expect(
                            websocketMessenger
                                .getMessages(connectionId)
                                .slice(2)
                        ).toEqual([
                            {
                                type: 'permission/request/missing',
                                reason: {
                                    type: 'missing_permission',
                                    recordName,
                                    resourceKind: 'inst',
                                    resourceId: inst,
                                    subjectType: 'user',
                                    subjectId: connectionInfo2.userId,
                                    action: 'read',
                                },
                                connection: connectionInfo2,
                                user: {
                                    userId: connectionInfo2.userId,
                                    email: 'owner@example.com',
                                    displayName: null,
                                },
                            },
                        ]);

                        await server.handleWebsocketRequest(
                            wsMessage(
                                connectionId,
                                messageEvent(3, {
                                    type: 'permission/request/missing/response',
                                    success: true,
                                    recordName,
                                    resourceKind: 'inst',
                                    resourceId: inst,
                                    subjectType: 'user',
                                    subjectId: connectionInfo2.userId,
                                })
                            )
                        );

                        expectNoWebSocketErrors(connectionId);
                        expect(
                            websocketMessenger.getMessages(connection2)
                        ).toEqual([
                            {
                                type: 'permission/request/missing/response',
                                success: true,
                                recordName,
                                resourceKind: 'inst',
                                resourceId: inst,
                                subjectType: 'user',
                                subjectId: connectionInfo2.userId,
                                connection: connectionInfo,
                            },
                        ]);
                    });
                });
            }

            it('should use the websocket rate limiter', async () => {
                const rateLimiter = new MemoryRateLimiter();
                const websocketRateLimiter = new RateLimitController(
                    rateLimiter,
                    {
                        maxHits: 5,
                        windowMs: 1000000,
                    }
                );
                server = new RecordsServer({
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
                    moderationController,
                    loomController,
                    websocketRateLimitController: websocketRateLimiter,
                });

                const ip = '123.456.789';
                expect(rateLimiter.getHits(ip)).toBe(0);

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
                        }),
                        ip
                    )
                );

                expectNoWebSocketErrors(connectionId);
                expect(websocketMessenger.getMessages(connectionId)).toEqual([
                    {
                        type: 'repo/updates_received',
                        recordName,
                        inst,
                        branch,
                        updateId: 3,
                    },
                ]);

                expect(
                    await instStore.getCurrentUpdates(recordName, inst, branch)
                ).toEqual({
                    updates: ['abc'],
                    timestamps: [expect.any(Number)],
                    instSizeInBytes: 3,
                });

                expect(rateLimiter.getHits(ip)).toBe(1);
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
                        success: true,
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

        describe('http', () => {
            it('should send an HTTP request and return the response', async () => {
                await server.handleWebsocketRequest(
                    wsMessage(
                        connectionId,
                        messageEvent(1, {
                            type: 'http_request',
                            id: 1,
                            request: httpGet(
                                `/api/v2/sessions`,
                                authenticatedHeaders
                            ),
                        }),
                        undefined,
                        authenticatedHeaders['origin']
                    )
                );

                expectNoWebSocketErrors(connectionId);

                const response = getWebsocketHttpResponse(connectionId, 1);
                expectWebsocketHttpResponseBodyToEqual(response, {
                    statusCode: 200,
                    body: {
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
                    },
                    headers: accountCorsHeaders,
                });
            });

            it('should handle streamed responses', async () => {
                const u = await store.findUser(userId);
                await store.saveUser({
                    ...u,
                    subscriptionId: 'sub_id',
                    subscriptionStatus: 'active',
                });

                chatInterface.chatStream.mockReturnValueOnce(
                    asyncIterable([
                        Promise.resolve({
                            choices: [
                                {
                                    role: 'assistant',
                                    content: 'hi!',
                                },
                            ],
                            totalTokens: 0,
                        }),
                    ])
                );

                await server.handleWebsocketRequest(
                    wsMessage(
                        connectionId,
                        messageEvent(1, {
                            type: 'http_request',
                            id: 1,
                            request: httpPost(
                                `/api/v2/ai/chat/stream`,
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
                            ),
                        }),
                        undefined,
                        apiHeaders['origin']
                    )
                );

                expectNoWebSocketErrors(connectionId);

                const responses = getWebsocketHttpPartialResponses(
                    connectionId,
                    1
                );
                expectWebsocketHttpPartialResponseBodiesToEqual(responses, {
                    statusCode: 200,
                    body: [
                        {
                            choices: [
                                {
                                    role: 'assistant',
                                    content: 'hi!',
                                },
                            ],
                        },
                        {
                            success: true,
                        },
                    ],
                    headers: {
                        ...apiCorsHeaders,
                        'content-type': 'application/x-ndjson',
                    },
                });
                expect(responses).toHaveLength(2);
            });

            it('should force the origin header to be the one in the websocket request', async () => {
                await server.handleWebsocketRequest(
                    wsMessage(
                        connectionId,
                        messageEvent(1, {
                            type: 'http_request',
                            id: 1,
                            request: httpGet(
                                `/api/v2/sessions`,
                                authenticatedHeaders
                            ),
                        }),
                        undefined,
                        'https://wrong.origin.com'
                    )
                );

                expectNoWebSocketErrors(connectionId);

                const response = getWebsocketHttpResponse(connectionId, 1);
                expectWebsocketHttpResponseBodyToEqual(response, {
                    statusCode: 403,
                    body: {
                        success: false,
                        errorCode: 'invalid_origin',
                        errorMessage:
                            'The request must be made from an authorized origin.',
                    },
                    headers: {},
                });
            });

            it('should convert all headers to lowercase', async () => {
                authenticatedHeaders['Authorization'] =
                    authenticatedHeaders['authorization'];
                delete authenticatedHeaders['authorization'];

                await server.handleWebsocketRequest(
                    wsMessage(
                        connectionId,
                        messageEvent(1, {
                            type: 'http_request',
                            id: 1,
                            request: httpGet(
                                `/api/v2/sessions`,
                                authenticatedHeaders
                            ),
                        }),
                        undefined,
                        authenticatedHeaders['origin']
                    )
                );

                expectNoWebSocketErrors(connectionId);

                const response = getWebsocketHttpResponse(connectionId, 1);
                expectWebsocketHttpResponseBodyToEqual(response, {
                    statusCode: 200,
                    body: {
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
                    },
                    headers: accountCorsHeaders,
                });
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

    /**
     * Tests that the response body of an HTTP request parses to equal the expected value.
     * Returns the parsed body.
     * @param response The response to test.
     * @param expected The expected body.
     * @returns
     */
    async function expectResponseBodyToEqual<T = any>(
        response: GenericHttpResponse,
        expected: any
    ): Promise<T> {
        let body: any;
        if (
            response.body &&
            typeof response.body === 'object' &&
            Symbol.asyncIterator in response.body
        ) {
            const result = await unwindAndCaptureAsync(
                response.body[Symbol.asyncIterator]()
            );
            body = [
                ...result.states.map((s) => JSON.parse(s.trim())),
                JSON.parse(result.result.trim()),
            ];
        } else {
            if (!response.body) {
                body = undefined;
            } else {
                const jsonResult = tryParseJson(response.body as string);
                if (jsonResult.success) {
                    body = jsonResult.value;
                } else {
                    body = response.body;
                }
            }
        }

        expect({
            ...response,
            body,
        }).toEqual(expected);

        return body;
    }

    function expectWebsocketHttpResponseBodyToEqual(
        message: WebsocketHttpResponseMessage,
        expected: any
    ) {
        const response = message.response;

        let json: any;
        if (response.headers?.['content-type'] === 'application/x-ndjson') {
            const lines = (response.body as string).split('\n');
            json = lines
                .map((l) => l.trim())
                .filter((l) => !!l)
                .map((l) => JSON.parse(l.trim()));
        } else {
            json = response.body
                ? JSON.parse(response.body as string)
                : undefined;
        }

        expect({
            ...response,
            body: json,
        }).toEqual(expected);
    }

    function expectWebsocketHttpPartialResponseBodiesToEqual(
        messages: WebsocketHttpPartialResponseMessage[],
        expected: any
    ) {
        let bodies = [] as any[];
        for (let m of messages) {
            if (m.response) {
                bodies.push(JSON.parse(m.response.body as string));
            }
        }
        const response = messages[0].response;

        expect({
            ...response,
            body: bodies,
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

    function getWebsocketHttpPartialResponses(
        connectionId: string,
        id: number
    ): WebsocketHttpPartialResponseMessage[] {
        const messages = websocketMessenger.getMessages(connectionId);
        return sortBy(
            messages.filter(
                (m) => m.type === 'http_partial_response' && m.id === id
            ) as WebsocketHttpPartialResponseMessage[],
            (m) => m.index
        );
    }

    function testUrl(
        method: GenericHttpRequest['method'],
        url: string,
        createBody: () => string,
        getHeaders: () => GenericHttpHeaders = () => authenticatedHeaders
    ) {
        testOrigin(method, url, createBody);
        testAuthorization(() =>
            httpRequest(
                method,
                url,
                createBody ? createBody() : null,
                getHeaders()
            )
        );
        if (method !== 'GET') {
            testBodyIsJson((body) =>
                httpRequest(method, url, body, getHeaders())
            );
        }
        testRateLimit(method, url, createBody);
    }

    function testOrigin(
        method: GenericHttpRequest['method'],
        url: string,
        createBody: () => string | null = () => null,
        allowHeaders: boolean = false,
        provideSessionKey: boolean = false
    ) {
        it('should return a 403 status code if the request is made from a non-account origin', async () => {
            const result = await server.handleHttpRequest(
                httpRequest(method, url, createBody(), {
                    ...defaultHeaders,
                    ...(provideSessionKey
                        ? { authorization: 'Bearer ' + sessionKey }
                        : {}),
                })
            );

            expect(result).toEqual({
                statusCode: 403,
                body: JSON.stringify({
                    success: false,
                    errorCode: 'invalid_origin',
                    errorMessage:
                        'The request must be made from an authorized origin.',
                }),
                headers: {
                    ...(allowHeaders
                        ? corsHeaders(defaultHeaders['origin'])
                        : {}),
                },
            });
        });
    }

    function testAuthorization(
        getRequest: () => GenericHttpRequest,
        expectedMessage:
            | string
            | RegExp = /(The user is not logged in\. A session key must be provided for this operation\.)|(The user must be logged in in order to record events\.)|(You must be logged in in order to use this record key\.)|(The user must be logged in\. Please provide a sessionKey or a recordKey\.)/
        // method: GenericHttpRequest['method'],
        // url: string,
        // createBody: () => string | null = () => null
    ) {
        it('should return a 401 status code when no session key is included', async () => {
            let request = getRequest();
            delete request.headers.authorization;
            const result = await server.handleHttpRequest(request);

            await expectResponseBodyToEqual(result, {
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

            server = new RecordsServer({
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
                policyController,
                aiController,
                websocketController,
                moderationController,
            });

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

    function procedureRequest(
        name: string,
        input: any,
        headers: GenericHttpHeaders = defaultHeaders,
        query?: any,
        ipAddress: string = '123.456.789'
    ): GenericHttpRequest {
        return httpRequest(
            'POST',
            '/api/v3/callProcedure',
            JSON.stringify({
                procedure: name,
                input: input,
                query,
            }),
            headers,
            ipAddress
        );
    }

    function httpRequest(
        method: GenericHttpRequest['method'],
        url: string,
        body: GenericHttpRequest['body'] | null,
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
