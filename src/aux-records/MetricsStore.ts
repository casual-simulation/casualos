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

import type { StripeAccountStatus } from './StripeInterface';
import type { CreateRealtimeSessionTokenRequest } from './AIOpenAIRealtimeInterface';

export interface MetricsStore {
    /**
     * Gets the data metrics for the subscription of the given record.
     * @param recordName The name of the record.
     */
    getSubscriptionDataMetricsByRecordName(
        recordName: string
    ): Promise<DataSubscriptionMetrics>;

    /**
     * Gets the file metrics for the subscription of the given record.
     * @param recordName The name of the record.
     */
    getSubscriptionFileMetricsByRecordName(
        recordName: string
    ): Promise<FileSubscriptionMetrics>;

    /**
     * Gets the file metrics for all the subscriptions in the system. This is used for periodic billing purposes.
     */
    getAllFileSubscriptionMetrics(): Promise<FileSubscriptionMetrics[]>;

    /**
     * Gets the event metrics for the subscription of the given record.
     * @param recordName The name of the record.
     */
    getSubscriptionEventMetricsByRecordName(
        recordName: string
    ): Promise<EventSubscriptionMetrics>;

    /**
     * Gets the record metrics for the given user/studio.
     * @param filter The filter.
     */
    getSubscriptionRecordMetrics(
        filter: SubscriptionFilter
    ): Promise<RecordSubscriptionMetrics>;

    /**
     * Gets the AI Chat metrics for the given user/studio.
     * @param filter The filter.
     */
    getSubscriptionAiChatMetrics(
        filter: SubscriptionFilter
    ): Promise<AIChatSubscriptionMetrics>;

    /**
     * Saves the given AI Chat metrics.
     */
    recordChatMetrics(metrics: AIChatMetrics): Promise<void>;

    /**
     * Gets the AI Image metrics for the given user/studio.
     * @param filter The filter.
     */
    getSubscriptionAiImageMetrics(
        filter: SubscriptionFilter
    ): Promise<AIImageSubscriptionMetrics>;

    /**
     * Saves the given AI Image metrics.
     */
    recordImageMetrics(metrics: AIImageMetrics): Promise<void>;

    /**
     * Gets the AI Image metrics for the given user/studio.
     * @param filter The filter.
     */
    getSubscriptionAiSkyboxMetrics(
        filter: SubscriptionFilter
    ): Promise<AISkyboxSubscriptionMetrics>;

    /**
     * Saves the given AI Skybox metrics.
     */
    recordSkyboxMetrics(metrics: AISkyboxMetrics): Promise<void>;

    /**
     * Gets the subscription metrics for sloyd.ai for the given user/studio.
     * @param filter The filter.
     */
    getSubscriptionAiSloydMetrics(
        filter: SubscriptionFilter
    ): Promise<AISloydSubscriptionMetrics>;

    /**
     * Records the given sloyd.ai metrics.
     * @param metrics The metrics to record.
     */
    recordSloydMetrics(metrics: AISloydMetrics): Promise<void>;

    /**
     * Gets the inst metrics for the given user/studio.
     * @param filter The filter.
     */
    getSubscriptionInstMetrics(
        filter: SubscriptionFilter
    ): Promise<InstSubscriptionMetrics>;

    /**
     * Gets all the inst metrics for all the subscriptions in the system. This is used for periodic billing purposes.
     */
    getAllSubscriptionInstMetrics(): Promise<InstSubscriptionMetrics[]>;

    /**
     * Gets the inst metrics for the given record.
     * @param recordName The name of the record.
     */
    getSubscriptionInstMetricsByRecordName(
        recordName: string
    ): Promise<InstSubscriptionMetrics>;

    /**
     * Gets the AI OpenAI Realtime metrics for the given user/studio.
     * @param filter The filter to use.
     */
    getSubscriptionAiOpenAIRealtimeMetrics(
        filter: SubscriptionFilter
    ): Promise<AIOpenAIRealtimeSubscriptionMetrics>;

    /**
     * Records the given ai.openai.realtime metrics.
     * @param metrics The metrics to record.
     */
    recordOpenAIRealtimeMetrics(
        metrics: AIOpenAIRealtimeMetrics
    ): Promise<void>;
}

export interface SubscriptionMetrics {
    recordName?: string;
    userId?: string;
    ownerId: string;
    studioId: string;

    /**
     * The status of the subscription.
     */
    subscriptionStatus: string;

    /**
     * The ID of the subscription.
     */
    subscriptionId: string;

    /**
     * The type of the subscription.
     */
    subscriptionType: 'user' | 'studio';

    /**
     * The unix time in miliseconds of the start of the current subscription period.
     */
    currentPeriodStartMs: number | null;

    /**
     * The unix time in miliseconds of the end of the current subscription period.
     */
    currentPeriodEndMs: number | null;

    /**
     * The ID of the stripe account that the record is associated with.
     * Null if a stripe account is not associated with the record.
     */
    stripeAccountId: string | null;

    /**
     * The status of the stripe account that the record is associated with.
     * Null if a stripe account is not associated with the record.
     */
    stripeAccountStatus: StripeAccountStatus | null;
}

export interface DataSubscriptionMetrics extends SubscriptionMetrics {
    /**
     * The total number of data items stored in the subscription.
     */
    totalItems: number;
}

export interface FileSubscriptionMetrics extends SubscriptionMetrics {
    /**
     * The total number of file items stored in the subscription.
     */
    totalFiles: number;

    /**
     * The total number of file bytes that have been reserved in the subscription.
     */
    totalFileBytesReserved: number;
}

export interface EventSubscriptionMetrics extends SubscriptionMetrics {
    /**
     * The total number of events names stored in the subscription.
     */
    totalEventNames: number;
}

export interface RecordSubscriptionMetrics extends SubscriptionMetrics {
    /**
     * The total number of records stored in the subscription.
     */
    totalRecords: number;
}

export interface InstSubscriptionMetrics extends SubscriptionMetrics {
    /**
     * The total number of insts stored in the subscription.
     */
    totalInsts: number;

    /**
     * The total number of bytes stored by insts in the subscription.
     */
    totalInstBytes: number;
}

export interface SubscriptionFilter {
    /**
     * The ID of the user that owns the subscription.
     */
    ownerId?: string | null;

    /**
     * The ID of the studio that owns the subscription.
     */
    studioId?: string | null;
}

export interface AIChatSubscriptionMetrics extends SubscriptionMetrics {
    /**
     * The total number of tokens that have been used for the current period.
     */
    totalTokensInCurrentPeriod: number;
}

export interface AIImageSubscriptionMetrics extends SubscriptionMetrics {
    /**
     * The total number of pixels that have been generated for the current period.
     */
    totalSquarePixelsInCurrentPeriod: number;
}

export interface AISkyboxSubscriptionMetrics extends SubscriptionMetrics {
    /**
     * The total number of skyboxes that have been generated for the current period.
     */
    totalSkyboxesInCurrentPeriod: number;
}

export interface AIChatMetrics {
    /**
     * The ID of the user that the metrics are for.
     */
    userId?: string;

    /**
     * The ID of the studio that the metrics are for.
     */
    studioId?: string;

    /**
     * The number of tokens that have been used.
     */
    tokens: number;

    /**
     * The unix time in miliseconds of when the metrics were created.
     */
    createdAtMs: number;
}

export interface AIImageMetrics {
    /**
     * The ID of the user that the metrics are for.
     */
    userId?: string;

    /**
     * The ID of the studio that the metrics are for.
     */
    studioId?: string;

    /**
     * The number of square pixels that have been used.
     * This is the number of pixels squared.
     */
    squarePixels: number;

    /**
     * The unix time in miliseconds of when the metrics were created.
     */
    createdAtMs: number;
}

export interface AISkyboxMetrics {
    /**
     * The ID of the user that the metrics are for.
     */
    userId?: string;

    /**
     * The ID of the studio that the metrics are for.
     */
    studioId?: string;

    /**
     * The number of skyboxes that have been used.
     */
    skyboxes: number;

    /**
     * The unix time in miliseconds of when the metrics were created.
     */
    createdAtMs: number;
}

export interface AISloydSubscriptionMetrics extends SubscriptionMetrics {
    /**
     * The total number of sloyd.ai items that have been created for the current period.
     */
    totalModelsInCurrentPeriod: number;
}

export interface AISloydMetrics {
    /**
     * The ID of the user that the metrics are for.
     */
    userId?: string;

    /**
     * The ID of the studio that the metrics are for.
     */
    studioId?: string;

    /**
     * The ID of the model that was created.
     * ("interactionId" in the sloyd interface)
     */
    modelId: string;

    /**
     * The name of the model that was created.
     */
    name?: string;

    /**
     * The confidence of the AI in the created model.
     */
    confidence?: number;

    /**
     * The MIME type of the model.
     */
    mimeType: string;

    /**
     * The data for the model.
     * If the mimeType is "model/gltf+json", then this will be a JSON string.
     * If the mimeType is "model/gltf-binary", then this will be a base64 encoded string.
     */
    modelData: string;

    /**
     * The base64 encoded thumbnail of the model.
     */
    thumbnailBase64?: string;

    /**
     * The ID of the model that the created model is based on.
     */
    baseModelId?: string;

    /**
     * The unix time in miliseconds of when the metrics were created.
     */
    createdAtMs: number;

    /**
     * The number of models that were created in this metric.
     */
    modelsCreated: number;
}

export interface AIOpenAIRealtimeSubscriptionMetrics
    extends SubscriptionMetrics {
    /**
     * The total number of realtime sessions that have been created in the period.
     */
    totalSessionsInCurrentPeriod: number;
}

export interface AIOpenAIRealtimeMetrics {
    /**
     * The ID of the user that the metrics are for.
     */
    userId?: string;

    /**
     * The ID of the studio that the metrics are for.
     */
    studioId?: string;

    /**
     * The ID of the session that was created.
     */
    sessionId: string;

    /**
     * The request that was used to create the session.
     */
    request: CreateRealtimeSessionTokenRequest;

    /**
     * The unix time in miliseconds of when the metrics were created.
     */
    createdAtMs: number;
}
