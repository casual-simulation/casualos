import { IncomingMessage } from 'http';
import { Observable, Observer, fromEventPattern } from 'rxjs';
import {
    Socket,
    createServer,
    Server,
    NetConnectOpts,
    connect as netConnect,
} from 'net';
import WebSocket from 'ws';
import { takeUntil, last } from 'rxjs/operators';

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

/**
 * Opens a socket connection.
 * @param options The options.
 */
export function connect(options: NetConnectOpts): Observable<Socket> {
    return new Observable((observer: Observer<Socket>) => {
        const tcp = netConnect(options, () => {
            observer.next(tcp);
        });

        tcp.on('close', () => {
            observer.complete();
        });

        tcp.on('error', (err) => {
            observer.error(err);
        });

        return () => {
            tcp.destroy();
        };
    });
}

/**
 * Listens for connections with the given server on the given port.
 * @param server The server.
 * @param port The port to listen on.
 */
export function listen(server: Server, port?: number): Observable<Socket> {
    return new Observable((observer: Observer<Socket>) => {
        server.on('connection', (socket) => {
            observer.next(socket);
        });

        server.on('error', (err) => {
            server.close();
            observer.error(err);
        });

        server.listen(port);

        return () => {
            server.close();
        };
    });
}

/**
 * Wraps the given socket in an observable.
 * @param connection The socket to wrap.
 */
export function cleanup(socket: Socket): Observable<Socket> {
    return new Observable((observer: Observer<Socket>) => {
        socket.on('close', () => {
            observer.complete();
        });

        socket.on('error', (err) => {
            socket.destroy();
            observer.error(err);
        });

        observer.next(socket);

        return () => {
            socket.destroy();
        };
    });
}

/**
 * Opens a websocket connection to the given address.
 * @param address The address to open the connection to.
 * @param options The options to use.
 */
export function websocket(
    address: string,
    options?: WebSocket.ClientOptions
): Observable<WebSocket> {
    return new Observable((observer: Observer<WebSocket>) => {
        const socket = new WebSocket(address, options);

        socket.on('open', () => {
            observer.next(socket);
        });

        socket.on('close', () => {
            observer.complete();
        });

        socket.on('error', (err) => {
            observer.error(err);
        });

        return () => {
            socket.close();
        };
    });
}

export function handleUpgrade(
    server: WebSocket.Server,
    req: IncomingMessage,
    socket: Socket,
    head: Buffer
): Observable<WebSocket> {
    return new Observable((observer: Observer<WebSocket>) => {
        let websocket: WebSocket;
        let closed = false;

        server.handleUpgrade(req, socket, head, (ws) => {
            websocket = ws;
            if (closed) {
                ws.close();
                return;
            }

            observer.next(ws);

            ws.on('close', () => {
                observer.complete();
            });

            ws.on('error', (err) => {
                observer.error(err);
            });
        });

        return () => {
            closed = true;
            if (websocket) {
                websocket.close();
            }
        };
    });
}

/**
 * Gets an observable list of messages from the given websocket.
 * @param websocket The websocket.
 */
export function messages(websocket: WebSocket): Observable<WebSocket.Data> {
    return fromEventPattern(
        (h) => websocket.on('message', h),
        (h) => websocket.off('message', h)
    );
}

export function completeWith<T>(observable: Observable<any>) {
    return takeUntil<T>(observable.pipe(last()));
}
