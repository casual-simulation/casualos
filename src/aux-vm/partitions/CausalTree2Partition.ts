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
} from '@casual-simulation/causal-trees/core2';
import {
    AuxOp,
    reducer,
    bot,
    BotStateUpdates,
    updates,
    apply,
    AuxOpType,
    del,
    tag,
    value,
    BotOp,
    TagOp,
    ValueOp,
    findValueNode,
    findTagNode,
    findBotNode,
    addAuxAtom,
    AuxCausalTree,
    AuxResult,
    auxTree,
    mergeAuxResults,
    applyAuxResult,
    auxResultIdentity,
} from '@casual-simulation/aux-common/aux-format-2';
import { Observable, Subscription, Subject, BehaviorSubject } from 'rxjs';
import { AuxPartitionBase, CausalTree2Partition } from './AuxPartition';
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
import { PartitionConfig } from './AuxPartitionConfig';
import flatMap from 'lodash/flatMap';

/**
 * Attempts to create a CausalTree2Partition from the given config.
 * @param config The config.
 */
export function createCausalTree2Partition(
    config: PartitionConfig,
    user: User
): CausalTree2Partition {
    if (config.type === 'causal_tree_2') {
        return new CausalTree2PartitionImpl(user);
    }
    return undefined;
}

export class CausalTree2PartitionImpl implements CausalTree2Partition {
    protected _onBotsAdded = new Subject<Bot[]>();
    protected _onBotsRemoved = new Subject<string[]>();
    protected _onBotsUpdated = new Subject<UpdatedBot[]>();

    protected _onError = new Subject<any>();
    protected _onEvents = new Subject<DeviceAction[]>();
    protected _onStatusUpdated = new Subject<StatusUpdate>();
    protected _hasRegisteredSubs = false;
    private _sub = new Subscription();
    private _user: User;

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

    type = 'causal_tree_2' as const;

    constructor(user: User) {
        this._user = user;
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
        events: (AddBotAction | RemoveBotAction | UpdateBotAction)[]
    ) {
        const addAtom = (cause: Atom<AuxOp>, op: AuxOp, priority?: number) => {
            const result = addAuxAtom(tree, cause, op, priority);
            tree = applyAuxResult(tree, result);
            return result;
        };

        const updateTags = (bot: WeaveNode<BotOp>, tags: BotTags) => {
            let result: AuxResult = auxResultIdentity();
            for (let key in tags) {
                let node = findTagNode(bot, key);
                const val = tags[key];
                if (!node) {
                    // create new tag
                    const tagResult = addAtom(bot.atom, tag(key));

                    result = mergeAuxResults(result, tagResult);

                    const newAtom = addedAtom(tagResult.results[0]);

                    if (!newAtom) {
                        continue;
                    }
                    node = tree.weave.getNode(newAtom.id) as WeaveNode<TagOp>;
                }

                const currentVal = findValueNode(node);
                if (!currentVal || val !== currentVal.atom.value.value) {
                    const valueResult = addAtom(node.atom, value(val));
                    result = mergeAuxResults(result, valueResult);
                }
            }

            return result;
        };

        let tree = this._tree;
        let result: AuxResult = auxResultIdentity();

        for (let event of events) {
            let newResult: AuxResult;
            if (event.type === 'add_bot') {
                const botResult = addAtom(null, bot(event.id));

                const botAtom = addedAtom(botResult.results[0]);

                if (botAtom) {
                    const botNode = tree.weave.getNode(botAtom.id) as WeaveNode<
                        BotOp
                    >;
                    const tagsResult = updateTags(botNode, event.bot.tags);
                    newResult = mergeAuxResults(botResult, tagsResult);
                } else {
                    newResult = botResult;
                }
            } else if (event.type === 'update_bot') {
                if (!event.update.tags) {
                    continue;
                }

                const node = findBotNode(tree.weave, event.id);
                if (node) {
                    newResult = updateTags(node, event.update.tags);
                }
            } else if (event.type == 'remove_bot') {
                const node = findBotNode(tree.weave, event.id);
                if (node) {
                    newResult = addAtom(node.atom, del(), 1);
                }
            }

            result = mergeAuxResults(result, newResult);
        }

        const prevState = this._tree.state;
        this._tree = tree;
        const update = updates(prevState, result.update);

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
    }
}
