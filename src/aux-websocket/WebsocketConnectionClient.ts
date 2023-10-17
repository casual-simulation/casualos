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
    WebsocketErrorEvent,
    WebsocketErrorInfo,
    ConnectionIndicator,
} from '@casual-simulation/aux-common';

export class WebsocketConnectionClient implements ConnectionClient {
    private _socket: ReconnectableSocketInterface;
    private _connectionStateChanged: BehaviorSubject<ClientConnectionState>;
    private _events: Observable<WebsocketMessageEvent>;
    private _onError: Observable<WebsocketErrorInfo>;
    private _requestCounter: number = 0;

    get onError() {
        return this._onError;
    }

    get info(): ConnectionInfo {
        return this._connectionStateChanged.value.info;
    }

    get indicator(): ConnectionIndicator | null {
        return null;
    }

    get origin() {
        return this._socket.origin;
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
        let events = socketEvents(this._socket);

        this._onError = events.pipe(
            filter((message) => message[0] === WebsocketEventTypes.Error),
            map((event) => event[2] as WebsocketErrorInfo)
        );
        this._events = events.pipe(
            filter((message) => {
                if (message[0] === WebsocketEventTypes.Error) {
                    console.log(
                        `[WebsocketConnectionClient] Error: (${message[1]})`,
                        message[2]
                    );
                    return false;
                } else {
                    return true;
                }
            }),
            share()
        ) as Observable<WebsocketMessageEvent>;

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
): Observable<WebsocketEvent> {
    return socket.onMessage.pipe(
        map((message) => safeParse(message.data)),
        filter((data) => !!data && Array.isArray(data) && data.length >= 3),
        share()
    ) as Observable<WebsocketEvent>;
}

function safeParse(json: string): WebsocketMessageEvent | WebsocketErrorEvent {
    try {
        return JSON.parse(json);
    } catch (err) {
        return null;
    }
}
