/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type { Observable } from 'rxjs';
import { Subject } from 'rxjs';

export type CloseReason = CloseReasonClosed | CloseReasonOther;

export interface CloseReasonBase {
    reason: string;
    code: number;
}

/**
 * Defines an interface that indicates the web socket was closed because
 * the local device decided to disconnect.
 */
export interface CloseReasonClosed extends CloseReasonBase {
    type: 'closed';
}

/**
 * Defines an interface that indicates that the web socket was closed due to some other reason.
 * For example, it is possible that the device lost connection to the server and so it was closed.
 */
export interface CloseReasonOther extends CloseReasonBase {
    type: 'other';
}

/**
 * Defines a websocket connection that will automatically try to reconnect if the connection is lost.
 */
export interface ReconnectableSocketInterface {
    onOpen: Observable<void>;
    onClose: Observable<CloseReason>;
    onMessage: Observable<MessageEvent>;
    onError: Observable<Event>;

    /**
     * The HTTP origin that the connection is for.
     */
    get origin(): string;

    send(data: string | ArrayBuffer | ArrayBufferView): void;
    open(): void;
    close(): void;
}

/**
 * Defines a websocket connection that will automatically try to reconnect if the connection is lost.
 */
export class ReconnectableSocket implements ReconnectableSocketInterface {
    private _url: URL;
    private _socket: WebSocket;
    private _closing: boolean;
    private _protocol: string | undefined;

    private _onOpen = new Subject<void>();
    private _onClose = new Subject<CloseReason>();
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

    get origin() {
        return this._url.origin;
    }

    send(data: string | ArrayBuffer | ArrayBufferView) {
        this._socket.send(data);
    }

    constructor(url: string | URL, protocol?: string) {
        if (typeof url === 'string') {
            this._url = new URL(url);
        } else {
            this._url = url;
        }
        this._protocol = protocol || undefined;
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
            this._closing = true;
            this._socket.close();
        }
    }

    protected _handleMessage(event: MessageEvent) {
        this._onMessage.next(event);
    }

    private _setupSocket() {
        this._closing = false;
        this._socket = new WebSocket(this._url, this._protocol);
        this._socket.onopen = () => {
            this._onOpen.next();
        };
        this._socket.onclose = (event) => {
            if (this._closing) {
                this._onClose.next({
                    type: 'closed',
                    reason: '',
                    code: event.code,
                });
            } else {
                this._onClose.next({
                    type: 'other',
                    reason: event.reason,
                    code: event.code,
                });
            }
        };
        this._socket.onerror = (event: Event) => {
            this._onError.next(event);
        };
        this._socket.onmessage = (event) => {
            this._handleMessage(event);
        };
    }
}
