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
import type {
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
     * The ID of the user that is making the request.
     * Null if the user is not logged in.
     */
    requestUserId: string | null;

    /**
     * The name of the record that the webhook state came from.
     * Null if the webhook state is not from a record (i.e. it is from a public inst).
     */
    recordName: string | null;

    /**
     * The inst that the webhook state came from.
     * If null, then records requests won't include the instance that the request is coming from.
     */
    inst?: string;

    /**
     * The state that should be injected into the environment.
     */
    state: WebhookState;

    /**
     * The ID of the user who owns the session key.
     * Not provided if the webhook is not running in a session.
     */
    sessionUserId?: string | null;

    /**
     * The session key that should be used by the environment for records requests.
     * Not provided if the webhook is not running in a session.
     */
    sessionKey?: string | null;

    /**
     * The connection key that should be used by the environment for records requests.
     * Not provided if the webhook is not running in a session.
     */
    connectionKey?: string | null;

    /**
     * The extra options for the webhook run.
     */
    options?: HandleWebhookOptions;
}

export interface HandleWebhookOptions {
    /**
     * The maximum number of miliseconds that the webhook has to initialize.
     */
    initTimeoutMs: number;

    /**
     * The maximum number of miliseconds that the webhook has to respond to a request after being initialized.
     */
    requestTimeoutMs: number;

    /**
     * The maximum number of miliseconds that the system will take to fetch the AUX state for the webhook.
     */
    fetchTimeoutMs: number;

    /**
     * The maximum number of miliseconds that the system will take to add the AUX state to the webhook simulation.
     */
    addStateTimeoutMs: number;
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

    /**
     * The logs that were produced while handling the request.
     */
    logs: string[];
}

export interface HandleHttpRequestFailure {
    success: false;
    errorCode:
        | 'unacceptable_request'
        | 'invalid_webhook_target'
        | 'took_too_long'
        | ServerError;

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
