import { Event } from '../Event';
import { ChannelInfo } from '../ChannelInfo';
import {remove} from 'lodash';
import { StateStore, ReducingStateStore } from '../StateStore';

/**
 * Common event for a channel being added to the server list.
 */
export interface ChannelCreatedEvent extends Event {
    type: 'channel_created';

    /**
     * The info for the channel that was created.
     */
    info: ChannelInfo;
}

/**
 * Common event for a channel being removed from the server list.
 */
export interface ChannelRemovedEvent extends Event {
    type: 'channel_removed';

    /**
     * The ID of the channel that was removed.
     */
    channel_id: string;
}

export type DiscoveryChannelEvent = ChannelCreatedEvent | ChannelRemovedEvent;

/**
 * A function that is able to apply discovery events to the channel state.
 * @param state The current state.
 * @param event The event that should be added to the state.
 */
export function discoveryChannelReducer(state: ChannelInfo[], event: DiscoveryChannelEvent): ChannelInfo[] {
    state = state || [];
    if (event.type === 'channel_removed') {
        remove(state, s => s.id === event.channel_id);
    } else if (event.type === 'channel_created') {
        state.push(event.info);
    }
    return state;
}

/**
 * Constructs a new state store that should be used with discovery channels.
 */
export function createDiscoveryChannelStateStore(): StateStore<ChannelInfo[]> {
    return new ReducingStateStore([], discoveryChannelReducer);
}

/**
 * Info about the discovery channel.
 */
export const DiscoveryChannelInfo: ChannelInfo = {
    type: 'discovery_channel',
    id: 'discovery_channel',
    name: 'Channel for discovering other channels.'
};

/**
 * Creates a new channel created event.
 * @param info The info for the channel that was created.
 */
export function channelCreated(info: ChannelInfo): ChannelCreatedEvent {
    return {
        type: 'channel_created',
        creation_time: new Date(),
        info: info
    };
}

/**
 * Creates a new channel removed event.
 * @param info The info for the channel that was created.
 */
export function channelRemoved(channel_id: string): ChannelRemovedEvent {
    return {
        type: 'channel_removed',
        creation_time: new Date(),
        channel_id: channel_id
    };
}