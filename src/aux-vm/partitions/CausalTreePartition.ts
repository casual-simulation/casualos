import {
    CausalTreeStore,
    User,
    RealtimeCausalTreeOptions,
    RealtimeCausalTree,
    SyncedRealtimeCausalTree,
    StatusUpdate,
    DeviceAction,
    LocalRealtimeCausalTree,
} from '@casual-simulation/causal-trees';
import {
    auxCausalTreeFactory,
    AuxCausalTree,
    BotAction,
    Bot,
    UpdatedBot,
    botChangeObservables,
} from '@casual-simulation/aux-common';
import { Observable, Subscription, Subject, BehaviorSubject } from 'rxjs';
import { CausalTreePartition } from './AuxPartition';
import { filter, map, switchMap } from 'rxjs/operators';

export interface CausalTreePartitionOptions {
    treeOptions?: RealtimeCausalTreeOptions;
}

export abstract class CausalTreePartitionImpl implements CausalTreePartition {
    // protected _onBotsAdded = new Subject<Bot[]>();
    // protected _onBotsRemoved = new Subject<string[]>();
    // protected _onBotsUpdated = new Subject<UpdatedBot[]>();

    protected _events = new BehaviorSubject<{
        botsAdded: Observable<Bot[]>;
        botsRemoved: Observable<string[]>;
        botsUpdated: Observable<UpdatedBot[]>;
    }>(null);
    protected _onError = new Subject<any>();
    protected _onEvents = new Subject<DeviceAction[]>();
    protected _onStatusUpdated = new Subject<StatusUpdate>();
    protected _hasRegisteredSubs = false;
    private _sub = new Subscription();
    protected _treeOptions: RealtimeCausalTreeOptions;
    protected _user: User;

    type = 'causal_tree' as const;

    sync: RealtimeCausalTree<AuxCausalTree>;

    get tree(): AuxCausalTree {
        return this.sync.tree;
    }

    get onBotsAdded(): Observable<Bot[]> {
        return this._events.pipe(
            filter(e => !!e),
            switchMap(e => e.botsAdded)
        );
    }

    get onBotsRemoved(): Observable<string[]> {
        return this._events.pipe(
            filter(e => !!e),
            switchMap(e => e.botsRemoved)
        );
    }

    get onBotsUpdated(): Observable<UpdatedBot[]> {
        return this._events.pipe(
            filter(e => !!e),
            switchMap(e => e.botsUpdated)
        );
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

    constructor(options: CausalTreePartitionOptions, user: User) {
        this._user = user;
        this._treeOptions = options.treeOptions || {};
    }

    async applyEvents(events: BotAction[]): Promise<BotAction[]> {
        await this.tree.addEvents(events);
        return [];
    }

    async init(): Promise<void> {
        this.sync = await this._createRealtimeCausalTree();

        this._sub.add(this.sync);
        this._sub.add(this.sync.onError.subscribe(this._onError));
        this._sub.add(
            this.sync.statusUpdated.subscribe(update =>
                this._handleStatusUpdated(update)
            )
        );
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

    protected abstract _createRealtimeCausalTree(): Promise<
        RealtimeCausalTree<AuxCausalTree>
    >;

    protected async _handleStatusUpdated(update: StatusUpdate) {
        if (update.type === 'sync' && update.synced) {
            this._ensureSetup();
        }

        this._onStatusUpdated.next(update);
    }

    protected _ensureSetup() {
        if (!this._hasRegisteredSubs) {
            this._hasRegisteredSubs = true;
            this._registerSubscriptions();
        }
    }

    protected _registerSubscriptions() {
        const events = botChangeObservables(this.sync);

        this._events.next(events);
    }
}
