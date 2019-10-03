import {
    RemoteCausalTreePartitionConfig,
    RemoteCausalTreePartition,
} from '@casual-simulation/aux-vm';
import {
    CausalTreeManager,
    SocketManager,
} from '@casual-simulation/causal-tree-client-socketio';
import {
    CausalTreeStore,
    User,
    RealtimeCausalTreeOptions,
    RealtimeCausalTree,
} from '@casual-simulation/causal-trees';
import { SigningCryptoImpl } from '@casual-simulation/crypto';
import {
    auxCausalTreeFactory,
    AuxCausalTree,
    BotAction,
    Bot,
    UpdatedBot,
    botChangeObservables,
} from '@casual-simulation/aux-common';
import { Observable, defer } from 'rxjs';

export interface RemoteCausalTreePartitionOptions {
    defaultHost: string;
    store?: CausalTreeStore;
    crypto?: SigningCryptoImpl;

    treeOptions: RealtimeCausalTreeOptions;
}

/**
 * Creates a factory function that attempts to create a remote causal tree partition that is loaded from a remote server
 * with the given options.
 * @param options The options to use.
 */
export function createRemoteCausalTreePartitionFactory(
    options: RemoteCausalTreePartitionOptions
): (
    config: RemoteCausalTreePartitionConfig
) => Promise<RemoteCausalTreePartition> {
    return (config: RemoteCausalTreePartitionConfig) =>
        createRemoteCausalTreePartition(options, config);
}

/**
 * Attempts to create a CausalTreePartition that is loaded from a remote server.
 * @param options The options to use.
 * @param config The config to use.
 */
async function createRemoteCausalTreePartition(
    options: RemoteCausalTreePartitionOptions,
    config: RemoteCausalTreePartitionConfig
): Promise<RemoteCausalTreePartition> {
    if (config.type === 'remote_causal_tree') {
        const partition = new RemoteCausalTreePartitionImpl(options, config);
        await partition.init();
        return partition;
    }
    return undefined;
}

class RemoteCausalTreePartitionImpl implements RemoteCausalTreePartition {
    type = 'causal_tree' as const;

    sync: RealtimeCausalTree<AuxCausalTree>;
    tree: AuxCausalTree;

    applyEvents(events: BotAction[]): Promise<void> {
        throw new Error('Method not implemented.');
    }

    onBotsAdded: Observable<Bot[]>;
    onBotsRemoved: Observable<string[]>;
    onBotsUpdated: Observable<UpdatedBot[]>;
    onError: Observable<any>;

    private _treeName: string;
    private _treeOptions: RealtimeCausalTreeOptions;
    private _user: User;
    private _socketManager: SocketManager;
    private _treeManager: CausalTreeManager;

    constructor(
        options: RemoteCausalTreePartitionOptions,
        config: RemoteCausalTreePartitionConfig
    ) {
        this._treeName = config.treeName;
        this._user = config.user;
        this._treeOptions = options.treeOptions;
        let url = new URL(options.defaultHost);

        this._socketManager = new SocketManager(
            config.host
                ? `${url.protocol}//${config.host}`
                : options.defaultHost
        );

        this._treeManager = new CausalTreeManager(
            this._socketManager,
            auxCausalTreeFactory(),
            options.store,
            options.crypto
        );
    }

    async init(): Promise<void> {
        await this._socketManager.init();
        await this._treeManager.init();
        this.sync = await this._treeManager.getTree<AuxCausalTree>(
            {
                id: this._treeName,
                type: 'aux',
            },
            this._user,
            {
                ...this._treeOptions,
                garbageCollect: true,

                // TODO: Allow reusing site IDs without causing multiple tabs to try and
                //       be the same site.
                alwaysRequestNewSiteId: true,
            }
        );

        // TODO: Finish implementing
    }
}
