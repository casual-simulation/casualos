import { AuxChannel } from './AuxChannel';
import { Subscription } from 'rxjs';
import {
    RealtimeChannelInfo,
    DeviceInfo,
} from '@casual-simulation/causal-trees';

/**
 * Defines an interface for objects which are able to extend a AuxChannel with custom logic.
 */
export interface AuxModule {
    /**
     * Sets up the services/dependencies that the module needs
     * to perform its duties. Returns a subscription that, when unsubscribed, will dispose of extra resources.
     * @param info The info about the channel.
     * @param channel The channel that the module should be setup on.
     */
    setup(
        info: RealtimeChannelInfo,
        channel: AuxChannel
    ): Promise<Subscription>;

    /**
     * Signals that a device become connected to the channel.
     * @param info The info about the channel.
     * @param channel The channel that the module should be setup on.
     * @param device The device.
     */
    deviceConnected(
        info: RealtimeChannelInfo,
        channel: AuxChannel,
        device: DeviceInfo
    ): Promise<void>;

    /**
     * Signals that a device became disconnected from the channel.
     * @param info The info about the channel.
     * @param channel The channel that the module should be setup on.
     * @param device The device.
     */
    deviceDisconnected(
        info: RealtimeChannelInfo,
        channel: AuxChannel,
        device: DeviceInfo
    ): Promise<void>;
}
