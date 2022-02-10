import { ServerError } from './Errors';

/**
 * Defines an interface for objects that can store event records.
 */
export interface EventRecordsStore {
    /**
     * Adds the given count to the given event and record.
     * @param recordName The name of the record.
     * @param eventName The name of the event.
     * @param count The amount to add or subtract.
     */
    addEventCount(
        recordName: string,
        eventName: string,
        count: number
    ): Promise<AddEventCountStoreResult>;

    /**
     * Gets the count stored on the given event and record.
     * @param recordName The name of the record.
     * @param eventName The name of the event.
     */
    getEventCount(
        recordName: string,
        eventName: string
    ): Promise<GetEventCountStoreResult>;
}

export interface AddEventCountStoreResult {
    success: boolean;
    errorCode?: ServerError;
    errorMessage?: string;
}

export interface GetEventCountStoreResult {
    success: boolean;
    count?: number;

    errorCode?: ServerError;
    errorMessage?: string;
}
