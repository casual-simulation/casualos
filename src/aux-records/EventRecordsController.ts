import {
    AuthorizeDenied,
    PolicyController,
    returnAuthorizationResult,
} from './PolicyController';
import {
    NotLoggedInError,
    NotSupportedError,
    ServerError,
} from '@casual-simulation/aux-common/Errors';
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
import { PUBLIC_READ_MARKER } from '@casual-simulation/aux-common';
import { MetricsStore } from './MetricsStore';
import { ConfigurationStore } from './ConfigurationStore';
import { getSubscriptionFeatures } from './SubscriptionConfiguration';

export interface EventRecordsConfiguration {
    policies: PolicyController;
    store: EventRecordsStore;
    metrics: MetricsStore;
    config: ConfigurationStore;
}

/**
 * Defines a class that is able to manage event (count) records.
 */
export class EventRecordsController {
    private _policies: PolicyController;
    // private _manager: RecordsController;
    private _store: EventRecordsStore;
    private _metrics: MetricsStore;
    private _config: ConfigurationStore;

    /**
     * Creates a DataRecordsController.
     * @param config The configuration to use.
     */
    constructor(config: EventRecordsConfiguration) {
        this._policies = config.policies;
        this._store = config.store;
        this._metrics = config.metrics;
        this._config = config.config;
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

            const metricsResult =
                await this._metrics.getSubscriptionEventMetricsByRecordName(
                    recordName
                );
            const config = await this._config.getSubscriptionConfiguration();
            const features = getSubscriptionFeatures(
                config,
                metricsResult.subscriptionStatus,
                metricsResult.subscriptionId,
                metricsResult.ownerId ? 'user' : 'studio'
            );

            if (!features.events.allowed) {
                return {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'The subscription does not permit the recording of events.',
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
            console.error(
                `[EventRecordsController] A server error occurred while adding count:`,
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
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
            console.error(
                `[EventRecordsController] A server error occurred while getting count:`,
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
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

            const metricsResult =
                await this._metrics.getSubscriptionEventMetricsByRecordName(
                    recordName
                );
            const config = await this._config.getSubscriptionConfiguration();
            const features = getSubscriptionFeatures(
                config,
                metricsResult.subscriptionStatus,
                metricsResult.subscriptionId,
                metricsResult.ownerId ? 'user' : 'studio'
            );

            if (!features.events.allowed) {
                return {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'The subscription does not permit the recording of events.',
                };
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
            console.error(
                `[EventRecordsController] A server error occurred while updating event:`,
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    async listEvents(
        recordKeyOrRecordName: string,
        eventName: string | null,
        userId: string,
        instances?: string[]
    ): Promise<ListEventsResult> {
        try {
            if (!this._store.listEvents) {
                return {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This operation is not supported.',
                };
            }

            const baseRequest = {
                recordKeyOrRecordName: recordKeyOrRecordName,
                userId: userId,
                instances: instances,
            };

            const context = await this._policies.constructAuthorizationContext(
                baseRequest
            );

            if (context.success === false) {
                return context;
            }

            const recordName = context.context.recordName;
            const result = await this._store.listEvents(recordName, eventName);

            if (result.success === false) {
                return result;
            }

            const authorizeResult = await this._policies.authorizeRequest({
                action: 'event.list',
                ...baseRequest,
                eventItems: result.events.map((e) => ({
                    eventName: e.eventName,
                    markers: e.markers ?? [PUBLIC_READ_MARKER],
                    count: e.count,
                })),
            });

            if (authorizeResult.allowed === false) {
                return returnAuthorizationResult(authorizeResult);
            }

            return {
                success: true,
                totalCount: result.totalCount,
                events: authorizeResult.allowedEventItems as ListedEvent[],
            };
        } catch (err) {
            console.error(
                '[EventRecordsController] Failed to list events:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
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

export type ListEventsResult = ListEventsSuccess | ListEventsFailure;

export interface ListEventsSuccess {
    success: true;
    events: ListedEvent[];
    totalCount: number;
}

export interface ListEventsFailure {
    success: false;
    errorCode:
        | ServerError
        | NotSupportedError
        | AuthorizeDenied['errorCode']
        | ValidatePublicRecordKeyFailure['errorCode'];
    errorMessage: string;
}

export interface ListedEvent {
    eventName: string;
    markers: string[];
}
