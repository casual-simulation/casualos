import { ServerBuilder } from './ServerBuilder';
import { getAllowedAPIOrigins, allowedOrigins } from './EnvUtils';
import { merge } from 'lodash';
import { loadConfig } from './ConfigUtils';
import { ServerConfig } from '@casual-simulation/aux-records';

declare var S3_ENDPOINT: string;
declare var DEVELOPMENT: boolean;

// Get the DynamoDB table name from environment variables
export const MESSAGES_BUCKET_NAME = process.env.MESSAGES_BUCKET;
export const FILES_BUCKET = process.env.FILES_BUCKET;
export const FILES_STORAGE_CLASS = process.env.FILES_STORAGE_CLASS;
export const REGION = process.env.AWS_REGION;
export const WEBSOCKET_URL = process.env.WEBSOCKET_URL;

export const MODERATION_JOB_ACCOUNT_ID = process.env.MODERATION_JOB_ACCOUNT_ID;
export const MODERATION_JOB_REPORT_BUCKET =
    process.env.MODERATION_JOB_REPORT_BUCKET;
export const MODERATION_JOB_LAMBDA_FUNCTION_ARN =
    process.env.MODERATION_JOB_LAMBDA_FUNCTION_ARN;
export const MODERATION_JOB_ROLE_ARN = process.env.MODERATION_JOB_ROLE_ARN;
export const MODERATION_JOB_PRIORITY = process.env.MODERATION_JOB_PRIORITY;
export const MODERATION_PROJECT_VERSION =
    process.env.MODERATION_PROJECT_VERSION;

/**
 * Creates a new server builder that uses environment variables that are specific to the serverless environment.
 * See GettingStarted-aws.md for more information.
 * @returns
 */
export function constructServerlessAwsServerBuilder() {
    const dynamicConfig: ServerConfig = {
        s3: {
            region: REGION,
            filesBucket: FILES_BUCKET,
            filesStorageClass: FILES_STORAGE_CLASS,

            messagesBucket: MESSAGES_BUCKET_NAME,

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
        ws: {},
        apiGateway: {
            endpoint: DEVELOPMENT ? 'http://localhost:4001' : WEBSOCKET_URL,
        },
    };

    if (MODERATION_JOB_REPORT_BUCKET) {
        dynamicConfig.rekognition = {
            moderation: {
                files: {
                    job: {
                        accountId: MODERATION_JOB_ACCOUNT_ID || undefined,
                        sourceBucket: FILES_BUCKET || undefined,
                        reportBucket: MODERATION_JOB_REPORT_BUCKET || undefined,
                        lambdaFunctionArn:
                            MODERATION_JOB_LAMBDA_FUNCTION_ARN || undefined,
                        roleArn: MODERATION_JOB_ROLE_ARN || undefined,
                        priority: MODERATION_JOB_PRIORITY
                            ? parseInt(MODERATION_JOB_PRIORITY)
                            : undefined,
                    },
                },
            },
        };
    }

    if (MODERATION_PROJECT_VERSION) {
        dynamicConfig.rekognition = merge(dynamicConfig.rekognition || {}, {
            moderation: {
                files: {
                    scan: {
                        projectVersionArn:
                            MODERATION_PROJECT_VERSION || undefined,
                    },
                },
            },
        });
    }

    return constructServerBuilder(dynamicConfig);
}

/**
 * Loads the server and configures it.
 */
export function constructServerBuilder(dynamicConfig: ServerConfig = {}) {
    const config = loadConfig(true, dynamicConfig);

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

    if (config.telemetry) {
        builder.useTelemetry();
    }

    if (config.redis && config.redis.cacheNamespace) {
        builder.useRedisCache();
    }

    if (config.prisma && config.minio) {
        builder.usePrismaWithMinio();
    } else if (config.prisma && config.s3) {
        builder.usePrismaWithS3();
    } else if (config.prisma && config.mongodb) {
        builder.usePrismaWithMongoDBFileStore();
    } else if (config.mongodb) {
        builder.useMongoDB();
    }

    if (config.livekit) {
        builder.useLivekit();
    }

    if (config.textIt && config.textIt.apiKey && config.textIt.flowId) {
        builder.useTextItAuthMessenger();
    } else if (config.ses) {
        builder.useSesAuthMessenger();
    } else {
        builder.useConsoleAuthMessenger();
    }

    if (
        config.stripe &&
        config.stripe.secretKey &&
        config.stripe.publishableKey &&
        config.subscriptions
    ) {
        builder.useStripeSubscriptions();
    }

    if (
        config.rateLimit &&
        config.rateLimit.windowMs &&
        config.rateLimit.maxHits
    ) {
        if (config.redis) {
            builder.useRedisRateLimit();
        } else if (config.mongodb) {
            builder.useMongoDBRateLimit();
        }
    }

    if (config.websocketRateLimit && config.redis) {
        builder.useRedisWebsocketRateLimit();
    }

    if (config.redis && config.redis.websocketConnectionNamespace) {
        builder.useRedisWebsocketConnectionStore();
    }

    if (config.ws && config.apiGateway && config.s3) {
        builder.useApiGatewayWebsocketMessenger();
    } else if (config.ws) {
        builder.useWSWebsocketMessenger();
    }

    if (
        config.redis &&
        config.redis.tempInstRecordsStoreNamespace &&
        config.redis.instRecordsStoreNamespace &&
        config.prisma
    ) {
        builder.usePrismaAndRedisInstRecords();
    }

    if (config.ai) {
        builder.useAI();
    }

    if (config.privo) {
        builder.usePrivo();
    }

    if (config.notifications) {
        builder.useSystemNotifications();
    }

    if (config.webauthn) {
        builder.useWebAuthn();
    }

    if (config.rekognition?.moderation && config.s3) {
        builder.useRekognitionModeration();
    }

    if (config.webhooks) {
        if (config.privo) {
            console.log(
                '[LoadServer] Skipping webhooks because Privo is enabled.'
            );
        } else {
            builder.useWebhooks();
        }
    }

    if (config.webPush) {
        builder.useWebPushNotifications();
    }

    builder.useAutomaticPlugins();

    return builder;
}
