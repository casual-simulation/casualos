import { Simulation } from '../managers/Simulation';
import {
    RealtimeChannelInfo,
    DeviceInfo,
} from '@casual-simulation/causal-trees';
import { Subscription } from 'rxjs';

/**
 * Defines an interface for objects which are able to extend a simulation with custom logic.
 */
export interface AuxModule2 {
    /**
     * Sets up the services/dependencies that the module needs
     * to perform its duties. Returns a subscription that, when unsubscribed, will dispose of extra resources.
     * @param simulation The simulation that the module should be setup on.
     */
    setup(simulation: Simulation): Promise<Subscription>;

    /**
     * Signals that a device become connected to the simulation.
     * @param simulation The simulation that the device was connected to.
     * @param device The device.
     */
    deviceConnected(simulation: Simulation, device: DeviceInfo): Promise<void>;

    /**
     * Signals that a device became disconnected from the simulation.
     * @param simulation The simulation that the device was disconnected from.
     * @param device The device.
     */
    deviceDisconnected(
        simulation: Simulation,
        device: DeviceInfo
    ): Promise<void>;
}
