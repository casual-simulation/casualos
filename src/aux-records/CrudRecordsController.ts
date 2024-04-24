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
    ACCOUNT_MARKER,
    ActionKinds,
    KnownErrorCodes,
    NotAuthorizedError,
    NotLoggedInError,
    PUBLIC_READ_MARKER,
    ResourceKinds,
    ServerError,
} from '@casual-simulation/aux-common';
import { ValidatePublicRecordKeyFailure } from './RecordsController';
import { ZodIssue } from 'zod';

export interface CrudRecordsConfiguration<
    T extends CrudRecord,
    TMetrics extends CrudSubscriptionMetrics = CrudSubscriptionMetrics,
    TStore extends CrudRecordsStore<T, TMetrics> = CrudRecordsStore<T, TMetrics>
> {
    /**
     * The name for the controller.
     */
    name: string;

    /**
     * The store that the controller uses.
     */
    store: TStore;

    /**
     * The policy controller.
     */
    policies: PolicyController;

    /**
     * The configuration store.
     */
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
    TStore extends CrudRecordsStore<T, TMetrics> = CrudRecordsStore<
        T,
        TMetrics
    >,
    TResult extends Partial<T> = T
> {
    private _store: TStore;
    private _policies: PolicyController;
    private _config: ConfigurationStore;
    private _name: string;
    private _allowRecordKeys: boolean;
    private _resourceKind: ResourceKinds;

    protected get config() {
        return this._config;
    }

    protected get name() {
        return this._name;
    }

    protected get policies() {
        return this._policies;
    }

    protected get store() {
        return this._store;
    }

    protected get allowRecordKeys() {
        return this._allowRecordKeys;
    }

    protected get resourceKind() {
        return this._resourceKind;
    }

    constructor(config: CrudRecordsConfiguration<T, TMetrics, TStore>) {
        this._name = config.name;
        this._allowRecordKeys = config.allowRecordKeys;
        this._store = config.store;
        this._policies = config.policies;
        this._config = config.config;
        this._resourceKind = config.resourceKind;
    }

    /**
     * Creates or updates an item in the given record.
     * @param request The request.
     */
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

            const item = request.item;
            const subscriptionResult = await this._checkSubscriptionMetrics(
                action,
                authorization,
                item
            );

            if (subscriptionResult.success === false) {
                return subscriptionResult;
            }

            await this._store.putItem(recordName, item);
            return {
                success: true,
                recordName,
                address: item.address,
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

    /**
     * Gets the item with the given address from the given record.
     * @param request The request to get the item.
     */
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

    /**
     * Deletes the item with the given address from the given record.
     * @param request The request.
     */
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

            const recordName = context.context.recordName;
            const subscriptionResult = await this._checkSubscriptionMetrics(
                'delete',
                authorization
            );

            if (subscriptionResult.success === false) {
                return subscriptionResult;
            }

            await this._store.deleteItem(recordName, request.address);

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
     * Lists items in the given record.
     * @param request The request.
     */
    async listItems(
        request: CrudListItemsRequest
    ): Promise<CrudListItemsResult<TResult>> {
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

            const authorization =
                await this._policies.authorizeUserAndInstances(
                    context.context,
                    {
                        userId: request.userId,
                        instances: request.instances,
                        resourceKind: this._resourceKind,
                        action: 'list',
                        markers: [ACCOUNT_MARKER],
                    }
                );

            if (authorization.success === false) {
                return authorization;
            }

            const result2 = await this._store.listItems(
                context.context.recordName,
                request.startingAddress
            );

            return {
                success: true,
                recordName: context.context.recordName,
                items: result2.items.map((item) =>
                    this._convertItemToResult(item, context.context)
                ),
                totalCount: result2.totalCount,
            };
        } catch (err) {
            console.error(`[${this._name}] Error listing items:`, err);
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Lists items in the given record by the given marker.
     * @param request The request.
     */
    async listItemsByMarker(
        request: CrudListItemsByMarkerRequest
    ): Promise<CrudListItemsResult<TResult>> {
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

            const authorization =
                await this._policies.authorizeUserAndInstances(
                    context.context,
                    {
                        userId: request.userId,
                        instances: request.instances,
                        resourceKind: this._resourceKind,
                        action: 'list',
                        markers: [request.marker],
                    }
                );

            if (authorization.success === false) {
                return authorization;
            }

            const result2 = await this._store.listItemsByMarker({
                recordName: context.context.recordName,
                startingAddress: request.startingAddress,
                marker: request.marker,
                sort: request.sort,
            });

            return {
                success: true,
                recordName: context.context.recordName,
                items: result2.items.map((item) =>
                    this._convertItemToResult(item, context.context)
                ),
                totalCount: result2.totalCount,
            };
        } catch (err) {
            console.error(`[${this._name}] Error listing items:`, err);
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
     * @param item The item that should be checked. Omitted for delete actions.
     */
    protected abstract _checkSubscriptionMetrics(
        action: ActionKinds,
        authorization:
            | AuthorizeUserAndInstancesSuccess
            | AuthorizeUserAndInstancesForResourcesSuccess,
        item?: T
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
    errorCode:
        | ServerError
        | 'subscription_limit_reached'
        | NotAuthorizedError
        | 'unacceptable_request';
    errorMessage: string;
    issues?: ZodIssue[];
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

export interface CrudListItemsRequest {
    /**
     * The name of the record that the request is for.
     * Can also be a record key.
     */
    recordName: string;

    /**
     * The ID of the user who is currently logged in.
     */
    userId: string;

    /**
     * The instances that the request is coming from.
     */
    instances: string[];

    /**
     * The address that the list should start at.
     */
    startingAddress?: string | null;
}

export interface CrudListItemsByMarkerRequest extends CrudListItemsRequest {
    /**
     * The marker that the items should have.
     */
    marker: string;

    /**
     * The sort order that the items should be listed in.
     */
    sort?: 'ascending' | 'descending';
}

export type CrudListItemsResult<T> =
    | CrudListItemsSuccess<T>
    | CrudListItemsFailure;

export interface CrudListItemsSuccess<T> {
    success: true;
    /**
     * The name of the record that the items are from.
     */
    recordName: string;

    /**
     * The items that were listed.
     */
    items: T[];

    /**
     * The total number of items in the record.
     */
    totalCount: number;

    /**
     * The marker that was listed.
     * If null, then all markers are listed.
     */
    marker?: string;
}

export interface CrudListItemsFailure {
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
