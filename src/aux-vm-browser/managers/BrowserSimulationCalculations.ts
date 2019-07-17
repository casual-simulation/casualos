import { PrecalculatedFile } from '@casual-simulation/aux-common';
import { BrowserSimulation } from './BrowserSimulation';
import { never, Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';

/**
 * Gets an observable that resolves whenever the user file for the given simulation changes.
 * @param simulation The simulation.
 */
export function userFileChanged(
    simulation: BrowserSimulation
): Observable<PrecalculatedFile> {
    return simulation.login.userChanged.pipe(
        switchMap(user => {
            if (user) {
                return simulation.watcher.fileChanged(user.id);
            } else {
                return never();
            }
        })
    );
}
