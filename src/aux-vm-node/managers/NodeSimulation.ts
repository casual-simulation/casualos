import { BaseSimulation, AuxUser } from '@casual-simulation/aux-vm';
import { AuxCausalTree } from '@casual-simulation/aux-common';
import { AuxVMNode } from '../vm/AuxVMNode';

export class NodeSimulation extends BaseSimulation {
    constructor(
        user: AuxUser,
        id: string,
        config: { isBuilder: boolean; isPlayer: boolean },
        tree: AuxCausalTree
    ) {
        super(id, config, cfg => new AuxVMNode(tree, user, cfg));
    }
}
