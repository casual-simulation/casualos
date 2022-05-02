import { NotAuthorizedError, NotLoggedInError, ServerError } from './Errors';
import {
    DataRecordsStore,
    EraseDataStoreResult,
    GetDataStoreResult,
    SetDataResult,
    ListDataStoreResult,
    UserPolicy,
    doesSubjectMatchPolicy,
    isValidUserPolicy,
} from './DataRecordsStore';
import {
    RecordsController,
    ValidatePublicRecordKeyFailure,
} from './RecordsController';
import { update } from 'lodash';

/**
 * Defines a class that is able to manage data (key/value) records.
 */
export class DataRecordsController {
    private _manager: RecordsController;
    private _store: DataRecordsStore;

    /**
     * Creates a DataRecordsController.
     * @param manager The records manager that should be used to validate record keys.
     * @param store The store that should be used to save data.
     */
    constructor(manager: RecordsController, store: DataRecordsStore) {
        this._manager = manager;
        this._store = store;
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
     */
    async recordData(
        recordKey: string,
        address: string,
        data: string,
        subjectId: string,
        updatePolicy: UserPolicy,
        deletePolicy: UserPolicy
    ): Promise<RecordDataResult> {
        try {
            const result = await this._manager.validatePublicRecordKey(
                recordKey
            );
            if (result.success === false) {
                return {
                    success: false,
                    errorCode: result.errorCode,
                    errorMessage: result.errorMessage,
                };
            }

            if (!subjectId && result.policy !== 'subjectless') {
                return {
                    success: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in in order to record data.',
                };
            }

            if (result.policy === 'subjectless') {
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

            if (result.policy === 'subjectless') {
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

            const recordName = result.recordName;
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

            const result2 = await this._store.setData(
                recordName,
                address,
                data,
                result.ownerId,
                subjectId,
                updatePolicy,
                deletePolicy
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

    async getData(recordName: string, address: string): Promise<GetDataResult> {
        const result = await this._store.getData(recordName, address);
        if (result.success === false) {
            return {
                success: false,
                errorCode: result.errorCode,
                errorMessage: result.errorMessage,
            };
        }

        return {
            success: true,
            data: result.data,
            publisherId: result.publisherId,
            subjectId: result.subjectId,
            recordName,
            updatePolicy: result.updatePolicy ?? true,
            deletePolicy: result.deletePolicy ?? true,
        };
    }

    async listData(
        recordName: string,
        address: string | null
    ): Promise<ListDataResult> {
        try {
            const result2 = await this._store.listData(recordName, address);

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
                items: result2.items,
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
     * Erases the data in the given record and address.
     * Uses the given record key to access the record and the given subject ID to determine if the user is allowed to access the record.
     * @param recordKey The key that should be used to access the record.
     * @param address The address that the record should be deleted from.
     * @param subjectId THe ID of the user that this request came from.
     */
    async eraseData(
        recordKey: string,
        address: string,
        subjectId: string
    ): Promise<EraseDataResult> {
        try {
            const result = await this._manager.validatePublicRecordKey(
                recordKey
            );
            if (result.success === false) {
                return {
                    success: false,
                    errorCode: result.errorCode,
                    errorMessage: result.errorMessage,
                };
            }

            if (!subjectId && result.policy !== 'subjectless') {
                return {
                    success: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in in order to erase data using the provided record key.',
                };
            }

            if (result.policy === 'subjectless') {
                subjectId = null;
            }

            const recordName = result.recordName;
            const existingRecord = await this._store.getData(
                recordName,
                address
            );

            if (existingRecord.success) {
                const existingDeletePolicy =
                    existingRecord.deletePolicy ?? true;
                if (
                    subjectId !== result.ownerId &&
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

export type RecordDataResult = RecordDataSuccess | RecordDataFailure;

export interface RecordDataSuccess {
    success: true;
    recordName: string;
    address: string;
}

export interface RecordDataFailure {
    success: false;
    errorCode:
        | ServerError
        | NotLoggedInError
        | NotAuthorizedError
        | ValidatePublicRecordKeyFailure['errorCode']
        | SetDataResult['errorCode']
        | 'not_supported'
        | 'invalid_update_policy'
        | 'invalid_delete_policy';
    errorMessage: string;
}

export type GetDataResult = GetDataSuccess | GetDataFailure;

/**
 * Defines an interface that represents a successful "get data" result.
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
}

export interface GetDataFailure {
    success: false;
    errorCode: ServerError | GetDataStoreResult['errorCode'] | 'not_supported';
    errorMessage: string;
}

export type EraseDataResult = EraseDataSuccess | EraseDataFailure;

export interface EraseDataSuccess {
    success: true;
    recordName: string;
    address: string;
}

export interface EraseDataFailure {
    success: false;
    errorCode:
        | ServerError
        | NotLoggedInError
        | NotAuthorizedError
        | EraseDataStoreResult['errorCode']
        | ValidatePublicRecordKeyFailure['errorCode'];
    errorMessage: string;
}

export type ListDataResult = ListDataSuccess | ListDataFailure;

export interface ListDataSuccess {
    success: true;
    recordName: string;
    items: {
        data: any;
        address: string;
    }[];
}

export interface ListDataFailure {
    success: false;
    errorCode: ServerError | ListDataStoreResult['errorCode'] | 'not_supported';
    errorMessage: string;
}
