import { File, UserMode } from '@casual-simulation/aux-common';

import {
    AuxUser,
    AuxVM,
    BaseSimulation,
    LoginManager,
    AuxConfig,
} from '@casual-simulation/aux-vm';
import { ProgressManager } from '@casual-simulation/aux-vm/managers';
import { filter } from 'rxjs/operators';
import { ConsoleMessages } from '@casual-simulation/causal-trees';
import { Observable } from 'rxjs';
import { RemoteSimulation } from './RemoteSimulation';

/**
 * Defines a class that provides an implementation of RemoteSimulation.
 */
export class RemoteSimulationImpl extends BaseSimulation
    implements RemoteSimulation {
    private _login: LoginManager;

    get login() {
        return this._login;
    }

    constructor(
        id: string,
        config: { isBuilder: boolean; isPlayer: boolean },
        createVm: (config: AuxConfig) => AuxVM
    ) {
        super(id, config, createVm);
        this._login = new LoginManager(this._vm);
    }
}
