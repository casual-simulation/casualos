import { TunnelClient } from '../TunnelClient';
import { Observable, Observer } from 'rxjs';
import { map, flatMap, tap, filter, retry } from 'rxjs/operators';
import { TunnelMessage } from '../TunnelResponse';
import {
    TunnelRequest,
    ForwardTunnelRequest,
    ReverseTunnelRequest,
} from '../ClientTunnelRequest';
import WebSocket from 'ws';
import { createServer } from 'net';
import { wrap } from './WebSocket';
import { listen, cleanup, websocket, messages, connect } from './utils';

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
    url.search = `port=${encodeURIComponent(request.remotePort.toString())}`;

    return websocket(url.href, {
        headers: {
            Authorization: 'Bearer ' + request.token,
        },
    }).pipe(
        flatMap(ws => {
            return messages(ws).pipe(
                filter(
                    message =>
                        typeof message === 'string' &&
                        message.startsWith('NewConnection:')
                ),
                map(message => {
                    const id = (<string>message).substring(
                        'NewConnection:'.length
                    );
                    let url = new URL('/connect', host);
                    url.search = `id=${encodeURIComponent(id)}`;
                    return url;
                }),
                flatMap(
                    () =>
                        connect({
                            host: request.localHost,
                            port: request.localPort,
                        }),
                    (url, connection) => ({ url, connection })
                ),
                flatMap(
                    ({ url }) => {
                        return websocket(url.href, {
                            headers: {
                                Authorization: 'Bearer ' + request.token,
                            },
                        });
                    },
                    (extra, ws) => ({ ...extra, ws })
                ),
                tap(({ connection, ws }) => {
                    const wsStream = wrap(ws);
                    wsStream.pipe(connection).pipe(wsStream);
                }),
                map(
                    _ =>
                        <TunnelMessage>{
                            type: 'connected',
                        }
                ),

                // Re-subscribe to the messages observable
                // if a connection fails
                retry()
            );
        })
    );

    // return Observable.create((observer: Observer<TunnelMessage>) => {
    //     console.log('Create');

    //     const ws = new WebSocket(url.href, {
    //         headers: {
    //             Authorization: 'Bearer ' + request.token,
    //         },
    //     });

    //     ws.on('message', data => {
    //         if (typeof data === 'string') {
    //             if (data.startsWith('NewConnection:')) {
    //                 const id = data.substring('NewConnection:'.length);
    //                 console.log('New Connection!', id);

    //                 let url = new URL('/connect', host);
    //                 url.search = `id=${encodeURIComponent(id)}`;

    //                 const tcp = connect(
    //                     {
    //                         host: request.localHost,
    //                         port: request.localPort,
    //                     },
    //                     () => {
    //                         const client = new WebSocket(url.href, {
    //                             headers: {
    //                                 Authorization: 'Bearer ' + request.token,
    //                             },
    //                         });

    //                         client.on('open', () => {
    //                             const stream = wrap(client);
    //                             tcp.pipe(stream).pipe(tcp);
    //                             observer.next({
    //                                 type: 'connected',
    //                             });
    //                         });

    //                         client.on('error', err => {
    //                             observer.error(err);
    //                             tcp.destroy();
    //                             client.close();
    //                         });
    //                     }
    //                 );

    //                 tcp.on('error', err => {
    //                     observer.error(err);
    //                     tcp.destroy();
    //                 });
    //             }
    //         }
    //     });
    // });
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

    return listen(server, request.localPort).pipe(
        flatMap(connection => cleanup(connection)),
        flatMap(
            _ =>
                websocket(url.href, {
                    headers: {
                        Authorization: 'Bearer ' + request.token,
                    },
                }),
            (connection, ws) => ({ connection, ws })
        ),
        tap(({ connection, ws }) => {
            const wsStream = wrap(ws);
            wsStream.pipe(connection).pipe(wsStream);
        }),
        map(_ => ({
            type: 'connected',
        }))
    );
}
