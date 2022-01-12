import {
    ConnectionServer,
    Connection,
} from '@casual-simulation/causal-tree-server';
import {
    DeviceInfo,
    DeviceToken,
    deviceInfo,
    DisconnectionReason,
} from '@casual-simulation/causal-trees';
import { Observable, fromEventPattern, Subject } from 'rxjs';
import WebSocket, { Server } from 'ws';
import { Server as HttpServer, IncomingMessage } from 'http';
import { Socket, createServer, AddressInfo } from 'net';
import { map, shareReplay, flatMap, first, tap } from 'rxjs/operators';

export class WebSocketConnectionServer implements ConnectionServer {
    private _server: Server;
    private _connection: Observable<Connection>;

    get connection(): Observable<Connection> {
        return this._connection;
    }

    constructor(server: HttpServer, options: WebSocket.ServerOptions = {}) {
        this._server = new Server({
            ...options,
            server,
            path: '/websocket',
        });

        const onConnection = fromEventPattern<[WebSocket, any]>(
            (h) => this._server.on('connection', h),
            (h) => this._server.off('connection', h)
        );
        const connections = onConnection.pipe(
            flatMap(
                ([s]) => this._login(s),
                ([socket], info) => ({ info, socket })
            ),
            map(({ info, socket }) => new WebSocketConnection(socket, info)),
            shareReplay()
        );
        this._connection = connections;
    }

    private _login(socket: WebSocket): Observable<DeviceInfo> {
        console.log(`[WebSocketConnectionServer] Waiting for login...`);
        const onLogin = socketEvent<DeviceToken>(socket, 'login');

        return onLogin.pipe(
            tap(() => {}),
            map((token) =>
                deviceInfo(token.username, token.username, token.id)
            ),
            tap((info) => socketEmit(socket, 'login_result', info)),
            first()
        );
    }
}

export class WebSocketConnection implements Connection {
    private _socket: WebSocket;
    private _device: DeviceInfo;

    get device() {
        return this._device;
    }

    get disconnect(): Observable<DisconnectionReason> {
        return this._socketEvent<CloseEvent>('close').pipe(
            map(({ code }) => {
                if (STATUS_CODE_DISCONNECT_REASONS.has(code)) {
                    return STATUS_CODE_DISCONNECT_REASONS.get(code);
                } else {
                    return 'other';
                }
            })
        );
    }

    event<T>(name: string) {
        return socketEvent<T>(this._socket, name);
    }

    send(name: string, data: any) {
        socketEmit(this._socket, name, data);
    }

    constructor(socket: WebSocket, device: DeviceInfo) {
        this._socket = socket;
        this._device = device;
    }

    private _socketEvent<T>(name: string) {
        return fromEventPattern<T>(
            (h) => this._socket.on(name, h),
            (h) => this._socket.off(name, h)
        );
    }
}

// const TRANSPORT_ERROR = ;
const NORMAL_CLOSE = 1000;
const GOING_AWAY = 1001;
const PROTOCOL_ERROR = 1002;
const UNSUPPORTED_DATA = 1003;
const NO_STATUS_RECEIVED = 1005;
const ABNORMAL_CLOSURE = 1006;
const INVALID_FRAME_PAYLOAD_DATA = 1007;
const POLICY_VIOLATION = 1008;
const MESSAGE_TOO_BIG = 1009;
const MISSING_EXTENSION = 1010;
const INTERNAL_ERROR = 1011;
const SERVICE_RESTART = 1012;
const TRY_AGAIN_LATER = 1013;
const BAD_GATEWAY = 1014;
const TLS_HANDSHAKE = 1015;

const STATUS_CODE_NAMES = new Map([
    [NORMAL_CLOSE, 'normal_close'],
    [GOING_AWAY, 'going_away'],
    [PROTOCOL_ERROR, 'protocol_error'],
    [UNSUPPORTED_DATA, 'unsupported_data'],
    [NO_STATUS_RECEIVED, 'no_status_received'],
    [ABNORMAL_CLOSURE, 'abnormal_closure'],
    [INVALID_FRAME_PAYLOAD_DATA, 'invalid_frame_payload_data'],
    [POLICY_VIOLATION, 'policy_violation'],
    [MESSAGE_TOO_BIG, 'message_too_big'],
    [MISSING_EXTENSION, 'missing_extension'],
    [INTERNAL_ERROR, 'internal_error'],
    [SERVICE_RESTART, 'service_restart'],
    [TRY_AGAIN_LATER, 'try_again_later'],
    [BAD_GATEWAY, 'bad_gateway'],
    [TLS_HANDSHAKE, 'tls_handshake'],
]);

const STATUS_CODE_DISCONNECT_REASONS = new Map<number, DisconnectionReason>([
    [NORMAL_CLOSE, 'transport_close'],
    [GOING_AWAY, 'transport_close'],
    [PROTOCOL_ERROR, 'transport_error'],
    [UNSUPPORTED_DATA, 'transport_error'],
    [NO_STATUS_RECEIVED, 'transport_error'],
    [ABNORMAL_CLOSURE, 'transport_error'],
    [INVALID_FRAME_PAYLOAD_DATA, 'transport_error'],
    [POLICY_VIOLATION, 'transport_error'],
    [MESSAGE_TOO_BIG, 'transport_error'],
    [MISSING_EXTENSION, 'transport_error'],
    [INTERNAL_ERROR, 'transport_error'],
    [SERVICE_RESTART, 'transport_close'],
    [TRY_AGAIN_LATER, 'transport_error'],
    [BAD_GATEWAY, 'transport_error'],
    [TLS_HANDSHAKE, 'transport_error'],
]);

function socketEmit(socket: WebSocket, name: string, data: any) {
    socket.send(JSON.stringify([name, data]));
}

function socketEvent<T>(socket: WebSocket, eventName: string): Observable<T> {
    return new Observable((observer) => {
        const listener = (message: string) => {
            const data = safeParse(message);
            if (data && Array.isArray(data) && data.length >= 1) {
                const [name, arg] = data;
                if (name === eventName) {
                    observer.next(arg);
                }
            }
        };
        socket.on('message', listener);

        return () => {
            socket.off('message', listener);
        };
    });
}

function safeParse(json: string): any {
    try {
        return JSON.parse(json);
    } catch (err) {
        return null;
    }
}
