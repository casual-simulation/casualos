import {
    GenericHttpRequest,
    ServerError,
    StoredAux,
} from '@casual-simulation/aux-common';
import type {
    CrudRecord,
    CrudRecordsStore,
    CrudSubscriptionMetrics,
} from '../crud';
import type { SubscriptionFilter } from '../MetricsStore';

/**
 * Defines a store that contains notification records.
 */
export interface PackageRecordsStore extends CrudRecordsStore<PackageRecord> {
    /**
     * Gets the item metrics for the subscription of the given user or studio.
     * @param filter The filter to use.
     */
    getSubscriptionMetrics(
        filter: SubscriptionFilter
    ): Promise<PackageSubscriptionMetrics>;
}

/**
 * Defines a record that represents a notification.
 * That is, a way for users to be notified of something.
 *
 * @dochash types/records/packages
 * @docName PackageRecord
 */
export interface PackageRecord extends CrudRecord {
    /**
     * The ID of the package.
     */
    id: string;
}

export interface PackageSubscriptionMetrics extends CrudSubscriptionMetrics {
    /**
     * The total number of packages stored in the subscription.
     */
    totalItems: number;
}
