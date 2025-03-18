import type { AuxChannel } from '@casual-simulation/aux-vm/vm';
import type { SimulationOrigin } from '@casual-simulation/aux-vm';
import { BaseSimulation } from '@casual-simulation/aux-vm';
import type { AuxVM } from '@casual-simulation/aux-vm/vm/AuxVM';
import { AuxVMNode } from '../vm/AuxVMNode';

export class NodeSimulation extends BaseSimulation {
    get channel() {
        const vm = <AuxVMNode>this._vm;
        return vm.channel;
    }

    constructor(
        id: string,
        origin: SimulationOrigin,
        configBotId: string,
        channel: AuxVM | AuxChannel
    ) {
        super(
            'id' in channel
                ? channel
                : new AuxVMNode(id, origin, configBotId, channel)
        );
    }

    protected _createSubSimulation(vm: AuxVM) {
        const sim = new NodeSimulation(vm.id, vm.origin, vm.configBotId, vm);
        sim._isSubSimulation = true;
        return sim;
    }
}
