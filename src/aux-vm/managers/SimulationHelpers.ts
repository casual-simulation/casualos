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
import { firstValueFrom } from 'rxjs';
import type { Simulation, SimulationOrigin } from './Simulation';
import { first } from 'rxjs/operators';

/**
 * Gets a promise that waits for the given simulation to become synced with the inst.
 * Once the simulation is synced, you can be sure that everything is initialized.
 *
 * If the simulation is already synced, then the returned promise will resolve immediately.
 *
 * @param simulation The simulation.
 */
export function waitForSync(simulation: Simulation): Promise<boolean> {
    return firstValueFrom(
        simulation.connection.syncStateChanged.pipe(first((synced) => synced))
    );
}

/**
 * Gets whether the given simulation origin is for a static simulation.
 * @param origin The origin or kind of the simulation.
 */
export function isStatic(
    origin: SimulationOrigin | SimulationOrigin['kind']
): boolean {
    return (typeof origin === 'string' ? origin : origin?.kind) === 'static';
}

/**
 * Gets whether the given simulation origin is for a default simulation.
 * @param origin The origin or kind of the simulation.
 */
export function isDefault(
    origin: SimulationOrigin | SimulationOrigin['kind']
): boolean {
    return (
        ((typeof origin === 'string' ? origin : origin?.kind) ?? 'default') ===
        'default'
    );
}

/**
 * Gets whether the given simulation origin is for a temp simulation.
 * @param origin The origin or kind of the simulation.
 */
export function isTemp(
    origin: SimulationOrigin | SimulationOrigin['kind']
): boolean {
    return (typeof origin === 'string' ? origin : origin?.kind) === 'temp';
}
