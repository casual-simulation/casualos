import { AuxChannelAuthorizer } from '../managers/AuxChannelAuthorizer';
import {
    DeviceInfo,
    RealtimeChannelInfo,
} from '@casual-simulation/causal-trees';
import { BotAction } from '@casual-simulation/aux-common';
import { LoadedChannel } from '@casual-simulation/causal-tree-server';
import { Observable, of } from 'rxjs';

export class TestAuxChannelAuthorizer implements AuxChannelAuthorizer {
    allowProcessingEvents: boolean = false;
    allowAccess: boolean = false;

    isAllowedToLoad(
        device: DeviceInfo,
        info: RealtimeChannelInfo
    ): Observable<boolean> {
        return of(this.allowAccess);
    }

    isAllowedAccess(
        device: DeviceInfo,
        channel: LoadedChannel
    ): Observable<boolean> {
        return of(this.allowAccess);
    }

    canProcessEvent(device: DeviceInfo, event: BotAction): boolean {
        return this.allowProcessingEvents;
    }
}
