// Create clients and set shared const values outside of the handler.
import { getAllowedAPIOrigins, allowedOrigins } from '../utils';
import {
    GenericHttpRequest,
    GenericHttpHeaders,
} from '@casual-simulation/aux-records';
import type {
    APIGatewayProxyEvent,
    APIGatewayProxyResult,
    EventBridgeEvent,
    S3Event,
} from 'aws-lambda';
import {
    BuilderOptions,
    ServerBuilder,
} from '../../../../shared/ServerBuilder';
import { loadConfig } from '../../../../shared/ConfigUtils';
import { merge } from 'lodash';

declare var S3_ENDPOINT: string;
declare var DEVELOPMENT: boolean;

// Get the DynamoDB table name from environment variables
const FILES_BUCKET = process.env.FILES_BUCKET;
const FILES_STORAGE_CLASS = process.env.FILES_STORAGE_CLASS;
const REGION = process.env.AWS_REGION;

const staticConfig = loadConfig();
const dynamicConfig: BuilderOptions = {
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

if (config.rateLimit && config.rateLimit.windowMs && config.rateLimit.maxHits) {
    builder.useRedisRateLimit();
}

if (config.openai && config.ai) {
    builder.useOpenAI();
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
