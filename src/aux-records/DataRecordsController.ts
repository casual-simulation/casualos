import {
    NotAuthorizedError,
    NotLoggedInError,
    ServerError,
    SubscriptionLimitReached,
} from '@casual-simulation/aux-common/Errors';
import {
    DataRecordsStore,
    EraseDataStoreResult,
    GetDataStoreResult,
    SetDataResult,
    ListDataStoreResult,
    UserPolicy,
    doesSubjectMatchPolicy,
    isValidUserPolicy,
    ListDataStoreFailure,
} from './DataRecordsStore';
import {
    RecordsController,
    ValidatePublicRecordKeyFailure,
} from './RecordsController';
import {
    AuthorizeDataCreateRequest,
    AuthorizeDeleteDataRequest,
    AuthorizeDenied,
    AuthorizeRequestBase,
    AuthorizeResult,
    AuthorizeUpdateDataRequest,
    PolicyController,
    returnAuthorizationResult,
} from './PolicyController';
import { PUBLIC_READ_MARKER } from './PolicyPermissions';
import { without } from 'lodash';
import { MetricsStore } from './MetricsStore';
import { ConfigurationStore } from './ConfigurationStore';
import { getSubscriptionFeatures } from './SubscriptionConfiguration';

export interface DataRecordsConfiguration {
    store: DataRecordsStore;
    policies: PolicyController;
    metrics: MetricsStore;
    config: ConfigurationStore;
}

/**
 * Defines a class that is able to manage data (key/value) records.
 */
export class DataRecordsController {
    private _store: DataRecordsStore;
    private _policies: PolicyController;
    private _metrics: MetricsStore;
    private _config: ConfigurationStore;

    /**
     * Creates a DataRecordsController.
     * @param config The configuration that should be used for the data records controller.
     */
    constructor(config: DataRecordsConfiguration) {
        this._store = config.store;
        this._policies = config.policies;
        this._metrics = config.metrics;
        this._config = config.config;
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
    async recordData(
        recordKeyOrRecordName: string,
        address: string,
        data: string,
        subjectId: string,
        updatePolicy: UserPolicy,
        deletePolicy: UserPolicy,
        markers: string[] = null,
        instances: string[] = null
    ): Promise<RecordDataResult> {
        try {
            const baseRequest: Omit<AuthorizeRequestBase, 'action'> = {
                recordKeyOrRecordName,
                userId: subjectId,
                instances,
            };

            const result = await this._policies.constructAuthorizationContext(
                baseRequest
            );

            // const result = await this._policies.authorizeRequest({
            //     action: 'data.create',
            //     recordKeyOrRecordName,
            //     address: address,
            //     userId: subjectId,
            //     resourceMarkers,
            // });

            if (result.success === false) {
                return result;
            }

            const policy = result.context.subjectPolicy;

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

            const recordName = result.context.recordName;
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

            let request:
                | AuthorizeDataCreateRequest
                | AuthorizeUpdateDataRequest;
            let resourceMarkers: string[];
            if (existingRecord.success) {
                const existingMarkers = existingRecord.markers ?? [
                    PUBLIC_READ_MARKER,
                ];
                const addedMarkers = markers
                    ? without(markers, ...existingMarkers)
                    : [];
                const removedMarkers = markers
                    ? without(existingMarkers, ...markers)
                    : [];
                resourceMarkers = markers ?? existingMarkers;
                request = {
                    action: 'data.update',
                    ...baseRequest,
                    address: address,
                    existingMarkers,
                    addedMarkers,
                    removedMarkers,
                };
            } else {
                resourceMarkers = markers ?? [PUBLIC_READ_MARKER];
                request = {
                    action: 'data.create',
                    ...baseRequest,
                    address: address,
                    resourceMarkers: resourceMarkers,
                };
            }

            const authorization =
                await this._policies.authorizeRequestUsingContext(
                    result.context,
                    request
                );

            if (authorization.allowed === false) {
                return returnAuthorizationResult(authorization);
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

            if (request.action === 'data.create') {
                // Check metrics
                if (features.data.maxItems > 0) {
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
                authorization.authorizerId,
                subjectId,
                updatePolicy,
                deletePolicy,
                resourceMarkers
            );

            if (result2.success === false) {
                return {
                    success: false,
                    errorCode: result2.errorCode,
                    errorMessage: result2.errorMessage,
                };
            }

            return {
                success: true,
                recordName: recordName,
                address: address,
            };
        } catch (err) {
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: err.toString(),
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
    async getData(
        recordName: string,
        address: string,
        userId?: string,
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
                    errorMessage: result.errorMessage,
                };
            }

            const markers = result.markers ?? [PUBLIC_READ_MARKER];
            const authorization =
                await this._policies.authorizeRequestUsingContext(
                    context.context,
                    {
                        action: 'data.read',
                        ...baseRequest,
                        address,
                        resourceMarkers: markers,
                    }
                );

            if (authorization.allowed === false) {
                return returnAuthorizationResult(authorization);
            }

            return {
                success: true,
                data: result.data,
                publisherId: result.publisherId,
                subjectId: result.subjectId,
                recordName,
                updatePolicy: result.updatePolicy ?? true,
                deletePolicy: result.deletePolicy ?? true,
                markers: markers,
            };
        } catch (err) {
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

            const authorizeResult =
                await this._policies.authorizeRequestUsingContext(
                    context.context,
                    {
                        action: 'data.list',
                        ...baseRequest,
                        dataItems: result2.items.map((i) => ({
                            ...i,
                            markers: i.markers ?? [PUBLIC_READ_MARKER],
                        })),
                    }
                );

            if (authorizeResult.allowed === false) {
                return returnAuthorizationResult(authorizeResult);
            }

            if (!authorizeResult.allowedDataItems) {
                throw new Error('allowedDataItems is null!');
            }

            return {
                success: true,
                recordName: context.context.recordName,
                items: authorizeResult.allowedDataItems as ListedData[],
                totalCount: result2.totalCount,
            };
        } catch (err) {
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
     * Erases the data in the given record and address.
     * Uses the given record key to access the record and the given subject ID to determine if the user is allowed to access the record.
     * @param recordKey The key that should be used to access the record.
     * @param address The address that the record should be deleted from.
     * @param subjectId The ID of the user that this request came from.
     * @param instances The instances that are loaded.
     */
    async eraseData(
        recordKeyOrName: string,
        address: string,
        subjectId: string,
        instances?: string[]
    ): Promise<EraseDataResult> {
        try {
            // const result = await this._manager.validatePublicRecordKey(
            //     recordKey
            // );
            // if (result.success === false) {
            //     return {
            //         success: false,
            //         errorCode: result.errorCode,
            //         errorMessage: result.errorMessage,
            //     };
            // }

            // if (!subjectId && result.policy !== 'subjectless') {
            //     return {
            //         success: false,
            //         errorCode: 'not_logged_in',
            //         errorMessage:
            //             'The user must be logged in in order to erase data using the provided record key.',
            //     };
            // }

            // if (result.policy === 'subjectless') {
            //     subjectId = null;
            // }

            const baseRequest: Omit<AuthorizeRequestBase, 'action'> = {
                recordKeyOrRecordName: recordKeyOrName,
                userId: subjectId,
                instances,
            };
            const context = await this._policies.constructAuthorizationContext(
                baseRequest
            );

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
                await this._policies.authorizeRequestUsingContext(
                    context.context,
                    {
                        action: 'data.delete',
                        ...baseRequest,
                        address,
                        resourceMarkers: markers,
                    }
                );

            if (authorization.allowed === false) {
                return returnAuthorizationResult(authorization);
            }

            if (existingRecord.success) {
                const existingDeletePolicy =
                    existingRecord.deletePolicy ?? true;
                if (
                    subjectId !== context.context.recordOwnerId &&
                    subjectId !== authorization.recordKeyOwnerId &&
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
                    errorMessage: result2.errorMessage,
                };
            }

            return {
                success: true,
                recordName,
                address,
            };
        } catch (err) {
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: err.toString(),
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
        | 'invalid_delete_policy';

    /**
     * The error message for the failure.
     */
    errorMessage: string;

    /**
     * The reason for the error.
     */
    errorReason?: 'data_not_allowed' | 'too_many_items';
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
        | AuthorizeDenied['errorCode']
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
        | AuthorizeDenied['errorCode'];

    /**
     * The error message for the failure.
     */
    errorMessage: string;
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
}

export interface ListedData {
    data: any;
    address: string;
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
        | AuthorizeDenied['errorCode']
        | 'not_supported';
    errorMessage: string;
}
