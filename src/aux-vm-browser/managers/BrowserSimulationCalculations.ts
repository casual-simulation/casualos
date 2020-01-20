import { PrecalculatedBot } from '@casual-simulation/aux-common';
import { BrowserSimulation } from './BrowserSimulation';
import { never, Observable } from 'rxjs';
import { switchMap, first } from 'rxjs/operators';
import { LoginManager, BotWatcher } from '@casual-simulation/aux-vm';

/**
 * Gets an observable that resolves whenever the user bot for the given simulation changes.
 * @param simulation The simulation.
 */
export function userBotChanged(
    simulation: BrowserSimulation
): Observable<PrecalculatedBot> {
    return userBotChangedCore(simulation.login, simulation.watcher);
}

export function userBotChangedCore(login: LoginManager, watcher: BotWatcher) {
    return login.userChanged.pipe(
        switchMap(user => {
            if (user) {
                return watcher.botChanged(user.id);
            } else {
                return never();
            }
        })
    );
}

/**
 * Gets the user bot for the given simulation asynchronously.
 * @param simulation The simulation.
 */
export function getUserBotAsync(
    simulation: BrowserSimulation
): Observable<PrecalculatedBot> {
    return userBotChanged(simulation).pipe(first(bot => !!bot));
}
