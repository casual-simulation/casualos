import { AuxUser } from '@casual-simulation/aux-vm';
import { getSandbox } from '../vm/VM2Sandbox';
import {
    RemoteAuxChannel,
    RemoteSimulationImpl,
} from '@casual-simulation/aux-vm-client';
import { AuxVMNode } from '../vm/AuxVMNode';
import { CausalRepoClient } from '@casual-simulation/causal-trees/core2';
import { AuxConfig } from '@casual-simulation/aux-vm/vm';
import { CausalRepoClientPartitionConfig } from '@casual-simulation/aux-common';

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
        },
        cfg =>
            new AuxVMNode(
                new RemoteAuxChannel(user, cfg, {
                    sandboxFactory: lib => getSandbox(lib),
                })
            )
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
        cfg =>
            new AuxVMNode(
                new RemoteAuxChannel(user, cfg, {
                    sandboxFactory: lib => getSandbox(lib),
                })
            )
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
        cfg =>
            new AuxVMNode(
                new RemoteAuxChannel(user, cfg, {
                    sandboxFactory: lib => getSandbox(lib),
                })
            )
    );
}
