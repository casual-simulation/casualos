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
import type {
    AuthStore,
    DataRecordsStore,
    EventRecordsStore,
    FileRecordsStore,
    PolicyStore,
    RecordsStore,
    Record,
    AIChatInterface,
    MetricsStore,
    WebsocketConnectionStore,
    InstRecordsStore,
    WebsocketMessenger,
    TemporaryInstRecordsStore,
    MultiCache,
    ModerationStore,
    RelyingParty,
    ServerConfig,
    RedisServerOptions,
    ModerationJobProvider,
    WebhookRecordsStore,
    WebhookEnvironment,
    NotificationRecordsStore,
    WebPushInterface,
} from '@casual-simulation/aux-records';
import {
    AuthController,
    DataRecordsController,
    EventRecordsController,
    FileRecordsController,
    PolicyController,
    RateLimitController,
    RecordsController,
    RecordsServer,
    SubscriptionController,
    OpenAIChatInterface,
    BlockadeLabsGenerateSkyboxInterface,
    OpenAIImageInterface,
    StabilityAIImageInterface,
    WebsocketController,
    SplitInstRecordsStore,
    CachingPolicyStore,
    CachingConfigStore,
    MultiNotificationMessenger,
    ModerationController,
    GoogleAIChatInterface,
    LoomController,
    AnthropicAIChatInterface,
    WebhookRecordsController,
    cleanupObject,
    NotificationRecordsController,
    PackageRecordsController,
} from '@casual-simulation/aux-records';
import type { SimpleEmailServiceAuthMessengerOptions } from '@casual-simulation/aux-records-aws';
import {
    RekognitionModerationJobProvider,
    S3FileRecordsStore,
    SimpleEmailServiceAuthMessenger,
    TextItAuthMessenger,
} from '@casual-simulation/aux-records-aws';
import type { AuthMessenger } from '@casual-simulation/aux-records/AuthMessenger';
import { ConsoleAuthMessenger } from '@casual-simulation/aux-records/ConsoleAuthMessenger';
import { LivekitController } from '@casual-simulation/aux-records/LivekitController';
import type { SubscriptionConfiguration } from '@casual-simulation/aux-records/SubscriptionConfiguration';
import type { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { SESv2 } from '@aws-sdk/client-sesv2';
import type { RedisClientType } from 'redis';
import { createClient as createRedisClient } from 'redis';
import { TracedRedisRateLimitStore } from '../redis/TracedRedisRateLimitStore';
import { StripeIntegration } from './StripeIntegration';
import Stripe from 'stripe';
import type { Db } from 'mongodb';
import { MongoClient } from 'mongodb';
import pify from 'pify';
import type { MongoDBAuthUser, DataRecord, MongoDBStudio } from '../mongo';
import {
    MongoDBAuthStore,
    MongoDBFileRecordsStore,
    MongoDBRateLimiter,
    MongoDBEventRecordsStore,
    MongoDBDataRecordsStore,
    MongoDBPolicyStore,
    MongoDBFileRecordsLookup,
    MongoDBConfigurationStore,
    MongoDBMetricsStore,
    USERS_COLLECTION_NAME,
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
import type {
    AIChatProviders,
    AIConfiguration,
    AIGenerateImageConfiguration,
    AllowedAIChatModel,
} from '@casual-simulation/aux-records/AIController';
import { AIController } from '@casual-simulation/aux-records/AIController';
import type { ConfigurationStore } from '@casual-simulation/aux-records/ConfigurationStore';
import { PrismaMetricsStore } from '../prisma/PrismaMetricsStore';
import { S3 } from '@aws-sdk/client-s3';
import { RedisTempInstRecordsStore } from '../redis/RedisTempInstRecordsStore';
import { RedisWebsocketConnectionStore } from '../redis/RedisWebsocketConnectionStore';
import { ApiGatewayWebsocketMessenger } from '../serverless/aws/src/ApiGatewayWebsocketMessenger';
import type { SubscriptionLike } from 'rxjs';
import { Subscription } from 'rxjs';
import { WSWebsocketMessenger } from '../ws/WSWebsocketMessenger';
import { PrismaInstRecordsStore } from '../prisma/PrismaInstRecordsStore';
import { RedisMultiCache } from '../redis/RedisMultiCache';
import { PrivoClient } from '@casual-simulation/aux-records/PrivoClient';
import { PrismaPrivoStore } from '../prisma/PrismaPrivoStore';
import type { PrivoConfiguration } from '@casual-simulation/aux-records/PrivoConfiguration';
import { SlackNotificationMessenger } from '../notifications/SlackNotificationMessenger';
import { TelegramNotificationMessenger } from '../notifications/TelegramNotificationMessenger';
import { PrismaModerationStore } from '../prisma/PrismaModerationStore';
import type { ModerationConfiguration } from '@casual-simulation/aux-records/ModerationConfiguration';
import { Rekognition } from '@aws-sdk/client-rekognition';
import { Client as TypesenseClient } from 'typesense';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import xpApiPlugins from '../../../../xpexchange/xp-api/*.server.plugin.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
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
import { MinioFileRecordsStore } from '../minio/MinioFileRecordsStore';
import { S3ControlClient } from '@aws-sdk/client-s3-control';
import { SimulationWebhookEnvironment } from './webhooks/SimulationWebhookEnvironment';
import { DenoSimulationImpl, DenoVM } from '@casual-simulation/aux-vm-deno';
import { PrismaWebhookRecordsStore } from '../prisma/PrismaWebhookRecordsStore';
import { AuxVMNode } from '@casual-simulation/aux-vm-node';
import { MessageChannel, MessagePort } from 'deno-vm';
import { LambdaWebhookEnvironment } from './webhooks/LambdaWebhookEnvironment';
import { getConnectionId } from '@casual-simulation/aux-common';
import { RemoteSimulationImpl } from '@casual-simulation/aux-vm-client';
import type { AuxConfigParameters } from '@casual-simulation/aux-vm';
import { WebPushImpl } from '../notifications/WebPushImpl';
import { PrismaNotificationRecordsStore } from '../prisma/PrismaNotificationRecordsStore';
import { RemoteAuxChannel } from '@casual-simulation/aux-vm-client/vm/RemoteAuxChannel';
import { OpenAIRealtimeInterface } from '@casual-simulation/aux-records/AIOpenAIRealtimeInterface';
import { PrismaPackageRecordsStore } from '../prisma/PrismaPackageRecordsStore';
import { PrismaPackageVersionRecordsStore } from '../prisma/PrismaPackageVersionRecordsStore';
import { PackageVersionRecordsController } from '@casual-simulation/aux-records/packages/version';
import { RedisWSWebsocketMessenger } from '../redis/RedisWSWebsocketMessenger';
import type {
    SearchRecordsStore,
    SearchSyncQueueEvent,
} from '@casual-simulation/aux-records/search';
import { SearchSyncProcessor } from '@casual-simulation/aux-records/search';
import { SearchRecordsController } from '@casual-simulation/aux-records/search';
import { TypesenseSearchInterface } from '@casual-simulation/aux-records/search';
import type { NodeConfiguration } from 'typesense/lib/Typesense/Configuration';
import { PrismaSearchRecordsStore } from 'aux-backend/prisma/PrismaSearchRecordsStore';
import type { IQueue } from '@casual-simulation/aux-records/queue';
import { Worker as BullWorker, Queue } from 'bullmq';
import { BullQueue } from '../queue/BullQueue';
import { SNSClient } from '@aws-sdk/client-sns';
import { SNSQueue } from '../queue/SNSQueue';

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
    packagesController: PackageRecordsController;
    packageVersionController: PackageVersionRecordsController;
    searchRecordsController: SearchRecordsController | null;
    dynamodbClient: DocumentClient;
    mongoClient: MongoClient;
    mongoDatabase: Db;
    websocketMessenger: WebsocketMessenger;
    redisClient: RedisClientType;

    moderationController: ModerationController;
    moderationJobProvider: ModerationJobProvider;
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

    private _webhooksStore: WebhookRecordsStore;
    private _webhookEnvironment: WebhookEnvironment;
    private _webhooksController: WebhookRecordsController;

    private _notificationsStore: NotificationRecordsStore;
    private _pushInterface: WebPushInterface;
    private _notificationsController: NotificationRecordsController;

    private _subscriptionConfig: SubscriptionConfiguration | null = null;
    private _subscriptionController: SubscriptionController;
    private _stripe: StripeIntegration;

    private _openAIChatInterface: AIChatInterface = null;
    private _customChatInterfaces: AIChatProviders = null;
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
    private _redisSubscriber: RedisClientType | null = null;
    private _redisPublisher: RedisClientType | null = null;
    private _redisRateLimit: RedisClientType | null = null;
    private _s3: S3;
    private _s3Control: S3ControlClient;
    private _rateLimitController: RateLimitController;
    private _websocketRateLimitController: RateLimitController;

    private _rekognition: Rekognition | null = null;
    private _moderationJobProvider: ModerationJobProvider | null = null;

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
    private _packagesStore: PrismaPackageRecordsStore;
    private _packageVersionsStore: PrismaPackageVersionRecordsStore;
    private _packagesController: PackageRecordsController;
    private _packageVersionController: PackageVersionRecordsController;

    private _searchInterface: TypesenseSearchInterface | null = null;
    private _searchStore: SearchRecordsStore | null = null;
    private _searchController: SearchRecordsController | null = null;

    private _searchSyncProcessor: SearchSyncProcessor | null = null;
    private _searchQueue: IQueue<SearchSyncQueueEvent> | null = null;
    private _searchWorker: BullWorker | null = null;

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
                this._ensureFileStoreInit();
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

        const s3 = options.s3;
        const s3Client = this._ensureS3(options);
        const { filesLookup } = this._usePrismaStores(options);
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
        this._ensureFileStoreInit();

        return this;
    }

    private _usePrismaStores(
        options: Pick<
            ServerConfig,
            'prisma' | 'subscriptions' | 'moderation'
        > = this._options
    ) {
        const prismaClient = this._ensurePrisma(options);
        this._configStore = this._ensurePrismaConfigurationStore(
            prismaClient,
            options
        );
        const metricsStore = (this._metricsStore = new PrismaMetricsStore(
            prismaClient,
            this._configStore
        ));
        this._authStore = new PrismaAuthStore(prismaClient);
        this._privoStore = new PrismaPrivoStore(prismaClient);
        this._recordsStore = new PrismaRecordsStore(prismaClient);
        this._policyStore = this._ensurePrismaPolicyStore(
            prismaClient,
            options
        );
        this._dataStore = new PrismaDataRecordsStore(prismaClient);
        this._manualDataStore = new PrismaDataRecordsStore(prismaClient, true);
        this._eventsStore = new PrismaEventRecordsStore(prismaClient);
        this._moderationStore = new PrismaModerationStore(prismaClient);
        this._webhooksStore = new PrismaWebhookRecordsStore(
            prismaClient,
            metricsStore
        );
        this._notificationsStore = new PrismaNotificationRecordsStore(
            prismaClient,
            metricsStore
        );
        this._packagesStore = new PrismaPackageRecordsStore(
            prismaClient,
            metricsStore
        );
        this._packageVersionsStore = new PrismaPackageVersionRecordsStore(
            prismaClient,
            metricsStore
        );
        this._searchStore = new PrismaSearchRecordsStore(
            prismaClient,
            metricsStore
        );

        const filesLookup = new PrismaFileRecordsLookup(prismaClient);
        return {
            prismaClient,
            filesLookup,
        };
    }

    usePrismaWithMinio(
        options: Pick<
            ServerConfig,
            'prisma' | 'minio' | 'subscriptions' | 'moderation'
        > = this._options
    ): this {
        console.log('[ServerBuilder] Using Prisma with Minio.');
        if (!options.prisma) {
            throw new Error('Prisma options must be provided.');
        }

        if (!options.minio) {
            throw new Error('Minio options must be provided.');
        }

        const minio = options.minio;

        const { filesLookup } = this._usePrismaStores(options);
        this._filesStore = new MinioFileRecordsStore(
            {
                endPoint: minio.endpoint,
                port: minio.port,
                accessKey: minio.accessKey,
                secretKey: minio.secretKey,
                useSSL: minio.useSSL,
                region: minio.region,
            },
            minio.filesBucket,
            minio.defaultFilesBucket ?? minio.filesBucket,
            filesLookup,
            minio.publicFilesUrl
        );
        this._ensureFileStoreInit();

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
        const { filesLookup } = this._usePrismaStores(options);
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
                this._ensureFileStoreInit();
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

        if (
            options.redis.pubSubNamespace &&
            this._websocketMessenger instanceof WSWebsocketMessenger
        ) {
            const [subscriber, publisher] = this._ensureRedisPubSub(options);
            console.log('[ServerBuilder] Using Redis PubSub.');
            this._websocketMessenger = new RedisWSWebsocketMessenger(
                this._websocketMessenger,
                subscriber,
                publisher,
                options.redis.pubSubNamespace
            );
        }

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

    /**
     * Configures the server to use [AWS Rekognition](https://docs.aws.amazon.com/rekognition/latest/dg/moderation.html) for content moderation.
     * @param options The options to use.
     */
    useRekognitionModeration(
        options: Pick<ServerConfig, 'rekognition' | 's3'> = this._options
    ): this {
        console.log('[ServerBuilder] Using AWS Rekognition for moderation.');

        if (!options.rekognition) {
            throw new Error('Rekognition options must be provided.');
        }

        if (!options.s3) {
            throw new Error('S3 options must be provided.');
        }

        if (
            !this._filesStore ||
            !(this._filesStore instanceof S3FileRecordsStore)
        ) {
            throw new Error(
                'S3 must be the configured file store in order to use Rekognition moderation.'
            );
        }

        this._moderationJobProvider = new RekognitionModerationJobProvider({
            filesStore: this._filesStore,
            rekognition: this._ensureRekognition(options),
            s3Control: this._ensureS3Control(options),
            s3: this._ensureS3(options),
            filesJob: {
                accountId: options.rekognition.moderation.files.job?.accountId,
                lambdaFunctionArn:
                    options.rekognition.moderation.files.job?.lambdaFunctionArn,
                sourceBucket:
                    options.rekognition.moderation.files.job?.sourceBucket,
                reportBucket:
                    options.rekognition.moderation.files.job?.reportBucket,
                priority: options.rekognition.moderation.files.job?.priority,
                roleArn: options.rekognition.moderation.files.job?.roleArn,
                tags: options.rekognition.moderation.files.job?.tags as any,
                projectVersionArn:
                    options.rekognition.moderation.files.scan
                        ?.projectVersionArn,
            },
        });

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
        const store = new TracedRedisRateLimitStore({
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
        const store = new TracedRedisRateLimitStore({
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

    useTypesense(
        options: Pick<ServerConfig, 'typesense'> = this._options
    ): this {
        console.log('[ServerBuilder] Using Typesense.');
        if (!options.typesense) {
            throw new Error('Typesense options must be provided.');
        }

        const typesense = options.typesense;
        const client = new TypesenseClient({
            nodes: typesense.nodes as NodeConfiguration[],
            apiKey: typesense.apiKey,
            connectionTimeoutSeconds: typesense.connectionTimeoutSeconds,
        });
        this._searchInterface = new TypesenseSearchInterface(client);

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

    useSystemNotifications(
        options: Pick<ServerConfig, 'notifications'> = this._options
    ): this {
        console.log('[ServerBuilder] Using system notifications.');
        if (!options.notifications) {
            throw new Error('System notifications options must be provided.');
        }

        const notifications = options.notifications;
        this._notificationMessenger = new MultiNotificationMessenger(
            notifications
        );

        if (notifications.slack) {
            console.log('[ServerBuilder] Using Slack system notifications.');
            this._notificationMessenger.addMessenger(
                new SlackNotificationMessenger(notifications.slack)
            );
        }

        if (notifications.telegram) {
            console.log('[ServerBuilder] Using Telegram system notifications.');
            this._notificationMessenger.addMessenger(
                new TelegramNotificationMessenger(notifications.telegram)
            );
        }

        return this;
    }

    useWebPushNotifications(
        options: Pick<ServerConfig, 'webPush'> = this._options
    ): this {
        console.log('[ServerBuilder] Using Web Push notifications.');

        if (!options.webPush) {
            throw new Error('Web Push options must be provided.');
        }

        this._pushInterface = new WebPushImpl({
            vapidSubject: options.webPush.vapidSubject,
            vapidPublicKey: options.webPush.vapidPublicKey,
            vapidPrivateKey: options.webPush.vapidPrivateKey,
        });

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

        let hasChatInterface = false;
        if (options.openai) {
            console.log('[ServerBuilder] Using OpenAI Chat.');
            this._openAIChatInterface = new OpenAIChatInterface({
                apiKey: options.openai.apiKey,
            });
            hasChatInterface = true;
        }

        if (options.googleai) {
            console.log('[ServerBuilder] Using Google AI Chat.');
            this._googleAIChatInterface = new GoogleAIChatInterface({
                apiKey: options.googleai.apiKey,
            });
            hasChatInterface = true;
        }

        if (options.anthropicai) {
            console.log('[ServerBuilder] Using Anthropic AI Chat.');
            this._anthropicAIChatInterface = new AnthropicAIChatInterface({
                apiKey: options.anthropicai.apiKey,
            });
            hasChatInterface = true;
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
            openai: null,
            config: this._configStore,
            metrics: this._metricsStore,
            policies: this._policyStore,
            policyController: null,
            records: this._recordsStore,
        };

        if (options.ai.chat) {
            const allowedChatModels: AllowedAIChatModel[] = [];
            this._customChatInterfaces = {};

            for (let model of options.ai.chat.allowedModels) {
                if (typeof model === 'string') {
                    allowedChatModels.push({
                        provider: options.ai.chat.provider,
                        model: model,
                    });
                } else if (model.provider === 'custom-openai-completions') {
                    console.log(
                        `[ServerBuilder] Using Custom OpenAI Chat Interface: ${
                            model.name
                        } (${model.models.join(', ')})`
                    );
                    this._customChatInterfaces[model.name] =
                        new OpenAIChatInterface({
                            apiKey: model.apiKey,
                            baseUrl: model.baseUrl,
                            name: model.name ?? model.provider,
                            additionalProperties: model.additionalProperties,
                        });
                    for (let m of model.models) {
                        allowedChatModels.push({
                            provider: model.name,
                            model: m,
                        });
                    }
                } else {
                    allowedChatModels.push({
                        provider: model.provider,
                        model: model.model,
                    });
                }
            }

            const interfaces = cleanupObject({
                ...this._customChatInterfaces,
                openai: this._openAIChatInterface,
                google: this._googleAIChatInterface,
                anthropic: this._anthropicAIChatInterface,
            });

            if (Object.keys(interfaces).length > 0) {
                this._aiConfiguration.chat = {
                    interfaces,
                    options: {
                        defaultModel: options.ai.chat.defaultModel,
                        defaultModelProvider: options.ai.chat.provider,
                        allowedChatModels: allowedChatModels,
                        allowedChatSubscriptionTiers:
                            options.ai.chat.allowedSubscriptionTiers,
                        tokenModifierRatio: options.ai.chat.tokenModifierRatio,
                    },
                };
            }
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

        if (options.openai) {
            console.log('[ServerBuilder] Enabling OpenAI Realtime API');
            this._aiConfiguration.openai = {
                realtime: {
                    interface: new OpenAIRealtimeInterface({
                        apiKey: options.openai.apiKey,
                    }),
                },
            };
        }
        return this;
    }

    useWebhooks(
        options: Pick<ServerConfig, 'webhooks' | 'meta'> = this._options
    ): this {
        console.log('[ServerBuilder] Using webhooks.');
        if (!options.webhooks) {
            throw new Error('Webhook options must be provided.');
        }

        if (!this._webhooksStore) {
            throw new Error('Webhook store must be configured.');
        }

        const env = options.webhooks.environment;
        let configParameters: Partial<AuxConfigParameters> = {
            version: GIT_TAG,
            versionHash: GIT_HASH,
            device: {
                isCollaborative: false,
                supportsAR: false,
                supportsVR: false,
                supportsDOM: false,
                allowCollaborationUpgrade: false,
                ab1BootstrapUrl: null,
            },
        };

        if (options.meta) {
            configParameters.recordsOrigin = configParameters.authOrigin =
                options.meta.apiOrigin ?? undefined;
            configParameters.causalRepoConnectionUrl =
                options.meta.websocketOrigin ?? undefined;
            configParameters.causalRepoConnectionProtocol =
                options.meta.websocketProtocol ?? undefined;
        }

        if (env.type === 'deno') {
            console.log('[ServerBuilder] Using Deno Webhook Environment.');

            configParameters.debug = env.debugLogs;

            const anyGlobalThis = globalThis as any;
            anyGlobalThis.MessageChannel = MessageChannel;
            anyGlobalThis.MessagePort = MessagePort;

            this._webhookEnvironment = new SimulationWebhookEnvironment(
                (simId, indicator, origin, config) => {
                    const vm = new DenoVM(
                        new URL(env.scriptPath),
                        simId,
                        origin,
                        config
                    );
                    if (env.denoPath) {
                        vm.denoExecutable = env.denoPath;
                    }
                    const sim = new DenoSimulationImpl(indicator, origin, vm);

                    return {
                        sim,
                        onLogs: vm.onLogs,
                        vm,
                    };
                },
                {
                    configParameters,
                }
            );
        } else if (env.type === 'node') {
            console.log('[ServerBuilder] Using Node Webhook Environment.');
            this._webhookEnvironment = new SimulationWebhookEnvironment(
                (simId, indicator, origin, config) => {
                    const configBotId = getConnectionId(indicator);
                    const vm = new AuxVMNode(
                        simId,
                        origin,
                        configBotId,
                        new RemoteAuxChannel(config, {})
                    );
                    const sim = new RemoteSimulationImpl(
                        simId,
                        {
                            recordName: null,
                            inst: null,
                            isStatic: false,
                        },
                        vm
                    );

                    return {
                        sim,
                        vm,
                    };
                },
                {
                    configParameters,
                }
            );
        } else if (env.type === 'lambda') {
            console.log('[ServerBuilder] Using Lambda Webhook Environment.');
            this._webhookEnvironment = new LambdaWebhookEnvironment(
                {
                    functionName: env.functionName,
                },
                configParameters
            );
        } else {
            throw new Error('Invalid webhook environment type.');
        }
        return this;
    }

    useBackgroundJobs(
        options: Pick<ServerConfig, 'jobs' | 'redis'> = this._options
    ): this {
        if (!options.jobs) {
            throw new Error('Background jobs options must be provided.');
        }

        if (options.jobs.search) {
            if (!this._dataStore) {
                throw new Error(
                    'Data store must be configured before using background search jobs.'
                );
            }
            if (!this._searchStore) {
                throw new Error(
                    'Search store must be configured before using background search jobs.'
                );
            }
            if (!this._searchInterface) {
                throw new Error(
                    'Search interface must be configured before using background search jobs.'
                );
            }

            this._searchSyncProcessor = new SearchSyncProcessor({
                searchInterface: this._searchInterface,
                data: this._dataStore,
                search: this._searchStore,
            });

            if (options.jobs.search.type === 'sns') {
                console.log('[ServerBuilder] Publishing search jobs to SNS.');

                const client = new SNSClient({});
                const queue = (this._searchQueue = new SNSQueue(
                    client,
                    options.jobs.search.topicArn
                ));

                this._subscription.add(queue);
                this._subscription.add(() => {
                    this._searchQueue = null;
                });
            } else {
                if (!options.redis) {
                    throw new Error(
                        'Redis options must be provided when using BullMQ.'
                    );
                }
                // console.log('[ServerBuilder] Using BullMQ for Search jobs.');

                const serverOptions =
                    options.redis.servers?.bullmq ?? options.redis;

                const connection = {
                    url: serverOptions.url,
                    host: serverOptions.host,
                    port: serverOptions.port,
                    password: serverOptions.password,
                    tls: serverOptions.tls ? {} : undefined,
                };

                if (options.jobs.search.queue) {
                    console.log(
                        '[ServerBuilder] Using BullMQ for search jobs on:',
                        options.jobs.search.queueName
                    );

                    const queue = (this._searchQueue = new BullQueue(
                        new Queue(options.jobs.search.queueName, {
                            connection,
                        })
                    ));

                    this._subscription.add(queue);
                    this._subscription.add(() => {
                        this._searchQueue = null;
                    });
                }

                if (options.jobs.search.process) {
                    console.log(
                        '[ServerBuilder] Processing search jobs with BullMQ on:',
                        options.jobs.search.queueName
                    );
                    this._searchWorker = new BullWorker(
                        options.jobs.search.queueName,
                        async (job) => {
                            await this._searchSyncProcessor.process(
                                job.data as SearchSyncQueueEvent
                            );
                        },
                        {
                            connection,
                        }
                    );

                    this._subscription.add(() => {
                        this._searchWorker?.close();
                        this._searchWorker = null;
                    });
                }
            }
        }
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
        console.log(`CasualOS Version:`, GIT_TAG, GIT_HASH);

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
            privo: this._privoClient ?? null,
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
                this._notificationMessenger,
                this._moderationJobProvider
            );
        }

        if (this._packagesStore && this._packageVersionsStore) {
            this._packagesController = new PackageRecordsController({
                config: this._configStore,
                policies: this._policyController,
                store: this._packagesStore,
            });
            this._packageVersionController =
                new PackageVersionRecordsController({
                    config: this._configStore,
                    policies: this._policyController,
                    recordItemStore: this._packagesStore,
                    store: this._packageVersionsStore,
                    files: this._filesController,
                    systemNotifications: this._notificationMessenger,
                    packages: this._packagesController,
                });
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
                this._authStore,
                this._packageVersionController
            );
        }

        if (this._webhooksStore && this._webhookEnvironment) {
            this._webhooksController = new WebhookRecordsController({
                config: this._configStore,
                data: this._dataController,
                files: this._filesController,
                store: this._webhooksStore,
                policies: this._policyController,
                environment: this._webhookEnvironment,
                auth: this._authController,
                websockets: this._websocketController,
            });
        }

        if (this._notificationsStore && this._pushInterface) {
            this._notificationsController = new NotificationRecordsController({
                config: this._configStore,
                policies: this._policyController,
                store: this._notificationsStore,
                pushInterface: this._pushInterface,
            });
        }

        if (this._searchStore && this._searchInterface) {
            console.log('[ServerBuilder] Using Search Records.');
            this._searchController = new SearchRecordsController({
                config: this._configStore,
                policies: this._policyController,
                store: this._searchStore,
                searchInterface: this._searchInterface,
            });
        }

        const server = new RecordsServer({
            allowedAccountOrigins: this._allowedAccountOrigins,
            allowedApiOrigins: this._allowedApiOrigins,
            authController: this._authController,
            livekitController: this._livekitController,
            recordsController: this._recordsController,
            eventsController: this._eventsController,
            dataController: this._dataController,
            manualDataController: this._manualDataController,
            filesController: this._filesController,
            subscriptionController: this._subscriptionController,
            rateLimitController: this._rateLimitController,
            policyController: this._policyController,
            aiController: this._aiController,
            websocketController: this._websocketController,
            moderationController: this._moderationController,
            loomController: this._loomController,
            websocketRateLimitController: this._websocketRateLimitController,
            webhooksController: this._webhooksController,
            notificationsController: this._notificationsController,
            packagesController: this._packagesController,
            packageVersionController: this._packageVersionController,
            searchRecordsController: this._searchController,
        });

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
            packagesController: this._packagesController,
            packageVersionController: this._packageVersionController,
            searchRecordsController: this._searchController,

            moderationController: this._moderationController,
            moderationJobProvider: this._moderationJobProvider,

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

    private _ensureRedisPubSub(
        options: Pick<ServerConfig, 'redis'>
    ): [RedisClientType, RedisClientType] {
        return [
            (this._redisSubscriber = this._createRedisClient(
                this._redisSubscriber,
                options.redis.servers.pubSub ?? options.redis
            )),
            (this._redisPublisher = this._createRedisClient(
                this._redisPublisher,
                options.redis.servers.pubSub ?? options.redis
            )),
        ] as const;
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

    private _ensureS3Control(
        options: Pick<ServerConfig, 's3'>
    ): S3ControlClient {
        if (!this._s3Control) {
            this._s3Control = new S3ControlClient({
                region: options.s3.region,
            });
            this._subscription.add(() => {
                this._s3Control.destroy();
            });
        }
        return this._s3Control;
    }

    private _ensureRekognition(
        options: Pick<ServerConfig, 'rekognition'>
    ): Rekognition {
        if (!this._rekognition) {
            this._rekognition = new Rekognition({});
            this._subscription.add(() => {
                this._rekognition.destroy();
            });
        }
        return this._rekognition;
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

    private _ensureFileStoreInit() {
        if (this._filesStore?.init) {
            this._initActions.push({
                priority: 20,
                action: async () => {
                    await this._filesStore?.init();
                },
            });
        }
    }
}
