import { BaseSimulation, AuxChannel } from '@casual-simulation/aux-vm';
import { AuxVM } from '@casual-simulation/aux-vm/vm/AuxVM';
import { AuxVMNode } from '../vm/AuxVMNode';

export class NodeSimulation extends BaseSimulation {
    get channel() {
        const vm = <AuxVMNode>this._vm;
        return vm.channel;
    }

    constructor(id: string, channel: AuxVM | AuxChannel) {
        super(id, 'id' in channel ? channel : new AuxVMNode(channel));
    }

    protected _createSubSimulation(id: string, vm: AuxVM) {
        return new NodeSimulation(id, vm);
    }
}
