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
    createCausalTree2Partition,
    PartitionConfig,
    AuxPartition,
    iteratePartitions,
    filterAtomFactory,
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

export interface RemoteAuxChannelOptions extends AuxChannelOptions {
    store?: CausalTreeStore;
    crypto?: SigningCryptoImpl;
}

export class RemoteAuxChannel extends BaseAuxChannel {
    protected _treeManager: CausalTreeManager;
    protected _socketManager: SocketManager;
    protected _partitionOptions: RemoteCausalTreePartitionOptions;

    constructor(
        defaultHost: string,
        user: AuxUser,
        config: AuxConfig,
        options: RemoteAuxChannelOptions
    ) {
        super(user, config, options);
        this._partitionOptions = {
            defaultHost: defaultHost,
            store: options.store,
            crypto: options.crypto,
            treeOptions: {
                filter: filterAtomFactory(() => this.helper),
            },
        };
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
            config => createCausalTree2Partition(config, this.user)
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
                    if (partition.type === 'causal_tree') {
                        if ('forcedOffline' in partition) {
                            partition.forcedOffline = event.offline;
                        }
                    }
                }
            }
        }
        super._handleLocalEvents(e);
    }
}
