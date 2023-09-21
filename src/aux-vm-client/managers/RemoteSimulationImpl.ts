import { AuxVM, BaseSimulation, LoginManager } from '@casual-simulation/aux-vm';
import { RemoteSimulation } from './RemoteSimulation';
import {
    PortalManager,
    SimulationOrigin,
} from '@casual-simulation/aux-vm/managers';

/**
 * Defines a class that provides an implementation of RemoteSimulation.
 */
export class RemoteSimulationImpl
    extends BaseSimulation
    implements RemoteSimulation
{
    private _login: LoginManager;
    private _portals: PortalManager;
    private _origin: SimulationOrigin;

    get login() {
        return this._login;
    }

    get portals() {
        return this._portals;
    }

    constructor(id: string, origin: SimulationOrigin, vm: AuxVM) {
        super(id, vm);
        this._origin = origin;
        this._login = new LoginManager(this._vm);
    }

    get origin(): SimulationOrigin {
        return this._origin;
    }

    get recordName(): string {
        return this.origin.recordName;
    }

    get inst(): string {
        return this.origin.inst ?? this.id;
    }

    protected _beforeVmInit() {
        super._beforeVmInit();
        this._portals = new PortalManager(this._vm);
        this._subscriptions.push(this._portals);
    }
}
