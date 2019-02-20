/**
 * Defines an interface for the version that a weave is at.
 */
export interface WeaveVersion {
    /**
     * Gets the version number of the weave based on the sites.
     */
    sites: WeaveSiteVersion;

    /**
     * The hash of the atoms contained in this weave.
     */
    hash: string;
};

/**
 * Defines an interface that represents a version number calculated by
 * taking each known site and pairing it with the latest timestamp from that site.
 */
export interface WeaveSiteVersion {
    [siteId: number]: number;
}