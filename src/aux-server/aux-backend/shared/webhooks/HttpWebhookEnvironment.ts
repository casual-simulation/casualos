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
