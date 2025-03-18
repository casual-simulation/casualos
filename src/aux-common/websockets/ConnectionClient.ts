import type { Observable } from 'rxjs';
import type { ConnectionInfo } from '../common/ConnectionInfo';
import type { WebsocketErrorInfo, WebsocketMessage } from './WebsocketEvents';
import { WebsocketErrorCode } from './WebsocketEvents';
import type { ConnectionIndicator } from '../common';
import { DenialReason } from '../common';

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
