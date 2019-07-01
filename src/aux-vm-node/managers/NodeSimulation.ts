import { BaseSimulation } from '@casual-simulation/aux-vm';

export class NodeSimulation extends BaseSimulation {
    constructor(
        user: User,
        id: string,
        config: { isBuilder: boolean; isPlayer: boolean }
    ) {
        super(user, id, config, cfg => new AuxVMNode());
    }
}
