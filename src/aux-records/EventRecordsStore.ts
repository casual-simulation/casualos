/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type { ServerError } from '@casual-simulation/aux-common/Errors';

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
    listEvents?(
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
