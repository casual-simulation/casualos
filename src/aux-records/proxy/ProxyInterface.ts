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
import type { Result, SimpleError } from '@casual-simulation/aux-common';

/**
 * The HTTP methods that proxies support.
 */
export type ProxyRequestMethod =
    | 'GET'
    | 'POST'
    | 'PUT'
    | 'PATCH'
    | 'DELETE'
    | 'HEAD'
    | 'OPTIONS';

/**
 * Defines an interface for a service that is able to send requests to the host of a proxy.
 */
export interface ProxyInterface {
    /**
     * Sends the given request and returns the response.
     * @param request The request that should be sent.
     */
    sendRequest(
        request: ProxyInterfaceRequest
    ): Promise<Result<ProxyInterfaceResponse, SimpleError>>;
}

/**
 * Defines a request that should be sent to the host of a proxy.
 */
export interface ProxyInterfaceRequest {
    /**
     * The host that the request should be sent to.
     * May include a port. (e.g. `example.com:8443`)
     */
    host: string;

    /**
     * The path that the request should be sent to. (e.g. `/v1/chat`)
     * May include a query string.
     */
    path: string;

    /**
     * The HTTP method that should be used for the request.
     */
    method: ProxyRequestMethod;

    /**
     * The headers that should be included in the request.
     */
    headers: {
        [key: string]: string;
    };

    /**
     * The body that should be included in the request.
     * Null if the request should not have a body.
     */
    body: string | null;

    /**
     * The maximum number of miliseconds that the host has to respond to the request.
     */
    timeoutMs?: number | null;
}

/**
 * Defines the response that was recieved from the host of a proxy.
 */
export interface ProxyInterfaceResponse {
    /**
     * The HTTP status code of the response.
     */
    statusCode: number;

    /**
     * The headers that were included in the response.
     */
    headers: {
        [key: string]: string;
    };

    /**
     * The body of the response.
     */
    body: string | null;
}
