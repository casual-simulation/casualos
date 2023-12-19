import {
    RemoteAuxChannel,
    RemoteSimulationImpl,
} from '@casual-simulation/aux-vm-client';
import { AuxVMNode } from '../vm/AuxVMNode';
import { AuxConfig } from '@casual-simulation/aux-vm/vm';
import {
    TEMPORARY_SHARED_PARTITION_ID,
    REMOTE_TEMPORARY_SHARED_PARTITION_ID,
    TEMPORARY_BOT_PARTITION_ID,
    AuxPartitionConfig,
    InstRecordsClient,
    ConnectionIndicator,
    getConnectionId,
    DEFAULT_BRANCH_NAME,
    YjsClientPartitionConfig,
} from '@casual-simulation/aux-common';

export function nodeSimulationForBranch(
    id: string,
    indicator: ConnectionIndicator,
    client: InstRecordsClient,
    branch: string,
    extraOptions?: Partial<YjsClientPartitionConfig>
) {
    const connectionId = getConnectionId(indicator);
    const partitions: AuxPartitionConfig = {
        shared: {
            type: 'yjs_client',
            ...(extraOptions || {}),
            recordName: null,
            inst: branch,
            branch: DEFAULT_BRANCH_NAME,
            client: client,
        },
        [TEMPORARY_BOT_PARTITION_ID]: {
            type: 'memory',
            private: true,
            initialState: {},
        },
        [TEMPORARY_SHARED_PARTITION_ID]: {
            type: 'yjs_client',
            recordName: null,
            inst: branch,
            branch: `${DEFAULT_BRANCH_NAME}-player-${connectionId}`,
            client: client,
            temporary: true,
            remoteEvents: false,
        },
        [REMOTE_TEMPORARY_SHARED_PARTITION_ID]: {
            type: 'other_players_client',
            recordName: null,
            inst: branch,
            branch: DEFAULT_BRANCH_NAME,
            client: client,
        },
    };
    const configBotId = getConnectionId(indicator);
    return new RemoteSimulationImpl(
        branch,
        {
            recordName: null,
            inst: null,
            isStatic: false,
        },
        new AuxVMNode(
            id,
            configBotId,
            new RemoteAuxChannel(
                {
                    configBotId: configBotId,
                    config: null,
                    partitions,
                },
                {}
            )
        )
    );
}

export function nodeSimulationForLocalRepo(
    indicator: ConnectionIndicator,
    id: string
) {
    const partitions: AuxPartitionConfig = {
        shared: {
            type: 'yjs',
        },
    };
    const configBotId = getConnectionId(indicator);
    return new RemoteSimulationImpl(
        id,
        {
            recordName: null,
            inst: null,
            isStatic: false,
        },
        new AuxVMNode(
            id,
            configBotId,
            new RemoteAuxChannel(
                {
                    configBotId,
                    config: null,
                    partitions,
                },
                {}
            )
        )
    );
}

export function nodeSimulationWithConfig(
    indicator: ConnectionIndicator,
    id: string,
    config: AuxConfig
) {
    const configBotId = getConnectionId(indicator);
    return new RemoteSimulationImpl(
        id,
        {
            recordName: null,
            inst: null,
            isStatic: false,
        },
        new AuxVMNode(id, configBotId, new RemoteAuxChannel(config, {}))
    );
}
