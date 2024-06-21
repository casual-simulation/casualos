/**
 * Defines an interface for services that are able to store and retrieve metrics about records and subscriptions.
 */
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
     * Gets the subscription metrics for sloyd.ai for the given record.
     * @param recordName The name of the record.
     */
    getSubscriptionAiSloydMetricsByRecordName(
        recordName: string
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
     * Gets the inst metrics for the given record.
     * @param recordName The name of the record.
     */
    getSubscriptionInstMetricsByRecordName(
        recordName: string
    ): Promise<InstSubscriptionMetrics>;
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
}

export interface SubscriptionFilter {
    /**
     * The ID of the user that owns the subscription.
     */
    ownerId?: string;

    /**
     * The ID of the studio that owns the subscription.
     */
    studioId?: string;
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
    name: string;

    /**
     * The confidence of the AI in the created model.
     */
    confidence: number;

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
