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
    notificationsSchema,
    NotificationMessenger,
    MultiNotificationMessenger,
    ModerationController,
    ModerationStore,
    GoogleAIChatInterface,
    RelyingParty,
    LoomController,
    ServerConfig,
    RedisServerOptions,
    AnthropicAIChatInterface,
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
import { PrismaClient } from '../prisma/generated';
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
import { PrismaPrivoStore } from '../prisma/PrismaPrivoStore';
import {
    PrivoConfiguration,
    privoSchema,
} from '@casual-simulation/aux-records/PrivoConfiguration';
import { SlackNotificationMessenger } from '../notifications/SlackNotificationMessenger';
import { TelegramNotificationMessenger } from '../notifications/TelegramNotificationMessenger';
import { PrismaModerationStore } from '../prisma/PrismaModerationStore';
import {
    ModerationConfiguration,
    moderationSchema,
} from '@casual-simulation/aux-records/ModerationConfiguration';

// @ts-ignore
import xpApiPlugins from '../../../../xpexchange/xp-api/*.server.plugin.ts';
// @ts-ignore
import casualWareApiPlugins from '../../../../extensions/casualos-casualware/casualware-api/*.server.plugin.ts';
import { HumeInterface } from '@casual-simulation/aux-records/AIHumeInterface';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import {
    ConsoleMetricExporter,
    PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { PrismaInstrumentation } from '@prisma/instrumentation';
import { Resource } from '@opentelemetry/resources';
import {
    SEMRESATTRS_SERVICE_NAME,
    SEMRESATTRS_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { SloydInterface } from '@casual-simulation/aux-records/SloydInterface';

const automaticPlugins: ServerPlugin[] = [
    ...xpApiPlugins.map((p: any) => p.default),
    ...casualWareApiPlugins.map((p: any) => p.default),
];

export interface BuildReturn {
    server: RecordsServer;
    authController: AuthController;
    recordsController: RecordsController;
    eventsController: EventRecordsController;
    dataController: DataRecordsController;
    manualDataController: DataRecordsController;
    filesController: FileRecordsController;
    filesStore: FileRecordsStore;
    subscriptionController: SubscriptionController;
    rateLimitController: RateLimitController;
    websocketRateLimitController: RateLimitController;
    policyController: PolicyController;
    websocketController: WebsocketController;
    dynamodbClient: DocumentClient;
    mongoClient: MongoClient;
    mongoDatabase: Db;
    websocketMessenger: WebsocketMessenger;
    redisClient: RedisClientType;
}

export interface ServerPlugin {
    /**
     * The name of the plugin.
     * Useful for debugging.
     */
    name: string;

    /**
     * Configures the given RecordsServer.
     * @param server The server that should be configured.
     * @param buildResults The results of the build.
     */
    configureServer(
        server: RecordsServer,
        buildResults: BuildReturn
    ): Subscription | null | void;
}

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
    private _relyingParties: RelyingParty[];

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

    private _openAIChatInterface: AIChatInterface = null;
    private _googleAIChatInterface: AIChatInterface = null;
    private _anthropicAIChatInterface: AnthropicAIChatInterface = null;
    private _aiConfiguration: AIConfiguration = null;
    private _aiController: AIController;

    private _moderationStore: ModerationStore = null;
    private _moderationController: ModerationController;
    private _loomController: LoomController;

    private _notificationMessenger: MultiNotificationMessenger;

    private _redis: RedisClientType | null = null;
    private _redisCaches: RedisClientType | null = null;
    private _redisInstData: RedisClientType | null = null;
    private _redisWebsocketConnections: RedisClientType | null = null;
    private _redisRateLimit: RedisClientType | null = null;
    private _s3: S3;
    private _rateLimitController: RateLimitController;
    private _websocketRateLimitController: RateLimitController;

    private _allowedAccountOrigins: Set<string> = new Set([
        'http://localhost:3000',
        'http://localhost:3002',
    ]);
    private _allowedApiOrigins: Set<string> = new Set([
        'http://localhost:3000',
        'http://localhost:3002',
    ]);

    private _options: ServerConfig;

    /**
     * The actions that should be performed when the server is built.
     */
    private _actions: {
        priority: number;
        action: () => Promise<void>;
    }[] = [];
    private _generateSkyboxInterface: BlockadeLabsGenerateSkyboxInterface;
    private _imagesInterfaces: AIGenerateImageConfiguration['interfaces'];

    private _plugins: ServerPlugin[] = [];

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

    constructor(options?: ServerConfig) {
        this._options = options ?? {};
        this._subscription = new Subscription();
    }

    unsubscribe(): void {
        this._subscription.unsubscribe();
    }

    get closed(): boolean {
        return this._subscription.closed;
    }

    /**
     * Configures the server to use the given plugin.
     * @param plugin The plugin that should be used.
     */
    usePlugin(plugin: ServerPlugin): this {
        console.log(`[ServerBuilder] Using plugin: ${plugin.name}`);
        this._plugins.push(plugin);
        return this;
    }

    /**
     * Configures the server to use all of the automatically imported plugins.
     */
    useAutomaticPlugins(): this {
        console.log(`[ServerBuilder] Using automatic plugins.`);
        for (let plugin of automaticPlugins) {
            this.usePlugin(plugin);
        }
        return this;
    }

    /**
     * Enables telemetry for the server.
     * Should be called first if telemetry is desired.
     * @param options The options for the server.
     */
    useTelemetry(
        options: Pick<ServerConfig, 'telemetry'> = this._options
    ): this {
        console.log(`[ServerBuilder] Using telemetry.`);
        if (!options.telemetry) {
            throw new Error('Telemetry options must be provided.');
        }

        console.log(
            `[ServerBuilder] Tracing Configuration:`,
            options.telemetry.tracing
        );

        const traceExporter =
            options.telemetry.tracing.exporter === 'console'
                ? new ConsoleSpanExporter()
                : options.telemetry.tracing.exporter === 'otlp'
                ? new OTLPTraceExporter({
                      url: options.telemetry.tracing.url,
                      headers: options.telemetry.tracing.headers,
                  })
                : null;

        console.log(
            `[ServerBuilder] Metrics Configuration:`,
            options.telemetry.metrics
        );

        const metrics =
            options.telemetry.metrics.exporter === 'none'
                ? null
                : new PeriodicExportingMetricReader({
                      exporter:
                          options.telemetry.metrics.exporter === 'console'
                              ? new ConsoleMetricExporter()
                              : options.telemetry.metrics.exporter === 'otlp'
                              ? new OTLPMetricExporter({
                                    url: options.telemetry.metrics.url,
                                    headers: options.telemetry.metrics.headers,
                                })
                              : null,
                  });

        console.log(
            `[ServerBuilder] Instrumentation Configuration:`,
            options.telemetry.instrumentation
        );

        const instrumentation: any[] = [];

        if (options.telemetry.instrumentation.auto) {
            console.log(
                `[ServerBuilder] Using auto instrumentation with config:`,
                options.telemetry.instrumentation.auto
            );
            instrumentation.push(
                getNodeAutoInstrumentations(
                    options.telemetry.instrumentation.auto
                )
            );
        } else if (
            typeof options.telemetry.instrumentation.auto === 'undefined'
        ) {
            console.log(`[ServerBuilder] Using auto instrumentation.`);
            instrumentation.push(getNodeAutoInstrumentations());
        } else {
            console.log(`[ServerBuilder] Skipping auto instrumentation.`);
        }

        if (options.telemetry.instrumentation.prisma) {
            console.log(
                `[ServerBuilder] Using Prisma instrumentation with config:`,
                options.telemetry.instrumentation.prisma
            );
            instrumentation.push(
                new PrismaInstrumentation(
                    options.telemetry.instrumentation.prisma
                )
            );
        } else if (
            typeof options.telemetry.instrumentation.prisma === 'undefined'
        ) {
            console.log(`[ServerBuilder] Using Prisma instrumentation.`);
            instrumentation.push(new PrismaInstrumentation());
        } else {
            console.log(`[ServerBuilder] Skipping Prisma instrumentation.`);
        }

        const sdk = new NodeSDK({
            resource: new Resource({
                [SEMRESATTRS_SERVICE_NAME]: 'casualos',
                [SEMRESATTRS_SERVICE_VERSION]: GIT_TAG || 'dev',
            }),
            traceExporter: traceExporter,
            metricReader: metrics,
            instrumentations: instrumentation,
        });

        sdk.start();

        return this;
    }

    useRedisCache(options: Pick<ServerConfig, 'redis'> = this._options): this {
        console.log('[ServerBuilder] Using Redis Cache.');
        if (!options.redis) {
            throw new Error('Redis options must be provided.');
        }

        if (!options.redis.cacheNamespace) {
            throw new Error('Redis cache namespace must be provided.');
        }

        const redis = this._ensureRedisCaches(options);
        this._multiCache = new RedisMultiCache(
            redis,
            options.redis.cacheNamespace
        );
        return this;
    }

    useMongoDB(
        options: Pick<
            ServerConfig,
            'mongodb' | 'subscriptions' | 'moderation'
        > = this._options
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

                const resourcePermissions = db.collection<any>(
                    'resourcePermissions'
                );
                const markerPermissions =
                    db.collection<any>('markerPermissions');
                const roles = db.collection<any>('roles');

                this._configStore = new MongoDBConfigurationStore(
                    {
                        subscriptions:
                            options.subscriptions as SubscriptionConfiguration,
                        moderation:
                            options.moderation as ModerationConfiguration,
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
                    roles,
                    users,
                    resourcePermissions,
                    markerPermissions
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
        options: Pick<
            ServerConfig,
            'prisma' | 's3' | 'subscriptions' | 'moderation'
        > = this._options
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
            s3.defaultFilesBucket ?? s3.filesBucket,
            filesLookup,
            s3.filesStorageClass,
            s3Client,
            s3.host,
            undefined,
            s3.publicFilesUrl
        );
        this._eventsStore = new PrismaEventRecordsStore(prismaClient);
        this._moderationStore = new PrismaModerationStore(prismaClient);

        return this;
    }

    usePrismaWithMongoDBFileStore(
        options: Pick<
            ServerConfig,
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
        this._moderationStore = new PrismaModerationStore(prismaClient);

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
        options: Pick<ServerConfig, 'redis'> = this._options
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

        const redis = this._ensureRedisWebsocketConnections(options);
        this._websocketConnectionStore = new RedisWebsocketConnectionStore(
            options.redis.websocketConnectionNamespace,
            redis,
            options.redis.connectionAuthorizationCacheSeconds,
            options.redis.connectionExpireSeconds,
            options.redis.connectionExpireMode
        );

        return this;
    }

    useApiGatewayWebsocketMessenger(
        options: Pick<ServerConfig, 'apiGateway' | 's3'> = this._options
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
        options: Pick<ServerConfig, 'ws'> = this._options
    ): this {
        console.log('[ServerBuilder] Using WS Websocket Messenger.');

        if (!options.ws) {
            throw new Error('WS options must be provided.');
        }

        this._websocketMessenger = new WSWebsocketMessenger();

        return this;
    }

    usePrismaAndRedisInstRecords(
        options: Pick<ServerConfig, 'prisma' | 'redis'> = this._options
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

        const redis = this._ensureRedisInstData(options);
        const prisma = this._ensurePrisma(options);

        this._tempInstRecordsStore = new RedisTempInstRecordsStore(
            options.redis.tempInstRecordsStoreNamespace,
            redis,
            options.redis.tempInstRecordsLifetimeSeconds,
            options.redis.tempInstRecordsLifetimeExpireMode,
            false
        );
        this._instRecordsStore = new SplitInstRecordsStore(
            new RedisTempInstRecordsStore(
                options.redis.instRecordsStoreNamespace,
                redis,
                options.redis.publicInstRecordsLifetimeSeconds,
                options.redis.publicInstRecordsLifetimeExpireMode,
                true
            ),
            new PrismaInstRecordsStore(prisma)
        );

        return this;
    }

    get allowedApiOrigins() {
        return this._allowedApiOrigins;
    }

    get allowedAccountOrigins() {
        return this._allowedAccountOrigins;
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

    useWebAuthn(options: Pick<ServerConfig, 'webauthn'> = this._options): this {
        console.log('[ServerBuilder] Using WebAuthn.');
        if (!options.webauthn) {
            throw new Error('WebAuthn options must be provided.');
        }
        this._relyingParties = options.webauthn.relyingParties.map((rp) => ({
            id: rp.id,
            name: rp.name,
            origin: rp.origin,
        }));
        return this;
    }

    useLivekit(options: Pick<ServerConfig, 'livekit'> = this._options): this {
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
        options: Pick<ServerConfig, 'textIt'> = this._options
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
        options: Pick<ServerConfig, 'ses'> = this._options
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
        options: Pick<ServerConfig, 'redis' | 'rateLimit'> = this._options
    ): this {
        console.log('[ServerBuilder] Using Redis Rate Limiter.');
        if (!options.redis) {
            throw new Error('Redis options must be provided.');
        }
        if (!options.rateLimit) {
            throw new Error('Rate limit options must be provided.');
        }
        const client = this._ensureRedisRateLimit(options);
        const store = new RedisRateLimitStore({
            sendCommand: (command: string, ...args: string[]) => {
                return client.sendCommand([command, ...args]);
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

    useRedisWebsocketRateLimit(
        options: Pick<
            ServerConfig,
            'redis' | 'rateLimit' | 'websocketRateLimit'
        > = this._options
    ): this {
        console.log('[ServerBuilder] Using Redis WebSocket Rate Limiter.');
        if (!options.redis) {
            throw new Error('Redis options must be provided.');
        }
        const rateLimit = options.websocketRateLimit ?? options.rateLimit;
        if (!options.rateLimit) {
            throw new Error('Websocket rate limit options must be provided.');
        }
        const client = this._ensureRedisRateLimit(options);
        const store = new RedisRateLimitStore({
            sendCommand: (command: string, ...args: string[]) => {
                return client.sendCommand([command, ...args]);
            },
        });
        this._initActions.push({
            priority: 11,
            action: async () => {
                await store.setup();
            },
        });
        store.prefix =
            options.redis.websocketRateLimitPrefix ??
            options.redis.rateLimitPrefix;

        this._websocketRateLimitController = new RateLimitController(store, {
            maxHits: rateLimit.maxHits,
            windowMs: rateLimit.windowMs,
        });

        return this;
    }

    useMongoDBRateLimit(
        options: Pick<ServerConfig, 'rateLimit'> = this._options
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
        options: Pick<ServerConfig, 'subscriptions' | 'stripe'> = this._options
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

    useNotifications(
        options: Pick<ServerConfig, 'notifications'> = this._options
    ): this {
        console.log('[ServerBuilder] Using notifications.');
        if (!options.notifications) {
            throw new Error('Notifications options must be provided.');
        }

        const notifications = options.notifications;
        this._notificationMessenger = new MultiNotificationMessenger(
            notifications
        );

        if (notifications.slack) {
            console.log('[ServerBuilder] Using Slack notifications.');
            this._notificationMessenger.addMessenger(
                new SlackNotificationMessenger(notifications.slack)
            );
        }

        if (notifications.telegram) {
            console.log('[ServerBuilder] Using Telegram notifications.');
            this._notificationMessenger.addMessenger(
                new TelegramNotificationMessenger(notifications.telegram)
            );
        }

        return this;
    }

    usePrivo(options: Pick<ServerConfig, 'privo'> = this._options): this {
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
            ServerConfig,
            | 'openai'
            | 'ai'
            | 'blockadeLabs'
            | 'stabilityai'
            | 'googleai'
            | 'anthropicai'
            | 'humeai'
            | 'sloydai'
        > = this._options
    ): this {
        console.log('[ServerBuilder] Using AI.');
        if (!options.ai) {
            throw new Error('AI options must be provided.');
        }

        if (options.openai) {
            console.log('[ServerBuilder] Using OpenAI Chat.');
            this._openAIChatInterface = new OpenAIChatInterface({
                apiKey: options.openai.apiKey,
            });
        }

        if (options.googleai) {
            console.log('[ServerBuilder] Using Google AI Chat.');
            this._googleAIChatInterface = new GoogleAIChatInterface({
                apiKey: options.googleai.apiKey,
            });
        }

        if (options.anthropicai) {
            console.log('[ServerBuilder] Using Anthropic AI Chat.');
            this._anthropicAIChatInterface = new AnthropicAIChatInterface({
                apiKey: options.anthropicai.apiKey,
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
            hume: null,
            sloyd: null,
            config: this._configStore,
            metrics: this._metricsStore,
            policies: this._policyStore,
            policyController: null,
            records: this._recordsStore,
        };

        if (this._openAIChatInterface && options.ai.chat) {
            this._aiConfiguration.chat = {
                interfaces: {
                    openai: this._openAIChatInterface,
                    google: this._googleAIChatInterface,
                    anthropic: this._anthropicAIChatInterface,
                },
                options: {
                    defaultModel: options.ai.chat.defaultModel,
                    defaultModelProvider: options.ai.chat.provider,
                    allowedChatModels: options.ai.chat.allowedModels.map((m) =>
                        typeof m === 'string'
                            ? {
                                  provider: options.ai.chat.provider,
                                  model: m,
                              }
                            : {
                                  provider: m.provider,
                                  model: m.model,
                              }
                    ),
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
        if (options.humeai) {
            console.log('[ServerBuilder] Using Hume AI with API Key.');
            this._aiConfiguration.hume = {
                interface: new HumeInterface(),
                config: {
                    apiKey: options.humeai.apiKey,
                    secretKey: options.humeai.secretKey,
                },
            };
        } else {
            console.log('[ServerBuilder] Using Hume AI.');
            this._aiConfiguration.hume = {
                interface: new HumeInterface(),
                config: null,
            };
        }

        if (options.sloydai) {
            console.log('[ServerBuilder] Using Sloyd AI.');
            this._aiConfiguration.sloyd = {
                interface: new SloydInterface({
                    clientId: options.sloydai.clientId,
                    clientSecret: options.sloydai.clientSecret,
                }),
            };
        }
        return this;
    }

    async buildAsync(): Promise<BuildReturn> {
        const actions = sortBy(this._actions, (a) => a.priority);

        for (let action of actions) {
            await action.action();
        }
        this._actions = [];
        return this.build();
    }

    build(): BuildReturn {
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
            this._privoClient,
            this._relyingParties ?? []
        );
        this._recordsController = new RecordsController({
            store: this._recordsStore,
            auth: this._authStore,
            config: this._configStore,
            metrics: this._metricsStore,
            messenger: this._notificationMessenger,
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
        this._loomController = new LoomController({
            store: this._recordsStore,
            config: this._configStore,
            metrics: this._metricsStore,
            policies: this._policyController,
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
            // Set the policy controller for the AI controller since it is not set earlier
            this._aiConfiguration.policyController = this._policyController;
            this._aiController = new AIController(this._aiConfiguration);
        }

        if (this._moderationStore) {
            this._moderationController = new ModerationController(
                this._moderationStore,
                this._configStore,
                this._notificationMessenger
            );
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
            this._websocketController,
            this._moderationController,
            this._loomController,
            this._websocketRateLimitController
        );

        const buildReturn: BuildReturn = {
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
            websocketRateLimitController: this._websocketRateLimitController,
            policyController: this._policyController,
            websocketController: this._websocketController,

            dynamodbClient: this._docClient,
            mongoClient: this._mongoClient,
            mongoDatabase: this._mongoDb,
            websocketMessenger: this._websocketMessenger,
            redisClient: this._redis,
        };

        for (let plugin of this._plugins) {
            let pluginReturn = plugin.configureServer(server, buildReturn);
            if (pluginReturn) {
                this._subscription.add(pluginReturn);
            }
        }

        return buildReturn;
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
        options: Pick<ServerConfig, 'redis'>
    ): RedisClientType {
        return (this._redis = this._createRedisClient(
            this._redis,
            options.redis
        ));
    }

    private _ensureRedisWebsocketConnections(
        options: Pick<ServerConfig, 'redis'>
    ): RedisClientType {
        if (options.redis.servers.websocketConnections) {
            return (this._redisWebsocketConnections = this._createRedisClient(
                this._redisWebsocketConnections,
                options.redis.servers.websocketConnections
            ));
        } else {
            return this._ensureRedis(options);
        }
    }

    private _ensureRedisInstData(
        options: Pick<ServerConfig, 'redis'>
    ): RedisClientType {
        if (options.redis.servers.instData) {
            return (this._redisInstData = this._createRedisClient(
                this._redisInstData,
                options.redis.servers.instData
            ));
        } else {
            return this._ensureRedis(options);
        }
    }

    private _ensureRedisCaches(
        options: Pick<ServerConfig, 'redis'>
    ): RedisClientType {
        if (options.redis.servers.caches) {
            return (this._redisCaches = this._createRedisClient(
                this._redisCaches,
                options.redis.servers.caches
            ));
        } else {
            return this._ensureRedis(options);
        }
    }

    private _ensureRedisRateLimit(
        options: Pick<ServerConfig, 'redis'>
    ): RedisClientType {
        if (options.redis.servers.rateLimit) {
            return (this._redisRateLimit = this._createRedisClient(
                this._redisRateLimit,
                options.redis.servers.rateLimit
            ));
        } else {
            return this._ensureRedis(options);
        }
    }

    private _createRedisClient(
        redis: RedisClientType,
        options: RedisServerOptions
    ) {
        if (!redis) {
            const retryStrategy = (retries: number, error: Error) => {
                // reconnect after min(100ms per attempt, 3 seconds)
                return Math.min(retries * 100, 3000);
            };
            if (options.url) {
                redis = createRedisClient({
                    url: options.url,
                    socket: {
                        reconnectStrategy: retryStrategy,
                    },
                });
            } else {
                if (!options.host) {
                    throw new Error(
                        'Redis host must be provided if a URL is not specified.'
                    );
                }
                redis = createRedisClient({
                    socket: {
                        host: options.host,
                        port: options.port,
                        tls: options.tls,
                        reconnectStrategy: retryStrategy,
                    },
                    password: options.password,
                });
            }
            this._initActions.push({
                priority: 10,
                action: async () => {
                    await redis.connect();
                },
            });
            this._subscription.add(() => {
                redis.quit();
            });
        }

        return redis;
    }

    private _ensurePrisma(options: Pick<ServerConfig, 'prisma'>): PrismaClient {
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

    private _ensureS3(options: Pick<ServerConfig, 's3'>): S3 {
        if (!this._s3) {
            this._s3 = new S3();
            this._subscription.add(() => {
                this._s3.destroy();
            });
        }
        return this._s3;
    }

    private async _ensureMongoDB(
        options: Pick<ServerConfig, 'mongodb'>
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
        options: Pick<ServerConfig, 'prisma'>
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
        options: Pick<
            ServerConfig,
            'prisma' | 'subscriptions' | 'moderation' | 'privo'
        >
    ): ConfigurationStore {
        const configStore = new PrismaConfigurationStore(prismaClient, {
            subscriptions: options.subscriptions as SubscriptionConfiguration,
            privo: options.privo as PrivoConfiguration,
            moderation: options.moderation as ModerationConfiguration,
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
