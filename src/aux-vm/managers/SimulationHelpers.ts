import { Simulation } from './Simulation';
import { first } from 'rxjs/operators';

/**
 * Gets a promise that waits for the given simulation to become synced with the server.
 * Once the simulation is synced, you can be sure that everything is initialized.
 *
 * If the simulation is already synced, then the returned promise will resolve immediately.
 *
 * @param simulation The simulation.
 */
export function waitForSync(simulation: Simulation): Promise<boolean> {
    return simulation.connection.syncStateChanged
        .pipe(first(synced => synced))
        .toPromise();
}
