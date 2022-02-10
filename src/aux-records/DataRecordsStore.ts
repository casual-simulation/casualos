import { ServerError } from './Errors';

/**
 * Defines an interface for objects that can store data records.
 */
export interface DataRecordsStore {
    /**
     * Sets the given data in the given record and address.
     * @param recordName The name of the record that the data should be set in.
     * @param address The address that the data should be set for.
     * @param data The data that should be saved.
     * @param publisherId The ID of the user that owns the record this data is being published to.
     * @param subjectId The ID of the user that was logged in when the data was published.
     */
    setData(
        recordName: string,
        address: string,
        data: any,
        publisherId: string,
        subjectId: string
    ): Promise<SetDataResult>;

    /**
     * Gets the data stored in the given record and address.
     * @param recordName The name of the record that the data is in.
     * @param address The address that the data is stored at.
     */
    getData(recordName: string, address: string): Promise<GetDataStoreResult>;

    /**
     * Lists data stored in the given record starting with the given address.
     * @param recordName The name of the record.
     * @param address The address so start listing items at.
     */
    listData(
        recordName: string,
        address: string | null
    ): Promise<ListDataStoreResult>;

    /**
     * Deletes the data stored in the given record and address.
     * @param recordName The name of the record that the data is in.
     * @param address The address that the data is stored at.
     */
    eraseData(
        recordName: string,
        address: string
    ): Promise<EraseDataStoreResult>;
}

/**
 * Defines an interface that represents the result of a "set data" operation.
 */
export interface SetDataResult {
    success: boolean;
    errorCode?: 'data_too_large' | ServerError;
    errorMessage?: string;
}

/**
 * Defines an interface that represents the result of a "get data" operation.
 */
export interface GetDataStoreResult {
    success: boolean;
    data?: any;
    publisherId?: string;
    subjectId?: string;

    errorCode?: 'data_not_found' | ServerError;
    errorMessage?: string;
}

/**
 * Defines an interface that represents the result of a "erase data" operation.
 */
export interface EraseDataStoreResult {
    success: boolean;
    errorCode?: 'data_not_found' | ServerError;
    errorMessage?: string;
}

export interface ListDataStoreResult {
    success: boolean;
    items?: {
        data: any;
        address: string;
    }[];
    errorCode?: ServerError;
    errorMessage?: string;
}
