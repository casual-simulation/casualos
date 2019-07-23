import { BaseSimulation, AuxUser } from '@casual-simulation/aux-vm';
import { AuxCausalTree } from '@casual-simulation/aux-common';
import { AuxVMNode } from '../vm/AuxVMNode';
import { NodeAuxChannel } from '../vm';

export class NodeSimulation extends BaseSimulation {
    constructor(
        channel: NodeAuxChannel,
        id: string,
        config: { isBuilder: boolean; isPlayer: boolean }
    ) {
        super(id, config, cfg => new AuxVMNode(channel));
    }
}
