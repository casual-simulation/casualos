import { RealtimeChannelInfo } from './RealtimeChannelInfo';
import { RealtimeChannel } from './RealtimeChannel';

/**
 * Defines an interface for objects which are able to create realtime channels.
 */
export interface RealtimeChannelFactory {
    /**
     * Creates a channel for the given info.
     * @param info The info that describes the channel.
     */
    createChannel<T>(info: RealtimeChannelInfo): RealtimeChannel<T>;
}
