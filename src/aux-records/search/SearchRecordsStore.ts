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
import type { ResourceKinds } from '@casual-simulation/aux-common';
import type {
    CrudRecord,
    CrudRecordsStore,
    CrudSubscriptionMetrics,
} from '../crud';
import type { SubscriptionFilter } from '../MetricsStore';

/**
 * Defines a store that contains search records.
 */
export interface SearchRecordsStore extends CrudRecordsStore<SearchRecord> {
    /**
     * Gets the item metrics for the subscription of the given user or studio.
     * @param filter The filter to use.
     */
    getSubscriptionMetrics(
        filter: SubscriptionFilter
    ): Promise<SearchSubscriptionMetrics>;

    /**
     * Creates or saves a search record sync.
     * @param sync The search record sync to create or save.
     */
    saveSync(sync: SearchRecordSync): Promise<void>;

    /**
     * Gets the search record sync with the given ID.
     * @param syncId The ID of the sync to get.
     */
    getSync(syncId: string): Promise<SearchRecordSync | null>;

    /**
     * Deletes the search record sync with the given ID.
     * @param syncId The ID of the sync to delete.
     */
    deleteSync(syncId: string): Promise<void>;

    /**
     * Gets the list of search record syncs for the given search record.
     * @param recordName The name of the record.
     * @param address The address of the search record.
     */
    listSyncsBySearchRecord(
        recordName: string,
        address: string
    ): Promise<SearchRecordSync[]>;

    /**
     * Creates a new sync history entry.
     * @param history The sync history entry to create.
     */
    createSyncHistory(history: SearchRecordSyncHistory): Promise<void>;

    /**
     * Finds the sync that matches the given target record name, resource kind, and markers.
     *
     * Always returns an object, but the sync and search record may be null if no sync was found.
     *
     * @param targetRecordName The name of the target record.
     * @param targetResourceKind The kind of resource that the sync is for.
     * @param markers The markers to use for the sync.
     */
    getSyncByTarget(
        targetRecordName: string,
        targetResourceKind: ResourceKinds,
        markers: string[]
    ): Promise<GetSearchRecordSyncByTargetResult>;
}

/**
 * Defines a record that represents a collection of documents that can be searched.
 */
export interface SearchRecord extends CrudRecord {
    /**
     * The name of the collection that this search record is attached to.
     */
    collectionName: string;

    /**
     * The API key that is used to query the collection.
     */
    searchApiKey: string;
}

export interface SearchSubscriptionMetrics extends CrudSubscriptionMetrics {
    /**
     * The total number of search records that are stored in the subscription.
     */
    totalItems: number;
}

/**
 * Defines a record that represents syncing data to a search collection.
 * This is used to sync data from data records to a search collection.
 */
export interface SearchRecordSync {
    /**
     * The ID of the search record sync.
     */
    id: string;

    /**
     * The name of the record that the search record is in.
     */
    searchRecordName: string;

    /**
     * The address of the search record.
     */
    searchRecordAddress: string;

    /**
     * The name of the record that the data should be synced from.
     */
    targetRecordName: string;

    /**
     * The marker that the data should be synced from.
     */
    targetMarker: string;

    /**
     * The kind of resource that should be synced.
     */
    targetResourceKind: ResourceKinds;

    /**
     * The mapping of the target properties to the search document properties.
     *
     * Each entry in the array is a tuple where the first element is the source property
     * and the second element is the target property in the search document.
     */
    targetMapping: [string, string][];
}

/**
 * Defines an interface that represents the history of a search record sync.
 */
export interface SearchRecordSyncHistory {
    /**
     * The ID of the search record sync history.
     */
    id: string;

    /**
     * The name of the record that the search collection is in.
     */
    searchRecordName: string;

    /**
     * The address of the search record.
     */
    searchRecordAddress: string;

    /**
     * The ID of the sync that this history is for.
     */
    syncId: string;

    /**
     * The ID of the sync run that this history is for.
     * Syncs may trigger multiple history entries, so this ID is used to group runs together.
     */
    runId: string;

    /**
     * The time of the sync.
     *
     * Miliseconds since the unix epoch in UTC.
     */
    timeMs: number;

    /**
     * The status of the sync.
     */
    status: 'success' | 'failure';

    /**
     * Whether the sync was successful.
     */
    success: boolean;

    /**
     * The error message if the sync failed.
     */
    errorMessage: string | null;

    /**
     * The number of documents that were successfully synced.
     */
    numSynced: number;

    /**
     * The number of documents that errored during the sync.
     */
    numErrored: number;

    /**
     * The total number of documents that were processed during the sync.
     */
    numTotal: number;
}

export interface GetSearchRecordSyncByTargetResult {
    /**
     * The sync that matches the target record name, resource kind, and markers.
     *
     * Null if no sync was found.
     */
    sync: SearchRecordSync | null;

    /**
     * The search record that the sync is for.
     *
     * Null if no search record was found.
     */
    searchRecord: SearchRecord | null;
}
