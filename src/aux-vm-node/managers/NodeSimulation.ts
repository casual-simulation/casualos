import { BaseSimulation, User } from '@casual-simulation/aux-vm';
import { AuxCausalTree } from '@casual-simulation/aux-common';
import { AuxVMNode } from '../vm/AuxVMNode';

export class NodeSimulation extends BaseSimulation {
    constructor(
        user: User,
        id: string,
        config: { isBuilder: boolean; isPlayer: boolean },
        tree: AuxCausalTree
    ) {
        super(user, id, config, cfg => new AuxVMNode(tree, cfg));
    }
}
