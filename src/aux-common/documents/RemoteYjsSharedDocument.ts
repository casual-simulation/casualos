import {
    BehaviorSubject,
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
import { InstRecordsClient } from '../websockets';
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

const APPLY_UPDATES_TO_INST_TRANSACTION_ORIGIN = '__apply_updates_to_inst';

export class RemoteYjsSharedDocument implements SharedDocument {
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
    private _client: InstRecordsClient;
    private _currentVersion: CurrentVersion;

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
    private _remoteEvents: boolean;
    private _authSource: PartitionAuthSource;
    private _indexeddb: YjsIndexedDBPersistence;
    private _persistence: SharedDocumentConfig['localPersistence'];

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

    private get _remoteSite() {
        return this._remoteId.toString();
    }

    private get _currentSite() {
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
        // this.private = config.private || false;
        this._client = client;
        this._static = config.static;
        this._skipInitialLoad = config.skipInitialLoad;
        this._remoteEvents = true; // 'remoteEvents' in config ? config.remoteEvents : true;
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
        return new YjsSharedMap(this._doc.getMap(name));
    }

    getArray<T = any>(name: string): SharedArray<T> {
        return new YjsSharedArray(this._doc.getArray(name));
    }

    getText(name: string): SharedText {
        return new YjsSharedText(this._doc.getText(name));
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

    // async enableCollaboration() {
    //     this._static = false;
    //     this._skipInitialLoad = false;
    //     this._sendInitialUpdates = true;
    //     this._synced = false;
    //     const promise = firstValueFrom(
    //         this._onStatusUpdated.pipe(
    //             filter((u) => u.type === 'sync' && u.synced)
    //         )
    //     );
    //     this._watchBranch();
    //     await promise;
    // }

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
                            this._onEvents.next([event.action]);
                        } else if (event.type === 'error') {
                            if (event.kind === 'max_size_reached') {
                                if (!this._emittedMaxSizeReached) {
                                    console.log(
                                        '[RemoteYjsSharedDocument] Max size reached!',
                                        this.recordName,
                                        this.address
                                    );
                                    this._emittedMaxSizeReached = true;
                                    // TODO: Emit max size reached
                                    // this._onEvents.next([
                                    //     action(
                                    //         ON_SPACE_MAX_SIZE_REACHED,
                                    //         null,
                                    //         null,
                                    //         {
                                    //             space: this.space,
                                    //             maxSizeInBytes:
                                    //                 event.maxBranchSizeInBytes,
                                    //             neededSizeInBytes:
                                    //                 event.neededBranchSizeInBytes,
                                    //         }
                                    //     ),
                                    // ]);
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
                    '[RemoteYjsSharedDocument] Rate limit exceeded!',
                    event
                );
                //TODO: Emit rate limit exceeded
                // this._onEvents.next([
                //     action(
                //         ON_SPACE_RATE_LIMIT_EXCEEDED_ACTION_NAME,
                //         null,
                //         null,
                //         {
                //             space: this.space,
                //         }
                //     ),
                // ]);
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

export class YjsSharedMap<T> implements SharedMap<T> {
    private _map: YMap<T>;
    private _changes: Observable<SharedMapChanges<T>>;
    private _deepChanges: Observable<SharedTypeChanges[]>;

    get doc(): SharedDocument {
        return (this._map.doc as any)?.__sharedDoc as SharedDocument;
    }

    get parent(): SharedType {
        return (this._map.parent as any)?.__sharedType as SharedType;
    }

    get changes(): Observable<SharedMapChanges<T>> {
        return this._changes;
    }

    get deepChanges(): Observable<SharedTypeChanges[]> {
        return this._deepChanges;
    }

    constructor(map: YMap<T>);
    constructor(map: Map<string, T>);
    constructor(map: YMap<T> | Map<string, T>) {
        if (map instanceof YMap) {
            this._map = map;
        } else {
            this._map = new YMap(map);
        }
        Object.defineProperty(this._map, '__sharedType', {
            value: this,
            enumerable: false,
            writable: false,
        });
        this._changes = changesObservable(this._map) as Observable<
            SharedMapChanges<T>
        >;
        this._deepChanges = deepChangesObservable(this._map);
    }

    get size(): number {
        return this._map.size;
    }

    set(key: string, value: T): void {
        this._map.set(key, value);
    }

    get(key: string): T {
        return this._map.get(key);
    }

    delete(key: string): void {
        this._map.delete(key);
    }

    has(key: string): boolean {
        return this._map.has(key);
    }

    clear(): void {
        this._map.clear();
    }

    clone(): SharedMap<T> {
        return new YjsSharedMap(this._map.clone());
    }

    toJSON(): { [key: string]: T } {
        return this._map.toJSON();
    }

    forEach(
        callback: (value: T, key: string, map: SharedMap<T>) => void
    ): void {
        return this._map.forEach((value, key) => callback(value, key, this));
    }

    entries(): IterableIterator<[string, T]> {
        return this._map.entries();
    }
    keys(): IterableIterator<string> {
        return this._map.keys();
    }
    values(): IterableIterator<T> {
        return this._map.values();
    }
    [Symbol.iterator](): IterableIterator<[string, T]> {
        return this._map[Symbol.iterator]();
    }
}

export class YjsSharedArray<T> implements SharedArray<T> {
    private _arr: YArray<T>;
    private _changes: Observable<SharedArrayChanges<T>>;
    private _deepChanges: Observable<SharedTypeChanges[]>;

    get doc(): SharedDocument {
        return (this._arr.doc as any)?.__sharedDoc as SharedDocument;
    }

    get parent(): SharedType {
        return (this._arr.parent as any)?.__sharedType as SharedType;
    }

    get length(): number {
        return this._arr.length;
    }

    get size(): number {
        return this._arr.length;
    }

    get changes(): Observable<SharedArrayChanges<T>> {
        return this._changes;
    }

    get deepChanges(): Observable<SharedTypeChanges[]> {
        return this._deepChanges;
    }

    constructor(arr: YArray<T>);
    constructor(arr: Array<T>);
    constructor(arr: YArray<T> | Array<T>) {
        if (arr instanceof YArray) {
            this._arr = arr;
        } else {
            this._arr = YArray.from(arr);
        }
        Object.defineProperty(this._arr, '__sharedType', {
            value: this,
            enumerable: false,
            writable: false,
        });
        this._changes = changesObservable(this._arr) as Observable<
            SharedArrayChanges<T>
        >;
        this._deepChanges = deepChangesObservable(this._arr);
    }

    insert(index: number, items: T[]): void {
        this._arr.insert(index, items);
    }
    delete(index: number, count: number): void {
        this._arr.delete(index, count);
    }
    applyDelta(delta: SharedArrayDelta<T>): void {
        let index = 0;
        for (let op of delta) {
            if (op.type === 'preserve') {
                index += op.count;
            } else if (op.type === 'insert') {
                this._arr.insert(index, op.values);
                index += op.values.length;
            } else if (op.type === 'delete') {
                this._arr.delete(index, op.count);
            }
        }
    }
    push(items: T[]): void {
        this._arr.push(items);
    }
    unshift(items: T[]): void {
        this._arr.unshift(items);
    }
    get(index: number): T {
        return this._arr.get(index);
    }
    slice(start?: number, end?: number): T[] {
        return this._arr.slice(start, end);
    }

    toArray(): T[] {
        return this._arr.toArray();
    }

    toJSON(): T[] {
        return this._arr.toJSON();
    }

    forEach(
        callback: (value: T, index: number, array: SharedArray<T>) => void
    ): void {
        this._arr.forEach((value, index) => callback(value, index, this));
    }

    map(callback: (value: T, index: number, array: SharedArray<T>) => T): T[] {
        return this._arr.map((value, index) => callback(value, index, this));
    }

    filter(
        predicate: (value: T, index: number, array: SharedArray<T>) => boolean
    ): T[] {
        let arr: T[] = [];
        for (let i = 0; i < this._arr.length; i++) {
            const val = this._arr.get(i);
            if (predicate(val, i, this)) {
                arr.push(val);
            }
        }
        return arr;
    }

    clone(): SharedArray<T> {
        return new YjsSharedArray(this._arr.clone());
    }

    [Symbol.iterator](): IterableIterator<T> {
        return this._arr[Symbol.iterator]();
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
