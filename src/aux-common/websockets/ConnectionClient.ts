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
import type { ConnectionInfo } from '../common/ConnectionInfo';
import type { WebsocketErrorInfo, WebsocketMessage } from './WebsocketEvents';
import type { ConnectionIndicator } from '../common';

/**
 * Defines an interface that contains connection state info.
 */
export interface ClientConnectionState {
    /**
     * Whether the client is connected.
     */
    connected: boolean;

    /**
     * The device info.
     */
    info: ConnectionInfo;
}

export type ActionSelector<
    T extends WebsocketMessage['type'],
    U extends { type: WebsocketMessage['type'] }
> = U extends { type: T } ? U : never;

export type WebsocketType<T extends WebsocketMessage['type']> = ActionSelector<
    T,
    WebsocketMessage
>;

/**
 * Defines an interface for a client connection.
 * That is, a service that can send and receive arbitrary messages and track connection states.
 */
export interface ConnectionClient {
    /**
     * Gets an observable for the connection state.
     */
    connectionState: Observable<ClientConnectionState>;

    /**
     * Gets an observable for errors that the connection encounters.
     */
    onError: Observable<WebsocketErrorInfo>;

    /**
     * Whether the client is currently connected.
     */
    isConnected: boolean;

    /**
     * Gets the current connection info.
     */
    get info(): ConnectionInfo | null;

    /**
     * The connection indicator that was used to create this connection.
     * Null if the connection was not created with an indicator.
     */
    get indicator(): ConnectionIndicator | null;

    /**
     * Gets the HTTP origin that the connection is for.
     */
    get origin(): string;

    /**
     * Gets an observable for events with the given name.
     * @param name The name of the events.
     */
    event<K extends WebsocketMessage['type']>(
        name: K
    ): Observable<WebsocketType<K>>;

    /**
     * Sends a message.
     * @param message The message to send.
     */
    send(message: WebsocketMessage): void;

    /**
     * Tells the connection to disconnect.
     */
    disconnect(): void;

    /**
     * Tells the connection to (re)connect.
     */
    connect(): void;
}
