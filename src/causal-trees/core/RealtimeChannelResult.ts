/**
 * Defines an interface that represents the result from a realtime channel request.
 */
export interface RealtimeChannelResult<T> {
    success: boolean;
    value: T;
    error?: RealtimeChannelError;
}

export type RealtimeChannelError = RealtimeChannelNotAuthorizedError;

export interface RealtimeChannelNotAuthorizedError {
    type: 'not_authorized';
}

export interface RealtimeChannelGenericError {
    type: 'generic';
    message: string;
}
