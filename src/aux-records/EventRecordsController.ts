import { NotLoggedInError, ServerError } from './Errors';
import {
    EventRecordsStore,
    AddEventCountStoreResult,
    GetEventCountStoreResult,
} from './EventRecordsStore';
import {
    RecordsController,
    ValidatePublicRecordKeyFailure,
} from './RecordsController';

/**
 * Defines a class that is able to manage event (count) records.
 */
export class EventRecordsController {
    private _manager: RecordsController;
    private _store: EventRecordsStore;

    /**
     * Creates a DataRecordsController.
     * @param manager The records manager that should be used to validate record keys.
     * @param store The store that should be used to save data.
     */
    constructor(manager: RecordsController, store: EventRecordsStore) {
        this._manager = manager;
        this._store = store;
    }

    /**
     * Adds the given count of events to the total count of events with the given name.
     * @param recordKey The record key that should be used to add the events.
     * @param eventName The name of the events to record.
     * @param count The number of events to add/subtract.
     * @param subjectId The ID of the user that is adding the count.
     */
    async addCount(
        recordKey: string,
        eventName: string,
        count: number,
        subjectId: string,
    ): Promise<AddCountResult> {
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
                    errorMessage: 'The user must be logged in in order to record events.',
                };
            }

            const recordName = result.recordName;
            const result2 = await this._store.addEventCount(
                recordName,
                eventName,
                count
            );

            if (result2.success === true) {
                return {
                    success: true,
                    countAdded: count,
                    eventName: eventName,
                    recordName: recordName,
                };
            } else {
                return {
                    success: false,
                    errorCode: result2.errorCode,
                    errorMessage: result2.errorMessage,
                };
            }
        } catch (err) {
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: err.toString(),
            };
        }
    }

    /**
     * Gets the current count of events with the given name from the given record.
     * @param recordName The name of the record.
     * @param eventName The name of the events
     */
    async getCount(
        recordName: string,
        eventName: string
    ): Promise<GetCountResult> {
        try {
            const result = await this._store.getEventCount(
                recordName,
                eventName
            );

            if (result.success) {
                return {
                    success: true,
                    count: result.count,
                    eventName: eventName,
                    recordName: recordName,
                };
            } else {
                return {
                    success: false,
                    errorCode: result.errorCode,
                    errorMessage: result.errorMessage,
                };
            }
        } catch (err) {
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: err.toString(),
            };
        }
    }
}

export type AddCountResult = AddCountSuccess | AddCountFailure;

export interface AddCountSuccess {
    success: true;
    recordName: string;
    eventName: string;
    countAdded: number;
}

export interface AddCountFailure {
    success: false;
    errorCode:
        | ServerError
        | NotLoggedInError
        | ValidatePublicRecordKeyFailure['errorCode']
        | AddEventCountStoreResult['errorCode']
        | 'not_supported';
    errorMessage: string;
}

export type GetCountResult = GetCountSuccess | GetCountFailure;

/**
 * Defines an interface that represents a successful "get data" result.
 */
export interface GetCountSuccess {
    success: true;

    /**
     * The total count of events.
     */
    count: number;

    /**
     * The name of the record.
     */
    recordName: string;

    /**
     * The name of the event.
     */
    eventName: string;
}

export interface GetCountFailure {
    success: false;
    errorCode:
        | ServerError
        | GetEventCountStoreResult['errorCode']
        | 'not_supported';
    errorMessage: string;
}
