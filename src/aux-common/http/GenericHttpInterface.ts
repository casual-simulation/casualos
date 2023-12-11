import { z } from 'zod';

/**
 * Defines an interface for a generic HTTP request.
 */
export interface GenericHttpRequest {
    /**
     * The path that the HTTP request is for.
     * Does not include the query string parameters.
     */
    path: string;

    /**
     * The query string parameters.
     */
    query: GenericQueryStringParameters;

    /**
     * The path parameters.
     * i.e. These are parameters that are calculated from the path of the
     */
    pathParams: GenericPathParameters;

    /**
     * The method that the HTTP request uses.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods
     */
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | 'OPTIONS';

    /**
     * The headers for the request.
     */
    headers: GenericHttpHeaders;

    /**
     * The body of the HTTP request.
     */
    body: string | null;

    /**
     * The IP address that the request is from.
     */
    ipAddress: string;
}

/**
 * Defines an interface for a generic HTTP response.
 */
export interface GenericHttpResponse {
    /**
     * The status code for the response.
     * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status
     *
     */
    statusCode: number;

    /**
     * The list of headers to include in the response.
     */
    headers?: GenericHttpHeaders;

    /**
     * The body of the response.
     */
    body?: string | null;
}

export interface GenericHttpHeaders {
    [key: string]: string;
}

export interface GenericQueryStringParameters {
    [key: string]: string;
}

export interface GenericPathParameters {
    [key: string]: string;
}

/**
 * Defines an interface for a generic Websocket request.
 */
export interface GenericWebsocketRequest {
    type: 'connect' | 'disconnect' | 'message';

    /**
     * The ID of the connection that the server has associated with this request.
     */
    connectionId: string;

    /**
     * The body of the websocket request.
     */
    body?: string | Uint8Array | null;

    /**
     * The IP address of the request.
     */
    ipAddress: string;

    /**
     * The value of the HTTP Origin header when the connection was established.
     */
    origin: string;
}

export const genericHttpRequestSchema = z.object({
    path: z.string(),
    pathParams: z.object({}).catchall(z.string()),
    method: z.union([
        z.literal('GET'),
        z.literal('POST'),
        z.literal('PUT'),
        z.literal('DELETE'),
        z.literal('HEAD'),
        z.literal('OPTIONS'),
    ]),
    query: z.object({}).catchall(z.string()),
    headers: z.object({}).catchall(z.string()),
    body: z.union([z.string(), z.null()]),
});
