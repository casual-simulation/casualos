import { User } from '@casual-simulation/causal-trees';
import { CausalRepoClient } from '@casual-simulation/causal-trees/core2';
import {
    PartitionConfig,
    AuxPartitionBase,
    RemoteCausalRepoPartition,
} from '@casual-simulation/aux-vm';
import {
    RemoteCausalRepoPartitionConfig,
    CausalRepoClientPartitionConfig,
    RemoteCausalRepoPartitionImpl,
    BotPartition,
    createBotClientPartition,
    BotPartitionImpl,
} from '@casual-simulation/aux-vm/partitions';
import {
    SocketManager,
    SocketIOConnectionClient,
} from '@casual-simulation/causal-tree-client-socketio';
import { BotHttpClient } from './BotHttpClient';

/**
 * Attempts to create a CausalTree2Partition from the given config.
 * @param config The config.
 */
export async function createRemoteCausalRepoPartition(
    config: PartitionConfig,
    user: User
): Promise<RemoteCausalRepoPartition> {
    if (config.type === 'remote_causal_repo') {
        const manager = new SocketManager(config.host);
        manager.init();
        const connection = new SocketIOConnectionClient(manager.socket, user);
        const client = new CausalRepoClient(connection);
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
