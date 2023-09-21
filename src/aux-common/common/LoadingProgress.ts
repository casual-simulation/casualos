/**
 * Progress status from an object.
 */
export interface ProgressStatus {
    /**
     * The status message to go with the update.
     * If not included then the status should not be updated.
     */
    message?: string;

    /**
     * The percentage of progress that has been completed.
     * The value is always between 0 and 1.
     * If not included then the percentage should not be updated.
     */
    progressPercent?: number;

    /**
     * The error that occurred.
     * If this value is provided then it indicates that the loading operation failed.
     */
    error?: string;
}

/**
 * Defines a type for functions that can be notified of progress updates during an operation.
 */
export declare type LoadingProgressCallback = (status: ProgressStatus) => void;
