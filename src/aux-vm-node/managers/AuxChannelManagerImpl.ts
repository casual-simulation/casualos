import { AuxChannelManager, AuxLoadedChannel } from './AuxChannelManager';
import { ChannelManagerImpl } from '@casual-simulation/causal-tree-server';
import {
    RealtimeChannelInfo,
    User,
    CausalTreeStore,
    CausalTreeFactory,
    DeviceInfo,
    DeviceAction,
    RemoteAction,
} from '@casual-simulation/causal-trees';
import { NodeAuxChannel } from '../vm/NodeAuxChannel';
import { AuxUser, AuxModule, AuxConfig } from '@casual-simulation/aux-vm';
import { SigningCryptoImpl } from '@casual-simulation/crypto';
import { AuxCausalTree, BotAction } from '@casual-simulation/aux-common';
import { Subscription, Subject } from 'rxjs';
import { NodeSimulation } from './NodeSimulation';
import { nodeSimulationFromTree } from './NodeSimulationFactories';

export class AuxChannelManagerImpl extends ChannelManagerImpl
    implements AuxChannelManager {
    private _user: AuxUser;
    private _device: DeviceInfo;
    private _auxChannels: Map<string, NodeAuxChannelStatus>;
    private _modules: AuxModule[];

    constructor(
        user: AuxUser,
        device: DeviceInfo,
        treeStore: CausalTreeStore,
        causalTreeFactory: CausalTreeFactory,
        crypto: SigningCryptoImpl,
        modules: AuxModule[]
    ) {
        super(treeStore, causalTreeFactory, crypto);
        this._user = user;
        this._device = device;
        this._auxChannels = new Map();
        this._modules = modules;

        this.whileCausalTreeLoaded((tree: AuxCausalTree, info, events) => {
            const config: AuxConfig['config'] = {
                isPlayer: false,
                isBuilder: false,
                version: null,
                versionHash: null,
            };
            const sim = nodeSimulationFromTree(
                tree,
                this._user,
                this._device,
                info.id,
                config
            );
            const channel = <NodeAuxChannel>sim.channel;

            this._auxChannels.set(info.id, {
                channel: channel,
                simulation: sim,
                initialized: false,
                subscription: new Subscription(),
            });

            return [
                channel,
                channel.onConnectionStateChanged.subscribe(m => {
                    if (m.type === 'message') {
                        console.log(`[${m.source}]: ${m.message}`);
                    }
                }),
                new Subscription(() => {
                    this._auxChannels.delete(info.id);
                }),
            ];
        });
    }

    async sendEvents(
        channel: AuxLoadedChannel,
        events: DeviceAction[]
    ): Promise<void> {
        await channel.channel.sendEvents(events);
    }

    async loadChannel(info: RealtimeChannelInfo): Promise<AuxLoadedChannel> {
        const loaded = await super.loadChannel(info);
        const status = this._auxChannels.get(info.id);

        if (!status.initialized) {
            status.initialized = true;
            console.log(`[AuxChannelManagerImpl] Initializing ${info.id}...`);
            await status.simulation.init();
            status.subscription.add(
                status.channel.remoteEvents.subscribe(loaded.events)
            );

            for (let mod of this._modules) {
                let sub = await mod.setup(info, status.channel);
                if (sub) {
                    status.subscription.add(sub);
                }
            }
        }

        return {
            info: loaded.info,
            events: loaded.events,
            subscription: loaded.subscription,
            tree: <AuxCausalTree>loaded.tree,
            channel: status.channel,
            simulation: status.simulation,
        };
    }

    async connect(
        channel: AuxLoadedChannel,
        device: DeviceInfo
    ): Promise<Subscription> {
        let subscription = await super.connect(channel, device);
        for (let mod of this._modules) {
            await mod.deviceConnected(channel.info, channel.channel, device);
        }

        return new Subscription(async () => {
            for (let mod of this._modules) {
                await mod.deviceDisconnected(
                    channel.info,
                    channel.channel,
                    device
                );
            }
            subscription.unsubscribe();
        });
    }
}

interface NodeAuxChannelStatus {
    channel: NodeAuxChannel;
    simulation: NodeSimulation;
    initialized: boolean;
    subscription: Subscription;
}
