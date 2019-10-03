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
import { Observable, Subscription, Subject } from 'rxjs';
import { CausalTreePartition } from './AuxPartition';

export interface CausalTreePartitionOptions {
    treeOptions?: RealtimeCausalTreeOptions;
}

export abstract class CausalTreePartitionImpl implements CausalTreePartition {
    protected _onBotsAdded = new Subject<Bot[]>();
    protected _onBotsRemoved = new Subject<string[]>();
    protected _onBotsUpdated = new Subject<UpdatedBot[]>();
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

    constructor(options: CausalTreePartitionOptions, user: User) {
        this._user = user;
        this._treeOptions = options.treeOptions || {};
    }

    async applyEvents(events: BotAction[]): Promise<void> {
        await this.tree.addEvents(events);
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
        const { botsAdded, botsRemoved, botsUpdated } = botChangeObservables(
            this.sync
        );

        this._sub.add(botsAdded.subscribe(this._onBotsAdded));
        this._sub.add(botsRemoved.subscribe(this._onBotsRemoved));
        this._sub.add(botsUpdated.subscribe(this._onBotsUpdated));
    }
}
