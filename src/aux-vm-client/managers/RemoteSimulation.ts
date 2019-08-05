import { Simulation, LoginManager } from '@casual-simulation/aux-vm';

/**
 * Defines an interface for simulations that interface with remote servers.
 */
export interface RemoteSimulation extends Simulation {
    /**
     * Gets the login manager.
     */
    login: LoginManager;
}
