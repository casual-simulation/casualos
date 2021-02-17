import WebSocket, { Server } from 'ws';
import {
    TunnelServer,
    TunnelRequestMapper,
    TunnelRequestFilter,
} from '../TunnelServer';
import { Server as HttpServer, IncomingMessage } from 'http';
import { Socket, createServer, AddressInfo } from 'net';
import {
    TunnelRequest,
    ForwardTunnelRequest,
    ReverseTunnelRequest,
    ConnectTunnelRequest,
} from '../ServerTunnelRequest';
import { wrap } from './WebSocket';
import { v4 as uuid } from 'uuid';
import {
    requestUrl,
    connect,
    listen,
    handleUpgrade,
    completeWith,
} from './utils';
import { Observable, Subject, Subscription, ConnectableObservable } from 'rxjs';
import {
    flatMap,
    tap,
    finalize,
    share,
    takeUntil,
    last,
    publish,
} from 'rxjs/operators';

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

    get closed(): boolean {
        return this._sub.closed;
    }

    private _http: HttpServer;
    private _server: Server;
    private _connection: Socket;
    private _options: ServerOptions;
    private _tunnelAccepted: Subject<TunnelRequest> = new Subject();
    private _tunnelDropped: Subject<TunnelRequest> = new Subject();
    private _sub: Subscription;

    private _map: Map<string, Socket> = new Map();

    constructor(
        server: HttpServer,
        options: ServerOptions = {
            autoUpgrade: true,
        }
    ) {
        this._http = server;
        this._options = options;
        this._sub = new Subscription();
        this._serverError = this._serverError.bind(this);
        this.upgradeRequest = this.upgradeRequest.bind(this);
    }

    listen(): void {
        this._server = new Server({
            noServer: true,
        });

        this._server.on('error', this._serverError);
        this._sub.add(() => {
            this._server.off('error', this._serverError);
        });

        if (this._options.autoUpgrade) {
            this._http.on('upgrade', this.upgradeRequest);
            this._sub.add(() => {
                this._server.off('upgrade', this.upgradeRequest);
            });
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

    private _serverError(err: Error) {
        console.error('Server error', err);
        if (this._connection) {
            this._connection.destroy();
        }
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

        const upgrade = handleUpgrade(this._server, req, socket, head).pipe(
            publish()
        ) as ConnectableObservable<WebSocket>;

        const observable = upgrade.pipe(
            tap((ws) => {
                const wsStream = wrap(ws);
                connection.pipe(wsStream).pipe(connection);
                connection.resume();

                this._tunnelAccepted.next(request);
            }),
            finalize(() => {
                this._tunnelDropped.next(request);
            }),
            completeWith(upgrade)
        );

        observable.subscribe(null, (err) => {
            console.error('Connection error:', err);
        });

        upgrade.connect();
    }

    private _reverseUpgrade(
        request: ReverseTunnelRequest,
        req: IncomingMessage,
        socket: Socket,
        head: Buffer
    ) {
        if (request.localPort) {
            console.log(
                `[WSS] Starting TCP server for port ${request.localPort}`
            );
        } else {
            console.log(`[WSS] Starting TCP server on any open port`);
            request.localPort = 0;
        }

        const upgrade = handleUpgrade(this._server, req, socket, head).pipe(
            // Make the observable connectable so we can
            // ensure that everything gets subscribed before letting it run.
            publish<WebSocket>()
        ) as ConnectableObservable<WebSocket>;

        const observable = upgrade.pipe(
            flatMap((ws) => {
                const server = createServer();

                server.on('listening', () => {
                    const address = server.address();
                    if (typeof address === 'object') {
                        request.localPort = address.port;
                    }
                    console.log(
                        `[WSS] Starting TCP server started on ${request.localPort}`
                    );
                    this._tunnelAccepted.next(request);
                });

                return listen(server, request.localPort).pipe(
                    tap((connection) => {
                        const id = uuid();
                        connection.pause();
                        this._map.set(id, connection);
                        ws.send('NewConnection:' + id);
                    })
                );
            }),
            finalize(() => {
                this._tunnelDropped.next(request);
            }),
            completeWith(upgrade)
        );

        observable.subscribe(null, (err) => {
            console.error('Server error:', err);
        });

        upgrade.connect();
    }

    private _forwardUpgrade(
        request: ForwardTunnelRequest,
        req: IncomingMessage,
        socket: Socket,
        head: Buffer
    ) {
        console.log(
            `[WSS] Connecting to remote host at ${request.forwardHost}:${request.forwardPort}...`
        );

        const connection = connect({
            host: request.forwardHost,
            port: request.forwardPort,
        }).pipe(publish()) as ConnectableObservable<Socket>;

        const observable = connection.pipe(
            tap((_) => console.log('[WSS] Connected!')),
            flatMap(
                (connection) => handleUpgrade(this._server, req, socket, head),
                (connection, ws) => ({ connection, ws })
            ),
            tap(({ connection, ws }) => {
                const wsStream = wrap(ws);

                connection.pipe(wsStream).pipe(connection);

                this._tunnelAccepted.next(request);
            }),
            finalize(() => {
                this._tunnelDropped.next(request);
            }),
            completeWith(connection)
        );

        observable.subscribe(null, (err) => {
            console.error('Connection error:', err);
        });

        connection.connect();
    }

    unsubscribe(): void {
        this._sub.unsubscribe();
    }
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
        const port = parseInt(query.get('port')) || null;

        if (direction === 'forward') {
            const host = query.get('host');
            if (!host) {
                console.log('[WSS] Client sent request without host.');
                return null;
            }

            if (!port) {
                console.log('[WSS] Client sent without port.');
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
