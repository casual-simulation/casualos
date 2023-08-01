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
import { WebsocketMessenger, CONNECTION_COUNT } from './WebsocketMessenger';
import {
    device,
    deviceError,
    deviceResult,
    DeviceSelector,
    MessagePacket,
    RemoteAction,
    RemoteActionError,
    RemoteActionResult,
} from './Events';
import {
    AddUpdatesEvent,
    ADD_UPDATES,
    SYNC_TIME,
    TimeSyncRequest,
    TimeSyncResponse,
    UPDATES_RECEIVED,
    WatchBranch,
} from './ExtraEvents';
import { fromByteArray, toByteArray } from 'base64-js';
import { applyUpdate, mergeUpdates } from 'yjs';
import {
    DeviceConnection,
    WebsocketConnectionStore,
} from './WebsocketConnectionStore';
import { UpdatesStore } from '@casual-simulation/causal-trees/core2';
import {
    CONNECTED_TO_BRANCH,
    DISCONNECTED_FROM_BRANCH,
    RATE_LIMIT_EXCEEDED,
    RateLimitExceededEvent,
    RECEIVE_EVENT,
    SendRemoteActionEvent,
} from './WebsocketEvents';
import { ConnectionInfo } from './ConnectionInfo';

/**
 * Defines a class that is able to serve causal repos in realtime.
 */
export class ApiaryCausalRepoServer {
    private _connectionStore: WebsocketConnectionStore;
    private _messenger: WebsocketMessenger;
    private _updatesStore: UpdatesStore;

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
        updatesStore: UpdatesStore
    ) {
        this._connectionStore = connectionStore;
        this._messenger = messenger;
        this._updatesStore = updatesStore;
    }

    async connect(connection: DeviceConnection): Promise<void> {
        await this._connectionStore.saveConnection(connection);
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
                        name: DISCONNECTED_FROM_BRANCH,
                        data: {
                            broadcast: false,
                            branch: branch,
                            connection: connectionInfo(connection),
                        },
                    }
                );
            }
        }
    }

    async handlePacket(connectionId: string, packet: MessagePacket) {}

    async watchBranch(connectionId: string, event: WatchBranch) {
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
                    name: CONNECTED_TO_BRANCH,
                    data: {
                        broadcast: false,
                        branch: event,
                        connection: connectionInfo(connection),
                    },
                }
            ),
            this._messenger.sendMessage([connection.serverConnectionId], {
                name: ADD_UPDATES,
                data: {
                    branch: event.branch,
                    updates: updates.updates,
                    initial: true,
                },
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
                    name: DISCONNECTED_FROM_BRANCH,
                    data: {
                        broadcast: false,
                        branch: branch,
                        connection: connectionInfo(connection),
                    },
                }
            );
        }
    }

    async addUpdates(connectionId: string, event: AddUpdatesEvent) {
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
                                name: UPDATES_RECEIVED,
                                data: {
                                    branch: event.branch,
                                    updateId: event.updateId,
                                    ...rest,
                                },
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

            let ret: AddUpdatesEvent = {
                branch: event.branch,
                updates: event.updates,
            };

            await this._messenger.sendMessage(
                connectedDevices.map((c) => c.serverConnectionId),
                {
                    name: ADD_UPDATES,
                    data: ret,
                },
                connectionId
            );
        }

        if ('updateId' in event) {
            await this._messenger.sendMessage([connectionId], {
                name: UPDATES_RECEIVED,
                data: {
                    branch: event.branch,
                    updateId: event.updateId,
                },
            });
        }
    }

    async sendEvent(connectionId: string, event: SendRemoteActionEvent) {
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
                name: RECEIVE_EVENT,
                data: {
                    branch: event.branch,
                    action: dEvent,
                },
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
                name: CONNECTED_TO_BRANCH,
                data: {
                    broadcast: false,
                    branch: {
                        branch: branch,
                        temporary: device.temporary,
                    },
                    connection: connectionInfo(device),
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
            name: CONNECTION_COUNT,
            data: {
                branch,
                count: count,
            },
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
            name: ADD_UPDATES,
            data: {
                branch: branch,
                updates: updates.updates,
                timestamps: updates.timestamps,
            },
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
        // const count = await this._updatesStore..countAtoms(namespace);

        // if (count <= 0) {
        //     return 404;
        // }

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
            name: RECEIVE_EVENT,
            data: {
                branch: branch,
                action: a as any,
            },
        });

        return 200;
    }

    async syncTime(
        connectionId: string,
        event: TimeSyncRequest,
        requestTime: number
    ) {
        await this._messenger.sendMessage([connectionId], {
            name: SYNC_TIME,
            data: {
                id: event.id,
                clientRequestTime: event.clientRequestTime,
                serverReceiveTime: requestTime,
                serverTransmitTime: Date.now(),
            } as TimeSyncResponse,
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
                name: RATE_LIMIT_EXCEEDED,
                data: {
                    retryAfter,
                    totalHits,
                } as RateLimitExceededEvent,
            });
        }
    }
}

export function connectionInfo(device: DeviceConnection): ConnectionInfo {
    return {
        connectionId: device.clientConnectionId,
        deviceId: device.userId,
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
