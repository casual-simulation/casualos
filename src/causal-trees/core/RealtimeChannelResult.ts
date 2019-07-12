import { LoginErrorReason } from './LoginError';

/**
 * Defines an interface that represents the result from a realtime channel request.
 */
export interface RealtimeChannelResult<T> {
    success: boolean;
    value: T;
    error?: RealtimeChannelError;
}

export type RealtimeChannelError =
    | RealtimeChannelNotAuthorizedError
    | RealtimeChannelNotAuthenticatedError;

export interface RealtimeChannelNotAuthenticatedError {
    type: 'not_authenticated';
    reason: LoginErrorReason;
}

export interface RealtimeChannelNotAuthorizedError {
    type: 'not_authorized';
    reason: LoginErrorReason;
}

export interface RealtimeChannelGenericError {
    type: 'generic';
    message: string;
}
