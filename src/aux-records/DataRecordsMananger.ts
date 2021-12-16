import { ServerError } from './Errors';
import { DataRecordsStore, SetDataResult } from './DataRecordsStore';
import {
    RecordsManager,
    ValidatePublicRecordKeyFailure,
} from './RecordsManager';

/**
 * Defines a class that is able to manage data (key/value) records.
 */
export class DataRecordsManager {
    private _manager: RecordsManager;
    private _store: DataRecordsStore;

    /**
     * Creates a DataRecordsManager.
     * @param manager The records manager that should be used to validate record keys.
     * @param store The store that should be used to save data.
     */
    constructor(manager: RecordsManager, store: DataRecordsStore) {
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
        | ValidatePublicRecordKeyFailure['errorCode']
        | SetDataResult['errorCode'];
    errorMessage: string;
}
