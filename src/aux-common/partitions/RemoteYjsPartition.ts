import {
    isTagEdit,
    TagEditOp,
    preserve,
    del,
    insert,
    edit,
    TagEdit,
    GetRemoteCountAction,
} from '../bots';
import {
    Observable,
    Subscription,
    Subject,
    BehaviorSubject,
    firstValueFrom,
} from 'rxjs';
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
    asyncResult,
    asyncError,
    convertToString,
    ListInstUpdatesAction,
    GetInstStateFromUpdatesAction,
    CreateInitializationUpdateAction,
    InstUpdate,
    ApplyUpdatesToInstAction,
    ON_SPACE_MAX_SIZE_REACHED,
    ON_SPACE_RATE_LIMIT_EXCEEDED_ACTION_NAME,
    GetCurrentInstUpdateAction,
} from '../bots';
import {
    PartitionConfig,
    YjsClientPartitionConfig,
    RemoteYjsPartitionConfig,
    PartitionRemoteEvents,
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
import { filter, startWith } from 'rxjs/operators';
import { YjsPartitionImpl } from './YjsPartition';
import { ensureTagIsSerializable, supportsRemoteEvent } from './PartitionUtils';
import {
    Action,
    ConnectionIndicator,
    RemoteActions,
    StatusUpdate,
    CurrentVersion,
    device,
    VersionVector,
    getConnectionId,
} from '../common';
import { InstRecordsClient } from '../websockets';
import { PartitionAuthSource } from './PartitionAuthSource';
import { YjsIndexedDBPersistence } from '../yjs/YjsIndexedDBPersistence';

/**
 * Attempts to create a YjsPartition from the given config.
 * @param config The config.
 * @param authSource The auth source.
 */
export function createRemoteClientYjsPartition(
    config: PartitionConfig,
    authSource: PartitionAuthSource
): YjsPartition {
    if (config.type === 'yjs_client') {
        return new RemoteYjsPartitionImpl(config.client, authSource, config);
    }
    return undefined;
}

type MapValue = Text | object | number | boolean;
type TagsMap = Map<MapValue>;

const APPLY_UPDATES_TO_INST_TRANSACTION_ORIGIN = '__apply_updates_to_inst';

export class RemoteYjsPartitionImpl implements YjsPartition {
    protected _onVersionUpdated: BehaviorSubject<CurrentVersion>;
    private _onUpdates: Subject<string[]>;

    protected _onError = new Subject<any>();
    protected _onEvents = new Subject<Action[]>();
    protected _onStatusUpdated = new Subject<StatusUpdate>();
    protected _hasRegisteredSubs = false;
    private _sub = new Subscription();

    private _emittedMaxSizeReached: boolean = false;
    private _localId: number;
    private _remoteId: number;
    private _doc: Doc = new Doc();
    private _bots: Map<TagsMap>;
    private _masks: Map<MapValue>;
    private _client: InstRecordsClient;
    private _currentVersion: CurrentVersion;
    private _internalPartition: MemoryPartitionImpl;

    private _isLocalTransaction: boolean = true;
    private _isRemoteUpdate: boolean = false;
    private _static: boolean;
    private _skipInitialLoad: boolean;
    private _sendInitialUpdates: boolean = false;
    private _watchingBranch: any;
    private _synced: boolean;
    private _authorized: boolean;
    private _recordName: string | null;
    private _inst: string;
    private _branch: string;
    private _temporary: boolean;
    private _readOnly: boolean;
    private _remoteEvents: PartitionRemoteEvents | boolean;
    private _authSource: PartitionAuthSource;
    private _indexeddb: YjsIndexedDBPersistence;
    private _persistence: RemoteYjsPartitionConfig['localPersistence'];

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
        client: InstRecordsClient,
        authSource: PartitionAuthSource,
        config: YjsClientPartitionConfig | RemoteYjsPartitionConfig
    ) {
        this.private = config.private || false;
        this._client = client;
        this._static = config.static;
        this._skipInitialLoad = config.skipInitialLoad;
        this._remoteEvents =
            'remoteEvents' in config ? config.remoteEvents : true;
        this._recordName = config.recordName;
        this._inst = config.inst;
        this._branch = config.branch;
        this._temporary = config.temporary;
        this._persistence = config.localPersistence;
        this._synced = false;
        this._authorized = false;
        this._authSource = authSource;

        // static implies read only
        this._readOnly = config.readOnly || this._static || false;

        this._localId = this._doc.clientID;
        this._remoteId = new Doc().clientID;
        this._bots = this._doc.getMap('bots');
        this._masks = this._doc.getMap('masks');
        this._doc.on('afterTransaction', (transaction: Transaction) => {
            this._processTransaction(transaction);
        });
        this._currentVersion = {
            currentSite: this._localId.toString(),
            remoteSite: this._remoteId.toString(),
            vector: {},
        };
        this._onVersionUpdated = new BehaviorSubject<CurrentVersion>(
            this._currentVersion
        );
        this._onUpdates = new Subject<string[]>();

        this._internalPartition = new MemoryPartitionImpl({
            type: 'memory',
            initialState: {},
            localSiteId: this._currentSite,
            remoteSiteId: this._remoteSite,
        });
        this._internalPartition.getCurrentVersion = () => this._currentVersion;
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
        )[];
        for (let e of events) {
            if (e.type === 'apply_state') {
                finalEvents.push(...breakIntoIndividualEvents(this.state, e));
            } else if (
                e.type === 'add_bot' ||
                e.type === 'remove_bot' ||
                e.type === 'update_bot'
            ) {
                finalEvents.push(e);
            }
        }

        this._applyEvents(finalEvents);

        return [];
    }

    async init(): Promise<void> {}

    connect(): void {
        if (!this._temporary && this._persistence?.saveToIndexedDb) {
            console.log('[RemoteYjsPartition] Using IndexedDB persistence');
            const name = `${this._recordName ?? ''}/${this._inst}/${
                this._branch
            }`;
            this._indexeddb = new YjsIndexedDBPersistence(name, this._doc);
        }

        if (this._skipInitialLoad) {
            this._initializePartitionWithoutLoading();
        } else if (this._static) {
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
            if (!supportsRemoteEvent(this._remoteEvents, event)) {
                continue;
            }

            if (event.type === 'remote') {
                if (event.event.type === 'get_remotes') {
                    // Do nothing for get_remotes since it will be handled by the OtherPlayersPartition.
                    // TODO: Make this mechanism more extensible so that we don't have to hardcode for each time
                    //       we do this type of logic.
                } else if (event.event.type === 'get_remote_count') {
                    const action = <GetRemoteCountAction>event.event;
                    this._client
                        .connectionCount(
                            action.recordName,
                            action.inst,
                            action.branch
                        )
                        .subscribe({
                            next: (count) => {
                                this._onEvents.next([
                                    asyncResult(event.taskId, count),
                                ]);
                            },
                            error: (err) => {
                                this._onEvents.next([
                                    asyncError(event.taskId, err),
                                ]);
                            },
                        });
                } else if (event.event.type === 'list_inst_updates') {
                    const action = <ListInstUpdatesAction>event.event;
                    this._client
                        .getBranchUpdates(
                            this._recordName,
                            this._inst,
                            this._branch
                        )
                        .subscribe({
                            next: ({ updates, timestamps }) => {
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
                            error: (err) => {
                                this._onEvents.next([
                                    asyncError(event.taskId, err),
                                ]);
                            },
                        });
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
                } else if (
                    event.event.type === 'create_initialization_update'
                ) {
                    const action = <CreateInitializationUpdateAction>(
                        event.event
                    );
                    try {
                        let partition = new YjsPartitionImpl({
                            type: 'yjs',
                        });

                        partition.doc.on('update', (update: Uint8Array) => {
                            let instUpdate: InstUpdate = {
                                id: 0,
                                timestamp: Date.now(),
                                update: fromByteArray(update),
                            };

                            this._onEvents.next([
                                asyncResult(event.taskId, instUpdate, false),
                            ]);
                        });

                        await partition.applyEvents(
                            action.bots.map((b) =>
                                botAdded(createBot(b.id, b.tags))
                            )
                        );
                    } catch (err) {
                        this._onEvents.next([asyncError(event.taskId, err)]);
                    }
                } else if (event.event.type === 'apply_updates_to_inst') {
                    const action = <ApplyUpdatesToInstAction>event.event;
                    try {
                        this._applyUpdates(
                            action.updates.map((u) => u.update),
                            APPLY_UPDATES_TO_INST_TRANSACTION_ORIGIN
                        );
                        this._onEvents.next([
                            asyncResult(event.taskId, null, false),
                        ]);
                    } catch (err) {
                        this._onEvents.next([asyncError(event.taskId, err)]);
                    }
                } else if (event.event.type === 'get_current_inst_update') {
                    const action = <GetCurrentInstUpdateAction>event.event;
                    try {
                        const update: InstUpdate = {
                            id: 0,
                            timestamp: Date.now(),
                            update: fromByteArray(
                                encodeStateAsUpdate(this._doc)
                            ),
                        };
                        this._onEvents.next([
                            asyncResult(event.taskId, update, false),
                        ]);
                    } catch (err) {
                        this._onEvents.next([asyncError(event.taskId, err)]);
                    }
                } else {
                    this._client.sendAction(
                        this._recordName,
                        this._inst,
                        this._branch,
                        event
                    );
                }
            } else {
                this._client.sendAction(
                    this._recordName,
                    this._inst,
                    this._branch,
                    event
                );
            }
        }
    }

    async enableCollaboration() {
        this._static = false;
        this._skipInitialLoad = false;
        this._sendInitialUpdates = true;
        this._synced = false;
        const promise = firstValueFrom(
            this._onStatusUpdated.pipe(
                filter((u) => u.type === 'sync' && u.synced)
            )
        );
        this._watchBranch();
        await promise;
    }

    private async _initializePartitionWithoutLoading() {
        this._onStatusUpdated.next({
            type: 'connection',
            connected: true,
        });
        const indicator = this._client.connection.indicator;
        const connectionId = indicator
            ? getConnectionId(indicator)
            : 'missing-connection-id';
        this._onStatusUpdated.next({
            type: 'authentication',
            authenticated: true,
            info: this._client.connection.info ?? {
                connectionId: connectionId,
                sessionId: null,
                userId: null,
            },
        });
        this._updateSynced(true);
    }

    private _requestBranch() {
        this._client
            .getBranchUpdates(this._recordName, this._inst, this._branch)
            .subscribe({
                next: (updates) => {
                    this._onStatusUpdated.next({
                        type: 'connection',
                        connected: true,
                    });
                    this._onStatusUpdated.next({
                        type: 'authentication',
                        authenticated: true,
                        info: this._client.connection.info,
                    });

                    this._updateSynced(true);
                    this._applyUpdates(updates.updates);

                    if (!this._static) {
                        // the partition has been unlocked while getting the branch
                        this._watchBranch();
                    }
                },
                error: (err) => this._onError.next(err),
            });
    }

    private _watchBranch() {
        if (this._watchingBranch) {
            return;
        }
        this._watchingBranch = true;
        this._sub.add(
            this._client.connection.connectionState.subscribe({
                next: (state) => {
                    const connected = state.connected;
                    this._onStatusUpdated.next({
                        type: 'connection',
                        connected: !!connected,
                    });
                    if (connected) {
                        this._onStatusUpdated.next({
                            type: 'authentication',
                            authenticated: true,
                            info: state.info,
                        });
                    } else {
                        this._updateSynced(false);
                    }
                },
                error: (err) => this._onError.next(err),
            })
        );
        this._sub.add(
            this._client
                .watchBranchUpdates({
                    type: 'repo/watch_branch',
                    recordName: this._recordName,
                    inst: this._inst,
                    branch: this._branch,
                    temporary: this._temporary,
                })
                .subscribe({
                    next: (event) => {
                        // The partition should become synced if it was not synced
                        // and it just got some new data.
                        if (!this._synced && event.type === 'updates') {
                            if (this._sendInitialUpdates) {
                                this._sendInitialUpdates = false;
                                const update = encodeStateAsUpdate(this._doc);
                                const updates = [fromByteArray(update)];
                                this._client.addUpdates(
                                    this._recordName,
                                    this._inst,
                                    this._branch,
                                    updates
                                );
                            }
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
                                                    event.action.connection
                                                        .connectionId,
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
                                                    event.action.connection
                                                        .connectionId,
                                            }
                                        ),
                                    ]);
                                } else if (hasValue(event.action.taskId)) {
                                    const newEvent = device(
                                        event.action.connection,
                                        {
                                            ...event.action.event,
                                            taskId: event.action.taskId,
                                            playerId:
                                                event.action.connection
                                                    .connectionId,
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
                        } else if (event.type === 'error') {
                            if (event.kind === 'max_size_reached') {
                                if (!this._emittedMaxSizeReached) {
                                    console.log(
                                        '[RemoteYjsPartition] Max size reached!',
                                        this.space
                                    );
                                    this._emittedMaxSizeReached = true;
                                    this._onEvents.next([
                                        action(
                                            ON_SPACE_MAX_SIZE_REACHED,
                                            null,
                                            null,
                                            {
                                                space: this.space,
                                                maxSizeInBytes:
                                                    event.maxBranchSizeInBytes,
                                                neededSizeInBytes:
                                                    event.neededBranchSizeInBytes,
                                            }
                                        ),
                                    ]);
                                }
                            } else if (event.kind === 'error') {
                                const errorCode = event.info.errorCode;
                                if (
                                    errorCode === 'not_authorized' ||
                                    errorCode ===
                                        'subscription_limit_reached' ||
                                    errorCode === 'inst_not_found' ||
                                    errorCode === 'record_not_found' ||
                                    errorCode === 'invalid_record_key' ||
                                    errorCode === 'invalid_token' ||
                                    errorCode ===
                                        'unacceptable_connection_id' ||
                                    errorCode ===
                                        'unacceptable_connection_token' ||
                                    errorCode === 'user_is_banned' ||
                                    errorCode === 'not_logged_in' ||
                                    errorCode === 'session_expired'
                                ) {
                                    this._onStatusUpdated.next({
                                        type: 'authorization',
                                        authorized: false,
                                        error: event.info,
                                    });
                                    this._authSource.sendAuthRequest({
                                        type: 'request',
                                        kind: 'not_authorized',
                                        errorCode: event.info.errorCode,
                                        errorMessage: event.info.errorMessage,
                                        origin: this._client.connection.origin,
                                        reason: event.info.reason,
                                        resource: {
                                            type: 'inst',
                                            recordName: this._recordName,
                                            inst: this._inst,
                                        },
                                    });
                                }
                            }
                        } else if (event.type === 'repo/watch_branch_result') {
                            if (event.success === false) {
                                const errorCode = event.errorCode;
                                if (
                                    errorCode === 'not_authorized' ||
                                    errorCode ===
                                        'subscription_limit_reached' ||
                                    errorCode === 'inst_not_found' ||
                                    errorCode === 'record_not_found' ||
                                    errorCode === 'invalid_record_key' ||
                                    errorCode === 'invalid_token' ||
                                    errorCode ===
                                        'unacceptable_connection_id' ||
                                    errorCode ===
                                        'unacceptable_connection_token' ||
                                    errorCode === 'user_is_banned' ||
                                    errorCode === 'not_logged_in' ||
                                    errorCode === 'session_expired'
                                ) {
                                    const { type, ...error } = event;
                                    this._onStatusUpdated.next({
                                        type: 'authorization',
                                        authorized: false,
                                        error: error,
                                    });
                                    this._authSource.sendAuthRequest({
                                        type: 'request',
                                        kind: 'not_authorized',
                                        errorCode: event.errorCode,
                                        errorMessage: event.errorMessage,
                                        origin: this._client.connection.origin,
                                        reason: event.reason,
                                        resource: {
                                            type: 'inst',
                                            recordName: this._recordName,
                                            inst: this._inst,
                                        },
                                    });
                                }
                            }
                        }
                    },
                    error: (err) => this._onError.next(err),
                })
        );
        this._sub.add(
            this._client.watchRateLimitExceeded().subscribe((event) => {
                console.error(
                    '[RemoteYjsPartition] Rate limit exceeded!',
                    event
                );
                this._onEvents.next([
                    action(
                        ON_SPACE_RATE_LIMIT_EXCEEDED_ACTION_NAME,
                        null,
                        null,
                        {
                            space: this.space,
                        }
                    ),
                ]);
            })
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
            if (
                transaction &&
                (transaction.local ||
                    origin === APPLY_UPDATES_TO_INST_TRANSACTION_ORIGIN)
            ) {
                const updates = [fromByteArray(update)];
                this._client.addUpdates(
                    this._recordName,
                    this._inst,
                    this._branch,
                    updates
                );
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
        if (synced && !this._authorized) {
            this._authorized = true;
            this._onStatusUpdated.next({
                type: 'authorization',
                authorized: true,
            });
        }
        this._synced = synced;
        this._onStatusUpdated.next({
            type: 'sync',
            synced: synced,
        });
    }

    private _applyEvents(
        events: (AddBotAction | RemoveBotAction | UpdateBotAction)[]
    ) {
        try {
            this._isLocalTransaction = true;
            this._doc.transact((t) => {
                for (let event of events) {
                    if (event.type === 'add_bot') {
                        const map: TagsMap = new Map();

                        for (let tag in event.bot.tags) {
                            const val = ensureTagIsSerializable(
                                event.bot.tags[tag]
                            );
                            if (hasValue(val)) {
                                const yVal =
                                    typeof val === 'string'
                                        ? new Text(val)
                                        : val;
                                map.set(tag, yVal);
                            }
                        }

                        if (this.space && event.bot.masks) {
                            const tags = event.bot.masks[this.space];
                            if (tags) {
                                for (let tag of Object.keys(tags)) {
                                    const maskId = tagMaskId(event.id, tag);
                                    const val = ensureTagIsSerializable(
                                        tags[tag]
                                    );
                                    if (hasValue(val)) {
                                        const yVal =
                                            typeof val === 'string'
                                                ? new Text(val)
                                                : val;
                                        this._masks.set(maskId, yVal);
                                    }
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
                                let newVal = ensureTagIsSerializable(
                                    event.update.tags[tag]
                                );
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
                                    const value = ensureTagIsSerializable(
                                        tags[tag]
                                    );

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

    private _applyUpdates(updates: string[], transactionOrigin?: string) {
        try {
            this._isRemoteUpdate = true;
            for (let updateBase64 of updates) {
                const update = toByteArray(updateBase64);
                applyUpdate(this._doc, update, transactionOrigin);
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

        this._currentVersion = {
            currentSite: this._currentSite,
            remoteSite: this._remoteSite,
            vector: version,
        };
        await this._internalPartition.applyEvents(memoryEvents);
        this._onVersionUpdated.next(this._currentVersion);
    }

    private _mapToBot(
        id: string,
        map: Map<Text | object | number | boolean>
    ): Bot {
        let tags: BotTags = {};
        for (let [key, value] of map.entries()) {
            const val = map.get(key);
            let finalVal: string | number | boolean | object;
            if (hasValue(val)) {
                if (val instanceof Text) {
                    finalVal = val.toString();
                } else {
                    finalVal = val;
                }
                tags[key] = finalVal;
            }
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
        event: YEvent<AbstractType<any>>,
        events: (AddBotAction | RemoveBotAction | UpdateBotAction)[],
        version: VersionVector,
        getMapBotId: (event: YEvent<AbstractType<any>>) => string,
        getTagMaskBotValues: (
            event: YEvent<AbstractType<any>>,
            key: string
        ) => { id: string; tag: string },
        getTextBotValues: (event: YEvent<AbstractType<any>>) => {
            id: string;
            tag: string;
        },
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
