import { NotLoggedInError, ServerError } from './Errors';
import {
    DataRecordsStore,
    GetDataStoreResult,
    SetDataResult,
} from './DataRecordsStore';
import {
    RecordsController,
    ValidatePublicRecordKeyFailure,
} from './RecordsController';

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
     * @returns
     */
    async recordData(
        recordKey: string,
        address: string,
        data: string,
        subjectId: string
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

            const recordName = result.recordName;
            const result2 = await this._store.setData(
                recordName,
                address,
                data,
                result.ownerId,
                subjectId
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
        };
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
        | ValidatePublicRecordKeyFailure['errorCode']
        | SetDataResult['errorCode'];
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
}

export interface GetDataFailure {
    success: false;
    errorCode: ServerError | GetDataStoreResult['errorCode'];
    errorMessage: string;
}
