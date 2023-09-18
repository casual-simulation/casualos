import 'source-map-support/register';
import {
    APIGatewayProxyEvent,
    APIGatewayProxyStructuredResultV2,
    Context,
} from 'aws-lambda';
// import {
//     ADD_ATOMS,
//     CausalRepoMessageHandlerMethods,
//     GET_UPDATES,
//     SEND_EVENT,
//     UNWATCH_BRANCH,
//     UNWATCH_BRANCH_DEVICES,
//     WATCH_BRANCH,
//     WATCH_BRANCH_DEVICES,
// } from '@casual-simulation/aux-common';
// import {
//     MESSAGES_BUCKET_NAME,
//     downloadObject,
//     getMessageUploadUrl,
//     getS3Client,
//     parseMessage,
//     setSpan,
//     uploadMessage,
// } from '../WebsocketUtils';
// import {
//     AwsDownloadRequest,
//     AwsMessage,
//     AwsMessageTypes,
//     AwsUploadRequest,
//     AwsUploadResponse,
// } from '../AwsMessages';
// import { ApiGatewayMessenger } from '../ApiGatewayMessenger';
// import {
//     LoginPacket,
//     LoginResultPacket,
//     MessagePacket,
//     Packet,
//     ApiaryCausalRepoServer,
//     DEVICE_COUNT,
//     Message,
//     ApiaryConnectionStore,
//     ApiaryAtomStore,
//     ADD_UPDATES,
//     SYNC_TIME,
// } from '@casual-simulation/casual-apiary';
// import { RedisClient, createClient as createRedisClient } from 'redis';
// import {
//     RedisAtomStore,
//     RedisConnectionStore,
//     RedisUpdatesStore,
// } from '@casual-simulation/casual-apiary-redis';
// import RedisRateLimitStore from '@casual-simulation/rate-limit-redis';
import { getAllowedAPIOrigins, allowedOrigins } from '../utils';
import { loadConfig } from '../../../../shared/ConfigUtils';
import { merge } from 'lodash';
import type { BuilderOptions } from '../../../../shared/ServerBuilder';
import { ServerBuilder, optionsSchema } from '../../../../shared/ServerBuilder';
import z from 'zod';
import { constructServerBuilder } from '../LoadServer';

const builder = constructServerBuilder();

const { server, filesStore } = builder.build();

// optionsSchema.required({
//     redis: true,
// });

// const redisSchema = optionsSchema.shape.redis
//     .unwrap()
//     .required({
//         host: true,
//         port: true,
//         tls: true,
//         password: true,
//     })
//     .partial({
//         maxBranchSizeBytes: true,
//         mergeUpdatesOnMaxSizeExceeded: true,
//     });
// const rateLimitSchema = z.union([
//     z.null(),
//     optionsSchema.shape.rateLimit.unwrap().required(),
// ]);

// const redis = redisSchema.parse(config.redis);
// const rateLimitConfig = rateLimitSchema.parse(config.rateLimit ?? null);

// const REDIS_HOST: string = process.env.REDIS_HOST as string;
// const REDIS_PORT: number = parseInt(process.env.REDIS_PORT as string);
// const REDIS_PASS: string = process.env.REDIS_PASS as string;
// const REDIS_TLS: boolean = process.env.REDIS_TLS
//     ? process.env.REDIS_TLS === 'true'
//     : true;
// const REDIS_NAMESPACE: string = process.env.REDIS_NAMESPACE as string;

// const MERGE_UPDATES_ON_MAX_SIZE_EXCEEDED: boolean = process.env
//     .MERGE_UPDATES_ON_MAX_SIZE_EXCEEDED
//     ? process.env.MERGE_UPDATES_ON_MAX_SIZE_EXCEEDED === 'true'
//     : false;

// const MAX_BRANCH_SIZE: number =
//     process.env.MAX_BRANCH_SIZE === 'Infinity'
//         ? Infinity
//         : process.env.MAX_BRANCH_SIZE
//         ? parseInt(process.env.MAX_BRANCH_SIZE)
//         : Infinity;

// const RATE_LIMIT_WINDOW_MS: number = process.env.RATE_LIMIT_WINDOW_MS
//     ? parseInt(process.env.RATE_LIMIT_WINDOW_MS)
//     : null;

// const RATE_LIMIT_MAX: number = process.env.RATE_LIMIT_MAX
//     ? parseInt(process.env.RATE_LIMIT_MAX)
//     : null;

// const REDIS_RATE_LIMIT_PREFIX: string =
//     process.env.REDIS_RATE_LIMIT_PREFIX || 'rl:';

// console.log('[handler] Using Redis.');

export async function connect(
    event: APIGatewayProxyEvent,
    context: any
): Promise<APIGatewayProxyStructuredResultV2> {
    console.log(`
[handler] Got WebSocket connection: ${event.requestContext.connectionId}
[handler] User Agent: ${event.requestContext.identity.userAgent}
[handler] IP Address: ${event.requestContext.identity.sourceIp}
`);

    await server.handleWebsocketRequest({
        type: 'connect',
        connectionId: event.requestContext.connectionId as string,
        ipAddress: event.requestContext.identity.sourceIp,
        body: event.body,
    });

    return {
        statusCode: 200,
    };
}

export async function disconnect(
    event: APIGatewayProxyEvent,
    context: any
): Promise<APIGatewayProxyStructuredResultV2> {
    console.log(
        `[handler] Got WebSocket disconnect: ${event.requestContext.connectionId}`
    );

    await server.handleWebsocketRequest({
        type: 'disconnect',
        connectionId: event.requestContext.connectionId as string,
        ipAddress: event.requestContext.identity.sourceIp,
        body: event.body,
    });

    return {
        statusCode: 200,
    };
}

export async function message(
    event: APIGatewayProxyEvent,
    context: any
): Promise<APIGatewayProxyStructuredResultV2> {
    await server.handleWebsocketRequest({
        type: 'message',
        connectionId: event.requestContext.connectionId as string,
        ipAddress: event.requestContext.identity.sourceIp,
        body: event.body,
    });

    return {
        statusCode: 200,
    };
}

// export async function webhook(
//     event: APIGatewayProxyEvent,
//     context: any
// ): Promise<APIGatewayProxyStructuredResultV2> {
//     if (context.serverlessSdk) {
//         setSpan(context.serverlessSdk.span);
//     }

//     if (!event.queryStringParameters) {
//         return {
//             statusCode: 404,
//         };
//     }

//     const branch =
//         event.queryStringParameters['server'] ??
//         event.queryStringParameters['inst'];
//     if (!branch) {
//         console.log('[handler] No server/inst query parameter was provided!');
//         return {
//             statusCode: 404,
//         };
//     }

//     const [server, cleanup, rateLimiter] = getCausalRepoServer(event);
//     let errored = false;
//     try {
//         const rateLimitResult = await rateLimit(rateLimiter, event);
//         if (!rateLimitResult.success) {
//             // TODO: Send a response
//             return;
//         }

//         const domain = event.requestContext.domainName;
//         const url = `https://${domain}${event.path}`;
//         const data = JSON.parse(event.body);

//         try {
//             const statusCode = await server.webhook(
//                 branch,
//                 event.httpMethod,
//                 url,
//                 event.headers,
//                 data
//             );
//             return {
//                 statusCode,
//             };
//         } catch (err) {
//             errored = true;
//             throw err;
//         }
//     } catch (parseError) {
//         if (errored) {
//             throw parseError;
//         }
//         return {
//             statusCode: 400,
//         };
//     } finally {
//         cleanup();
//     }
// }

// export async function instData(
//     event: APIGatewayProxyEvent,
//     context: any
// ): Promise<APIGatewayProxyStructuredResultV2> {
//     if (!event.queryStringParameters) {
//         return {
//             statusCode: 404,
//         };
//     }

//     const branch =
//         event.queryStringParameters['server'] ??
//         event.queryStringParameters['inst'];
//     if (!branch) {
//         console.log('[handler] No server/inst query parameter was provided!');
//         return {
//             statusCode: 404,
//         };
//     }

//     const [server, cleanup, rateLimiter] = getCausalRepoServer(event);
//     try {
//         const rateLimitResult = await rateLimit(rateLimiter, event);
//         if (!rateLimitResult.success) {
//             return {
//                 statusCode: 429,
//                 headers: {
//                     'Retry-After': rateLimitResult.retryAfterSeconds,
//                 },
//             };
//         }

//         const data = await server.getBranchData(branch);

//         return {
//             statusCode: 200,
//             body: JSON.stringify(data),
//             headers: {
//                 'content-type': 'application/json',
//             },
//         };
//     } catch (err) {
//         console.error(
//             '[handler] An error occurred while getting inst data:',
//             err
//         );
//         return {
//             statusCode: 500,
//         };
//     } finally {
//         cleanup();
//     }
// }z
