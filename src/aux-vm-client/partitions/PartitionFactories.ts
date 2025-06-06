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
import type {
    ConnectionClient,
    PartitionAuthSource,
} from '@casual-simulation/aux-common';
import {
    AuthenticatedConnectionClient,
    InstRecordsClient,
    InstRecordsClientTimeSyncConnection,
} from '@casual-simulation/aux-common';
import { ApiGatewayWebsocketConnectionClient } from '@casual-simulation/aux-websocket-aws';
import { WebsocketConnectionClient } from '@casual-simulation/aux-websocket';
import type {
    PartitionConfig,
    OtherPlayersPartition,
    RemoteCausalRepoProtocol,
    YjsPartition,
} from '@casual-simulation/aux-common';
import {
    OtherPlayersPartitionImpl,
    RemoteYjsPartitionImpl,
} from '@casual-simulation/aux-common';
import { SocketManager as WebSocketManager } from '@casual-simulation/websocket';
import type { AuxTimeSyncConfiguration } from '@casual-simulation/aux-vm';
import { TimeSyncController } from '@casual-simulation/timesync';
import type { RemoteSharedDocumentConfig } from '@casual-simulation/aux-common/documents/SharedDocumentConfig';
import { RemoteYjsSharedDocument } from '@casual-simulation/aux-common/documents/RemoteYjsSharedDocument';

const DEFAULT_RESEND_UPDATES_INTERVAL_MS = 1000;
const DEFAULT_RETRY_UPDATES_AFTER_MS = 5000;

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
    authSource: PartitionAuthSource,
    protocol: RemoteCausalRepoProtocol
): InstRecordsClient {
    if (protocol === 'apiary-aws') {
        return getAWSApiaryClientForHostAndProtocol(host, authSource);
    } else {
        return getWebSocketClientForHost(host, authSource);
    }
}

function constructInstRecordsClientWithRetry(
    connection: ConnectionClient
): InstRecordsClient {
    const client = new InstRecordsClient(connection);
    client.resendUpdatesAfterMs = DEFAULT_RETRY_UPDATES_AFTER_MS;
    client.resendUpdatesIntervalMs = DEFAULT_RESEND_UPDATES_INTERVAL_MS;
    return client;
}

/**
 * Gets the casual repo client that should be used for the given host when connecting over the AWS Apiary protocol.
 * @param host The URl that should be connected to.
 * @param user The user that the connection should be made with.
 */
export function getAWSApiaryClientForHostAndProtocol(
    host: string,
    authSource: PartitionAuthSource
): InstRecordsClient {
    let client = awsApiaryClientCache.get(host);
    if (!client) {
        const url = new URL(host);

        if (url.protocol === 'http:') {
            url.protocol = 'ws:';
        } else if (url.protocol === 'https:') {
            url.protocol = 'wss:';
        }

        const manager = new WebSocketManager(url);
        manager.init();

        const awsConnection = new ApiGatewayWebsocketConnectionClient(
            manager.socket
        );
        const connection = new AuthenticatedConnectionClient(
            awsConnection,
            authSource
        );
        client = constructInstRecordsClientWithRetry(connection);
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
    authSource: PartitionAuthSource
): InstRecordsClient {
    let client = websocketClientCache.get(host);
    if (!client) {
        const url = new URL('/websocket', host);

        if (url.protocol === 'http:') {
            url.protocol = 'ws:';
        } else if (url.protocol === 'https:') {
            url.protocol = 'wss:';
        }

        const manager = new WebSocketManager(url);
        manager.init();
        const inner = new WebsocketConnectionClient(manager.socket);
        const connection = new AuthenticatedConnectionClient(inner, authSource);
        client = constructInstRecordsClientWithRetry(connection);
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
    authSource: PartitionAuthSource,
    useCache: boolean = true
): Promise<YjsPartition> {
    if (config.type === 'remote_yjs') {
        const client = getClientForHostAndProtocol(
            config.host,
            authSource,
            config.connectionProtocol
        );
        const partition = new RemoteYjsPartitionImpl(
            client,
            authSource,
            config
        );
        await partition.init();
        return partition;
    }
    return undefined;
}

/**
 * Attempts to create a RemoteYjsSharedDocument from the given config.
 * @param config The config.
 * @param authSource The auth source.
 */
export async function createRemoteYjsSharedDocument(
    config: RemoteSharedDocumentConfig,
    authSource: PartitionAuthSource
): Promise<RemoteYjsSharedDocument> {
    if (config.inst) {
        const client = getClientForHostAndProtocol(
            config.host,
            authSource,
            config.connectionProtocol
        );
        const partition = new RemoteYjsSharedDocument(
            client,
            authSource,
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
export async function createOtherPlayersRepoPartition(
    config: PartitionConfig,
    authSource: PartitionAuthSource,
    useCache: boolean = true
): Promise<OtherPlayersPartition> {
    if (config.type === 'other_players_repo') {
        const client = getClientForHostAndProtocol(
            config.host,
            authSource,
            config.connectionProtocol
        );
        const partition = new OtherPlayersPartitionImpl(
            client,
            authSource,
            config
        );
        return partition;
    }
    return undefined;
}

export function createTimeSyncController(
    config: AuxTimeSyncConfiguration,
    authSource: PartitionAuthSource
): TimeSyncController {
    if (config.host) {
        const client = getClientForHostAndProtocol(
            config.host,
            authSource,
            config.connectionProtocol
        );
        return new TimeSyncController(
            new InstRecordsClientTimeSyncConnection(client)
        );
    }

    return undefined;
}
