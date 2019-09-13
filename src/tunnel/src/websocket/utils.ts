import { IncomingMessage } from 'http';

/**
 * Calculates the full request URL for the given message.
 * @param request The request.
 * @param protocol The protocol.
 */
export function requestUrl(request: IncomingMessage, protocol: string): URL {
    const path = request.url;
    const host = request.headers.host;

    return new URL(path, `${protocol}://${host}`);
}
