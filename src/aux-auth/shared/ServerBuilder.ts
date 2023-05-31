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
    RecordsHttpServer,
    RecordsStore,
    SubscriptionController,
    Record,
} from '@casual-simulation/aux-records';
import {
    DynamoDBAuthStore,
    DynamoDBDataStore,
    DynamoDBEventStore,
    DynamoDBFileStore,
    DynamoDBPolicyStore,
    DynamoDBRecordsStore,
    TextItAuthMessenger,
} from '@casual-simulation/aux-records-aws';
import { AuthMessenger } from '@casual-simulation/aux-records/AuthMessenger';
import { ConsoleAuthMessenger } from '@casual-simulation/aux-records/ConsoleAuthMessenger';
import { LivekitController } from '@casual-simulation/aux-records/LivekitController';
import { SubscriptionConfiguration } from '@casual-simulation/aux-records/SubscriptionConfiguration';
import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { createClient as createRedisClient } from 'redis';
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
    MongoDBRecordsStore,
} from '../mongo';
import { sortBy } from 'lodash';

export class ServerBuilder {
    private _docClient: DocumentClient;
    private _mongoClient: MongoClient;
    private _mongoDb: Db;

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

    private _subscriptionConfig: SubscriptionConfiguration | null = null;
    private _subscriptionController: SubscriptionController;
    private _stripe: StripeIntegration;

    private _rateLimitController: RateLimitController;

    private _allowedAccountOrigins: Set<string> = new Set([
        'http://localhost:3000',
        'http://localhost:3002',
    ]);
    private _allowedApiOrigins: Set<string> = new Set([
        'http://localhost:3000',
        'http://localhost:3002',
    ]);

    private _options: BuilderOptions | null;

    /**
     * The actions that should be performed when the server is built.
     */
    private _actions: {
        priority: number;
        action: () => Promise<void>;
    }[] = [];

    private get _forceAllowAllSubscriptionFeatures() {
        return !this._stripe;
    }

    constructor(options?: BuilderOptions) {
        this._options = options;
    }

    useDynamoDB(
        options: Pick<BuilderOptions, 'dynamodb' | 's3'> = this._options
    ): this {
        console.log('[ServerBuilder] Using DynamoDB.');

        if (!options.dynamodb) {
            throw new Error('DynamoDB options must be provided.');
        }
        if (!options.s3) {
            throw new Error('S3 options must be provided.');
        }

        const dynamodb = options.dynamodb;
        const s3 = options.s3;

        this._docClient = new DocumentClient({
            endpoint: dynamodb.endpoint,
        });
        this._authStore = new DynamoDBAuthStore(
            this._docClient,
            dynamodb.usersTable,
            dynamodb.userAddressesTable,
            dynamodb.loginRequestsTable,
            dynamodb.sessionsTable,
            'ExpireTimeIndex',
            dynamodb.emailTable,
            dynamodb.smsTable,
            dynamodb.stripeCustomerIdsIndexName
        );
        this._recordsStore = new DynamoDBRecordsStore(
            this._docClient,
            dynamodb.publicRecordsTable,
            dynamodb.publicRecordsKeysTable
        );
        this._policyStore = new DynamoDBPolicyStore(
            this._docClient,
            dynamodb.policiesTable,
            dynamodb.subjectRolesTable,
            dynamodb.roleSubjectsTable,
            dynamodb.rolesTable
        );
        this._dataStore = new DynamoDBDataStore(
            this._docClient,
            dynamodb.dataTable
        );
        this._manualDataStore = new DynamoDBDataStore(
            this._docClient,
            dynamodb.manualDataTable
        );
        this._filesStore = new DynamoDBFileStore(
            s3.region,
            s3.filesBucket,
            this._docClient,
            dynamodb.filesTable,
            s3.filesStorageClass,
            undefined,
            s3.host,
            s3.options
        );
        this._eventsStore = new DynamoDBEventStore(
            this._docClient,
            dynamodb.eventsTable
        );
        return this;
    }

    useMongoDB(options: Pick<BuilderOptions, 'mongodb'> = this._options): this {
        console.log('[ServerBuilder] Using MongoDB.');

        if (!options.mongodb) {
            throw new Error('MongoDB options must be provided.');
        }

        const mongodb = options.mongodb;
        this._actions.push({
            priority: 0,
            action: async () => {
                const connect = pify(MongoClient.connect);
                const mongo: MongoClient = await connect(mongodb.url, {
                    useNewUrlParser: mongodb.useNewUrlParser,
                });
                this._mongoClient = mongo;
                const db = mongo.db(mongodb.database);

                this._mongoDb = db;
                const users = db.collection<MongoDBAuthUser>('users');
                const loginRequests =
                    db.collection<MongoDBLoginRequest>('loginRequests');
                const sessions = db.collection<MongoDBAuthSession>('sessions');
                const recordsCollection = db.collection<Record>('records');
                const recordsKeysCollection =
                    db.collection<RecordKey>('recordsKeys');
                const recordsDataCollection =
                    db.collection<DataRecord>('recordsData');
                const manualRecordsDataCollection =
                    db.collection<DataRecord>('manualRecordsData');
                const recordsFilesCollection =
                    db.collection<any>('recordsFilesInfo');
                // const filesCollection = db.collection<any>('recordsFilesData');
                const recordsEventsCollection =
                    db.collection<any>('recordsEvents');
                const emailRules = db.collection<any>('emailRules');
                const smsRules = db.collection<any>('smsRules');
                // const rateLimits = db.collection<any>('rateLimits');

                const policies = db.collection<any>('policies');
                const roles = db.collection<any>('roles');

                this._authStore = new MongoDBAuthStore(
                    users,
                    loginRequests,
                    sessions,
                    emailRules,
                    smsRules
                );

                this._recordsStore = new MongoDBRecordsStore(
                    recordsCollection,
                    recordsKeysCollection
                );
                this._policyStore = new MongoDBPolicyStore(policies, roles);
                this._dataStore = new MongoDBDataRecordsStore(
                    recordsDataCollection
                );
                this._eventsStore = new MongoDBEventRecordsStore(
                    recordsEventsCollection
                );
                // this._rateLimit = new MongoDBRateLimiter(rateLimits);
                this._manualDataStore = new MongoDBDataRecordsStore(
                    manualRecordsDataCollection
                );
                this._filesStore = new MongoDBFileRecordsStore(
                    recordsFilesCollection,
                    'http://localhost:2998/api/v2/records/file'
                );
            },
        });
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
        if (!options.livekit) {
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
        const client = createRedisClient({
            host: options.redis.host,
            port: options.redis.port,
            password: options.redis.password,
            tls: options.redis.tls,

            retry_strategy: function (options) {
                if (options.error && options.error.code === 'ECONNREFUSED') {
                    // End reconnecting on a specific error and flush all commands with
                    // a individual error
                    return new Error('The server refused the connection');
                }
                // reconnect after min(100ms per attempt, 3 seconds)
                return Math.min(options.attempt * 100, 3000);
            },
        });
        const store = new RedisRateLimitStore({
            sendCommand: (command: string, ...args: (string | number)[]) => {
                return new Promise((resolve, reject) => {
                    client.sendCommand(command, args, (err, result) => {
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
        if (!options.rateLimit) {
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
        this._stripe = new StripeIntegration(
            new Stripe(options.stripe.secretKey, {
                apiVersion: '2022-11-15',
            }),
            options.stripe.publishableKey
        );
        this._subscriptionConfig = options.subscriptions as any;
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
            this._subscriptionConfig,
            this._forceAllowAllSubscriptionFeatures
        );
        this._recordsController = new RecordsController(this._recordsStore);
        this._policyController = new PolicyController(
            this._authController,
            this._recordsController,
            this._policyStore
        );
        this._dataController = new DataRecordsController(
            this._policyController,
            this._dataStore
        );
        this._manualDataController = new DataRecordsController(
            this._policyController,
            this._manualDataStore
        );
        this._filesController = new FileRecordsController(
            this._policyController,
            this._filesStore
        );
        this._eventsController = new EventRecordsController(
            this._policyController,
            this._eventsStore
        );

        if (this._stripe && this._subscriptionConfig) {
            this._subscriptionController = new SubscriptionController(
                this._stripe,
                this._authController,
                this._authStore,
                this._subscriptionConfig
            );
        }

        const server = new RecordsHttpServer(
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
            this._policyController
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

            dynamodbClient: this._docClient,
            mongoClient: this._mongoClient,
            mongoDatabase: this._mongoDb,
        };
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

    options: z.object({
        endpoint: z.string().nonempty().optional(),
        s3ForcePathStyle: z.boolean().optional(),
    }),

    host: z.string().nonempty().optional(),
});

const livekitSchema = z.object({
    apiKey: z.string().nonempty(),
    secretKey: z.string().nonempty(),
    endpoint: z.string().nonempty(),
});

const textItSchema = z.object({
    apiKey: z.string().nonempty(),
    flowId: z.string().nonempty(),
});

const redisSchema = z.object({
    host: z.string().nonempty(),
    port: z.number(),
    password: z.string().nonempty(),
    tls: z.boolean(),

    rateLimitPrefix: z.string().nonempty().optional(),
});

const rateLimitSchema = z.object({
    maxHits: z.number().positive(),
    windowMs: z.number().positive(),
});

const stripeSchema = z.object({
    secretKey: z.string().nonempty(),
    publishableKey: z.string().nonempty(),
});

const subscriptionConfigSchema = z.object({
    webhookSecret: z.string().nonempty(),
    successUrl: z.string().nonempty(),
    cancelUrl: z.string().nonempty(),
    returnUrl: z.string().nonempty(),

    portalConfig: z.object({}).passthrough(),
    checkoutConfig: z.object({}).passthrough(),

    subscriptions: z.array(
        z.object({
            id: z.string().nonempty(),
            product: z.string().nonempty(),
            featureList: z.array(z.string().nonempty()),
            eligibleProducts: z.array(z.string().nonempty()),
            defaultSubscription: z.boolean().optional(),
            purchasable: z.boolean().optional(),
            tier: z.string().nonempty().optional(),
        })
    ),
});

const mongodbSchema = z.object({
    url: z.string().nonempty(),
    useNewUrlParser: z.boolean().optional().default(false),
    database: z.string().nonempty(),
});

const optionsSchema = z.object({
    dynamodb: dynamoDbSchema.optional(),
    s3: s3Schema.optional(),
    mongodb: mongodbSchema.optional(),
    livekit: livekitSchema.optional(),
    textIt: textItSchema.optional(),
    redis: redisSchema.optional(),
    rateLimit: rateLimitSchema.optional(),

    subscriptions: subscriptionConfigSchema.optional(),
    stripe: stripeSchema.optional(),
});

export type DynamoDBConfig = z.infer<typeof dynamoDbSchema>;
export type S3Config = z.infer<typeof s3Schema>;
export type BuilderOptions = z.infer<typeof optionsSchema>;
