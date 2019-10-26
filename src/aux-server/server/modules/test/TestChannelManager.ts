import {
    AuxLoadedChannel,
    NodeAuxChannel,
    NodeSimulation,
} from '@casual-simulation/aux-vm-node';
import {
    RealtimeChannelInfo,
    storedTree,
    site,
    RemoteAction,
    DeviceInfo,
} from '@casual-simulation/causal-trees';
import { Subscription, Subject } from 'rxjs';
import { AuxCausalTree } from '@casual-simulation/aux-common';
import { AuxConfig, AuxUser } from '@casual-simulation/aux-vm';

export class TestChannelManager {
    private _map: Map<string, AuxLoadedChannel> = new Map();

    addChannel(info: RealtimeChannelInfo, channel: AuxLoadedChannel) {
        this._map.set(info.id, channel);
    }

    async hasChannel(info: RealtimeChannelInfo): Promise<boolean> {
        return this._map.has(info.id);
    }

    async loadChannel(info: RealtimeChannelInfo): Promise<AuxLoadedChannel> {
        return this._map.get(info.id);
    }
}

export async function createChannel(
    info: RealtimeChannelInfo,
    user: AuxUser,
    device: DeviceInfo,
    config: AuxConfig
): Promise<AuxLoadedChannel> {
    const tree = new AuxCausalTree(storedTree(site(1)));
    await tree.root();
    const channel = new NodeAuxChannel(tree, user, device, config);
    const sim = new NodeSimulation(
        info.id,
        config.config,
        config.partitions,
        () => channel
    );

    await sim.init();

    return {
        tree,
        channel: channel,
        simulation: sim,
        info: info,
        subscription: new Subscription(),
        events: new Subject<RemoteAction[]>(),
    };
}
