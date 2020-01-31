import {
    PrecalculatedBot,
    PortalType,
    getPortalConfigBotID,
    Bot,
} from '@casual-simulation/aux-common';
import { BrowserSimulation } from './BrowserSimulation';
import { never, Observable, of } from 'rxjs';
import { switchMap, first, map, distinctUntilChanged } from 'rxjs/operators';
import {
    LoginManager,
    BotWatcher,
    UpdatedBotInfo,
    BotHelper,
} from '@casual-simulation/aux-vm';

/**
 * Gets an observable that resolves whenever the user bot for the given simulation changes.
 * @param simulation The simulation.
 */
export function userBotChanged(
    simulation: BrowserSimulation
): Observable<PrecalculatedBot> {
    return userBotChangedCore(simulation.login, simulation.watcher).pipe(
        map(u => u.bot)
    );
}

/**
 * Gets an observable that resolves whenever the user bot for the given simulation changes.
 * @param simulation The simulation.
 */
export function userBotTagsChanged(
    simulation: BrowserSimulation
): Observable<UpdatedBotInfo> {
    return userBotChangedCore(simulation.login, simulation.watcher);
}

export function userBotChangedCore(login: LoginManager, watcher: BotWatcher) {
    return login.userChanged.pipe(
        switchMap(user => {
            if (user) {
                return watcher.botTagsChanged(user.id);
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

/**
 * Watches the config bot for the given portal for changes.
 * @param simulation The simulation.
 * @param portal The portal.
 */
export function watchPortalConfigBot(
    simulation: BrowserSimulation,
    portal: PortalType
): Observable<PrecalculatedBot> {
    return watchPortalConfigBotCore(
        simulation.login,
        simulation.watcher,
        simulation.helper,
        portal
    );
}

/**
 * Watches the config bot for the given portal for changes.
 * @param login The login manager.
 * @param watcher The bot watcher.
 * @param helper The bot helper.
 * @param portal The portal.
 */
export function watchPortalConfigBotCore(
    login: LoginManager,
    watcher: BotWatcher,
    helper: BotHelper,
    portal: PortalType
): Observable<PrecalculatedBot> {
    return userBotChangedCore(login, watcher).pipe(
        map(update => {
            const calc = helper.createContext();
            return getPortalConfigBotID(calc, update.bot, portal);
        }),
        distinctUntilChanged(),
        switchMap(id => (id ? watcher.botChanged(id) : of(null)))
    );
}
