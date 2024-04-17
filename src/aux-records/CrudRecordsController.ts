import {
    AuthorizeSubjectFailure,
    AuthorizeUserAndInstancesForResourcesResult,
    AuthorizeUserAndInstancesForResourcesSuccess,
    AuthorizeUserAndInstancesResult,
    AuthorizeUserAndInstancesSuccess,
    PolicyController,
    getMarkerResourcesForCreation,
    getMarkerResourcesForUpdate,
} from './PolicyController';
import {
    CrudRecord,
    CrudRecordsStore,
    CrudSubscriptionMetrics,
} from './CrudRecordsStore';
import { ConfigurationStore } from './ConfigurationStore';
import {
    ActionKinds,
    KnownErrorCodes,
    NotAuthorizedError,
    NotLoggedInError,
    ResourceKinds,
    ServerError,
} from '@casual-simulation/aux-common';
import { ValidatePublicRecordKeyFailure } from './RecordsController';

export interface CrudRecordsConfiguration<
    T extends CrudRecord,
    TMetrics extends CrudSubscriptionMetrics = CrudSubscriptionMetrics
> {
    /**
     * The name for the controller.
     */
    name: string;

    store: CrudRecordsStore<T, TMetrics>;
    policies: PolicyController;
    config: ConfigurationStore;

    /**
     * Whether record keys can be used to access items.
     */
    allowRecordKeys: boolean;

    /**
     * The kind of resource that the controller is for.
     */
    resourceKind: ResourceKinds;

    /**
     * Checks that the given metrics are valid for the subscription.
     * @param metrics The metrics that were fetched from the database.
     * @param action The action that is being performed.
     * @param authorization The authorization for the user and instances.
     */
    checkSubscriptionMetrics(
        metrics: TMetrics,
        action: ActionKinds,
        authorization: AuthorizeUserAndInstancesForResourcesSuccess
    ): Promise<CheckSubscriptionMetricsResult>;
}

/**
 * Defines a controller that can be used to present a CRUD API.
 */
export class CrudRecordsController<
    T extends CrudRecord,
    TMetrics extends CrudSubscriptionMetrics = CrudSubscriptionMetrics
> {
    private _store: CrudRecordsStore<T, TMetrics>;
    private _policies: PolicyController;
    private _config: ConfigurationStore;
    private _name: string;
    private _allowRecordKeys: boolean;
    private _resourceKind: ResourceKinds;
    private _checkSubscriptionMetrics: CrudRecordsConfiguration<
        T,
        TMetrics
    >['checkSubscriptionMetrics'];

    constructor(config: CrudRecordsConfiguration<T, TMetrics>) {
        this._name = config.name;
        this._allowRecordKeys = config.allowRecordKeys;
        this._store = config.store;
        this._policies = config.policies;
        this._config = config.config;
        this._resourceKind = config.resourceKind;
        this._checkSubscriptionMetrics = config.checkSubscriptionMetrics;
    }

    async recordItem(
        request: CrudRecordItemRequest<T>
    ): Promise<CrudRecordItemResult> {
        try {
            const contextResult =
                await this._policies.constructAuthorizationContext({
                    recordKeyOrRecordName: request.recordKeyOrRecordName,
                    userId: request.userId,
                });

            if (contextResult.success === false) {
                return contextResult;
            }

            if (
                !this._allowRecordKeys &&
                contextResult.context.recordKeyProvided
            ) {
                return {
                    success: false,
                    errorCode: 'invalid_record_key',
                    errorMessage:
                        'Record keys are not allowed for these items.',
                };
            }

            const recordName = contextResult.context.recordName;
            const existingItem = await this._store.getItemByAddress(
                recordName,
                request.item.address
            );

            let resourceMarkers: string[];
            let action = existingItem
                ? ('update' as const)
                : ('create' as const);
            let authorization: AuthorizeUserAndInstancesForResourcesResult;
            if (action === 'update') {
                const existingMarkers = existingItem.markers;
                resourceMarkers = request.item.markers ?? existingMarkers;
                action = 'update';

                authorization =
                    await this._policies.authorizeUserAndInstancesForResources(
                        contextResult.context,
                        {
                            userId: request.userId,
                            instances: request.instances,
                            resources: [
                                {
                                    resourceKind: this._resourceKind,
                                    resourceId: existingItem.address,
                                    action: action,
                                    markers: resourceMarkers,
                                },
                                ...getMarkerResourcesForUpdate(
                                    existingMarkers,
                                    request.item.markers
                                ),
                            ],
                        }
                    );

                if (authorization.success === false) {
                    return authorization;
                }
            } else {
                resourceMarkers = request.item.markers;

                authorization =
                    await this._policies.authorizeUserAndInstancesForResources(
                        contextResult.context,
                        {
                            userId: request.userId,
                            instances: request.instances,
                            resources: [
                                {
                                    resourceKind: this._resourceKind,
                                    resourceId: request.item.address,
                                    action: action,
                                    markers: resourceMarkers,
                                },
                                ...getMarkerResourcesForCreation(
                                    resourceMarkers
                                ),
                            ],
                        }
                    );

                if (authorization.success === false) {
                    return authorization;
                }
            }

            if (!resourceMarkers) {
                return {
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: 'The item must have markers.',
                };
            }

            const metrics =
                await this._store.getSubscriptionMetricsByRecordName(
                    recordName
                );

            const subscriptionResult = await this._checkSubscriptionMetrics(
                metrics,
                action,
                authorization
            );

            if (subscriptionResult.success === false) {
                return subscriptionResult;
            }

            await this._store.putItem(recordName, request.item);
            return {
                success: true,
                recordName,
                address: request.item.address,
            };
        } catch (err) {
            console.error(`[${this._name}] Error recording item:`, err);
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }
}

export interface CrudRecordItemRequest<T> {
    /**
     * The ID of the user who is currently logged in.
     */
    userId: string;

    /**
     * The key or name of the record.
     */
    recordKeyOrRecordName: string;

    /**
     * The instances that the request is coming from.
     */
    instances: string[];

    /**
     * The item that should be recorded.
     */
    item: T;
}

export type CrudRecordItemResult =
    | CrudRecordItemSuccess
    | CrudRecordItemFailure;

export interface CrudRecordItemSuccess {
    success: true;
    recordName: string;
    address: string;
}

export interface CrudRecordItemFailure {
    success: false;
    errorCode:
        | ServerError
        | NotLoggedInError
        | NotAuthorizedError
        | ValidatePublicRecordKeyFailure['errorCode']
        | AuthorizeSubjectFailure['errorCode']
        | 'invalid_request';
    errorMessage: string;
}

export type CheckSubscriptionMetricsResult =
    | CheckSubscriptionMetricsSuccess
    | CheckSubscriptionMetricsFailure;

export interface CheckSubscriptionMetricsSuccess {
    success: true;
}

export interface CheckSubscriptionMetricsFailure {
    success: false;
    errorCode: ServerError | 'subscription_limit_reached' | NotAuthorizedError;
    errorMessage: string;
}
