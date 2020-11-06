import { VersionVector } from '@casual-simulation/causal-trees';

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
