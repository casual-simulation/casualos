import { AuxVM, BaseSimulation, LoginManager } from '@casual-simulation/aux-vm';
import { RemoteSimulation } from './RemoteSimulation';
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

    constructor(id: string, vm: AuxVM) {
        super(id, vm);
        this._login = new LoginManager(this._vm);
    }

    protected _beforeVmInit() {
        super._beforeVmInit();
        this._portals = new PortalManager(this._vm);
        this._subscriptions.push(this._portals);
    }
}
