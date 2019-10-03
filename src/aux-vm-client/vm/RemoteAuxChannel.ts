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
    PartitionConfig,
    AuxPartition,
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
        };
    }

    // protected async _sendRemoteEvents(events: RemoteAction[]): Promise<void> {
    //     const aux = this.aux;
    //     await aux.channel.connection.sendEvents(events);
    // }

    async forkAux(newId: string) {
        // TODO:
        // console.log('[RemoteAuxChannel] Forking AUX');
        // await this._treeManager.forkTree(this.aux, newId, async tree => {
        //     const globals = tree.value[GLOBALS_BOT_ID];
        //     if (globals) {
        //         console.log('[RemoteAuxChannel] Cleaning Config bot.');
        //         let badTags = tagsOnBot(globals).filter(tag => {
        //             let parsed = parseFilterTag(tag);
        //             return (
        //                 parsed.success &&
        //                 parsed.eventName === ON_ACTION_ACTION_NAME
        //             );
        //         });
        //         let tags: BotTags = {};
        //         for (let tag of badTags) {
        //             console.log(`[RemoteAuxChannel] Removing ${tag} tag.`);
        //             tags[tag] = null;
        //         }
        //         await tree.updateBot(globals, {
        //             tags: tags,
        //         });
        //     }
        // });
        // console.log('[RemoteAuxChannel] Finished');
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
            createMemoryPartition
        );
    }

    // protected async _createRealtimeCausalTree(
    //     options: RealtimeCausalTreeOptions
    // ) {
    //     await this._socketManager.init();
    //     await this._treeManager.init();
    //     const tree = await this._treeManager.getTree<AuxCausalTree>(
    //         {
    //             id: this._partition.treeName,
    //             type: 'aux',
    //         },
    //         this.user,
    //         {
    //             ...options,
    //             garbageCollect: true,

    //             // TODO: Allow reusing site IDs without causing multiple tabs to try and
    //             //       be the same site.
    //             alwaysRequestNewSiteId: true,
    //         }
    //     );

    //     return tree;
    // }

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
                // TODO: Fix
                // this._socketManager.forcedOffline = event.offline;
            }
        }
        super._handleLocalEvents(e);
    }
}
