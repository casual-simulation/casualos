import 'source-map-support/register';
import {
    APIGatewayProxyEvent,
    APIGatewayProxyStructuredResultV2,
    Context,
} from 'aws-lambda';
import { constructServerBuilder } from '../LoadServer';

const builder = constructServerBuilder();

const { server, filesStore } = builder.build();

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
    await builder.ensureInitialized();
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
    await builder.ensureInitialized();
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
