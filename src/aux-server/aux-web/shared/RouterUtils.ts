import { Simulation } from '@casual-simulation/aux-vm';

export interface SimulationInfo {
    id: string;
    displayName: string;
    online: boolean;
    synced: boolean;
    lostConnection: boolean;
    subscribed: boolean;
}

export function createSimulationInfo(simulation: Simulation): SimulationInfo {
    return {
        id: simulation.id,
        displayName: simulation.id,
        online: false,
        synced: false,
        lostConnection: false,
        subscribed: false,
    };
}
