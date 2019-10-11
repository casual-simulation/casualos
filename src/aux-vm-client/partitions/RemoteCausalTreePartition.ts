import {
    RemoteCausalTreePartitionConfig,
    RemoteCausalTreePartition,
    CausalTreePartitionImpl,
    CausalTreePartitionOptions,
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
    SyncedRealtimeCausalTree,
    StatusUpdate,
    DeviceAction,
    RemoteAction,
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
import { Observable, Subscription, Subject } from 'rxjs';

export interface RemoteCausalTreePartitionOptions
    extends CausalTreePartitionOptions {
    defaultHost: string;
    store?: CausalTreeStore;
    crypto?: SigningCryptoImpl;
}

/**
 * Creates a factory function that attempts to create a remote causal tree partition that is loaded from a remote server
 * with the given options.
 * @param options The options to use.
 */
export function createRemoteCausalTreePartitionFactory(
    options: RemoteCausalTreePartitionOptions,
    user: User
): (
    config: RemoteCausalTreePartitionConfig
) => Promise<RemoteCausalTreePartition> {
    return (config: RemoteCausalTreePartitionConfig) =>
        createRemoteCausalTreePartition(options, user, config);
}

/**
 * Attempts to create a CausalTreePartition that is loaded from a remote server.
 * @param options The options to use.
 * @param config The config to use.
 */
async function createRemoteCausalTreePartition(
    options: RemoteCausalTreePartitionOptions,
    user: User,
    config: RemoteCausalTreePartitionConfig
): Promise<RemoteCausalTreePartition> {
    if (config.type === 'remote_causal_tree') {
        const partition = new RemoteCausalTreePartitionImpl(
            options,
            user,
            config
        );
        await partition.init();
        return partition;
    }
    return undefined;
}

export class RemoteCausalTreePartitionImpl extends CausalTreePartitionImpl
    implements RemoteCausalTreePartition {
    private _socketManager: SocketManager;
    private _treeManager: CausalTreeManager;
    private _treeName: string;

    get forcedOffline(): boolean {
        return this._socketManager.forcedOffline;
    }

    set forcedOffline(value: boolean) {
        this._socketManager.forcedOffline = value;
    }

    private get aux(): SyncedRealtimeCausalTree<AuxCausalTree> {
        return <SyncedRealtimeCausalTree<AuxCausalTree>>this.sync;
    }

    constructor(
        options: RemoteCausalTreePartitionOptions,
        user: User,
        config: RemoteCausalTreePartitionConfig
    ) {
        super(options, user);
        let url = new URL(options.defaultHost);
        this._treeName = config.treeName;

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

    async fork(newId: string, events: BotAction[]): Promise<void> {
        await this._treeManager.forkTree(this.aux, newId, async tree => {
            await tree.addEvents(events);
        });
    }

    async setUser(user: User) {
        return this.aux.channel.setUser(user);
    }

    async setGrant(grant: string) {
        return this.aux.channel.setGrant(grant);
    }

    async sendRemoteEvents(events: RemoteAction[]): Promise<void> {
        await this.aux.channel.connection.sendEvents(events);
    }

    protected async _createRealtimeCausalTree() {
        await this._socketManager.init();
        await this._treeManager.init();
        return await this._treeManager.getTree<AuxCausalTree>(
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
    }
}
