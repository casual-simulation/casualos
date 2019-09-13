import { TunnelClient } from '../TunnelClient';
import { Observable, Observer } from 'rxjs';
import { TunnelMessage } from '../TunnelResponse';
import { TunnelRequest, ForwardTunnelRequest } from '../ClientTunnelRequest';
import WebSocket from 'ws';
import { createServer } from 'net';
import { wrap } from './WebSocket';

export class WebSocketClient implements TunnelClient {
    private _host: string;

    constructor(host: string) {
        this._host = host;
    }

    open(request: TunnelRequest): Observable<TunnelMessage> {
        if (request.direction === 'forward') {
            return forwardRequest(request, this._host);
        } else {
            throw new Error('Not supported');
        }
    }
}

function forwardRequest(
    request: ForwardTunnelRequest,
    host: string
): Observable<TunnelMessage> {
    return Observable.create((observer: Observer<TunnelMessage>) => {
        let url = new URL('/forward', host);
        url.search = `host=${encodeURIComponent(
            request.remoteHost
        )}&port=${encodeURIComponent(request.remotePort.toString())}`;

        const server = createServer(c => {
            const ws = new WebSocket(url.href, {
                headers: {
                    Authorization: 'Bearer ' + request.token,
                },
            });
            const wsStream = wrap(ws);
            wsStream.pipe(c).pipe(wsStream);

            observer.next({
                type: 'connected',
            });
        });
        server.listen(request.localPort);

        server.on('error', err => {
            observer.next({
                type: 'error',
                message: err.message,
            });
        });
    });
}
