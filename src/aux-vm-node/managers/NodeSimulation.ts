import { BaseSimulation, AuxUser } from '@casual-simulation/aux-vm';
import { AuxVMNode } from '../vm/AuxVMNode';
import { BaseAuxChannel, AuxConfig } from '@casual-simulation/aux-vm/vm';

export class NodeSimulation extends BaseSimulation {
    constructor(
        id: string,
        config: { isBuilder: boolean; isPlayer: boolean },
        channelFactory: (config: AuxConfig) => BaseAuxChannel
    ) {
        super(id, config, cfg => new AuxVMNode(channelFactory(cfg)));
    }
}
