import {
    Simulation,
    LoginManager,
    PortalManager,
} from '@casual-simulation/aux-vm';

/**
 * Defines an interface for simulations that interface with remote instances.
 */
export interface RemoteSimulation extends Simulation {
    /**
     * Gets the login manager.
     */
    login: LoginManager;

    /**
     * Gets the portal manager.
     */
    portals: PortalManager;
}
