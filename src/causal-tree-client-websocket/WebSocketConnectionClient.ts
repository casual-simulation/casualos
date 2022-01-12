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
import { ReconnectableSocketInterface } from '@casual-simulation/websocket';
import {
    map,
    tap,
    concatMap,
    first,
    takeUntil,
    filter,
    mapTo,
    share,
} from 'rxjs/operators';

export class WebSocketConnectionClient implements ConnectionClient {
    private _socket: ReconnectableSocketInterface;
    private _connectionStateChanged: BehaviorSubject<ClientConnectionState>;
    private _events: Observable<[string, any]>;

    event<T>(name: string): Observable<T> {
        return this._events.pipe(
            filter(([eventName, arg]) => eventName === name),
            map(([eventName, arg]) => arg as T)
        );
    }

    disconnect() {
        this._socket.close();
    }

    connect() {
        this._socket.open();
    }

    send(name: string, data: any) {
        socketEmit(this._socket, name, data);
    }

    constructor(socket: ReconnectableSocketInterface, token: DeviceToken) {
        this._socket = socket;
        this._connectionStateChanged =
            new BehaviorSubject<ClientConnectionState>({
                connected: false,
                info: null,
            });
        this._events = socketEvents(this._socket);

        const connected = this._socket.onOpen.pipe(
            tap(() => console.log('[ApiaryConnectionClient] Connected.')),
            mapTo(true)
        );
        const disconnected = this._socket.onClose.pipe(
            tap((reason) =>
                console.log('[SocketManger] Disconnected. Reason:', reason)
            ),
            mapTo(false)
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
            console.log(`[WebSocketConnectionClient] Logging in...`);
            const onLoginResult = this.event<DeviceInfo>('login_result');
            this.send('login', token);
            return onLoginResult.pipe(
                map((result) => ({
                    connected: true,
                    info: result,
                })),
                first(),
                takeUntil(this._socket.onClose)
            );
        } else {
            return of({
                connected: false,
                info: null,
            });
        }
    }
}

function socketEmit(
    socket: ReconnectableSocketInterface,
    name: string,
    data: any
) {
    socket.send(JSON.stringify([name, data]));
}

function socketEvents<T>(
    socket: ReconnectableSocketInterface
): Observable<[string, any]> {
    return socket.onMessage.pipe(
        map((message) => safeParse(message.data)),
        filter((data) => !!data && Array.isArray(data) && data.length >= 1),
        share()
    );
}

function safeParse(json: string): any {
    try {
        return JSON.parse(json);
    } catch (err) {
        return null;
    }
}
