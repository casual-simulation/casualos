/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
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
