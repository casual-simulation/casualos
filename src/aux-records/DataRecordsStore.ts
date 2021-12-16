/**
 * Defines an interface for objects that can store data records.
 */
export interface DataRecordsStore {
    /**
     * Sets the given data in the given record and address.
     * @param recordName The name of the record that the data should be set in.
     * @param address The address that the data should be set for.
     * @param data The data that should be saved.
     */
    setData(
        recordName: string,
        address: string,
        data: any
    ): Promise<SetDataResult>;
}

/**
 * Defines an interface that represents the result of a "set data" operation.
 */
export interface SetDataResult {
    success: boolean;
    errorCode?: 'data_too_large' | 'general_data_error';
    errorMessage?: string;
}
