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
import { Server, Socket } from 'socket.io';
import { map, shareReplay, flatMap, first, tap } from 'rxjs/operators';

export class SocketIOConnectionServer implements ConnectionServer {
    // private _connection = new Subject<Connection>();
    private _connection: Observable<Connection>;

    get connection(): Observable<Connection> {
        return this._connection;
    }

    constructor(socketServer: Server) {
        const onConnection = fromEventPattern<Socket>(h =>
            socketServer.on('connection', h)
        );
        const connections = onConnection.pipe(
            flatMap(s => this._login(s), (socket, info) => ({ info, socket })),
            map(({ info, socket }) => new SocketIOConnection(socket, info)),
            shareReplay()
        );
        this._connection = connections;
    }

    private _login(socket: Socket): Observable<DeviceInfo> {
        console.log(`[SocketIOConnectionServer] Waiting for login...`);
        const onLogin = fromEventPattern<DeviceToken>(
            h => socket.on('login', h),
            h => socket.off('login', h)
        );

        return onLogin.pipe(
            tap(() => {}),
            map(token => deviceInfo(token.username, token.username, token.id)),
            tap(info => socket.emit('login_result', info)),
            first()
        );
    }
}

export class SocketIOConnection implements Connection {
    private _socket: Socket;
    private _device: DeviceInfo;

    get device() {
        return this._device;
    }

    get disconnect(): Observable<DisconnectionReason> {
        return this._socketEvent<SocketIODisconnectReason>('disconnect').pipe(
            map(reason => {
                if (reason === 'transport error') {
                    return 'transport_error';
                } else if (reason === 'transport close') {
                    return 'transport_close';
                } else if (reason === 'server namespace disconnect') {
                    return 'server_disconnect';
                } else if (reason === 'client namespace disconnect') {
                    return 'client_disconnect';
                } else if (reason === 'ping timeout') {
                    return 'timeout';
                } else {
                    return 'other';
                }
            })
        );
    }

    event<T>(name: string) {
        return this._socketEvent<T>(name);
    }

    send(name: string, data: any) {
        this._socket.emit(name, data);
    }

    constructor(socket: Socket, device: DeviceInfo) {
        this._socket = socket;
        this._device = device;
    }

    private _socketEvent<T>(name: string) {
        return fromEventPattern<T>(
            h => this._socket.on(name, h),
            h => this._socket.off(name, h)
        );
    }
}

export type SocketIODisconnectReason =
    | 'transport error'
    | 'server namespace disconnect'
    | 'client namespace disconnect'
    | 'ping timeout'
    | 'transport close';
