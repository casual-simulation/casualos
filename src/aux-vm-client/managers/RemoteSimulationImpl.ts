import {
    AuxUser,
    AuxVM,
    BaseSimulation,
    LoginManager,
    AuxConfig,
} from '@casual-simulation/aux-vm';
import { RemoteSimulation } from './RemoteSimulation';
import { AuxPartitionConfig } from '@casual-simulation/aux-common';
import { PortalManager } from '@casual-simulation/aux-vm/managers';

/**
 * Defines a class that provides an implementation of RemoteSimulation.
 */
export class RemoteSimulationImpl
    extends BaseSimulation
    implements RemoteSimulation
{
    private _login: LoginManager;
    private _portals: PortalManager;

    get login() {
        return this._login;
    }

    get portals() {
        return this._portals;
    }

    constructor(
        id: string,
        config: AuxConfig['config'],
        partitions: AuxPartitionConfig,
        createVm: (config: AuxConfig) => AuxVM
    ) {
        super(id, config, partitions, createVm);
        this._login = new LoginManager(this._vm);
    }

    protected _initManagers() {
        super._initManagers();
        this._portals = new PortalManager(this._vm);

        this._subscriptions.push(this._portals);
    }
}
