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
import type { TunnelClient } from '../TunnelClient';
import type { Observable } from 'rxjs';
import {
    map,
    mergeMap,
    tap,
    filter,
    retry,
    share,
    startWith,
} from 'rxjs/operators';
import type { TunnelMessage } from '../TunnelResponse';
import type {
    TunnelRequest,
    ForwardTunnelRequest,
    ReverseTunnelRequest,
} from '../ClientTunnelRequest';
import { createServer } from 'net';
import { wrap } from './WebSocket';
import {
    listen,
    cleanup,
    websocket,
    messages,
    connect,
    completeWith,
} from './utils';

export class WebSocketClient implements TunnelClient {
    private _host: string;

    constructor(host: string) {
        this._host = host;
    }

    open(request: TunnelRequest): Observable<TunnelMessage> {
        if (request.direction === 'forward') {
            return forwardRequest(request, this._host);
        } else {
            return reverseRequest(request, this._host);
        }
    }
}

function reverseRequest(
    request: ReverseTunnelRequest,
    host: string
): Observable<TunnelMessage> {
    let url = new URL('/reverse', host);
    if (request.remotePort) {
        url.search = `port=${encodeURIComponent(
            request.remotePort.toString()
        )}`;
    }

    const web = websocket(url.href, {
        headers: {
            Authorization: 'Bearer ' + request.token,
        },
    }).pipe(share());

    return web.pipe(
        mergeMap((ws) => {
            return messages(ws).pipe(
                filter(
                    (message) =>
                        typeof message === 'string' &&
                        message.startsWith('NewConnection:')
                ),
                map((message) => {
                    const id = (<string>message).substring(
                        'NewConnection:'.length
                    );
                    let url = new URL('/connect', host);
                    url.search = `id=${encodeURIComponent(id)}`;
                    return url;
                }),
                mergeMap(() =>
                    connect({
                        host: request.localHost,
                        port: request.localPort,
                    }).pipe(map((connection) => ({ url, connection } as const)))
                ),
                mergeMap((extra) => {
                    return websocket(extra.url.href, {
                        headers: {
                            Authorization: 'Bearer ' + request.token,
                        },
                    }).pipe(map((ws) => ({ ...extra, ws })));
                }),
                tap(({ connection, ws }) => {
                    const wsStream = wrap(ws);
                    wsStream.pipe(connection).pipe(wsStream);
                }),
                map(
                    (_) =>
                        <TunnelMessage>{
                            type: 'connected',
                        }
                ),
                startWith(<TunnelMessage>{
                    type: 'connected',
                }),

                // Re-subscribe to the messages observable
                // if a connection fails
                retry()
            );
        }),
        completeWith(web)
    );
}

function forwardRequest(
    request: ForwardTunnelRequest,
    host: string
): Observable<TunnelMessage> {
    let url = new URL('/forward', host);
    url.search = `host=${encodeURIComponent(
        request.remoteHost
    )}&port=${encodeURIComponent(request.remotePort.toString())}`;

    const server = createServer();

    const conn = listen(server, request.localPort).pipe(share());

    return conn.pipe(
        mergeMap((connection) => cleanup(connection)),
        mergeMap((connection) =>
            websocket(url.href, {
                headers: {
                    Authorization: 'Bearer ' + request.token,
                },
            }).pipe(map((ws) => ({ connection, ws })))
        ),
        tap(({ connection, ws }) => {
            const wsStream = wrap(ws);
            wsStream.pipe(connection).pipe(wsStream);
        }),
        map(
            (_) =>
                <TunnelMessage>{
                    type: 'connected',
                }
        ),
        completeWith(conn)
    );
}
