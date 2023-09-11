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
    MemoryInstRecordsStore,
    TemporaryInstRecordsStore,
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
import { RedisClient, createClient as createRedisClient } from 'redis';
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
import { PrismaClient } from '@prisma/client';
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
import { PrismaMetricsStore } from 'aux-backend/prisma/PrismaMetricsStore';
import { S3 } from '@aws-sdk/client-s3';
import { RedisTempInstRecordsStore } from 'aux-backend/redis/RedisTempInstRecordsStore';
import { RedisWebsocketConnectionStore } from 'aux-backend/redis/RedisWebsocketConnectionStore';
import { ApiGatewayWebsocketMessenger } from 'aux-backend/serverless/aws/src/ApiGatewayWebsocketMessenger';
import { Subscription, SubscriptionLike } from 'rxjs';
import { WSWebsocketMessenger } from '../ws/WSWebsocketMessenger';

export class ServerBuilder implements SubscriptionLike {
    private _docClient: DocumentClient;
    private _mongoClient: MongoClient;
    private _prismaClient: PrismaClient;
    private _mongoDb: Db;

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

    private _redis: RedisClient | null = null;
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
                this._policyStore = new MongoDBPolicyStore(policies, roles);
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
        this._configStore = new PrismaConfigurationStore(prismaClient, {
            subscriptions: options.subscriptions as SubscriptionConfiguration,
        });
        this._metricsStore = new PrismaMetricsStore(
            prismaClient,
            this._configStore
        );
        this._authStore = new PrismaAuthStore(prismaClient);
        this._recordsStore = new PrismaRecordsStore(prismaClient);
        this._policyStore = new PrismaPolicyStore(prismaClient);
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
        this._actions.push({
            priority: 0,
            action: async () => {
                const prismaClient = this._ensurePrisma(options);
                const mongo = await this._ensureMongoDB(options);
                const db = mongo.db(mongodb.database);
                this._mongoDb = db;

                this._configStore = new PrismaConfigurationStore(prismaClient, {
                    subscriptions:
                        options.subscriptions as SubscriptionConfiguration,
                });
                this._metricsStore = new PrismaMetricsStore(
                    prismaClient,
                    this._configStore
                );
                this._authStore = new PrismaAuthStore(prismaClient);
                this._recordsStore = new PrismaRecordsStore(prismaClient);
                this._policyStore = new PrismaPolicyStore(prismaClient);
                this._dataStore = new PrismaDataRecordsStore(prismaClient);
                this._manualDataStore = new PrismaDataRecordsStore(
                    prismaClient,
                    true
                );
                const filesLookup = new PrismaFileRecordsLookup(prismaClient);
                this._filesStore = new MongoDBFileRecordsStore(
                    filesLookup,
                    mongodb.fileUploadUrl as string
                );
                this._eventsStore = new PrismaEventRecordsStore(prismaClient);
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
            redis
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

        if (!this._prismaClient) {
            throw new Error(
                'Prisma must be configured before using Redis Inst Records.'
            );
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

        if (!options.redis.publicInstRecordsStoreNamespace) {
            throw new Error(
                'Redis public inst records store namespace must be provided.'
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
                options.redis.publicInstRecordsStoreNamespace,
                redis
            ),
            new MemoryInstRecordsStore()
        );

        this._websocketController = new WebsocketController(
            this._websocketConnectionStore,
            this._websocketMessenger,
            this._instRecordsStore,
            this._tempInstRecordsStore,
            this._authController
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
            sendCommand: (command: string, ...args: (string | number)[]) => {
                return new Promise((resolve, reject) => {
                    this._redis.sendCommand(command, args, (err, result) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(result);
                        }
                    });
                });
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
            this._forceAllowAllSubscriptionFeatures
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

    private _ensureRedis(options: Pick<BuilderOptions, 'redis'>): RedisClient {
        if (!this._redis) {
            this._redis = createRedisClient({
                host: options.redis.host,
                port: options.redis.port,
                password: options.redis.password,
                tls: options.redis.tls,

                retry_strategy: function (options) {
                    if (
                        options.error &&
                        options.error.code === 'ECONNREFUSED'
                    ) {
                        // End reconnecting on a specific error and flush all commands with
                        // a individual error
                        return new Error('The server refused the connection');
                    }
                    // reconnect after min(100ms per attempt, 3 seconds)
                    return Math.min(options.attempt * 100, 3000);
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
}

/**
 * The schema for the DynamoDB configuration.
 */
const dynamoDbSchema = z.object({
    usersTable: z.string().nonempty(),
    userAddressesTable: z.string().nonempty(),
    loginRequestsTable: z.string().nonempty(),
    sessionsTable: z.string().nonempty(),
    emailTable: z.string().nonempty(),
    smsTable: z.string().nonempty(),
    policiesTable: z.string().nonempty(),
    rolesTable: z.string().nonempty(),
    subjectRolesTable: z.string().nonempty(),
    roleSubjectsTable: z.string().nonempty(),
    stripeCustomerIdsIndexName: z.string().nonempty(),
    publicRecordsTable: z.string().nonempty(),
    publicRecordsKeysTable: z.string().nonempty(),
    dataTable: z.string().nonempty(),
    manualDataTable: z.string().nonempty(),
    filesTable: z.string().nonempty(),
    eventsTable: z.string().nonempty(),

    endpoint: z.string().nonempty().optional(),
});

/**
 * The schema for the S3 configuration.
 */
const s3Schema = z.object({
    region: z.string().nonempty(),
    filesBucket: z.string().nonempty(),
    filesStorageClass: z.string().nonempty(),

    messagesBucket: z.string().nonempty().optional(),

    options: z.object({
        endpoint: z.string().nonempty().optional(),
        s3ForcePathStyle: z.boolean().optional(),
    }),

    host: z.string().nonempty().optional(),
});

const livekitSchema = z.object({
    apiKey: z.string().nonempty().nullable(),
    secretKey: z.string().nonempty().nullable(),
    endpoint: z.string().nonempty().nullable(),
});

const textItSchema = z.object({
    apiKey: z.string().nonempty().nullable(),
    flowId: z.string().nonempty().nullable(),
});

const sesContentSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('template'),
        templateArn: z.string().nonempty(),
    }),
    z.object({
        type: z.literal('plain'),
        subject: z.string().nonempty(),
        body: z.string().nonempty(),
    }),
]);

const sesSchema = z.object({
    fromAddress: z.string().nonempty(),
    content: sesContentSchema,
});

const redisSchema = z.object({
    host: z.string().nonempty(),
    port: z.number(),
    password: z.string().nonempty().optional(),
    tls: z.boolean(),

    causalRepoNamespace: z.string().nonempty().optional(),
    rateLimitPrefix: z.string().nonempty().optional(),

    maxBranchSizeBytes: z.number().optional(),
    mergeUpdatesOnMaxSizeExceeded: z.boolean().optional(),

    websocketConnectionNamespace: z.string().optional(),
    publicInstRecordsStoreNamespace: z.string().optional(),
    tempInstRecordsStoreNamespace: z.string().optional(),
});

const rateLimitSchema = z.object({
    maxHits: z.number().positive(),
    windowMs: z.number().positive(),
});

const stripeSchema = z.object({
    secretKey: z.string().nonempty(),
    publishableKey: z.string().nonempty(),
    testClock: z.string().nonempty().optional(),
});

const mongodbSchema = z.object({
    url: z.string().nonempty(),
    useNewUrlParser: z.boolean().optional().default(false),
    database: z.string().nonempty(),
    fileUploadUrl: z.string().nonempty().optional(),
});

const prismaSchema = z.object({
    options: z.object({}).passthrough().optional(),
});

const openAiSchema = z.object({
    apiKey: z.string().nonempty(),
});

const blockadeLabsSchema = z.object({
    apiKey: z.string().nonempty(),
});

const stabilityAiSchema = z.object({
    apiKey: z.string().nonempty(),
});

const aiSchema = z.object({
    chat: z
        .object({
            provider: z.literal('openai'),
            defaultModel: z.string().nonempty(),
            allowedModels: z.array(z.string().nonempty()),
            allowedSubscriptionTiers: z.union([
                z.literal(true),
                z.array(z.string().nonempty()),
            ]),
        })
        .optional(),
    generateSkybox: z
        .object({
            provider: z.literal('blockadeLabs'),
            allowedSubscriptionTiers: z.union([
                z.literal(true),
                z.array(z.string().nonempty()),
            ]),
        })
        .optional(),
    images: z
        .object({
            defaultModel: z.string(),
            defaultWidth: z.number().int().positive(),
            defaultHeight: z.number().int().positive(),
            maxWidth: z.number().int().positive().optional(),
            maxHeight: z.number().int().positive().optional(),
            maxSteps: z.number().int().positive().optional(),
            maxImages: z.number().int().positive().optional(),
            allowedModels: z.object({
                openai: z.array(z.string().nonempty()).optional(),
                stabilityai: z.array(z.string().nonempty()).optional(),
            }),
            allowedSubscriptionTiers: z.union([
                z.literal(true),
                z.array(z.string().nonempty()),
            ]),
        })
        .optional(),
});

const apiGatewaySchema = z.object({
    endpoint: z.string(),
});

const wsSchema = z.object({});

export const optionsSchema = z.object({
    dynamodb: dynamoDbSchema.optional(),
    s3: s3Schema.optional(),
    apiGateway: apiGatewaySchema.optional(),
    mongodb: mongodbSchema.optional(),
    prisma: prismaSchema.optional(),
    livekit: livekitSchema.optional(),
    textIt: textItSchema.optional(),
    ses: sesSchema.optional(),
    redis: redisSchema.optional(),
    rateLimit: rateLimitSchema.optional(),
    openai: openAiSchema.optional(),
    blockadeLabs: blockadeLabsSchema.optional(),
    stabilityai: stabilityAiSchema.optional(),
    ai: aiSchema.optional(),
    ws: wsSchema.optional(),

    subscriptions: subscriptionConfigSchema.optional(),
    stripe: stripeSchema.optional(),
});

export type DynamoDBConfig = z.infer<typeof dynamoDbSchema>;
export type S3Config = z.infer<typeof s3Schema>;
export type BuilderOptions = z.infer<typeof optionsSchema>;
