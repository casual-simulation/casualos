import { PrecalculatedBot } from '@casual-simulation/aux-common';
import { BrowserSimulation } from './BrowserSimulation';
import { never, Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';

/**
 * Gets an observable that resolves whenever the user bot for the given simulation changes.
 * @param simulation The simulation.
 */
export function userFileChanged(
    simulation: BrowserSimulation
): Observable<PrecalculatedBot> {
    return simulation.login.userChanged.pipe(
        switchMap(user => {
            if (user) {
                return simulation.watcher.botChanged(user.id);
            } else {
                return never();
            }
        })
    );
}
