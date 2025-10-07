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
import { BehaviorSubject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { ReconnectableSocket } from './ReconnectableSocket';

const RECONNECT_TIME = 5000;

/**
 * Defines a class that is able to manage the creation and lifecycle of a WebSocket.
 */
export class SocketManager {
    private _socket: ReconnectableSocket;

    // Whether this manager has forced the user to be offline or not.
    private _forcedOffline: boolean = false;
    private _url: string | URL;
    private _protocol: string | undefined;

    private _connectionStateChanged: BehaviorSubject<boolean>;

    /**
     * Gets an observable that resolves with the connection state of the socket.
     */
    get connectionStateChanged(): Observable<boolean> {
        return this._connectionStateChanged;
    }

    /**
     * Gets whether the socket manager is forcing the user to be offline or not.
     */
    public get forcedOffline() {
        return this._forcedOffline;
    }

    public set forcedOffline(value: boolean) {
        this._forcedOffline = !this._forcedOffline;
        if (this._forcedOffline) {
            this._socket.close();
        } else {
            this._socket.open();
        }
    }

    /**
     * Gets the WebSocket that this manager has constructed.
     */
    get socket() {
        return this._socket;
    }

    /**
     * Creates a new SocketManager.
     * @param user The user account to use for connecting.
     * @param url The URL to connect to.
     * @param protocol The protocol to use for the WebSocket connection.
     */
    constructor(url?: string | URL, protocol?: string) {
        this._connectionStateChanged = new BehaviorSubject<boolean>(false);
        this._url = url;
        this._protocol = protocol;
    }

    init(): void {
        console.log('[WebSocketManager] Starting...');
        this._socket = new ReconnectableSocket(this._url, this._protocol);

        this._socket.onClose
            .pipe(
                filter((e) => e.type === 'other'),
                debounceTime(RECONNECT_TIME),
                tap(() => {
                    console.log('[WebSocketManager] Reconnecting...');
                    this._socket.open();
                })
            )
            .subscribe();

        this._socket.onError.subscribe((event) => {
            console.log('[WebSocketManager] Error:', event);
        });

        this._socket.onOpen.subscribe(() => {
            console.log('[WebSocketManager] Connected.');
            this._connectionStateChanged.next(true);
        });

        this._socket.onClose.subscribe(() => {
            console.log('[WebSocketManager] Closed.');
            this._connectionStateChanged.next(false);
        });
    }

    /**
     * Toggles whether the socket manager should be forcing the user's
     * connection to the server to be offline.
     */
    toggleForceOffline() {
        this.forcedOffline = !this.forcedOffline;
    }
}
