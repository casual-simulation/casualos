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
     * @param updatePolicy The update policy that should be stored.
     * @param deletePolicy The delete policy that should be stored.
     * @param markers The list of resource markers that should be applied to the data.
     */
    setData(
        recordName: string,
        address: string,
        data: any,
        publisherId: string,
        subjectId: string,
        updatePolicy: UserPolicy,
        deletePolicy: UserPolicy,
        markers: string[]
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
     * @param address The address to start listing items at.
     */
    listData(
        recordName: string,
        address: string | null
    ): Promise<ListDataStoreResult>;

    /**
     * Lists data stored in the given record that has the given marker, starting with the given address.
     * @param recordName The name of the record.
     * @param marker The name of the marker.
     * @param address The address to start listing items at.
     */
    listDataByMarker(
        request: ListDataStoreByMarkerRequest
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
    updatePolicy?: UserPolicy;
    deletePolicy?: UserPolicy;
    markers?: string[];

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

export type ListDataStoreResult = ListDataStoreSuccess | ListDataStoreFailure;

export interface ListDataStoreSuccess {
    success: true;
    items: ListedDataStoreItem[];
    totalCount: number;
    marker: string;
}

export interface ListDataStoreFailure {
    success: false;
    errorCode: ServerError;
    errorMessage: string;
}

export interface ListedDataStoreItem {
    data: any;
    address: string;
    markers?: string[];
}

export interface ListDataStoreByMarkerRequest {
    /**
     * The name of the record that the data is in.
     */
    recordName: string;

    /**
     * The marker that each item should have.
     */
    marker: string;

    /**
     * The address to start listing items at.
     * If null, then the first item in the record should be returned.
     */
    startingAddress: string | null;

    /**
     * How the items should be sorted by address.
     * "ascending": The items should be sorted in ascending order.
     * "descending": The items should be sorted in descending order.
     *
     * Defaults to "ascending".
     */
    sort?: 'ascending' | 'descending';

    /**
     * The maximum number of items that should be returned.
     * If not provided, a default value will be used.
     */
    count?: number;
}

/**
 * Defines a type that represents a policy that indicates which users are allowed to affect a record.
 *
 * True indicates that any user can edit the record.
 * An array of strings indicates the list of users that are allowed to edit the record.
 *
 * @dochash types/records/data
 * @docname UserPolicy
 */
export type UserPolicy = true | string[] | null;

/**
 * Determines if the given value represents a valid user policy.
 */
export function isValidUserPolicy(value: unknown): boolean {
    if (value === true) {
        return true;
    } else if (Array.isArray(value)) {
        return value.every((v) => typeof v === 'string');
    }

    return false;
}

/**
 * Determines if the given policy allows the given subject ID.
 * @param policy The policy.
 * @param subjectId The subject ID.
 */
export function doesSubjectMatchPolicy(
    policy: UserPolicy,
    subjectId: string | null
): boolean {
    if (policy === true || !policy) {
        return true;
    } else {
        return policy!.some((id) => id === subjectId);
    }
}
