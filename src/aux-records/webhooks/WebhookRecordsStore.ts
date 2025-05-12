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
    GenericHttpRequest,
    GenericHttpResponse,
} from '@casual-simulation/aux-common';
import type { SubscriptionFilter } from '../MetricsStore';
import type {
    CrudRecord,
    CrudRecordsStore,
    CrudSubscriptionMetrics,
    ListCrudStoreSuccess,
} from '../crud/CrudRecordsStore';
import type { HandleWebhookOptions, WebhookState } from './WebhookEnvironment';
import type { AuthorizeUserAndInstancesForResourcesResult } from '../PolicyController';

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
    recordWebhookRun(run: WebhookRunInfo): Promise<void>;

    /**
     * Gets the list of webhook runs for the given webhook.
     * The list is sorted by the request time in descending order.
     *
     * @param recordName The name of the record.
     * @param webhookAddress The address of the webhook.
     * @param requestTimeMs The time that listed requests should appear before.
     */
    listWebhookRunsForWebhook(
        recordName: string,
        webhookAddress: string,
        requestTimeMs?: number
    ): Promise<ListCrudStoreSuccess<WebhookRunInfo>>;

    /**
     * Gets the information about the given webhook run.
     * @param runId The ID of the webhook run.
     */
    getWebhookRunInfo(runId: string): Promise<WebhookRunInfoWithWebhook | null>;
}

/**
 * Defines a record that represents a webhook.
 *
 * @dochash types/records/webhooks
 * @docName WebhookRecord
 */
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
     * Null if the webhook is targeting a public inst.
     */
    targetRecordName: string | null;

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
     * The status code of the response.
     * If null, then the response was not recieved.
     */
    statusCode: number | null;

    /**
     * The error result of the webhook run.
     */
    errorResult: {
        success: false;
        errorCode: string;
        errorMessage: string;
    } | null;

    /**
     * The SHA-256 hash of the state that was passed to the webhook.
     */
    stateSha256: string;

    /**
     * The name of the record that the request data was stored in.
     * Null if the data could not be recorded.
     */
    infoRecordName: string | null;

    /**
     * The name of the file record that contains the request and response data.
     * Null if the data file could not be recorded.
     */
    infoFileName: string | null;

    /**
     * The options that were included in the webhook run.
     */
    options?: HandleWebhookOptions | null;
}

/**
 * Defines a webhook data file that contains the request and response data for a webhook run.
 */
export interface WebhookInfoFile {
    /**
     * The ID of the webhook run.
     */
    runId: string;

    /**
     * The version of the data file.
     */
    version: 1;

    /**
     * The request that was sent to the webhook.
     */
    request: GenericHttpRequest;

    /**
     * The ID of the user that was making the request.
     * Null if the user is not logged in.
     */
    requestUserId: string | null;

    /**
     * The response that was recieved from the webhook.
     * Null if the request failed before a response was recieved.
     */
    response: GenericHttpResponse | null;

    /**
     * The state that was passed to the webhook.
     */
    state: WebhookState;

    /**
     * The SHA-256 hash of the state that was passed to the webhook.
     */
    stateSha256: string;

    /**
     * The logs that were generated during the webhook run.
     */
    logs: string[];

    /**
     * The authorization result that allowed this webhook run.
     */
    authorization: AuthorizeUserAndInstancesForResourcesResult;
}

export interface WebhookSubscriptionMetrics extends CrudSubscriptionMetrics {
    /**
     * The total number of webhook items that are stored in the subscription.
     */
    totalItems: number;

    /**
     * The number of webhook runs that have been recorded for the last subscription period.
     */
    totalRunsInPeriod: number;

    /**
     * The number of webhook runs that have been recorded in the last hour.
     */
    totalRunsInLastHour: number;
}

export interface WebhookRunInfoWithWebhook {
    run: WebhookRunInfo;
    webhook: WebhookRecord;
}
