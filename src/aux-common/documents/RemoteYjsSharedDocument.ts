/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import { filter, firstValueFrom, Subscription } from 'rxjs';
import type { SharedDocument } from './SharedDocument';

import type { Doc, Transaction } from 'yjs';
import { encodeStateAsUpdate } from 'yjs';
import type {
    ClientError,
    ClientEvent,
    InstRecordsClient,
    MaxInstSizeReachedClientError,
    RateLimitExceededMessage,
    WebsocketErrorInfo,
} from '../websockets';
import type { SharedDocumentConfig } from './SharedDocumentConfig';
import type { PartitionAuthSource } from '../partitions/PartitionAuthSource';
import { YjsIndexedDBPersistence } from '../yjs/YjsIndexedDBPersistence';
import { fromByteArray } from 'base64-js';
import { getConnectionId } from '../common';
import {
    YjsSharedDocument,
    APPLY_UPDATES_TO_INST_TRANSACTION_ORIGIN,
} from './YjsSharedDocument';
import type { SharedDocumentServices } from './SharedDocumentFactories';
import type { KnownErrorCodes } from '../rpc/ErrorCodes';

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
    /**
     * Whether the document is static.
     * Static documents are read-only and only load the initial state once.
     */
    protected _static: boolean;

    /**
     * Whether the document should skip the initial load.
     */
    protected _skipInitialLoad: boolean;

    /**
     * Whether the document should send initial updates to the server.
     */
    protected _sendInitialUpdates: boolean = false;

    /**
     * Whether the document has started watching the branch.
     */
    protected _watchingBranch: boolean;

    /**
     * Whether the document is connected and synced.
     */
    protected _synced: boolean;

    /**
     * Whether the document has sent a successful "authorization" status update.
     */
    protected _authorized: boolean;

    /**
     * Whether the document is temporary.
     */
    protected _temporary: boolean;

    /**
     * Whether the shared document is read-only.
     * That is, if it can be modified by clients.
     */
    protected _readOnly: boolean;

    /**
     * The authentication source that provides authentication information to the document.
     */
    protected _authSource: PartitionAuthSource;

    /**
     * The markers that should be set on the branch.
     */
    protected _markers: string[];

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
        this._markers = config.markers;
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
                    markers: this._markers,
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
        queueMicrotask(() => {
            this._onStatusUpdated.next({
                type: 'sync',
                synced: synced,
            });
        });
    }
}
