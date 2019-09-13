import { Server } from 'ws';
import {
    TunnelServer,
    TunnelRequestMapper,
    TunnelRequestFilter,
} from '../TunnelServer';
import { Server as HttpServer, IncomingMessage } from 'http';
import { Socket, connect } from 'net';
import { TunnelRequest, ForwardTunnelRequest } from '../ServerTunnelRequest';
import { wrap } from './WebSocket';

export class WebSocketServer implements TunnelServer {
    requestMapper: TunnelRequestMapper;
    acceptTunnel: TunnelRequestFilter;

    closed: boolean;

    private _http: HttpServer;
    private _server: Server;
    private _connection: Socket;

    constructor(server: HttpServer) {
        this._http = server;
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

        this._http.on(
            'upgrade',
            (request: IncomingMessage, socket: Socket, head: Buffer) => {
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
        );

        console.log('Listening for connections...');
    }

    private _handle(
        request: TunnelRequest,
        req: IncomingMessage,
        socket: Socket,
        head: Buffer
    ) {
        if (request.direction === 'forward') {
            this._forwardUpgrade(request, req, socket, head);
        } else {
            throw new Error('not supported yet');
        }
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
    const port = parseInt(query.get('port'));

    if (!port) {
        console.log('[WSS] Client sent request without port.');
        return null;
    }

    let request: TunnelRequest;

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
    } else if (direction === 'reverse') {
        request = {
            direction: direction,
            authorization: token,
            hostname: url.hostname,
            localPort: port,
        };
    } else {
        return null;
    }

    return request;
}

function requestUrl(request: IncomingMessage, protocol: string): URL {
    const path = request.url;
    const host = request.headers.host;

    return new URL(path, `${protocol}://${host}`);
}
