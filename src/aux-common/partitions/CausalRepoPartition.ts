import {
    User,
    StatusUpdate,
    Action,
    RemoteActions,
    VersionVector,
} from '@casual-simulation/causal-trees';
import { AuxCausalTree, auxTree, applyEvents } from '../aux-format-2';
import { Observable, Subscription, Subject, BehaviorSubject } from 'rxjs';
import {
    CausalRepoPartition,
    AuxPartitionRealtimeStrategy,
} from './AuxPartition';
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
    CreateCertificateAction,
    SignTagAction,
    RevokeCertificateAction,
    StateUpdatedEvent,
    stateUpdatedEvent,
} from '../bots';
import {
    PartitionConfig,
    CausalRepoPartitionConfig,
} from './AuxPartitionConfig';
import flatMap from 'lodash/flatMap';

/**
 * Attempts to create a CausalTree2Partition from the given config.
 * @param config The config.
 */
export function createCausalRepoPartition(
    config: PartitionConfig,
    user: User
): CausalRepoPartition {
    if (config.type === 'causal_repo') {
        return new CausalRepoPartitionImpl(user, config);
    }
    return undefined;
}

export class CausalRepoPartitionImpl implements CausalRepoPartition {
    protected _onBotsAdded = new Subject<Bot[]>();
    protected _onBotsRemoved = new Subject<string[]>();
    protected _onBotsUpdated = new Subject<UpdatedBot[]>();
    protected _onStateUpdated = new Subject<StateUpdatedEvent>();
    protected _onVersionUpdated = new BehaviorSubject<VersionVector>({});

    protected _onError = new Subject<any>();
    protected _onEvents = new Subject<Action[]>();
    protected _onStatusUpdated = new Subject<StatusUpdate>();
    protected _hasRegisteredSubs = false;
    private _sub = new Subscription();

    // private _weave: Weave<AuxOp> = new Weave<AuxOp>();
    // private _site: SiteStatus = newSite();
    // private _state: BotsState = {};
    private _tree: AuxCausalTree = auxTree();

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

    get onStateUpdated(): Observable<StateUpdatedEvent> {
        return this._onStateUpdated.pipe(
            startWith(stateUpdatedEvent(this._tree.state))
        );
    }

    get onVersionUpdated(): Observable<VersionVector> {
        return this._onVersionUpdated;
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
    private: boolean;
    space: string;

    get realtimeStrategy(): AuxPartitionRealtimeStrategy {
        return 'immediate';
    }

    constructor(user: User, config: CausalRepoPartitionConfig) {
        this.private = config.private || false;
    }

    async applyEvents(events: BotAction[]): Promise<BotAction[]> {
        const finalEvents = flatMap(events, (e) => {
            if (e.type === 'apply_state') {
                return breakIntoIndividualEvents(this.state, e);
            } else if (
                e.type === 'add_bot' ||
                e.type === 'remove_bot' ||
                e.type === 'update_bot' ||
                e.type === 'create_certificate' ||
                e.type === 'sign_tag' ||
                e.type === 'revoke_certificate'
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
        this._onStatusUpdated.next({
            type: 'connection',
            connected: true,
        });

        this._onStatusUpdated.next({
            type: 'authentication',
            authenticated: true,
        });

        this._onStatusUpdated.next({
            type: 'authorization',
            authorized: true,
        });

        this._onStatusUpdated.next({
            type: 'sync',
            synced: true,
        });
    }

    private _applyEvents(
        events: (
            | AddBotAction
            | RemoveBotAction
            | UpdateBotAction
            | CreateCertificateAction
            | SignTagAction
            | RevokeCertificateAction
        )[]
    ) {
        let { tree, updates, actions, result } = applyEvents(
            this._tree,
            events,
            this.space
        );
        this._tree = tree;

        if (updates.addedBots.length > 0) {
            this._onBotsAdded.next(updates.addedBots);
        }
        if (updates.removedBots.length > 0) {
            this._onBotsRemoved.next(updates.removedBots);
        }
        if (updates.updatedBots.length > 0) {
            this._onBotsUpdated.next(
                updates.updatedBots.map((u) => ({
                    bot: <any>u.bot,
                    tags: [...u.tags.values()],
                }))
            );
        }
        let update = stateUpdatedEvent(result.update);
        if (
            update.addedBots.length > 0 ||
            update.removedBots.length > 0 ||
            update.updatedBots.length > 0
        ) {
            this._onStateUpdated.next(update);
            this._onVersionUpdated.next(this._tree.version);
        }

        if (actions && actions.length > 0) {
            this._onEvents.next(actions);
        }
    }
}
