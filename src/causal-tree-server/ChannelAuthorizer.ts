import { LoadedChannel } from './ChannelManager';
import { DeviceInfo } from '@casual-simulation/causal-trees';

/**
 * Defines an interface for objects that can authorize users to access a channel.
 */
export interface ChannelAuthorizer {
    /**
     * Determines if the given device is allowed access to the given channel.
     * @param device The device that contains the authenticated roles the user has.
     * @param channel The channel.
     */
    isAllowedAccess(device: DeviceInfo, channel: LoadedChannel): boolean;
}
