import {
    ConnectionClient,
    ClientConnectionState,
} from '@casual-simulation/causal-trees/core2';
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
import { map, tap, concatMap, first, takeUntil } from 'rxjs/operators';

export class SocketIOConnectionClient implements ConnectionClient {
    private _socket: SocketIOClient.Socket;
    private _connectionStateChanged: BehaviorSubject<ClientConnectionState>;

    event<T>(name: string): Observable<T> {
        return fromEventPattern<T>(
            (h) => this._socket.on(name, h),
            (h) => this._socket.off(name, h)
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
        this._connectionStateChanged = new BehaviorSubject<
            ClientConnectionState
        >({
            connected: false,
            info: null,
        });

        const connected = fromEventPattern<void>(
            (h) => this._socket.on('connect', h),
            (h) => this._socket.off('connect', h)
        ).pipe(
            tap(() => console.log('[SocketIOConnectionClient] Connected.')),
            map(() => true)
        );
        const disconnected = onDisconnect(this._socket).pipe(
            tap((reason) =>
                console.log('[SocketManger] Disconnected. Reason:', reason)
            ),
            map(() => false)
        );

        const connectionState = merge(connected, disconnected);

        connectionState
            .pipe(concatMap((connected) => this._login(connected, token)))
            .subscribe(this._connectionStateChanged);
    }

    get connectionState(): Observable<ClientConnectionState> {
        return this._connectionStateChanged;
    }

    get isConnected(): boolean {
        return this._connectionStateChanged.value.connected;
    }

    private _login(
        connected: boolean,
        token: DeviceToken
    ): Observable<ClientConnectionState> {
        if (connected) {
            console.log(`[SocketIOConnectionClient] Logging in...`);
            const onLoginResult = fromEventPattern<DeviceInfo>(
                (h) => this._socket.on('login_result', h),
                (h) => this._socket.off('login_result', h)
            );
            this._socket.emit('login', token);
            return onLoginResult.pipe(
                map((result) => ({
                    connected: true,
                    info: result,
                })),
                first(),
                takeUntil(onDisconnect(this._socket))
            );
        } else {
            return of({
                connected: false,
                info: null,
            });
        }
    }
}

function onDisconnect(socket: SocketIOClient.Socket) {
    return fromEventPattern<string>(
        (h) => socket.on('disconnect', h),
        (h) => socket.off('disconnect', h)
    );
}
