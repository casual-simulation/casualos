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
    RequestScope,
    GenericHttpRequest,
    GenericHttpHeaders,
    GenericWebsocketRequest,
    WebsocketMessage,
    WebsocketMessageEvent,
    WebsocketUploadRequestEvent,
    WebsocketDownloadRequestEvent,
    GenericQueryStringParameters,
    GenericPathParameters,
    WebsocketHttpResponseMessage,
    WebsocketHttpPartialResponseMessage,
    GenericHttpResponse,
} from '@casual-simulation/aux-common';
import {
    tryParseJson,
    WebsocketEventTypes,
} from '@casual-simulation/aux-common';
import { sortBy } from 'es-toolkit/compat';
import { unwindAndCaptureAsync } from './TestUtils';
import type { MemoryWebsocketMessenger } from './websockets';

export const DEFAULT_ORIGIN = 'https://example.com';
export const DEFAULT_HEADERS: GenericHttpHeaders = {
    origin: DEFAULT_ORIGIN,
};

export const DEFAULT_IP_ADDRESS = '123.456.789';

export function scoped(
    scope: RequestScope,
    request: GenericHttpRequest
): GenericHttpRequest {
    return {
        ...request,
        scope,
    };
}

export function httpGet(
    url: string,
    headers: GenericHttpHeaders = DEFAULT_HEADERS,
    ipAddress: string = DEFAULT_IP_ADDRESS
): GenericHttpRequest {
    return httpRequest('GET', url, null, headers, ipAddress);
}

export function httpPut(
    url: string,
    body: any,
    headers: GenericHttpHeaders = DEFAULT_HEADERS,
    ipAddress: string = DEFAULT_IP_ADDRESS
): GenericHttpRequest {
    return httpRequest('PUT', url, body, headers, ipAddress);
}

export function httpPost(
    url: string,
    body: any,
    headers: GenericHttpHeaders = DEFAULT_HEADERS,
    ipAddress: string = DEFAULT_IP_ADDRESS
): GenericHttpRequest {
    return httpRequest('POST', url, body, headers, ipAddress);
}

export function httpDelete(
    url: string,
    body: any,
    headers: GenericHttpHeaders = DEFAULT_HEADERS,
    ipAddress: string = DEFAULT_IP_ADDRESS
): GenericHttpRequest {
    return httpRequest('DELETE', url, body, headers, ipAddress);
}

export function procedureRequest(
    name: string,
    input: any,
    headers: GenericHttpHeaders = DEFAULT_HEADERS,
    query?: any,
    ipAddress: string = DEFAULT_IP_ADDRESS
): GenericHttpRequest {
    return httpRequest(
        'POST',
        '/api/v3/callProcedure',
        JSON.stringify({
            procedure: name,
            input: input,
            query,
        }),
        headers,
        ipAddress
    );
}

export function httpRequest(
    method: GenericHttpRequest['method'],
    url: string,
    body: GenericHttpRequest['body'] | null,
    headers: GenericHttpHeaders = DEFAULT_HEADERS,
    ipAddress: string = DEFAULT_IP_ADDRESS
): GenericHttpRequest {
    const { path, pathParams, query } = parseUrl(url);

    return {
        path,
        body,
        headers,
        pathParams,
        method,
        query,
        ipAddress,
    };
}

export function wsMessage(
    connectionId: string,
    body: string,
    ipAddress: string = DEFAULT_IP_ADDRESS,
    origin: string = DEFAULT_ORIGIN
): GenericWebsocketRequest {
    return {
        type: 'message',
        connectionId,
        body,
        ipAddress,
        origin,
    };
}

export function messageEvent(
    requestId: number,
    body: WebsocketMessage
): string {
    const e: WebsocketMessageEvent = [
        WebsocketEventTypes.Message,
        requestId,
        body,
    ];
    return JSON.stringify(e);
}

export function uploadRequestEvent(requestId: number): string {
    const e: WebsocketUploadRequestEvent = [
        WebsocketEventTypes.UploadRequest,
        requestId,
    ];

    return JSON.stringify(e);
}

export function downloadRequestEvent(
    requestId: number,
    downloadUrl: string,
    downloadMethod: string,
    downloadHeaders: any
): string {
    const e: WebsocketDownloadRequestEvent = [
        WebsocketEventTypes.DownloadRequest,
        requestId,
        downloadUrl,
        downloadMethod,
        downloadHeaders,
    ];

    return JSON.stringify(e);
}

export function wsConnect(
    connectionId: string,
    ipAddress: string = DEFAULT_IP_ADDRESS,
    origin: string = DEFAULT_ORIGIN
): GenericWebsocketRequest {
    return {
        type: 'connect',
        connectionId,
        body: null,
        ipAddress,
        origin,
    };
}

export function wsDisconnect(
    connectionId: string,
    ipAddress: string = DEFAULT_IP_ADDRESS,
    origin: string = DEFAULT_ORIGIN
): GenericWebsocketRequest {
    return {
        type: 'disconnect',
        connectionId,
        body: null,
        ipAddress,
        origin,
    };
}

export function parseUrl(url: string): {
    path: string;
    query: GenericQueryStringParameters;
    pathParams: GenericPathParameters;
} {
    let uri = new URL(url, DEFAULT_ORIGIN);

    const pathParams = parsePathParams(uri.pathname);
    const finalPath = pathParams
        .map((p) => (typeof p === 'string' ? p : p.value))
        .join('/');
    const params = getPathParams(pathParams);

    let query = {} as GenericQueryStringParameters;

    uri.searchParams.forEach((value, key) => {
        query[key] = value;
    });

    return {
        path: finalPath,
        pathParams: params,
        query,
    };
}

export function parsePathParams(
    path: string | string[]
): (string | PathParam)[] {
    if (typeof path === 'string') {
        return parsePathParams(path.split('/'));
    }
    let result = [] as (string | PathParam)[];
    for (let segment of path) {
        let p = decodeURI(segment);
        if (p.startsWith('{') && p.endsWith('}')) {
            let splitPoint = p.indexOf(':');
            let name = p.slice(1, splitPoint);
            let value = p.slice(splitPoint + 1, p.length - 1);
            result.push({
                name,
                value,
            });
        } else {
            result.push(segment);
        }
    }

    return result;
}

export function getPathParams(path: (string | PathParam)[]) {
    let result = {} as GenericPathParameters;
    for (let p of path) {
        if (typeof p === 'string') {
            continue;
        }
        result[p.name] = p.value;
    }

    return result;
}

export interface PathParam {
    value: string;
    name: string;
}

export function corsHeaders(origin: string) {
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
}

export function expectNoWebSocketErrors(
    websocketMessenger: MemoryWebsocketMessenger,
    connectionId: string
) {
    const errors = getWebSockerErrors(websocketMessenger, connectionId);
    expect(errors).toEqual([]);
}

export function getWebSockerErrors(
    websocketMessenger: MemoryWebsocketMessenger,
    connectionId: string
) {
    const events = websocketMessenger.getEvents(connectionId);
    const errors = events.filter((e) => e[0] === WebsocketEventTypes.Error);
    return errors;
}

/**
 * Tests that the response body of an HTTP request parses to equal the expected value.
 * Returns the parsed body.
 * @param response The response to test.
 * @param expected The expected body.
 * @returns
 */
export async function expectResponseBodyToEqual<T = any>(
    response: GenericHttpResponse,
    expected: any
): Promise<T> {
    let body: any;
    if (
        response.body &&
        typeof response.body === 'object' &&
        Symbol.asyncIterator in response.body
    ) {
        const result = await unwindAndCaptureAsync(
            response.body[Symbol.asyncIterator]()
        );
        body = [
            ...result.states.map((s) => JSON.parse(s.trim())),
            JSON.parse(result.result.trim()),
        ];
    } else {
        if (!response.body) {
            body = undefined;
        } else {
            const jsonResult = tryParseJson(response.body as string);
            if (jsonResult.success) {
                body = jsonResult.value;
            } else {
                body = response.body;
            }
        }
    }

    expect({
        ...response,
        body,
    }).toEqual(expected);

    return body;
}

export function expectWebsocketHttpResponseBodyToEqual(
    message: WebsocketHttpResponseMessage,
    expected: any
) {
    const response = message.response;

    let json: any;
    if (response.headers?.['content-type'] === 'application/x-ndjson') {
        const lines = (response.body as string).split('\n');
        json = lines
            .map((l) => l.trim())
            .filter((l) => !!l)
            .map((l) => JSON.parse(l.trim()));
    } else {
        json = response.body ? JSON.parse(response.body as string) : undefined;
    }

    expect({
        ...response,
        body: json,
    }).toEqual(expected);
}

export function expectWebsocketHttpPartialResponseBodiesToEqual(
    messages: WebsocketHttpPartialResponseMessage[],
    expected: any
) {
    let bodies = [] as any[];
    for (let m of messages) {
        if (m.response) {
            bodies.push(JSON.parse(m.response.body as string));
        }
    }
    const response = messages[0].response;

    expect({
        ...response,
        body: bodies,
    }).toEqual(expected);
}

export function getWebsocketHttpResponse(
    websocketMessenger: MemoryWebsocketMessenger,
    connectionId: string,
    id: number
): WebsocketHttpResponseMessage {
    const messages = websocketMessenger.getMessages(connectionId);
    return messages.find(
        (m) => m.type === 'http_response' && m.id === id
    ) as WebsocketHttpResponseMessage;
}

export function getWebsocketHttpPartialResponses(
    websocketMessenger: MemoryWebsocketMessenger,
    connectionId: string,
    id: number
): WebsocketHttpPartialResponseMessage[] {
    const messages = websocketMessenger.getMessages(connectionId);
    return sortBy(
        messages.filter(
            (m) => m.type === 'http_partial_response' && m.id === id
        ) as WebsocketHttpPartialResponseMessage[],
        (m) => m.index
    );
}
