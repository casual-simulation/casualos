import {
    AuthController,
    AuthStore,
    DataRecordsController,
    DataRecordsStore,
    EventRecordsController,
    EventRecordsStore,
    FileRecordsController,
    FileRecordsStore,
    PolicyController,
    PolicyStore,
    RateLimitController,
    RecordKey,
    RecordsController,
    RecordsServer,
    RecordsStore,
    SubscriptionController,
    Record,
    OpenAIChatInterface,
    AIChatInterface,
    BlockadeLabsGenerateSkyboxInterface,
    OpenAIImageInterface,
    StabilityAIImageInterface,
    MetricsStore,
    WebsocketController,
    WebsocketConnectionStore,
    InstRecordsStore,
    WebsocketMessenger,
    SplitInstRecordsStore,
    TemporaryInstRecordsStore,
    MultiCache,
    CachingPolicyStore,
    CachingConfigStore,
} from '@casual-simulation/aux-records';
import {
    S3FileRecordsStore,
    SimpleEmailServiceAuthMessenger,
    SimpleEmailServiceAuthMessengerOptions,
    TextItAuthMessenger,
} from '@casual-simulation/aux-records-aws';
import { AuthMessenger } from '@casual-simulation/aux-records/AuthMessenger';
import { ConsoleAuthMessenger } from '@casual-simulation/aux-records/ConsoleAuthMessenger';
import { LivekitController } from '@casual-simulation/aux-records/LivekitController';
import {
    SubscriptionConfiguration,
    subscriptionConfigSchema,
} from '@casual-simulation/aux-records/SubscriptionConfiguration';
import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { SESv2 } from '@aws-sdk/client-sesv2';
import {
    RedisClientOptions,
    RedisClientType,
    createClient as createRedisClient,
} from 'redis';
import RedisRateLimitStore from '@casual-simulation/rate-limit-redis';
import z from 'zod';
import { StripeIntegration } from './StripeIntegration';
import Stripe from 'stripe';
import {
    Binary,
    Collection,
    Cursor,
    Db,
    MongoClient,
    MongoClientOptions,
    ObjectId,
} from 'mongodb';
import pify from 'pify';
import {
    MongoDBAuthUser,
    MongoDBLoginRequest,
    MongoDBAuthSession,
    DataRecord,
    MongoDBAuthStore,
    MongoDBFileRecordsStore,
    MongoDBRateLimiter,
    MongoDBEventRecordsStore,
    MongoDBDataRecordsStore,
    MongoDBPolicyStore,
    MongoDBFileRecordsLookup,
    MongoDBStudio,
    MongoDBConfigurationStore,
    MongoDBMetricsStore,
    USERS_COLLECTION_NAME,
    LOGIN_REQUESTS_COLLECTION_NAME,
    SESSIONS_COLLECTION_NAME,
    EMAIL_RULES_COLLECTION_NAME,
    SMS_RULES_COLLECTION_NAME,
    RECORDS_COLLECTION_NAME,
    STUDIOS_COLLECTION_NAME,
} from '../mongo';
import { sortBy } from 'lodash';
import { PrismaClient } from './generated';
import {
    PrismaAuthStore,
    PrismaConfigurationStore,
    PrismaDataRecordsStore,
    PrismaEventRecordsStore,
    PrismaFileRecordsLookup,
    PrismaPolicyStore,
    PrismaRecordsStore,
} from '../prisma';
import {
    AIConfiguration,
    AIController,
    AIGenerateImageConfiguration,
} from '@casual-simulation/aux-records/AIController';
import { ConfigurationStore } from '@casual-simulation/aux-records/ConfigurationStore';
import { PrismaMetricsStore } from '../prisma/PrismaMetricsStore';
import { S3 } from '@aws-sdk/client-s3';
import { RedisTempInstRecordsStore } from '../redis/RedisTempInstRecordsStore';
import { RedisWebsocketConnectionStore } from '../redis/RedisWebsocketConnectionStore';
import { ApiGatewayWebsocketMessenger } from '../serverless/aws/src/ApiGatewayWebsocketMessenger';
import { Subscription, SubscriptionLike } from 'rxjs';
import { WSWebsocketMessenger } from '../ws/WSWebsocketMessenger';
import { PrismaInstRecordsStore } from '../prisma/PrismaInstRecordsStore';
import { RedisMultiCache } from '../redis/RedisMultiCache';
import { PrivoClient } from '@casual-simulation/aux-records/PrivoClient';
import { PrismaPrivoStore } from 'aux-backend/prisma/PrismaPrivoStore';
import {
    PrivoConfiguration,
    privoSchema,
} from '@casual-simulation/aux-records/PrivoConfiguration';
import { promisify } from 'util';

export class ServerBuilder implements SubscriptionLike {
    private _docClient: DocumentClient;
    private _mongoClient: MongoClient;
    private _prismaClient: PrismaClient;
    private _mongoDb: Db;
    private _multiCache: MultiCache;

    private _privoClient: PrivoClient;
    private _privoStore: PrismaPrivoStore;

    private _configStore: ConfigurationStore;
    private _metricsStore: MetricsStore;
    private _authStore: AuthStore;
    private _authMessenger: AuthMessenger;
    private _authController: AuthController;

    private _recordsStore: RecordsStore;
    private _recordsController: RecordsController;

    private _policyStore: PolicyStore;
    private _policyController: PolicyController;

    private _dataStore: DataRecordsStore;
    private _dataController: DataRecordsController;

    private _manualDataStore: DataRecordsStore;
    private _manualDataController: DataRecordsController;

    private _eventsStore: EventRecordsStore;
    private _eventsController: EventRecordsController;

    private _filesStore: FileRecordsStore;
    private _filesController: FileRecordsController;

    private _livekitController: LivekitController;

    private _websocketConnectionStore: WebsocketConnectionStore;
    private _websocketMessenger: WebsocketMessenger;
    private _tempInstRecordsStore: TemporaryInstRecordsStore;
    private _instRecordsStore: InstRecordsStore;
    private _websocketController: WebsocketController;

    private _subscriptionConfig: SubscriptionConfiguration | null = null;
    private _subscriptionController: SubscriptionController;
    private _stripe: StripeIntegration;

    private _chatInterface: AIChatInterface = null;
    private _aiConfiguration: AIConfiguration = null;
    private _aiController: AIController;

    private _redis: RedisClientType | null = null;
    private _s3: S3;
    private _rateLimitController: RateLimitController;

    private _allowedAccountOrigins: Set<string> = new Set([
        'http://localhost:3000',
        'http://localhost:3002',
    ]);
    private _allowedApiOrigins: Set<string> = new Set([
        'http://localhost:3000',
        'http://localhost:3002',
    ]);

    private _options: BuilderOptions;

    /**
     * The actions that should be performed when the server is built.
     */
    private _actions: {
        priority: number;
        action: () => Promise<void>;
    }[] = [];
    private _generateSkyboxInterface: BlockadeLabsGenerateSkyboxInterface;
    private _imagesInterfaces: AIGenerateImageConfiguration['interfaces'];

    private _subscription: Subscription;

    /**
     * The promise that resolves when the server has been fully initialized.
     */
    private _initPromise: Promise<void>;
    private _initActions: {
        priority: number;
        action: () => Promise<void>;
    }[] = [];

    private get _forceAllowAllSubscriptionFeatures() {
        return !this._stripe;
    }

    constructor(options?: BuilderOptions) {
        this._options = options ?? {};
        this._subscription = new Subscription();
    }

    unsubscribe(): void {
        this._subscription.unsubscribe();
    }

    get closed(): boolean {
        return this._subscription.closed;
    }

    useRedisCache(
        options: Pick<BuilderOptions, 'redis'> = this._options
    ): this {
        console.log('[ServerBuilder] Using Redis Cache.');
        if (!options.redis) {
            throw new Error('Redis options must be provided.');
        }

        if (!options.redis.cacheNamespace) {
            throw new Error('Redis cache namespace must be provided.');
        }

        const redis = this._ensureRedis(options);
        this._multiCache = new RedisMultiCache(
            redis,
            options.redis.cacheNamespace
        );
        return this;
    }

    useMongoDB(
        options: Pick<BuilderOptions, 'mongodb' | 'subscriptions'> = this
            ._options
    ): this {
        console.log('[ServerBuilder] Using MongoDB.');

        if (!options.mongodb) {
            throw new Error('MongoDB options must be provided.');
        }

        const mongodb = options.mongodb;
        this._actions.push({
            priority: 0,
            action: async () => {
                const mongo = await this._ensureMongoDB(options);
                const db = mongo.db(mongodb.database);

                this._mongoDb = db;
                const users = db.collection<MongoDBAuthUser>(
                    USERS_COLLECTION_NAME
                );
                const studios = db.collection<MongoDBStudio>(
                    STUDIOS_COLLECTION_NAME
                );
                const recordsCollection = db.collection<Record>(
                    RECORDS_COLLECTION_NAME
                );
                const recordsDataCollection =
                    db.collection<DataRecord>('recordsData');
                const manualRecordsDataCollection =
                    db.collection<DataRecord>('manualRecordsData');
                const recordsFilesCollection =
                    db.collection<any>('recordsFilesInfo');
                const recordsEventsCollection =
                    db.collection<any>('recordsEvents');
                const configuration = db.collection<any>('configuration');

                const policies = db.collection<any>('policies');
                const roles = db.collection<any>('roles');

                this._configStore = new MongoDBConfigurationStore(
                    {
                        subscriptions:
                            options.subscriptions as SubscriptionConfiguration,
                    },
                    configuration
                );
                this._metricsStore = new MongoDBMetricsStore(
                    recordsDataCollection,
                    recordsFilesCollection,
                    recordsEventsCollection,
                    studios,
                    recordsCollection,
                    users,
                    db,
                    this._configStore
                );
                const authStore = new MongoDBAuthStore(db);
                this._authStore = authStore;
                this._recordsStore = authStore;
                this._policyStore = new MongoDBPolicyStore(
                    policies,
                    roles,
                    users
                );
                this._dataStore = new MongoDBDataRecordsStore(
                    recordsDataCollection
                );
                this._eventsStore = new MongoDBEventRecordsStore(
                    recordsEventsCollection
                );
                this._manualDataStore = new MongoDBDataRecordsStore(
                    manualRecordsDataCollection
                );
                const fileLookup = new MongoDBFileRecordsLookup(
                    recordsFilesCollection
                );
                this._filesStore = new MongoDBFileRecordsStore(
                    fileLookup,
                    mongodb.fileUploadUrl as string
                );
            },
        });
        return this;
    }

    usePrismaWithS3(
        options: Pick<BuilderOptions, 'prisma' | 's3' | 'subscriptions'> = this
            ._options
    ): this {
        console.log('[ServerBuilder] Using Prisma with S3.');
        if (!options.prisma) {
            throw new Error('Prisma options must be provided.');
        }

        if (!options.s3) {
            throw new Error('S3 options must be provided.');
        }

        const prisma = options.prisma;
        const s3 = options.s3;

        const prismaClient = this._ensurePrisma(options);
        const s3Client = this._ensureS3(options);
        this._configStore = this._ensurePrismaConfigurationStore(
            prismaClient,
            options
        );
        this._metricsStore = new PrismaMetricsStore(
            prismaClient,
            this._configStore
        );
        this._authStore = new PrismaAuthStore(prismaClient);
        this._privoStore = new PrismaPrivoStore(prismaClient);
        this._recordsStore = new PrismaRecordsStore(prismaClient);
        this._policyStore = this._ensurePrismaPolicyStore(
            prismaClient,
            options
        );
        this._dataStore = new PrismaDataRecordsStore(prismaClient);
        this._manualDataStore = new PrismaDataRecordsStore(prismaClient, true);
        const filesLookup = new PrismaFileRecordsLookup(prismaClient);
        this._filesStore = new S3FileRecordsStore(
            s3.region,
            s3.filesBucket,
            filesLookup,
            s3.filesStorageClass,
            s3Client,
            s3.host,
            undefined
        );
        this._eventsStore = new PrismaEventRecordsStore(prismaClient);

        return this;
    }

    usePrismaWithMongoDBFileStore(
        options: Pick<
            BuilderOptions,
            'prisma' | 'mongodb' | 'subscriptions'
        > = this._options
    ): this {
        console.log('[ServerBuilder] Using Prisma with MongoDB File Store.');
        if (!options.prisma) {
            throw new Error('Prisma options must be provided.');
        }

        if (!options.mongodb) {
            throw new Error('MongoDB options must be provided.');
        }

        const mongodb = options.mongodb;
        const prismaClient = this._ensurePrisma(options);
        this._configStore = this._ensurePrismaConfigurationStore(
            prismaClient,
            options
        );
        this._metricsStore = new PrismaMetricsStore(
            prismaClient,
            this._configStore
        );
        this._authStore = new PrismaAuthStore(prismaClient);
        this._privoStore = new PrismaPrivoStore(prismaClient);
        this._recordsStore = new PrismaRecordsStore(prismaClient);

        this._policyStore = this._ensurePrismaPolicyStore(
            prismaClient,
            options
        );
        this._dataStore = new PrismaDataRecordsStore(prismaClient);
        this._manualDataStore = new PrismaDataRecordsStore(prismaClient, true);
        const filesLookup = new PrismaFileRecordsLookup(prismaClient);
        this._eventsStore = new PrismaEventRecordsStore(prismaClient);

        this._actions.push({
            priority: 0,
            action: async () => {
                const mongo = await this._ensureMongoDB(options);
                const db = mongo.db(mongodb.database);
                this._mongoDb = db;
                this._filesStore = new MongoDBFileRecordsStore(
                    filesLookup,
                    mongodb.fileUploadUrl as string
                );
            },
        });

        return this;
    }

    useRedisWebsocketConnectionStore(
        options: Pick<BuilderOptions, 'redis'> = this._options
    ): this {
        console.log('[ServerBuilder] Using Redis Websocket Connection Store.');
        if (!options.redis) {
            throw new Error('Redis options must be provided.');
        }

        if (!options.redis.websocketConnectionNamespace) {
            throw new Error(
                'Redis websocket connection namespace must be provided.'
            );
        }

        const redis = this._ensureRedis(options);
        this._websocketConnectionStore = new RedisWebsocketConnectionStore(
            options.redis.websocketConnectionNamespace,
            redis,
            options.redis.connectionAuthorizationCacheSeconds
        );

        return this;
    }

    useApiGatewayWebsocketMessenger(
        options: Pick<BuilderOptions, 'apiGateway' | 's3'> = this._options
    ): this {
        console.log('[ServerBuilder] Using API Gateway Websocket Messenger.');

        if (!options.apiGateway) {
            throw new Error('API Gateway options must be provided.');
        }

        if (!options.s3) {
            throw new Error('S3 options must be provided.');
        }

        if (!options.s3.messagesBucket) {
            throw new Error('S3 messages bucket must be configured.');
        }

        if (!this._websocketConnectionStore) {
            throw new Error(
                'A websocket connection store must be configured before using API Gateway Websocket Messenger.'
            );
        }

        const s3 = this._ensureS3(options);
        this._websocketMessenger = new ApiGatewayWebsocketMessenger(
            options.apiGateway.endpoint,
            options.s3.messagesBucket,
            s3,
            this._websocketConnectionStore
        );

        return this;
    }

    useWSWebsocketMessenger(
        options: Pick<BuilderOptions, 'ws'> = this._options
    ): this {
        console.log('[ServerBuilder] Using WS Websocket Messenger.');

        if (!options.ws) {
            throw new Error('WS options must be provided.');
        }

        this._websocketMessenger = new WSWebsocketMessenger();

        return this;
    }

    usePrismaAndRedisInstRecords(
        options: Pick<BuilderOptions, 'prisma' | 'redis'> = this._options
    ): this {
        console.log('[ServerBuilder] Using Prisma and Redis Inst Records.');

        if (!options.prisma) {
            throw new Error('Prisma options must be provided.');
        }

        if (!options.redis) {
            throw new Error('Redis options must be provided.');
        }

        if (!this._websocketConnectionStore) {
            throw new Error(
                'A websocket connection store must be configured before using Inst Records.'
            );
        }

        if (!this._websocketMessenger) {
            throw new Error(
                'A websocket messenger must be configured before using Inst Records.'
            );
        }

        if (!options.redis.tempInstRecordsStoreNamespace) {
            throw new Error(
                'Redis temp inst records store namespace must be provided.'
            );
        }

        if (!options.redis.instRecordsStoreNamespace) {
            throw new Error(
                'Redis inst records store namespace must be provided.'
            );
        }

        const redis = this._ensureRedis(options);
        const prisma = this._ensurePrisma(options);

        this._tempInstRecordsStore = new RedisTempInstRecordsStore(
            options.redis.tempInstRecordsStoreNamespace,
            redis
        );
        this._instRecordsStore = new SplitInstRecordsStore(
            new RedisTempInstRecordsStore(
                options.redis.instRecordsStoreNamespace,
                redis,
                options.redis.publicInstRecordsLifetimeSeconds,
                options.redis.publicInstRecordsLifetimeExpireMode
            ),
            new PrismaInstRecordsStore(prisma)
        );

        return this;
    }

    useAllowedApiOrigins(origins: Set<string>): this {
        console.log('[ServerBuilder] Using API origins:', origins);
        this._allowedApiOrigins = origins;
        return this;
    }

    useAllowedAccountOrigins(origins: Set<string>): this {
        console.log('[ServerBuilder] Using account origins:', origins);
        this._allowedAccountOrigins = origins;
        return this;
    }

    useLivekit(options: Pick<BuilderOptions, 'livekit'> = this._options): this {
        console.log('[ServerBuilder] Using Livekit.');
        if (
            !options.livekit ||
            !options.livekit.apiKey ||
            !options.livekit.secretKey ||
            !options.livekit.endpoint
        ) {
            throw new Error('Livekit options must be provided.');
        }
        this._livekitController = new LivekitController(
            options.livekit.apiKey,
            options.livekit.secretKey,
            options.livekit.endpoint
        );
        return this;
    }

    useTextItAuthMessenger(
        options: Pick<BuilderOptions, 'textIt'> = this._options
    ): this {
        console.log('[ServerBuilder] Using TextIt Auth Messenger.');
        if (!options.textIt) {
            throw new Error('TextIt options must be provided.');
        }
        this._authMessenger = new TextItAuthMessenger(
            options.textIt.apiKey,
            options.textIt.flowId
        );
        return this;
    }

    useSesAuthMessenger(
        options: Pick<BuilderOptions, 'ses'> = this._options
    ): this {
        console.log('[ServerBuilder] Using SES Auth Messenger.');
        if (!options.ses) {
            throw new Error('SES options must be provided.');
        }
        let ses = new SESv2();
        this._authMessenger = new SimpleEmailServiceAuthMessenger(
            ses,
            options.ses as SimpleEmailServiceAuthMessengerOptions
        );

        this._subscription.add(() => {
            ses.destroy();
        });

        return this;
    }

    useConsoleAuthMessenger(): this {
        console.log('[ServerBuilder] Using Console Auth Messenger.');
        this._authMessenger = new ConsoleAuthMessenger();
        return this;
    }

    useRedisRateLimit(
        options: Pick<BuilderOptions, 'redis' | 'rateLimit'> = this._options
    ): this {
        console.log('[ServerBuilder] Using Redis Rate Limiter.');
        if (!options.redis) {
            throw new Error('Redis options must be provided.');
        }
        if (!options.rateLimit) {
            throw new Error('Rate limit options must be provided.');
        }
        const client = this._ensureRedis(options);
        const store = new RedisRateLimitStore({
            sendCommand: (command: string, ...args: string[]) => {
                return this._redis.sendCommand([command, ...args]);
            },
        });
        this._initActions.push({
            priority: 11,
            action: async () => {
                await store.setup();
            },
        });
        store.prefix = options.redis.rateLimitPrefix;

        this._rateLimitController = new RateLimitController(store, {
            maxHits: options.rateLimit.maxHits,
            windowMs: options.rateLimit.windowMs,
        });

        return this;
    }

    useMongoDBRateLimit(
        options: Pick<BuilderOptions, 'rateLimit'> = this._options
    ): this {
        console.log('[ServerBuilder] Using MongoDB Rate Limiter.');
        if (
            !options.rateLimit ||
            !options.rateLimit.maxHits ||
            !options.rateLimit.windowMs
        ) {
            throw new Error('Rate limit options must be provided.');
        }
        this._actions.push({
            priority: 1,
            action: async () => {
                if (!this._mongoClient) {
                    throw new Error(
                        'useMongoDB() must be called in order to configure MongoDB rate limiting.'
                    );
                }
                if (
                    !options.rateLimit ||
                    !options.rateLimit.maxHits ||
                    !options.rateLimit.windowMs
                ) {
                    throw new Error('Rate limit options must be provided.');
                }
                const db = this._mongoDb;
                const rateLimits = db.collection<any>('rateLimits');
                this._rateLimitController = new RateLimitController(
                    new MongoDBRateLimiter(rateLimits),
                    {
                        maxHits: options.rateLimit.maxHits,
                        windowMs: options.rateLimit.windowMs,
                    }
                );
            },
        });
        return this;
    }

    useStripeSubscriptions(
        options: Pick<BuilderOptions, 'subscriptions' | 'stripe'> = this
            ._options
    ): this {
        console.log('[ServerBuilder] Using Stripe subscriptions.');
        if (!options.stripe) {
            throw new Error('Stripe options must be provided.');
        }
        if (!options.subscriptions) {
            throw new Error('Subscription options must be provided.');
        }
        if (options.stripe.testClock) {
            console.log(
                '[ServerBuilder] Using test clock: ',
                options.stripe.testClock
            );
        }
        this._stripe = new StripeIntegration(
            new Stripe(options.stripe.secretKey, {
                apiVersion: '2022-11-15',
            }),
            options.stripe.publishableKey,
            options.stripe.testClock
        );
        this._subscriptionConfig = options.subscriptions as any;
        return this;
    }

    usePrivo(options: Pick<BuilderOptions, 'privo'> = this._options): this {
        console.log('[ServerBuilder] Using Privo.');
        if (!options.privo) {
            throw new Error('Privo options must be provided');
        }

        if (!this._configStore) {
            throw new Error('A config store must be configured!');
        }

        if (!this._privoStore) {
            throw new Error('A privo store must be configured!');
        }
        this._privoClient = new PrivoClient(
            this._privoStore,
            this._configStore
        );

        this._initActions.push({
            priority: 20,
            action: async () => {
                await this._privoClient.init();
            },
        });

        return this;
    }

    useAI(
        options: Pick<
            BuilderOptions,
            'openai' | 'ai' | 'blockadeLabs' | 'stabilityai'
        > = this._options
    ): this {
        console.log('[ServerBuilder] Using AI.');
        if (!options.ai) {
            throw new Error('AI options must be provided.');
        }

        if (options.openai && options.ai.chat?.provider === 'openai') {
            console.log('[ServerBuilder] Using OpenAI Chat.');
            this._chatInterface = new OpenAIChatInterface({
                apiKey: options.openai.apiKey,
            });
        }

        if (
            options.blockadeLabs &&
            options.ai.generateSkybox?.provider === 'blockadeLabs'
        ) {
            console.log(
                '[ServerBuilder] Using Blockade Labs Skybox Generation.'
            );
            this._generateSkyboxInterface =
                new BlockadeLabsGenerateSkyboxInterface({
                    apiKey: options.blockadeLabs.apiKey,
                });
        }

        if (options.ai.images) {
            this._imagesInterfaces = {};
            if (options.ai.images?.allowedModels?.openai && options.openai) {
                console.log('[ServerBuilder] Using OpenAI Images.');
                this._imagesInterfaces.openai = new OpenAIImageInterface({
                    apiKey: options.openai.apiKey,
                    defaultWidth: options.ai.images.defaultWidth,
                    defaultHeight: options.ai.images.defaultHeight,
                });
            }

            if (
                options.ai.images?.allowedModels?.stabilityai &&
                options.stabilityai
            ) {
                console.log('[ServerBuilder] Using StabilityAI Images.');

                this._imagesInterfaces.stabilityai =
                    new StabilityAIImageInterface({
                        apiKey: options.stabilityai.apiKey,
                        defaultWidth: options.ai.images.defaultWidth,
                        defaultHeight: options.ai.images.defaultHeight,
                    });
            }
        }

        this._aiConfiguration = {
            chat: null,
            generateSkybox: null,
            images: null,
            config: this._configStore,
            metrics: this._metricsStore,
        };

        if (this._chatInterface && options.ai.chat) {
            this._aiConfiguration.chat = {
                interface: this._chatInterface,
                options: {
                    defaultModel: options.ai.chat.defaultModel,
                    allowedChatModels: options.ai.chat.allowedModels,
                    allowedChatSubscriptionTiers:
                        options.ai.chat.allowedSubscriptionTiers,
                },
            };
        }
        if (this._generateSkyboxInterface && options.ai.generateSkybox) {
            this._aiConfiguration.generateSkybox = {
                interface: this._generateSkyboxInterface,
                options: {
                    allowedSubscriptionTiers:
                        options.ai.generateSkybox.allowedSubscriptionTiers,
                },
            };
        }
        if (this._imagesInterfaces && options.ai.images) {
            const images = options.ai.images;
            this._aiConfiguration.images = {
                interfaces: this._imagesInterfaces,
                options: {
                    allowedModels: images.allowedModels,
                    allowedSubscriptionTiers: images.allowedSubscriptionTiers,
                    defaultHeight: images.defaultHeight,
                    defaultWidth: images.defaultWidth,
                    maxHeight: images.maxHeight,
                    maxWidth: images.maxWidth,
                    defaultModel: images.defaultModel,
                    maxImages: images.maxImages,
                    maxSteps: images.maxSteps,
                },
            };
        }
        return this;
    }

    async buildAsync() {
        const actions = sortBy(this._actions, (a) => a.priority);

        for (let action of actions) {
            await action.action();
        }
        this._actions = [];
        return this.build();
    }

    build() {
        if (this._actions.length > 0) {
            throw new Error(
                'Some setup actions require async setup. Use buildAsync() instead.'
            );
        }

        if (!this._authStore) {
            throw new Error('An auth store must be configured!');
        }
        if (!this._authMessenger) {
            throw new Error('An auth messenger must be configured!');
        }
        if (!this._recordsStore) {
            throw new Error('A records store must be configured!');
        }
        if (!this._policyStore) {
            throw new Error('A policy store must be configured!');
        }
        if (!this._dataStore) {
            throw new Error('A data store must be configured!');
        }
        if (!this._manualDataStore) {
            throw new Error('A manual data store must be configured!');
        }
        if (!this._filesStore) {
            throw new Error('A files store must be configured!');
        }
        if (!this._eventsStore) {
            throw new Error('An events store must be configured!');
        }
        if (!this._metricsStore) {
            throw new Error('A metrics store must be configured!');
        }
        if (!this._configStore) {
            throw new Error('A config store must be configured!');
        }

        if (!this._rateLimitController) {
            console.log('[ServerBuilder] Not using rate limiting.');
        }

        if (!this._stripe) {
            console.log('[ServerBuilder] Not using Stripe.');
        }

        if (this._forceAllowAllSubscriptionFeatures) {
            console.log(
                '[ServerBuilder] Allowing all subscription features because Stripe is not configured.'
            );
        }

        this._authController = new AuthController(
            this._authStore,
            this._authMessenger,
            this._configStore,
            this._forceAllowAllSubscriptionFeatures,
            this._privoClient
        );
        this._recordsController = new RecordsController({
            store: this._recordsStore,
            auth: this._authStore,
            config: this._configStore,
            metrics: this._metricsStore,
        });
        this._policyController = new PolicyController(
            this._authController,
            this._recordsController,
            this._policyStore
        );
        this._dataController = new DataRecordsController({
            store: this._dataStore,
            config: this._configStore,
            policies: this._policyController,
            metrics: this._metricsStore,
        });
        this._manualDataController = new DataRecordsController({
            store: this._manualDataStore,
            config: this._configStore,
            policies: this._policyController,
            metrics: this._metricsStore,
        });
        this._filesController = new FileRecordsController({
            store: this._filesStore,
            config: this._configStore,
            policies: this._policyController,
            metrics: this._metricsStore,
        });
        this._eventsController = new EventRecordsController({
            store: this._eventsStore,
            config: this._configStore,
            policies: this._policyController,
            metrics: this._metricsStore,
        });

        if (this._stripe && this._subscriptionConfig) {
            this._subscriptionController = new SubscriptionController(
                this._stripe,
                this._authController,
                this._authStore,
                this._recordsStore,
                this._configStore
            );
        }

        if (this._aiConfiguration) {
            this._aiController = new AIController(this._aiConfiguration);
        }

        if (
            this._websocketConnectionStore &&
            this._websocketMessenger &&
            this._instRecordsStore &&
            this._tempInstRecordsStore
        ) {
            this._websocketController = new WebsocketController(
                this._websocketConnectionStore,
                this._websocketMessenger,
                this._instRecordsStore,
                this._tempInstRecordsStore,
                this._authController,
                this._policyController,
                this._configStore,
                this._metricsStore,
                this._authStore
            );
        }

        const server = new RecordsServer(
            this._allowedAccountOrigins,
            this._allowedApiOrigins,
            this._authController,
            this._livekitController,
            this._recordsController,
            this._eventsController,
            this._dataController,
            this._manualDataController,
            this._filesController,
            this._subscriptionController,
            this._rateLimitController,
            this._policyController,
            this._aiController,
            this._websocketController
        );

        return {
            server,
            authController: this._authController,
            recordsController: this._recordsController,
            eventsController: this._eventsController,
            dataController: this._dataController,
            manualDataController: this._manualDataController,
            filesController: this._filesController,
            filesStore: this._filesStore,
            subscriptionController: this._subscriptionController,
            rateLimitController: this._rateLimitController,
            policyController: this._policyController,
            websocketController: this._websocketController,

            dynamodbClient: this._docClient,
            mongoClient: this._mongoClient,
            mongoDatabase: this._mongoDb,
            websocketMessenger: this._websocketMessenger,
        };
    }

    /**
     * Ensures that all the initialization actions have been performed.
     * Returns a promise that resolves when the actions have been performed.
     */
    ensureInitialized() {
        if (!this._initPromise) {
            this._initPromise = this._initCore();
        }

        return this._initPromise;
    }

    private async _initCore(): Promise<void> {
        console.log('[ServerBuilder] Running initialization actions...');
        let actions = sortBy(this._initActions, (a) => a.priority);
        for (let action of actions) {
            await action.action();
        }
        console.log('[ServerBuilder] Done.');
    }

    private _ensureRedis(
        options: Pick<BuilderOptions, 'redis'>
    ): RedisClientType {
        if (!this._redis) {
            let retryStrategy = (retries: number, error: Error) => {
                // reconnect after min(100ms per attempt, 3 seconds)
                return Math.min(retries * 100, 3000);
            };
            if (options.redis.url) {
                this._redis = createRedisClient({
                    url: options.redis.url,
                    socket: {
                        reconnectStrategy: retryStrategy,
                    },
                });
            } else {
                if (!options.redis.host) {
                    throw new Error(
                        'Redis host must be provided if a URL is not specified.'
                    );
                }
                this._redis = createRedisClient({
                    socket: {
                        host: options.redis.host,
                        port: options.redis.port,
                        tls: options.redis.tls,
                        reconnectStrategy: retryStrategy,
                    },
                    password: options.redis.password,
                });
            }
            this._initActions.push({
                priority: 10,
                action: async () => {
                    await this._redis.connect();
                },
            });
            this._subscription.add(() => {
                this._redis.quit();
            });
        }

        return this._redis;
    }

    private _ensurePrisma(
        options: Pick<BuilderOptions, 'prisma'>
    ): PrismaClient {
        if (!this._prismaClient) {
            this._prismaClient = new PrismaClient(
                options.prisma.options as any
            );
            this._subscription.add(() => {
                this._prismaClient.$disconnect();
            });
        }

        return this._prismaClient;
    }

    private _ensureS3(options: Pick<BuilderOptions, 's3'>): S3 {
        if (!this._s3) {
            this._s3 = new S3();
            this._subscription.add(() => {
                this._s3.destroy();
            });
        }
        return this._s3;
    }

    private async _ensureMongoDB(
        options: Pick<BuilderOptions, 'mongodb'>
    ): Promise<MongoClient> {
        if (!this._mongoClient) {
            const connect = pify(MongoClient.connect);
            const mongo: MongoClient = await connect(options.mongodb.url, {
                useNewUrlParser: options.mongodb.useNewUrlParser,
            });
            this._mongoClient = mongo;
            this._subscription.add(() => {
                mongo.close();
            });
        }

        return this._mongoClient;
    }

    private _ensurePrismaPolicyStore(
        prismaClient: PrismaClient,
        options: Pick<BuilderOptions, 'prisma'>
    ): PolicyStore {
        const policyStore = new PrismaPolicyStore(prismaClient);
        if (this._multiCache && options.prisma.policiesCacheSeconds) {
            const cache = this._multiCache.getCache('policies');
            return new CachingPolicyStore(
                policyStore,
                cache,
                options.prisma.policiesCacheSeconds
            );
        } else {
            return policyStore;
        }
    }

    private _ensurePrismaConfigurationStore(
        prismaClient: PrismaClient,
        options: Pick<BuilderOptions, 'prisma' | 'subscriptions' | 'privo'>
    ): ConfigurationStore {
        const configStore = new PrismaConfigurationStore(prismaClient, {
            subscriptions: options.subscriptions as SubscriptionConfiguration,
            privo: options.privo as PrivoConfiguration,
        });
        if (this._multiCache && options.prisma.configurationCacheSeconds) {
            const cache = this._multiCache.getCache('config');
            return new CachingConfigStore(
                configStore,
                cache,
                options.prisma.configurationCacheSeconds
            );
        } else {
            return configStore;
        }
    }
}

/**
 * The schema for the S3 configuration.
 */
const s3Schema = z.object({
    region: z
        .string()
        .describe(
            'The region of the file records and websocket message buckets.'
        )
        .nonempty(),
    filesBucket: z
        .string()
        .describe(
            'The name of the bucket that file records should be placed in.'
        )
        .nonempty(),
    filesStorageClass: z
        .string()
        .describe(
            'The S3 File Storage Class that should be used for file records.'
        )
        .nonempty(),

    messagesBucket: z
        .string()
        .describe(
            'The name of the bucket that large websocket messages should be placed in.'
        )
        .nonempty()
        .optional(),

    options: z
        .object({
            endpoint: z
                .string()
                .describe('The endpoint of the S3 API.')
                .nonempty()
                .optional(),
            s3ForcePathStyle: z
                .boolean()
                .describe(
                    'Wether to force the S3 client to use the path style API. Defaults to false.'
                )
                .optional(),
        })
        .describe('Options for the S3 client.'),

    host: z
        .string()
        .describe(
            'The S3 host that should be used for file record storage. If omitted, then the default S3 host will be used.'
        )
        .nonempty()
        .optional(),
});

const livekitSchema = z.object({
    apiKey: z
        .string()
        .describe('The API Key for Livekit.')
        .nonempty()
        .nullable(),
    secretKey: z
        .string()
        .describe('The secret key for Livekit.')
        .nonempty()
        .nullable(),
    endpoint: z
        .string()
        .describe('The URL that the Livekit server is publicly available at.')
        .nonempty()
        .nullable(),
});

const textItSchema = z.object({
    apiKey: z
        .string()
        .describe('The API Key for TextIt.')
        .nonempty()
        .nullable(),
    flowId: z
        .string()
        .describe(
            'The ID of the flow that should be triggered for sending login codes.'
        )
        .nonempty()
        .nullable(),
});

const sesContentSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('template'),
        templateArn: z
            .string()
            .describe('The ARN of the SES email template that should be used.')
            .nonempty(),
    }),
    z.object({
        type: z.literal('plain'),
        subject: z.string().describe('The subject of the email.').nonempty(),
        body: z
            .string()
            .describe(
                'The body of the email. Use double curly-braces {{variable}} to insert variables.'
            )
            .nonempty(),
    }),
]);

const sesSchema = z.object({
    fromAddress: z
        .string()
        .describe('The email address that SES messages should be sent from.')
        .nonempty(),
    content: sesContentSchema.describe(
        'The content that should be sent in login codes in emails.'
    ),
});

const redisSchema = z.object({
    url: z
        .string()
        .describe(
            'The Redis connection URL that should be used. If omitted, then host, port, and password must be provided.'
        )
        .nonempty()
        .optional(),
    host: z
        .string()
        .describe(
            'The host that the redis client should connect to. Ignored if url is provided.'
        )
        .nonempty()
        .optional(),
    port: z
        .number()
        .describe(
            'The port that the redis client should connect to. Ignored if url is provided.'
        )
        .optional(),
    password: z
        .string()
        .describe(
            'The password that the redis client should use. Ignored if url is provided.'
        )
        .nonempty()
        .optional(),
    tls: z
        .boolean()
        .describe(
            'Whether to use TLS for connecting to the Redis server. Ignored if url is provided.'
        )
        .optional(),

    rateLimitPrefix: z
        .string()
        .describe(
            'The namespace that rate limit counters are stored under. If omitted, then redis rate limiting is not possible.'
        )
        .nonempty()
        .optional(),

    websocketConnectionNamespace: z
        .string()
        .describe(
            'The namespace that websocket connections are stored under. If omitted, then redis inst records are not possible.'
        )
        .optional(),
    instRecordsStoreNamespace: z
        .string()
        .describe(
            'The namespace that inst records are stored under. If omitted, then redis inst records are not possible.'
        )
        .optional(),
    publicInstRecordsLifetimeSeconds: z
        .number()
        .describe(
            'The lifetime of public inst records in seconds. If null, then public inst records never expire. Defaults to 1 day in seconds (86,400)'
        )
        .positive()
        .nullable()
        .optional()
        .default(60 * 60 * 24),
    publicInstRecordsLifetimeExpireMode: z
        .union([
            z.literal('NX').describe('The Redis NX expire mode.'),
            z.literal('XX').describe('The Redis XX expire mode.'),
            z.literal('GT').describe('The Redis GT expire mode.'),
            z.literal('LT').describe('The Redis LT expire mode.'),
            z.null().describe('The expiration will be updated every time.'),
        ])
        .describe(
            'The Redis expire mode that should be used for public inst records. Defaults to NX. If null, then the expiration will update every time the inst data is updated. Only supported on Redis 7+. If set to something not null on Redis 6, then errors will occur.'
        )
        .optional()
        .default('NX'),

    tempInstRecordsStoreNamespace: z
        .string()
        .describe(
            'The namespace that temporary inst records are stored under. If omitted, then redis inst records are not possible.'
        )
        .optional(),

    // The number of seconds that authorizations for repo/add_updates permissions (inst.read and inst.updateData) are cached for.
    // Because repo/add_updates is a very common permission, we periodically cache permissions to avoid hitting the database too often.
    // 5 minutes by default
    connectionAuthorizationCacheSeconds: z
        .number()
        .describe(
            `The number of seconds that authorizations for repo/add_updates permissions (inst.read and inst.updateData) are cached for.
Because repo/add_updates is a very common permission, we periodically cache permissions to avoid hitting the database too often. Defaults to 5 minutes.`
        )
        .positive()
        .default(300),

    cacheNamespace: z
        .string()
        .describe(
            'The namespace for cached items. (policies & configuration) Defaults to "/cache". Set to null to disable caching of policies and configuration.'
        )
        .nonempty()
        .nullable()
        .optional()
        .default('/cache'),
});

const rateLimitSchema = z.object({
    maxHits: z
        .number()
        .describe(
            'The maximum number of hits allowed from a single IP Address within the window.'
        )
        .positive(),
    windowMs: z
        .number()
        .describe('The size of the window in miliseconds.')
        .positive(),
});

const stripeSchema = z.object({
    secretKey: z
        .string()
        .describe('The Stripe secret key that should be used.')
        .nonempty(),
    publishableKey: z
        .string()
        .describe('The Stripe publishable key that should be used.')
        .nonempty(),
    testClock: z
        .string()
        .describe('The stripe test clock that should be used.')
        .nonempty()
        .optional(),
});

const mongodbSchema = z.object({
    url: z
        .string()
        .describe('The MongoDB URL that should be used to connect to MongoDB.')
        .nonempty(),
    useNewUrlParser: z
        .boolean()
        .describe('Whether to use the new URL parser. Defaults to false.')
        .optional()
        .default(false),
    database: z
        .string()
        .describe('The database that should be used.')
        .nonempty(),
    fileUploadUrl: z
        .string()
        .describe('The URL that files records need to be uploaded to.')
        .nonempty()
        .optional(),
});

const prismaSchema = z.object({
    options: z
        .object({})
        .describe(
            'Generic options that should be passed to the Prisma client constructor.'
        )
        .passthrough()
        .optional(),

    policiesCacheSeconds: z
        .number()
        .describe(
            'The number of seconds that policies are cached for. Defaults to 60 seconds. Set to null to disable caching of policies.'
        )
        .positive()
        .nullable()
        .optional()
        .default(60),
    configurationCacheSeconds: z
        .number()
        .describe(
            'The number of seconds that configuration items are cached for. Defaults to 60 seconds. Set to null to disable caching of configuration items.'
        )
        .positive()
        .nullable()
        .optional()
        .default(60),
});

const openAiSchema = z.object({
    apiKey: z
        .string()
        .describe('The OpenAI API Key that should be used.')
        .nonempty(),
});

const blockadeLabsSchema = z.object({
    apiKey: z
        .string()
        .describe('The Blockade Labs API Key that should be used.')
        .nonempty(),
});

const stabilityAiSchema = z.object({
    apiKey: z
        .string()
        .describe('The StabilityAI API Key that should be used.')
        .nonempty(),
});

const aiSchema = z.object({
    chat: z
        .object({
            provider: z
                .literal('openai')
                .describe(
                    'The provider that should be used for Chat AI requests.'
                ),
            defaultModel: z
                .string()
                .describe(
                    'The model that should be used for Chat AI requests when one is not specified.'
                )
                .nonempty(),
            allowedModels: z
                .array(z.string().nonempty())
                .describe(
                    'The list of models that are allowed to be used for Chat AI requets.'
                ),
            allowedSubscriptionTiers: z
                .union([z.literal(true), z.array(z.string().nonempty())])
                .describe(
                    'The subscription tiers that are allowed to use Chat AI. If true, then all tiers are allowed.'
                ),
        })
        .describe('Options for Chat AI. If omitted, then chat AI is disabled.')
        .optional(),
    generateSkybox: z
        .object({
            provider: z
                .literal('blockadeLabs')
                .describe(
                    'The provider that should be used for Skybox Generation AI requests.'
                ),
            allowedSubscriptionTiers: z
                .union([z.literal(true), z.array(z.string().nonempty())])
                .describe(
                    'The subscription tiers that are allowed to use Skybox AI. If true, then all tiers are allowed.'
                ),
        })
        .describe(
            'Options for Skybox Generation AI. If omitted, then Skybox AI is disabled.'
        )
        .optional(),
    images: z
        .object({
            defaultModel: z
                .string()
                .describe(
                    'The model that should be used for Image AI requests when one is not specified.'
                )
                .nonempty(),
            defaultWidth: z
                .number()
                .describe('The default width of generated images.')
                .int()
                .positive(),
            defaultHeight: z
                .number()
                .describe('The default height of generated images.')
                .int()
                .positive(),
            maxWidth: z
                .number()
                .describe(
                    'The maximum width of generated images. If omitted, then the max width is controlled by the model.'
                )
                .int()
                .positive()
                .optional(),
            maxHeight: z
                .number()
                .describe(
                    'The maximum height of generated images. If omitted, then the max height is controlled by the model.'
                )
                .int()
                .positive()
                .optional(),
            maxSteps: z
                .number()
                .describe(
                    'The maximum number of steps that can be used to generate an image. If omitted, then the max steps is controlled by the model.'
                )
                .int()
                .positive()
                .optional(),
            maxImages: z
                .number()
                .describe(
                    'The maximum number of images that can be generated in a single request. If omitted, then the max images is controlled by the model.'
                )
                .int()
                .positive()
                .optional(),
            allowedModels: z
                .object({
                    openai: z
                        .array(z.string().nonempty())
                        .describe(
                            'The list of OpenAI DALL-E models that are allowed to be used. If omitted, then no OpenAI models are allowed.'
                        )
                        .optional(),
                    stabilityai: z
                        .array(z.string().nonempty())
                        .describe(
                            'The list of StabilityAI models that are allowed to be used. If omitted, then no StabilityAI models are allowed.'
                        )
                        .optional(),
                })
                .describe(
                    'The models that are allowed to be used from each provider.'
                ),
            allowedSubscriptionTiers: z
                .union([z.literal(true), z.array(z.string().nonempty())])
                .describe(
                    'The subscription tiers that are allowed to use Image AI. If true, then all tiers are allowed.'
                ),
        })
        .describe(
            'Options for Image AI. If omitted, then Image AI is disabled.'
        )
        .optional(),
});

const apiGatewaySchema = z.object({
    endpoint: z
        .string()
        .describe(
            'The API Gateway endpoint that should be used for sending messages to connected clients.'
        ),
});

const wsSchema = z.object({});

export const optionsSchema = z.object({
    s3: s3Schema
        .describe(
            'S3 Configuration Options. If omitted, then S3 cannot be used for file storage.'
        )
        .optional(),
    apiGateway: apiGatewaySchema
        .describe(
            'AWS API Gateway configuration options. If omitted, then inst records cannot be used on AWS Lambda.'
        )
        .optional(),
    mongodb: mongodbSchema
        .describe(
            'MongoDB configuration options. If omitted, then MongoDB cannot be used.'
        )
        .optional(),
    prisma: prismaSchema
        .describe(
            'Prisma configuration options. If omitted, then Prisma (CockroachDB) cannot be used.'
        )
        .optional(),
    livekit: livekitSchema
        .describe(
            'Livekit configuration options. If omitted, then Livekit features will be disabled.'
        )
        .optional(),
    textIt: textItSchema
        .describe(
            'TextIt configuration options. If omitted, then SMS login will be disabled.'
        )
        .optional(),
    ses: sesSchema
        .describe(
            'AWS SES configuration options. If omitted, then sending login codes via SES is not possible.'
        )
        .optional(),
    redis: redisSchema
        .describe(
            'Redis configuration options. If omitted, then using Redis is not possible.'
        )
        .optional(),
    rateLimit: rateLimitSchema
        .describe(
            'Rate limit options. If omitted, then rate limiting will be disabled.'
        )
        .optional(),
    openai: openAiSchema
        .describe(
            'OpenAI options. If omitted, then it will not be possible to use GPT or DALL-E.'
        )
        .optional(),
    blockadeLabs: blockadeLabsSchema
        .describe(
            'Blockade Labs options. If omitted, then it will not be possible to generate skyboxes.'
        )
        .optional(),
    stabilityai: stabilityAiSchema
        .describe(
            'Stability AI options. If omitted, then it will not be possible to use Stable Diffusion.'
        )
        .optional(),
    ai: aiSchema
        .describe(
            'AI configuration options. If omitted, then all AI features will be disabled.'
        )
        .optional(),
    ws: wsSchema
        .describe(
            'WebSocket Server configuration options. If omitted, then inst records cannot be used in standalone deployments.'
        )
        .optional(),

    privo: privoSchema
        .describe(
            'Privo configuration options. If omitted, then Privo features will be disabled.'
        )
        .optional(),

    // auth: authSchema
    //     .describe('Authentication configuration options.')
    //     .optional()
    //     .default({}),

    subscriptions: subscriptionConfigSchema
        .describe(
            'The default subscription configuration. If omitted, then subscription features will be disabled.'
        )
        .optional(),
    stripe: stripeSchema
        .describe(
            'Stripe options. If omitted, then Stripe features will be disabled.'
        )
        .optional(),
});

export type S3Config = z.infer<typeof s3Schema>;
export type BuilderOptions = z.infer<typeof optionsSchema>;
