import { User } from '@casual-simulation/causal-trees';
import { CausalRepoClient } from '@casual-simulation/causal-trees/core2';
import { BotHttpClient } from './BotHttpClient';
import {
    PartitionConfig,
    RemoteCausalRepoPartition,
    RemoteCausalRepoPartitionImpl,
    BotPartition,
    BotPartitionImpl,
    OtherPlayersPartition,
    OtherPlayersPartitionImpl,
    RemoteCausalRepoProtocol,
    RemoteYjsPartitionImpl,
    YjsPartition,
} from '@casual-simulation/aux-common';
import {
    AwsSocket,
    ApiaryConnectionClient,
} from '@casual-simulation/causal-tree-client-apiary';
import { WebSocketConnectionClient } from '@casual-simulation/causal-tree-client-websocket';
import { SocketManager as WebSocketManager } from '@casual-simulation/websocket';

/**
 * A map of hostnames to CausalRepoClients.
 * Helps prevent duplicating websocket connections to the same host.
 */
let awsApiaryClientCache = new Map<string, CausalRepoClient>();

/**
 * A map of hostnames to CausalRepoClients.
 * Helps prevent duplicating websocket connections to the same host.
 */
let websocketClientCache = new Map<string, CausalRepoClient>();

/**
 * Gets the causal repo client that should be used for the given host.
 * @param host The host.
 */
export function getClientForHostAndProtocol(
    host: string,
    user: User,
    protocol: RemoteCausalRepoProtocol
): CausalRepoClient {
    if (protocol === 'apiary-aws') {
        return getAWSApiaryClientForHostAndProtocol(host, user);
    } else {
        return getWebSocketClientForHost(host, user);
    }
}

/**
 * Gets the casual repo client that should be used for the given host when connecting over the AWS Apiary protocol.
 * @param host The URl that should be connected to.
 * @param user The user that the connection should be made with.
 */
export function getAWSApiaryClientForHostAndProtocol(
    host: string,
    user: User
): CausalRepoClient {
    let client = awsApiaryClientCache.get(host);
    if (!client) {
        const manager = new WebSocketManager(host);
        manager.init();
        const socket = new AwsSocket(manager.socket);
        const connection = new ApiaryConnectionClient(socket, user);
        client = new CausalRepoClient(connection);
        awsApiaryClientCache.set(host, client);

        socket.open();
    }

    return client;
}

/**
 * Gets the causal repo client that should be used for the given host when connecting over the websocket protocol.
 * @param host The host.
 */
export function getWebSocketClientForHost(
    host: string,
    user: User
): CausalRepoClient {
    let client = websocketClientCache.get(host);
    if (!client) {
        const url = new URL('/websocket', host);

        if (url.protocol === 'http:') {
            url.protocol = 'ws:';
        } else if (url.protocol === 'https:') {
            url.protocol = 'wss:';
        }

        const manager = new WebSocketManager(url.href);
        manager.init();
        const connection = new WebSocketConnectionClient(manager.socket, user);
        client = new CausalRepoClient(connection);
        websocketClientCache.set(host, client);

        connection.connect();
    }

    return client;
}

/**
 * Attempts to create a CausalTree2Partition from the given config.
 * @param config The config.
 */
export async function createRemoteCausalRepoPartition(
    config: PartitionConfig,
    user: User,
    useCache: boolean = true
): Promise<RemoteCausalRepoPartition> {
    if (config.type === 'remote_causal_repo') {
        const client = getClientForHostAndProtocol(
            config.host,
            user,
            config.connectionProtocol
        );
        const partition = new RemoteCausalRepoPartitionImpl(
            user,
            client,
            config
        );
        await partition.init();
        return partition;
    }
    return undefined;
}

/**
 * Attempts to create a CausalTree2Partition from the given config.
 * @param config The config.
 */
export async function createRemoteYjsPartition(
    config: PartitionConfig,
    user: User,
    useCache: boolean = true
): Promise<YjsPartition> {
    if (config.type === 'remote_yjs') {
        const client = getClientForHostAndProtocol(
            config.host,
            user,
            config.connectionProtocol
        );
        const partition = new RemoteYjsPartitionImpl(user, client, config);
        await partition.init();
        return partition;
    }
    return undefined;
}

/**
 * Attempts to create a CausalTree2Partition from the given config.
 * @param config The config.
 */
export async function createOtherPlayersRepoPartition(
    config: PartitionConfig,
    user: User,
    useCache: boolean = true
): Promise<OtherPlayersPartition> {
    if (config.type === 'other_players_repo') {
        const client = getClientForHostAndProtocol(
            config.host,
            user,
            config.connectionProtocol
        );
        const partition = new OtherPlayersPartitionImpl(user, client, config);
        return partition;
    }
    return undefined;
}

export async function createBotPartition(
    config: PartitionConfig
): Promise<BotPartition> {
    if (config.type === 'bot') {
        const client = new BotHttpClient(config.host);
        const partition = new BotPartitionImpl(client, config);
        return partition;
    }
    return undefined;
}
