import type { BrowserSimulation } from '@casual-simulation/aux-vm-browser';

export interface SimulationInfo {
    id: string;
    inst: string;
    recordName: string | null;
    displayName: string;
    online: boolean;
    synced: boolean;
    lostConnection: boolean;
    subscribed: boolean;
}

export function createSimulationInfo(
    simulation: BrowserSimulation
): SimulationInfo {
    return {
        id: simulation.id,
        inst: simulation.inst,
        recordName: simulation.recordName,
        displayName: simulation.id,
        online: false,
        synced: false,
        lostConnection: false,
        subscribed: false,
    };
}
