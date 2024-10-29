import {
    BehaviorSubject,
    filter,
    firstValueFrom,
    Observable,
    startWith,
    Subject,
    Subscription,
} from 'rxjs';
import {
    RelativePosition,
    SharedArray,
    SharedArrayChanges,
    SharedArrayDelta,
    SharedDocument,
    SharedMap,
    SharedMapChanges,
    SharedText,
    SharedTextChanges,
    SharedTextDelta,
    SharedType,
    SharedTypeChanges,
} from './SharedDocument';
import {
    createRelativePositionFromTypeIndex,
    createAbsolutePositionFromRelativePosition,
    AbstractType as YType,
    Map as YMap,
    Array as YArray,
    Text as YText,
    YMapEvent,
    YEvent,
    YArrayEvent,
    YTextEvent,
    Doc,
    encodeStateAsUpdate,
    Transaction,
    applyUpdate,
} from 'yjs';
import {
    ClientError,
    ClientEvent,
    InstRecordsClient,
    MaxInstSizeReachedClientError,
    RateLimitExceededMessage,
} from '../websockets';
import { SharedDocumentConfig } from './SharedDocumentConfig';
import { PartitionAuthSource } from '../partitions/PartitionAuthSource';
import { YjsIndexedDBPersistence } from '../yjs/YjsIndexedDBPersistence';
import { fromByteArray, toByteArray } from 'base64-js';
import {
    Action,
    CurrentVersion,
    getConnectionId,
    StatusUpdate,
} from '../common';
import { InstUpdate } from '../bots';

export const APPLY_UPDATES_TO_INST_TRANSACTION_ORIGIN =
    '__apply_updates_to_inst';

export class RemoteYjsSharedDocument implements SharedDocument {
    protected _onVersionUpdated: BehaviorSubject<CurrentVersion>;
    protected _onUpdates: Subject<string[]> = new Subject<string[]>();

    protected _onError = new Subject<any>();
    protected _onEvents = new Subject<Action[]>();
    protected _onStatusUpdated = new Subject<StatusUpdate>();

    protected _onClientError = new Subject<ClientError>();
    protected _hasRegisteredSubs = false;
    protected _sub = new Subscription();

    protected _localId: number;
    protected _remoteId: number;
    protected _doc: Doc = new Doc();
    protected _client: InstRecordsClient;
    protected _currentVersion: CurrentVersion;

    protected _isLocalTransaction: boolean = true;
    protected _isRemoteUpdate: boolean = false;
    protected _static: boolean;
    protected _skipInitialLoad: boolean;
    protected _sendInitialUpdates: boolean = false;
    protected _watchingBranch: any;
    protected _synced: boolean;
    protected _authorized: boolean;
    protected _recordName: string | null;
    protected _inst: string;
    protected _branch: string;
    protected _temporary: boolean;
    protected _readOnly: boolean;
    protected _authSource: PartitionAuthSource;
    protected _indexeddb: YjsIndexedDBPersistence;
    protected _persistence: SharedDocumentConfig['localPersistence'];
    private _maps: Map<string, YjsSharedMap<any>> = new Map();
    private _arrays: Map<string, YjsSharedArray<any>> = new Map();
    private _texts: Map<string, YjsSharedText> = new Map();

    get recordName(): string {
        return this._recordName;
    }

    get address(): string {
        return this._inst;
    }

    get branch(): string {
        return this._branch;
    }

    get clientId(): number {
        return this._doc.clientID;
    }

    get closed() {
        return this._sub.closed;
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

    get onClientError(): Observable<ClientError> {
        return this._onClientError;
    }

    get onStatusUpdated(): Observable<StatusUpdate> {
        return this._onStatusUpdated;
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

    protected get _remoteSite() {
        return this._remoteId.toString();
    }

    protected get _currentSite() {
        return this._localId.toString();
    }

    unsubscribe(): void {
        this._sub.unsubscribe();
    }

    constructor(
        client: InstRecordsClient,
        authSource: PartitionAuthSource,
        config: SharedDocumentConfig
    ) {
        Object.defineProperty(this._doc, '__sharedDoc', {
            value: this,
            enumerable: false,
            writable: false,
        });
        this._client = client;
        this._static = config.static;
        this._skipInitialLoad = config.skipInitialLoad;
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
        this._currentVersion = {
            currentSite: this._localId.toString(),
            remoteSite: this._remoteId.toString(),
            vector: {},
        };
        this._onVersionUpdated = new BehaviorSubject<CurrentVersion>(
            this._currentVersion
        );
        this._onUpdates = new Subject<string[]>();
    }

    getMap<T = any>(name: string): SharedMap<T> {
        let map = this._maps.get(name);
        if (!map) {
            map = new YjsSharedMap(this._doc.getMap(name));
            this._maps.set(name, map);
        }
        return map;
    }

    getArray<T = any>(name: string): SharedArray<T> {
        let array = this._arrays.get(name);
        if (!array) {
            array = new YjsSharedArray(this._doc.getArray(name));
            this._arrays.set(name, array);
        }
        return array;
    }

    getText(name: string): SharedText {
        let text = this._texts.get(name);
        if (!text) {
            text = new YjsSharedText(this._doc.getText(name));
            this._texts.set(name, text);
        }
        return text;
    }

    createMap<T = any>(): SharedMap<T> {
        return new YjsSharedMap(new YMap<T>());
    }

    createArray<T = any>(): SharedArray<T> {
        return new YjsSharedArray(new YArray<T>());
    }

    async init(): Promise<void> {}

    connect(): void {
        if (!this._temporary && this._persistence?.saveToIndexedDb) {
            console.log('[RemoteYjsPartition] Using IndexedDB persistence');
            const name = `docs/${this._recordName ?? ''}/${this._inst}/${
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

    transact(callback: () => void): void {
        return this._doc.transact(callback);
    }

    getStateUpdate(): InstUpdate {
        const update: InstUpdate = {
            id: 0,
            timestamp: Date.now(),
            update: fromByteArray(encodeStateAsUpdate(this._doc)),
        };
        return update;
    }

    applyStateUpdates(updates: InstUpdate[]): void {
        this._applyUpdates(
            updates.map((u) => u.update),
            APPLY_UPDATES_TO_INST_TRANSACTION_ORIGIN
        );
    }

    // TODO: Possibly support remote events
    // async sendRemoteEvents(events: RemoteActions[]): Promise<void> {
    //     if (this._readOnly || !this._remoteEvents) {
    //         return;
    //     }
    //     for (let event of events) {
    //         if (!supportsRemoteEvent(this._remoteEvents, event)) {
    //             continue;
    //         }

    //         if (event.type === 'remote') {
    //             if (event.event.type === 'get_remotes') {
    //                 // Do nothing for get_remotes since it will be handled by the OtherPlayersPartition.
    //                 // TODO: Make this mechanism more extensible so that we don't have to hardcode for each time
    //                 //       we do this type of logic.
    //             } else if (event.event.type === 'get_remote_count') {
    //                 const action = <GetRemoteCountAction>event.event;
    //                 this._client
    //                     .connectionCount(
    //                         action.recordName,
    //                         action.inst,
    //                         action.branch
    //                     )
    //                     .subscribe({
    //                         next: (count) => {
    //                             this._onEvents.next([
    //                                 asyncResult(event.taskId, count),
    //                             ]);
    //                         },
    //                         error: (err) => {
    //                             this._onEvents.next([
    //                                 asyncError(event.taskId, err),
    //                             ]);
    //                         },
    //                     });
    //             } else if (event.event.type === 'list_inst_updates') {
    //                 const action = <ListInstUpdatesAction>event.event;
    //                 this._client
    //                     .getBranchUpdates(
    //                         this._recordName,
    //                         this._inst,
    //                         this._branch
    //                     )
    //                     .subscribe({
    //                         next: ({ updates, timestamps }) => {
    //                             this._onEvents.next([
    //                                 asyncResult(
    //                                     event.taskId,
    //                                     updates.map((u, i) => ({
    //                                         id: i,
    //                                         update: u,
    //                                         timestamp: timestamps?.[i],
    //                                     }))
    //                                 ),
    //                             ]);
    //                         },
    //                         error: (err) => {
    //                             this._onEvents.next([
    //                                 asyncError(event.taskId, err),
    //                             ]);
    //                         },
    //                     });
    //             } else if (event.event.type === 'get_inst_state_from_updates') {
    //                 const action = <GetInstStateFromUpdatesAction>event.event;
    //                 try {
    //                     let partition = new YjsPartitionImpl({
    //                         type: 'yjs',
    //                     });

    //                     for (let { update } of action.updates) {
    //                         const updateBytes = toByteArray(update);
    //                         applyUpdate(partition.doc, updateBytes);
    //                     }

    //                     this._onEvents.next([
    //                         asyncResult(event.taskId, partition.state, false),
    //                     ]);
    //                 } catch (err) {
    //                     this._onEvents.next([asyncError(event.taskId, err)]);
    //                 }
    //             } else if (
    //                 event.event.type === 'create_initialization_update'
    //             ) {
    //                 const action = <CreateInitializationUpdateAction>(
    //                     event.event
    //                 );
    //                 try {
    //                     let partition = new YjsPartitionImpl({
    //                         type: 'yjs',
    //                     });

    //                     partition.doc.on('update', (update: Uint8Array) => {
    //                         let instUpdate: InstUpdate = {
    //                             id: 0,
    //                             timestamp: Date.now(),
    //                             update: fromByteArray(update),
    //                         };

    //                         this._onEvents.next([
    //                             asyncResult(event.taskId, instUpdate, false),
    //                         ]);
    //                     });

    //                     await partition.applyEvents(
    //                         action.bots.map((b) =>
    //                             botAdded(createBot(b.id, b.tags))
    //                         )
    //                     );
    //                 } catch (err) {
    //                     this._onEvents.next([asyncError(event.taskId, err)]);
    //                 }
    //             } else if (event.event.type === 'apply_updates_to_inst') {
    //                 const action = <ApplyUpdatesToInstAction>event.event;
    //                 try {
    //                     this._applyUpdates(
    //                         action.updates.map((u) => u.update),
    //                         APPLY_UPDATES_TO_INST_TRANSACTION_ORIGIN
    //                     );
    //                     this._onEvents.next([
    //                         asyncResult(event.taskId, null, false),
    //                     ]);
    //                 } catch (err) {
    //                     this._onEvents.next([asyncError(event.taskId, err)]);
    //                 }
    //             } else if (event.event.type === 'get_current_inst_update') {
    //                 const action = <GetCurrentInstUpdateAction>event.event;
    //                 try {
    //                     const update: InstUpdate = {
    //                         id: 0,
    //                         timestamp: Date.now(),
    //                         update: fromByteArray(
    //                             encodeStateAsUpdate(this._doc)
    //                         ),
    //                     };
    //                     this._onEvents.next([
    //                         asyncResult(event.taskId, update, false),
    //                     ]);
    //                 } catch (err) {
    //                     this._onEvents.next([asyncError(event.taskId, err)]);
    //                 }
    //             } else {
    //                 this._client.sendAction(
    //                     this._recordName,
    //                     this._inst,
    //                     this._branch,
    //                     event
    //                 );
    //             }
    //         } else {
    //             this._client.sendAction(
    //                 this._recordName,
    //                 this._inst,
    //                 this._branch,
    //                 event
    //             );
    //         }
    //     }
    // }

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
                            this._handleClientEvent(event);
                        } else if (event.type === 'error') {
                            this._handleClientError(event);
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
                this._onRateLimitExceeded(event);
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

    /**
     * Handles a client error that was received from the server.
     * @param event The event.
     */
    private _handleClientError(event: ClientError) {
        if (event.kind === 'max_size_reached') {
            this._onMaxSizeReached(event);
        } else if (event.kind === 'error') {
            const errorCode = event.info.errorCode;
            if (
                errorCode === 'not_authorized' ||
                errorCode === 'subscription_limit_reached' ||
                errorCode === 'inst_not_found' ||
                errorCode === 'record_not_found' ||
                errorCode === 'invalid_record_key' ||
                errorCode === 'invalid_token' ||
                errorCode === 'unacceptable_connection_id' ||
                errorCode === 'unacceptable_connection_token' ||
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
    }

    /**
     * Handles a client event that was received from the server.
     * @param event The event that was received.
     */
    protected _handleClientEvent(event: ClientEvent) {
        this._onEvents.next([event.action]);
    }

    /**
     * Called when the server sends a rate limit exceeded message.
     * @param event The event that was sent.
     */
    protected _onRateLimitExceeded(event: RateLimitExceededMessage) {
        console.error('[RemoteYjsSharedDocument] Rate limit exceeded!', event);
    }

    /**
     * Called when the server sends a max size reached message.
     * @param event The event that was sent.
     */
    protected _onMaxSizeReached(event: MaxInstSizeReachedClientError) {
        this._onClientError.next(event);
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

    /**
     * Applies the given updates to the YJS document.
     * @param updates The updates to apply.
     * @param transactionOrigin The origin of the transaction.
     */
    protected _applyUpdates(updates: string[], transactionOrigin?: string) {
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
}

function convertEvent(event: YEvent<any>): SharedTypeChanges {
    if (event instanceof YMapEvent) {
        return {
            type: 'map',
            target: (event.target as any).__sharedType as SharedMap<any>,
            changes: event.changes.keys,
        };
    } else if (event instanceof YArrayEvent) {
        return {
            type: 'array',
            target: (event.target as any).__sharedType as SharedArray<any>,
            delta: convertArrayDelta(event.delta),
        };
    } else if (event instanceof YTextEvent) {
        return {
            type: 'text',
            target: (event.target as any).__sharedType as SharedText,
            delta: convertTextDelta(event.delta),
        };
    }
    return null;
}

function convertArrayDelta<T>(
    delta: YArrayEvent<T>['delta']
): SharedArrayDelta<T> {
    let ops: SharedArrayDelta<T> = [];
    for (let op of delta) {
        if (op.insert) {
            ops.push({
                type: 'insert',
                values: op.insert as T[],
            });
        } else if (op.delete) {
            ops.push({
                type: 'delete',
                count: op.delete,
            });
        } else {
            ops.push({
                type: 'preserve',
                count: op.retain,
            });
        }
    }
    return ops;
}

function convertTextDelta<T>(delta: YTextEvent['delta']): SharedTextDelta {
    let ops: SharedTextDelta = [];
    for (let op of delta) {
        if (op.insert) {
            ops.push({
                type: 'insert',
                text: op.insert as string,
                attributes: op.attributes,
            });
        } else if (op.delete) {
            ops.push({
                type: 'delete',
                count: op.delete,
            });
        } else {
            ops.push({
                type: 'preserve',
                count: op.retain,
            });
        }
    }
    return ops;
}

function changesObservable(type: YType<any>): Observable<SharedTypeChanges> {
    return new Observable<SharedTypeChanges>((observer) => {
        const f = (event: YEvent<any>) => {
            observer.next(convertEvent(event));
        };
        type.observe(f);

        return () => {
            // Unsubscribe
            type.unobserve(f);
        };
    });
}

function deepChangesObservable(
    type: YType<any>
): Observable<SharedTypeChanges[]> {
    return new Observable<SharedTypeChanges[]>((observer) => {
        const f = (event: YEvent<any>[]) => {
            observer.next(event.map(convertEvent));
        };
        type.observeDeep(f);

        return () => {
            // Unsubscribe
            type.unobserveDeep(f);
        };
    });
}

export class YjsSharedType<
    TType extends YType<any>,
    TChanges extends SharedTypeChanges
> {
    private _type: TType;
    private _changes: Observable<TChanges>;
    private _deepChanges: Observable<SharedTypeChanges[]>;

    get type() {
        return this._type;
    }

    get doc(): SharedDocument {
        return (this._type.doc as any)?.__sharedDoc as SharedDocument;
    }

    get parent(): SharedType {
        return (this._type.parent as any)?.__sharedType as SharedType;
    }

    get changes(): Observable<TChanges> {
        return this._changes;
    }

    get deepChanges(): Observable<SharedTypeChanges[]> {
        return this._deepChanges;
    }

    constructor(type: TType) {
        this._type = type;
        Object.defineProperty(this._type, '__sharedType', {
            value: this,
            enumerable: false,
            writable: false,
        });
        this._changes = changesObservable(this._type) as Observable<TChanges>;
        this._deepChanges = deepChangesObservable(this._type);
    }
}

export class YjsSharedMap<T>
    extends YjsSharedType<YMap<T>, SharedMapChanges<T>>
    implements SharedMap<T>
{
    constructor(map: YMap<T>);
    constructor(map: Map<string, T>);
    constructor(map: YMap<T> | Map<string, T>) {
        let ymap: YMap<T>;
        if (map instanceof YMap) {
            ymap = map;
        } else {
            ymap = new YMap(map);
        }
        super(ymap);
    }

    get size(): number {
        return this.type.size;
    }

    set(key: string, value: T): void {
        if (value instanceof YjsSharedType) {
            if (value.doc) {
                throw new Error(
                    'Cannot set a top-level map inside another map.'
                );
            }
            value = value.type;
        }
        this.type.set(key, value);
    }

    get(key: string): T {
        const val = this.type.get(key);
        return valueOrSharedType(val);
    }

    delete(key: string): void {
        this.type.delete(key);
    }

    has(key: string): boolean {
        return this.type.has(key);
    }

    clear(): void {
        this.type.clear();
    }

    clone(): SharedMap<T> {
        return new YjsSharedMap(this.type.clone());
    }

    toJSON(): { [key: string]: T } {
        return this.type.toJSON();
    }

    forEach(
        callback: (value: T, key: string, map: SharedMap<T>) => void
    ): void {
        return this.type.forEach((value, key) => callback(value, key, this));
    }

    entries(): IterableIterator<[string, T]> {
        return this.type.entries();
    }
    keys(): IterableIterator<string> {
        return this.type.keys();
    }
    values(): IterableIterator<T> {
        return this.type.values();
    }
    [Symbol.iterator](): IterableIterator<[string, T]> {
        return this.type[Symbol.iterator]();
    }
}

export class YjsSharedArray<T>
    extends YjsSharedType<YArray<T>, SharedArrayChanges<T>>
    implements SharedArray<T>
{
    get length(): number {
        return this.type.length;
    }

    get size(): number {
        return this.type.length;
    }

    constructor(arr: YArray<T>);
    constructor(arr: Array<T>);
    constructor(arr: YArray<T> | Array<T>) {
        let yarray: YArray<T>;
        if (arr instanceof YArray) {
            yarray = arr;
        } else {
            yarray = YArray.from(arr);
        }
        super(yarray);
    }

    insert(index: number, items: T[]): void {
        this.type.insert(index, this._mapItems(items));
    }
    delete(index: number, count: number): void {
        this.type.delete(index, count);
    }
    applyDelta(delta: SharedArrayDelta<T>): void {
        let index = 0;
        for (let op of delta) {
            if (op.type === 'preserve') {
                index += op.count;
            } else if (op.type === 'insert') {
                this.type.insert(index, op.values);
                index += op.values.length;
            } else if (op.type === 'delete') {
                this.type.delete(index, op.count);
            }
        }
    }
    push(...items: T[]): void {
        this.type.push(this._mapItems(items));
    }
    pop(): T | undefined {
        let lastIndex = this.type.length - 1;
        if (lastIndex < 0) {
            return undefined;
        } else {
            const lastItem = this.type.get(lastIndex);
            this.type.delete(lastIndex, 1);
            return lastItem;
        }
    }
    unshift(...items: T[]): void {
        this.type.unshift(this._mapItems(items));
    }
    shift(): T | undefined {
        if (this.type.length <= 0) {
            return undefined;
        } else {
            const firstItem = this.type.get(0);
            this.type.delete(0, 1);
            return firstItem;
        }
    }
    get(index: number): T {
        return valueOrSharedType(this.type.get(index));
    }
    slice(start?: number, end?: number): T[] {
        return this.type.slice(start, end);
    }
    splice(start: number, deleteCount?: number, ...items: T[]): T[] {
        if (this.type.length <= 0) {
            if (items.length > 0) {
                this.push(...items);
            }
            return [];
        }

        const len = this.type.length;
        if (start < -len) {
            start = 0;
        } else if (-len <= start && start < 0) {
            start = len + start;
        } else if (start >= len) {
            start = len;
        }

        if (start >= len) {
            deleteCount = 0;
        } else if (typeof deleteCount === 'undefined') {
            deleteCount = 0;
        } else if (deleteCount >= len - start) {
            deleteCount = len - start;
        } else if (deleteCount < 0) {
            deleteCount = 0;
        }

        let deleted: T[] = [];
        if (deleteCount > 0) {
            deleted = this.type.slice(start, start + deleteCount);
            this.delete(start, deleteCount);
        }

        if (items.length > 0) {
            this.insert(start, items);
        }

        return deleted;
    }

    toArray(): T[] {
        return this.type.toArray();
    }

    toJSON(): T[] {
        return this.type.toJSON();
    }

    forEach(
        callback: (value: T, index: number, array: SharedArray<T>) => void
    ): void {
        this.type.forEach((value, index) => callback(value, index, this));
    }

    map(callback: (value: T, index: number, array: SharedArray<T>) => T): T[] {
        return this.type.map((value, index) => callback(value, index, this));
    }

    filter(
        predicate: (value: T, index: number, array: SharedArray<T>) => boolean
    ): T[] {
        let arr: T[] = [];
        for (let i = 0; i < this.type.length; i++) {
            const val = this.type.get(i);
            if (predicate(val, i, this)) {
                arr.push(val);
            }
        }
        return arr;
    }

    clone(): SharedArray<T> {
        return new YjsSharedArray(this.type.clone());
    }

    [Symbol.iterator](): IterableIterator<T> {
        return this.type[Symbol.iterator]();
    }

    private _mapItems(items: T[]): T[] {
        let containsSharedType = false;
        for (let i of items) {
            if (i instanceof YjsSharedType) {
                if (i.doc) {
                    throw new Error(
                        'Cannot push a top-level array inside another array.'
                    );
                }
                containsSharedType = true;
                break;
            }
        }

        if (containsSharedType) {
            items = items.map((i) => (i instanceof YjsSharedType ? i.type : i));
        }
        return items;
    }
}

export class YjsSharedText implements SharedText {
    private _text: YText;
    private _changes: Observable<SharedTextChanges>;
    private _deepChanges: Observable<SharedTextChanges[]>;

    get doc(): SharedDocument {
        return (this._text.doc as any)?.__sharedDoc as SharedDocument;
    }

    get parent(): SharedType {
        return (this._text.parent as any)?.__sharedType as SharedType;
    }

    get length(): number {
        return this._text.length;
    }

    get size(): number {
        return this._text.length;
    }

    get changes(): Observable<SharedTextChanges> {
        return this._changes;
    }

    get deepChanges(): Observable<SharedTextChanges[]> {
        return this._deepChanges;
    }

    constructor(text: YText);
    constructor(text: string);
    constructor(text: YText | string) {
        if (text instanceof YText) {
            this._text = text;
        } else {
            this._text = new YText(text);
        }
        Object.defineProperty(this._text, '__sharedType', {
            value: this,
            enumerable: false,
            writable: false,
        });
        this._changes = changesObservable(
            this._text
        ) as Observable<SharedTextChanges>;
        this._deepChanges = deepChangesObservable(this._text) as Observable<
            SharedTextChanges[]
        >;
    }

    insert(
        index: number,
        text: string,
        attribtues?: Record<string, any>
    ): void {
        this._text.insert(index, text, attribtues);
    }
    delete(index: number, count: number): void {
        this._text.delete(index, count);
    }
    applyDelta(delta: SharedTextDelta): void {
        let d: YTextEvent['delta'] = [];
        for (let op of delta) {
            if (op.type === 'preserve') {
                d.push({ retain: op.count });
            } else if (op.type === 'insert') {
                d.push({ insert: op.text, attributes: op.attributes });
            } else if (op.type === 'delete') {
                d.push({ delete: op.count });
            }
        }
        this._text.applyDelta(d);
    }
    toDelta(): SharedTextDelta {
        return convertTextDelta(this._text.toDelta());
    }
    encodeRelativePosition(index: number, assoc?: number): RelativePosition {
        return createRelativePositionFromTypeIndex(this._text, index, assoc);
    }

    decodeRelativePosition(position: RelativePosition): number {
        const pos = createAbsolutePositionFromRelativePosition(
            position as any,
            this._text.doc
        );
        return pos.index;
    }

    slice(start?: number, end?: number): string {
        return this._text.toString().slice(start, end);
    }

    toString(): string {
        return this._text.toString();
    }

    toJSON(): string {
        return this._text.toJSON();
    }

    clone(): SharedText {
        return new YjsSharedText(this._text.clone());
    }
}

function valueOrSharedType(val: any) {
    if (val instanceof YType) {
        return (val as any).__sharedType;
    }
    return val;
}
