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
    SyncedRealtimeCausalTree,
    StatusUpdate,
    DeviceAction,
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

export interface RemoteCausalTreePartitionOptions {
    defaultHost: string;
    store?: CausalTreeStore;
    crypto?: SigningCryptoImpl;

    treeOptions?: RealtimeCausalTreeOptions;
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

class RemoteCausalTreePartitionImpl implements RemoteCausalTreePartition {
    private _onBotsAdded = new Subject<Bot[]>();
    private _onBotsRemoved = new Subject<string[]>();
    private _onBotsUpdated = new Subject<UpdatedBot[]>();
    private _onError = new Subject<any>();
    private _onEvents = new Subject<DeviceAction[]>();
    private _onStatusUpdated = new Subject<StatusUpdate>();

    type = 'causal_tree' as const;

    sync: SyncedRealtimeCausalTree<AuxCausalTree>;
    tree: AuxCausalTree;

    get onBotsAdded(): Observable<Bot[]> {
        return this._onBotsAdded;
    }

    get onBotsRemoved(): Observable<string[]> {
        return this._onBotsRemoved;
    }

    get onBotsUpdated(): Observable<UpdatedBot[]> {
        return this._onBotsUpdated;
    }

    get onError(): Observable<any> {
        return this._onError;
    }

    get onEvents(): Observable<DeviceAction[]> {
        return this._onEvents;
    }

    get onStatusUpdated(): Observable<StatusUpdate> {
        return this._onStatusUpdated;
    }

    unsubscribe() {
        return this._sub.unsubscribe();
    }

    get closed(): boolean {
        return this._sub.closed;
    }

    private _sub = new Subscription();
    private _treeName: string;
    private _treeOptions: RealtimeCausalTreeOptions;
    private _user: User;
    private _socketManager: SocketManager;
    private _treeManager: CausalTreeManager;

    constructor(
        options: RemoteCausalTreePartitionOptions,
        user: User,
        config: RemoteCausalTreePartitionConfig
    ) {
        this._treeName = config.treeName;
        this._user = user;
        this._treeOptions = options.treeOptions || {};
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

    async applyEvents(events: BotAction[]): Promise<void> {
        await this.tree.addEvents(events);
    }

    async setUser(user: User) {
        return this.sync.channel.setUser(user);
    }

    async setGrant(grant: string) {
        return this.sync.channel.setGrant(grant);
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

        this._sub.add(this.sync);
        this._sub.add(this.sync.onError.subscribe(this._onError));
        this._sub.add(this.sync.statusUpdated.subscribe(this._onStatusUpdated));
        this._sub.add(this.sync.events.subscribe(this._onEvents));
        this._sub.add(
            this.sync.onRejected.subscribe(rejected => {
                rejected.forEach(r => {
                    console.warn('[AuxChannel] Atom Rejected', r);
                });
            })
        );
    }

    connect() {
        this.sync.connect();
    }
}
