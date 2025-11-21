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
    NotAuthorizedError,
    NotLoggedInError,
    ServerError,
    SubscriptionLimitReached,
} from '@casual-simulation/aux-common/Errors';
import type {
    DataRecordsStore,
    EraseDataStoreResult,
    GetDataStoreResult,
    SetDataResult,
    UserPolicy,
    ListDataStoreFailure,
} from './DataRecordsStore';
import { doesSubjectMatchPolicy, isValidUserPolicy } from './DataRecordsStore';
import type { ValidatePublicRecordKeyFailure } from './RecordsController';
import type {
    AuthorizeSubjectFailure,
    PolicyController,
} from './PolicyController';
import {
    getMarkerResourcesForCreation,
    getMarkerResourcesForUpdate,
} from './PolicyController';
import type { DenialReason } from '@casual-simulation/aux-common';
import {
    ACCOUNT_MARKER,
    PUBLIC_READ_MARKER,
    hasValue,
} from '@casual-simulation/aux-common';
import type { MetricsStore } from './MetricsStore';
import type { ConfigurationStore } from './ConfigurationStore';
import { getSubscriptionFeatures } from './SubscriptionConfiguration';
import { byteLengthOfString } from './Utils';
import type { ZodIssue } from 'zod';
import { z } from 'zod';
import stringify from '@casual-simulation/fast-json-stable-stringify';
import { traced } from './tracing/TracingDecorators';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import type { IQueue } from './queue';
import type { SearchSyncQueueEvent } from './search';

const TRACE_NAME = 'DataRecordsController';

export interface DataRecordsConfiguration {
    store: DataRecordsStore;
    policies: PolicyController;
    metrics: MetricsStore;
    config: ConfigurationStore;

    searchSyncQueue?: IQueue<SearchSyncQueueEvent> | null;
}

/**
 * Defines a class that is able to manage data (key/value) records.
 */
export class DataRecordsController {
    private _store: DataRecordsStore;
    private _policies: PolicyController;
    private _metrics: MetricsStore;
    private _config: ConfigurationStore;

    private _searchSyncQueue: IQueue<SearchSyncQueueEvent> | null;

    /**
     * Creates a DataRecordsController.
     * @param config The configuration that should be used for the data records controller.
     */
    constructor(config: DataRecordsConfiguration) {
        this._store = config.store;
        this._policies = config.policies;
        this._metrics = config.metrics;
        this._config = config.config;
        this._searchSyncQueue = config.searchSyncQueue || null;
    }

    /**
     * Records the given data in the given record and address.
     * Uses the given record key to access the record and the given subject ID to store which user the data came from.
     * @param recordKey The key that should be used to access the record.
     * @param address The address that the record should be stored at inside the record.
     * @param data The data that should be saved.
     * @param subjectId The ID of the user that the data came from.
     * @param updatePolicy The update policy that the new data should use.
     * @param deletePolicy the delete policy that the new data should use.
     * @param markers The list of markers that should be applied to the new record. If null, then the publicRead marker will be applied.
     * @param instances The list of instances that are currently loaded.
     */
    @traced(TRACE_NAME)
    async recordData(
        recordKeyOrRecordName: string,
        address: string,
        data: object | string | boolean | number,
        subjectId: string,
        updatePolicy: UserPolicy,
        deletePolicy: UserPolicy,
        markers: string[] = null,
        instances: string[] = null
    ): Promise<RecordDataResult> {
        try {
            const contextResult =
                await this._policies.constructAuthorizationContext({
                    recordKeyOrRecordName,
                    userId: subjectId,
                });

            if (contextResult.success === false) {
                return contextResult;
            }

            const policy = contextResult.context.subjectPolicy;

            if (!subjectId && policy !== 'subjectless') {
                return {
                    success: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in in order to record data.',
                };
            }

            if (policy === 'subjectless') {
                subjectId = null;
            }

            if (!updatePolicy) {
                updatePolicy = true;
            }
            if (!deletePolicy) {
                deletePolicy = true;
            }

            if (!isValidUserPolicy(updatePolicy)) {
                return {
                    success: false,
                    errorCode: 'invalid_update_policy',
                    errorMessage:
                        'The given updatePolicy is invalid or not supported.',
                };
            }

            if (!isValidUserPolicy(deletePolicy)) {
                return {
                    success: false,
                    errorCode: 'invalid_delete_policy',
                    errorMessage:
                        'The given deletePolicy is invalid or not supported.',
                };
            }

            if (policy === 'subjectless') {
                if (updatePolicy !== true) {
                    return {
                        success: false,
                        errorCode: 'invalid_record_key',
                        errorMessage:
                            'It is not possible to set update policies using a subjectless key.',
                    };
                }

                if (deletePolicy !== true) {
                    return {
                        success: false,
                        errorCode: 'invalid_record_key',
                        errorMessage:
                            'It is not possible to set delete policies using a subjectless key.',
                    };
                }
            }

            const recordName = contextResult.context.recordName;
            const existingRecord = await this._store.getData(
                recordName,
                address
            );

            if (existingRecord.success) {
                const existingUpdatePolicy =
                    existingRecord.updatePolicy ?? true;
                if (!doesSubjectMatchPolicy(existingUpdatePolicy, subjectId)) {
                    return {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'The updatePolicy does not permit this user to update the data record.',
                    };
                }
            }

            let resourceMarkers: string[];
            if (existingRecord.success) {
                const existingMarkers = existingRecord.markers ?? [
                    PUBLIC_READ_MARKER,
                ];
                resourceMarkers = markers ?? existingMarkers;

                const authorization =
                    await this._policies.authorizeUserAndInstancesForResources(
                        contextResult.context,
                        {
                            userId: subjectId,
                            instances,
                            resources: [
                                {
                                    resourceKind: 'data',
                                    resourceId: address,
                                    action: 'update',
                                    markers: resourceMarkers,
                                },
                                ...getMarkerResourcesForUpdate(
                                    existingMarkers,
                                    markers
                                ),
                            ],
                        }
                    );

                if (authorization.success === false) {
                    return authorization;
                }
            } else {
                resourceMarkers = markers ?? [PUBLIC_READ_MARKER];

                const authorization =
                    await this._policies.authorizeUserAndInstancesForResources(
                        contextResult.context,
                        {
                            userId: subjectId,
                            instances,
                            resources: [
                                {
                                    resourceKind: 'data',
                                    resourceId: address,
                                    action: 'create',
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

            const metricsResult =
                await this._metrics.getSubscriptionDataMetricsByRecordName(
                    recordName
                );
            const config = await this._config.getSubscriptionConfiguration();
            const features = getSubscriptionFeatures(
                config,
                metricsResult.subscriptionStatus,
                metricsResult.subscriptionId,
                metricsResult.ownerId ? 'user' : 'studio'
            );

            if (!features.data.allowed) {
                return {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'The subscription does not permit the recording of data.',
                    errorReason: 'data_not_allowed',
                };
            }

            if (hasValue(features.data.maxItemSizeInBytes)) {
                const dataString =
                    typeof data === 'string' ? data : stringify(data);
                const size = byteLengthOfString(dataString);
                const schema = z.number().max(features.data.maxItemSizeInBytes);
                const result = schema.safeParse(size);

                if (result.success === false) {
                    return {
                        success: false,
                        errorCode: 'subscription_limit_reached',
                        errorMessage:
                            'The size of the item is larger than the subscription allows.',
                        errorReason: 'data_too_large',
                        issues: result.error.issues.map((i) => ({
                            ...i,
                            path: ['data', 'sizeInBytes'],
                        })),
                    };
                }
            }

            if (!existingRecord.success) {
                // Check metrics
                if (
                    hasValue(features.data.maxItems) &&
                    features.data.maxItems > 0
                ) {
                    if (metricsResult.totalItems >= features.data.maxItems) {
                        return {
                            success: false,
                            errorCode: 'subscription_limit_reached',
                            errorMessage:
                                'The maximum number of items has been reached for your subscription.',
                            errorReason: 'too_many_items',
                        };
                    }
                }
            }

            const result2 = await this._store.setData(
                recordName,
                address,
                data,
                contextResult.context.recordKeyCreatorId ??
                    subjectId ??
                    contextResult.context.recordOwnerId,
                subjectId,
                updatePolicy,
                deletePolicy,
                resourceMarkers
            );

            if (result2.success === false) {
                return {
                    success: false,
                    errorCode: result2.errorCode,
                    errorMessage: result2.errorMessage!,
                };
            }

            if (this._searchSyncQueue) {
                await this._searchSyncQueue.add('dataChanged', {
                    type: 'sync_item',
                    itemRecordName: recordName,
                    itemResourceKind: 'data',
                    itemAddress: address,
                    itemMarkers: resourceMarkers,
                    action: existingRecord.success ? 'update' : 'create',
                });
            }

            return {
                success: true,
                recordName: recordName,
                address: address,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            if (err instanceof Error) {
                span?.recordException(err);
            }
            span?.setStatus({ code: SpanStatusCode.ERROR });
            console.error(
                `[DataRecordsController] A server error occurred while recording data:`,
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
     * Gets the data that is stored in the given record at the given address.
     * @param recordName The name (or record key) of the record that the data is stored in.
     * @param address The address that the data is stored in.
     * @param userId The ID of the user who is retrieving the data. If null, then it is assumed that the user is not logged in.
     * @param instances The list of instances that are loaded.
     */
    @traced(TRACE_NAME)
    async getData(
        recordName: string,
        address: string,
        userId?: string | null,
        instances?: string[]
    ): Promise<GetDataResult> {
        try {
            const baseRequest = {
                recordKeyOrRecordName: recordName,
                userId,
                instances,
            };
            const context = await this._policies.constructAuthorizationContext(
                baseRequest
            );

            if (context.success === false) {
                return context;
            }

            const result = await this._store.getData(
                context.context.recordName,
                address
            );
            if (result.success === false) {
                return {
                    success: false,
                    errorCode: result.errorCode,
                    errorMessage: result.errorMessage!,
                };
            }

            const markers = result.markers ?? [PUBLIC_READ_MARKER];
            const authorization =
                await this._policies.authorizeUserAndInstances(
                    context.context,
                    {
                        userId: userId,
                        instances,
                        resourceKind: 'data',
                        resourceId: address,
                        action: 'read',
                        markers: markers,
                    }
                );

            if (authorization.success === false) {
                return authorization;
            }

            return {
                success: true,
                data: result.data,
                publisherId: result.publisherId!,
                subjectId: result.subjectId!,
                recordName,
                updatePolicy: result.updatePolicy ?? true,
                deletePolicy: result.deletePolicy ?? true,
                markers: markers,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            if (err instanceof Error) {
                span?.recordException(err);
            }
            span?.setStatus({ code: SpanStatusCode.ERROR });
            console.error(
                '[DataRecordsController] An error occurred while getting data:',
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
     * Lists some data from the given record, starting after the given address.
     * @param recordName The name (or record key) of the record.
     * @param address The address that the listing should start at. If null, then the listing will start with the first item.
     * @param userId The ID of the user who is retrieving the data. If null, then it is assumed that the user is not logged in.
     * @param instances The instances that are loaded.
     */
    @traced(TRACE_NAME)
    async listData(
        recordName: string,
        address: string | null,
        userId?: string,
        instances?: string[]
    ): Promise<ListDataResult> {
        try {
            const baseRequest = {
                recordKeyOrRecordName: recordName,
                userId,
                instances,
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
                        userId,
                        instances,
                        resourceKind: 'data',
                        action: 'list',
                        markers: [ACCOUNT_MARKER],
                    }
                );

            const result2 = await this._store.listData(
                context.context.recordName,
                address
            );

            if (result2.success === false) {
                return {
                    success: false,
                    errorCode: result2.errorCode,
                    errorMessage: result2.errorMessage,
                };
            }

            if (authorization.success === false) {
                return authorization;
            }

            return {
                success: true,
                recordName: context.context.recordName,
                items: result2.items as ListedData[],
                totalCount: result2.totalCount,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            if (err instanceof Error) {
                span?.recordException(err);
            }
            span?.setStatus({ code: SpanStatusCode.ERROR });
            console.error(
                '[DataRecordsController] An error occurred while listing data:',
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
     * Lists some data from the given record, filtered by the given marker and starting at the given address.
     * @param request The request that should be used to list the data.
     */
    @traced(TRACE_NAME)
    async listDataByMarker(
        request: ListDataByMarkerRequest
    ): Promise<ListDataResult> {
        try {
            const baseRequest = {
                recordKeyOrRecordName: request.recordKeyOrName,
                userId: request.userId,
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
                        userId: context.context.userId,
                        instances: request.instances,
                        resourceKind: 'data',
                        action: 'list',
                        markers: [request.marker],
                    }
                );

            const result2 = await this._store.listDataByMarker({
                recordName: context.context.recordName,
                marker: request.marker,
                startingAddress: request.startingAddress,
                sort: request.sort,
            });

            if (result2.success === false) {
                return {
                    success: false,
                    errorCode: result2.errorCode,
                    errorMessage: result2.errorMessage,
                };
            }

            if (authorization.success === false) {
                return authorization;
            }

            return {
                success: true,
                recordName: context.context.recordName,
                items: result2.items as ListedData[],
                totalCount: result2.totalCount,
                marker: result2.marker,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            if (err instanceof Error) {
                span?.recordException(err);
            }
            span?.setStatus({ code: SpanStatusCode.ERROR });
            console.error(
                '[DataRecordsController] An error occurred while listing data by marker:',
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
     * Erases the data in the given record and address.
     * Uses the given record key to access the record and the given subject ID to determine if the user is allowed to access the record.
     * @param recordKey The key that should be used to access the record.
     * @param address The address that the record should be deleted from.
     * @param subjectId The ID of the user that this request came from.
     * @param instances The instances that are loaded.
     */
    @traced(TRACE_NAME)
    async eraseData(
        recordKeyOrName: string,
        address: string,
        subjectId: string | null,
        instances?: string[]
    ): Promise<EraseDataResult> {
        try {
            const context = await this._policies.constructAuthorizationContext({
                recordKeyOrRecordName: recordKeyOrName,
                userId: subjectId,
            });

            if (context.success === false) {
                return context;
            }

            const policy = context.context.subjectPolicy;

            if (!subjectId && policy !== 'subjectless') {
                return {
                    success: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in in order to erase data using the provided record key.',
                };
            }

            if (policy === 'subjectless') {
                subjectId = null;
            }

            const recordName = context.context.recordName;

            const existingRecord = await this._store.getData(
                recordName,
                address
            );

            const markers = (existingRecord.success
                ? existingRecord.markers
                : null) ?? [PUBLIC_READ_MARKER];

            const authorization =
                await this._policies.authorizeUserAndInstances(
                    context.context,
                    {
                        userId: subjectId,
                        instances,
                        resourceKind: 'data',
                        resourceId: address,
                        action: 'delete',
                        markers: markers,
                    }
                );

            // const authorization =
            //     await this._policies.authorizeRequestUsingContext(
            //         context.context,
            //         {
            //             action: 'data.delete',
            //             ...baseRequest,
            //             address,
            //             resourceMarkers: markers,
            //         }
            //     );

            if (authorization.success === false) {
                return authorization;
            }

            if (existingRecord.success) {
                const existingDeletePolicy =
                    existingRecord.deletePolicy ?? true;
                if (
                    subjectId !== context.context.recordOwnerId &&
                    !doesSubjectMatchPolicy(existingDeletePolicy, subjectId)
                ) {
                    return {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'The deletePolicy does not permit this user to erase the data record.',
                    };
                }
            }

            const result2 = await this._store.eraseData(recordName, address);

            if (result2.success === false) {
                return {
                    success: false,
                    errorCode: result2.errorCode,
                    errorMessage: result2.errorMessage!,
                };
            }

            if (this._searchSyncQueue) {
                await this._searchSyncQueue.add('dataChanged', {
                    type: 'sync_item',
                    itemRecordName: recordName,
                    itemResourceKind: 'data',
                    itemAddress: address,
                    itemMarkers: markers,
                    action: 'delete',
                });
            }

            return {
                success: true,
                recordName,
                address,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            if (err instanceof Error) {
                span?.recordException(err);
            }
            span?.setStatus({ code: SpanStatusCode.ERROR });
            console.error(
                `[DataRecordsController] A server error occurred while erasing data:`,
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }
}

/**
 * The possible results of a record data request.
 *
 * @dochash types/records/data
 * @doctitle Data Types
 * @docsidebar Data
 * @docdescription Data records are used to store key/value pairs of data.
 * @docgroup 01-create
 * @order 0
 * @docname RecordDataResult
 */
export type RecordDataResult = RecordDataSuccess | RecordDataFailure;

/**
 * Defines an interface that represents a successful "record data" result.
 *
 * @dochash types/records/data
 * @docgroup 01-create
 * @order 1
 * @docname RecordDataSuccess
 */
export interface RecordDataSuccess {
    success: true;
    /**
     * The name of the record that the data was recorded to.
     */
    recordName: string;

    /**
     * The address that the data is stored at.
     */
    address: string;
}

/**
 * Defines an interface that represents a failed "record data" result.
 *
 * @dochash types/records/data
 * @docgroup 01-create
 * @order 2
 * @docname RecordDataFailure
 */
export interface RecordDataFailure {
    success: false;

    /**
     * The error code for the failure.
     */
    errorCode:
        | ServerError
        | NotLoggedInError
        | NotAuthorizedError
        | ValidatePublicRecordKeyFailure['errorCode']
        | SetDataResult['errorCode']
        | SubscriptionLimitReached
        | 'unacceptable_request'
        | 'not_supported'
        | 'invalid_update_policy'
        | 'invalid_delete_policy'
        | AuthorizeSubjectFailure['errorCode'];

    /**
     * The error message for the failure.
     */
    errorMessage: string;

    /**
     * The reason for the error.
     */
    errorReason?: 'data_not_allowed' | 'too_many_items' | 'data_too_large';

    /**
     * The reason why the request was denied authorization.
     */
    reason?: DenialReason;

    /**
     * The issues with the request.
     */
    issues?: ZodIssue[];
}

/**
 * The possible results of a get data request.
 *
 * @dochash types/records/data
 * @docgroup 02-get
 * @order 0
 * @docname GetDataResult
 */
export type GetDataResult = GetDataSuccess | GetDataFailure;

/**
 * Defines an interface that represents a successful "get data" result.
 *
 * @dochash types/records/data
 * @docgroup 02-get
 * @order 1
 * @docname GetDataSuccess
 */
export interface GetDataSuccess {
    success: true;

    /**
     * The data that was stored.
     */
    data: any;

    /**
     * The name of the record.
     */
    recordName: string;

    /**
     * The ID of the user that owns the record.
     */
    publisherId: string;

    /**
     * The ID of the user that sent the data.
     */
    subjectId: string;

    /**
     * The update policy that the data uses.
     */
    updatePolicy: UserPolicy;

    /**
     * The delete policy that the data uses.
     */
    deletePolicy: UserPolicy;

    /**
     * The list of markers that have been applied to the data.
     */
    markers: string[];
}

/**
 * Defines an interface that repeesents a failed "get data" result.
 *
 * @dochash types/records/data
 * @docgroup 02-get
 * @order 3
 * @docname GetDataFailure
 */
export interface GetDataFailure {
    success: false;
    /**
     * The error code for the failure.
     */
    errorCode:
        | ServerError
        | GetDataStoreResult['errorCode']
        | AuthorizeSubjectFailure['errorCode']
        | 'not_supported';

    /**
     * The error message for the failure.
     */
    errorMessage: string;
}

/**
 * The possible results of an erase data request.
 *
 * @dochash types/records/data
 * @docgroup 03-erase
 * @order 0
 * @docname EraseDataResult
 */
export type EraseDataResult = EraseDataSuccess | EraseDataFailure;

/**
 * Defines an interface that represents a successful result for an erase data request.
 *
 * @dochash types/records/data
 * @docgroup 03-erase
 * @order 1
 * @docname EraseDataSuccess
 */
export interface EraseDataSuccess {
    success: true;

    /**
     * The name of the record that the data was erased from.
     */
    recordName: string;

    /**
     * The address of the data that was erased.
     */
    address: string;
}

/**
 * Defines an interface that represents a failed result for an erase data request.
 *
 * @dochash types/records/data
 * @docgroup 03-erase
 * @order 2
 * @docname EraseDataFailure
 */
export interface EraseDataFailure {
    success: false;

    /**
     * The error code for the failure.
     */
    errorCode:
        | ServerError
        | NotLoggedInError
        | NotAuthorizedError
        | EraseDataStoreResult['errorCode']
        | ValidatePublicRecordKeyFailure['errorCode']
        | AuthorizeSubjectFailure['errorCode'];

    /**
     * The error message for the failure.
     */
    errorMessage: string;
}

/**
 * Defines an interface that represents the possible options in a list data request.
 */
export interface ListDataByMarkerRequest {
    /**
     * The record key or name that should be used to list the data.
     */
    recordKeyOrName: string;

    /**
     * The ID of the user that is currently logged in.
     */
    userId: string;

    /**
     * The list of instances that are currently loaded.
     */
    instances?: string[];

    /**
     * The marker that the data should be filtered by.
     */
    marker: string;

    /**
     * The address that the listing should start after.
     */
    startingAddress: string | null;

    /**
     * The order that the data should be sorted in.
     * Defaults to "ascending".
     */
    sort?: 'ascending' | 'descending';
}

/**
 * The possible results of a list data request.
 *
 * @dochash types/records/data
 * @docgroup 04-list
 * @order 0
 * @docname ListDataResult
 */
export type ListDataResult = ListDataSuccess | ListDataFailure;

/**
 * Defines an interface that represents a successful result for a list data request.
 *
 * @dochash types/records/data
 * @docgroup 04-list
 * @order 1
 * @docname ListDataSuccess
 */
export interface ListDataSuccess {
    success: true;

    /**
     * The name of the record that the data was listed from.
     */
    recordName: string;

    /**
     * The items that were listed.
     */
    items: ListedData[];

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

/**
 * Defines an interface that represents a single item in a list data result.
 *
 * @dochash types/records/data
 * @docgroup 04-list
 * @order 2
 * @docname ListedData
 */
export interface ListedData {
    /**
     * The data contained in the item.
     */
    data: any;

    /**
     * The address that the data is stored at.
     */
    address: string;

    /**
     * The markers that have been applied to the data.
     */
    markers: string[];
}

/**
 * Defines an interface that represents a failed result for a list data request.
 *
 * @dochash types/records/data
 * @docgroup 04-list
 * @order 2
 * @docname ListDataFailure
 */
export interface ListDataFailure {
    success: false;
    errorCode:
        | ServerError
        | ListDataStoreFailure['errorCode']
        | AuthorizeSubjectFailure['errorCode']
        | 'not_supported';
    errorMessage: string;
}
