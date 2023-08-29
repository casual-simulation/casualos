import {
    action,
    BotAction,
    botAdded,
    createBot,
    hasValue,
    isBot,
    ON_WEBHOOK_ACTION_NAME,
    StoredAux,
} from '@casual-simulation/aux-common/bots';
import { YjsPartitionImpl } from '@casual-simulation/aux-common/partitions';
import { WebsocketMessenger } from './WebsocketMessenger';
import {
    device,
    deviceError,
    deviceResult,
    DeviceSelector,
    RemoteAction,
    RemoteActionError,
    RemoteActionResult,
} from '../common/RemoteActions';
import { fromByteArray, toByteArray } from 'base64-js';
import { applyUpdate, mergeUpdates } from 'yjs';
import {
    DeviceConnection,
    WebsocketConnectionStore,
} from './WebsocketConnectionStore';
import { UpdatesStore } from '@casual-simulation/causal-trees/core2';
import {
    AddUpdatesMessage,
    LoginMessage,
    SendActionMessage,
    TimeSyncRequestMessage,
    UploadHttpHeaders,
    WatchBranchMessage,
    WebsocketErrorEvent,
    WebsocketEvent,
    WebsocketEventTypes,
} from './WebsocketEvents';
import { ConnectionInfo } from '../common/ConnectionInfo';
import { AuthController } from '../AuthController';

/**
 * Defines a class that is able to serve causal repos in realtime.
 */
export class WebsocketController {
    private _connectionStore: WebsocketConnectionStore;
    private _messenger: WebsocketMessenger;
    private _updatesStore: UpdatesStore;
    private _auth: AuthController;

    /**
     * Gets or sets the default device selector that should be used
     * for events that are sent without a selector.
     */
    defaultDeviceSelector: DeviceSelector;
    mergeUpdatesOnMaxSizeExceeded: boolean = false;

    get messenger() {
        return this._messenger;
    }

    constructor(
        connectionStore: WebsocketConnectionStore,
        messenger: WebsocketMessenger,
        updatesStore: UpdatesStore,
        auth: AuthController
    ) {
        this._connectionStore = connectionStore;
        this._messenger = messenger;
        this._updatesStore = updatesStore;
        this._auth = auth;
    }

    /**
     * Attempts to log the given connection in.
     * @param connectionId The ID of the connection.
     * @param requestId The ID of the request.
     * @param message The login message.
     */
    async login(
        connectionId: string,
        requestId: number,
        message: LoginMessage
    ): Promise<void> {
        try {
            if (!message.connectionToken) {
                if (!message.clientConnectionId) {
                    await this._messenger.sendEvent(connectionId, [
                        WebsocketEventTypes.Error,
                        requestId,
                        'unacceptable_connection_id',
                        'A connection ID must be specified when logging in without a connection token.',
                    ]);
                    return;
                }

                await this._connectionStore.saveConnection({
                    serverConnectionId: connectionId,
                    clientConnectionId: message.clientConnectionId,
                    userId: null,
                    sessionId: null,
                    token: null,
                });
            } else {
                const validationResult =
                    await this._auth.validateConnectionToken(
                        message.connectionToken
                    );
                if (validationResult.success === false) {
                    await this._messenger.sendEvent(connectionId, [
                        WebsocketEventTypes.Error,
                        requestId,
                        validationResult.errorCode,
                        validationResult.errorMessage,
                    ]);
                    return;
                }

                await this._connectionStore.saveConnection({
                    serverConnectionId: connectionId,
                    userId: validationResult.userId,
                    sessionId: validationResult.sessionId,
                    clientConnectionId: validationResult.connectionId,
                    token: message.connectionToken,
                });
            }

            await this._messenger.sendMessage([connectionId], {
                type: 'login_result',
            });
        } catch (err) {
            console.error(
                '[WebsocketController] [login] Error while logging in.',
                err
            );
            await this.sendError(connectionId, {
                requestId: requestId,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred while logging in.',
            });
        }
    }

    async disconnect(connectionId: string) {
        const loadedConnections = await this._connectionStore.getConnections(
            connectionId
        );
        await this._connectionStore.clearConnection(connectionId);

        for (let connection of loadedConnections) {
            if (isBranchConnection(connection.namespace)) {
                if (connection.temporary) {
                    const count =
                        await this._connectionStore.countConnectionsByNamespace(
                            connection.namespace
                        );

                    if (count <= 0) {
                        // unload namespace
                        await this._updatesStore.clearUpdates(
                            connection.namespace
                        );
                    }
                }

                const branch = branchFromNamespace(connection.namespace);
                const watchingDevices =
                    await this._connectionStore.getConnectionsByNamespace(
                        watchBranchNamespace(branch)
                    );

                await this._messenger.sendMessage(
                    watchingDevices.map((d) => d.serverConnectionId),
                    {
                        type: 'repo/disconnected_from_branch',
                        broadcast: false,
                        branch: branch,
                        connection: connectionInfo(connection),
                    }
                );
            }
        }
    }

    async watchBranch(connectionId: string, event: WatchBranchMessage) {
        if (!event) {
            console.warn(
                '[CasualRepoServer] Trying to watch branch with a null event!'
            );
            return;
        }

        const namespace = branchNamespace(event.branch);
        console.log(
            `[CausalRepoServer] [${namespace}] [${connectionId}] Watch`
        );

        const connection = await this._connectionStore.getConnection(
            connectionId
        );
        if (!connection) {
            throw new Error(
                'Unable to watch_branch. The connection was not found!'
            );
        }
        await this._connectionStore.saveNamespaceConnection({
            ...connection,
            serverConnectionId: connectionId,
            namespace: namespace,
            temporary: event.temporary || false,
        });

        const updates = await this._updatesStore.getUpdates(namespace);
        const watchingDevices =
            await this._connectionStore.getConnectionsByNamespace(
                watchBranchNamespace(event.branch)
            );

        console.log(
            `[CausalRepoServer] [${event.branch}] [${connectionId}] Connected.`
        );
        const promises = [
            this._messenger.sendMessage(
                watchingDevices.map((d) => d.serverConnectionId),
                {
                    type: 'repo/connected_to_branch',
                    broadcast: false,
                    branch: event,
                    connection: connectionInfo(connection),
                }
            ),
            this._messenger.sendMessage([connection.serverConnectionId], {
                type: 'repo/add_updates',
                branch: event.branch,
                updates: updates.updates,
                initial: true,
            }),
        ];
        await Promise.all(promises);
    }

    async unwatchBranch(connectionId: string, branch: string) {
        if (!branch) {
            console.warn(
                '[CasualRepoServer] Trying to unwatch branch with a null event!'
            );
            return;
        }

        const namespace = branchNamespace(branch);
        console.log(
            `[CausalRepoServer] [${namespace}] [${connectionId}] Unwatch`
        );

        const connection = await this._connectionStore.getNamespaceConnection(
            connectionId,
            namespace
        );
        if (connection) {
            await this._connectionStore.deleteNamespaceConnection(
                connectionId,
                namespace
            );
            if (connection.temporary) {
                const count =
                    await this._connectionStore.countConnectionsByNamespace(
                        namespace
                    );
                if (count <= 0) {
                    await this._updatesStore.clearUpdates(connection.namespace);
                }
            }

            const watchingDevices =
                await this._connectionStore.getConnectionsByNamespace(
                    watchBranchNamespace(branch)
                );

            await this._messenger.sendMessage(
                watchingDevices.map((d) => d.serverConnectionId),
                {
                    type: 'repo/disconnected_from_branch',
                    broadcast: false,
                    branch: branch,
                    connection: connectionInfo(connection),
                }
            );
        }
    }

    async addUpdates(connectionId: string, event: AddUpdatesMessage) {
        if (!event) {
            console.warn(
                '[CasualRepoServer] Trying to add atoms with a null event!'
            );
            return;
        }

        const namespace = branchNamespace(event.branch);

        console.log(
            `[CausalRepoServer] [${namespace}] [${connectionId}] Add Updates`
        );

        if (event.updates) {
            let result = await this._updatesStore.addUpdates(
                namespace,
                event.updates
            );

            if (result.success === false) {
                console.log(
                    `[CausalRepoServer] [${namespace}] [${connectionId}] Failed to add updates`,
                    result
                );
                if (result.errorCode === 'max_size_reached') {
                    if (this.mergeUpdatesOnMaxSizeExceeded) {
                        try {
                            console.log(
                                `[CausalRepoServer] [${namespace}] [${connectionId}] Merging branch updates.`
                            );

                            const updates = await this._updatesStore.getUpdates(
                                namespace
                            );
                            const mergedUpdates = mergeUpdates([
                                ...updates.updates.map((u) => toByteArray(u)),
                                ...event.updates.map((u) => toByteArray(u)),
                            ]);
                            result = await this._updatesStore.replaceUpdates(
                                namespace,
                                updates,
                                [fromByteArray(mergedUpdates)]
                            );

                            if (result.success === false) {
                                console.log(
                                    `[CausalRepoServer] [${namespace}] [${connectionId}] Failed to merge branch updates`,
                                    result
                                );
                            }
                        } catch (err) {
                            console.error(
                                '[CausalRepoServer] Unable to merge branch updates!',
                                err
                            );
                        }
                    }

                    if (result.success === false) {
                        if ('updateId' in event) {
                            let { success, branch, ...rest } = result;

                            await this._messenger.sendMessage([connectionId], {
                                type: 'repo/updates_received',
                                branch: event.branch,
                                updateId: event.updateId,
                                ...rest,
                            });
                        }
                        return;
                    }
                }
            }
        }

        const hasUpdates = event.updates && event.updates.length > 0;
        if (hasUpdates) {
            const connectedDevices =
                await this._connectionStore.getConnectionsByNamespace(
                    namespace
                );

            let ret: AddUpdatesMessage = {
                type: 'repo/add_updates',
                branch: event.branch,
                updates: event.updates,
            };

            await this._messenger.sendMessage(
                connectedDevices.map((c) => c.serverConnectionId),
                ret,
                connectionId
            );
        }

        if ('updateId' in event) {
            await this._messenger.sendMessage([connectionId], {
                type: 'repo/updates_received',
                branch: event.branch,
                updateId: event.updateId,
            });
        }
    }

    async sendAction(connectionId: string, event: SendActionMessage) {
        if (!event) {
            console.warn(
                '[CasualRepoServer] Trying to send event with a null event!'
            );
            return;
        }

        const namespace = branchNamespace(event.branch);
        const connectedDevices =
            await this._connectionStore.getConnectionsByNamespace(namespace);

        if (event.action.type === 'remote') {
            const action = event.action.event as BotAction;
        }

        let finalAction: RemoteAction | RemoteActionResult | RemoteActionError;
        if (
            event.action.deviceId ||
            event.action.connectionId ||
            event.action.userId ||
            (typeof event.action.broadcast !== 'undefined' &&
                event.action.broadcast !== null)
        ) {
            finalAction = event.action;
        } else {
            // TODO: Replace with system that selects target devices with better uniformity
            // than Math.random().
            const randomDeviceIndex = Math.min(
                connectedDevices.length - 1,
                Math.max(Math.floor(Math.random() * connectedDevices.length), 0)
            );
            const randomDevice = connectedDevices[randomDeviceIndex];
            if (randomDevice) {
                finalAction = {
                    ...event.action,
                    connectionId: randomDevice.clientConnectionId,
                };
            }
        }

        if (!finalAction) {
            return;
        }

        const currentConnection = await this._connectionStore.getConnection(
            connectionId
        );
        const targetedDevices = connectedDevices.filter((d) =>
            isEventForDevice(finalAction, d)
        );
        const dEvent =
            finalAction.type === 'remote'
                ? device(
                      connectionInfo(currentConnection),
                      finalAction.event,
                      finalAction.taskId
                  )
                : finalAction.type === 'remote_result'
                ? deviceResult(
                      connectionInfo(currentConnection),
                      finalAction.result,
                      finalAction.taskId
                  )
                : deviceError(
                      connectionInfo(currentConnection),
                      finalAction.error,
                      finalAction.taskId
                  );

        await this._messenger.sendMessage(
            targetedDevices.map((c) => c.serverConnectionId),
            {
                type: 'repo/receive_action',
                branch: event.branch,
                action: dEvent,
            }
        );
    }

    async watchBranchDevices(connectionId: string, branch: string) {
        const namespace = watchBranchNamespace(branch);
        console.log(
            `[CausalRepoServer] [${namespace}] [${connectionId}] Watch devices for branch`
        );

        const connection = await this._connectionStore.getConnection(
            connectionId
        );
        if (!connection) {
            throw new Error(
                'Unable to watch_branch_devices. The connection was not found!'
            );
        }
        await this._connectionStore.saveNamespaceConnection({
            ...connection,
            serverConnectionId: connectionId,
            namespace: namespace,
            temporary: true,
        });

        const currentDevices =
            await this._connectionStore.getConnectionsByNamespace(
                branchNamespace(branch)
            );
        const promises = currentDevices.map((device) =>
            this._messenger.sendMessage([connectionId], {
                type: 'repo/connected_to_branch',
                broadcast: false,
                connection: connectionInfo(device),
                branch: {
                    type: 'repo/watch_branch',
                    branch: branch,
                    temporary: device.temporary,
                },
            })
        );

        await Promise.all(promises);
    }

    async unwatchBranchDevices(connectionId: string, branch: string) {
        const namespace = watchBranchNamespace(branch);
        await this._connectionStore.deleteNamespaceConnection(
            connectionId,
            namespace
        );
    }

    async deviceCount(connectionId: string, branch: string | null) {
        const count =
            typeof branch !== 'undefined' && branch !== null
                ? await this._connectionStore.countConnectionsByNamespace(
                      branchNamespace(branch)
                  )
                : await this._connectionStore.countConnections();

        await this._messenger.sendMessage([connectionId], {
            type: 'repo/connection_count',
            branch,
            count: count,
        });
    }

    async getBranchData(branch: string): Promise<StoredAux> {
        const namespace = branchNamespace(branch);
        console.log(`[CausalRepoServer] [${namespace}] Get Data`);

        const updates = await this._updatesStore.getUpdates(namespace);
        const partition = new YjsPartitionImpl({ type: 'yjs' });

        for (let updateBase64 of updates.updates) {
            const update = toByteArray(updateBase64);
            applyUpdate(partition.doc, update);
        }

        return {
            version: 1,
            state: partition.state,
        };
    }

    async getUpdates(connectionId: string, branch: string) {
        if (!branch) {
            console.warn(
                '[CasualRepoServer] Trying to get branch with a null branch!'
            );
            return;
        }

        const connection = await this._connectionStore.getConnection(
            connectionId
        );
        if (!connection) {
            throw new Error(
                'Unable to get_updates. The connection was not found!'
            );
        }

        const namespace = branchNamespace(branch);
        console.log(
            `[CausalRepoServer] [${namespace}] [${connectionId}] Get Updates`
        );

        const updates = await this._updatesStore.getUpdates(namespace);

        this._messenger.sendMessage([connection.serverConnectionId], {
            type: 'repo/add_updates',
            branch: branch,
            updates: updates.updates,
            timestamps: updates.timestamps,
        });
    }

    /**
     * Processes a webhook and returns the status code that should be returned.
     * @param branch The branch that the webhook is for.
     * @param method The HTTP method that was used for the webhook.
     * @param url The URL that was requested.
     * @param headers The headers that were included in the request.
     * @param data The data included in the request.
     */
    async webhook(
        branch: string,
        method: string,
        url: string,
        headers: object,
        data: object
    ): Promise<number> {
        const namespace = branchNamespace(branch);
        const count = await this._updatesStore.countUpdates(namespace);

        if (count <= 0) {
            return 404;
        }

        const connectedDevices =
            await this._connectionStore.getConnectionsByNamespace(namespace);

        if (connectedDevices.some((d) => !d)) {
            return 99;
        }

        if (connectedDevices.length <= 0) {
            return 503;
        }

        // TODO: Replace with system that selects target devices with better uniformity
        // than Math.random().
        const randomDeviceIndex = Math.min(
            connectedDevices.length - 1,
            Math.max(Math.floor(Math.random() * connectedDevices.length), 0)
        );
        const randomDevice = connectedDevices[randomDeviceIndex];

        if (!randomDevice) {
            return 503;
        }

        const a = action(ON_WEBHOOK_ACTION_NAME, null, null, {
            method,
            url,
            headers,
            data,
        });

        await this._messenger.sendMessage([randomDevice.serverConnectionId], {
            type: 'repo/receive_action',
            branch,
            action: a as any,
        });

        return 200;
    }

    async syncTime(
        connectionId: string,
        event: TimeSyncRequestMessage,
        requestTime: number
    ) {
        await this._messenger.sendMessage([connectionId], {
            type: 'sync/time/response',
            id: event.id,
            clientRequestTime: event.clientRequestTime,
            serverReceiveTime: requestTime,
            serverTransmitTime: Date.now(),
        });
    }

    /**
     * Handles when the rate limit has been exceeded by the given connection.
     * @param connectionId The ID of the connection.
     * @param retryAfter The Retry-After header value.
     * @param totalHits The total number of hits by the connection.
     * @param timeMs The current time in unix time in miliseconds.
     */
    async rateLimitExceeded(
        connectionId: string,
        retryAfter: number,
        totalHits: number,
        timeMs: number
    ): Promise<void> {
        const lastHit =
            (await this._connectionStore.getConnectionRateLimitExceededTime(
                connectionId
            )) ?? -Infinity;
        const difference = timeMs - lastHit;
        await this._connectionStore.setConnectionRateLimitExceededTime(
            connectionId,
            timeMs
        );

        if (difference >= 1000) {
            await this._messenger.sendMessage([connectionId], {
                type: 'rate_limit_exceeded',
                retryAfter,
                totalHits,
            });
        }
    }

    /**
     * Processes the given upload request.
     * @param connectionId The ID of the connection that is requesting the upload.
     * @param requestId The ID of the request.
     */
    async uploadRequest(
        connectionId: string,
        requestId: number
    ): Promise<void> {
        try {
            const result = await this._messenger.presignMessageUpload();
            if (result.success === false) {
                console.log(
                    `[WebsocketController] [uploadRequest] Upload requests are not supported!`
                );
                await this.sendError(connectionId, {
                    requestId,
                    errorCode: 'not_supported',
                    errorMessage: 'Upload requests are not supported.',
                });
                return;
            }

            await this.sendEvent(connectionId, [
                WebsocketEventTypes.UploadResponse,
                requestId,
                result.uploadUrl,
                result.uploadMethod,
                result.uploadHeaders,
            ]);
        } catch (err) {
            console.error(
                '[WebsocketController] [uploadRequest] Error while processing upload request.',
                err
            );
            await this.sendError(connectionId, {
                requestId,
                errorCode: 'server_error',
                errorMessage: 'Error while processing upload request.',
            });
        }
    }

    async downloadRequest(
        connectionId: string,
        requestId: number,
        url: string,
        method: string,
        headers: UploadHttpHeaders
    ): Promise<DownloadRequestResult> {
        try {
            const message = await this._messenger.downloadMessage(
                url,
                method,
                headers
            );
            if (message === undefined) {
                console.log(
                    `[WebsocketController] [downloadRequest] Download requests are not supported!`
                );
                return {
                    success: false,
                    requestId,
                    errorCode: 'not_supported',
                    errorMessage: 'Download requests are not supported.',
                };
            } else if (message === null) {
                return {
                    success: false,
                    requestId,
                    errorCode: 'message_not_found',
                    errorMessage: 'Message not found.',
                };
            } else {
                return {
                    success: true,
                    requestId,
                    message,
                };
            }
        } catch (err) {
            console.error(
                '[WebsocketController] [downloadRequest] Error while processing download request.',
                err
            );
            return {
                success: false,
                requestId,
                errorCode: 'server_error',
                errorMessage: 'Error while processing download request.',
            };
        }
    }

    async sendError(connectionId: string, error: WebsocketControllerError) {
        await this.sendEvent(connectionId, [
            WebsocketEventTypes.Error,
            error.requestId,
            error.errorCode,
            error.errorMessage,
        ]);
    }

    async sendEvent(connectionId: string, event: WebsocketEvent) {
        await this._messenger.sendEvent(connectionId, event);
    }
}

export function connectionInfo(device: DeviceConnection): ConnectionInfo {
    return {
        connectionId: device.clientConnectionId,
        sessionId: device.sessionId,
        userId: device.userId,
    };
}

/**
 * Determines if the given event targets the given device connection.
 * @param event The event to check.
 * @param device The device to check.
 */
export function isEventForDevice(
    event: DeviceSelector,
    device: DeviceConnection
): boolean {
    if (event.broadcast === true) {
        return true;
    }
    if (event.userId === device.userId) {
        return true;
    } else if (event.connectionId === device.clientConnectionId) {
        return true;
    } else if (event.deviceId === device.userId) {
        return true;
    }
    return false;
}

/**
 * Gets the namespace that the given branch should use.
 * @param branch The branch.
 */
export function branchNamespace(branch: string) {
    return `/branch/${branch}`;
}

/**
 * Gets the namespace that should be used for watching devices connected to branches.
 * @param branch The branch to watch.
 */
export function watchBranchNamespace(branch: string) {
    return `/watched_branch/${branch}`;
}

export function branchFromNamespace(namespace: string) {
    return namespace.slice('/branch/'.length);
}

export function isBranchConnection(namespace: string) {
    return namespace.startsWith('/branch/');
}

export type DownloadRequestResult =
    | DownloadRequestSuccess
    | DownloadRequestFailure;

export interface DownloadRequestSuccess {
    success: true;
    requestId: number;
    message: string;
}

export interface DownloadRequestFailure extends WebsocketControllerError {
    success: false;
}

export interface WebsocketControllerError {
    requestId: number;
    errorCode: WebsocketErrorEvent[2];
    errorMessage: string;
}
