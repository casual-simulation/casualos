import { ChannelAuthorizer } from './ChannelAuthorizer';
import { DeviceInfo } from '@casual-simulation/causal-trees';
import { LoadedChannel } from './ChannelManager';

/**
 * Defines a channel authorizer that always allows access.
 */
export class NullChannelAuthorizer implements ChannelAuthorizer {
    isAllowedAccess(device: DeviceInfo, channel: LoadedChannel): boolean {
        return true;
    }
}
