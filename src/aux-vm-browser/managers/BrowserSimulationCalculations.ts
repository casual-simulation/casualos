/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type {
    PrecalculatedBot,
    PortalType,
} from '@casual-simulation/aux-common';
import { registerBuiltinPortal } from '@casual-simulation/aux-common';
import type { BrowserSimulation } from './BrowserSimulation';
import type { Observable } from 'rxjs';
import { NEVER, of } from 'rxjs';
import {
    switchMap,
    first,
    map,
    distinctUntilChanged,
    filter,
    mergeMap,
} from 'rxjs/operators';
import type {
    BotWatcher,
    UpdatedBotInfo,
    BotHelper,
} from '@casual-simulation/aux-vm';
import type { PortalManager } from '@casual-simulation/aux-vm/managers';
import type { RemoteSimulation } from '@casual-simulation/aux-vm-client';

/**
 * Gets an observable that resolves whenever the user bot for the given simulation changes.
 * @param simulation The simulation.
 */
export function userBotChanged(
    simulation: BrowserSimulation
): Observable<PrecalculatedBot> {
    return userBotChangedCore(
        simulation.helper.userId,
        simulation.watcher
    ).pipe(map((u) => u.bot));
}

/**
 * Gets an observable that resolves whenever the user bot for the given simulation changes.
 * @param simulation The simulation.
 */
export function userBotTagsChanged(
    simulation: BrowserSimulation
): Observable<UpdatedBotInfo> {
    return userBotChangedCore(simulation.helper.userId, simulation.watcher);
}

export function userBotChangedCore(botId: string, watcher: BotWatcher) {
    if (botId) {
        return watcher.botTagsChanged(botId);
    } else {
        return NEVER;
    }
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
 * Gets the config bot for the given portal.
 * @param simulation The simulation.
 * @param portal The portal.
 */
export function getPortalConfigBot(
    simulation: RemoteSimulation,
    portal: PortalType
): PrecalculatedBot {
    const data = simulation.portals.portalBots.get(portal);

    if (data && data.botId) {
        return simulation.helper.botsState[data.botId] ?? null;
    }

    return null;
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
        mergeMap((p) => p),
        filter((p) => p.portalId === portal),
        map((p) => p.botId),
        distinctUntilChanged(),
        switchMap((id) => (id ? watcher.botChanged(id) : of(null)))
    );
}
