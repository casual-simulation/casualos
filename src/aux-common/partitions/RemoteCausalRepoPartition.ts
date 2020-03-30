import {
    User,
    StatusUpdate,
    RemoteAction,
    Action,
} from '@casual-simulation/causal-trees';
import {
    Atom,
    addedAtoms,
    removedAtoms,
    CausalRepoClient,
} from '@casual-simulation/causal-trees/core2';
import {
    AuxCausalTree,
    auxTree,
    applyEvents,
    BotStateUpdates,
    applyAtoms,
} from '../aux-format-2';
import { Observable, Subscription, Subject } from 'rxjs';
import { startWith } from 'rxjs/operators';
import {
    BotAction,
    Bot,
    UpdatedBot,
    getActiveObjects,
    AddBotAction,
    RemoveBotAction,
    UpdateBotAction,
    breakIntoIndividualEvents,
    MarkHistoryAction,
    loadSpace,
} from '../bots';
import flatMap from 'lodash/flatMap';
import {
    PartitionConfig,
    RemoteCausalRepoPartitionConfig,
    CausalRepoClientPartitionConfig,
    CausalRepoHistoryClientPartitionConfig,
} from './AuxPartitionConfig';
import {
    RemoteCausalRepoPartition,
    AuxPartitionRealtimeStrategy,
} from './AuxPartition';

export async function createCausalRepoClientPartition(
    config: PartitionConfig,
    user: User
): Promise<RemoteCausalRepoPartition> {
    if (config.type === 'causal_repo_client') {
        const partition = new RemoteCausalRepoPartitionImpl(
            user,
            config.client,
            config
        );
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
    protected _onEvents = new Subject<Action[]>();
    protected _onStatusUpdated = new Subject<StatusUpdate>();
    protected _hasRegisteredSubs = false;
    private _sub = new Subscription();
    private _user: User;
    private _branch: string;
    private _readOnly: boolean;

    private _tree: AuxCausalTree = auxTree();
    private _client: CausalRepoClient;
    private _synced: boolean;

    private: boolean;

    get realtimeStrategy(): AuxPartitionRealtimeStrategy {
        return 'immediate';
    }

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

    get onEvents(): Observable<Action[]> {
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
        return this._client.forcedOffline;
    }

    set forcedOffline(value: boolean) {
        this._client.forcedOffline = value;
    }

    constructor(
        user: User,
        client: CausalRepoClient,
        config:
            | RemoteCausalRepoPartitionConfig
            | CausalRepoClientPartitionConfig
    ) {
        this._user = user;
        this._branch = config.branch;
        this._client = client;
        this.private = config.private;
        this._readOnly = config.readOnly || false;
        this._synced = false;
    }

    async sendRemoteEvents(events: RemoteAction[]): Promise<void> {
        if (this._readOnly) {
            return;
        }
        for (let event of events) {
            if (event.event.type === 'mark_history') {
                const markHistory = <MarkHistoryAction>event.event;
                this._client.commit(this._branch, markHistory.message);
            } else if (event.event.type === 'browse_history') {
                this._onEvents.next([
                    loadSpace('history', <
                        CausalRepoHistoryClientPartitionConfig
                    >{
                        type: 'causal_repo_history_client',
                        branch: this._branch,
                        client: this._client,
                    }),
                ]);
            } else {
                this._client.sendEvent(this._branch, event);
            }
        }
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

    async init(): Promise<void> {}

    connect(): void {
        this._sub.add(
            this._client.connection.connectionState.subscribe(state => {
                const connected = state.connected;
                this._onStatusUpdated.next({
                    type: 'connection',
                    connected: !!connected,
                });

                if (connected) {
                    this._onStatusUpdated.next({
                        type: 'authentication',
                        authenticated: true,
                        user: this._user,
                        info: state.info,
                    });

                    this._onStatusUpdated.next({
                        type: 'authorization',
                        authorized: true,
                    });
                } else {
                    this._updateSynced(false);
                }
            })
        );

        this._sub.add(
            this._client.watchBranch(this._branch).subscribe(event => {
                if (!this._synced) {
                    this._updateSynced(true);
                }
                if (event.type === 'atoms') {
                    this._applyAtoms(event.atoms, event.removedAtoms);
                } else if (event.type === 'event') {
                    this._onEvents.next([event.action]);
                }
            })
        );
    }

    private _updateSynced(synced: boolean) {
        this._synced = synced;
        this._onStatusUpdated.next({
            type: 'sync',
            synced: synced,
        });
    }

    private _applyAtoms(atoms: Atom<any>[], removedAtoms: string[]) {
        if (this._tree.weave.roots.length === 0) {
            console.log(
                `[RemoteCausalRepoPartition] Got ${atoms.length} atoms!`
            );
        }
        let { tree, updates } = applyAtoms(this._tree, atoms, removedAtoms);
        this._tree = tree;
        this._sendUpdates(updates);
    }

    private _applyEvents(
        events: (AddBotAction | RemoveBotAction | UpdateBotAction)[]
    ) {
        let { tree, updates, result } = applyEvents(this._tree, events);
        this._tree = tree;

        this._sendUpdates(updates);

        if (this._readOnly) {
            return;
        }

        const atoms = addedAtoms(result.results);
        const removed = removedAtoms(result.results);
        if (atoms.length > 0 || removed.length > 0) {
            this._client.addAtoms(this._branch, atoms, removed);
        }
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
