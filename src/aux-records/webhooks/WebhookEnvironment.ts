import {
    GenericHttpRequest,
    GenericHttpResponse,
} from '@casual-simulation/aux-common';

/**
 * Defines an interface for objects that represent a webhook environment.
 * That is, they provide a way to call into the environment that the webhook is running in and shut it down.
 */
export interface WebhookEnvironment {
    /**
     * Whether the environment has been closed.
     * Once closed, it cannot be opened again.
     */
    closed: boolean;

    /**
     * Disposes of the environment.
     * This should set closed to true and clean up any resources.
     */
    dispose(): void;

    /**
     * Handles the given HTTP request.
     * Returns a promise that resolves with the response.
     * @param request The request that should be handled.
     */
    handleHttpRequest(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse>;
}

/**
 * Defines an interface for objects that can create webhook environments.
 */
export interface WebhookEnvironmentFactory {
    /**
     * Creates a new webhook environment.
     */
    create(): WebhookEnvironment;
}
