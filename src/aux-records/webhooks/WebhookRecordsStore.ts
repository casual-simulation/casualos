import { GenericHttpRequest } from '@casual-simulation/aux-common';
import { SubscriptionFilter } from '../MetricsStore';
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
     * Gets the item metrics for the subscription of the given user or studio.
     * @param filter The filter to use.
     */
    getSubscriptionMetrics(
        filter: SubscriptionFilter
    ): Promise<WebhookSubscriptionMetrics>;

    /**
     * Records the given webhook run in the store.
     * @param run The run to record.
     */
    createWebhookRun(run: WebhookRunInfo): Promise<void>;
}

export interface WebhookRecord extends CrudRecord {
    /**
     * The resource kind of the webhook target.
     * - 'file': The webhook target is a file record.
     * - 'inst': The webhook target is an instance record.
     * - 'data': The webhook target is a data record.
     */
    targetResourceKind: 'file' | 'inst' | 'data';

    /**
     * The name of the record that is being targeted by this webhook.
     */
    targetRecordName: string;

    /**
     * The address of the record that is being targeted by this webhook.
     */
    targetAddress: string;

    // TODO:
    /**
     * The calling convention of the webhook.
     * Different calling conventions support different capabilities.
     *
     * - `http`: The webhook is called with a HTTP request. This grants the most flexibility for working with HTTP, and doesn't enforce a strict structure for the request and response.
     * - `rpc`: The webhook is called with a RPC request. This enforces a strict structure for the request and response.
     */
    // callingConvention?: 'http' | 'rpc';

    /**
     * The ID of the user that represents the webhook.
     * This is used to authenticate the webhook for access to resources.
     *
     * If null, then the webhook does not use any authentication.
     */
    userId?: string | null;
}

/**
 * Defines information about a time that a webhook was run.
 */
export interface WebhookRunInfo {
    /**
     * The ID of the webhook run.
     */
    runId: string;

    /**
     * The name of the record that the webhook is in.
     */
    recordName: string;

    /**
     * The address of the webhook.
     */
    webhookAddress: string;

    /**
     * The unix time in miliseconds when the webhook request was recieved.
     */
    requestTimeMs: number;

    /**
     * The unix time in miliseconds when the webhook response was sent.
     */
    responseTimeMs: number;

    /**
     * The URL to the file that contains the request data.
     */
    requestFileUrl: string;

    /**
     * The URL to the file that contains the response data.
     */
    responseFileUrl: string | null;

    /**
     * The URL to the file that contains the logs for the webhook run.
     */
    logsFileUrl: string | null;
}

export interface WebhookSubscriptionMetrics extends CrudSubscriptionMetrics {
    /**
     * The total number of webhook items that are stored in the subscription.
     */
    totalItems: number;
}
