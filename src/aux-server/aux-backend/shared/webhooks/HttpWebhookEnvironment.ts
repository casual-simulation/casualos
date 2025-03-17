import {
    GenericHttpRequest,
    GenericHttpResponse,
} from '@casual-simulation/aux-common';
import type {
    HandleHttpRequestRequest,
    HandleHttpRequestResult,
    WebhookEnvironment,
} from '@casual-simulation/aux-records';
import { Subscription } from 'rxjs';

/**
 * Defines a webhook environment that runs webhooks by making HTTP requests to a server.
 */
export class HttpWebhookEnvironment implements WebhookEnvironment {
    private _sub: Subscription = new Subscription();
    private _endpoint: string;

    get closed(): boolean {
        if (!this._sub) {
            return true;
        }
        return this._sub.closed;
    }

    unsubscribe(): void {
        if (this._sub) {
            this._sub.unsubscribe();
            this._sub = null;
        }
    }

    /**
     * Creates a new HttpWebhookEnvironment.
     * @param endpoint The endpoint that the environment should make requests to.
     */
    constructor(endpoint: string) {
        this._endpoint = endpoint;
    }

    async handleHttpRequest(
        request: HandleHttpRequestRequest
    ): Promise<HandleHttpRequestResult> {
        const result = await fetch(this._endpoint, {
            method: 'POST',
            body: JSON.stringify(request),
        });

        return await result.json();
    }
}
