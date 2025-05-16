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
    AuthorizationContext,
    AuthorizeSubjectFailure,
    AuthorizeUserAndInstancesForResourcesResult,
    AuthorizeUserAndInstancesForResourcesSuccess,
    AuthorizeUserAndInstancesSuccess,
    ConstructAuthorizationContextFailure,
    PolicyController,
} from '../PolicyController';
import {
    getMarkerResourcesForCreation,
    getMarkerResourcesForUpdate,
} from '../PolicyController';
import type { CrudRecord, CrudRecordsStore } from './CrudRecordsStore';
import type { ConfigurationStore } from '../ConfigurationStore';
import type {
    ActionKinds,
    KnownErrorCodes,
    NotAuthorizedError,
    NotLoggedInError,
    ResourceKinds,
    ServerError,
} from '@casual-simulation/aux-common';
import { ACCOUNT_MARKER } from '@casual-simulation/aux-common';
import type { ZodIssue } from 'zod';
import { traced } from '../tracing/TracingDecorators';
import { SpanStatusCode, trace } from '@opentelemetry/api';

export interface CrudRecordsConfiguration<
    T extends CrudRecord,
    TStore extends CrudRecordsStore<T> = CrudRecordsStore<T>
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
     * The kind of resource that the controller is for.
     */
    resourceKind: ResourceKinds;
}

const TRACE_NAME = 'CrudRecordsController';

/**
 * Defines a controller that can be used to present a CRUD API for a record.
 *
 * This controller is designed to be a base class that can be extended to make basic Create, Read, Update, and Delete operations on items in a record.
 *
 * @param T The type of the records that the controller can manage.
 * @param TMetrics The type of the metrics that the controller can provide.
 * @param TStore The type of the store that the controller uses.
 * @param TResult The type of the result that the controller returns to clients. Must be a subset of T.
 */
export abstract class CrudRecordsController<
    T extends CrudRecord,
    TStore extends CrudRecordsStore<T> = CrudRecordsStore<T>,
    TResult extends Partial<T> = T
> {
    private _store: TStore;
    private _policies: PolicyController;
    private _config: ConfigurationStore;
    private _name: string;
    private _resourceKind: ResourceKinds;

    protected get config() {
        return this._config;
    }

    /**
     * Gets the name of the controller.
     */
    get name() {
        return this._name;
    }

    protected get policies() {
        return this._policies;
    }

    protected get store() {
        return this._store;
    }

    /**
     * Gets the kind of resources that this controller is for.
     */
    get resourceKind() {
        return this._resourceKind;
    }

    constructor(config: CrudRecordsConfiguration<T, TStore>) {
        this._name = config.name;
        this._store = config.store;
        this._policies = config.policies;
        this._config = config.config;
        this._resourceKind = config.resourceKind;
    }

    /**
     * Creates or updates an item in the given record.
     * @param request The request.
     */
    @traced(TRACE_NAME)
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

            const recordName = contextResult.context.recordName;
            const existingItem = await this._store.getItemByAddress(
                recordName,
                request.item.address
            );

            let resourceMarkers: string[];
            let action: 'update' | 'create';
            let authorization: AuthorizeUserAndInstancesForResourcesResult;
            if (existingItem) {
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
                action = 'create';

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

            const item = this._transformInputItem(request.item);
            const subscriptionResult = await this._checkSubscriptionMetrics(
                action,
                contextResult.context,
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
            const span = trace.getActiveSpan();
            if (err instanceof Error) {
                span?.recordException(err);
            }
            span?.setStatus({ code: SpanStatusCode.ERROR });

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
    @traced(TRACE_NAME)
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
            const span = trace.getActiveSpan();
            if (err instanceof Error) {
                span?.recordException(err);
            }
            span?.setStatus({ code: SpanStatusCode.ERROR });

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
    @traced(TRACE_NAME)
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
                context.context,
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
            const span = trace.getActiveSpan();
            if (err instanceof Error) {
                span?.recordException(err);
            }
            span?.setStatus({ code: SpanStatusCode.ERROR });

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
    @traced(TRACE_NAME)
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
                request.startingAddress ?? null
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
            const span = trace.getActiveSpan();
            if (err instanceof Error) {
                span?.recordException(err);
            }
            span?.setStatus({ code: SpanStatusCode.ERROR });

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
    @traced(TRACE_NAME)
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
                startingAddress: request.startingAddress ?? null,
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
            const span = trace.getActiveSpan();
            if (err instanceof Error) {
                span?.recordException(err);
            }
            span?.setStatus({ code: SpanStatusCode.ERROR });

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
        context: AuthorizationContext,
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

    /**
     * Transforms the given input item and returns the transformed item.
     * Useful for transforming items before they are stored.
     * @param item The item that should be transformed.
     */
    protected _transformInputItem(item: T): T {
        return item;
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
    errorCode: KnownErrorCodes;
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
    errorCode: KnownErrorCodes;
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
    errorCode: KnownErrorCodes;
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
    errorCode: KnownErrorCodes;
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
    marker?: string | null;
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
