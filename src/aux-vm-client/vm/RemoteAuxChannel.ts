import {
    LocalActions,
    PartitionConfig,
    AuxPartition,
    createAuxPartition,
    createMemoryPartition,
    createCausalRepoPartition,
    createCausalRepoClientPartition,
    createCausalRepoHistoryClientPartition,
    createBotClientPartition,
    iteratePartitions,
    createOtherPlayersClientPartition,
    createYjsPartition,
    createRemoteClientYjsPartition,
} from '@casual-simulation/aux-common';
import {
    AuxConfig,
    BaseAuxChannel,
    AuxUser,
    AuxChannelOptions,
} from '@casual-simulation/aux-vm';
import {
    createBotPartition,
    createRemoteCausalRepoPartition,
    createOtherPlayersRepoPartition,
    createRemoteYjsPartition,
    createTimeSyncController,
} from '../partitions';
import { TimeSyncController } from '@casual-simulation/timesync';

export interface RemoteAuxChannelOptions extends AuxChannelOptions {}

export class RemoteAuxChannel extends BaseAuxChannel {
    constructor(
        user: AuxUser,
        config: AuxConfig,
        options: RemoteAuxChannelOptions
    ) {
        super(user, config, options);
    }

    protected async _createPartition(
        config: PartitionConfig
    ): Promise<AuxPartition> {
        return await createAuxPartition(
            config,
            createMemoryPartition,
            (config) => createCausalRepoPartition(config, this.user),
            (config) => createRemoteCausalRepoPartition(config, this.user),
            (config) => createCausalRepoClientPartition(config, this.user),
            (config) =>
                createCausalRepoHistoryClientPartition(config, this.user),
            (config) => createBotPartition(config),
            (config) => createBotClientPartition(config),
            (config) => createOtherPlayersClientPartition(config, this.user),
            (config) => createOtherPlayersRepoPartition(config, this.user),
            (config) => createYjsPartition(config),
            (config) => createRemoteYjsPartition(config, this.user),
            (config) => createRemoteClientYjsPartition(config, this.user)
        );
    }

    protected _createTimeSyncController(): TimeSyncController {
        if (this._config.config.timesync) {
            return createTimeSyncController(this._config.config.timesync, this.user) ?? super._createTimeSyncController();
        }
        return super._createTimeSyncController();
    }

    protected _handleError(error: any) {
        if (error instanceof Error) {
            super._handleError({
                type: 'general',
                message: error.toString(),
            });
        } else {
            super._handleError(error);
        }
    }

    protected _handleLocalEvents(e: LocalActions[]) {
        for (let event of e) {
            if (event.type === 'set_offline_state') {
                for (let [key, partition] of iteratePartitions(
                    this._partitions
                )) {
                    if ('forcedOffline' in partition) {
                        partition.forcedOffline = event.offline;
                    }
                }
            }
        }
        super._handleLocalEvents(e);
    }
}
