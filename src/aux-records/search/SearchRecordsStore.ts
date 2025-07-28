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
}

/**
 * Defines a record that represents a collection of documents that can be searched.
 *
 * @dochash types/records/search
 * @docName SearchRecord
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
