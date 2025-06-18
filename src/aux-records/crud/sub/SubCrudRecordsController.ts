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
    AuthorizeUserAndInstancesForResourcesResult,
    AuthorizeUserAndInstancesForResourcesSuccess,
    AuthorizeUserAndInstancesSuccess,
    PolicyController,
} from '../../PolicyController';

import type { ConfigurationStore } from '../../ConfigurationStore';
import type { ActionKinds, ResourceKinds } from '@casual-simulation/aux-common';

import { traced } from '../../tracing/TracingDecorators';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import type { SubCrudRecord, SubCrudRecordsStore } from './SubCrudRecordsStore';
import type { CrudRecord, CrudRecordsStore } from '../CrudRecordsStore';
import type {
    CheckSubscriptionMetricsResult,
    CrudEraseItemResult,
    CrudGetItemResult,
    CrudListItemsResult,
    CrudRecordItemRequest,
    CrudRecordItemResult,
} from '../CrudRecordsController';

export interface SubCrudRecordsConfiguration<
    TKey,
    T extends SubCrudRecord<TKey>,
    TStore extends SubCrudRecordsStore<TKey, T> = SubCrudRecordsStore<TKey, T>,
    TRecordStore extends CrudRecordsStore<CrudRecord> = CrudRecordsStore<CrudRecord>
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
     * The record item store that the controller uses.
     */
    recordItemStore: TRecordStore;

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

const TRACE_NAME = 'SubCrudRecordsController';

/**
 * Defines a controller that can be used to present a CRUD API for a record.
 *
 * This controller is designed to be a base class that can be extended to make basic Create, Read, Update, and Delete operations on items in a record.
 *
 * @param TKey The type of the key for each item stored by this controller.
 * @param T The type of the records that the controller can manage.
 * @param TMetrics The type of the metrics that the controller can provide.
 * @param TStore The type of the store that the controller uses.
 * @param TRecordStore The type of the store that the controller uses for record items.
 * @param TResult The type of the result that the controller returns to clients. Must be a subset of T.
 */
export abstract class SubCrudRecordsController<
    TKey,
    T extends SubCrudRecord<TKey>,
    TStore extends SubCrudRecordsStore<TKey, T> = SubCrudRecordsStore<TKey, T>,
    TRecordStore extends CrudRecordsStore<CrudRecord> = CrudRecordsStore<CrudRecord>,
    TResult extends Partial<T> = T
> {
    private _store: TStore;
    private _recordStore: TRecordStore;
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

    constructor(
        config: SubCrudRecordsConfiguration<TKey, T, TStore, TRecordStore>
    ) {
        this._name = config.name;
        this._store = config.store;
        this._recordStore = config.recordItemStore;
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
            const existingItem = await this._store.getItemByKey(
                recordName,
                request.item.address,
                request.item.key
            );

            if (!existingItem.parentMarkers) {
                return {
                    success: false,
                    errorCode: 'data_not_found',
                    errorMessage: 'The parent item was not found.',
                };
            }

            let resourceMarkers = existingItem.parentMarkers;

            let action = existingItem.item
                ? ('update' as const)
                : ('create' as const);
            let authorization: AuthorizeUserAndInstancesForResourcesResult;
            if (action === 'update') {
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
                                    resourceId: existingItem.item.address,
                                    action: action,
                                    markers: resourceMarkers,
                                },
                            ],
                        }
                    );

                if (authorization.success === false) {
                    return authorization;
                }
            } else {
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

            const result = await this._putItem(
                action,
                recordName,
                item,
                contextResult.context,
                authorization,
                request
            );
            return result;
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
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
     * Updates or creates the item in the given record.
     * @param action The action that is being performed.
     * @param recordName The name of the record.
     * @param item The item that should be updated or created.
     * @param context The authorization context.
     * @param authorization The authorization for the user and instances.
     * @param request The request.
     */
    protected async _putItem(
        action: 'update' | 'create',
        recordName: string,
        item: T,
        context: AuthorizationContext,
        authorization: AuthorizeUserAndInstancesForResourcesSuccess,
        request: CrudRecordItemRequest<T>
    ): Promise<CrudRecordItemResult> {
        const crudResult = await this._store.putItem(recordName, item);

        if (crudResult.success === false) {
            return crudResult;
        }

        return {
            success: true,
            recordName,
            address: item.address,
        };
    }

    /**
     * Gets the item with the given address from the given record.
     * @param request The request to get the item.
     */
    @traced(TRACE_NAME)
    async getItem(
        request: SubCrudGetItemRequest<TKey>
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

            const result = await this._store.getItemByKey(
                context.context.recordName,
                request.address,
                request.key
            );

            if (!result.item) {
                return {
                    success: false,
                    errorCode: 'data_not_found',
                    errorMessage: 'The item was not found.',
                };
            }

            const markers = result.parentMarkers;
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

            const item = result.item;
            const metricsResult = await this._checkSubscriptionMetrics(
                'read',
                context.context,
                authorization,
                item
            );

            if (metricsResult.success === false) {
                return metricsResult;
            }

            return {
                success: true,
                item: this._convertItemToResult(item, context.context),
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
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
        request: SubCrudEraseItemRequest<TKey>
    ): Promise<CrudEraseItemResult> {
        try {
            const context = await this._policies.constructAuthorizationContext({
                recordKeyOrRecordName: request.recordName,
                userId: request.userId,
            });

            if (context.success === false) {
                return context;
            }

            const result = await this._store.getItemByKey(
                context.context.recordName,
                request.address,
                request.key
            );

            if (!result.item) {
                return {
                    success: false,
                    errorCode: 'data_not_found',
                    errorMessage: 'The item was not found.',
                };
            }

            const markers = result.parentMarkers;

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

            await this._store.deleteItem(
                recordName,
                request.address,
                request.key
            );

            return {
                success: true,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
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
        request: SubCrudListItemsRequest
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

            const recordName = context.context.recordName;
            const item = await this._recordStore.getItemByAddress(
                recordName,
                request.address
            );

            if (!item) {
                return {
                    success: false,
                    errorCode: 'data_not_found',
                    errorMessage: 'The parent item was not found.',
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
                        markers: item.markers,
                    }
                );

            if (authorization.success === false) {
                return authorization;
            }

            const result2 = await this._store.listItems(
                context.context.recordName,
                request.address
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
            span?.recordException(err);
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

export interface SubCrudGetItemRequest<TKey> {
    /**
     * The name of the record that the request is for.
     * Can also be a record key.
     */
    recordName: string;

    /**
     * The address of the record item that the item is stored in.
     */
    address: string;

    /**
     * The key of the item to get.
     */
    key: TKey;

    /**
     * The ID of the user who is currently logged in.
     */
    userId: string;

    /**
     * The instances that the request is coming from.
     */
    instances: string[];
}

export interface SubCrudEraseItemRequest<TKey> {
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
     * The key of the item that should be erased.
     */
    key: TKey;

    /**
     * The ID of the user who is currently logged in.
     */
    userId: string;

    /**
     * The instances that the request is coming from.
     */
    instances: string[];
}

export interface SubCrudListItemsRequest {
    /**
     * The name of the record that the request is for.
     * Can also be a record key.
     */
    recordName: string;

    /**
     * The address that the items should be listed for.
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
