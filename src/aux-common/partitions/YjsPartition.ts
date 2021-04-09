import { User, StatusUpdate, Action } from '@casual-simulation/causal-trees';
import {
    CurrentVersion,
    treeVersion,
} from '@casual-simulation/causal-trees/core2';
import { AuxCausalTree, auxTree, applyEvents } from '../aux-format-2';
import { Observable, Subscription, Subject, BehaviorSubject } from 'rxjs';
import {
    CausalRepoPartition,
    AuxPartitionRealtimeStrategy,
    YjsPartition,
    MemoryPartition,
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
    BotsState,
    PartialBotsState,
    botAdded,
    BotTags,
    createBot,
    botRemoved,
    hasValue,
    botUpdated,
} from '../bots';
import {
    PartitionConfig,
    CausalRepoPartitionConfig,
    YjsPartitionConfig,
} from './AuxPartitionConfig';
import { flatMap } from 'lodash';
import { v4 as uuid } from 'uuid';
import { Doc, Text, Map, applyUpdate, Transaction, YMapEvent } from 'yjs';
import { MemoryPartitionImpl } from './MemoryPartition';
import { memory } from 'console';

/**
 * Attempts to create a YjsPartition from the given config.
 * @param config The config.
 */
export function createYjsPartition(
    config: PartitionConfig,
    user: User
): YjsPartition {
    if (config.type === 'yjs') {
        return new YjsPartitionImpl(user, config);
    }
    return undefined;
}

type TagsMap = Map<Text | object | number | boolean>;

export class YjsPartitionImpl implements YjsPartition {
    protected _onVersionUpdated: BehaviorSubject<CurrentVersion>;

    protected _onError = new Subject<any>();
    protected _onEvents = new Subject<Action[]>();
    protected _onStatusUpdated = new Subject<StatusUpdate>();
    protected _hasRegisteredSubs = false;
    private _sub = new Subscription();

    private _doc: Doc = new Doc();
    private _bots: Map<TagsMap>;
    private _internalPartition: MemoryPartition = new MemoryPartitionImpl({
        type: 'memory',
        initialState: {},
    });

    get onBotsAdded(): Observable<Bot[]> {
        return this._internalPartition.onBotsAdded;
    }

    get onBotsRemoved(): Observable<string[]> {
        return this._internalPartition.onBotsRemoved;
    }

    get onBotsUpdated(): Observable<UpdatedBot[]> {
        return this._internalPartition.onBotsUpdated;
    }

    get onStateUpdated(): Observable<StateUpdatedEvent> {
        return this._internalPartition.onStateUpdated;
    }

    get onVersionUpdated(): Observable<CurrentVersion> {
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

    get state(): BotsState {
        return this._internalPartition.state;
    }

    type = 'yjs' as const;
    private: boolean;
    get space(): string {
        return this._internalPartition.space;
    }

    set space(value: string) {
        this._internalPartition.space = value;
    }

    get realtimeStrategy(): AuxPartitionRealtimeStrategy {
        return 'immediate';
    }

    constructor(user: User, config: YjsPartitionConfig) {
        this.private = config.private || false;
        this._bots = this._doc.getMap('bots');

        this._doc.on('afterTransaction', (transaction: Transaction) => {
            this._processTransaction(transaction);
        });
        this._onVersionUpdated = new BehaviorSubject<CurrentVersion>({
            currentSite: '',
            remoteSite: null,
            vector: {},
        });
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
        this._doc.transact((t) => {
            for (let event of events) {
                if (event.type === 'add_bot') {
                    const map: TagsMap = new Map();

                    for (let tag in event.bot.tags) {
                        map.set(tag, event.bot.tags[tag]);
                    }

                    this._bots.set(event.id, map);
                } else if (event.type === 'remove_bot') {
                    this._bots.delete(event.id);
                } else if (event.type === 'update_bot') {
                    const currentBot = this.state[event.id];
                    const currentMap = this._bots.get(event.id);
                    if (event.update.tags && currentBot && currentMap) {
                        for (let tag of Object.keys(event.update.tags)) {
                            const newVal = event.update.tags[tag];
                            const oldVal = currentBot.tags[tag];

                            if (newVal === oldVal) {
                                continue;
                            }

                            if (hasValue(newVal)) {
                                currentMap.set(tag, newVal);
                            } else {
                                currentMap.delete(tag);
                            }
                        }
                    }
                }
            }
        });

        // let { tree, updates, actions, result } = applyEvents(
        //     this._tree,
        //     events,
        //     this.space
        // );
        // this._tree = tree;

        // if (updates.addedBots.length > 0) {
        //     this._onBotsAdded.next(updates.addedBots);
        // }
        // if (updates.removedBots.length > 0) {
        //     this._onBotsRemoved.next(updates.removedBots);
        // }
        // if (updates.updatedBots.length > 0) {
        //     this._onBotsUpdated.next(
        //         updates.updatedBots.map((u) => ({
        //             bot: <any>u.bot,
        //             tags: [...u.tags.values()],
        //         }))
        //     );
        // }
        // let update = stateUpdatedEvent(result.update);
        // if (
        //     update.addedBots.length > 0 ||
        //     update.removedBots.length > 0 ||
        //     update.updatedBots.length > 0
        // ) {
        //     this._onStateUpdated.next(update);
        //     this._onVersionUpdated.next(treeVersion(this._tree));
        // }

        // if (actions && actions.length > 0) {
        //     this._onEvents.next(actions);
        // }
    }

    private _processTransaction(transaction: Transaction) {
        let memoryEvents: (
            | AddBotAction
            | RemoveBotAction
            | UpdateBotAction
        )[] = [];

        for (let [type, events] of transaction.changedParentTypes) {
            if (type === this._bots) {
                for (let event of events) {
                    const target = event.target;
                    if (target === type) {
                        // Bot was added or removed
                        if (event instanceof YMapEvent) {
                            for (let [key, change] of event.changes.keys) {
                                if (change.action === 'add') {
                                    // bot added
                                    const value = this._bots.get(key);
                                    const bot = this._mapToBot(key, value);
                                    memoryEvents.push(botAdded(bot));
                                } else if (change.action === 'delete') {
                                    // bot deleted
                                    memoryEvents.push(botRemoved(key));
                                }
                            }
                        }
                    } else {
                        // child event - this could mean that a bot tag was updated
                        if (target instanceof Map) {
                            // Maps are only used for bots and tags
                            // so a map that is not the bots map must be for a tag
                            const id = event.path[
                                event.path.length - 1
                            ] as string;
                            if (event instanceof YMapEvent) {
                                let tags = {} as BotTags;
                                for (let [key, change] of event.changes.keys) {
                                    if (
                                        change.action === 'add' ||
                                        change.action === 'update'
                                    ) {
                                        // tag added
                                        const value = target.get(key);
                                        tags[key] = value;
                                    } else if (change.action === 'delete') {
                                        tags[key] = null;
                                    }
                                }

                                memoryEvents.push(
                                    botUpdated(id, {
                                        tags,
                                    })
                                );
                            }
                        }
                    }
                }
            }
        }

        this._internalPartition.applyEvents(memoryEvents);
    }

    private _mapToBot(
        id: string,
        map: Map<Text | object | number | boolean>
    ): Bot {
        let tags: BotTags = {};
        for (let [key, value] of map.entries()) {
            const val = map.get(key);
            let finalVal: string | number | boolean | object;
            if (val instanceof Text) {
                finalVal = val.toString();
            } else {
                finalVal = val;
            }
            tags[key] = finalVal;
        }

        return createBot(id, tags);
    }
}
