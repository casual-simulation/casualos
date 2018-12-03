import { ChannelConnection } from "./ChannelConnector";
import { ChannelConnector } from "./ChannelConnector";
import { StateStore } from "./StateStore";

/**
 * Generic information about a channel.
 */
export interface ChannelInfo {
    /**
     * The type of the channel.
     * This indicates what type of state store a channel should use.
     */
    type: string;

    /**
     * The unique ID of the channel.
     * GUIDs are usually used for private invite-only channels while
     * structured names are used for public channels. (like `namespace/room/channel-name`)
     */
    id: string;

    /**
     * The human-readable name of the channel.
     */
    name: string | null;
}

/**
 * Defines an interface that represents an interface.
 * That is, an asynchronous stream of events.
 */
export interface IChannel<T> {

    /**
     * Gets the unique ID of the channel.
     */
    id(): string;

    /**
     * Basic info about the channel.
     */
    info(): ChannelInfo;

    /**
     * Attempts to subscribe to the channel.
     * Returns a promise which resolves with a channel subscription that can be used
     * to interact with a channel.
     */
    subscribe(): Promise<ChannelConnection<T>>;
}

/**
 * Default implementation of IChannel.
 */
export class Channel<T> implements IChannel<T> {

    private _connector: ChannelConnector;
    private _store: StateStore<T>;
    private _info: ChannelInfo;

    /**
     * Creates a new Channel which uses the given services.
     * @param info The information about the channel.
     * @param connector A service which can connect a channel to a network. (WebSockets, Bluetooth, etc.)
     * @param store A service manages the state for this channel.
     */
    constructor(info: ChannelInfo, connector: ChannelConnector, store: StateStore<T>) {
        this._info = info;
        this._connector = connector;
        this._store = store;
    }

    id(): string {
        return this._info.id;
    }

    subscribe(): Promise<ChannelConnection<T>> {
        return this._connector.connectToChannel<T>({
            info: this.info(),
            store: this._store
        });
    }

    info(): ChannelInfo {
        return this._info;
    }
}