import {
    ChannelManager,
    DeviceManager,
    DeviceConnection,
} from '@casual-simulation/causal-tree-server';
import { SubscriptionLike } from 'rxjs';
import { AuxCausalTree, FileEvent } from '@casual-simulation/aux-common';
import {
    LocalRealtimeCausalTree,
    DeviceInfo,
} from '@casual-simulation/causal-trees';
import {
    NodeSimulation,
    AuxChannelManager,
} from '@casual-simulation/aux-vm-node';
import { AuxUser } from '@casual-simulation/aux-vm';

export class AuxChannelServer implements SubscriptionLike {
    private _subs: SubscriptionLike[];

    closed: boolean;

    constructor(
        deviceManager: DeviceManager,
        channelManager: AuxChannelManager
    ) {
        this._subs = [
            deviceManager.whenConnectedToChannel(
                async (device: DeviceConnection<DeviceInfo>, channel) => {
                    const socket = device.extra.socket;
                    let loaded = await channelManager.loadChannel(channel.info);

                    socket.on('remote_event', (events: FileEvent[]) => {
                        loaded.channel.sendEvents(events);
                    });

                    return [];
                }
            ),
        ];
    }

    unsubscribe(): void {
        if (this.closed) {
            return;
        }
        this.closed = true;
        this._subs.forEach(s => s.unsubscribe());
        this._subs = [];
    }
}
