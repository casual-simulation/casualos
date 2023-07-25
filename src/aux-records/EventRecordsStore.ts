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
     * Returns a count of 0 if none is stored.
     * @param recordName The name of the record.
     * @param eventName The name of the event.
     */
    getEventCount(
        recordName: string,
        eventName: string
    ): Promise<GetEventCountStoreResult>;

    /**
     * Updates the given event with the given information.
     * @param recordName The name of the record that the event is in.
     * @param eventName The name of the event that should be updated.
     * @param updates The updates to apply to the event.
     */
    updateEvent(
        recordName: string,
        eventName: string,
        updates: EventRecordUpdate
    ): Promise<UpdateEventResult>;

    /**
     * Lists the events that are in the given record.
     * @param recordName The name of the record.
     * @param eventName The name of the event that the list should start after.
     */
    listEvents(
        recordName: string,
        eventName: string | null
    ): Promise<ListEventsStoreResult>;
}

export type AddEventCountStoreResult =
    | AddEventCountStoreSuccess
    | AddEventCountStoreFailure;

export interface AddEventCountStoreSuccess {
    success: true;
}

export interface AddEventCountStoreFailure {
    success: false;
    errorCode: ServerError;
    errorMessage: string;
}

export type GetEventCountStoreResult =
    | GetEventCountStoreSuccess
    | GetEventCountStoreFailure;

export interface GetEventCountStoreSuccess {
    success: true;
    count: number;
    markers?: string[];
}

export interface GetEventCountStoreFailure {
    success: false;
    errorCode: ServerError;
    errorMessage: string;
}

export type UpdateEventResult = UpdateEventSuccess | UpdateEventFailure;

export interface UpdateEventSuccess {
    success: true;
}

export interface UpdateEventFailure {
    success: false;
    errorCode: ServerError;
    errorMessage: string;
}

export interface EventRecordUpdate {
    count?: number;
    markers?: string[];
}

export type ListEventsStoreResult =
    | ListEventsStoreSuccess
    | ListEventsStoreFailure;

export interface ListEventsStoreSuccess {
    success: true;
    events: ListedStoreEvent[];
    totalCount: number;
}

export interface ListEventsStoreFailure {
    success: false;
    errorCode: ServerError;
    errorMessage: string;
}

export interface ListedStoreEvent {
    eventName: string;
    count: number;
    markers: string[];
}
