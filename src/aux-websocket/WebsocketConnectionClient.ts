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
import {
    ConnectionClient,
    ClientConnectionState,
    ConnectionIndicatorToken,
    WebsocketMessage,
    WebsocketMessageEvent,
    WebsocketEventTypes,
    ConnectionInfo,
    WebsocketEvent,
} from '@casual-simulation/aux-common';

export class WebsocketConnectionClient implements ConnectionClient {
    private _socket: ReconnectableSocketInterface;
    private _connectionStateChanged: BehaviorSubject<ClientConnectionState>;
    private _events: Observable<WebsocketMessageEvent>;
    private _requestCounter: number = 0;

    get info(): ConnectionInfo {
        return this._connectionStateChanged.value.info;
    }

    event<T>(name: string): Observable<T> {
        return this._events.pipe(
            filter(([type, requestId, message]) => message.type === name),
            map(([type, requestId, message]) => message as T)
        ) as Observable<T>;
    }

    disconnect() {
        this._socket.close();
    }

    connect() {
        this._socket.open();
    }

    send(message: WebsocketMessage) {
        this._requestCounter++;
        socketEmit(this._socket, this._requestCounter, message);
    }

    constructor(socket: ReconnectableSocketInterface) {
        this._socket = socket;
        this._connectionStateChanged =
            new BehaviorSubject<ClientConnectionState>({
                connected: false,
                info: null,
            });
        this._events = socketEvents(this._socket);

        const connected = this._socket.onOpen.pipe(
            tap(() => console.log('[ApiaryConnectionClient] Connected.')),
            map(() => ({
                connected: true,
                info: null,
            }))
        );
        const disconnected = this._socket.onClose.pipe(
            tap((reason) =>
                console.log('[SocketManger] Disconnected. Reason:', reason)
            ),
            map(() => ({
                connected: false,
                info: null,
            }))
        );

        merge(connected, disconnected).subscribe(this._connectionStateChanged);
    }

    get connectionState(): Observable<ClientConnectionState> {
        return this._connectionStateChanged;
    }

    get isConnected(): boolean {
        return this._connectionStateChanged.value.connected;
    }
}

function socketEmit(
    socket: ReconnectableSocketInterface,
    requestId: number,
    message: WebsocketMessage
) {
    let event: WebsocketMessageEvent = [
        WebsocketEventTypes.Message,
        requestId,
        message,
    ];
    socket.send(JSON.stringify(event));
}

function socketEvents(
    socket: ReconnectableSocketInterface
): Observable<WebsocketMessageEvent> {
    return socket.onMessage.pipe(
        map((message) => safeParse(message.data)),
        filter((data) => !!data && Array.isArray(data) && data.length >= 3),
        share()
    );
}

function safeParse(json: string): WebsocketMessageEvent {
    try {
        return JSON.parse(json);
    } catch (err) {
        return null;
    }
}
