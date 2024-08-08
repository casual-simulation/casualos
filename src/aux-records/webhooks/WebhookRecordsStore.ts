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

export interface WebhookRecord extends CrudRecord {
    /**
     * The type of the webhook target.
     * - 'file': The webhook target is a file record.
     * - 'inst': The webhook target is an instance record.
     * - 'data': The webhook target is a data record.
     */
    targetType: 'file' | 'inst' | 'data';

    /**
     * The name of the record that is being targeted by this webhook.
     */
    targetRecordName: string;

    /**
     * The address of the record that is being targeted by this webhook.
     */
    targetAddress: string;
}

export interface WebhookSubscriptionMetrics extends CrudSubscriptionMetrics {
    /**
     * The total number of webhook items that are stored in the subscription.
     */
    totalItems: number;
}
