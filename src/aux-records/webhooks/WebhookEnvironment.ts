import {
    BotsState,
    GenericHttpRequest,
    GenericHttpResponse,
    ServerError,
} from '@casual-simulation/aux-common';

/**
 * Defines an interface for objects that represent a webhook environment.
 * That is, they provide a way to call into the environment that the webhook is running in and shut it down.
 *
 * In addition to providing a way to manage the environment, it also should provide mechanisms for securely isolating the environment from the rest of the system.
 */
export interface WebhookEnvironment {
    /**
     * Handles the given HTTP request.
     * Returns a promise that resolves with the response.
     * @param request The request that should be handled.
     */
    handleHttpRequest(
        request: HandleHttpRequestRequest
    ): Promise<HandleHttpRequestResult>;
}

export interface HandleHttpRequestRequest {
    /**
     * The request that should be handled.
     */
    request: GenericHttpRequest;

    /**
     * The state that should be injected into the environment.
     */
    state: BotsState;
}

export type HandleHttpRequestResult =
    | HandleHttpRequestSuccess
    | HandleHttpRequestFailure;

export interface HandleHttpRequestSuccess {
    success: true;
    response: GenericHttpResponse;
}

export interface HandleHttpRequestFailure {
    success: false;
    errorCode: 'unacceptable_request' | ServerError;
    errorMessage: string;
}

export interface CreateEnvironmentRequest {
    /**
     * The state that should be injected into the environment.
     */
    state: BotsState;
}
