import {
    AuthenticatedConnectionClient,
    ConnectionIndicator,
    InstRecordsClient,
    InstRecordsClientTimeSyncConnection,
    connectionCountMessageSchema,
} from '@casual-simulation/aux-common';
import { ApiGatewayWebsocketConnectionClient } from '@casual-simulation/aux-websocket-aws';
import { WebsocketConnectionClient } from '@casual-simulation/aux-websocket';
import {
    PartitionConfig,
    RemoteCausalRepoPartition,
    BotPartition,
    OtherPlayersPartition,
    OtherPlayersPartitionImpl,
    RemoteCausalRepoProtocol,
    RemoteYjsPartitionImpl,
    YjsPartition,
} from '@casual-simulation/aux-common';
import { SocketManager as WebSocketManager } from '@casual-simulation/websocket';
import { AuxTimeSyncConfiguration } from '@casual-simulation/aux-vm';
import { TimeSyncController } from '@casual-simulation/timesync';

/**
 * A map of hostnames to CausalRepoClients.
 * Helps prevent duplicating websocket connections to the same host.
 */
let awsApiaryClientCache = new Map<string, InstRecordsClient>();

/**
 * A map of hostnames to CausalRepoClients.
 * Helps prevent duplicating websocket connections to the same host.
 */
let websocketClientCache = new Map<string, InstRecordsClient>();

/**
 * Gets the causal repo client that should be used for the given host.
 * @param host The host.
 */
export function getClientForHostAndProtocol(
    host: string,
    indicator: ConnectionIndicator,
    protocol: RemoteCausalRepoProtocol
): InstRecordsClient {
    if (protocol === 'apiary-aws') {
        return getAWSApiaryClientForHostAndProtocol(host, indicator);
    } else {
        return getWebSocketClientForHost(host, indicator);
    }
}

/**
 * Gets the casual repo client that should be used for the given host when connecting over the AWS Apiary protocol.
 * @param host The URl that should be connected to.
 * @param user The user that the connection should be made with.
 */
export function getAWSApiaryClientForHostAndProtocol(
    host: string,
    indicator: ConnectionIndicator
): InstRecordsClient {
    let client = awsApiaryClientCache.get(host);
    if (!client) {
        const url = new URL(host);

        if (url.protocol === 'http:') {
            url.protocol = 'ws:';
        } else if (url.protocol === 'https:') {
            url.protocol = 'wss:';
        }

        const manager = new WebSocketManager(url.href);
        manager.init();

        const awsConnection = new ApiGatewayWebsocketConnectionClient(
            manager.socket
        );
        const connection = new AuthenticatedConnectionClient(
            awsConnection,
            indicator
        );
        client = new InstRecordsClient(connection);
        awsApiaryClientCache.set(host, client);

        connection.connect();
    }

    return client;
}

/**
 * Gets the causal repo client that should be used for the given host when connecting over the websocket protocol.
 * @param host The host.
 */
export function getWebSocketClientForHost(
    host: string,
    indicator: ConnectionIndicator
): InstRecordsClient {
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
        const inner = new WebsocketConnectionClient(manager.socket);
        const connection = new AuthenticatedConnectionClient(inner, indicator);
        client = new InstRecordsClient(connection);
        websocketClientCache.set(host, client);

        connection.connect();
    }

    return client;
}

/**
 * Attempts to create a CausalTree2Partition from the given config.
 * @param config The config.
 */
export async function createRemoteYjsPartition(
    config: PartitionConfig,
    indicator: ConnectionIndicator,
    useCache: boolean = true
): Promise<YjsPartition> {
    if (config.type === 'remote_yjs') {
        const client = getClientForHostAndProtocol(
            config.host,
            indicator,
            config.connectionProtocol
        );
        const partition = new RemoteYjsPartitionImpl(client, config);
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
    indicator: ConnectionIndicator,
    useCache: boolean = true
): Promise<OtherPlayersPartition> {
    if (config.type === 'other_players_repo') {
        const client = getClientForHostAndProtocol(
            config.host,
            indicator,
            config.connectionProtocol
        );
        const partition = new OtherPlayersPartitionImpl(client, config);
        return partition;
    }
    return undefined;
}

export function createTimeSyncController(
    config: AuxTimeSyncConfiguration,
    indicator: ConnectionIndicator
): TimeSyncController {
    if (config.host) {
        const client = getClientForHostAndProtocol(
            config.host,
            indicator,
            config.connectionProtocol
        );
        return new TimeSyncController(
            new InstRecordsClientTimeSyncConnection(client)
        );
    }

    return undefined;
}
