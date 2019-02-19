/**
 * Defines an interface for version information
 * about a client's data state.
 */
export interface StateVersionInfo {
    /**
     * The site ID of the peer that this info is for.
     * Null if the peer does not have a site ID.
     */
    siteId: number | null;
    /**
     * Gets the version number that this peer's state is at.
     * Null if this peer has no version.
     */
    version: number[] | null;
}
