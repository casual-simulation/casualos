import {
    BotsState,
    GenericHttpRequest,
    GenericHttpResponse,
    ServerError,
    StoredAux,
} from '@casual-simulation/aux-common';
import { z } from 'zod';

/**
 * The schema for version 1 stored AUX data.
 */
export const STORED_AUX_VERSION_1_SCHEMA = z.object({
    version: z.literal(1),
    state: z.object({}).catchall(
        z.object({
            id: z.string(),
            space: z.string().optional().nullable(),
            tags: z.object({}).catchall(z.any()),
            masks: z
                .object({})
                .catchall(z.object({}).catchall(z.any()))
                .optional()
                .nullable(),
        })
    ),
});

/**
 * The schema for version 2 stored AUX data.
 */
export const STORED_AUX_VERSION_2_SCHEMA = z.object({
    version: z.literal(2),
    updates: z.array(
        z.object({
            id: z.number(),
            update: z.string(),
            timestamp: z.number(),
        })
    ),
});

/**
 * The schema for stored AUX data.
 */
export const STORED_AUX_SCHEMA = z.discriminatedUnion('version', [
    STORED_AUX_VERSION_1_SCHEMA,
    STORED_AUX_VERSION_2_SCHEMA,
]);

/**
 * The schema for a webhook aux state.
 */
export const WEBHOOK_AUX_STATE_SCHEMA = z.object({
    type: z.literal('aux'),
    state: STORED_AUX_SCHEMA,
});

/**
 * The schema for a webhook URL state.
 */
export const WEBHOOK_URL_STATE_SCHEMA = z.object({
    type: z.literal('url'),
    requestUrl: z.string(),
    requestMethod: z.string(),
    requestHeaders: z.record(z.string()),
});

/**
 * The schema for a webhook state.
 */
export const WEBHOOK_STATE_SCHEMA = z.discriminatedUnion('type', [
    WEBHOOK_AUX_STATE_SCHEMA,
    WEBHOOK_URL_STATE_SCHEMA,
]);

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