import {
    BaseSimulation,
    AuxChannel,
    SimulationOrigin,
} from '@casual-simulation/aux-vm';
import { AuxVM } from '@casual-simulation/aux-vm/vm/AuxVM';
import { AuxVMNode } from '../vm/AuxVMNode';
import { ConnectionIndicator } from '@casual-simulation/aux-common';

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
        return new NodeSimulation(vm.id, vm.origin, vm.configBotId, vm);
    }
}
