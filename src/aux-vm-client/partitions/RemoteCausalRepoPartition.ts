import {
    User,
    RealtimeCausalTree,
    StatusUpdate,
    DeviceAction,
    USERNAME_CLAIM,
    DEVICE_ID_CLAIM,
    SESSION_ID_CLAIM,
    USER_ROLE,
} from '@casual-simulation/causal-trees';
import {
    Weave,
    WeaveResult,
    atom,
    atomId,
    Atom,
    SiteStatus,
    newSite,
    createAtom,
    updateSite,
    WeaveNode,
    iterateCausalGroup,
    addedAtom,
    insertAtom,
    addedAtoms,
} from '@casual-simulation/causal-trees/core2';
import {
    AuxCausalTree,
    auxTree,
    applyEvents,
    auxResultIdentity,
    insertAuxAtom,
    mergeAuxResults,
    updates,
    BotStateUpdates,
    applyAuxResult,
    applyAtoms,
} from '@casual-simulation/aux-common/aux-format-2';
import { Observable, Subscription, Subject, BehaviorSubject } from 'rxjs';
import { filter, map, switchMap, startWith } from 'rxjs/operators';
import {
    BotAction,
    Bot,
    BotsState,
    UpdatedBot,
    merge,
    BotTags,
    hasValue,
    getActiveObjects,
    AddBotAction,
    RemoveBotAction,
    UpdateBotAction,
    breakIntoIndividualEvents,
} from '@casual-simulation/aux-common';
import {
    PartitionConfig,
    AuxPartitionBase,
    RemoteCausalRepoPartition,
} from '@casual-simulation/aux-vm';
import flatMap from 'lodash/flatMap';
import {
    RemoteCausalTree2PartitionConfig,
    RemoteCausalRepoPartitionConfig,
} from '@casual-simulation/aux-vm/partitions';
import {
    SocketManager,
    SocketIOConnectionClient,
    CausalRepoClient,
} from '@casual-simulation/causal-tree-client-socketio';

/**
 * Attempts to create a CausalTree2Partition from the given config.
 * @param config The config.
 */
export async function createRemoteCausalRepoPartition(
    config: PartitionConfig,
    user: User
): Promise<RemoteCausalRepoPartition> {
    if (config.type === 'remote_causal_repo') {
        const partition = new RemoteCausalRepoPartitionImpl(user, config);
        await partition.init();
        return partition;
    }
    return undefined;
}

export class RemoteCausalRepoPartitionImpl
    implements RemoteCausalRepoPartition {
    protected _onBotsAdded = new Subject<Bot[]>();
    protected _onBotsRemoved = new Subject<string[]>();
    protected _onBotsUpdated = new Subject<UpdatedBot[]>();

    protected _onError = new Subject<any>();
    protected _onEvents = new Subject<DeviceAction[]>();
    protected _onStatusUpdated = new Subject<StatusUpdate>();
    protected _hasRegisteredSubs = false;
    private _sub = new Subscription();
    private _user: User;
    private _branch: string;

    private _tree: AuxCausalTree = auxTree();
    private _socketManager: SocketManager;
    private _client: CausalRepoClient;
    private _synced: boolean;

    get onBotsAdded(): Observable<Bot[]> {
        return this._onBotsAdded.pipe(
            startWith(getActiveObjects(this._tree.state))
        );
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

    get state() {
        return this._tree.state;
    }

    type = 'causal_repo' as const;

    get forcedOffline(): boolean {
        return this._socketManager.forcedOffline;
    }

    set forcedOffline(value: boolean) {
        this._socketManager.forcedOffline = value;
    }

    constructor(user: User, config: RemoteCausalRepoPartitionConfig) {
        this._user = user;
        this._branch = config.branch;
        this._synced = false;
        this._socketManager = new SocketManager(config.host);
    }

    async applyEvents(events: BotAction[]): Promise<BotAction[]> {
        const finalEvents = flatMap(events, e => {
            if (e.type === 'apply_state') {
                return breakIntoIndividualEvents(this.state, e);
            } else if (
                e.type === 'add_bot' ||
                e.type === 'remove_bot' ||
                e.type === 'update_bot'
            ) {
                return [e] as const;
            } else {
                return [];
            }
        });

        this._applyEvents(finalEvents);

        return [];
    }

    async init(): Promise<void> {
        this._socketManager.init();
    }

    connect(): void {
        const connection = new SocketIOConnectionClient(
            this._socketManager.socket,
            this._socketManager.connectionStateChanged
        );
        this._client = new CausalRepoClient(connection);

        connection.connectionState.subscribe(connected => {
            this._onStatusUpdated.next({
                type: 'connection',
                connected: connected,
            });

            if (connected) {
                this._onStatusUpdated.next({
                    type: 'authentication',
                    authenticated: true,
                });

                this._onStatusUpdated.next({
                    type: 'authorization',
                    authorized: true,
                });
            } else {
                this._updateSynced(false);
            }
        });

        this._client.watchBranch(this._branch).subscribe(atoms => {
            if (!this._synced) {
                this._updateSynced(true);
            }
            this._applyAtoms(atoms);
        });
    }

    private _updateSynced(synced: boolean) {
        this._synced = synced;
        this._onStatusUpdated.next({
            type: 'sync',
            synced: synced,
        });
    }

    private _applyAtoms(atoms: Atom<any>[]) {
        let { tree, updates } = applyAtoms(this._tree, atoms);
        this._tree = tree;
        this._sendUpdates(updates);
    }

    private _applyEvents(
        events: (AddBotAction | RemoveBotAction | UpdateBotAction)[]
    ) {
        let { tree, updates, result } = applyEvents(this._tree, events);
        this._tree = tree;

        this._sendUpdates(updates);

        const atoms = addedAtoms(result);
        this._client.addAtoms(this._branch, atoms);
    }

    private _sendUpdates(updates: BotStateUpdates) {
        if (updates.addedBots.length > 0) {
            this._onBotsAdded.next(updates.addedBots);
        }
        if (updates.removedBots.length > 0) {
            this._onBotsRemoved.next(updates.removedBots);
        }
        if (updates.updatedBots.length > 0) {
            this._onBotsUpdated.next(
                updates.updatedBots.map(u => ({
                    bot: <any>u.bot,
                    tags: [...u.tags.values()],
                }))
            );
        }
    }
}
