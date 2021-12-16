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

    async recordData(
        recordKey: string,
        address: string,
        data: string
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
                data
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
