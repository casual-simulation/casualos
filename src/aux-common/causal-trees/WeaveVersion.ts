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
}

/**
 * Defines an interface that represents a version number calculated by
 * taking each known site and pairing it with the latest timestamp from that site.
 */
export interface WeaveSiteVersion {
    [siteId: number]: number;
}

/**
 * Creates a new weave version from the given hash and sites.
 * @param hash
 * @param sites
 */
export function weaveVersion(
    hash: string,
    sites: WeaveSiteVersion
): WeaveVersion {
    return {
        hash,
        sites,
    };
}

/**
 * Determines if the two versions are equal.
 * @param first The first version.
 * @param second The second version.
 */
export function versionsEqual(
    first: WeaveVersion,
    second: WeaveVersion
): boolean {
    if (!first && second) {
        return false;
    } else if (first && !second) {
        return false;
    } else {
        return first.hash === second.hash;
    }
}
