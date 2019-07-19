import { AuxChannelManager, AuxLoadedChannel } from './AuxChannelManager';
import { ChannelManagerImpl } from '@casual-simulation/causal-tree-server';
import {
    RealtimeChannelInfo,
    User,
    CausalTreeStore,
    CausalTreeFactory,
    DeviceInfo,
} from '@casual-simulation/causal-trees';
import { NodeAuxChannel } from '../vm/NodeAuxChannel';
import { AuxUser, AuxModule } from '@casual-simulation/aux-vm';
import { SigningCryptoImpl } from '@casual-simulation/crypto';
import {
    AuxCausalTree,
    FileEvent,
    DeviceEvent,
} from '@casual-simulation/aux-common';
import { AuxChannelAuthorizer } from './AuxChannelAuthorizer';
import { Subscription } from 'rxjs';

export class AuxChannelManagerImpl extends ChannelManagerImpl
    implements AuxChannelManager {
    private _user: AuxUser;
    private _authorizer: AuxChannelAuthorizer;
    private _auxChannels: Map<string, NodeAuxChannelStatus>;
    private _modules: AuxModule[];

    constructor(
        user: AuxUser,
        treeStore: CausalTreeStore,
        causalTreeFactory: CausalTreeFactory,
        crypto: SigningCryptoImpl,
        authorizer: AuxChannelAuthorizer,
        modules: AuxModule[]
    ) {
        super(treeStore, causalTreeFactory, crypto);
        this._user = user;
        this._auxChannels = new Map();
        this._authorizer = authorizer;
        this._modules = modules;

        this.whileCausalTreeLoaded((tree: AuxCausalTree, info) => {
            const channel = new NodeAuxChannel(tree, this._user, {
                host: null,
                config: { isPlayer: false, isBuilder: false },
                id: info.id,
                treeName: info.id,
            });

            this._auxChannels.set(info.id, {
                channel: channel,
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
        device: DeviceInfo,
        channel: AuxLoadedChannel,
        events: FileEvent[]
    ): Promise<void> {
        let allowed = events
            .filter(e => this._authorizer.canProcessEvent(device, e))
            .map(
                e =>
                    <DeviceEvent>{
                        type: 'device',
                        device: device,
                        event: e,
                    }
            );
        await channel.channel.sendEvents(allowed);
    }

    async loadChannel(info: RealtimeChannelInfo): Promise<AuxLoadedChannel> {
        const loaded = await super.loadChannel(info);
        const status = this._auxChannels.get(info.id);

        if (!status.initialized) {
            status.initialized = true;
            console.log(`[AuxChannelManagerImpl] Initializing ${info.id}...`);
            await status.channel.initAndWait();

            for (let mod of this._modules) {
                let sub = await mod.setup(status.channel);
                if (sub) {
                    status.subscription.add(sub);
                }
            }
        }

        return {
            info: loaded.info,
            subscription: loaded.subscription,
            tree: <AuxCausalTree>loaded.tree,
            channel: status.channel,
        };
    }
}

interface NodeAuxChannelStatus {
    channel: NodeAuxChannel;
    initialized: boolean;
    subscription: Subscription;
}
