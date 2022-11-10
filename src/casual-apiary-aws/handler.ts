import 'source-map-support/register';
import {
    APIGatewayProxyEvent,
    APIGatewayProxyStructuredResultV2,
    Context,
} from 'aws-lambda';
import AWS, { ApiGatewayManagementApi } from 'aws-sdk';
import { v4 as uuid } from 'uuid';
import {
    ADD_ATOMS,
    CausalRepoMessageHandlerMethods,
    GET_UPDATES,
    SEND_EVENT,
    UNWATCH_BRANCH,
    UNWATCH_BRANCH_DEVICES,
    WATCH_BRANCH,
    WATCH_BRANCH_DEVICES,
} from '@casual-simulation/causal-trees';
import {
    LoginPacket,
    LoginResultPacket,
    MessagePacket,
    Packet,
} from './src/Events';
import {
    downloadObject,
    getDocumentClient,
    getMessageUploadUrl,
    parseMessage,
    setSpan,
    uploadMessage,
} from './src/Utils';
import {
    AwsDownloadRequest,
    AwsMessage,
    AwsMessageTypes,
    AwsUploadRequest,
    AwsUploadResponse,
} from './src/AwsMessages';
import { CausalRepoServer } from './src/CausalRepoServer';
import { DynamoDbConnectionStore } from './src/DynamoDbConnectionStore';
import { ApiGatewayMessenger } from './src/ApiGatewayMessenger';
import { DynamoDbAtomStore } from './src/DynamoDbAtomStore';
import { DEVICE_COUNT, Message } from './src/ApiaryMessenger';
import { ApiaryConnectionStore } from './src/ApiaryConnectionStore';
import { ApiaryAtomStore } from './src/ApiaryAtomStore';
import { RedisClient, createClient as createRedisClient } from 'redis';
import { RedisAtomStore } from './src/RedisAtomStore';
import { RedisConnectionStore } from './src/RedisConnectionStore';
import { RedisUpdatesStore } from './src/RedisUpdatesStore';
import { ADD_UPDATES, SYNC_TIME } from './src/ExtraEvents';

export const ATOMS_TABLE_NAME = process.env.ATOMS_TABLE;
export const CONNECTIONS_TABLE_NAME = process.env.CONNECTIONS_TABLE;
export const NAMESPACE_CONNECTIONS_TABLE_NAME =
    process.env.NAMESPACE_CONNECTIONS_TABLE;
export const REDIS_HOST = process.env.REDIS_HOST;
export const REDIS_PORT = parseInt(process.env.REDIS_PORT);
export const REDIS_PASS = process.env.REDIS_PASS;
export const USE_REDIS = process.env.USE_REDIS === 'true';
export const REDIS_TLS = process.env.REDIS_TLS
    ? process.env.REDIS_TLS === 'true'
    : true;
export const REDIS_NAMESPACE = process.env.REDIS_NAMESPACE;

if (USE_REDIS) {
    console.log('[handler] Using Redis.');
}

const RECREATE_CLIENTS = USE_REDIS;
export async function connect(
    event: APIGatewayProxyEvent,
    context: any
): Promise<APIGatewayProxyStructuredResultV2> {
    if (context.serverlessSdk) {
        setSpan(context.serverlessSdk.span);
    }

    console.log(
        `Got WebSocket connection: ${event.requestContext.connectionId}`
    );

    return {
        statusCode: 200,
    };
}

export async function disconnect(
    event: APIGatewayProxyEvent,
    context: any
): Promise<APIGatewayProxyStructuredResultV2> {
    if (context.serverlessSdk) {
        setSpan(context.serverlessSdk.span);
    }

    console.log(
        `Got WebSocket disconnect: ${event.requestContext.connectionId}`
    );
    const [server, cleanup] = getCausalRepoServer(event);
    try {
        await server.disconnect(event.requestContext.connectionId);

        return {
            statusCode: 200,
        };
    } finally {
        cleanup();
    }
}

export async function message(
    event: APIGatewayProxyEvent,
    context: any
): Promise<APIGatewayProxyStructuredResultV2> {
    if (context.serverlessSdk) {
        setSpan(context.serverlessSdk.span);
    }

    const message = parseMessage<AwsMessage>(event.body);

    if (message) {
        if (message[0] === AwsMessageTypes.Message) {
            const packet = parseMessage<Packet>(message[1]);
            if (packet) {
                console.log('[handler] Got packet!');
                await processPacket(event, packet);
            }
        } else if (message[0] === AwsMessageTypes.UploadRequest) {
            console.log('[handler] Processing upload request!');
            await processUpload(event, message);
        } else if (message[0] === AwsMessageTypes.DownloadRequest) {
            console.log('[handler] Processing download request!');
            await processDownload(event, message);
        }
    }

    console.log('[handler] Done.');

    return {
        statusCode: 200,
    };
}

export async function webhook(
    event: APIGatewayProxyEvent,
    context: any
): Promise<APIGatewayProxyStructuredResultV2> {
    if (context.serverlessSdk) {
        setSpan(context.serverlessSdk.span);
    }

    const branch =
        event.queryStringParameters['server'] ??
        event.queryStringParameters['inst'];
    if (!branch) {
        console.log('[handler] No server/inst query parameter was provided!');
        return {
            statusCode: 404,
        };
    }

    const [server, cleanup] = getCausalRepoServer(event);
    let errored = false;
    try {
        const domain = event.requestContext.domainName;
        const url = `https://${domain}${event.path}`;
        const data = JSON.parse(event.body);

        try {
            const statusCode = await server.webhook(
                branch,
                event.httpMethod,
                url,
                event.headers,
                data
            );
            return {
                statusCode,
            };
        } catch (err) {
            errored = true;
            throw err;
        }
    } catch (parseError) {
        if (errored) {
            throw parseError;
        }
        return {
            statusCode: 400,
        };
    } finally {
        cleanup();
    }
}

export async function instData(
    event: APIGatewayProxyEvent,
    context: any
): Promise<APIGatewayProxyStructuredResultV2> {
    const branch =
        event.queryStringParameters['server'] ??
        event.queryStringParameters['inst'];
    if (!branch) {
        console.log('[handler] No server/inst query parameter was provided!');
        return {
            statusCode: 404,
        };
    }

    const [server, cleanup] = getCausalRepoServer(event);
    try {
        const data = await server.getBranchData(branch);

        return {
            statusCode: 200,
            body: JSON.stringify(data),
            headers: {
                'content-type': 'application/json',
            },
        };
    } catch (err) {
        console.error(
            '[handler] An error occurred while getting inst data:',
            err
        );
        return {
            statusCode: 500,
        };
    } finally {
        cleanup();
    }
}

async function processPacket(event: APIGatewayProxyEvent, packet: Packet) {
    if (packet) {
        if (packet.type === 'login') {
            await login(event, packet);
        } else if (packet.type === 'message') {
            await messagePacket(event, packet);
        }
    }
}

export async function processUpload(
    event: APIGatewayProxyEvent,
    message: AwsUploadRequest
) {
    const uploadUrl = await getMessageUploadUrl();

    const response: AwsUploadResponse = [
        AwsMessageTypes.UploadResponse,
        message[1],
        uploadUrl,
    ];
    const [server, cleanup] = getCausalRepoServer(event);

    try {
        if (!server.messenger.sendRaw) {
            throw new Error(
                'The messenger must implement sendRaw() to support AWS lambda!'
            );
        }
        await server.messenger.sendRaw(
            event.requestContext.connectionId,
            JSON.stringify(response)
        );
    } finally {
        cleanup();
    }
}

export async function processDownload(
    event: APIGatewayProxyEvent,
    message: AwsDownloadRequest
) {
    const data = await downloadObject(message[1]);
    const packet = parseMessage<Packet>(data);
    await processPacket(event, packet);
}

async function login(event: APIGatewayProxyEvent, packet: LoginPacket) {
    const result: LoginResultPacket = {
        type: 'login_result',
    };

    console.log('[handler] Logging in...');

    const [server, cleanup] = getCausalRepoServer(event);
    try {
        await server.connect({
            connectionId: event.requestContext.connectionId,
            sessionId: packet.sessionId,
            username: packet.username,
            token: packet.token,
        });

        console.log('[handler] Logged in!');

        if (!server.messenger.sendPacket) {
            throw new Error(
                'The messenger must implement sendPacket() to support AWS lambda!'
            );
        }
        await server.messenger.sendPacket(
            event.requestContext.connectionId,
            result
        );
    } finally {
        console.log('[handler] Cleaning up!');
        cleanup();
    }
}

async function messagePacket(
    event: APIGatewayProxyEvent,
    packet: MessagePacket
) {
    const [server, cleanup] = getCausalRepoServer(event);
    try {
        const message: Message = {
            name: <any>packet.channel,
            data: packet.data,
        };
        const connectionId = event.requestContext.connectionId;
        if (message.name === WATCH_BRANCH) {
            await server.watchBranch(connectionId, message.data);
        } else if (message.name === ADD_ATOMS) {
            await server.addAtoms(connectionId, message.data);
        } else if (message.name === ADD_UPDATES) {
            await server.addUpdates(connectionId, message.data);
        } else if (message.name === GET_UPDATES) {
            await server.getUpdates(connectionId, message.data);
        } else if (message.name === UNWATCH_BRANCH) {
            await server.unwatchBranch(connectionId, message.data);
        } else if (message.name === SEND_EVENT) {
            await server.sendEvent(connectionId, message.data);
        } else if (message.name == WATCH_BRANCH_DEVICES) {
            await server.watchBranchDevices(connectionId, message.data);
        } else if (message.name === UNWATCH_BRANCH_DEVICES) {
            await server.unwatchBranchDevices(connectionId, message.data);
        } else if (message.name === DEVICE_COUNT) {
            await server.deviceCount(connectionId, <string>(<any>message.data));
        } else if (message.name === SYNC_TIME) {
            await server.syncTime(
                connectionId,
                message.data,
                event.requestContext.requestTimeEpoch
            );
        }
    } finally {
        cleanup();
    }
}

let _server: readonly [CausalRepoServer, () => void];

function getCausalRepoServer(event: APIGatewayProxyEvent) {
    if (!_server || RECREATE_CLIENTS) {
        _server = createCausalRepoServer(event);
    }
    return _server;
}

function createCausalRepoServer(event: APIGatewayProxyEvent) {
    if (USE_REDIS) {
        console.log('[handler] Creating redis server!');
        const [redisClient, cleanup] = createRedis();
        const connectionStore = new RedisConnectionStore(
            REDIS_NAMESPACE,
            redisClient
        );

        const result = [
            new CausalRepoServer(
                connectionStore,
                new RedisAtomStore(REDIS_NAMESPACE, redisClient),
                new ApiGatewayMessenger(callbackUrl(event), connectionStore),
                new RedisUpdatesStore(REDIS_NAMESPACE, redisClient)
            ),
            () => {
                cleanup();
            },
        ] as const;

        console.log('[handler] Server created!');

        return result;
    } else {
        console.log('[handler] Creating DynamoDB server!');
        const documentClient = getDocumentClient();
        const connectionStore = new DynamoDbConnectionStore(
            CONNECTIONS_TABLE_NAME,
            NAMESPACE_CONNECTIONS_TABLE_NAME,
            documentClient
        );
        const result = [
            new CausalRepoServer(
                connectionStore,
                new DynamoDbAtomStore(ATOMS_TABLE_NAME, documentClient),
                new ApiGatewayMessenger(callbackUrl(event), connectionStore),
                null
            ),
            () => {},
        ] as const;

        console.log('[handler] Server created!');
        return result;
    }
}

function createRedis() {
    const client = createRedisClient({
        host: REDIS_HOST,
        port: REDIS_PORT,
        password: REDIS_PASS,
        tls: REDIS_TLS,

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
    return [
        client,
        () => {
            try {
                client.quit();
            } catch (err) {
                console.error(err);
            }
        },
    ] as const;
}

function callbackUrl(event: APIGatewayProxyEvent): string {
    if (process.env.IS_OFFLINE) {
        return 'http://localhost:4001';
    }

    return process.env.WEBSOCKET_URL || 'https://websocket.casualos.com';
}

function handleEvents(
    message: MessagePacket,
    handlers: Partial<CausalRepoMessageHandlerMethods>
): any {
    const handler = handlers[message.channel];

    if (handler) {
        return handler(message);
    }

    return undefined;
}

interface WebSocketPacket {
    connectionId: string;
    sequenceNumber: number;
    data: string;
}

interface WebSocketRetrievedPacket {
    sequenceNumber: number;
    data: string;
}
