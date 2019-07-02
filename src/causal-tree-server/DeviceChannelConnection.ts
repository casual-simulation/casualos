import { RealtimeChannelInfo } from '@casual-simulation/causal-trees';
import { DeviceConnection } from './DeviceConnection';

/**
 * Defines an interface that represents a connection to a channel.
 */
export interface DeviceChannelConnection {
    info: RealtimeChannelInfo;
}
