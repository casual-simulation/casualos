import { Observable, Subject } from 'rxjs';

/**
 * Defines a websocket connection that will automatically try to reconnect if the connection is lost.
 */
export interface ReconnectableSocketInterface {
    onOpen: Observable<void>;
    onClose: Observable<string>;
    onMessage: Observable<MessageEvent>;
    onError: Observable<Event>;

    send(data: string | ArrayBuffer | ArrayBufferView): void;
    open(): void;
    close(): void;
}

/**
 * Defines a websocket connection that will automatically try to reconnect if the connection is lost.
 */
export class ReconnectableSocket implements ReconnectableSocketInterface {
    private _url: string;
    private _socket: WebSocket;

    private _onOpen = new Subject<void>();
    private _onClose = new Subject<string>();
    private _onError = new Subject<Event>();
    private _onMessage = new Subject<MessageEvent>();

    get onOpen() {
        return this._onOpen;
    }

    get onClose() {
        return this._onClose;
    }

    get onError() {
        return this._onError;
    }

    get onMessage() {
        return this._onMessage;
    }

    get socket() {
        return this._socket;
    }

    send(data: string | ArrayBuffer | ArrayBufferView) {
        this._socket.send(data);
    }

    constructor(url: string) {
        this._url = url;
    }

    open() {
        if (
            !this._socket ||
            this._socket.readyState === WebSocket.CLOSED ||
            this._socket.readyState === WebSocket.CLOSING
        ) {
            this._setupSocket();
        }
    }

    close() {
        if (this._socket && this._socket.readyState === WebSocket.OPEN) {
            this._socket.close();
        }
    }

    protected _handleMessage(event: MessageEvent) {
        this._onMessage.next(event);
    }

    private _setupSocket() {
        this._socket = new WebSocket(this._url);
        this._socket.onopen = () => {
            this._onOpen.next();
        };
        this._socket.onclose = (event) => {
            this._onClose.next(event.reason);
        };
        this._socket.onerror = (event: Event) => {
            this._onError.next(event);
        };
        this._socket.onmessage = (event) => {
            this._handleMessage(event);
        };
    }
}
