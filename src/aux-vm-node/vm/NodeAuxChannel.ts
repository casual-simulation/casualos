import { AuxCausalTree } from '@casual-simulation/aux-common';
import {
    LocalRealtimeCausalTree,
    RealtimeCausalTree,
} from '@casual-simulation/causal-trees';
import {
    AuxConfig,
    // AuxChannel
    BaseAuxChannel,
} from '@casual-simulation/aux-vm';

export class NodeAuxChannel extends BaseAuxChannel {
    private _tree: AuxCausalTree;

    id: string;

    constructor(tree: AuxCausalTree, config: AuxConfig) {
        super(config);
        this._tree = tree;
    }

    protected async _createRealtimeCausalTree(): Promise<
        RealtimeCausalTree<AuxCausalTree>
    > {
        return new LocalRealtimeCausalTree<AuxCausalTree>(this._tree);
    }
}
