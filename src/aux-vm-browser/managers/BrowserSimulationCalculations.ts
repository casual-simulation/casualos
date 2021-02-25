import {
    PrecalculatedBot,
    PortalType,
    getPortalConfigBotID,
    Bot,
    registerBuiltinPortal,
} from '@casual-simulation/aux-common';
import { BrowserSimulation } from './BrowserSimulation';
import { never, Observable, of } from 'rxjs';
import {
    switchMap,
    first,
    map,
    distinctUntilChanged,
    filter,
    flatMap,
} from 'rxjs/operators';
import {
    LoginManager,
    BotWatcher,
    UpdatedBotInfo,
    BotHelper,
} from '@casual-simulation/aux-vm';
import { PortalManager } from '@casual-simulation/aux-vm/managers';
import { RemoteSimulation } from '@casual-simulation/aux-vm-client';

/**
 * Gets an observable that resolves whenever the user bot for the given simulation changes.
 * @param simulation The simulation.
 */
export function userBotChanged(
    simulation: BrowserSimulation
): Observable<PrecalculatedBot> {
    return userBotChangedCore(simulation.login, simulation.watcher).pipe(
        map((u) => u.bot)
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
        switchMap((user) => {
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
    return userBotChanged(simulation).pipe(first((bot) => !!bot));
}

/**
 * Watches the config bot for the given portal for changes.
 * @param simulation The simulation.
 * @param portal The portal.
 * @param shouldRegisterBuiltinPortal Whether an event should be sent to register the given portal as a builtin portal.
 */
export function watchPortalConfigBot(
    simulation: RemoteSimulation,
    portal: PortalType,
    shouldRegisterBuiltinPortal: boolean = true
): Observable<PrecalculatedBot> {
    return watchPortalConfigBotCore(
        simulation.watcher,
        simulation.portals,
        simulation.helper,
        portal,
        shouldRegisterBuiltinPortal
    );
}

/**
 * Watches the config bot for the given portal for changes.
 * @param watcher The bot watcher.
 * @param portals The portal manager.
 * @param helper The bot helper.
 * @param portal The portal.
 */
export function watchPortalConfigBotCore(
    watcher: BotWatcher,
    portals: PortalManager,
    helper: BotHelper,
    portal: PortalType,
    shouldRegisterBuiltinPortal: boolean = true
): Observable<PrecalculatedBot> {
    if (shouldRegisterBuiltinPortal) {
        helper.transaction(registerBuiltinPortal(portal));
    }
    return portals.portalBotIdUpdated.pipe(
        flatMap((p) => p),
        filter((p) => p.portalId === portal),
        map((p) => p.botId),
        distinctUntilChanged(),
        switchMap((id) => (id ? watcher.botChanged(id) : of(null)))
    );
}
