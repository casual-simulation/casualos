import type { KnownErrorCodes } from './ErrorCodes';
import type { DenialReason } from '../common/DenialReason';

/**
 * Defines the result of an operation.
 */
export type Result<T extends object> = SuccessResult<T> | FailureResult;

/**
 * Represents the success of an operation.
 */
export type SuccessResult<T> = T & {
    /**
     * Indicates that the operation was successful.
     */
    success: true;
};

/**
 * The result of a failed operation.
 */
export interface FailureResult {
    /**
     * Indicates that the operation was not successful.
     */
    success: false;

    /**
     * The error code that was encountered.
     */
    errorCode: KnownErrorCodes;

    /**
     * The error message.
     */
    errorMessage: string;

    /**
     * The reason for the denial.
     */
    reason?: DenialReason;
}
