import {
    AuthorizationContext,
    AuthorizeSubjectFailure,
    AuthorizeUserAndInstancesForResourcesResult,
    AuthorizeUserAndInstancesForResourcesSuccess,
    AuthorizeUserAndInstancesResult,
    AuthorizeUserAndInstancesSuccess,
    ConstructAuthorizationContextFailure,
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
    PUBLIC_READ_MARKER,
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
}

/**
 * Defines a controller that can be used to present a CRUD API.
 */
export abstract class CrudRecordsController<
    T extends CrudRecord,
    TMetrics extends CrudSubscriptionMetrics = CrudSubscriptionMetrics,
    TResult extends Partial<T> = T
> {
    private _store: CrudRecordsStore<T, TMetrics>;
    private _policies: PolicyController;
    private _config: ConfigurationStore;
    private _name: string;
    private _allowRecordKeys: boolean;
    private _resourceKind: ResourceKinds;

    constructor(config: CrudRecordsConfiguration<T, TMetrics>) {
        this._name = config.name;
        this._allowRecordKeys = config.allowRecordKeys;
        this._store = config.store;
        this._policies = config.policies;
        this._config = config.config;
        this._resourceKind = config.resourceKind;
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

    async getItem(
        request: CrudGetItemRequest
    ): Promise<CrudGetItemResult<TResult>> {
        try {
            const baseRequest = {
                recordKeyOrRecordName: request.recordName,
                userId: request.userId,
                instances: request.instances,
            };

            const context = await this._policies.constructAuthorizationContext(
                baseRequest
            );

            if (context.success === false) {
                return context;
            }

            if (!this._allowRecordKeys && context.context.recordKeyProvided) {
                return {
                    success: false,
                    errorCode: 'invalid_record_key',
                    errorMessage:
                        'Record keys are not allowed for these items.',
                };
            }

            const result = await this._store.getItemByAddress(
                context.context.recordName,
                request.address
            );

            if (!result) {
                return {
                    success: false,
                    errorCode: 'data_not_found',
                    errorMessage: 'The item was not found.',
                };
            }

            const markers = result.markers;
            const authorization =
                await this._policies.authorizeUserAndInstances(
                    context.context,
                    {
                        userId: request.userId,
                        instances: request.instances,
                        resourceKind: this._resourceKind,
                        resourceId: request.address,
                        action: 'read',
                        markers: markers,
                    }
                );

            if (authorization.success === false) {
                return authorization;
            }

            return {
                success: true,
                item: this._convertItemToResult(result, context.context),
            };
        } catch (err) {
            console.error(`[${this._name}] Error getting item:`, err);
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    async eraseItem(
        request: CrudEraseItemRequest
    ): Promise<CrudEraseItemResult> {
        try {
            const context = await this._policies.constructAuthorizationContext({
                recordKeyOrRecordName: request.recordName,
                userId: request.userId,
            });

            if (context.success === false) {
                return context;
            }

            if (!this._allowRecordKeys && context.context.recordKeyProvided) {
                return {
                    success: false,
                    errorCode: 'invalid_record_key',
                    errorMessage:
                        'Record keys are not allowed for these items.',
                };
            }

            const result = await this._store.getItemByAddress(
                context.context.recordName,
                request.address
            );

            if (!result) {
                return {
                    success: false,
                    errorCode: 'data_not_found',
                    errorMessage: 'The item was not found.',
                };
            }

            const markers = result.markers;

            const authorization =
                await this._policies.authorizeUserAndInstances(
                    context.context,
                    {
                        userId: request.userId,
                        instances: request.instances,
                        resourceKind: this._resourceKind,
                        resourceId: request.address,
                        action: 'delete',
                        markers,
                    }
                );

            if (authorization.success === false) {
                return authorization;
            }

            await this._store.deleteItem(
                context.context.recordName,
                request.address
            );

            return {
                success: true,
            };
        } catch (err) {
            console.error(`[${this._name}] Error erasing item:`, err);
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Checks that the given metrics are valid for the subscription.
     * @param metrics The metrics that were fetched from the database.
     * @param action The action that is being performed.
     * @param authorization The authorization for the user and instances.
     */
    protected abstract _checkSubscriptionMetrics(
        metrics: TMetrics,
        action: ActionKinds,
        authorization: AuthorizeUserAndInstancesForResourcesSuccess
    ): Promise<CheckSubscriptionMetricsResult>;

    /**
     * Converts the given item to a version that is able to be returned to clients.
     * Can be overriden to ensure that some fields are not returned.
     * @param item The item that should be converted.
     * @param context The authorization context.
     * @returns The converted item.
     */
    protected _convertItemToResult(
        item: T,
        context: AuthorizationContext
    ): TResult {
        return item as unknown as TResult;
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

export interface CrudGetItemRequest {
    /**
     * The name of the record that the request is for.
     * Can also be a record key.
     */
    recordName: string;

    /**
     * The address of the item that should be retrieved.
     */
    address: string;

    /**
     * The ID of the user who is currently logged in.
     */
    userId: string;

    /**
     * The instances that the request is coming from.
     */
    instances: string[];
}

export type CrudGetItemResult<T> = CrudGetItemSuccess<T> | CrudGetItemFailure;

export interface CrudGetItemSuccess<T> {
    success: true;
    item: T;
}

export interface CrudGetItemFailure {
    success: false;
    errorCode:
        | ServerError
        | NotLoggedInError
        | NotAuthorizedError
        | ConstructAuthorizationContextFailure['errorCode']
        | AuthorizeSubjectFailure['errorCode']
        | 'data_not_found';
    errorMessage: string;
}

export interface CrudEraseItemRequest {
    /**
     * The name of the record that the request is for.
     * Can also be a record key.
     */
    recordName: string;

    /**
     * The address of the item that should be erased.
     */
    address: string;

    /**
     * The ID of the user who is currently logged in.
     */
    userId: string;

    /**
     * The instances that the request is coming from.
     */
    instances: string[];
}

export type CrudEraseItemResult = CrudEraseItemSuccess | CrudEraseItemFailure;

export interface CrudEraseItemSuccess {
    success: true;
}

export interface CrudEraseItemFailure {
    success: false;
    errorCode:
        | ServerError
        | NotLoggedInError
        | NotAuthorizedError
        | ConstructAuthorizationContextFailure['errorCode']
        | AuthorizeSubjectFailure['errorCode']
        | 'data_not_found';
    errorMessage: string;
}
