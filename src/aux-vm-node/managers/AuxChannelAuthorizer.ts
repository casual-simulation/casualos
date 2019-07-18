import { ChannelAuthorizer } from '@casual-simulation/causal-tree-server';
import { DeviceInfo } from '@casual-simulation/causal-trees';
import { FileEvent } from '@casual-simulation/aux-common';

export interface AuxChannelAuthorizer extends ChannelAuthorizer {
    /**
     * Determines whether to allow the given event that was sent by the given device.
     * @param device The device.
     * @param event The event.
     */
    canProcessEvent(device: DeviceInfo, event: FileEvent): boolean;
}
