import { ChannelAuthorizer } from './ChannelAuthorizer';
import { DeviceInfo } from './DeviceInfo';
import { LoadedChannel } from './ChannelManager';

/**
 * Defines a channel authorizer that always allows access.
 */
export class NullChannelAuthorizer implements ChannelAuthorizer {
    isAllowedAccess(device: DeviceInfo, channel: LoadedChannel): boolean {
        return true;
    }
}
