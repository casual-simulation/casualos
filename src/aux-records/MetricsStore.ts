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
    ): Promise<AiChatSubscriptionMetrics>;
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

export interface AiChatSubscriptionMetrics extends SubscriptionMetrics {
    /**
     * The total number of tokens that have been used for the current period.
     */
    totalTokensInCurrentPeriod: number;
}

export interface AIImageSubscriptionMetrics extends SubscriptionMetrics {
    /**
     * The total number of pixels that have been generated for the current period.
     */
    totalPixelsInCurrentPeriod: number;
}

export interface AISkyboxSubscriptionMetrics extends SubscriptionMetrics {
    /**
     * The total number of skyboxes that have been generated for the current period.
     */
    totalSkyboxesInCurrentPeriod: number;
}
