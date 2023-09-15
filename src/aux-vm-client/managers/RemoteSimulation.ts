import {
    Simulation,
    LoginManager,
    PortalManager,
    SimulationOrigin,
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

    /**
     * The origin of the simulation.
     */
    origin: SimulationOrigin;

    /**
     * Gets the record name that the simulation is connected to.
     */
    get recordName(): string | null;

    /**
     * Gets the instance that the simulation is connected to.
     */
    get inst(): string;
}
