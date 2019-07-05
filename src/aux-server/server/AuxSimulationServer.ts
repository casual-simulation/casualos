import { ChannelManager } from '@casual-simulation/causal-tree-server';
import { SubscriptionLike } from 'rxjs';
import { AuxCausalTree } from '@casual-simulation/aux-common';
import { LocalRealtimeCausalTree } from '@casual-simulation/causal-trees';
import { NodeSimulation } from '@casual-simulation/aux-vm-node';
import { User } from '@casual-simulation/aux-vm';

export class AuxSimulationServer implements SubscriptionLike {
    private _subs: SubscriptionLike[];

    closed: boolean;

    constructor(serverUser: User, server: ChannelManager) {
        this._subs = [
            server.whileCausalTreeLoaded<AuxCausalTree>((tree, info) => {
                const simulation = new NodeSimulation(
                    serverUser,
                    info.id,
                    {
                        isBuilder: false,
                        isPlayer: false,
                    },
                    tree
                );

                return [simulation];
            }),
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
