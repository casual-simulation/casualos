import {
    BaseSimulation,
    AuxUser,
    BaseAuxChannel,
    AuxConfig,
} from '@casual-simulation/aux-vm';
import { AuxVMNode } from '../vm/AuxVMNode';
import { AuxPartitionConfig } from '@casual-simulation/aux-common';

export class NodeSimulation extends BaseSimulation {
    get channel() {
        const vm = <AuxVMNode>this._vm;
        return vm.channel;
    }

    constructor(
        id: string,
        config: AuxConfig['config'],
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
