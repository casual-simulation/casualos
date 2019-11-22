import {
    LocalActions,
    auxCausalTreeFactory,
    AuxCausalTree,
    GLOBALS_BOT_ID,
    tagsOnBot,
    parseFilterTag,
    ON_ACTION_ACTION_NAME,
    BotTags,
} from '@casual-simulation/aux-common';
import {
    CausalTreeManager,
    SocketManager,
} from '@casual-simulation/causal-tree-client-socketio';
import {
    AuxConfig,
    BaseAuxChannel,
    AuxUser,
    AuxChannelOptions,
    CausalTreePartitionConfig,
    createMemoryPartition,
    createAuxPartition,
    createCausalRepoPartition,
    PartitionConfig,
    AuxPartition,
    iteratePartitions,
    filterAtomFactory,
    createCausalRepoClientPartition,
} from '@casual-simulation/aux-vm';
import {
    SyncedRealtimeCausalTree,
    RemoteAction,
    RealtimeCausalTreeOptions,
} from '@casual-simulation/causal-trees';
import { SigningCryptoImpl } from '@casual-simulation/crypto';
import { CausalTreeStore } from '@casual-simulation/causal-trees';
import {
    createRemoteCausalTreePartitionFactory,
    RemoteCausalTreePartitionOptions,
    RemoteCausalTreePartitionImpl,
} from '../partitions/RemoteCausalTreePartition';
import { createRemoteCausalRepoPartition } from '../partitions/RemoteCausalRepoPartitionFactory';

export interface RemoteAuxChannelOptions extends AuxChannelOptions {
    partitionOptions?: RemoteCausalTreePartitionOptions;
}

export class RemoteAuxChannel extends BaseAuxChannel {
    protected _treeManager: CausalTreeManager;
    protected _socketManager: SocketManager;
    protected _partitionOptions: RemoteCausalTreePartitionOptions;

    constructor(
        user: AuxUser,
        config: AuxConfig,
        options: RemoteAuxChannelOptions
    ) {
        super(user, config, options);
        this._partitionOptions = {
            ...(options.partitionOptions || {
                defaultHost: null,
            }),
            treeOptions: {
                filter: filterAtomFactory(() => this.helper),
            },
        };
        //  {
        //     defaultHost: defaultHost,
        //     store: options.store,
        //     crypto: options.crypto,
        //     treeOptions: {
        //         filter: filterAtomFactory(() => this.helper),
        //     },
        // };
    }

    protected async _createPartition(
        config: PartitionConfig
    ): Promise<AuxPartition> {
        return await createAuxPartition(
            config,
            createRemoteCausalTreePartitionFactory(
                this._partitionOptions,
                this.user
            ),
            createMemoryPartition,
            config => createCausalRepoPartition(config, this.user),
            config => createRemoteCausalRepoPartition(config, this.user),
            config => createCausalRepoClientPartition(config, this.user)
        );
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
