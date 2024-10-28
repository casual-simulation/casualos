import { ConfigurationStore } from '../../ConfigurationStore';
import { MetricsStore } from '../../MetricsStore';
import { PolicyController } from '../../PolicyController';
import { AuthController } from '../../AuthController';
import { AuthStore } from '../../AuthStore';
import {
    CurrentUpdates,
    InstRecordsStore,
    InstWithSubscriptionInfo,
} from '../InstRecordsStore';
import { TemporaryInstRecordsStore } from '../TemporaryInstRecordsStore';
import { WebsocketConnectionStore } from '../WebsocketConnectionStore';
import { WebsocketMessenger } from '../WebsocketMessenger';
import {
    ResourceKinds,
    WatchBranchMessage,
    WebsocketErrorInfo,
    WebsocketEvent,
    WebsocketEventTypes,
} from '@casual-simulation/aux-common';
import { traced } from '../../tracing/TracingDecorators';

export const TRACE_NAME = 'UpdatesRecordsController';

export interface UpdatesRecordsControllerConfig {
    connectionStore: WebsocketConnectionStore;
    messenger: WebsocketMessenger;
    instStore: InstRecordsStore;
    temporaryInstStore: TemporaryInstRecordsStore;
    auth: AuthController;
    policies: PolicyController;
    config: ConfigurationStore;
    metrics: MetricsStore;
    authStore: AuthStore;

    /**
     * The kind of resources that are manipulated by the controller.
     */
    resourceKind: ResourceKinds;
}

/**
 * Defines a class for controllers that store and manage resources that utilize YJS CRDT Updates and websocketes.
 */
export class UpdatesRecordsController {
    private _connectionStore: WebsocketConnectionStore;
    private _messenger: WebsocketMessenger;
    private _instStore: InstRecordsStore;
    private _temporaryStore: TemporaryInstRecordsStore;
    private _auth: AuthController;
    private _policies: PolicyController;
    private _config: ConfigurationStore;
    private _metrics: MetricsStore;
    private _authStore: AuthStore;
    private _resourceKind: ResourceKinds;

    get messenger() {
        return this._messenger;
    }

    constructor(config: UpdatesRecordsControllerConfig) {
        this._connectionStore = config.connectionStore;
        this._messenger = config.messenger;
        this._instStore = config.instStore;
        this._temporaryStore = config.temporaryInstStore;
        this._auth = config.auth;
        this._authStore = config.authStore;
        this._policies = config.policies;
        this._config = config.config;
        this._metrics = config.metrics;
        this._resourceKind = config.resourceKind;
    }

    @traced(TRACE_NAME)
    async watchBranch(connectionId: string, event: WatchBranchMessage) {
        if (!event) {
            console.warn(
                '[CasualRepoServer] Trying to watch branch with a null event!'
            );
            return;
        }

        console.log(
            `[UpdatesRecordsController] [namespace: ${event.recordName}/${event.inst}/${event.branch}, ${connectionId}] Watch`
        );

        const connection = await this._connectionStore.getConnection(
            connectionId
        );
        if (!connection) {
            console.error(
                `[UpdatesRecordsController] [namespace: ${event.recordName}/${event.inst}/${event.branch}, connectionId: ${connectionId}] Unable to watch branch. Connection not found!`
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
                await this.messenger.sendMessage([connectionId], {
                    type: 'repo/watch_branch_result',
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage: 'You are not authorized to access this inst.',
                    recordName: event.recordName,
                    inst: event.inst,
                    branch: event.branch,
                });
                return;
            }
        }

        const config = await this._config.getSubscriptionConfiguration();

        if (!event.recordName) {
            if (config?.defaultFeatures?.publicInsts?.allowed === false) {
                await this.messenger.sendMessage([connectionId], {
                    type: 'repo/watch_branch_result',
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

        const instResult = await this._getOrCreateInst(
            event.recordName,
            event.inst,
            connection.userId,
            config
        );

        if (instResult.success === false) {
            await this.messenger.sendMessage([connectionId], {
                ...instResult,
                type: 'repo/watch_branch_result',
                recordName: event.recordName,
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
            !event.recordName &&
            typeof config?.defaultFeatures?.publicInsts
                ?.maxActiveConnectionsPerInst === 'number'
        ) {
            maxConnections =
                config.defaultFeatures.publicInsts.maxActiveConnectionsPerInst;
        }

        if (maxConnections) {
            const count = await this._connectionStore.countConnectionsByBranch(
                'branch',
                event.recordName,
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
                    recordName: event.recordName,
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
            recordName: event.recordName,
            inst: event.inst,
            branch: event.branch,
            temporary: event.temporary || false,
        });

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
            this._messenger.sendMessage([connection.serverConnectionId], {
                type: 'repo/watch_branch_result',
                recordName: event.recordName,
                inst: event.inst,
                branch: event.branch,
                success: true,
            }),
        ];
        await Promise.all(promises);
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
