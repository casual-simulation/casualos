import { AuxChannelManager, AuxLoadedChannel } from './AuxChannelManager';
import { ChannelManagerImpl } from '@casual-simulation/causal-tree-server';
import {
    RealtimeChannelInfo,
    User,
    CausalTreeStore,
    CausalTreeFactory,
} from '@casual-simulation/causal-trees';
import { NodeAuxChannel } from '../vm/NodeAuxChannel';
import { AuxUser } from '@casual-simulation/aux-vm';
import { SigningCryptoImpl } from '@casual-simulation/crypto';
import { AuxCausalTree } from '@casual-simulation/aux-common';

export class AuxChannelManagerImpl extends ChannelManagerImpl
    implements AuxChannelManager {
    private _user: AuxUser;

    constructor(
        user: AuxUser,
        treeStore: CausalTreeStore,
        causalTreeFactory: CausalTreeFactory,
        crypto: SigningCryptoImpl
    ) {
        super(treeStore, causalTreeFactory, crypto);
        this._user = user;
    }

    async loadChannel(info: RealtimeChannelInfo): Promise<AuxLoadedChannel> {
        const loaded = await super.loadChannel(info);

        const tree = <AuxCausalTree>loaded.tree;
        const channel = new NodeAuxChannel(tree, {
            user: this._user,
            host: null,
            config: { isPlayer: false, isBuilder: false },
            id: info.id,
            treeName: info.id,
        });

        await channel.init(() => {}, () => {}, () => {}, () => {});

        return {
            info: loaded.info,
            subscription: loaded.subscription,
            tree: <AuxCausalTree>loaded.tree,
            channel,
        };
    }
}
