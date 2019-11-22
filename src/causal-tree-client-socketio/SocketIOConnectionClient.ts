import { ConnectionClient } from '@casual-simulation/causal-trees/core2';
import { DeviceToken, DeviceInfo } from '@casual-simulation/causal-trees';
import {
    Observable,
    fromEventPattern,
    BehaviorSubject,
    Subject,
    merge,
    of,
} from 'rxjs';
import io from 'socket.io-client';
import { map, tap, concatMap, first } from 'rxjs/operators';

export class SocketIOConnectionClient implements ConnectionClient {
    private _socket: SocketIOClient.Socket;
    private _connectionStateChanged: BehaviorSubject<boolean>;

    event<T>(name: string): Observable<T> {
        return fromEventPattern<T>(
            h => this._socket.on(name, h),
            h => this._socket.off(name, h)
        );
    }

    disconnect() {
        this._socket.disconnect();
    }

    connect() {
        this._socket.connect();
    }

    send(name: string, data: any) {
        this._socket.emit(name, data);
    }

    constructor(socket: SocketIOClient.Socket, token: DeviceToken) {
        this._socket = socket;
        this._connectionStateChanged = new BehaviorSubject(false);

        const onConnect = fromEventPattern<void>(
            h => this._socket.on('connect', h),
            h => this._socket.off('connect', h)
        ).pipe(
            tap(() => console.log('[SocketManager] Connected.')),
            map(() => true)
        );
        const onDisconnect = fromEventPattern<string>(
            h => this._socket.on('disconnect', h),
            h => this._socket.off('disconnect', h)
        ).pipe(
            tap(reason =>
                console.log('[SocketManger] Disconnected. Reason:', reason)
            ),
            map(() => false)
        );

        const connectionState = merge(onConnect, onDisconnect);

        connectionState
            .pipe(concatMap(connected => this._login(connected, token)))
            .subscribe(this._connectionStateChanged);
    }

    get connectionState(): Observable<boolean> {
        return this._connectionStateChanged;
    }

    private _login(connected: boolean, token: DeviceToken) {
        if (connected) {
            const onLoginResult = fromEventPattern<DeviceInfo>(
                h => this._socket.on('login_result', h),
                h => this._socket.off('login_result', h)
            );
            return onLoginResult.pipe(
                map(result => true),
                first()
            );
        } else {
            return of(false);
        }
    }
}
