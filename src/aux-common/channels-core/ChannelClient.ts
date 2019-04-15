import { IChannel, Channel } from './Channel';
import { ChannelInfo } from '.';
import { ChannelConnector } from './ChannelConnector';
import { DiscoveryChannelInfo, createDiscoveryChannelStateStore } from './builtin/DiscoveryChannel';
import { StateStoreFactory, StateStore } from './StateStore';

/**
 * Defines an interface for objects which are able to interface with channel servers.
 * @deprecated
 */
export interface IChannelClient {

    /**
     * Requests a special channel which tracks currently active and publicly available channels.
     */
    discoveryChannel(): IChannel<ChannelInfo[]>;

    /**
     * Gets a channel for the given info. If the channel doesn't exist, then a new one is created.
     * @param info The info that describes the channel.
     * @param reducer The reducer used to manage state for the channel.
     */
    getChannel<T>(info: ChannelInfo): IChannel<T>;
}

/**
 * Defines a default implementation of a channel client.
 * @deprecated
 */
export class ChannelClient implements IChannelClient {

    private _discovery_channel: IChannel<ChannelInfo[]>;
    private _connector: ChannelConnector;
    private _storeFactory: StateStoreFactory;

    constructor(connector: ChannelConnector, storeFactory: StateStoreFactory) {
        this._connector = connector;
        this._storeFactory = storeFactory;
        this._discovery_channel = this.getChannelWithStore<ChannelInfo[]>(DiscoveryChannelInfo, createDiscoveryChannelStateStore());
    }

    discoveryChannel(): IChannel<ChannelInfo[]> {
        return this._discovery_channel;
    }

    getChannel<T>(info: ChannelInfo): IChannel<T> {
        return this.getChannelWithStore(info, this._storeFactory.create(info));
    }

    getChannelWithStore<T>(info: ChannelInfo, store: StateStore<T>): IChannel<T> {
        return new Channel<T>(info, this._connector, store);
    }
}