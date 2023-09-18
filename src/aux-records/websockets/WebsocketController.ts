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
} from '@casual-simulation/aux-common/common/RemoteActions';
import { fromByteArray, toByteArray } from 'base64-js';
import { applyUpdate, mergeUpdates } from 'yjs';
import {
    DeviceConnection,
    WebsocketConnectionStore,
} from './WebsocketConnectionStore';
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
} from '@casual-simulation/aux-common/websockets/WebsocketEvents';
import { ConnectionInfo } from '@casual-simulation/aux-common/common/ConnectionInfo';
import { AuthController } from '../AuthController';
import {
    CurrentUpdates,
    InstRecord,
    InstRecordsStore,
} from './InstRecordsStore';
import {
    BranchName,
    TemporaryInstRecordsStore,
} from './TemporaryInstRecordsStore';
import { sumBy } from 'lodash';
import { PUBLIC_READ_MARKER, PUBLIC_WRITE_MARKER } from '../PolicyPermissions';
import { ZodIssue } from 'zod';
import { SplitInstRecordsStore } from './SplitInstRecordsStore';
import { v4 as uuid } from 'uuid';

/**
 * Defines a class that is able to serve causal repos in realtime.
 */
export class WebsocketController {
    private _connectionStore: WebsocketConnectionStore;
    private _messenger: WebsocketMessenger;
    private _instStore: InstRecordsStore;
    private _temporaryStore: TemporaryInstRecordsStore;
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
        instStore: InstRecordsStore,
        temporaryInstStore: TemporaryInstRecordsStore,
        auth: AuthController
    ) {
        this._connectionStore = connectionStore;
        this._messenger = messenger;
        this._instStore = instStore;
        this._temporaryStore = temporaryInstStore;
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
            let userId: string | null = null;
            let sessionId: string | null = null;
            let clientConnectionId: string | null;
            if (!message.connectionToken) {
                if (!message.connectionId) {
                    await this._messenger.sendEvent(connectionId, [
                        WebsocketEventTypes.Error,
                        requestId,
                        'unacceptable_connection_id',
                        'A connection ID must be specified when logging in without a connection token.',
                        null,
                    ]);
                    return;
                }

                await this._connectionStore.saveConnection({
                    serverConnectionId: connectionId,
                    clientConnectionId: message.connectionId,
                    userId: null,
                    sessionId: null,
                    token: null,
                });
                clientConnectionId = message.connectionId;
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
                        undefined,
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
                userId = validationResult.userId;
                sessionId = validationResult.sessionId;
                clientConnectionId = validationResult.connectionId;
            }

            await this._messenger.sendMessage([connectionId], {
                type: 'login_result',
                info: {
                    userId,
                    sessionId,
                    connectionId: clientConnectionId,
                },
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
            if (connection.mode === 'branch') {
                if (connection.temporary) {
                    const count =
                        await this._connectionStore.countConnectionsByBranch(
                            connection.mode,
                            connection.recordName,
                            connection.inst,
                            connection.branch
                        );

                    if (count <= 0) {
                        const branch = await this._instStore.getBranchByName(
                            connection.recordName,
                            connection.inst,
                            connection.branch
                        );

                        if (branch.temporary) {
                            await this._temporaryStore.deleteBranch(
                                connection.recordName,
                                connection.inst,
                                connection.branch
                            );
                            await this._instStore.deleteBranch(
                                connection.recordName,
                                connection.inst,
                                connection.branch
                            );
                        }
                    }
                }

                const watchingDevices =
                    await this._connectionStore.getConnectionsByBranch(
                        'watch_branch',
                        connection.recordName,
                        connection.inst,
                        connection.branch
                    );

                await this._messenger.sendMessage(
                    watchingDevices.map((d) => d.serverConnectionId),
                    {
                        type: 'repo/disconnected_from_branch',
                        broadcast: false,
                        recordName: connection.recordName,
                        inst: connection.inst,
                        branch: connection.branch,
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

        console.log(
            `[CausalRepoServer] [namespace: ${event.recordName}/${event.inst}/${event.branch}, ${connectionId}] Watch`
        );

        const connection = await this._connectionStore.getConnection(
            connectionId
        );
        if (!connection) {
            throw new Error(
                'Unable to watch_branch. The connection was not found!'
            );
        }
        await this._connectionStore.saveBranchConnection({
            ...connection,
            serverConnectionId: connectionId,
            mode: 'branch',
            recordName: event.recordName,
            inst: event.inst,
            branch: event.branch,
            temporary: event.temporary || false,
        });

        const inst: InstRecord | null = await this._getOrCreateInst(
            event.recordName,
            event.inst
        );
        const branch = await this._getOrCreateBranch(
            event.recordName,
            event.inst,
            event.branch,
            event.temporary,
            inst
        );

        let updates: CurrentUpdates;
        if (branch.temporary) {
            // Temporary branches use a temporary inst data store.
            // This is because temporary branches are never persisted to disk.
            updates = await this._temporaryStore.getUpdates(
                event.recordName,
                event.inst,
                event.branch
            );
        } else {
            updates = await this._instStore.getCurrentUpdates(
                event.recordName,
                event.inst,
                event.branch
            );
        }

        if (!updates) {
            // branch info exists, but no updates for them exist yet.
            updates = {
                updates: [],
                timestamps: [],
                instSizeInBytes: 0,
            };
        }

        const watchingDevices =
            await this._connectionStore.getConnectionsByBranch(
                'watch_branch',
                event.recordName,
                event.inst,
                event.branch
            );

        console.log(
            `[CausalRepoServer] [namespace: ${event.recordName}/${event.inst}/${event.branch}, ${connectionId}] Connected.`
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
                recordName: event.recordName,
                inst: event.inst,
                branch: event.branch,
                updates: updates.updates,
                initial: true,
            }),
        ];
        await Promise.all(promises);
    }

    private async _getOrCreateInst(
        recordName: string | null,
        instName: string
    ) {
        let inst: InstRecord | null = null;
        if (recordName) {
            let inst = await this._instStore.getInstByName(
                recordName,
                instName
            );
            if (!inst) {
                // Create the inst
                inst = {
                    recordName: recordName,
                    inst: instName,

                    // TODO: Choose a better default marker for auto-created insts
                    markers: [PUBLIC_WRITE_MARKER],
                };
                await this._instStore.saveInst(inst);
            }
        }

        return inst;
    }

    private async _getOrCreateBranch(
        recordName: string,
        inst: string,
        branch: string,
        temporary: boolean,
        linkedInst: InstRecord
    ) {
        let b = await this._instStore.getBranchByName(recordName, inst, branch);
        if (!b) {
            if (temporary) {
                // Save the branch to the temp store
                await this._temporaryStore.saveBranchInfo({
                    recordName: recordName,
                    inst: inst,
                    branch: branch,
                    temporary: true,
                    linkedInst: linkedInst,
                });
            }
            // Save the branch to the inst store
            await this._instStore.saveBranch({
                branch: branch,
                inst: inst,
                recordName: recordName,
                temporary: temporary || false,
            });
            b = await this._instStore.getBranchByName(recordName, inst, branch);
        }

        return b;
    }

    async unwatchBranch(
        connectionId: string,
        recordName: string | null,
        inst: string,
        branch: string
    ) {
        if (!branch) {
            console.warn(
                '[CasualRepoServer] Trying to unwatch branch with a null event!'
            );
            return;
        }

        console.log(
            `[CausalRepoServer] [namespace: ${recordName}/${inst}/${branch}, ${connectionId}] Unwatch`
        );

        const connection = await this._connectionStore.getBranchConnection(
            connectionId,
            'branch',
            recordName,
            inst,
            branch
        );
        if (connection) {
            await this._connectionStore.deleteBranchConnection(
                connectionId,
                'branch',
                recordName,
                inst,
                branch
            );
            if (connection.temporary) {
                const count =
                    await this._connectionStore.countConnectionsByBranch(
                        'branch',
                        recordName,
                        inst,
                        branch
                    );
                if (count <= 0) {
                    const branch = await this._instStore.getBranchByName(
                        connection.recordName,
                        connection.inst,
                        connection.branch
                    );

                    if (branch.temporary) {
                        await this._temporaryStore.deleteBranch(
                            connection.recordName,
                            connection.inst,
                            connection.branch
                        );
                        await this._instStore.deleteBranch(
                            connection.recordName,
                            connection.inst,
                            connection.branch
                        );
                    }
                }
            }

            const watchingDevices =
                await this._connectionStore.getConnectionsByBranch(
                    'watch_branch',
                    recordName,
                    inst,
                    branch
                );

            await this._messenger.sendMessage(
                watchingDevices.map((d) => d.serverConnectionId),
                {
                    type: 'repo/disconnected_from_branch',
                    broadcast: false,
                    recordName,
                    inst,
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

        console.log(
            `[CausalRepoServer] [namespace: ${event.recordName}/${event.inst}/${event.branch}, connectionId: ${connectionId}] Add Updates`
        );

        if (event.updates) {
            let branch = await this._instStore.getBranchByName(
                event.recordName,
                event.inst,
                event.branch
            );

            if (!branch) {
                console.log(
                    `[CausalRepoServer] [namespace: ${event.recordName}/${event.inst}/${event.branch}, connectionId: ${connectionId}]  Branch not found!`
                );

                await this._getOrCreateInst(event.recordName, event.inst);
                await this._instStore.saveBranch({
                    branch: event.branch,
                    inst: event.inst,
                    recordName: event.recordName,
                    temporary: false,
                });
                branch = await this._instStore.getBranchByName(
                    event.recordName,
                    event.inst,
                    event.branch
                );
            }

            if (branch.temporary) {
                // Temporary branches use a temporary inst data store.
                // This is because temporary branches are never persisted to disk.
                await this._temporaryStore.addUpdates(
                    event.recordName,
                    event.inst,
                    event.branch,
                    event.updates,
                    sumBy(event.updates, (u) => u.length)
                );
            } else {
                const result = await this._instStore.addUpdates(
                    event.recordName,
                    event.inst,
                    event.branch,
                    event.updates,
                    sumBy(event.updates, (u) => u.length)
                );

                if (result.success === false) {
                    console.log(
                        `[CausalRepoServer] [namespace: ${event.recordName}/${event.inst}/${event.branch}, connectionId: ${connectionId}]  Failed to add updates`,
                        result
                    );
                    if (result.errorCode === 'max_size_reached') {
                        if (result.success === false) {
                            if ('updateId' in event) {
                                let { success, branch, ...rest } = result;

                                await this._messenger.sendMessage(
                                    [connectionId],
                                    {
                                        type: 'repo/updates_received',
                                        recordName: event.recordName,
                                        inst: event.inst,
                                        branch: event.branch,
                                        updateId: event.updateId,
                                        ...rest,
                                    }
                                );
                            }
                            return;
                        }
                    }
                } else {
                    if (
                        event.recordName &&
                        this._instStore instanceof SplitInstRecordsStore
                    ) {
                        this._instStore.temp.markBranchAsDirty({
                            recordName: event.recordName,
                            inst: event.inst,
                            branch: event.branch,
                        });
                    }
                }
            }
        }

        const hasUpdates = event.updates && event.updates.length > 0;
        if (hasUpdates) {
            const connectedDevices =
                await this._connectionStore.getConnectionsByBranch(
                    'branch',
                    event.recordName,
                    event.inst,
                    event.branch
                );

            let ret: AddUpdatesMessage = {
                type: 'repo/add_updates',
                recordName: event.recordName,
                inst: event.inst,
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
                recordName: event.recordName,
                inst: event.inst,
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

        // const namespace = branchNamespace(event.recordName, event.inst, event.branch);
        const connectedDevices =
            await this._connectionStore.getConnectionsByBranch(
                'branch',
                event.recordName,
                event.inst,
                event.branch
            );

        if (event.action.type === 'remote') {
            const action = event.action.event as BotAction;
        }

        let finalAction: RemoteAction | RemoteActionResult | RemoteActionError;
        if (
            event.action.sessionId ||
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
                recordName: event.recordName,
                inst: event.inst,
                branch: event.branch,
                action: dEvent,
            }
        );
    }

    async watchBranchDevices(
        connectionId: string,
        recordName: string | null,
        inst: string,
        branch: string
    ) {
        console.log(
            `[CausalRepoServer] [namespace: ${recordName}/${inst}/${branch}, connectionId: ${connectionId}] Watch devices for branch`
        );

        const connection = await this._connectionStore.getConnection(
            connectionId
        );
        if (!connection) {
            throw new Error(
                'Unable to watch_branch_devices. The connection was not found!'
            );
        }
        await this._connectionStore.saveBranchConnection({
            ...connection,
            mode: 'watch_branch',
            serverConnectionId: connectionId,
            recordName,
            inst,
            branch,
            temporary: true,
        });

        const currentDevices =
            await this._connectionStore.getConnectionsByBranch(
                'branch',
                recordName,
                inst,
                branch
            );
        const promises = currentDevices.map((device) =>
            this._messenger.sendMessage([connectionId], {
                type: 'repo/connected_to_branch',
                broadcast: false,
                connection: connectionInfo(device),
                branch: {
                    type: 'repo/watch_branch',
                    recordName: recordName,
                    inst: inst,
                    branch: branch,
                    temporary: device.temporary,
                },
            })
        );

        await Promise.all(promises);
    }

    async unwatchBranchDevices(
        connectionId: string,
        recordName: string | null,
        inst: string,
        branch: string
    ) {
        await this._connectionStore.deleteBranchConnection(
            connectionId,
            'watch_branch',
            recordName,
            inst,
            branch
        );
    }

    async deviceCount(
        connectionId: string,
        recordName: string | null,
        inst: string | null,
        branch: string | null
    ) {
        const count =
            typeof branch !== 'undefined' && branch !== null
                ? await this._connectionStore.countConnectionsByBranch(
                      'branch',
                      recordName,
                      inst,
                      branch
                  )
                : await this._connectionStore.countConnections();

        await this._messenger.sendMessage([connectionId], {
            type: 'repo/connection_count',
            recordName,
            inst,
            branch,
            count: count,
        });
    }

    async getBranchData(
        recordName: string | null,
        inst: string,
        branch: string
    ): Promise<StoredAux> {
        console.log(
            `[CausalRepoServer] [namespace: ${recordName}/${inst}/${branch}] Get Data`
        );

        const updates = (await this._instStore.getCurrentUpdates(
            recordName,
            inst,
            branch
        )) ?? {
            updates: [],
            timestamps: [],
            instSizeInBytes: 0,
        };
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

    async getUpdates(
        connectionId: string,
        recordName: string | null,
        inst: string,
        branch: string
    ) {
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

        // const namespace = branchNamespace(recordName, inst, branch);
        console.log(
            `[CausalRepoServer] [namespace: ${recordName}/${inst}/${branch}, connectionId: ${connectionId}] Get Updates`
        );

        const updates = (await this._instStore.getAllUpdates(
            recordName,
            inst,
            branch
        )) ?? {
            updates: [],
            timestamps: [],
        };

        this._messenger.sendMessage([connection.serverConnectionId], {
            type: 'repo/add_updates',
            recordName,
            inst,
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
        recordName: string | null,
        inst: string,
        branch: string,
        method: string,
        url: string,
        headers: object,
        data: object
    ): Promise<number> {
        // const namespace = branchNamespace(recordName, inst, branch);
        const b = await this._instStore.getBranchByName(
            recordName,
            inst,
            branch
        );

        if (!b) {
            return 404;
        }

        const connectedDevices =
            await this._connectionStore.getConnectionsByBranch(
                'branch',
                recordName,
                inst,
                branch
            );

        if (connectedDevices.some((d) => !d)) {
            return 500;
        }

        if (connectedDevices.length <= 0) {
            return 404;
        }

        // TODO: Replace with system that selects target devices with better uniformity
        // than Math.random().
        const randomDeviceIndex = Math.min(
            connectedDevices.length - 1,
            Math.max(Math.floor(Math.random() * connectedDevices.length), 0)
        );
        const randomDevice = connectedDevices[randomDeviceIndex];

        if (!randomDevice) {
            return 500;
        }

        const a = action(ON_WEBHOOK_ACTION_NAME, null, null, {
            method,
            url,
            headers,
            data,
        });

        await this._messenger.sendMessage([randomDevice.serverConnectionId], {
            type: 'repo/receive_action',
            recordName,
            inst,
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

    /**
     * Saves all of the permanent branches that are currently in memory.
     */
    async savePermanentBranches(): Promise<void> {
        const store = this._instStore;
        if (store instanceof SplitInstRecordsStore) {
            const generation = await store.temp.getDirtyBranchGeneration();
            store.temp.setDirtyBranchGeneration(uuid());
            const branches = await store.temp.listDirtyBranches(generation);

            for (let branch of branches) {
                if (!branch.recordName) {
                    continue;
                }
                await this._saveBranchUpdates(store, branch);
            }

            await store.temp.clearDirtyBranches(generation);
            console.log(`[WebsocketController] Saved permanent branches.`);
        }
    }

    private async _saveBranchUpdates(
        store: SplitInstRecordsStore,
        branch: BranchName
    ) {
        console.log(
            `[WebsocketController] Saving branch updates for ${branch.recordName}/${branch.inst}/${branch.branch}`
        );

        let [updateCount, size] = await Promise.all([
            store.temp.countBranchUpdates(
                branch.recordName,
                branch.inst,
                branch.branch
            ),
            store.temp.getBranchSize(
                branch.recordName,
                branch.inst,
                branch.branch
            ),
        ]);

        if (updateCount <= 0) {
            console.log(`[WebsocketController] Branch has no updates to save.`);
            return;
        }

        const branchInfo = await store.getBranchByName(
            branch.recordName,
            branch.inst,
            branch.branch
        );

        if (!branchInfo) {
            console.log(`[WebsocketController] Branch info not found.`);
            return;
        }

        if (branchInfo.temporary) {
            console.log(`[WebsocketController] Branch is temporary.`);
            return;
        }

        const updates = await store.temp.getUpdates(
            branch.recordName,
            branch.inst,
            branch.branch
        );

        if (updates) {
            const updatesBytes = updates.updates.map((u) => toByteArray(u));
            const mergedBytes = mergeUpdates(updatesBytes);
            const mergedBase64 = fromByteArray(mergedBytes);
            const permanentReplaceResult =
                await store.perm.replaceCurrentUpdates(
                    branch.recordName,
                    branch.inst,
                    branch.branch,
                    mergedBase64,
                    mergedBase64.length
                );

            if (permanentReplaceResult.success === false) {
                console.error(
                    `[WebsocketController] Failed to replace permanent updates.`,
                    permanentReplaceResult
                );
                return;
            }

            await store.temp.addUpdates(
                branch.recordName,
                branch.inst,
                branch.branch,
                [mergedBase64],
                mergedBase64.length
            );
            await store.temp.trimUpdates(
                branch.recordName,
                branch.inst,
                branch.branch,
                updateCount
            );
            await Promise.all([
                store.temp.addBranchSize(
                    branch.recordName,
                    branch.inst,
                    branch.branch,
                    -size
                ),
                store.temp.addInstSize(branch.recordName, branch.inst, -size),
            ]);
        } else {
            console.log(`[WebsocketController] No updates found.`);
        }

        console.log(`[WebsocketController] Updates complete.`);
    }

    async sendError(connectionId: string, error: WebsocketControllerError) {
        await this.sendEvent(connectionId, [
            WebsocketEventTypes.Error,
            error.requestId,
            error.errorCode,
            error.errorMessage,
            error.issues,
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
    } else if (event.sessionId === device.sessionId) {
        return true;
    }
    return false;
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
    issues?: ZodIssue[];
}
