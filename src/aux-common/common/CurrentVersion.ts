/**
 * Defines an interface that represents the current version of a causal tree.
 */
export interface CurrentVersion {
    /**
     * The ID of the local site.
     * Null if the local site does not have an ID.
     */
    currentSite: string | null;

    /**
     * The ID of the site that is used for "remote" edits.
     * That is, edits that were not made through the UI.
     */
    remoteSite: string | null;

    /**
     * The current version vector.
     */
    vector: VersionVector;
}

/**
 * Defines an interface that represents a map of site IDs to timestamps.
 */
export interface VersionVector {
    [site: string]: number;
}
