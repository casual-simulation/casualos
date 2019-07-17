import { RealtimeChannelInfo } from '@casual-simulation/causal-trees';
import { DeviceConnection } from './DeviceConnection';
import { SubscriptionLike } from 'rxjs';

/**
 * Defines an interface that represents a connection to a channel.
 */
export interface DeviceChannelConnection {
    info: RealtimeChannelInfo;
}
