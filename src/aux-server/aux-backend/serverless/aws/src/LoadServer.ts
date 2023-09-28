import { MESSAGES_BUCKET_NAME } from './WebsocketUtils';
import { BuilderOptions, ServerBuilder } from '../../../shared/ServerBuilder';
import { getAllowedAPIOrigins, allowedOrigins } from './utils';
import { merge } from 'lodash';
import { loadConfig } from '../../../shared/ConfigUtils';

declare var S3_ENDPOINT: string;
declare var DEVELOPMENT: boolean;

// Get the DynamoDB table name from environment variables
export const FILES_BUCKET = process.env.FILES_BUCKET;
export const FILES_STORAGE_CLASS = process.env.FILES_STORAGE_CLASS;
export const REGION = process.env.AWS_REGION;
export const WEBSOCKET_URL = process.env.WEBSOCKET_URL;

/**
 * Loads the server and configures it.
 */
export function constructServerBuilder() {
    const staticConfig = loadConfig();
    const dynamicConfig: BuilderOptions = {
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

    const config = merge({}, staticConfig, dynamicConfig);

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

    if (config.redis && config.redis.cacheNamespace) {
        builder.useRedisCache();
    }

    if (config.prisma && config.s3) {
        builder.usePrismaWithS3();
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
        builder.useRedisRateLimit();
    }

    if (config.redis && config.redis.websocketConnectionNamespace) {
        builder.useRedisWebsocketConnectionStore();
    }

    if (config.ws && config.apiGateway && config.s3) {
        builder.useApiGatewayWebsocketMessenger();
    }

    if (
        config.redis &&
        config.redis.tempInstRecordsStoreNamespace &&
        config.redis.publicInstRecordsStoreNamespace &&
        config.prisma
    ) {
        builder.usePrismaAndRedisInstRecords();
    }

    if (config.ai) {
        builder.useAI();
    }

    return builder;
}
