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
import type {
    BotAction,
    InstUpdate,
    StoredAux,
    BotsState,
} from '@casual-simulation/aux-common/bots';
import {
    action,
    createInitializationUpdate,
    hasValue,
    ON_WEBHOOK_ACTION_NAME,
} from '@casual-simulation/aux-common/bots';
import {
    constructInitializationUpdate,
    YjsPartitionImpl,
} from '@casual-simulation/aux-common/partitions';
import type { WebsocketMessenger } from './WebsocketMessenger';
import type {
    DeviceSelector,
    RemoteAction,
    RemoteActionError,
    RemoteActionResult,
} from '@casual-simulation/aux-common/common/RemoteActions';
import {
    device,
    deviceError,
    deviceResult,
} from '@casual-simulation/aux-common/common/RemoteActions';
import { fromByteArray, toByteArray } from 'base64-js';
import { applyUpdate, Doc, encodeStateAsUpdate } from 'yjs';
import type {
    DeviceConnection,
    WebsocketConnectionStore,
} from './WebsocketConnectionStore';
import type {
    AddUpdatesMessage,
    LoginMessage,
    RequestMissingPermissionMessage,
    RequestMissingPermissionResponseMessage,
    SendActionMessage,
    TimeSyncRequestMessage,
    UploadHttpHeaders,
    WatchBranchMessage,
    WebsocketErrorInfo,
    WebsocketEvent,
} from '@casual-simulation/aux-common/websockets/WebsocketEvents';
import { WebsocketEventTypes } from '@casual-simulation/aux-common/websockets/WebsocketEvents';
import type { ConnectionInfo } from '@casual-simulation/aux-common/common/ConnectionInfo';
import type { AuthController } from '../AuthController';
import type {
    CurrentUpdates,
    InstRecord,
    InstRecordsStore,
    InstWithSubscriptionInfo,
    LoadedPackage,
    SaveInstFailure,
} from './InstRecordsStore';
import type {
    BranchName,
    TemporaryInstRecordsStore,
} from './TemporaryInstRecordsStore';
import { sumBy } from 'es-toolkit/compat';
import type {
    DenialReason,
    ServerError,
    NotSupportedError,
    PublicUserInfo,
    KnownErrorCodes,
    UserRole,
} from '@casual-simulation/aux-common';
import {
    PRIVATE_MARKER,
    ACCOUNT_MARKER,
    DEFAULT_BRANCH_NAME,
    tryParseJson,
    parseRecordKey,
} from '@casual-simulation/aux-common';
import type { ZodIssue } from 'zod';
import { SplitInstRecordsStore } from './SplitInstRecordsStore';
import { v4 as uuid, v7 as uuidv7 } from 'uuid';
import type {
    AuthorizationContext,
    AuthorizeSubjectFailure,
    ConstructAuthorizationContextFailure,
    PolicyController,
} from '../PolicyController';
import type { ConfigurationStore } from '../ConfigurationStore';
import type {
    FeaturesConfiguration,
    SubscriptionConfiguration,
} from '../SubscriptionConfiguration';
import { getSubscriptionFeatures } from '../SubscriptionConfiguration';
import type { MetricsStore } from '../MetricsStore';
import type { AuthStore } from '../AuthStore';
import { traced } from '../tracing/TracingDecorators';
import { trace } from '@opentelemetry/api';
import { SEMATTRS_ENDUSER_ID } from '@opentelemetry/semantic-conventions';
import type { PackageRecordVersionWithMetadata } from '../packages/version';
import {
    formatVersionSpecifier,
    type PackageVersionRecordsController,
    type PackageVersionSpecifier,
} from '../packages/version';
import { STORED_AUX_SCHEMA } from '../webhooks';
import { formatInstId } from '@casual-simulation/aux-common';

const TRACE_NAME = 'WebsocketController';

export const SAVE_PERMANENT_BRANCHES_LOCK = 'savePermanentBranches';

/**
 * Defines a class that is able to serve causal repos in realtime.
 */
export class WebsocketController {
    private _connectionStore: WebsocketConnectionStore;
    private _messenger: WebsocketMessenger;
    private _instStore: InstRecordsStore;
    private _temporaryStore: TemporaryInstRecordsStore;
    private _auth: AuthController;
    private _policies: PolicyController;
    private _config: ConfigurationStore;
    private _metrics: MetricsStore;
    private _authStore: AuthStore;
    private _packageVersions: PackageVersionRecordsController | null;

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
        auth: AuthController,
        policies: PolicyController,
        config: ConfigurationStore,
        metrics: MetricsStore,
        authStore: AuthStore,
        packageVersions: PackageVersionRecordsController = null
    ) {
        this._connectionStore = connectionStore;
        this._messenger = messenger;
        this._instStore = instStore;
        this._temporaryStore = temporaryInstStore;
        this._auth = auth;
        this._authStore = authStore;
        this._policies = policies;
        this._config = config;
        this._metrics = metrics;
        this._packageVersions = packageVersions;
    }

    /**
     * Attempts to log the given connection in.
     * @param connectionId The ID of the connection.
     * @param requestId The ID of the request.
     * @param message The login message.
     */
    @traced(TRACE_NAME)
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
                    await this._messenger.sendMessage([connectionId], {
                        type: 'login_result',
                        success: false,
                        errorCode: 'unacceptable_connection_id',
                        errorMessage:
                            'A connection ID must be specified when logging in without a connection token.',
                    });
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
                    await this._messenger.sendMessage([connectionId], {
                        type: 'login_result',
                        success: false,
                        errorCode: validationResult.errorCode,
                        errorMessage: validationResult.errorMessage,
                    });
                    return;
                }

                await this._connectionStore.saveConnection({
                    serverConnectionId: connectionId,
                    userId: validationResult.userId,
                    sessionId: validationResult.sessionId,
                    clientConnectionId: validationResult.connectionId,
                    token: message.connectionToken,
                });
                await this._connectionStore.saveAuthorizedInst(
                    connectionId,
                    validationResult.recordName,
                    validationResult.inst,
                    'token'
                );
                userId = validationResult.userId;
                sessionId = validationResult.sessionId;
                clientConnectionId = validationResult.connectionId;

                const span = trace.getActiveSpan();
                if (span) {
                    span.setAttributes({
                        [SEMATTRS_ENDUSER_ID]: userId,
                        ['request.userId']: userId,
                        ['request.sessionId']: sessionId,
                        ['request.subscriptionId']:
                            validationResult.subscriptionId,
                        ['request.subscriptionTier']:
                            validationResult.subscriptionTier,
                    });
                }
            }

            await this._messenger.sendMessage([connectionId], {
                type: 'login_result',
                success: true,
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
            await this.sendError(connectionId, requestId, {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred while logging in.',
            });
        }
    }

    @traced(TRACE_NAME)
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
                        const branch =
                            (await this._instStore.getBranchByName(
                                connection.recordName,
                                connection.inst,
                                connection.branch
                            )) ??
                            (await this._temporaryStore.getBranchByName(
                                connection.recordName,
                                connection.inst,
                                connection.branch
                            ));

                        if (branch?.temporary) {
                            console.log(
                                '[WebsocketController] Deleting temporary branch',
                                connection.recordName,
                                connection.inst,
                                connection.branch
                            );
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

    @traced(TRACE_NAME)
    async watchBranch(connectionId: string, event: WatchBranchMessage) {
        if (!event) {
            console.warn(
                '[CasualRepoServer] Trying to watch branch with a null event!'
            );
            return;
        }

        let recordName = event.recordName;
        const parsedRecordKey = parseRecordKey(recordName);
        if (hasValue(parsedRecordKey)) {
            recordName = parsedRecordKey[0]; // Use the record name from the record key
        }

        console.log(
            `[WebsocketController] [namespace: ${recordName}/${event.inst}/${event.branch}, ${connectionId}] Watch`
        );

        const connection = await this._connectionStore.getConnection(
            connectionId
        );
        if (!connection) {
            console.error(
                `[WebsocketController] [namespace: ${recordName}/${event.inst}/${event.branch}, connectionId: ${connectionId}] Unable to watch branch. Connection not found!`
            );
            await this.sendError(connectionId, -1, {
                success: false,
                errorCode: 'invalid_connection_state',
                errorMessage: `A server error occurred. (namespace: ${recordName}/${event.inst}/${event.branch}, connectionId: ${connectionId})`,
                recordName: recordName,
                inst: event.inst,
                branch: event.branch,
            });
            await this.messenger.disconnect(connectionId);
            return;
        }

        if (connection.token && recordName) {
            const authorized = await this._connectionStore.isAuthorizedInst(
                connectionId,
                recordName,
                event.inst,
                'token'
            );

            if (!authorized) {
                await this.messenger.sendMessage([connectionId], {
                    type: 'repo/watch_branch_result',
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage: 'You are not authorized to access this inst.',
                    recordName: recordName,
                    inst: event.inst,
                    branch: event.branch,
                    reason: {
                        type: 'invalid_token',
                    },
                });
                return;
            }
        }

        const config = await this._config.getSubscriptionConfiguration();

        if (!recordName) {
            if (config?.defaultFeatures?.publicInsts?.allowed === false) {
                await this.messenger.sendMessage([connectionId], {
                    type: 'repo/watch_branch_result',
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage: 'Temporary insts are not allowed.',
                    recordName: recordName,
                    inst: event.inst,
                    branch: event.branch,
                });
                return;
            }
        }

        const instResult = await this._getOrCreateInst(
            recordName,
            event.inst,
            connection.userId,
            config
        );

        if (instResult.success === false) {
            await this.messenger.sendMessage([connectionId], {
                ...instResult,
                type: 'repo/watch_branch_result',
                recordName: recordName,
                inst: event.inst,
                branch: event.branch,
            });
            return;
        }
        const inst = instResult.inst;
        const features = instResult.features;

        let maxConnections: number = null;

        if (
            features &&
            typeof features.insts.maxActiveConnectionsPerInst === 'number'
        ) {
            maxConnections = features.insts.maxActiveConnectionsPerInst;
        } else if (
            !recordName &&
            typeof config?.defaultFeatures?.publicInsts
                ?.maxActiveConnectionsPerInst === 'number'
        ) {
            maxConnections =
                config.defaultFeatures.publicInsts.maxActiveConnectionsPerInst;
        }

        if (maxConnections) {
            const count = await this._connectionStore.countConnectionsByBranch(
                'branch',
                recordName,
                event.inst,
                event.branch
            );
            if (count >= maxConnections) {
                await this.messenger.sendMessage([connectionId], {
                    type: 'repo/watch_branch_result',
                    success: false,
                    errorCode: features
                        ? 'subscription_limit_reached'
                        : 'not_authorized',
                    errorMessage:
                        'The maximum number of active connections to this inst has been reached.',
                    recordName: recordName,
                    inst: event.inst,
                    branch: event.branch,
                });
                return;
            }
        }

        await this._connectionStore.saveBranchConnection({
            ...connection,
            serverConnectionId: connectionId,
            mode: 'branch',
            recordName: recordName,
            inst: event.inst,
            branch: event.branch,
            temporary: event.temporary || false,
        });

        const branch = await this._getOrCreateBranch(
            recordName,
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
                recordName,
                event.inst,
                event.branch
            );
        } else {
            updates = await this._instStore.getCurrentUpdates(
                recordName,
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
                recordName,
                event.inst,
                event.branch
            );

        console.log(
            `[WebsocketController] [namespace: ${recordName}/${event.inst}/${event.branch}, ${connectionId}] Connected.`
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
                recordName: recordName,
                inst: event.inst,
                branch: event.branch,
                updates: updates.updates,
                initial: true,
            }),
            this._messenger.sendMessage([connection.serverConnectionId], {
                type: 'repo/watch_branch_result',
                recordName: recordName,
                inst: event.inst,
                branch: event.branch,
                success: true,
            }),
        ];
        await Promise.all(promises);
    }

    @traced(TRACE_NAME)
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
            `[WebsocketController] [namespace: ${recordName}/${inst}/${branch}, ${connectionId}] Unwatch`
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
                    const branch =
                        (await this._instStore.getBranchByName(
                            connection.recordName,
                            connection.inst,
                            connection.branch
                        )) ??
                        (await this._temporaryStore.getBranchByName(
                            connection.recordName,
                            connection.inst,
                            connection.branch
                        ));

                    if (branch?.temporary) {
                        await this._temporaryStore.deleteBranch(
                            connection.recordName,
                            connection.inst,
                            connection.branch
                        );

                        // Delete the branch from the permentent store even if it is temporary
                        // because it is possible that the branch was created before temporary branches were only stored in the temporary store.
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

    @traced(TRACE_NAME)
    async addUpdates(connectionId: string, event: AddUpdatesMessage) {
        if (!event) {
            console.warn(
                '[CasualRepoServer] Trying to add atoms with a null event!'
            );
            return;
        }

        console.log(
            `[WebsocketController] [namespace: ${event.recordName}/${event.inst}/${event.branch}, connectionId: ${connectionId}] Add Updates`
        );

        const connection = await this._connectionStore.getConnection(
            connectionId
        );
        if (!connection) {
            console.error(
                `[WebsocketController] [namespace: ${event.recordName}/${event.inst}/${event.branch}, connectionId: ${connectionId}] Unable to add updates. Connection not found!`
            );
            await this.sendError(connectionId, -1, {
                success: false,
                errorCode: 'invalid_connection_state',
                errorMessage: `A server error occurred. (namespace: ${event.recordName}/${event.inst}/${event.branch}, connectionId: ${connectionId})`,
                recordName: event.recordName,
                inst: event.inst,
                branch: event.branch,
            });
            await this.messenger.disconnect(connectionId);
            return;
        }

        if (connection.token && event.recordName) {
            const authorized = await this._connectionStore.isAuthorizedInst(
                connectionId,
                event.recordName,
                event.inst,
                'token'
            );

            if (!authorized) {
                await this.sendError(connectionId, -1, {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage: 'You are not authorized to access this inst.',
                    recordName: event.recordName,
                    inst: event.inst,
                    branch: event.branch,
                    reason: {
                        type: 'invalid_token',
                    },
                });
                return;
            }
        }

        if (event.updates) {
            let branch =
                (await this._instStore.getBranchByName(
                    event.recordName,
                    event.inst,
                    event.branch
                )) ??
                (await this._temporaryStore.getBranchByName(
                    event.recordName,
                    event.inst,
                    event.branch
                ));
            const updateSize = sumBy(event.updates, (u) =>
                Buffer.byteLength(u, 'utf8')
            );
            const config = await this._config.getSubscriptionConfiguration();
            let features: FeaturesConfiguration = null;

            if (!event.recordName) {
                if (config?.defaultFeatures?.publicInsts?.allowed === false) {
                    await this.sendError(connectionId, -1, {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage: 'Temporary insts are not allowed.',
                        recordName: event.recordName,
                        inst: event.inst,
                        branch: event.branch,
                    });
                    return;
                }
            }

            if (!branch) {
                console.log(
                    `[WebsocketController] [namespace: ${event.recordName}/${event.inst}/${event.branch}, connectionId: ${connectionId}]  Branch not found!`
                );

                const instResult = await this._getOrCreateInst(
                    event.recordName,
                    event.inst,
                    connection.userId,
                    config
                );

                if (instResult.success === false) {
                    await this.sendError(connectionId, -1, {
                        ...instResult,
                        recordName: event.recordName,
                        inst: event.inst,
                        branch: event.branch,
                    });
                    return;
                } else if (event.recordName) {
                    const authorizeResult =
                        await this._policies.authorizeUserAndInstances(
                            instResult.context,
                            {
                                resourceKind: 'inst',
                                resourceId: event.inst,
                                action: 'updateData',
                                userId: connection.userId,
                                markers: instResult.inst.markers,
                                instances: [],
                            }
                        );

                    if (authorizeResult.success === false) {
                        await this.sendError(connectionId, -1, {
                            ...authorizeResult,
                            recordName: event.recordName,
                            inst: event.inst,
                            branch: event.branch,
                        });
                        return;
                    }
                }

                features = instResult.features;

                const branchResult = await this._instStore.saveBranch({
                    branch: event.branch,
                    inst: event.inst,
                    recordName: event.recordName,
                    temporary: false,
                });

                if (branchResult.success === false) {
                    await this.sendError(connectionId, -1, {
                        ...branchResult,
                        recordName: event.recordName,
                        inst: event.inst,
                        branch: event.branch,
                    });
                    return;
                }
                branch = await this._instStore.getBranchByName(
                    event.recordName,
                    event.inst,
                    event.branch
                );
            } else if (event.recordName) {
                const authorized = await this._connectionStore.isAuthorizedInst(
                    connectionId,
                    event.recordName,
                    event.inst,
                    'updateData'
                );

                if (!authorized) {
                    if (!branch.linkedInst) {
                        console.error(
                            '[WebsocketController] The inst was not found even though the branch was found and exists in a record!'
                        );
                        await this.sendError(connectionId, -1, {
                            success: false,
                            errorCode: 'inst_not_found',
                            errorMessage: 'The inst was not found.',
                            recordName: event.recordName,
                            inst: event.inst,
                            branch: event.branch,
                        });
                        return;
                    }

                    const contextResult =
                        await this._policies.constructAuthorizationContext({
                            recordKeyOrRecordName: event.recordName,
                            userId: connection.userId,
                        });

                    if (contextResult.success === false) {
                        await this.sendError(connectionId, -1, {
                            ...contextResult,
                            recordName: event.recordName,
                            inst: event.inst,
                            branch: event.branch,
                        });
                        return;
                    }

                    const authorizeResult =
                        await this._policies.authorizeUserAndInstancesForResources(
                            contextResult.context,
                            {
                                userId: connection.userId,
                                instances: [],
                                resources: [
                                    {
                                        resourceKind: 'inst',
                                        resourceId: event.inst,
                                        action: 'read',
                                        markers: branch.linkedInst.markers,
                                    },
                                    {
                                        resourceKind: 'inst',
                                        resourceId: event.inst,
                                        action: 'updateData',
                                        markers: branch.linkedInst.markers,
                                    },
                                ],
                            }
                        );

                    // const authorizeReadResult =
                    //     await this._policies.authorizeRequestUsingContext(
                    //         contextResult.context,
                    //         {
                    //             action: 'inst.read',
                    //             inst: event.inst,
                    //             recordKeyOrRecordName: event.recordName,
                    //             resourceMarkers: branch.linkedInst.markers,
                    //             userId: connection.userId,
                    //         }
                    //     );

                    if (authorizeResult.success === false) {
                        await this.sendError(connectionId, -1, {
                            ...authorizeResult,
                            recordName: event.recordName,
                            inst: event.inst,
                            branch: event.branch,
                        });
                        return;
                    }

                    // const authorizeUpdateResult =
                    //     await this._policies.authorizeUserAndInstances(
                    //         contextResult.context,
                    //         {
                    //             resourceKind: 'inst',
                    //             resourceId: event.inst,
                    //             action: 'updateData',
                    //             markers: branch.linkedInst.markers,
                    //             userId: connection.userId,
                    //             instances: [],
                    //         }
                    //     );

                    // if (authorizeUpdateResult.success === false) {
                    //     await this.sendError(connectionId, -1, {
                    //         ...authorizeUpdateResult,
                    //         recordName: event.recordName,
                    //         inst: event.inst,
                    //         branch: event.branch,
                    //     });
                    //     return;
                    // }

                    await this._connectionStore.saveAuthorizedInst(
                        connectionId,
                        event.recordName,
                        event.inst,
                        'updateData'
                    );
                }
            }

            if (!features && branch.linkedInst) {
                features = getSubscriptionFeatures(
                    config,
                    branch.linkedInst.subscriptionStatus,
                    branch.linkedInst.subscriptionId,
                    branch.linkedInst.subscriptionType
                );
            }

            let maxInstSize: number = null;

            if (
                features &&
                typeof features.insts.maxBytesPerInst === 'number'
            ) {
                maxInstSize = features.insts.maxBytesPerInst;
            } else if (
                !event.recordName &&
                typeof config?.defaultFeatures?.publicInsts?.maxBytesPerInst ===
                    'number'
            ) {
                maxInstSize =
                    config.defaultFeatures.publicInsts.maxBytesPerInst;
            }

            if (maxInstSize) {
                const currentSize = branch.temporary
                    ? await this._temporaryStore.getInstSize(
                          event.recordName,
                          event.inst
                      )
                    : await this._instStore.getInstSize(
                          event.recordName,
                          event.inst
                      );
                const neededSizeInBytes = currentSize + updateSize;
                if (neededSizeInBytes > maxInstSize) {
                    await this._messenger.sendMessage([connectionId], {
                        type: 'repo/updates_received',
                        recordName: event.recordName,
                        inst: event.inst,
                        branch: event.branch,
                        updateId: event.updateId,
                        errorCode: 'max_size_reached',
                        maxBranchSizeInBytes: maxInstSize,
                        neededBranchSizeInBytes: neededSizeInBytes,
                    });
                    return;
                }
            }

            if (branch.temporary) {
                // Temporary branches use a temporary inst data store.
                // This is because temporary branches are never persisted to disk.
                await this._temporaryStore.addUpdates(
                    event.recordName,
                    event.inst,
                    event.branch,
                    event.updates,
                    updateSize
                );
            } else {
                const result = await this._instStore.addUpdates(
                    event.recordName,
                    event.inst,
                    event.branch,
                    event.updates,
                    updateSize
                );

                if (result.success === false) {
                    console.log(
                        `[WebsocketController] [namespace: ${event.recordName}/${event.inst}/${event.branch}, connectionId: ${connectionId}]  Failed to add updates`,
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

    @traced(TRACE_NAME)
    async addUserUpdates(
        request: AddUpdatesRequest
    ): Promise<AddInstUpdatesResult> {
        console.log(
            `[CausalRepoServer] [namespace: ${request.recordName}/${request.inst}/${request.branch}, userId: ${request.userId}] Add Updates`
        );

        if (request.updates) {
            let branch =
                (await this._instStore.getBranchByName(
                    request.recordName,
                    request.inst,
                    request.branch
                )) ??
                (await this._temporaryStore.getBranchByName(
                    request.recordName,
                    request.inst,
                    request.branch
                ));
            const updateSize = sumBy(request.updates, (u) =>
                Buffer.byteLength(u, 'utf8')
            );
            const config = await this._config.getSubscriptionConfiguration();
            let features: FeaturesConfiguration = null;

            if (!request.recordName) {
                if (config?.defaultFeatures?.publicInsts?.allowed === false) {
                    return {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage: 'Temporary insts are not allowed.',
                    };
                }
            }

            if (!branch) {
                console.log(
                    `[CausalRepoServer] [namespace: ${request.recordName}/${request.inst}/${request.branch}, userId: ${request.userId}]  Branch not found!`
                );

                const instResult = await this._getOrCreateInst(
                    request.recordName,
                    request.inst,
                    request.userId,
                    config
                );

                if (instResult.success === false) {
                    return instResult;
                } else if (request.recordName) {
                    const authorizeResult =
                        await this._policies.authorizeUserAndInstances(
                            instResult.context,
                            {
                                resourceKind: 'inst',
                                resourceId: request.inst,
                                action: 'updateData',
                                userId: request.userId,
                                markers: instResult.inst.markers,
                                instances: [],
                            }
                        );

                    if (authorizeResult.success === false) {
                        return authorizeResult;
                    }
                }

                features = instResult.features;

                const branchResult = await this._instStore.saveBranch({
                    branch: request.branch,
                    inst: request.inst,
                    recordName: request.recordName,
                    temporary: false,
                });

                if (branchResult.success === false) {
                    return branchResult;
                }
                branch = await this._instStore.getBranchByName(
                    request.recordName,
                    request.inst,
                    request.branch
                );
            } else if (request.recordName) {
                const contextResult =
                    await this._policies.constructAuthorizationContext({
                        recordKeyOrRecordName: request.recordName,
                        userId: request.userId,
                    });

                if (contextResult.success === false) {
                    return contextResult;
                }

                const authorizeResult =
                    await this._policies.authorizeUserAndInstancesForResources(
                        contextResult.context,
                        {
                            userId: request.userId,
                            instances: [],
                            resources: [
                                {
                                    resourceKind: 'inst',
                                    resourceId: request.inst,
                                    action: 'read',
                                    markers: branch.linkedInst.markers,
                                },
                                {
                                    resourceKind: 'inst',
                                    resourceId: request.inst,
                                    action: 'updateData',
                                    markers: branch.linkedInst.markers,
                                },
                            ],
                        }
                    );

                if (authorizeResult.success === false) {
                    return authorizeResult;
                }
            }

            if (!features && branch.linkedInst) {
                features = getSubscriptionFeatures(
                    config,
                    branch.linkedInst.subscriptionStatus,
                    branch.linkedInst.subscriptionId,
                    branch.linkedInst.subscriptionType
                );
            }

            let maxInstSize: number = null;

            if (
                features &&
                typeof features.insts.maxBytesPerInst === 'number'
            ) {
                maxInstSize = features.insts.maxBytesPerInst;
            } else if (
                !request.recordName &&
                typeof config?.defaultFeatures?.publicInsts?.maxBytesPerInst ===
                    'number'
            ) {
                maxInstSize =
                    config.defaultFeatures.publicInsts.maxBytesPerInst;
            }

            if (maxInstSize) {
                const currentSize = branch.temporary
                    ? await this._temporaryStore.getInstSize(
                          request.recordName,
                          request.inst
                      )
                    : await this._instStore.getInstSize(
                          request.recordName,
                          request.inst
                      );
                const neededSizeInBytes = currentSize + updateSize;
                if (neededSizeInBytes > maxInstSize) {
                    return {
                        success: false,
                        errorCode: 'subscription_limit_reached',
                        errorMessage: 'The inst has reached its maximum size.',
                    };
                }
            }

            if (branch.temporary) {
                // Temporary branches use a temporary inst data store.
                // This is because temporary branches are never persisted to disk.
                await this._temporaryStore.addUpdates(
                    request.recordName,
                    request.inst,
                    request.branch,
                    request.updates,
                    updateSize
                );
            } else {
                const result = await this._instStore.addUpdates(
                    request.recordName,
                    request.inst,
                    request.branch,
                    request.updates,
                    updateSize
                );

                if (result.success === false) {
                    console.log(
                        `[CausalRepoServer] [namespace: ${request.recordName}/${request.inst}/${request.branch}, userId: ${request.userId}]  Failed to add updates`,
                        result
                    );
                    if (result.errorCode === 'max_size_reached') {
                        if (result.success === false) {
                            return {
                                success: false,
                                errorCode: 'subscription_limit_reached',
                                errorMessage:
                                    'The inst has reached its maximum size.',
                            };
                        }
                    }
                } else {
                    if (
                        request.recordName &&
                        this._instStore instanceof SplitInstRecordsStore
                    ) {
                        this._instStore.temp.markBranchAsDirty({
                            recordName: request.recordName,
                            inst: request.inst,
                            branch: request.branch,
                        });
                    }
                }
            }
        }

        const hasUpdates = request.updates && request.updates.length > 0;
        if (hasUpdates) {
            const connectedDevices =
                await this._connectionStore.getConnectionsByBranch(
                    'branch',
                    request.recordName,
                    request.inst,
                    request.branch
                );

            let ret: AddUpdatesMessage = {
                type: 'repo/add_updates',
                recordName: request.recordName,
                inst: request.inst,
                branch: request.branch,
                updates: request.updates,
            };

            await this._messenger.sendMessage(
                connectedDevices.map((c) => c.serverConnectionId),
                ret
            );
        }

        return {
            success: true,
        };
    }

    @traced(TRACE_NAME)
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

        if (currentConnection.token && event.recordName) {
            const authorized = await this._connectionStore.isAuthorizedInst(
                connectionId,
                event.recordName,
                event.inst,
                'token'
            );

            if (!authorized) {
                await this.sendError(connectionId, -1, {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage: 'You are not authorized to access this inst.',
                    recordName: event.recordName,
                    inst: event.inst,
                    branch: event.branch,
                    reason: {
                        type: 'invalid_token',
                    },
                });
                return;
            }
        }

        if (event.recordName) {
            const config = await this._config.getSubscriptionConfiguration();
            const instResult = await this._getInst(
                event.recordName,
                event.inst,
                currentConnection.userId,
                config
            );

            if (instResult.success === false) {
                await this.sendError(connectionId, -1, instResult);
                return;
            } else if (!instResult.inst) {
                await this.sendError(connectionId, -1, {
                    success: false,
                    errorCode: 'inst_not_found',
                    errorMessage: 'The inst was not found.',
                });
                return;
            }

            const authorizeResult =
                await this._policies.authorizeUserAndInstances(
                    instResult.context,
                    {
                        resourceKind: 'inst',
                        resourceId: event.inst,
                        action: 'sendAction',
                        markers: instResult.inst.markers,
                        userId: currentConnection.userId,
                        instances: [],
                    }
                );

            if (authorizeResult.success === false) {
                await this.sendError(connectionId, -1, authorizeResult);
                return;
            }
        }

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

    @traced(TRACE_NAME)
    async watchBranchDevices(
        connectionId: string,
        recordName: string | null,
        inst: string,
        branch: string
    ) {
        console.log(
            `[WebsocketController] [namespace: ${recordName}/${inst}/${branch}, connectionId: ${connectionId}] Watch devices for branch`
        );

        const connection = await this._connectionStore.getConnection(
            connectionId
        );
        if (!connection) {
            console.error(
                `[WebsocketController] [namespace: ${recordName}/${inst}/${branch}, connectionId: ${connectionId}] Unable to watch_branch_devices. Connection not found!`
            );
            await this.sendError(connectionId, -1, {
                success: false,
                errorCode: 'invalid_connection_state',
                errorMessage: `A server error occurred. (namespace: ${recordName}/${inst}/${branch}, connectionId: ${connectionId})`,
                recordName: recordName,
                inst: inst,
                branch: branch,
            });
            await this.messenger.disconnect(connectionId);
            return;
        }

        if (connection.token && recordName) {
            const authorized = await this._connectionStore.isAuthorizedInst(
                connectionId,
                recordName,
                inst,
                'token'
            );

            if (!authorized) {
                await this.sendError(connectionId, -1, {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage: 'You are not authorized to access this inst.',
                    recordName,
                    inst,
                    branch,
                    reason: {
                        type: 'invalid_token',
                    },
                });
                return;
            }
        }

        if (recordName) {
            const config = await this._config.getSubscriptionConfiguration();
            const instResult = await this._getInst(
                recordName,
                inst,
                connection.userId,
                config
            );
            if (instResult.success === false) {
                await this.sendError(connectionId, -1, instResult);
                return;
            }
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

    @traced(TRACE_NAME)
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

    @traced(TRACE_NAME)
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

        const currentConnection = await this._connectionStore.getConnection(
            connectionId
        );

        if (recordName && currentConnection?.token) {
            const authorized = await this._connectionStore.isAuthorizedInst(
                connectionId,
                recordName,
                inst,
                'token'
            );

            if (!authorized) {
                await this.sendError(connectionId, -1, {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage: 'You are not authorized to access this inst.',
                    recordName,
                    inst,
                    branch,
                    reason: {
                        type: 'invalid_token',
                    },
                });
                return;
            }
        }

        if (recordName) {
            const config = await this._config.getSubscriptionConfiguration();
            const instResult = await this._getInst(
                recordName,
                inst,
                currentConnection?.userId,
                config
            );

            if (instResult.success === false) {
                await this.sendError(connectionId, -1, instResult);
                return;
            } else if (!instResult.inst) {
                await this.sendError(connectionId, -1, {
                    success: false,
                    errorCode: 'inst_not_found',
                    errorMessage: 'The inst was not found.',
                });
                return;
            }
        }

        await this._messenger.sendMessage([connectionId], {
            type: 'repo/connection_count',
            recordName,
            inst,
            branch,
            count: count,
        });
    }

    /**
     * Gets the data from the given branch in the given inst.
     * @param userId The ID of the user that is currently logged in.
     * @param recordName The name of the record that the inst is in. Null if accessing a public inst.
     * @param inst The name of the inst.
     * @param branch The name of the branch in the inst.
     * @param auxVersion The AUX version to return.
     */
    @traced(TRACE_NAME)
    async getBranchData(
        userId: string | null,
        recordName: string | null,
        inst: string,
        branch: string,
        auxVersion: 1 | 2 = 1
    ): Promise<GetBranchDataResult> {
        console.log(
            `[WebsocketController] [namespace: ${recordName}/${inst}/${branch}] Get Data`
        );

        if (recordName) {
            const config = await this._config.getSubscriptionConfiguration();
            const instResult = await this._getInst(
                recordName,
                inst,
                userId,
                config
            );
            if (instResult.success === false) {
                return instResult;
            } else if (!instResult.inst) {
                return {
                    success: false,
                    errorCode: 'inst_not_found',
                    errorMessage: 'The inst was not found.',
                };
            }
        }

        const updates = (await this._instStore.getCurrentUpdates(
            recordName,
            inst,
            branch
        )) ?? {
            updates: [],
            timestamps: [],
            instSizeInBytes: 0,
        };

        if (auxVersion === 1) {
            const partition = new YjsPartitionImpl({ type: 'yjs' });

            for (let updateBase64 of updates.updates) {
                const update = toByteArray(updateBase64);
                applyUpdate(partition.doc, update);
            }

            return {
                success: true,
                data: {
                    version: 1,
                    state: partition.state,
                },
            };
        } else {
            let stored: InstUpdate[] = [];
            for (let i = 0; i < updates.updates.length; i++) {
                stored.push({
                    id: i,
                    update: updates.updates[i],
                    timestamp: updates.timestamps[i],
                });
            }

            return {
                success: true,
                data: {
                    version: 2,
                    updates: stored,
                },
            };
        }
    }

    @traced(TRACE_NAME)
    async listInsts(
        recordName: string | null,
        userId: string,
        startingInst: string | null,
        marker?: string | null
    ): Promise<ListInstsResult> {
        try {
            if (!recordName) {
                return {
                    success: true,
                    insts: [],
                    totalCount: 0,
                };
            }

            const contextResult =
                await this._policies.constructAuthorizationContext({
                    recordKeyOrRecordName: recordName,
                    userId,
                });

            if (contextResult.success === false) {
                return contextResult;
            }
            const context = contextResult.context;
            const markers = hasValue(marker) ? [marker] : [PRIVATE_MARKER];
            const authorizeResult =
                await this._policies.authorizeUserAndInstances(context, {
                    resourceKind: 'inst',
                    action: 'list',
                    userId,
                    markers,
                    instances: [],
                });

            if (authorizeResult.success === false) {
                return authorizeResult;
            }

            const metricsResult =
                await this._metrics.getSubscriptionInstMetricsByRecordName(
                    recordName
                );
            const config = await this._config.getSubscriptionConfiguration();
            const features = getSubscriptionFeatures(
                config,
                metricsResult.subscriptionStatus,
                metricsResult.subscriptionId,
                metricsResult.subscriptionType
            );

            if (!features.insts.allowed) {
                return {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'Insts are not allowed for this subscription.',
                };
            }

            const instsResult = await this._instStore.listInstsByRecord(
                recordName,
                startingInst
            );
            if (!instsResult.success) {
                return instsResult;
            }

            return {
                success: true,
                insts: instsResult.insts,
                totalCount: instsResult.totalCount,
            };
        } catch (err) {
            console.error(
                `[WebsocketController] A server error occurred while listing insts:`,
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    @traced(TRACE_NAME)
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
            console.error(
                `[WebsocketController] [namespace: ${recordName}/${inst}/${branch}, connectionId: ${connectionId}] Unable to get_updates. Connection not found!`
            );
            await this.sendError(connectionId, -1, {
                success: false,
                errorCode: 'invalid_connection_state',
                errorMessage: `A server error occurred. (namespace: ${recordName}/${inst}/${branch}, connectionId: ${connectionId})`,
                recordName: recordName,
                inst: inst,
                branch: branch,
            });
            await this.messenger.disconnect(connectionId);
            return;
        }

        if (connection.token && recordName) {
            const authorized = await this._connectionStore.isAuthorizedInst(
                connectionId,
                recordName,
                inst,
                'token'
            );

            if (!authorized) {
                await this.sendError(connectionId, -1, {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage: 'You are not authorized to access this inst.',
                    recordName,
                    inst,
                    branch,
                    reason: {
                        type: 'invalid_token',
                    },
                });
                return;
            }
        }

        // const namespace = branchNamespace(recordName, inst, branch);
        console.log(
            `[WebsocketController] [namespace: ${recordName}/${inst}/${branch}, connectionId: ${connectionId}] Get Updates`
        );
        const config = await this._config.getSubscriptionConfiguration();
        const instResult = await this._getInst(
            recordName,
            inst,
            connection.userId,
            config
        );
        if (instResult.success === false) {
            await this.sendError(connectionId, -1, {
                ...instResult,
                recordName,
                inst,
                branch,
            });
            return;
        } else if (recordName && !instResult.inst) {
            await this.sendError(connectionId, -1, {
                success: false,
                errorCode: 'inst_not_found',
                errorMessage: 'The inst was not found.',
                recordName,
                inst,
                branch,
            });
            return;
        }

        const updates = (await this._instStore.getAllUpdates(
            recordName,
            inst,
            branch
        )) ?? {
            updates: [],
            timestamps: [],
        };

        await this._messenger.sendMessage([connection.serverConnectionId], {
            type: 'repo/add_updates',
            recordName,
            inst,
            branch: branch,
            updates: updates.updates,
            timestamps: updates.timestamps,
        });
    }

    @traced(TRACE_NAME)
    async eraseInst(
        recordKeyOrName: string | null,
        inst: string,
        userId: string
    ): Promise<EraseInstResult> {
        try {
            const context = await this._policies.constructAuthorizationContext({
                recordKeyOrRecordName: recordKeyOrName,
                userId,
            });

            if (context.success === false) {
                return context;
            }

            const recordName = context.context.recordName;
            const storedInst = await this._instStore.getInstByName(
                recordName,
                inst
            );

            if (!storedInst) {
                return {
                    success: true,
                };
            }

            const authResult = await this._policies.authorizeUserAndInstances(
                context.context,
                {
                    resourceKind: 'inst',
                    resourceId: inst,
                    action: 'delete',
                    markers: storedInst.markers,
                    userId,
                    instances: [],
                }
            );

            if (authResult.success === false) {
                return authResult;
            }

            await this._instStore.deleteInst(recordName, inst);

            return {
                success: true,
            };
        } catch (err) {
            console.error(
                '[WebsocketController] [eraseInst] Error while erasing inst.',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Processes a webhook and returns the status code that should be returned.
     * @param branch The branch that the webhook is for.
     * @param method The HTTP method that was used for the webhook.
     * @param url The URL that was requested.
     * @param headers The headers that were included in the request.
     * @param data The data included in the request.
     */
    @traced(TRACE_NAME)
    async webhook(
        recordName: string | null,
        inst: string,
        branch: string,
        method: string,
        url: string,
        headers: object,
        data: object
    ): Promise<number> {
        // TODO: Change webhooks to be records.
        if (recordName) {
            return;
        }

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

    /**
     * Requests that the user be given permission to access the given resource.
     * @param connectionId The ID of the connection that is making the request.
     * @param event The request missing permission event.
     */
    @traced(TRACE_NAME)
    async requestMissingPermission(
        connectionId: string,
        event: RequestMissingPermissionMessage
    ) {
        const connection = await this._connectionStore.getConnection(
            connectionId
        );
        if (!connection) {
            console.error(
                `[WebsocketController] [connectionId: ${connectionId}] Unable to request permission. Connection not found!`
            );
            await this.sendError(connectionId, -1, {
                success: false,
                errorCode: 'invalid_connection_state',
                errorMessage: `A server error occurred. (connectionId: ${connectionId})`,
            });
            await this.messenger.disconnect(connectionId);
            return;
        }

        if (event.reason.type !== 'missing_permission') {
            await this._messenger.sendMessage([connectionId], {
                type: 'permission/request/missing/response',
                success: false,
                recordName: event.reason.recordName,
                resourceKind: event.reason.resourceKind,
                resourceId: event.reason.resourceId,
                subjectType: event.reason.subjectType,
                subjectId: event.reason.subjectId,
                errorCode: 'unacceptable_request',
                errorMessage:
                    'It is only possible to request missing permissions.',
            });
            return;
        } else if (event.reason.resourceKind !== 'inst') {
            await this._messenger.sendMessage([connectionId], {
                type: 'permission/request/missing/response',
                success: false,
                recordName: event.reason.recordName,
                resourceKind: event.reason.resourceKind,
                resourceId: event.reason.resourceId,
                subjectType: event.reason.subjectType,
                subjectId: event.reason.subjectId,
                errorCode: 'unacceptable_request',
                errorMessage:
                    'Permissions can only be requested to access insts.',
            });
            return;
        } else if (
            event.reason.subjectType !== 'user' ||
            event.reason.subjectId !== connection.userId
        ) {
            await this._messenger.sendMessage([connectionId], {
                type: 'permission/request/missing/response',
                success: false,
                recordName: event.reason.recordName,
                resourceKind: event.reason.resourceKind,
                resourceId: event.reason.resourceId,
                subjectType: event.reason.subjectType,
                subjectId: event.reason.subjectId,
                errorCode: 'unacceptable_request',
                errorMessage:
                    'Permissions can only be requested for the current user.',
            });
            return;
        }

        const connections = await this._connectionStore.getConnectionsByBranch(
            'branch',
            event.reason.recordName,
            event.reason.resourceId,
            DEFAULT_BRANCH_NAME
        );

        if (connections.length > 0) {
            const userInfoResult = await this._auth.getPublicUserInfo(
                connection.userId
            );
            let userInfo: PublicUserInfo | null = null;
            if (userInfoResult.success === false) {
                console.error(
                    '[WebsocketController] [requestMissingPermission] Error while getting user info.',
                    userInfoResult
                );
            } else {
                userInfo = userInfoResult.user;
            }

            const inst = `${event.reason.resourceKind}/${event.reason.resourceId}`;
            const branch = `${event.reason.subjectType}/${event.reason.subjectId}`;
            await this._connectionStore.saveBranchConnection({
                ...connection,
                serverConnectionId: connectionId,
                mode: 'missing_permission',
                recordName: event.reason.recordName,
                inst: inst,
                branch: branch,
                temporary: true,
            });

            await this._messenger.sendMessage(
                connections.map((c) => c.serverConnectionId),
                {
                    type: 'permission/request/missing',
                    reason: event.reason,
                    connection: connectionInfo(connection),
                    user: userInfo,
                }
            );
        } else {
            await this._messenger.sendMessage([connectionId], {
                type: 'permission/request/missing/response',
                success: false,
                recordName: event.reason.recordName,
                resourceKind: event.reason.resourceKind,
                resourceId: event.reason.resourceId,
                subjectType: event.reason.subjectType,
                subjectId: event.reason.subjectId,
                errorCode: 'unacceptable_request',
                errorMessage:
                    'There are no currently no users available that can grant access to the inst.',
            });
            return;
        }
    }

    /**
     * Responds to a missing permission request.
     * @param connectionId The ID of the connection that is responding to the request.
     * @param event The response to the missing permission request.
     */
    @traced(TRACE_NAME)
    async respondToPermissionRequest(
        connectionId: string,
        event: RequestMissingPermissionResponseMessage
    ) {
        const connection = await this._connectionStore.getConnection(
            connectionId
        );
        if (!connection) {
            console.error(
                `[WebsocketController] [connectionId: ${connectionId}] Unable to respond to permission request. Connection not found!`
            );
            await this.sendError(connectionId, -1, {
                success: false,
                errorCode: 'invalid_connection_state',
                errorMessage: `A server error occurred. (connectionId: ${connectionId})`,
            });
            await this.messenger.disconnect(connectionId);
            return;
        }
        const inst = `${event.resourceKind}/${event.resourceId}`;
        const branch = `${event.subjectType}/${event.subjectId}`;
        const otherConnections =
            await this._connectionStore.getConnectionsByBranch(
                'missing_permission',
                event.recordName,
                inst,
                branch
            );

        if (otherConnections.length > 0) {
            for (let c of otherConnections) {
                await this._connectionStore.deleteBranchConnection(
                    c.serverConnectionId,
                    'missing_permission',
                    event.recordName,
                    inst,
                    branch
                );
            }

            await this._messenger.sendMessage(
                otherConnections.map((c) => c.serverConnectionId),
                {
                    type: 'permission/request/missing/response',
                    ...event,
                    connection: connectionInfo(connection),
                }
            );
        }
    }

    /**
     * Attempts to install a package into an inst.
     * @param request The request to load the package.
     */
    @traced(TRACE_NAME)
    async installPackage(
        request: LoadPackageRequest
    ): Promise<LoadPackageResult> {
        if (!this._packageVersions) {
            return {
                success: false,
                errorCode: 'not_supported',
                errorMessage: 'Package loading is not supported.',
            };
        }
        const userId = request.userId;
        const key = request.package.key ?? {};
        console.log(
            `[CausalRepoServer] [namespace: ${request.recordName}/${
                request.inst
            }, ${userId}, package: ${request.package.recordName}/${
                request.package.address
            }@${formatVersionSpecifier(key)}] Install Package`
        );

        const p = await this._packageVersions.getItem({
            recordName: request.package.recordName,
            address: request.package.address,
            key,
            userId: userId,
            instances: request.instances,
        });

        if (p.success === false) {
            console.error(
                `[CausalRepoServer] [userId: ${userId}] Unable to load package.`,
                p
            );
            return p;
        }
        if (p.auxFile.success === false) {
            console.error(
                `[CausalRepoServer] [userId: ${userId}] Unable to load package file.`,
                p.auxFile
            );
            return p.auxFile;
        }

        const loadedPackageStore = this._instStore;

        const loadedPackage = await loadedPackageStore.isPackageLoaded(
            request.recordName,
            request.inst,
            p.item.packageId
        );
        if (loadedPackage) {
            // Already loaded
            console.log(
                `[CausalRepoServer] [userId: ${userId}] Package already loaded.`
            );
            return {
                success: true,
                packageLoadId: loadedPackage.id,
                package: p.item,
            };
        }

        // check that the user and target inst has the ability to run the package
        const context = await this._policies.constructAuthorizationContext({
            recordKeyOrRecordName: request.package.recordName,
            userId,
        });

        if (context.success === false) {
            return context;
        }

        const authorization = await this._policies.authorizeUserAndInstances(
            context.context,
            {
                userId,
                instances: [formatInstId(request.recordName, request.inst)],
                resourceKind: 'package.version',
                resourceId: p.item.address,
                action: 'run',
                markers: p.item.markers,
            }
        );

        if (authorization.success === false) {
            return authorization;
        }

        const fileResponse = await fetch(p.auxFile.requestUrl, {
            method: p.auxFile.requestMethod,
            headers: new Headers(p.auxFile.requestHeaders),
        });

        if (fileResponse.status >= 300) {
            console.error(
                `[CausalRepoServer] [userId: ${userId}] Unable to load package file.`
            );

            // Failed
            return {
                success: false,
                errorCode: 'invalid_file_data',
                errorMessage: 'The package file could not be loaded.',
            };
        }

        const json = await fileResponse.text();

        const packageData = tryParseJson(json);

        if (packageData.success === false) {
            console.error(
                `[CausalRepoServer] [userId: ${userId}] Unable to parse package file.`,
                packageData
            );
            return {
                success: false,
                errorCode: 'invalid_file_data',
                errorMessage:
                    'The package file could not be parsed. It must be valid JSON.',
            };
        }

        const parsed = STORED_AUX_SCHEMA.safeParse(packageData.value);
        if (parsed.success === false) {
            console.error(
                `[CausalRepoServer] [userId: ${userId}] Unable to parse package file.`,
                packageData
            );
            return {
                success: false,
                errorCode: 'invalid_file_data',
                errorMessage: 'The package file could not be parsed.',
                issues: parsed.error.issues,
            };
        }

        const updates =
            parsed.data.version === 2
                ? parsed.data.updates.map((u) => u.update)
                : [
                      constructInitializationUpdate(
                          createInitializationUpdate(
                              Object.values(parsed.data.state as BotsState)
                          )
                      ).update,
                  ];
        const timestamps =
            parsed.data.version === 2
                ? parsed.data.updates.map((u) => u.timestamp)
                : [0];

        const branch = request.branch ?? DEFAULT_BRANCH_NAME;

        const result = await this.addUserUpdates({
            userId: request.userId,
            userRole: request.userRole,
            recordName: request.recordName,
            inst: request.inst,
            branch,
            updates: updates,
            timestamps: timestamps,
        });

        if (result.success === false) {
            return result;
        }

        const loadedPackageId = uuidv7();
        await loadedPackageStore.saveLoadedPackage({
            id: loadedPackageId,
            recordName: request.recordName,
            inst: request.inst,
            branch,

            packageId: p.item.packageId,
            packageVersionId: p.item.id,

            userId: userId,
        });

        return {
            success: true,
            packageLoadId: loadedPackageId,
            package: p.item,
        };
    }

    @traced(TRACE_NAME)
    async listInstalledPackages(
        request: ListInstalledPackagesRequest
    ): Promise<ListInstalledPackagesResult> {
        if (!this._packageVersions) {
            return {
                success: false,
                errorCode: 'not_supported',
                errorMessage: 'Packages are not supported.',
            };
        }

        if (request.recordName) {
            const context = await this._policies.constructAuthorizationContext({
                recordKeyOrRecordName: request.recordName,
                userId: request.userId,
            });

            if (context.success === false) {
                return context;
            }

            const recordName = context.context.recordName;
            const instName = request.inst;

            const savedInst = await this._instStore.getInstByName(
                recordName,
                instName
            );

            if (!savedInst) {
                return {
                    success: false,
                    errorCode: 'inst_not_found',
                    errorMessage: 'The inst was not found.',
                };
            }

            const authResult = await this._policies.authorizeUserAndInstances(
                context.context,
                {
                    resourceKind: 'inst',
                    resourceId: instName,
                    action: 'read',
                    markers: savedInst.markers,
                    userId: request.userId,
                    instances: request.instances,
                }
            );

            if (authResult.success === false) {
                return authResult;
            }
        }

        const packages = await this._instStore.listLoadedPackages(
            request.recordName,
            request.inst
        );

        return {
            success: true,
            packages: packages.map((p) => ({
                id: p.id,
                recordName: p.recordName,
                inst: p.inst,
                branch: p.branch,
                packageId: p.packageId,
                packageVersionId: p.packageVersionId,
                userId: p.userId,
            })),
        };
    }

    @traced(TRACE_NAME)
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
    @traced(TRACE_NAME)
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
    @traced(TRACE_NAME)
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
                await this.sendError(connectionId, requestId, {
                    success: false,
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
            await this.sendError(connectionId, requestId, {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'Error while processing upload request.',
            });
        }
    }

    @traced(TRACE_NAME)
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
                    errorCode: 'not_supported',
                    errorMessage: 'Download requests are not supported.',
                };
            } else if (message === null) {
                return {
                    success: false,
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
                errorCode: 'server_error',
                errorMessage: 'Error while processing download request.',
            };
        }
    }

    /**
     * Saves all of the permanent branches that are currently in memory.
     * @param timeout The timeout for the operation. Defaults to 30 seconds.
     */
    @traced(TRACE_NAME)
    async savePermanentBranches(timeout: number = 30_000): Promise<void> {
        const store = this._instStore;
        if (store instanceof SplitInstRecordsStore) {
            const unlock = await store.temp.acquireLock(
                SAVE_PERMANENT_BRANCHES_LOCK,
                timeout
            );

            if (!unlock) {
                console.log(
                    `[WebsocketController] [savePermanentBranches] Unable to acquire lock.`
                );
                return;
            }
            console.log(
                '[WebsocketController] [savePermanentBranches] Lock acquired.'
            );

            try {
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
                console.log(
                    `[WebsocketController] [savePermanentBranches] Saved.`
                );
            } finally {
                unlock();
                console.log(
                    '[WebsocketController] [savePermanentBranches] Released lock.'
                );
            }
        }
    }

    /**
     * Gets or creates the inst with the given name in the given record.
     *
     * If the inst already exists, and the given user is not authorized to read the inst, then an error is returned.
     * If the inst does not exist, and the user is not authorized to create a new inst, then an error is returned.
     *
     * @param recordName The name of the record.
     * @param instName The name of the inst.
     * @param userId The ID of the user that is trying to access the inst.
     * @param context The authorization context.
     */
    private async _getOrCreateInst(
        recordName: string | null,
        instName: string,
        userId: string,
        config: SubscriptionConfiguration,
        context: AuthorizationContext = null
    ): Promise<GetOrCreateInstResult> {
        let inst: InstWithSubscriptionInfo | null = null;
        let features: FeaturesConfiguration | null = null;
        if (recordName) {
            const getInstResult = await this._getInst(
                recordName,
                instName,
                userId,
                config,
                context
            );

            if (getInstResult.success === false) {
                return getInstResult;
            }

            const savedInst = getInstResult.inst;
            if (!context) {
                context = getInstResult.context;
            }
            if (!features) {
                features = getInstResult.features;
            }
            if (!savedInst) {
                if (!context) {
                    const contextResult =
                        await this._policies.constructAuthorizationContext({
                            recordKeyOrRecordName: recordName,
                            userId,
                        });

                    if (contextResult.success === false) {
                        return contextResult;
                    }
                    context = contextResult.context;
                }

                const authorizationResult =
                    await this._policies.authorizeUserAndInstancesForResources(
                        context,
                        {
                            userId: userId,
                            instances: [],
                            resources: [
                                {
                                    resourceKind: 'inst',
                                    resourceId: instName,
                                    action: 'create',
                                    markers: [PRIVATE_MARKER],
                                },
                                {
                                    resourceKind: 'marker',
                                    resourceId: PRIVATE_MARKER,
                                    action: 'assign',
                                    markers: [ACCOUNT_MARKER],
                                },
                                {
                                    resourceKind: 'inst',
                                    resourceId: instName,
                                    action: 'read',
                                    markers: [PRIVATE_MARKER],
                                },
                            ],
                        }
                    );

                if (authorizationResult.success === false) {
                    console.log(
                        '[WebsocketController] Unable to authorize inst creation.',
                        authorizationResult
                    );
                    return authorizationResult;
                }

                // const authorizeCreateResult =
                //     await this._policies.authorizeUserAndInstances(context, {
                //         resourceKind: 'inst',
                //         resourceId: instName,
                //         action: 'create',
                //         markers: [PRIVATE_MARKER],
                //         userId,
                //         instances: [],
                //     });

                // if (authorizeCreateResult.success === false) {
                //     console.log(
                //         '[WebsocketController] Unable to authorize inst creation.',
                //         authorizeCreateResult
                //     );
                //     return authorizeCreateResult;
                // }

                // const authorizeReadResult =
                //     await this._policies.authorizeUserAndInstances(context, {
                //         resourceKind: 'inst',
                //         resourceId: instName,
                //         action: 'read',
                //         markers: [PRIVATE_MARKER],
                //         userId,
                //         instances: [],
                //     });

                // if (authorizeReadResult.success === false) {
                //     console.log(
                //         '[WebsocketController] Unable to authorize inst creation.',
                //         authorizeReadResult
                //     );
                //     return authorizeReadResult;
                // }

                const instMetrics =
                    await this._metrics.getSubscriptionInstMetricsByRecordName(
                        recordName
                    );

                features = getSubscriptionFeatures(
                    config,
                    instMetrics.subscriptionStatus,
                    instMetrics.subscriptionId,
                    instMetrics.subscriptionType
                );

                if (!features.insts.allowed) {
                    return {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'Insts are not allowed for this subscription.',
                    };
                } else if (
                    typeof features.insts.maxInsts === 'number' &&
                    instMetrics.totalInsts >= features.insts.maxInsts
                ) {
                    return {
                        success: false,
                        errorCode: 'subscription_limit_reached',
                        errorMessage:
                            'The maximum number of insts has been reached.',
                    };
                }

                // Create the inst
                inst = {
                    recordName: recordName,
                    inst: instName,
                    markers: [PRIVATE_MARKER],
                    subscriptionId: instMetrics.subscriptionId,
                    subscriptionStatus: instMetrics.subscriptionStatus,
                    subscriptionType: instMetrics.subscriptionType,
                };
                const result = await this._instStore.saveInst(inst);
                if (result.success === false) {
                    console.log(
                        '[WebsocketController] Unable to save inst.',
                        result
                    );
                    return result;
                }
            } else {
                inst = savedInst;
            }
        } else {
            // null record name means public temporary inst
            const userInfo = await this._authStore.findUser(userId);
            if (userInfo) {
                const userPrivacyFeatures = userInfo.privacyFeatures;
                if (userPrivacyFeatures) {
                    if (!userPrivacyFeatures.allowPublicInsts) {
                        return {
                            success: false,
                            errorCode: 'not_authorized',
                            errorMessage: 'Public insts are not allowed.',
                        };
                    }
                }
            } else {
                const privoConfig = await this._config.getPrivoConfiguration();
                if (privoConfig) {
                    return {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage: 'Public insts are not allowed.',
                    };
                }
            }
        }

        return {
            success: true,
            inst,
            context,
            features,
        };
    }

    /**
     * Gets the inst with the given name in the given record.
     *
     * If the inst does not exist, then null is returned.
     * If the given user is not authorized to read the inst, then an error is returned.
     *
     * @param recordName The name of the record.
     * @param instName The name of the inst.
     * @param userId The ID of the user that is trying to access the inst.
     */
    private async _getInst(
        recordName: string | null,
        instName: string,
        userId: string,
        config: SubscriptionConfiguration,
        context: AuthorizationContext = null
    ): Promise<GetOrCreateInstResult> {
        let inst: InstWithSubscriptionInfo | null = null;
        let features: FeaturesConfiguration | null = null;
        if (recordName) {
            const savedInst = await this._instStore.getInstByName(
                recordName,
                instName
            );

            if (savedInst) {
                features = getSubscriptionFeatures(
                    config,
                    savedInst.subscriptionStatus,
                    savedInst.subscriptionId,
                    savedInst.subscriptionType
                );

                if (!features.insts.allowed) {
                    return {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'Insts are not allowed for this subscription.',
                    };
                }

                if (!context) {
                    const contextResult =
                        await this._policies.constructAuthorizationContext({
                            recordKeyOrRecordName: recordName,
                            userId,
                        });

                    if (contextResult.success === false) {
                        return contextResult;
                    }
                    context = contextResult.context;
                }

                const authorizeResult =
                    await this._policies.authorizeUserAndInstances(context, {
                        resourceKind: 'inst',
                        resourceId: instName,
                        action: 'read',
                        markers: savedInst.markers,
                        userId,
                        instances: [],
                    });

                if (authorizeResult.success === false) {
                    console.log(
                        '[WebsocketController] Unable to authorize inst read.',
                        authorizeResult
                    );
                    return authorizeResult;
                }
            }

            return {
                success: true,
                inst: savedInst,
                context,
                features,
            };
        }

        return {
            success: true,
            inst,
            context,
            features,
        };
    }

    private async _getOrCreateBranch(
        recordName: string,
        inst: string,
        branch: string,
        temporary: boolean,
        linkedInst: InstWithSubscriptionInfo
    ) {
        if (temporary) {
            let b = await this._temporaryStore.getBranchByName(
                recordName,
                inst,
                branch
            );
            if (!b) {
                // Save the branch to the temp store
                await this._temporaryStore.saveBranchInfo({
                    recordName: recordName,
                    inst: inst,
                    branch: branch,
                    temporary: true,
                    linkedInst: linkedInst,
                });
                b = await this._temporaryStore.getBranchByName(
                    recordName,
                    inst,
                    branch
                );
            }

            return b;
        } else {
            let b = await this._instStore.getBranchByName(
                recordName,
                inst,
                branch
            );
            if (!b) {
                // Save the branch to the inst store
                await this._instStore.saveBranch({
                    branch: branch,
                    inst: inst,
                    recordName: recordName,
                    temporary: temporary || false,
                });
                b = await this._instStore.getBranchByName(
                    recordName,
                    inst,
                    branch
                );
            }

            return b;
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
            const doc = new Doc({
                gc: true,
            });

            for (let update of updates.updates) {
                const bytes = toByteArray(update);
                applyUpdate(doc, bytes);
            }

            const mergedBytes = encodeStateAsUpdate(doc);
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

    async sendError(
        connectionId: string,
        requestId: number,
        info: WebsocketErrorInfo
    ) {
        await this.sendEvent(connectionId, [
            WebsocketEventTypes.Error,
            requestId,
            info,
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

export interface DownloadRequestFailure extends WebsocketErrorInfo {
    success: false;
}

export type GetOrCreateInstResult =
    | GetOrCreateInstSuccess
    | GetOrCreateInstFailure;

export interface GetOrCreateInstSuccess {
    success: true;
    inst: InstWithSubscriptionInfo | null;

    /**
     * The context that was used to authorize the request.
     * Guaranteed to be non-null if the inst is non-null.
     */
    context: AuthorizationContext;

    /**
     * The features that are available for the subscription.
     */
    features: FeaturesConfiguration | null;
}

export interface GetOrCreateInstFailure {
    success: false;
    errorCode:
        | ConstructAuthorizationContextFailure['errorCode']
        | AuthorizeSubjectFailure['errorCode']
        | SaveInstFailure['errorCode'];
    errorMessage: string;
    reason?: DenialReason;
}

export type GetBranchDataResult = GetBranchDataSuccess | GetBranchDataFailure;

export interface GetBranchDataSuccess {
    success: true;
    data: StoredAux;
}

export interface GetBranchDataFailure {
    success: false;
    errorCode:
        | ServerError
        | 'inst_not_found'
        | ConstructAuthorizationContextFailure['errorCode']
        | AuthorizeSubjectFailure['errorCode']
        | GetOrCreateInstFailure['errorCode'];
    errorMessage: string;
    reason?: DenialReason;
}

export type ListInstsResult = ListInstsSuccess | ListInstsFailure;

export interface ListInstsSuccess {
    success: true;
    insts: InstRecord[];
    totalCount: number;
}

export interface ListInstsFailure {
    success: false;
    errorCode:
        | ServerError
        | 'record_not_found'
        | NotSupportedError
        | ConstructAuthorizationContextFailure['errorCode']
        | AuthorizeSubjectFailure['errorCode']
        | GetOrCreateInstFailure['errorCode'];
    errorMessage: string;
    reason?: DenialReason;
}

export type EraseInstResult = EraseInstSuccess | EraseInstFailure;

export interface EraseInstSuccess {
    success: true;
}

export interface EraseInstFailure {
    success: false;
    errorCode:
        | ServerError
        | 'inst_not_found'
        | NotSupportedError
        | ConstructAuthorizationContextFailure['errorCode']
        | AuthorizeSubjectFailure['errorCode']
        | GetOrCreateInstFailure['errorCode'];
    errorMessage: string;
    reason?: DenialReason;
}

export interface AddUpdatesRequest {
    /**
     * The ID of the currently logged in user.
     */
    userId: string | null;

    /**
     * The role of the currently logged in user.
     */
    userRole?: UserRole | null;

    /**
     * The name of the record that the branch is for.
     * Null if the branch should be public and non-permanent.
     */
    recordName: string | null;

    /**
     * The name of the inst.
     */
    inst: string;

    /**
     * The branch that the updates are for.
     */
    branch: string;

    /**
     * The updates that should be added.
     */
    updates: string[];

    // /**
    //  * The ID for this "add update" event.
    //  * Used in the subsequent "update received" event to indicate
    //  * that this update was received and processed.
    //  *
    //  * This property is optional because update IDs are only needed for updates which are sent to the
    //  * server to be saved. (i.e. the client needs confirmation that it was saved) The server needs no such
    //  * confirmation, so it does not need to include an update ID.
    //  */
    // updateId?: number;

    /**
     * Whether this message should be treated as the first message
     * after a watch_branch event.
     * This flag MUST be included on the first message as large apiary messages may appear out of order.
     */
    initial?: boolean;

    /**
     * The list of timestamps that the updates occurred at.
     */
    timestamps?: number[];
}

export type AddInstUpdatesResult =
    | AddInstUpdatesSuccess
    | AddInstUpdatesFailure;

export interface AddInstUpdatesSuccess {
    success: true;
}

export interface AddInstUpdatesFailure {
    success: false;
    errorCode: KnownErrorCodes;
    errorMessage: string;
    reason?: DenialReason;
}

export interface LoadPackageRequest {
    /**
     * The ID of the currently logged in user.
     */
    userId: string | null;

    /**
     * The role of the currently logged in user.
     */
    userRole?: UserRole | null;

    /**
     * The name of the record that the package should be loaded into.
     * Null if the inst is a public inst.
     */
    recordName: string | null;

    /**
     * The inst that the package should be loaded into.
     */
    inst: string;

    /**
     * The branch that the package should be loaded into.
     * If omitted, then the default branch will be used.
     */
    branch?: string;

    /**
     * The package that should be loaded.
     */
    package: PackageVersionSpecifier;

    /**
     * The list of instances that are currently loaded.
     */
    instances?: string[];
}

export type LoadPackageResult = LoadPackageSuccess | LoadPackageFailure;

export interface LoadPackageSuccess {
    success: true;

    /**
     * The ID of the record which records that the package was loaded into the inst.
     */
    packageLoadId: string;

    /**
     * The package that was loaded.
     */
    package: PackageRecordVersionWithMetadata;
}

export interface LoadPackageFailure {
    success: false;
    errorCode: KnownErrorCodes;
    errorMessage: string;
    reason?: DenialReason;
    issues?: ZodIssue[];
}

export interface ListInstalledPackagesRequest {
    /**
     * The ID of the currently logged in user.
     */
    userId: string | null;

    /**
     * The role of the currently logged in user.
     */
    userRole?: UserRole | null;

    /**
     * The name of the record that the installed packages should be listed from.
     * If null, then the inst is a public inst.
     */
    recordName: string | null;

    /**
     * The inst that the installed packages should be listed from.
     */
    inst: string;

    /**
     * The instances that are trying to list the packages.
     */
    instances?: string[];
}

export type ListInstalledPackagesResult =
    | ListInstalledPackagesRequestSuccess
    | ListInstalledPackagesFailure;

export interface ListInstalledPackagesRequestSuccess {
    success: true;
    packages: LoadedPackage[];
}

export interface ListInstalledPackagesFailure {
    success: false;
    errorCode: KnownErrorCodes;
    errorMessage: string;
    reason?: DenialReason;
    issues?: ZodIssue[];
}
