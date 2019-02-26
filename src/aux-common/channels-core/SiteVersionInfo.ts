import { WeaveVersion } from "./WeaveVersion";
import { SiteInfo } from "./SiteIdInfo";

/**
 * Defines an interface for version information
 * about a client's data state.
 */
export interface SiteVersionInfo {
    /**
     * The site ID of the peer that this info is for.
     * Null if the peer does not have a site ID.
     */
    site: SiteInfo | null;

    /**
     * Gets the version that the weave for this site is at.
     */
    version: WeaveVersion;

    /**
     * Gets the list of sites that this site knows about, even if they haven't submitted an atom yet.
     */
    knownSites: SiteInfo[];
}
