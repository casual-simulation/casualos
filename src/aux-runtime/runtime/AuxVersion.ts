/**
 * Contains information about the version of AUX that is running.
 * @dochash types/os/system
 * @docname CasualOSVersion
 */
export interface AuxVersion {
    /**
     * The commit of the hash that AUX was built from.
     */
    hash: string | null;

    /**
     * The full version number.
     */
    version: string | null;

    /**
     * The major portion of the version.
     */
    major: number | null;

    /**
     * The minor portion of the version.
     */
    minor: number | null;

    /**
     * The patch portion of the version.
     */
    patch: number | null;

    /**
     * Whether this version is an alpha (i.e. test) version.
     */
    alpha: boolean | number | null;

    /**
     * Gets the player mode of this CasualOS version.
     *
     * - "player" indicates that the instance has been configured for experiencing AUXes.
     * - "builder" indicates that the instance has been configured for building AUXes.
     */
    playerMode: 'player' | 'builder';
}
