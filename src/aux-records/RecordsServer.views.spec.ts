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

import { RecordsServer } from './RecordsServer';
import type {
    GenericHttpHeaders,
    StoredAux,
} from '@casual-simulation/aux-common';
import {
    createBot,
    failure,
    parseSessionKey,
    tryParseJson,
} from '@casual-simulation/aux-common';
import type { RelyingParty } from './AuthController';
import { AuthController } from './AuthController';
import { MemoryAuthMessenger } from './MemoryAuthMessenger';
import { LivekitController } from './LivekitController';
import { RecordsController } from './RecordsController';
import { EventRecordsController } from './EventRecordsController';
import { DataRecordsController } from './DataRecordsController';
import type { DataRecordsStore } from './DataRecordsStore';
import { FileRecordsController } from './FileRecordsController';
import { SubscriptionController } from './SubscriptionController';
import type { StripeInterface } from './StripeInterface';
import { MemoryNotificationRecordsStore } from './notifications/MemoryNotificationRecordsStore';
import { MemoryPackageRecordsStore } from './packages/MemoryPackageRecordsStore';
import { MemoryPackageVersionRecordsStore } from './packages/version/MemoryPackageVersionRecordsStore';
import { PackageRecordsController } from './packages/PackageRecordsController';
import { PackageVersionRecordsController } from './packages/version/PackageVersionRecordsController';
import { PolicyController } from './PolicyController';
import { RateLimitController } from './RateLimitController';
import { MemoryRateLimiter } from './MemoryRateLimiter';
import type { RateLimiter } from '@casual-simulation/rate-limit-redis';
import {
    createTestControllers,
    createTestSubConfiguration,
    createTestUser,
    createStripeMock,
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
import { MemoryStore } from './MemoryStore';
import { WebsocketController } from './websockets/WebsocketController';
import { MemoryWebsocketConnectionStore } from './websockets/MemoryWebsocketConnectionStore';
import { MemoryWebsocketMessenger } from './websockets/MemoryWebsocketMessenger';
import type { InstRecordsStore } from './websockets/InstRecordsStore';
import type { TemporaryInstRecordsStore } from './websockets/TemporaryInstRecordsStore';
import { SplitInstRecordsStore } from './websockets/SplitInstRecordsStore';
import { MemoryTempInstRecordsStore } from './websockets/MemoryTempInstRecordsStore';
import type { PrivoClientInterface } from './PrivoClient';
import { ModerationController } from './ModerationController';
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
import type { AIHumeInterfaceGetAccessTokenResult } from './AIHumeInterface';
import { LoomController } from './LoomController';
import type {
    AISloydInterfaceCreateModelRequest,
    AISloydInterfaceCreateModelResponse,
    AISloydInterfaceEditModelRequest,
    AISloydInterfaceEditModelResponse,
} from './AISloydInterface';
import { MemoryModerationJobProvider } from './MemoryModerationJobProvider';
import { WebhookRecordsController } from './webhooks/WebhookRecordsController';
import { MemoryWebhookRecordsStore } from './webhooks/MemoryWebhookRecordsStore';
import type {
    HandleHttpRequestRequest,
    HandleHttpRequestResult,
} from './webhooks/WebhookEnvironment';
import { NotificationRecordsController } from './notifications/NotificationRecordsController';
import type { WebPushInterface } from './notifications/WebPushInterface';
import type { AIOpenAIRealtimeInterface } from './AIOpenAIRealtimeInterface';
import { SearchRecordsController } from './search/SearchRecordsController';
import { MemorySearchRecordsStore } from './search/MemorySearchRecordsStore';
import { MemorySearchInterface } from './search/MemorySearchInterface';
import type { SearchSyncQueueEvent } from './search/SearchSyncProcessor';
import { MemoryQueue } from './queue/MemoryQueue';
import {
    DatabaseRecordsController,
    MemoryDatabaseRecordsStore,
} from './database';
import { MemoryDatabaseInterface } from './database/MemoryDatabaseInterface';
import type { ViewParams, ViewTemplateRenderer } from './ViewTemplateRenderer';
import { corsHeaders, httpGet, scoped } from './HttpTestUtils';
import { JSDOM } from 'jsdom';
import { render } from 'preact-render-to-string';
import { MemoryPurchasableItemRecordsStore } from './purchasable-items/MemoryPurchasableItemRecordsStore';
import { PurchasableItemRecordsController } from './purchasable-items/PurchasableItemRecordsController';
import type { PurchasableItemRecordsStore } from './purchasable-items/PurchasableItemRecordsStore';
import { MemoryContractRecordsStore } from './contracts/MemoryContractRecordsStore';
import { ContractRecordsController } from './contracts/ContractRecordsController';
import type { DomainNameValidator } from './dns';

jest.mock('@simplewebauthn/server');
jest.mock('axios');

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
console.warn = jest.fn();
console.error = jest.fn();

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
    let purchasableItemsStore: PurchasableItemRecordsStore;
    let purchasableItemsController: PurchasableItemRecordsController;

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
    let searchQueue: MemoryQueue<SearchSyncQueueEvent>;
    let searchRecordsController: SearchRecordsController;

    let databaseRecordsStore: MemoryDatabaseRecordsStore;
    let databaseInterface: MemoryDatabaseInterface;
    let databaseController: DatabaseRecordsController;

    let rateLimiter: RateLimiter;
    let rateLimitController: RateLimitController;

    let filesController: FileRecordsController;

    let stripeMock: jest.Mocked<StripeInterface>;

    let contractRecordsStore: MemoryContractRecordsStore;
    let contractsController: ContractRecordsController;

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

    let domainNameValidator: jest.Mocked<DomainNameValidator>;

    let viewTemplateRenderer: ViewTemplateRenderer;

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
            store,
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

        domainNameValidator = {
            getVerificationDNSRecord: jest.fn(),
            validateDomainName: jest.fn(),
        };
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
            domainNameValidator,
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
        searchQueue = new MemoryQueue(async () => {});
        searchRecordsController = new SearchRecordsController({
            config: store,
            policies: policyController,
            searchInterface,
            store: searchRecordsStore,
            queue: searchQueue,
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

        purchasableItemsStore = new MemoryPurchasableItemRecordsStore(store);
        purchasableItemsController = new PurchasableItemRecordsController({
            config: store,
            policies: policyController,
            store: purchasableItemsStore,
        });

        stripe = stripeMock = createStripeMock();

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

        contractRecordsStore = new MemoryContractRecordsStore(store);
        contractsController = new ContractRecordsController({
            authStore: store,
            config: store,
            policies: policyController,
            store: contractRecordsStore,
            privo: privoClient,
        });

        subscriptionController = new SubscriptionController(
            stripe,
            authController,
            store,
            store,
            store,
            policyController,
            store,
            purchasableItemsStore,
            null,
            store,
            contractRecordsStore
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
            financial: null,
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

        databaseRecordsStore = new MemoryDatabaseRecordsStore(store);
        databaseInterface = new MemoryDatabaseInterface();
        databaseController = new DatabaseRecordsController({
            config: store,
            store: databaseRecordsStore,
            databaseInterface,
            databaseInterfaceProviderName: 'sqlite',
            policies: policyController,
        });

        viewTemplateRenderer = {
            render: async (template: string, args: ViewParams) => {
                let result = '';
                for (let key of Object.keys(args)) {
                    const value = args[key];
                    result += `<${key}>${render(value)}</${key}>`;
                }
                return result as unknown as string;
            },
        };

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
            databaseRecordsController: databaseController,
            viewTemplateRenderer: viewTemplateRenderer,
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

    beforeEach(() => {
        require('axios').__reset();
    });

    function setResponse(response: any) {
        require('axios').__setResponse(response);
    }

    function setNextResponse(response: any) {
        require('axios').__setNextResponse(response);
    }

    function getLastPost() {
        return require('axios').__getLastPost();
    }

    function getLastGet() {
        return require('axios').__getLastGet();
    }

    function getRequests() {
        return require('axios').__getRequests();
    }

    describe('views', () => {
        describe('player', () => {
            const indexPaths = [['/'], ['/index.html']];

            describe.each(indexPaths)('GET %s', (path) => {
                it('should include the web config', async () => {
                    store.webConfig = {
                        causalRepoConnectionProtocol: 'websocket',
                        version: 2,
                        logoTitle: 'Test Logo',
                        logoUrl: 'https://example.com/logo.png',
                    };

                    const result = await server.handleHttpRequest(
                        scoped('player', httpGet(path, defaultHeaders))
                    );

                    expect(result.statusCode).toBe(200);

                    const body = result.body as string;
                    const dom = new JSDOM(body);

                    const webConfig = dom.window.document.querySelector(
                        'postApp script#casualos-web-config'
                    );

                    expect(
                        webConfig?.attributes.getNamedItem('type')?.value
                    ).toBe('application/json');

                    const json = tryParseJson(webConfig!.innerHTML!);

                    expect(json).toEqual({
                        success: true,
                        value: {
                            causalRepoConnectionProtocol: 'websocket',
                            version: 2,
                            logoTitle: 'Test Logo',
                            logoUrl: 'https://example.com/logo.png',
                            studiosSupported: true,
                            subscriptionsSupported: true,
                            requirePrivoLogin: false,
                        },
                    });

                    expect(result.headers).toEqual({
                        ...corsHeaders(defaultHeaders.origin),
                        'Content-Type': 'text/html; charset=utf-8',
                    });
                });

                it('should include posthog', async () => {
                    store.webConfig = {
                        causalRepoConnectionProtocol: 'websocket',
                        version: 2,
                        logoTitle: 'Test Logo',
                        logoUrl: 'https://example.com/logo.png',
                        postHogApiHost: 'https://posthog.example.com',
                        postHogApiKey: 'posthog_project_api_key',
                    };

                    const result = await server.handleHttpRequest(
                        scoped('player', httpGet(path, defaultHeaders))
                    );

                    expect(result.statusCode).toBe(200);

                    const body = result.body as string;
                    const dom = new JSDOM(body);

                    const postHogApiKey = dom.window.document.querySelector(
                        'postApp script#posthog-api-key'
                    );

                    expect(postHogApiKey?.innerHTML).toBe(
                        'posthog_project_api_key'
                    );

                    const postHogHost = dom.window.document.querySelector(
                        'postApp script#posthog-host'
                    );

                    expect(postHogHost?.innerHTML).toBe(
                        'https://posthog.example.com'
                    );

                    const webConfig = dom.window.document.querySelector(
                        'postApp script#casualos-web-config'
                    );

                    expect(
                        webConfig?.attributes.getNamedItem('type')?.value
                    ).toBe('application/json');

                    const json = tryParseJson(webConfig!.innerHTML!);

                    expect(json).toEqual({
                        success: true,
                        value: {
                            causalRepoConnectionProtocol: 'websocket',
                            version: 2,
                            logoTitle: 'Test Logo',
                            logoUrl: 'https://example.com/logo.png',
                            studiosSupported: true,
                            subscriptionsSupported: true,
                            requirePrivoLogin: false,
                            postHogApiHost: 'https://posthog.example.com',
                            postHogApiKey: 'posthog_project_api_key',
                        },
                    });

                    expect(result.headers).toEqual({
                        ...corsHeaders(defaultHeaders.origin),
                        'Content-Type': 'text/html; charset=utf-8',
                    });
                });

                it('should include simple analytics', async () => {
                    store.webConfig = {
                        causalRepoConnectionProtocol: 'websocket',
                        version: 2,
                        logoTitle: 'Test Logo',
                        logoUrl: 'https://example.com/logo.png',
                        enableSimpleAnalytics: true,
                    };

                    const result = await server.handleHttpRequest(
                        scoped('player', httpGet(path, defaultHeaders))
                    );

                    expect(result.statusCode).toBe(200);

                    const body = result.body as string;
                    const dom = new JSDOM(body);

                    const simpleAnalytics = dom.window.document.querySelector(
                        'postApp script#simple-analytics'
                    );

                    expect(simpleAnalytics?.getAttribute('src')).toBe(
                        'https://scripts.simpleanalyticscdn.com/latest.js'
                    );
                });

                it('should include the configured icons', async () => {
                    store.webConfig = {
                        causalRepoConnectionProtocol: 'websocket',
                        version: 2,
                        logoTitle: 'Test Logo',
                        logoUrl: 'https://example.com/logo.png',

                        icons: {
                            favicon: 'https://example.com/favicon.ico',
                            appleTouchIcon:
                                'https://example.com/apple-touch-icon.png',
                        },
                    };

                    const result = await server.handleHttpRequest(
                        scoped('player', httpGet(path, defaultHeaders))
                    );

                    expect(result.statusCode).toBe(200);

                    const body = result.body as string;
                    const dom = new JSDOM(body);

                    const favicon = dom.window.document.querySelector(
                        'icons link[rel="icon"]'
                    );

                    expect(
                        favicon?.attributes.getNamedItem('href')?.value
                    ).toBe('https://example.com/favicon.ico');
                    expect(
                        favicon?.attributes.getNamedItem('type')?.value
                    ).toBeFalsy();

                    const appleTouchIcon = dom.window.document.querySelector(
                        'icons link[rel="apple-touch-icon"]'
                    );

                    expect(
                        appleTouchIcon?.attributes.getNamedItem('href')?.value
                    ).toBe('https://example.com/apple-touch-icon.png');
                });

                it('should do nothing for default icons', async () => {
                    store.webConfig = {
                        causalRepoConnectionProtocol: 'websocket',
                        version: 2,
                        logoTitle: 'Test Logo',
                        logoUrl: 'https://example.com/logo.png',
                    };

                    const result = await server.handleHttpRequest(
                        scoped('player', httpGet(path, defaultHeaders))
                    );

                    expect(result.statusCode).toBe(200);

                    const body = result.body as string;
                    const dom = new JSDOM(body);

                    const favicon = dom.window.document.querySelector(
                        'icons link[rel="icon"]'
                    );

                    expect(!favicon).toBe(true);

                    const appleTouchIcon = dom.window.document.querySelector(
                        'icons link[rel="apple-touch-icon"]'
                    );

                    expect(!appleTouchIcon).toBe(true);
                });

                it('should return nothing if getting the config fails', async () => {
                    recordsController.getWebConfig = jest
                        .fn()
                        .mockResolvedValue(
                            failure({
                                errorCode: 'server_error',
                                errorMessage: 'Failed',
                            })
                        );

                    const result = await server.handleHttpRequest(
                        scoped('player', httpGet(path, defaultHeaders))
                    );

                    expect(result.statusCode).toBe(200);

                    const body = result.body as string;
                    const dom = new JSDOM(body);

                    const webConfig = dom.window.document.querySelector(
                        'postApp script#casualos-web-config'
                    );

                    expect(webConfig).toBeFalsy();

                    expect(result.headers).toEqual({
                        ...corsHeaders(defaultHeaders.origin),
                        'Content-Type': 'text/html; charset=utf-8',
                    });
                });

                it('should return the template with no params if the view procedure throws an error', async () => {
                    recordsController.getWebConfig = jest
                        .fn()
                        .mockRejectedValue(new Error('Something bad happened'));

                    const result = await server.handleHttpRequest(
                        scoped('player', httpGet(path, defaultHeaders))
                    );

                    expect(result.statusCode).toBe(200);

                    const body = result.body as string;
                    const dom = new JSDOM(body);

                    const webConfig = dom.window.document.querySelector(
                        'postApp script#casualos-web-config'
                    );

                    expect(webConfig).toBeFalsy();

                    expect(result.headers).toEqual({
                        ...corsHeaders(defaultHeaders.origin),
                        'Content-Type': 'text/html; charset=utf-8',
                    });
                });

                it('should include the ab1 bootstrap AUX if configured', async () => {
                    store.webConfig = {
                        causalRepoConnectionProtocol: 'websocket',
                        version: 2,
                        logoTitle: 'Test Logo',
                        logoUrl: 'https://example.com/logo.png',
                        ab1BootstrapURL: 'https://example.com/ab1.aux',
                        serverInjectBootstrapper: true,
                    };

                    setResponse({
                        status: 200,
                        data: {
                            version: 1,
                            state: {
                                test: createBot('test', {}),
                                test2: createBot('test2', {}),
                            },
                        } satisfies StoredAux,
                    });

                    const result = await server.handleHttpRequest(
                        scoped('player', httpGet(path, defaultHeaders))
                    );

                    expect(result.statusCode).toBe(200);

                    const body = result.body as string;
                    const dom = new JSDOM(body);

                    const webConfig = dom.window.document.querySelector(
                        'postApp script[type="text/aux"]#casualos-ab1-bootstrap'
                    );

                    expect(
                        webConfig?.attributes.getNamedItem('type')?.value
                    ).toBe('text/aux');

                    const json = tryParseJson(webConfig!.innerHTML!);

                    expect(json).toEqual({
                        success: true,
                        value: {
                            version: 1,
                            state: {
                                test: createBot('test', {}),
                                test2: createBot('test2', {}),
                            },
                        },
                    });

                    expect(result.headers).toEqual({
                        ...corsHeaders(defaultHeaders.origin),
                        'Content-Type': 'text/html; charset=utf-8',
                    });
                });

                it('should not include the ab1 bootstrap AUX if disabled', async () => {
                    store.webConfig = {
                        causalRepoConnectionProtocol: 'websocket',
                        version: 2,
                        logoTitle: 'Test Logo',
                        logoUrl: 'https://example.com/logo.png',
                        ab1BootstrapURL: 'https://example.com/ab1.aux',
                    };

                    setResponse({
                        status: 200,
                        data: {
                            version: 1,
                            state: {
                                test: createBot('test', {}),
                                test2: createBot('test2', {}),
                            },
                        } satisfies StoredAux,
                    });

                    const result = await server.handleHttpRequest(
                        scoped('player', httpGet(path, defaultHeaders))
                    );

                    expect(result.statusCode).toBe(200);

                    const body = result.body as string;
                    const dom = new JSDOM(body);

                    const ab1 = dom.window.document.querySelector(
                        'postApp script[type="text/aux"]#casualos-ab1-bootstrap'
                    );

                    expect(!ab1).toBe(true);
                });
            });
        });

        describe('auth', () => {
            const indexPaths = [['/'], ['/index.html']];

            describe.each(indexPaths)('GET %s', (path) => {
                it('should return the auth default view', async () => {
                    const result = await server.handleHttpRequest(
                        scoped('auth', httpGet(path, defaultHeaders))
                    );

                    expect(result.statusCode).toBe(200);

                    const body = result.body as string;
                    const dom = new JSDOM(body);

                    const webConfig = dom.window.document.querySelector(
                        'postApp script#casualos-web-config'
                    );

                    expect(
                        webConfig?.attributes.getNamedItem('type')?.value
                    ).toBe('application/json');

                    const json = tryParseJson(webConfig!.innerHTML!);

                    expect(json).toEqual({
                        success: true,
                        value: {
                            causalRepoConnectionProtocol: 'websocket',
                            version: 2,
                            studiosSupported: true,
                            subscriptionsSupported: true,
                            requirePrivoLogin: false,
                        },
                    });

                    // expect(result).toEqual({
                    //     statusCode: 200,
                    //     body: `<postApp></postApp>`,
                    //     headers: {
                    //         ...corsHeaders(defaultHeaders.origin),
                    //         'Content-Type': 'text/html; charset=utf-8',
                    //     },
                    // });

                    expect(result.headers).toEqual({
                        ...corsHeaders(defaultHeaders.origin),
                        'Content-Type': 'text/html; charset=utf-8',
                    });
                });

                it('should include posthog', async () => {
                    store.webConfig = {
                        causalRepoConnectionProtocol: 'websocket',
                        version: 2,
                        logoTitle: 'Test Logo',
                        logoUrl: 'https://example.com/logo.png',
                        postHogApiHost: 'https://posthog.example.com',
                        postHogApiKey: 'posthog_project_api_key',
                    };

                    const result = await server.handleHttpRequest(
                        scoped('auth', httpGet(path, defaultHeaders))
                    );

                    expect(result.statusCode).toBe(200);

                    const body = result.body as string;
                    const dom = new JSDOM(body);

                    const postHogApiKey = dom.window.document.querySelector(
                        'postApp script#posthog-api-key'
                    );

                    expect(postHogApiKey?.innerHTML).toBe(
                        'posthog_project_api_key'
                    );

                    const postHogHost = dom.window.document.querySelector(
                        'postApp script#posthog-host'
                    );

                    expect(postHogHost?.innerHTML).toBe(
                        'https://posthog.example.com'
                    );

                    const webConfig = dom.window.document.querySelector(
                        'postApp script#casualos-web-config'
                    );

                    expect(
                        webConfig?.attributes.getNamedItem('type')?.value
                    ).toBe('application/json');

                    const json = tryParseJson(webConfig!.innerHTML!);

                    expect(json).toEqual({
                        success: true,
                        value: {
                            causalRepoConnectionProtocol: 'websocket',
                            version: 2,
                            studiosSupported: true,
                            subscriptionsSupported: true,
                            requirePrivoLogin: false,
                            logoTitle: 'Test Logo',
                            logoUrl: 'https://example.com/logo.png',
                            postHogApiHost: 'https://posthog.example.com',
                            postHogApiKey: 'posthog_project_api_key',
                        },
                    });

                    expect(result.headers).toEqual({
                        ...corsHeaders(defaultHeaders.origin),
                        'Content-Type': 'text/html; charset=utf-8',
                    });
                });

                it('should include simple analytics', async () => {
                    store.webConfig = {
                        causalRepoConnectionProtocol: 'websocket',
                        version: 2,
                        logoTitle: 'Test Logo',
                        logoUrl: 'https://example.com/logo.png',
                        enableSimpleAnalytics: true,
                    };

                    const result = await server.handleHttpRequest(
                        scoped('auth', httpGet(path, defaultHeaders))
                    );

                    expect(result.statusCode).toBe(200);

                    const body = result.body as string;
                    const dom = new JSDOM(body);

                    const simpleAnalytics = dom.window.document.querySelector(
                        'postApp script#simple-analytics'
                    );

                    expect(simpleAnalytics?.getAttribute('src')).toBe(
                        'https://scripts.simpleanalyticscdn.com/latest.js'
                    );
                });

                it('should include a Content Security Policy meta tag', async () => {
                    store.webConfig = {
                        causalRepoConnectionProtocol: 'websocket',
                        version: 2,
                        logoTitle: 'Test Logo',
                        logoUrl: 'https://example.com/logo.png',
                        recordsOrigin: 'https://records-origin.com',
                    };

                    const result = await server.handleHttpRequest(
                        scoped('auth', httpGet(path, defaultHeaders))
                    );

                    expect(result.statusCode).toBe(200);

                    const body = result.body as string;
                    const dom = new JSDOM(body);

                    const meta = dom.window.document.querySelector(
                        'head meta[name="Content-Security-Policy"]'
                    );

                    expect(
                        meta?.attributes.getNamedItem('content')?.value
                    ).toBe(
                        `default-src 'self' https://js.stripe.com; img-src 'self' https://*; style-src 'self' 'unsafe-inline'; frame-src https://js.stripe.com; child-src https://*; connect-src 'self'  https://scripts.simpleanalyticscdn.com http://localhost:9000 *.s3.amazonaws.com https://records-origin.com; script-src 'self' https://js.stripe.com https://scripts.simpleanalyticscdn.com 'unsafe-inline';`
                    );
                });

                it('should include unsafe-eval if in debug mode', async () => {
                    store.webConfig = {
                        causalRepoConnectionProtocol: 'websocket',
                        version: 2,
                        logoTitle: 'Test Logo',
                        logoUrl: 'https://example.com/logo.png',
                        recordsOrigin: 'https://records-origin.com',
                        debug: true,
                    };

                    const result = await server.handleHttpRequest(
                        scoped('auth', httpGet(path, defaultHeaders))
                    );

                    expect(result.statusCode).toBe(200);

                    const body = result.body as string;
                    const dom = new JSDOM(body);

                    const meta = dom.window.document.querySelector(
                        'head meta[name="Content-Security-Policy"]'
                    );

                    expect(
                        meta?.attributes.getNamedItem('content')?.value
                    ).toBe(
                        `default-src 'self' https://js.stripe.com; img-src 'self' https://*; style-src 'self' 'unsafe-inline'; frame-src https://js.stripe.com; child-src https://*; connect-src 'self'  https://scripts.simpleanalyticscdn.com http://localhost:9000 *.s3.amazonaws.com https://records-origin.com; script-src 'self' https://js.stripe.com https://scripts.simpleanalyticscdn.com 'unsafe-inline' 'unsafe-eval';`
                    );
                });
            });

            describe('GET /iframe.html', () => {
                beforeEach(() => {
                    store.webConfig = {
                        causalRepoConnectionProtocol: 'websocket',
                        version: 2,
                        logoTitle: 'Test Logo',
                        logoUrl: 'https://example.com/logo.png',
                        recordsOrigin: 'https://records-origin.com',
                    };
                });

                it('should include a content security policy meta tag', async () => {
                    const result = await server.handleHttpRequest(
                        scoped('auth', httpGet('/iframe.html', defaultHeaders))
                    );

                    expect(result.statusCode).toBe(200);

                    const body = result.body as string;
                    const dom = new JSDOM(body);

                    const meta = dom.window.document.querySelector(
                        'head meta[name="Content-Security-Policy"]'
                    );

                    expect(
                        meta?.attributes.getNamedItem('content')?.value
                    ).toBe(
                        `default-src 'self'; child-src https://*; connect-src 'self' https://records-origin.com;`
                    );
                });

                it('should include unsafe-eval when debug is true in the web config', async () => {
                    store.webConfig!.debug = true;

                    const result = await server.handleHttpRequest(
                        scoped('auth', httpGet('/iframe.html', defaultHeaders))
                    );

                    expect(result.statusCode).toBe(200);

                    const body = result.body as string;
                    const dom = new JSDOM(body);

                    const meta = dom.window.document.querySelector(
                        'head meta[name="Content-Security-Policy"]'
                    );

                    expect(
                        meta?.attributes.getNamedItem('content')?.value
                    ).toBe(
                        `default-src 'self'; child-src https://*; connect-src 'self' https://records-origin.com; script-src 'self' 'unsafe-eval';`
                    );
                });
            });
        });
    });
});
