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

export function updateQuery(router: VueRouter, simulations: SimulationInfo[]) {
    if (!appManager.simulationManager.primary) {
        return;
    }

    const previousChannel = router.currentRoute.params.id;
    const previousDimension = router.currentRoute.params.dimension;

    const channel =
        appManager.simulationManager.primary.parsedId.channel ||
        previousChannel;
    const dimension =
        appManager.simulationManager.primary.parsedId.dimension ||
        previousDimension;
    if (channel && dimension) {
        let route = {
            name: 'home',
            params: {
                id: channel === 'default' ? null : channel,
                dimension: dimension,
            },
            query: {
                channels: simulations
                    .filter(
                        sim =>
                            sim.id !== appManager.simulationManager.primary.id
                    )
                    .map(sim => sim.id),
            },
        };

        // Only add the history if switching dimensions or the primary channel
        if (channel !== previousChannel || dimension !== previousDimension) {
            window.history.pushState({}, window.document.title);
        }

        router.replace(route);
    }
}

export function navigateToDimension(
    event: GoToDimensionAction,
    router: VueRouter,
    simulations: SimulationInfo[]
) {
    appManager.simulationManager.simulations.forEach(sim => {
        sim.parsedId = {
            ...sim.parsedId,
            dimension: event.dimension,
        };
    });

    updateQuery(router, simulations);
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
