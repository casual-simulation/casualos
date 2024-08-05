import {
    CrudRecord,
    CrudRecordsStore,
    CrudSubscriptionMetrics,
} from '../crud/CrudRecordsStore';

/**
 * Defines a store that is able to store and retrieve information about webhooks.
 */
export interface WebhookRecordsStore extends CrudRecordsStore<WebhookRecord> {
    /**
     * Gets the item metrics for the subscription of the given record.
     * @param recordName The name of the record.
     */
    getSubscriptionMetricsByRecordName(
        recordName: string
    ): Promise<WebhookSubscriptionMetrics>;
}

export interface WebhookRecord extends CrudRecord {}

export interface WebhookSubscriptionMetrics extends CrudSubscriptionMetrics {
    /**
     * The total number of webhook items that are stored in the subscription.
     */
    totalItems: number;
}
