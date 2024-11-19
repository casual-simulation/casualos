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
    WebsocketErrorInfo,
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
import {
    YjsSharedDocument,
    APPLY_UPDATES_TO_INST_TRANSACTION_ORIGIN,
} from './YjsSharedDocument';
import { SharedDocumentServices } from './SharedDocumentFactories';
import { KnownErrorCodes } from '../rpc/ErrorCodes';

export function createRemoteClientYjsSharedDocument(
    config: SharedDocumentConfig,
    services: SharedDocumentServices,
    client: InstRecordsClient
) {
    if (!config.inst) {
        return null;
    }
    return new RemoteYjsSharedDocument(client, services.authSource, config);
}

/**
 * Defines a shared document that is able to use YJS and a InstRecordsClient to synchronize over the network.
 */
export class RemoteYjsSharedDocument
    extends YjsSharedDocument
    implements SharedDocument
{
    protected _static: boolean;
    protected _skipInitialLoad: boolean;
    protected _sendInitialUpdates: boolean = false;
    protected _watchingBranch: any;
    protected _synced: boolean;
    protected _authorized: boolean;
    protected _temporary: boolean;
    protected _readOnly: boolean;
    protected _authSource: PartitionAuthSource;

    unsubscribe(): void {
        this._sub.unsubscribe();
    }

    constructor(
        client: InstRecordsClient,
        authSource: PartitionAuthSource,
        config: SharedDocumentConfig
    ) {
        super(config);
        this._recordName = config.recordName;
        this._inst = config.inst;
        this._branch = config.branch;
        this._client = client;
        this._authSource = authSource;
        this._static = config.static;
        this._skipInitialLoad = config.skipInitialLoad;
        this._temporary = config.temporary;
        this._persistence = config.localPersistence;
        this._synced = false;
        this._authorized = false;

        // static implies read only
        this._readOnly = config.readOnly || this._static || false;
    }

    connect(): void {
        if (!this._temporary && this._persistence?.saveToIndexedDb) {
            console.log(
                '[RemoteYjsSharedDocument] Using IndexedDB persistence'
            );
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
                                if (this._isNotAuthorizedErrorCode(errorCode)) {
                                    const { type, ...error } = event;
                                    this._handleNotAuthorized(error);
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
            const error = event.info;
            if (this._isNotAuthorizedErrorCode(error.errorCode)) {
                this._handleNotAuthorized(error);
            }
        }
    }

    private _isNotAuthorizedErrorCode(errorCode: KnownErrorCodes): boolean {
        return (
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
        );
    }

    private _handleNotAuthorized(error: WebsocketErrorInfo) {
        this._onStatusUpdated.next({
            type: 'authorization',
            authorized: false,
            error: error,
        });
        this._authSource.sendAuthRequest({
            type: 'request',
            kind: 'not_authorized',
            errorCode: error.errorCode,
            errorMessage: error.errorMessage,
            origin: this._client.connection.origin,
            reason: error.reason,
            resource: {
                type: 'inst',
                recordName: this._recordName,
                inst: this._inst,
                branch: this._branch,
            },
        });
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
}
