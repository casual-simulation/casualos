import { Observable, SubscriptionLike } from 'rxjs';
import { ConnectionEvent } from './ConnectionEvent';

/**
 * Defines an interface for a realtime channel connection.
 * That is, objects that are able to manage a connection with a remote peer.
 *
 * From an implementation perspective, this is basically a simple abstract wrapper around Socket IO.
 */
export interface RealtimeChannelConnection extends SubscriptionLike {
    /**
     * Initializes the channel connection with a list of known event names.
     * @param knownEventNames The event names that the connection should be listening for.
     */
    init(knownEventNames: string[]): void;

    /**
     * Determines whether this connection is currently connected to the remote peer.
     */
    isConnected(): boolean;

    /**
     * The observable list of events on this connection from the remote peer.
     */
    events: Observable<ConnectionEvent>;

    /**
     * Emits an event with the given name and data to the other peer.
     * @param event The event that should be emitted to the other peer.
     */
    emit(event: ConnectionEvent): void;

    /**
     * Makes a request to the remote peer.
     * Returns the response from the server.
     * @param name The resource to request.
     * @param data The data to send in the request.
     */
    request<TResponse>(name: string, data: any): Promise<TResponse>;

    /**
     * The observable list of connection states.
     * Resolves with true when connected and false when disconnected.
     * Upon subscription, the observable resolves with the current connection state.
     */
    connectionStateChanged: Observable<boolean>;
}
