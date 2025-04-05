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
import type { RegisterHtmlAppAction } from '@casual-simulation/aux-common';
import { asyncResult, hasValue } from '@casual-simulation/aux-common';
import type { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import type { HtmlPortalSetupResult } from '@casual-simulation/aux-vm/portals/HtmlAppBackend';

export const eventNames = [] as string[];

export function resolveRegisterAppAction(
    simulation: BrowserSimulation,
    event: RegisterHtmlAppAction
) {
    if (hasValue(event.taskId)) {
        simulation.helper.transaction(
            asyncResult(event.taskId, {
                builtinEvents: eventNames,
            } as HtmlPortalSetupResult)
        );
    }
}
