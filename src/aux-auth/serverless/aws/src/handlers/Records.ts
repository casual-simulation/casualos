// Create clients and set shared const values outside of the handler.
import {
    formatResponse,
    validateOrigin,
    findHeader,
    getSessionKey,
    getAllowedAPIOrigins,
    allowedOrigins,
    validateSessionKey,
} from '../utils';
import {
    RecordsController,
    DataRecordsController,
    FileRecordsController,
    EventRecordsController,
    RecordsHttpServer,
    GenericHttpRequest,
    GenericHttpHeaders,
    StripeInterface,
    SubscriptionController,
    tryParseSubscriptionConfig,
    RateLimitController,
    PolicyController,
    tryParseJson,
} from '@casual-simulation/aux-records';
import { AuthController } from '@casual-simulation/aux-records/AuthController';
import { ConsoleAuthMessenger } from '@casual-simulation/aux-records/ConsoleAuthMessenger';
import {
    DynamoDBRecordsStore,
    DynamoDBDataStore,
    DynamoDBFileStore,
    DynamoDBEventStore,
    cleanupObject,
    DynamoDBAuthStore,
    TextItAuthMessenger,
    DynamoDBPolicyStore,
} from '@casual-simulation/aux-records-aws';
import type {
    APIGatewayProxyEvent,
    APIGatewayProxyResult,
    EventBridgeEvent,
    S3Event,
} from 'aws-lambda';
import AWS from 'aws-sdk';
import { LivekitController } from '@casual-simulation/aux-records/LivekitController';
import { parseSessionKey } from '@casual-simulation/aux-records/AuthUtils';
import { StripeIntegration } from '../../../../shared/StripeIntegration';
import Stripe from 'stripe';
import { AuthMessenger } from '@casual-simulation/aux-records/AuthMessenger';
import RedisRateLimitStore from '@casual-simulation/rate-limit-redis';
import { createClient as createRedisClient } from 'redis';
import {
    BuilderOptions,
    ServerBuilder,
} from '../../../../shared/ServerBuilder';
import { loadConfig } from '../../../../shared/ConfigUtils';
import { merge } from 'lodash';

declare var S3_ENDPOINT: string;
declare var DYNAMODB_ENDPOINT: string;
declare var DEVELOPMENT: boolean;

// Get the DynamoDB table name from environment variables
const PUBLIC_RECORDS_TABLE = process.env.PUBLIC_RECORDS_TABLE;
const PUBLIC_RECORDS_KEYS_TABLE = process.env.PUBLIC_RECORDS_KEYS_TABLE;
const DATA_TABLE = process.env.DATA_TABLE;
const MANUAL_DATA_TABLE = process.env.MANUAL_DATA_TABLE;
const FILES_BUCKET = process.env.FILES_BUCKET;
const FILES_STORAGE_CLASS = process.env.FILES_STORAGE_CLASS;
const FILES_TABLE = process.env.FILES_TABLE;
const EVENTS_TABLE = process.env.EVENTS_TABLE;
const REGION = process.env.AWS_REGION;
const USERS_TABLE = process.env.USERS_TABLE;
const USER_ADDRESSES_TABLE = process.env.USER_ADDRESSES_TABLE;
const LOGIN_REQUESTS_TABLE = process.env.LOGIN_REQUESTS_TABLE;
const SESSIONS_TABLE = process.env.SESSIONS_TABLE;
const EMAIL_TABLE = process.env.EMAIL_TABLE;
const SMS_TABLE = process.env.SMS_TABLE;
const POLICIES_TABLE = process.env.POLICIES_TABLE;
const ROLES_TABLE = process.env.ROLES_TABLE;
const SUBJECT_ROLES_TABLE = process.env.SUBJECT_ROLES_TABLE;
const ROLE_SUBJECTS_TABLE = process.env.ROLE_SUBJECTS_TABLE;
const STRIPE_CUSTOMER_ID_INDEX_NAME = 'StripeCustomerIdsIndex';

// const RATE_LIMIT_PREFIX = `${REDIS_NAMESPACE}:rate-limit/`;

const staticConfig = loadConfig();
const dynamicConfig: BuilderOptions = {
    dynamodb: {
        usersTable: USERS_TABLE,
        userAddressesTable: USER_ADDRESSES_TABLE,
        loginRequestsTable: LOGIN_REQUESTS_TABLE,
        sessionsTable: SESSIONS_TABLE,
        emailTable: EMAIL_TABLE,
        smsTable: SMS_TABLE,
        policiesTable: POLICIES_TABLE,
        rolesTable: ROLES_TABLE,
        subjectRolesTable: SUBJECT_ROLES_TABLE,
        roleSubjectsTable: ROLE_SUBJECTS_TABLE,
        stripeCustomerIdsIndexName: STRIPE_CUSTOMER_ID_INDEX_NAME,
        dataTable: DATA_TABLE,
        manualDataTable: MANUAL_DATA_TABLE,
        filesTable: FILES_TABLE,
        eventsTable: EVENTS_TABLE,
        publicRecordsTable: PUBLIC_RECORDS_TABLE,
        publicRecordsKeysTable: PUBLIC_RECORDS_KEYS_TABLE,
        endpoint: DYNAMODB_ENDPOINT,
    },
    s3: {
        region: REGION,
        filesBucket: FILES_BUCKET,
        filesStorageClass: FILES_STORAGE_CLASS,

        // We reference the Vite server in development.
        // since any preflight request with an Origin header is rejected by localstack (see https://github.com/localstack/localstack/issues/4056)
        // This parameter is mostly only used so that the file URLs point to the correct S3 instance. As such,
        // this value is mostly used by browsers trying to upload files.
        host: DEVELOPMENT ? `http://localhost:3002/s3` : undefined,
        options: {
            endpoint: S3_ENDPOINT,
            s3ForcePathStyle: DEVELOPMENT,
        },
    },
};

const config = merge({}, staticConfig, dynamicConfig);

// const config: BuilderOptions = {
//     dynamodb: {
//         usersTable: USERS_TABLE,
//         userAddressesTable: USER_ADDRESSES_TABLE,
//         loginRequestsTable: LOGIN_REQUESTS_TABLE,
//         sessionsTable: SESSIONS_TABLE,
//         emailTable: EMAIL_TABLE,
//         smsTable: SMS_TABLE,
//         policiesTable: POLICIES_TABLE,
//         rolesTable: ROLES_TABLE,
//         subjectRolesTable: SUBJECT_ROLES_TABLE,
//         roleSubjectsTable: ROLE_SUBJECTS_TABLE,
//         stripeCustomerIdsIndexName: STRIPE_CUSTOMER_ID_INDEX_NAME,
//         dataTable: DATA_TABLE,
//         manualDataTable: MANUAL_DATA_TABLE,
//         filesTable: FILES_TABLE,
//         eventsTable: EVENTS_TABLE,
//         publicRecordsTable: PUBLIC_RECORDS_TABLE,
//         publicRecordsKeysTable: PUBLIC_RECORDS_KEYS_TABLE,
//         endpoint: DYNAMODB_ENDPOINT,
//     },
//     s3: {
//         region: REGION,
//         filesBucket: FILES_BUCKET,
//         filesStorageClass: FILES_STORAGE_CLASS,

//         // We reference the Vite server in development.
//         // since any preflight request with an Origin header is rejected by localstack (see https://github.com/localstack/localstack/issues/4056)
//         // This parameter is mostly only used so that the file URLs point to the correct S3 instance. As such,
//         // this value is mostly used by browsers trying to upload files.
//         host: DEVELOPMENT ? `http://localhost:3002/s3` : undefined,
//         options: {
//             endpoint: S3_ENDPOINT,
//             s3ForcePathStyle: DEVELOPMENT,
//         },
//     },
//     livekit: {
//         apiKey: LIVEKIT_API_KEY,
//         secretKey: LIVEKIT_SECRET_KEY,
//         endpoint: LIVEKIT_ENDPOINT,
//     },
//     rateLimit: {
//         windowMs: RATE_LIMIT_WINDOW_MS,
//         maxHits: RATE_LIMIT_MAX,
//     },
//     redis: {
//         host: REDIS_HOST,
//         port: REDIS_PORT,
//         password: REDIS_PASS,
//         tls: REDIS_TLS,
//         rateLimitPrefix: RATE_LIMIT_PREFIX,
//     },
//     textIt: {
//         apiKey: API_KEY,
//         flowId: FLOW_ID,
//     },
//     stripe: {
//         secretKey: STRIPE_SECRET_KEY,
//         publishableKey: STRIPE_PUBLISHABLE_KEY,
//     },
//     subscriptions: subscriptions.success ? subscriptions.value : undefined,
// };

const allowedApiOrigins = new Set([
    'http://localhost:3000',
    'http://localhost:3002',
    'http://player.localhost:3000',
    'https://localhost:3000',
    'https://localhost:3002',
    'https://player.localhost:3000',
    'https://casualos.com',
    'https://casualos.me',
    'https://ab1.link',
    'https://publicos.com',
    'https://alpha.casualos.com',
    'https://static.casualos.com',
    'https://stable.casualos.com',
    ...getAllowedAPIOrigins(),
]);

const builder = new ServerBuilder(config)
    .useAllowedApiOrigins(allowedApiOrigins)
    .useAllowedAccountOrigins(allowedOrigins);

if (config.prisma && config.s3) {
    builder.usePrismaWithS3();
} else if (config.dynamodb) {
    builder.useDynamoDB();
}

if (config.livekit) {
    builder.useLivekit();
}

if (config.textIt && config.textIt.apiKey && config.textIt.flowId) {
    builder.useTextItAuthMessenger();
} else {
    builder.useConsoleAuthMessenger();
}

if (
    config.stripe.secretKey &&
    config.stripe.publishableKey &&
    config.subscriptions
) {
    builder.useStripeSubscriptions();
}

if (config.rateLimit && config.rateLimit.windowMs && config.rateLimit.maxHits) {
    builder.useRedisRateLimit();
}

const { server, filesStore } = builder.build();

async function handleEventBridgeEvent(event: EventBridgeEvent<any, any>) {
    console.log('[Records] Got EventBridge event:', event);
}

async function handleS3Event(event: S3Event) {
    await Promise.all(
        event.Records.map(async (record) => {
            const bucketName = record.s3.bucket.name;

            if (bucketName !== FILES_BUCKET) {
                console.warn(
                    `[Records1] Got event for wrong bucket: ${bucketName}`
                );
                return;
            }

            const key = record.s3.object.key;

            const firstSlash = key.indexOf('/');

            if (firstSlash < 0) {
                console.warn('[Records] Unable to process key:', key);
                return;
            }

            const recordName = key.substring(0, firstSlash);
            const fileName = key.substring(firstSlash + 1);

            const result = await filesStore.setFileRecordAsUploaded(
                recordName,
                fileName
            );

            if (result.success === false) {
                if (result.errorCode === 'file_not_found') {
                    console.error('[Records] File not found:', key);
                }
            } else {
                console.log('[Records] File marked as uploaded:', key);
            }
        })
    );
}

export async function handleApiEvent(
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
    const query: GenericHttpRequest['query'] = {
        ...event.queryStringParameters,
    };

    const headers: GenericHttpHeaders = {};
    for (let key in event.headers) {
        const value = event.headers[key];
        headers[key.toLowerCase()] = value;
    }

    const response = await server.handleRequest({
        method: event.httpMethod as GenericHttpRequest['method'],
        path: event.path,
        pathParams: event.pathParameters,
        ipAddress: event.requestContext.identity.sourceIp,
        body: event.body,
        query,
        headers,
    });

    return {
        statusCode: response.statusCode,
        body: response.body ?? null,
        headers: response.headers,
    };
}

export async function handleRecords(
    event: APIGatewayProxyEvent | S3Event | EventBridgeEvent<any, any>
) {
    if ('httpMethod' in event) {
        return handleApiEvent(event);
    } else if ('source' in event) {
        return handleEventBridgeEvent(event);
    } else {
        return handleS3Event(event);
    }
}
