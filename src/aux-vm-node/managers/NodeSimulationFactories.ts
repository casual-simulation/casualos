import { AuxUser } from '@casual-simulation/aux-vm';
import {
    RemoteAuxChannel,
    RemoteSimulationImpl,
} from '@casual-simulation/aux-vm-client';
import { AuxVMNode } from '../vm/AuxVMNode';
import { CausalRepoClient } from '@casual-simulation/causal-trees/core2';
import { AuxConfig } from '@casual-simulation/aux-vm/vm';
import {
    CausalRepoClientPartitionConfig,
    TEMPORARY_SHARED_PARTITION_ID,
    REMOTE_TEMPORARY_SHARED_PARTITION_ID,
    TEMPORARY_BOT_PARTITION_ID,
} from '@casual-simulation/aux-common';

export function nodeSimulationForBranch(
    user: AuxUser,
    client: CausalRepoClient,
    branch: string,
    extraOptions?: Partial<CausalRepoClientPartitionConfig>
) {
    return new RemoteSimulationImpl(
        branch,
        null,
        {
            shared: {
                type: 'causal_repo_client',
                ...(extraOptions || {}),
                branch: branch,
                client: client,
            },
            [TEMPORARY_BOT_PARTITION_ID]: {
                type: 'memory',
                private: true,
                initialState: {},
            },
            [TEMPORARY_SHARED_PARTITION_ID]: {
                type: 'causal_repo_client',
                branch: `${branch}-player-${user.id}`,
                client: client,
                temporary: true,
                remoteEvents: false,
            },
            [REMOTE_TEMPORARY_SHARED_PARTITION_ID]: {
                type: 'other_players_client',
                branch: branch,
                client: client,
            },
        },
        (cfg) => new AuxVMNode(new RemoteAuxChannel(user, cfg, {}))
    );
}

export function nodeSimulationForLocalRepo(user: AuxUser, id: string) {
    return new RemoteSimulationImpl(
        id,
        null,
        {
            shared: {
                type: 'causal_repo',
            },
        },
        (cfg) => new AuxVMNode(new RemoteAuxChannel(user, cfg, {}))
    );
}

export function nodeSimulationWithConfig(
    user: AuxUser,
    id: string,
    config: AuxConfig
) {
    return new RemoteSimulationImpl(
        id,
        config.config,
        config.partitions,
        (cfg) => new AuxVMNode(new RemoteAuxChannel(user, cfg, {}))
    );
}
