import { User } from '@casual-simulation/causal-trees';
import { CausalRepoClient } from '@casual-simulation/causal-trees/core2';
import {
    SocketManager,
    SocketIOConnectionClient,
} from '@casual-simulation/causal-tree-client-socketio';
import { BotHttpClient } from './BotHttpClient';
import {
    PartitionConfig,
    RemoteCausalRepoPartition,
    RemoteCausalRepoPartitionImpl,
    BotPartition,
    BotPartitionImpl,
} from '@casual-simulation/aux-common';

/**
 * A map of hostnames to CausalRepoClients.
 * Helps prevent duplicating websocket connections to the same host.
 */
let clientCache = new Map<string, CausalRepoClient>();

/**
 * Gets the causal repo client that should be used for the given host.
 * @param host The host.
 */
export function getClientForHost(host: string, user: User): CausalRepoClient {
    let client = clientCache.get(host);
    if (!client) {
        const manager = new SocketManager(host);
        manager.init();
        const connection = new SocketIOConnectionClient(manager.socket, user);
        client = new CausalRepoClient(connection);
        clientCache.set(host, client);
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
        const client = getClientForHost(config.host, user);
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
