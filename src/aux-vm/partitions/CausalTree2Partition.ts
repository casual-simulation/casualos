import {
    User,
    RealtimeCausalTree,
    StatusUpdate,
    DeviceAction,
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
} from '@casual-simulation/causal-trees/core2';
import {
    AuxOp,
    reducer,
    bot,
    BotStateUpdates,
    updates,
    apply,
} from '@casual-simulation/aux-common/aux-format-2';
import { Observable, Subscription, Subject, BehaviorSubject } from 'rxjs';
import { AuxPartitionBase, CausalTree2Partition } from './AuxPartition';
import { filter, map, switchMap, merge } from 'rxjs/operators';
import {
    BotAction,
    Bot,
    BotsState,
    UpdatedBot,
} from '@casual-simulation/aux-common';

export class CausalTree2PartitionImpl implements CausalTree2Partition {
    protected _onBotsAdded = new Subject<Bot[]>();
    protected _onBotsRemoved = new Subject<string[]>();
    protected _onBotsUpdated = new Subject<UpdatedBot[]>();

    protected _onError = new Subject<any>();
    protected _onEvents = new Subject<DeviceAction[]>();
    protected _onStatusUpdated = new Subject<StatusUpdate>();
    protected _hasRegisteredSubs = false;
    private _sub = new Subscription();
    protected _user: User;

    private _weave: Weave<AuxOp>;
    private _site: SiteStatus = newSite();
    private _state: BotsState = {};

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

    get state() {
        return this._state;
    }

    type = 'causal_tree_2' as const;

    constructor(user: User) {
        this._user = user;
    }

    async applyEvents(events: BotAction[]): Promise<BotAction[]> {
        let stateUpdate: any = {};

        for (let event of events) {
            let op: AuxOp = null;
            let priority: number;
            let cause: Atom<any> = null;
            if (event.type === 'add_bot') {
                op = bot();
            }

            if (op) {
                const a = createAtom(this._site, cause, op, priority);
                const result = this._weave.insert(a);
                this._site = updateSite(this._site, result);
                const update = reducer(this._weave, result);

                stateUpdate = merge(stateUpdate, update);
            }
        }

        const prevState = this._state;
        this._state = apply(prevState, stateUpdate);
        const update = updates(prevState, stateUpdate);

        if (update.addedBots.length > 0) {
            this._onBotsAdded.next(update.addedBots);
        }
        if (update.removedBots.length > 0) {
            this._onBotsRemoved.next(update.removedBots);
        }
        if (update.updatedBots.length > 0) {
            this._onBotsUpdated.next(
                update.updatedBots.map(u => ({
                    bot: <any>u.bot,
                    tags: [...u.tags.values()],
                }))
            );
        }

        return [];
    }

    async init(): Promise<void> {
        this._weave = new Weave<AuxOp>();
    }

    connect() {
        // this.sync.connect();
    }
}
