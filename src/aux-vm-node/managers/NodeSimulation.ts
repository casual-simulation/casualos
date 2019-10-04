import {
    BaseSimulation,
    AuxUser,
    AuxPartitionConfig,
    BaseAuxChannel,
    AuxConfig,
} from '@casual-simulation/aux-vm';
import { AuxVMNode } from '../vm/AuxVMNode';

export class NodeSimulation extends BaseSimulation {
    get channel() {
        const vm = <AuxVMNode>this._vm;
        return vm.channel;
    }

    constructor(
        id: string,
        config: { isBuilder: boolean; isPlayer: boolean },
        partitions: AuxPartitionConfig,
        channelFactory: (config: AuxConfig) => BaseAuxChannel
    ) {
        super(
            id,
            config,
            partitions,
            cfg => new AuxVMNode(channelFactory(cfg))
        );
    }
}
