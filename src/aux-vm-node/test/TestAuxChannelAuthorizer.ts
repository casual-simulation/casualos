import { AuxChannelAuthorizer } from '../managers/AuxChannelAuthorizer';
import { DeviceInfo } from '@casual-simulation/causal-trees';
import { FileEvent } from '@casual-simulation/aux-common';
import { LoadedChannel } from '@casual-simulation/causal-tree-server';

export class TestAuxChannelAuthorizer implements AuxChannelAuthorizer {
    allowProcessingEvents: boolean = false;
    allowAccess: boolean = false;

    isAllowedAccess(device: DeviceInfo, channel: LoadedChannel): boolean {
        return this.allowAccess;
    }

    canProcessEvent(device: DeviceInfo, event: FileEvent): boolean {
        return this.allowProcessingEvents;
    }
}
