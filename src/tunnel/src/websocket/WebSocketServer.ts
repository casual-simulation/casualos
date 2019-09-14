import WebSocket, { Server } from 'ws';
import {
    TunnelServer,
    TunnelRequestMapper,
    TunnelRequestFilter,
} from '../TunnelServer';
import { Server as HttpServer, IncomingMessage } from 'http';
import { Socket, createServer } from 'net';
import {
    TunnelRequest,
    ForwardTunnelRequest,
    ReverseTunnelRequest,
    ConnectTunnelRequest,
} from '../ServerTunnelRequest';
import { wrap } from './WebSocket';
import uuid from 'uuid/v4';
import { requestUrl, connect, listen, handleUpgrade } from './utils';
import { Observable, Subject, observable } from 'rxjs';
import { flatMap, tap } from 'rxjs/operators';

export interface ServerOptions {
    autoUpgrade?: boolean;
}

export class WebSocketServer implements TunnelServer {
    requestMapper: TunnelRequestMapper;
    acceptTunnel: TunnelRequestFilter;

    get tunnelAccepted(): Observable<TunnelRequest> {
        return this._tunnelAccepted;
    }

    get tunnelDropped(): Observable<TunnelRequest> {
        return this._tunnelDropped;
    }

    closed: boolean;

    private _http: HttpServer;
    private _server: Server;
    private _connection: Socket;
    private _options: ServerOptions;
    private _tunnelAccepted: Subject<TunnelRequest> = new Subject();
    private _tunnelDropped: Subject<TunnelRequest> = new Subject();

    private _map: Map<string, Socket> = new Map();

    constructor(
        server: HttpServer,
        options: ServerOptions = {
            autoUpgrade: true,
        }
    ) {
        this._http = server;
        this._options = options;
    }

    listen(): void {
        this._server = new Server({
            noServer: true,
        });

        this._server.on('error', err => {
            console.error('Server error', err);
            if (this._connection) {
                this._connection.destroy();
            }
        });

        if (this._options.autoUpgrade) {
            this._http.on(
                'upgrade',
                (request: IncomingMessage, socket: Socket, head: Buffer) => {
                    this.upgradeRequest(request, socket, head);
                }
            );
        }

        console.log('Listening for connections...');
    }

    upgradeRequest(request: IncomingMessage, socket: Socket, head: Buffer) {
        const tunnelRequest = getTunnelRequest(request);

        if (!tunnelRequest) {
            // TODO: Replace with real message
            socket.destroy();
            return;
        }

        const mapped = this.requestMapper
            ? this.requestMapper(tunnelRequest)
            : tunnelRequest;

        if (this.acceptTunnel) {
            if (!this.acceptTunnel(mapped)) {
                console.log('[WSS] Tunnel request rejected.');
                socket.destroy();
                return;
            }
        }

        console.log('[WSS] Tunnel request accepted!');
        this._handle(mapped, request, socket, head);
    }

    private _handle(
        request: TunnelRequest,
        req: IncomingMessage,
        socket: Socket,
        head: Buffer
    ) {
        if (request.direction === 'forward') {
            this._forwardUpgrade(request, req, socket, head);
        } else if (request.direction === 'reverse') {
            this._reverseUpgrade(request, req, socket, head);
        } else if (request.direction === 'connect') {
            this._connectUpgrade(request, req, socket, head);
        }
    }

    private _connectUpgrade(
        request: ConnectTunnelRequest,
        req: IncomingMessage,
        socket: Socket,
        head: Buffer
    ) {
        console.log(`[WSS] Connecting ID ${request.id}...`);

        const connection = this._map.get(request.id);
        if (!connection) {
            console.log('[WSS] Connection for ID not found.');
            socket.destroy();
        }

        const observable = handleUpgrade(this._server, req, socket, head).pipe(
            tap(ws => {
                const wsStream = wrap(ws);
                connection.pipe(wsStream).pipe(connection);
                connection.resume();

                this._tunnelAccepted.next(request);
            })
        );

        observable.subscribe(null, err => {
            console.error('Connection error:', err);
        });
    }

    private _reverseUpgrade(
        request: ReverseTunnelRequest,
        req: IncomingMessage,
        socket: Socket,
        head: Buffer
    ) {
        console.log(`[WSS] Starting TCP server for port ${request.localPort}`);

        const observable = handleUpgrade(this._server, req, socket, head).pipe(
            flatMap(ws => {
                const server = createServer();
                return listen(server, request.localPort).pipe(
                    tap(connection => {
                        const id = uuid();
                        connection.pause();
                        this._map.set(id, connection);
                        ws.send('NewConnection:' + id);
                    })
                );
            })
        );

        observable.subscribe(null, err => {
            console.error('Server error:', err);
        });
        this._tunnelAccepted.next(request);
    }

    private _forwardUpgrade(
        request: ForwardTunnelRequest,
        req: IncomingMessage,
        socket: Socket,
        head: Buffer
    ) {
        console.log(
            `[WSS] Connecting to remote host at ${request.forwardHost}:${
                request.forwardPort
            }...`
        );

        const observable = connect({
            host: request.forwardHost,
            port: request.forwardPort,
        }).pipe(
            tap(_ => console.log('[WSS] Connected!')),
            flatMap(
                connection => handleUpgrade(this._server, req, socket, head),
                (connection, ws) => ({ connection, ws })
            ),
            tap(({ connection, ws }) => {
                const wsStream = wrap(ws);

                connection.pipe(wsStream).pipe(connection);

                this._tunnelAccepted.next(request);
            })
        );

        observable.subscribe(null, err => {
            console.error('Connection error:', err);
        });
    }

    unsubscribe(): void {}
}

function getTunnelRequest(req: IncomingMessage) {
    const url = requestUrl(req, 'https');

    const query = url.searchParams;
    const direction = url.pathname.substr(1);
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith('Bearer')) {
        console.log('[WSS] Client sent request without bearer token.');
        return null;
    }

    const token = authorization.substring('Bearer '.length);

    let request: TunnelRequest;

    if (direction === 'forward' || direction === 'reverse') {
        const port = parseInt(query.get('port'));

        if (!port) {
            console.log('[WSS] Client sent request without port.');
            return null;
        }

        if (direction === 'forward') {
            const host = query.get('host');
            if (!host) {
                console.log('[WSS] Client sent request without host.');
                return null;
            }

            request = {
                direction: direction,
                authorization: token,
                hostname: url.hostname,
                forwardHost: host,
                forwardPort: port,
            };
        } else {
            request = {
                direction: direction,
                authorization: token,
                hostname: url.hostname,
                localPort: port,
            };
        }
    } else if (direction === 'connect') {
        const id = query.get('id');

        if (!id) {
            console.log('[WSS] Client sent request without ID');
            return null;
        }

        request = {
            direction: direction,
            id: id,
        };
    } else {
        return null;
    }

    return request;
}
