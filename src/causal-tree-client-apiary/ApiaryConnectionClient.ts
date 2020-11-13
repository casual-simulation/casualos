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
import {
    map,
    tap,
    concatMap,
    first,
    takeUntil,
    mapTo,
    share,
    filter,
} from 'rxjs/operators';
import { ReconnectableSocket } from './ReconnectableSocket';
import { LoginPacket, MessagePacket, Packet } from './Events';

export class ApiaryConnectionClient implements ConnectionClient {
    private _socket: ReconnectableSocket;
    private _connectionStateChanged: BehaviorSubject<ClientConnectionState>;
    private _packets: Observable<Packet>;

    event<T>(name: string): Observable<T> {
        return this._packets.pipe(
            filter((p) => p.type === 'message' && p.channel === name),
            map((p: MessagePacket) => p.data)
        );
    }

    disconnect() {
        this._socket.close();
    }

    connect() {
        this._socket.open();
    }

    send(name: string, data: any) {
        const message: MessagePacket = {
            type: 'message',
            channel: name,
            data: data,
        };
        this._socket.send(JSON.stringify(message));
    }

    constructor(socket: ReconnectableSocket, token: DeviceToken) {
        this._socket = socket;
        this._connectionStateChanged = new BehaviorSubject<
            ClientConnectionState
        >({
            connected: false,
            info: null,
        });

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

        this._packets = this._socket.onMessage.pipe(
            map((e) => JSON.parse(e.data)),
            share()
        );
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
            const onLoginResult = this._packets.pipe(
                filter((p) => p.type === 'login'),
                map((p: LoginPacket) => p)
            );
            const loginPacket: LoginPacket = {
                type: 'login',
            };
            this._socket.send(JSON.stringify(loginPacket));
            return onLoginResult.pipe(
                map((result) => ({
                    connected: true,
                    info: null,
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
