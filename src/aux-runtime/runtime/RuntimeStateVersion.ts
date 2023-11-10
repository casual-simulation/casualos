import { CurrentVersion, VersionVector } from '@casual-simulation/aux-common';
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
