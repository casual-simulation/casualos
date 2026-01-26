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
    Entitlement,
    EntitlementFeature,
    EntitlementScope,
} from '@casual-simulation/aux-common';

/**
 * Parses an array of entitlement strings into Entitlement objects.
 * @param entitlements The array of entitlement strings to parse.
 */
export function parseEntitlements(entitlements: string[]): Entitlement[] {
    if (!entitlements) {
        return [];
    }

    return entitlements.map((entitlementStr) => {
        const [feature, scope, ...records] = entitlementStr.split(':');
        if (!feature || !scope) {
            throw new Error(
                `Invalid entitlement format: ${entitlementStr}. Expected format is <feature>:<scope>`
            );
        }

        return {
            feature: feature as EntitlementFeature,
            scope: scope as EntitlementScope,
            designatedRecords: records.length > 0 ? records : undefined,
        } satisfies Entitlement;
    });
}
