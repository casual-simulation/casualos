import { Observable } from 'rxjs';
import { ConnectionInfo } from '../common/ConnectionInfo';
import { WebsocketMessage } from './WebsocketEvents';

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
     * Whether the client is currently connected.
     */
    isConnected: boolean;

    /**
     * Gets the current connection info.
     */
    get info(): ConnectionInfo | null;

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
