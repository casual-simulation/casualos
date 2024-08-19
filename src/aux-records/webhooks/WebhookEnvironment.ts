import {
    BotsState,
    GenericHttpRequest,
    GenericHttpResponse,
    ServerError,
    StoredAux,
} from '@casual-simulation/aux-common';
import { z } from 'zod';

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
     * The name of the record that the webhook is running in.
     */
    recordName: string;

    /**
     * The inst that the webhook is running in.
     */
    inst?: string;

    /**
     * The state that should be injected into the environment.
     */
    state: WebhookState;
}

export type WebhookState = WebhookAuxState | WebhookUrlState;

/**
 * Defines an object that represents an aux file that should be injected into the webhook environment.
 */
export interface WebhookAuxState {
    type: 'aux';

    /**
     * The state that should be injected into the environment.
     */
    state: StoredAux;
}

/**
 * Defines an object that represents a URL that contains an aux file that should be injected into the webhook environment.
 */
export interface WebhookUrlState {
    type: 'url';

    /**
     * The URL that the request to get the file should be made to.
     */
    requestUrl: string;

    /**
     * The HTTP method that should be used to make the request.
     */
    requestMethod: string;

    /**
     * The HTTP headers that should be included in the request.
     */
    requestHeaders: {
        [name: string]: string;
    };
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
    errorCode: 'unacceptable_request' | 'invalid_webhook_target' | ServerError;

    /**
     * The error message that should be displayed to the user.
     */
    errorMessage: string;

    /**
     * The internal reason why this error was produced.
     */
    internalError?: {
        success: false;
        errorCode: 'unacceptable_request';
        errorMessage: string;
        issues: z.ZodIssue[];
    };
}

export interface CreateEnvironmentRequest {
    /**
     * The state that should be injected into the environment.
     */
    state: BotsState;
}
