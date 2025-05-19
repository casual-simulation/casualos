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
import 'source-map-support/register';
import '../Instrumentation';
import type {
    APIGatewayProxyEvent,
    APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';
import { constructServerlessAwsServerBuilder } from '../../../../shared/LoadServer';
import type { GenericHttpHeaders } from '@casual-simulation/aux-common';

const builder = constructServerlessAwsServerBuilder();

const { server, redisClient } = builder.build();

export async function connect(
    event: APIGatewayProxyEvent,
    context: any
): Promise<APIGatewayProxyStructuredResultV2> {
    console.log(`
[handler] Got WebSocket connection: ${event.requestContext.connectionId}
[handler] User Agent: ${event.requestContext.identity.userAgent}
[handler] IP Address: ${event.requestContext.identity.sourceIp}
`);
    await builder.ensureInitialized();

    console.log('[handler] Headers:', event.headers);
    const headers: GenericHttpHeaders = {};
    for (let key in event.headers) {
        const value = event.headers[key];
        headers[key.toLowerCase()] = value;
    }

    const origin = headers['origin'];
    console.log(`[handler] Origin: ${origin}`);
    const connectionId: string = event.requestContext.connectionId as string;
    if (redisClient && origin) {
        console.log(`[handler] Origin: ${origin}`);
        const originKey = `origin:${connectionId}`;
        await redisClient.set(originKey, origin);
        await redisClient.expire(originKey, 60 * 60 * 24); // 24 hours
    }

    await server.handleWebsocketRequest({
        type: 'connect',
        connectionId: event.requestContext.connectionId as string,
        ipAddress: event.requestContext.identity.sourceIp,
        body: event.body,
        origin,
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
    await builder.ensureInitialized();

    const connectionId = event.requestContext.connectionId as string;
    const origin = await getOrigin(connectionId, event);

    if (redisClient && origin) {
        await redisClient.del(`origin:${connectionId}`);
    }

    await server.handleWebsocketRequest({
        type: 'disconnect',
        connectionId,
        ipAddress: event.requestContext.identity.sourceIp,
        body: event.body,
        origin,
    });

    return {
        statusCode: 200,
    };
}

export async function message(
    event: APIGatewayProxyEvent,
    context: any
): Promise<APIGatewayProxyStructuredResultV2> {
    console.log('[handler] Got WebSocket message');
    await builder.ensureInitialized();
    const connectionId = event.requestContext.connectionId as string;
    await server.handleWebsocketRequest({
        type: 'message',
        connectionId,
        ipAddress: event.requestContext.identity.sourceIp,
        body: event.body,
        origin: await getOrigin(connectionId, event),
    });

    return {
        statusCode: 200,
    };
}

async function getOrigin(
    connectionId: string,
    event: APIGatewayProxyEvent
): Promise<string> {
    if (redisClient) {
        const origin =
            (await redisClient.get(`origin:${connectionId}`)) ??
            event.headers?.origin ??
            null;

        console.log(`[handler] Origin: ${origin}`);
        return origin;
    }
    return event.headers?.origin ?? null;
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
