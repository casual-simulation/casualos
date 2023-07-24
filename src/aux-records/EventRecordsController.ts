import {
    AuthorizeDenied,
    PolicyController,
    returnAuthorizationResult,
} from './PolicyController';
import { NotLoggedInError, ServerError } from './Errors';
import {
    EventRecordsStore,
    AddEventCountStoreResult,
    GetEventCountStoreResult,
    AddEventCountStoreFailure,
    GetEventCountStoreFailure,
} from './EventRecordsStore';
import {
    RecordsController,
    ValidatePublicRecordKeyFailure,
} from './RecordsController';
import { cleanupObject, getMarkersOrDefault } from './Utils';
import { without } from 'lodash';

/**
 * Defines a class that is able to manage event (count) records.
 */
export class EventRecordsController {
    private _policies: PolicyController;
    // private _manager: RecordsController;
    private _store: EventRecordsStore;

    /**
     * Creates a DataRecordsController.
     * @param policies The controller that should be used to validate policies.
     * @param store The store that should be used to save data.
     */
    constructor(policies: PolicyController, store: EventRecordsStore) {
        this._policies = policies;
        this._store = store;
    }

    /**
     * Adds the given count of events to the total count of events with the given name.
     * @param recordKeyOrRecordName The record key or the name of the record that should be used to add the events.
     * @param eventName The name of the events to record.
     * @param count The number of events to add/subtract.
     * @param subjectId The ID of the user that is adding the count.
     * @param instances The list of instances that are currently loaded by the client.
     */
    async addCount(
        recordKeyOrRecordName: string,
        eventName: string,
        count: number,
        subjectId: string,
        instances?: string[]
    ): Promise<AddCountResult> {
        try {
            const baseRequest = {
                recordKeyOrRecordName: recordKeyOrRecordName,
                userId: subjectId,
                instances,
            };
            const context = await this._policies.constructAuthorizationContext(
                baseRequest
            );

            if (context.success === false) {
                return context;
            }

            const recordName = context.context.recordName;

            const event = await this._store.getEventCount(
                recordName,
                eventName
            );

            if (event.success === false) {
                return event;
            }

            const markers = getMarkersOrDefault(event.markers);

            const authorizeResult =
                await this._policies.authorizeRequestUsingContext(
                    context.context,
                    {
                        action: 'event.increment',
                        ...baseRequest,
                        eventName: eventName,
                        resourceMarkers: markers,
                    }
                );

            if (authorizeResult.allowed === false) {
                return returnAuthorizationResult(authorizeResult);
            }

            const policy = authorizeResult.subject.subjectPolicy;

            if (!subjectId && policy !== 'subjectless') {
                return {
                    success: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in in order to record events.',
                };
            }

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
     * @param recordKeyOrRecordName The name of the record.
     * @param eventName The name of the events
     * @param userId The ID of the user that is getting the count.
     * @param instances The list of instances that are currently loaded by the client.
     */
    async getCount(
        recordKeyOrRecordName: string,
        eventName: string,
        userId: string,
        instances?: string[]
    ): Promise<GetCountResult> {
        try {
            const baseRequest = {
                recordKeyOrRecordName: recordKeyOrRecordName,
                userId,
                instances,
            };

            const context = await this._policies.constructAuthorizationContext(
                baseRequest
            );

            if (context.success === false) {
                return context;
            }

            const recordName = context.context.recordName;
            const result = await this._store.getEventCount(
                recordName,
                eventName
            );

            if (result.success === false) {
                return result;
            }

            const markers = getMarkersOrDefault(result.markers);

            const authorizeResult = await this._policies.authorizeRequest({
                action: 'event.count',
                ...baseRequest,
                eventName,
                resourceMarkers: markers,
            });

            if (authorizeResult.allowed === false) {
                return returnAuthorizationResult(authorizeResult);
            }

            return {
                success: true,
                count: result.count,
                eventName: eventName,
                recordName: recordName,
                markers: markers,
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
     * Attempts to update the event using the given request.
     * @param request The request
     */
    async updateEvent(
        request: UpdateEventRecordRequest
    ): Promise<UpdateEventRecordResult> {
        try {
            const baseRequest = {
                recordKeyOrRecordName: request.recordKeyOrRecordName,
                userId: request.userId,
                instances: request.instances,
            };

            const eventName = request.eventName;
            const context = await this._policies.constructAuthorizationContext(
                baseRequest
            );

            if (context.success === false) {
                return context;
            }

            const recordName = context.context.recordName;
            const result = await this._store.getEventCount(
                recordName,
                eventName
            );

            if (result.success === false) {
                return result;
            }

            const markers = request.markers;
            const existingMarkers = getMarkersOrDefault(result.markers);

            const addedMarkers = markers
                ? without(markers, ...existingMarkers)
                : [];
            const removedMarkers = markers
                ? without(existingMarkers, ...markers)
                : [];

            const authorizeResult = await this._policies.authorizeRequest({
                action: 'event.update',
                ...baseRequest,
                eventName,
                existingMarkers: existingMarkers,
                addedMarkers: addedMarkers,
                removedMarkers: removedMarkers,
            });

            if (authorizeResult.allowed === false) {
                return returnAuthorizationResult(authorizeResult);
            }

            const update = await this._store.updateEvent(
                recordName,
                eventName,
                cleanupObject({
                    count: request.count,
                    markers: markers,
                })
            );

            if (update.success === false) {
                return update;
            }

            return {
                success: true,
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
 * Defines the possible results of a "add event count" request.
 *
 * @dochash types/records/events
 * @doctitle Event Types
 * @docsidebar Events
 * @docdescription Event records are useful for keeping track of how many times an event has occurred.
 * @docgroup 01-add
 * @docorder 0
 * @docname AddCountResult
 */
export type AddCountResult = AddCountSuccess | AddCountFailure;

/**
 * Defines an interface that represents a successful "add event count" result.
 *
 * @dochash types/records/events
 * @docgroup 02-add
 * @docorder 1
 * @docname AddCountSuccess
 */
export interface AddCountSuccess {
    success: true;
    /**
     * The name of the record.
     */
    recordName: string;

    /**
     * The name of the event that the count was added to.
     */
    eventName: string;

    /**
     * The number of events that were added.
     */
    countAdded: number;
}

/**
 * Defines an interface that represents a failed "add event count" result.
 *
 * @dochash types/records/events
 * @docgroup 01-add
 * @docorder 2
 * @docname AddCountFailure
 */
export interface AddCountFailure {
    success: false;

    /**
     * The error code that indicates why the request failed.
     */
    errorCode:
        | ServerError
        | NotLoggedInError
        | ValidatePublicRecordKeyFailure['errorCode']
        | AddEventCountStoreFailure['errorCode']
        | AuthorizeDenied['errorCode']
        | 'not_supported';

    /**
     * The error message that indicates why the request failed.
     */
    errorMessage: string;
}

/**
 * Defines the possible results of a "get event count" request.
 *
 * @dochash types/records/events
 * @docgroup 02-count
 * @docorder 0
 * @docname GetCountResult
 */
export type GetCountResult = GetCountSuccess | GetCountFailure;

/**
 * Defines an interface that represents a successful "get event count" result.
 *
 * @dochash types/records/events
 * @docgroup 02-count
 * @docorder 1
 * @docname GetCountSuccess
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

    /**
     * The markers that are applied to this event.
     */
    markers: string[];
}

/**
 * Defines an interface that represents a failed "get event count" result.
 *
 * @dochash types/records/events
 * @docgroup 02-count
 * @docorder 2
 * @docname GetCountFailure
 */
export interface GetCountFailure {
    success: false;

    /**
     * The error code that indicates why the request failed.
     */
    errorCode:
        | ServerError
        | GetEventCountStoreFailure['errorCode']
        | AuthorizeDenied['errorCode']
        | 'not_supported';

    /**
     * The error message that indicates why the request failed.
     */
    errorMessage: string;
}

/**
 * Defines an interface that represents a request to update an event.
 *
 * @dochash types/records/events
 * @docgroup 03-update
 * @docorder 0
 * @docname UpdateEventRecordRequest
 */
export interface UpdateEventRecordRequest {
    /**
     * The record key or the name of the record that should be updated.
     */
    recordKeyOrRecordName: string;

    /**
     * The name of the event that should be updated.
     */
    eventName: string;

    /**
     * The ID of the user that sent the request.
     * Null if the user is not logged in.
     */
    userId: string | null;

    /**
     * The count that the event should be set to.
     * If null or undefined, then it will not be updated.
     */
    count?: number;

    /**
     * The markers that the event should have.
     * If null or undefined, then it will not be updated.
     */
    markers?: string[];

    /**
     * The list of instances that are currently loaded by the client.
     */
    instances?: string[];
}

/**
 * Defines the possible results of an "update event" request.
 *
 * @dochash types/records/events
 * @docgroup 03-update
 * @docorder 1
 * @docname UpdateEventRecordResult
 */
export type UpdateEventRecordResult =
    | UpdateEventRecordSuccess
    | UpdateEventRecordFailure;

/**
 * Defines an interface that represents a successful "update event" result.
 *
 * @dochash types/records/events
 * @docgroup 03-update
 * @docorder 2
 * @docname UpdateEventRecordSuccess
 */
export interface UpdateEventRecordSuccess {
    success: true;
}

/**
 * Defines an interface that represents a failed "update event" result.
 *
 * @dochash types/records/events
 * @docgroup 03-update
 * @docorder 3
 * @docname UpdateEventRecordFailure
 */
export interface UpdateEventRecordFailure {
    success: false;
    errorCode:
        | ServerError
        | AuthorizeDenied['errorCode']
        | ValidatePublicRecordKeyFailure['errorCode'];
    errorMessage: string;
}
