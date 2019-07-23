import { ChannelAuthorizer } from './ChannelAuthorizer';
import {
    DeviceInfo,
    RealtimeChannelInfo,
} from '@casual-simulation/causal-trees';
import { LoadedChannel } from './ChannelManager';
import { of, Observable } from 'rxjs';

/**
 * Defines a channel authorizer that always allows access.
 */
export class NullChannelAuthorizer implements ChannelAuthorizer {
    isAllowedToLoad(
        device: DeviceInfo,
        info: RealtimeChannelInfo
    ): Observable<boolean> {
        return of(true);
    }

    isAllowedAccess(device: DeviceInfo, channel: LoadedChannel): boolean {
        return true;
    }
}
