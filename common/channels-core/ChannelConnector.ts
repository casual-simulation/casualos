import { Observable } from "rxjs";
import { Event } from "./Event";
import { ChannelInfo } from "./ChannelInfo";
import { StateStore } from "./StateStore";

export type ChannelConnectionMode = 'online' | 'offline' | 'online-disconnected';

export interface ChannelConnectionState<T> {
    /**
     * The current connection mode.
     */
    mode: ChannelConnectionMode;

    /**
     * The last known server state.
     */
    lastKnownServerState: T;
}

/**
 * An interface for parameters that can be included in a connection request.
 */
export interface ChannelConnectionRequest<T> {
    /**
     * The channel info representing the channel to connect to.
     */
    info: ChannelInfo;

    /**
     * The state store that the channel should use if the connector
     * does not provide its own.
     */
    store: StateStore<T>;
}

/**
 * An interface for a response from a channel connection request.
 */
export interface ChannelConnection<T> {

    /**
     * The info about the channel that was connected to.
     */
    info: ChannelInfo;

    /**
     * The local state store that the channel uses.
     */
    store: StateStore<T>;

    /**
     * The observable sequence of events from the channel.
     */
    events: Observable<Event>;

    /**
     * The current connection state.
     */
    state: ChannelConnectionMode;

    /**
     * The observable that resolves when the connection state changes.
     * When subscribed to it will resolve once with the current state.
     */
    connectionStates: Observable<ChannelConnectionState<T>>;

    /**
     * Instructs the channel to change its state to 'online'
     * and start sending emitted events back to the server.
     */
    reconnect: () => void;

    /**
     * Emits the given event on the channel.
     * This event will be broadcast to every other client on the channel, including yourself.
     */
    emit: (event: Event) => void;

    /**
     * Unsubscribes from the channel.
     */
    unsubscribe: () => void;
}

/**
 * Defines an interface which acts as an abstract connection interface for channels.
 */
export interface ChannelConnector {

    /**
     * Attempts to connect to a channel matching the given request.
     * If no channel matches the request, then a new channel is created.
     * @param connection_request The parameters to use for the connection request.
     */
    connectToChannel<T>(connection_request: ChannelConnectionRequest<T>): Promise<ChannelConnection<T>>;
}