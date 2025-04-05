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
    CurrentVersion,
    VersionVector,
} from '@casual-simulation/aux-common';
import { mergeVersions } from '@casual-simulation/aux-common/bots';

/**
 * Defines an interface that represents the state version of a aux runtime.
 */
export interface RuntimeStateVersion {
    /**
     * A map of local site IDs.
     */
    localSites: {
        [id: string]: boolean;
    };

    /**
     * The current version vector.
     */
    vector: VersionVector;
}

/**
 * Updates the current runtime state version with the given new version and returns the result.
 * @param newVersion
 * @param currentVersion
 */
export function updateRuntimeVersion(
    newVersion: CurrentVersion,
    currentVersion: RuntimeStateVersion
): RuntimeStateVersion {
    if (!newVersion) {
        return currentVersion;
    }
    let localSites = currentVersion.localSites;
    if (newVersion.currentSite) {
        localSites = {
            ...currentVersion.localSites,
        };
        localSites[newVersion.currentSite] = true;
    }
    const vector = mergeVersions(currentVersion.vector, newVersion.vector);

    return {
        localSites,
        vector,
    };
}
