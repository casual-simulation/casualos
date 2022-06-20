import {
    User,
    StatusUpdate,
    Action,
    SESSION_ID_CLAIM,
    device,
    RemoteActions,
} from '@casual-simulation/causal-trees';
import {
    CausalRepoClient,
    CurrentVersion,
    treeVersion,
    VersionVector,
} from '@casual-simulation/causal-trees/core2';
import {
    AuxCausalTree,
    auxTree,
    applyEvents,
    isTagEdit,
    TagEditOp,
    preserve,
    del,
    insert,
    edit,
    TagEdit,
} from '../aux-format-2';
import { Observable, Subscription, Subject, BehaviorSubject } from 'rxjs';
import {
    CausalRepoPartition,
    AuxPartitionRealtimeStrategy,
    YjsPartition,
    MemoryPartition,
} from './AuxPartition';
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
    ShoutAction,
    action,
    ON_REMOTE_DATA_ACTION_NAME,
    ON_REMOTE_WHISPER_ACTION_NAME,
    AsyncAction,
    GetRemoteCountAction,
    asyncResult,
    asyncError,
    GetServersAction,
    convertToString,
    ListInstUpdatesAction,
    GetInstStateFromUpdatesAction,
} from '../bots';
import {
    PartitionConfig,
    CausalRepoPartitionConfig,
    YjsPartitionConfig,
    YjsClientPartitionConfig,
    RemoteYjsPartitionConfig,
} from './AuxPartitionConfig';
import { flatMap, random } from 'lodash';
import { v4 as uuid } from 'uuid';
import {
    Doc,
    Text,
    Map,
    applyUpdate,
    Transaction,
    YMapEvent,
    createAbsolutePositionFromRelativePosition,
    YTextEvent,
    AbstractType,
    YEvent,
    encodeStateAsUpdate,
} from 'yjs';
import { MemoryPartitionImpl } from './MemoryPartition';
import {
    createRelativePositionFromStateVector,
    getClock,
    getStateVector,
} from '../yjs/YjsHelpers';
import { fromByteArray, toByteArray } from 'base64-js';
import { startWith } from 'rxjs/operators';
import { YjsPartitionImpl } from './YjsPartition';

/**
 * Attempts to create a YjsPartition from the given config.
 * @param user The user.
 * @param config The config.
 */
export function createRemoteClientYjsPartition(
    config: PartitionConfig,
    user: User
): YjsPartition {
    if (config.type === 'yjs_client') {
        return new RemoteYjsPartitionImpl(user, config.client, config);
    }
    return undefined;
}

type MapValue = Text | object | number | boolean;
type TagsMap = Map<MapValue>;

export class RemoteYjsPartitionImpl implements YjsPartition {
    protected _onVersionUpdated: BehaviorSubject<CurrentVersion>;
    private _onUpdates: Subject<string[]>;

    protected _onError = new Subject<any>();
    protected _onEvents = new Subject<Action[]>();
    protected _onStatusUpdated = new Subject<StatusUpdate>();
    protected _hasRegisteredSubs = false;
    private _sub = new Subscription();

    private _localId: number;
    private _remoteId: number;
    private _doc: Doc = new Doc();
    private _bots: Map<TagsMap>;
    private _masks: Map<MapValue>;
    private _client: CausalRepoClient;
    private _internalPartition: MemoryPartitionImpl = new MemoryPartitionImpl({
        type: 'memory',
        initialState: {},
    });

    private _isLocalTransaction: boolean = true;
    private _isRemoteUpdate: boolean = false;
    private _user: User;
    private _static: boolean;
    private _watchingBranch: any;
    private _synced: boolean;
    private _branch: string;
    private _temporary: boolean;
    private _readOnly: boolean;
    private _remoteEvents: boolean;

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
        return this._static ? 'delayed' : 'immediate';
    }

    get site() {
        return this._currentSite;
    }

    get onUpdates() {
        return this._onUpdates.pipe(
            startWith([fromByteArray(encodeStateAsUpdate(this._doc))])
        );
    }

    get doc() {
        return this._doc;
    }

    private get _remoteSite() {
        return this._remoteId.toString();
    }

    private get _currentSite() {
        return this._localId.toString();
    }

    constructor(
        user: User,
        client: CausalRepoClient,
        config: YjsClientPartitionConfig | RemoteYjsPartitionConfig
    ) {
        this.private = config.private || false;
        this._client = client;
        this._user = user;
        this._static = config.static;
        this._remoteEvents =
            'remoteEvents' in config ? config.remoteEvents : true;
        this._branch = config.branch;
        this._temporary = config.temporary;

        // static implies read only
        this._readOnly = config.readOnly || this._static || false;

        this._localId = this._doc.clientID;
        this._remoteId = new Doc().clientID;
        this._bots = this._doc.getMap('bots');
        this._masks = this._doc.getMap('masks');
        this._doc.on('afterTransaction', (transaction: Transaction) => {
            this._processTransaction(transaction);
        });
        this._onVersionUpdated = new BehaviorSubject<CurrentVersion>({
            currentSite: this._localId.toString(),
            remoteSite: this._remoteId.toString(),
            vector: {},
        });
        this._onUpdates = new Subject<string[]>();

        this._internalPartition.getNextVersion = (textEdit: TagEdit) => {
            const version = getStateVector(this._doc);

            if (this._isRemoteUpdate) {
                const {
                    [this._currentSite]: currentVersion,
                    ...otherVersions
                } = version;
                return {
                    currentSite: this._currentSite,
                    remoteSite: this._remoteSite,
                    vector: otherVersions,
                };
            } else {
                const site = textEdit.isRemote
                    ? this._remoteSite
                    : this._currentSite;
                return {
                    currentSite: this._currentSite,
                    remoteSite: this._remoteSite,
                    vector: {
                        [site]: version[this._doc.clientID] ?? 0,
                    },
                };
            }
        };
    }

    async applyEvents(events: BotAction[]): Promise<BotAction[]> {
        if (this._static) {
            return [];
        }

        let finalEvents = [] as (
            | AddBotAction
            | RemoveBotAction
            | UpdateBotAction
            | CreateCertificateAction
            | SignTagAction
            | RevokeCertificateAction
        )[];
        for (let e of events) {
            if (e.type === 'apply_state') {
                finalEvents.push(...breakIntoIndividualEvents(this.state, e));
            } else if (
                e.type === 'add_bot' ||
                e.type === 'remove_bot' ||
                e.type === 'update_bot' ||
                e.type === 'create_certificate' ||
                e.type === 'sign_tag' ||
                e.type === 'revoke_certificate'
            ) {
                finalEvents.push(e);
            } else if (e.type === 'unlock_space') {
                // Resolve the unlock_space task
                this._onEvents.next([asyncResult(e.taskId, undefined)]);
            }
        }

        this._applyEvents(finalEvents);

        return [];
    }

    async init(): Promise<void> {}

    connect(): void {
        if (this._static) {
            this._requestBranch();
        } else {
            this._watchBranch();
        }
    }

    async sendRemoteEvents(events: RemoteActions[]): Promise<void> {
        if (this._readOnly || !this._remoteEvents) {
            return;
        }
        for (let event of events) {
            if (event.type === 'remote') {
                if (event.event.type === 'get_remote_count') {
                    const action = <GetRemoteCountAction>event.event;
                    this._client.deviceCount(action.inst).subscribe(
                        (count) => {
                            this._onEvents.next([
                                asyncResult(event.taskId, count),
                            ]);
                        },
                        (err) => {
                            this._onEvents.next([
                                asyncError(event.taskId, err),
                            ]);
                        }
                    );
                } else if (event.event.type === 'get_servers') {
                    const action = <GetServersAction>event.event;
                    if (action.includeStatuses) {
                        this._client.branchesStatus().subscribe(
                            (e) => {
                                this._onEvents.next([
                                    asyncResult(
                                        event.taskId,
                                        e.branches
                                            .filter(
                                                (b) => !b.branch.startsWith('$')
                                            )
                                            .map((b) => ({
                                                inst: b.branch,
                                                lastUpdateTime:
                                                    b.lastUpdateTime,
                                            }))
                                    ),
                                ]);
                            },
                            (err) => {
                                this._onEvents.next([
                                    asyncError(event.taskId, err),
                                ]);
                            }
                        );
                    } else {
                        this._client.branches().subscribe(
                            (e) => {
                                this._onEvents.next([
                                    asyncResult(
                                        event.taskId,
                                        e.branches.filter(
                                            (b) => !b.startsWith('$')
                                        )
                                    ),
                                ]);
                            },
                            (err) => {
                                this._onEvents.next([
                                    asyncError(event.taskId, err),
                                ]);
                            }
                        );
                    }
                } else if (event.event.type === 'get_remotes') {
                    // Do nothing for get_remotes since it will be handled by the OtherPlayersPartition.
                    // TODO: Make this mechanism more extensible so that we don't have to hardcode for each time
                    //       we do this type of logic.
                } else if (event.event.type === 'list_inst_updates') {
                    const action = <ListInstUpdatesAction>event.event;
                    this._client.getBranchUpdates(this._branch).subscribe(
                        ({ updates, timestamps }) => {
                            this._onEvents.next([
                                asyncResult(
                                    event.taskId,
                                    updates.map((u, i) => ({
                                        id: i,
                                        update: u,
                                        timestamp: timestamps?.[i],
                                    }))
                                ),
                            ]);
                        },
                        (err) => {
                            this._onEvents.next([
                                asyncError(event.taskId, err),
                            ]);
                        }
                    );
                } else if (event.event.type === 'get_inst_state_from_updates') {
                    const action = <GetInstStateFromUpdatesAction>event.event;
                    try {
                        let partition = new YjsPartitionImpl({
                            type: 'yjs',
                        });

                        for (let { update } of action.updates) {
                            const updateBytes = toByteArray(update);
                            applyUpdate(partition.doc, updateBytes);
                        }

                        this._onEvents.next([
                            asyncResult(event.taskId, partition.state, false),
                        ]);
                    } catch (err) {
                        this._onEvents.next([asyncError(event.taskId, err)]);
                    }
                } else {
                    this._client.sendEvent(this._branch, event);
                }
            } else {
                this._client.sendEvent(this._branch, event);
            }
        }
    }

    private _requestBranch() {
        this._client.getBranchUpdates(this._branch).subscribe(
            (updates) => {
                this._onStatusUpdated.next({
                    type: 'connection',
                    connected: true,
                });
                this._onStatusUpdated.next({
                    type: 'authentication',
                    authenticated: true,
                    user: this._user,
                });
                this._onStatusUpdated.next({
                    type: 'authorization',
                    authorized: true,
                });

                this._updateSynced(true);
                this._applyUpdates(updates.updates);

                if (!this._static) {
                    // the partition has been unlocked while getting the branch
                    this._watchBranch();
                }
            },
            (err) => this._onError.next(err)
        );
    }

    private _watchBranch() {
        if (this._watchingBranch) {
            return;
        }
        this._watchingBranch = true;
        this._sub.add(
            this._client.connection.connectionState.subscribe(
                (state) => {
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
                },
                (err) => this._onError.next(err)
            )
        );
        this._sub.add(
            this._client
                .watchBranchUpdates({
                    branch: this._branch,
                    temporary: this._temporary,
                    siteId: this._currentSite,
                })
                .subscribe(
                    (event) => {
                        // The partition should become synced if it was not synced
                        // and it just got some new data.
                        if (!this._synced && event.type === 'updates') {
                            this._updateSynced(true);
                        }
                        if (event.type === 'updates') {
                            this._applyUpdates(event.updates);
                        } else if (event.type === 'event') {
                            if (event.action.type === 'device') {
                                if (event.action.event.type === 'action') {
                                    const remoteAction = event.action
                                        .event as ShoutAction;
                                    this._onEvents.next([
                                        action(
                                            ON_REMOTE_DATA_ACTION_NAME,
                                            null,
                                            null,
                                            {
                                                name: remoteAction.eventName,
                                                that: remoteAction.argument,
                                                remoteId:
                                                    event.action.device.claims[
                                                        SESSION_ID_CLAIM
                                                    ],
                                            }
                                        ),
                                        action(
                                            ON_REMOTE_WHISPER_ACTION_NAME,
                                            null,
                                            null,
                                            {
                                                name: remoteAction.eventName,
                                                that: remoteAction.argument,
                                                playerId:
                                                    event.action.device.claims[
                                                        SESSION_ID_CLAIM
                                                    ],
                                            }
                                        ),
                                    ]);
                                } else if (hasValue(event.action.taskId)) {
                                    const newEvent = device(
                                        event.action.device,
                                        {
                                            ...event.action.event,
                                            taskId: event.action.taskId,
                                            playerId:
                                                event.action.device.claims[
                                                    SESSION_ID_CLAIM
                                                ],
                                        } as AsyncAction,
                                        event.action.taskId
                                    );
                                    this._onEvents.next([newEvent]);
                                } else {
                                    this._onEvents.next([event.action]);
                                }
                            } else {
                                this._onEvents.next([event.action]);
                            }
                        }
                    },
                    (err) => this._onError.next(err)
                )
        );

        const updateHandler = (
            update: Uint8Array,
            origin: any,
            doc: Doc,
            transaction: Transaction
        ) => {
            if (this._readOnly) {
                return;
            }
            if (transaction && transaction.local) {
                const updates = [fromByteArray(update)];
                this._client.addUpdates(this._branch, updates);
                this._onUpdates.next(updates);
            }
        };
        this._doc.on('update', updateHandler);

        this._sub.add(
            new Subscription(() => {
                this._doc.off('update', updateHandler);
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
        try {
            this._isLocalTransaction = true;
            this._doc.transact((t) => {
                for (let event of events) {
                    if (event.type === 'add_bot') {
                        const map: TagsMap = new Map();

                        for (let tag in event.bot.tags) {
                            const val = event.bot.tags[tag];
                            const yVal =
                                typeof val === 'string' ? new Text(val) : val;
                            map.set(tag, yVal);
                        }

                        if (this.space && event.bot.masks) {
                            const tags = event.bot.masks[this.space];
                            if (tags) {
                                for (let tag of Object.keys(tags)) {
                                    const maskId = tagMaskId(event.id, tag);
                                    const val = tags[tag];
                                    const yVal =
                                        typeof val === 'string'
                                            ? new Text(val)
                                            : val;

                                    this._masks.set(maskId, yVal);
                                }
                            }
                        }

                        this._bots.set(event.id, map);
                    } else if (event.type === 'remove_bot') {
                        this._bots.delete(event.id);
                    } else if (event.type === 'update_bot') {
                        const currentBot = this.state[event.id];
                        const currentMap = this._bots.get(event.id);
                        if (event.update.tags && currentBot && currentMap) {
                            for (let tag of Object.keys(event.update.tags)) {
                                let newVal = event.update.tags[tag];
                                const oldVal = currentBot.tags[tag];

                                if (newVal === oldVal) {
                                    if (Array.isArray(newVal)) {
                                        newVal = newVal.slice();
                                    } else {
                                        continue;
                                    }
                                }

                                this._updateValueInMap(
                                    this._doc,
                                    currentMap,
                                    tag,
                                    newVal
                                );
                            }
                        }

                        if (this.space && event.update.masks) {
                            const tags = event.update.masks[this.space];

                            if (tags) {
                                for (let tag of Object.keys(tags)) {
                                    const maskId = tagMaskId(event.id, tag);
                                    const value = tags[tag];

                                    this._updateValueInMap(
                                        this._doc,
                                        this._masks,
                                        maskId,
                                        value
                                    );
                                }
                            }
                        }
                    }
                }
            });
        } finally {
            this._isLocalTransaction = false;
        }
    }

    private _applyUpdates(updates: string[]) {
        try {
            this._isRemoteUpdate = true;
            for (let updateBase64 of updates) {
                const update = toByteArray(updateBase64);
                applyUpdate(this._doc, update);
            }
        } finally {
            this._isRemoteUpdate = false;
        }
    }

    private async _processTransaction(transaction: Transaction) {
        let memoryEvents: (AddBotAction | RemoveBotAction | UpdateBotAction)[] =
            [];

        const version = getStateVector(this._doc);

        for (let [type, events] of transaction.changedParentTypes) {
            if (type === this._bots) {
                for (let event of events) {
                    // Update the current target so that the event
                    // path is calculated from the bots map.
                    // see https://github.com/yjs/yjs/blob/5244755879daaa7b5a1ca64e6af617cdbb110462/src/utils/YEvent.js#L63
                    event.currentTarget = this._bots;

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
                        this._handleValueUpdates(
                            target,
                            event,
                            memoryEvents,
                            version,
                            (event) =>
                                event.path[event.path.length - 1] as string,
                            (event, key) => {
                                throw new Error('should not happen');
                            },
                            (event) => ({
                                id: event.path[event.path.length - 2] as string,
                                tag: event.path[
                                    event.path.length - 1
                                ] as string,
                            }),
                            (id, tags) =>
                                botUpdated(id, {
                                    tags,
                                }),
                            (id, tag, val) =>
                                botUpdated(id, {
                                    tags: {
                                        [tag]: val,
                                    },
                                })
                        );
                    }
                }
            } else if (type === this._masks) {
                for (let event of events) {
                    // Update the current target so that the event
                    // path is calculated from the bots map.
                    // see https://github.com/yjs/yjs/blob/5244755879daaa7b5a1ca64e6af617cdbb110462/src/utils/YEvent.js#L63
                    event.currentTarget = this._masks;
                    const target = event.target;
                    this._handleValueUpdates(
                        target,
                        event,
                        memoryEvents,
                        version,
                        (event) => event.path[event.path.length - 1] as string,
                        (event, key) => parseTagMaskId(key),
                        (event) =>
                            parseTagMaskId(
                                event.path[event.path.length - 1] as string
                            ),
                        (id, tags) =>
                            botUpdated(id, {
                                masks: {
                                    [this.space]: tags,
                                },
                            }),
                        (id, tag, val) =>
                            botUpdated(id, {
                                masks: {
                                    [this.space]: {
                                        [tag]: val,
                                    },
                                },
                            })
                    );
                }
            }
        }

        await this._internalPartition.applyEvents(memoryEvents);

        this._onVersionUpdated.next({
            currentSite: this._currentSite,
            remoteSite: this._remoteSite,
            vector: version,
        });
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

    /**
     * Updates the given value in the given document and map.
     * This is a generalization of the update logic for tags and tag masks.
     * @param doc The document.
     * @param map The map that contains the values.
     * @param valueId The ID that the value should be looked up by. For tags, this is the tag name. For tag masks, this is the tag mask ID.
     * @param newVal The new value.
     */
    private _updateValueInMap(
        doc: Doc,
        map: Map<MapValue>,
        valueId: string,
        newVal: any
    ) {
        doc.clientID = this._localId;
        if (hasValue(newVal)) {
            if (isTagEdit(newVal)) {
                if (newVal.isRemote) {
                    doc.clientID = this._remoteId;
                    this._isLocalTransaction = false;
                }

                const val = map.get(valueId);
                let text: Text;
                if (val instanceof Text) {
                    text = val;
                } else {
                    text = new Text(convertToString(val));
                    map.set(valueId, text);
                }

                const version = {
                    ...newVal.version,
                    [this._currentSite]: getClock(doc, this._localId),
                };

                if (text instanceof Text) {
                    for (let ops of newVal.operations) {
                        let index = 0;
                        for (let op of ops) {
                            if (op.type === 'preserve') {
                                index += op.count;
                            } else if (op.type === 'insert') {
                                if (op.text.length <= 0) {
                                    continue;
                                }
                                const relativePos =
                                    createRelativePositionFromStateVector(
                                        text,
                                        version,
                                        index
                                    );
                                const finalPosition =
                                    createAbsolutePositionFromRelativePosition(
                                        relativePos,
                                        doc
                                    );

                                text.insert(finalPosition.index, op.text);
                                index += op.text.length;
                            } else if (op.type === 'delete') {
                                if (op.count <= 0) {
                                    continue;
                                }
                                const relativePos =
                                    createRelativePositionFromStateVector(
                                        text,
                                        version,
                                        index
                                    );
                                const finalPosition =
                                    createAbsolutePositionFromRelativePosition(
                                        relativePos,
                                        doc
                                    );

                                text.delete(finalPosition.index, op.count);
                            }
                        }

                        version[this._currentSite] = getClock(
                            doc,
                            this._localId
                        );
                    }
                }
            } else {
                const yVal =
                    typeof newVal === 'string' ? new Text(newVal) : newVal;
                map.set(valueId, yVal);
            }
        } else {
            map.delete(valueId);
        }
    }

    private _handleValueUpdates(
        target: AbstractType<any>,
        event: YEvent,
        events: (AddBotAction | RemoveBotAction | UpdateBotAction)[],
        version: VersionVector,
        getMapBotId: (event: YEvent) => string,
        getTagMaskBotValues: (
            event: YEvent,
            key: string
        ) => { id: string; tag: string },
        getTextBotValues: (event: YEvent) => { id: string; tag: string },
        createBotUpdate: (id: string, tags: BotTags) => UpdateBotAction,
        createTextUpdate: (
            id: string,
            tag: string,
            value: any
        ) => UpdateBotAction
    ) {
        // child event - this could mean that a bot tag was updated
        if (target instanceof Map) {
            if (event instanceof YMapEvent) {
                if (target === this._masks) {
                    let botToMasks = new globalThis.Map<string, BotTags>();
                    for (let [key, change] of event.changes.keys) {
                        const { id, tag } = getTagMaskBotValues(event, key);

                        let tags = botToMasks.get(id);
                        if (!tags) {
                            tags = {};
                            botToMasks.set(id, tags);
                        }

                        if (
                            change.action === 'add' ||
                            change.action === 'update'
                        ) {
                            // tag added
                            const value = target.get(key);
                            const auxValue =
                                value instanceof Text
                                    ? value.toString()
                                    : value;
                            tags[tag] = auxValue;
                        } else if (change.action === 'delete') {
                            tags[tag] = null;
                        }
                    }

                    for (let [id, tags] of botToMasks) {
                        events.push(createBotUpdate(id, tags));
                    }
                } else {
                    // Maps are only used for bots and tags
                    // so a map that is not the bots map must be for a tag
                    const id = getMapBotId(event);
                    let tags = {} as BotTags;
                    for (let [key, change] of event.changes.keys) {
                        if (
                            change.action === 'add' ||
                            change.action === 'update'
                        ) {
                            // tag added
                            const value = target.get(key);
                            const auxValue =
                                value instanceof Text
                                    ? value.toString()
                                    : value;
                            tags[key] = auxValue;
                        } else if (change.action === 'delete') {
                            tags[key] = null;
                        }
                    }

                    events.push(createBotUpdate(id, tags));
                }
            }
        } else if (target instanceof Text) {
            // text is used for string tag values
            const { id, tag } = getTextBotValues(event);
            if (event instanceof YTextEvent) {
                let operations = [] as TagEditOp[];
                for (let delta of event.delta) {
                    if (hasValue(delta.retain)) {
                        operations.push(preserve(delta.retain));
                    } else if (hasValue(delta.insert)) {
                        if (typeof delta.insert === 'string') {
                            operations.push(insert(delta.insert));
                        } else if (Array.isArray(delta.insert)) {
                            for (let str of delta.insert) {
                                operations.push(insert(str));
                            }
                        }
                    } else if (hasValue(delta.delete)) {
                        operations.push(del(delta.delete));
                    }
                }

                const siteId = this._isLocalTransaction
                    ? this._currentSite
                    : this._remoteSite;
                const e = edit({ [siteId]: version[siteId] }, ...operations);
                e.isRemote = !this._isLocalTransaction;
                events.push(createTextUpdate(id, tag, e));
            }
        }
    }
}

/**
 * Creates the tag mask ID for the given bot ID and tag.
 * @param botId The ID of the bot.
 * @param tag the tag.
 */
function tagMaskId(botId: string, tag: string): string {
    return `${botId}:${tag}`;
}

/**
 * Creates the tag mask ID for the given bot ID and tag.
 * @param botId The ID of the bot.
 * @param tag the tag.
 */
function parseTagMaskId(val: string): { id: string; tag: string } {
    const index = val.indexOf(':');
    if (index < 0) {
        throw new Error('Invalid tag mask ID');
    }
    const id = val.substring(0, index);
    const tag = val.substring(index + 1);

    return { id, tag };
}
