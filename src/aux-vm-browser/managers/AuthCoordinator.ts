import { SubscriptionLike } from 'rxjs';
import { BrowserSimulation } from './BrowserSimulation';
import { SimulationManager } from '@casual-simulation/aux-vm/managers';

/**
 * Defines a class that is able to coordinate authentication across multiple simulations.
 */
export class AuthCoordinator<TSim extends BrowserSimulation>
    implements SubscriptionLike
{
    private _simulationManager: SimulationManager<TSim>;

    constructor(manager: SimulationManager<TSim>) {
        this._simulationManager = manager;
    }
}
