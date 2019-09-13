import { Server } from 'ws';
import {
    TunnelServer,
    TunnelRequestMapper,
    TunnelRequestFilter,
} from '../TunnelServer';
import { Server as HttpServer, IncomingMessage } from 'http';
import { Socket, connect, createServer } from 'net';
import {
    TunnelRequest,
    ForwardTunnelRequest,
    ReverseTunnelRequest,
    ConnectTunnelRequest,
} from '../ServerTunnelRequest';
import { wrap } from './WebSocket';
import uuid from 'uuid/v4';
import { requestUrl } from './utils';
import { Observable, Subject } from 'rxjs';

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
        this._server.handleUpgrade(req, socket, head, ws => {
            const wsStream = wrap(ws);

            connection.on('error', e => {
                console.error(e);
                ws.close();
            });
            wsStream.on('error', e => {
                console.error('Stream error', e);
                connection.destroy();
            });
            connection.on('error', err => {
                console.error('Connected error', err);
                connection.destroy();
                ws.close();
            });
            const s = connection.pipe(wsStream).pipe(connection);
            connection.resume();

            s.on('error', e => {
                console.error('Pipe error', e);
            });

            this._tunnelAccepted.next(request);
        });

        connection.on('error', err => {
            console.error('Connection error', err);
            socket.destroy();
            connection.destroy();
        });
    }

    private _reverseUpgrade(
        request: ReverseTunnelRequest,
        req: IncomingMessage,
        socket: Socket,
        head: Buffer
    ) {
        console.log(`[WSS] Starting TCP server for port ${request.localPort}`);

        this._server.handleUpgrade(req, socket, head, ws => {
            const server = createServer(c => {
                const id = uuid();
                c.pause();
                this._map.set(id, c);
                ws.send('NewConnection:' + id);
            });

            server.listen(request.localPort);
            this._tunnelAccepted.next(request);
        });
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
        this._connection = connect(
            {
                host: request.forwardHost,
                port: request.forwardPort,
            },
            () => {
                console.log(`[WSS] Connected!`);
                this._server.handleUpgrade(req, socket, head, ws => {
                    const wsStream = wrap(ws);
                    this._connection.on('error', e => {
                        console.error(e);
                        ws.close();
                    });
                    wsStream.on('error', e => {
                        console.error('Stream error', e);
                        this._connection.destroy();
                    });
                    this._connection.on('error', err => {
                        console.error('Connected error', err);
                        this._connection.destroy();
                        ws.close();
                    });
                    const s = this._connection
                        .pipe(wsStream)
                        .pipe(this._connection);

                    s.on('error', e => {
                        console.error('Pipe error', e);
                    });
                    this._tunnelAccepted.next(request);
                });
            }
        );

        this._connection.on('error', err => {
            console.error('Connection error', err);
            socket.destroy();
            this._connection.destroy();
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
