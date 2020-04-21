import { appManager } from './AppManager';
import VueRouter from 'vue-router';
import {
    GoToDimensionAction,
    simulationIdToString,
} from '@casual-simulation/aux-common';
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
        displayName: simulationIdToString(simulation.parsedId),
        online: false,
        synced: false,
        lostConnection: false,
        subscribed: false,
    };
}
