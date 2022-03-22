/**
 * Contains information about the version of AUX that is running.
 */
export interface AuxVersion {
    /**
     * The commit of the hash that AUX was built from.
     */
    hash: string;

    /**
     * The full version number.
     */
    version: string;

    /**
     * The major portion of the version.
     */
    major: number;

    /**
     * The minor portion of the version.
     */
    minor: number;

    /**
     * The patch portion of the version.
     */
    patch: number;

    /**
     * Whether this version is an alpha (i.e. test) version.
     */
    alpha: boolean | number;

    /**
     * Gets the player mode of this CasualOS version.
     * 
     * - "player" indicates that the instance has been configured for experiencing AUXes.
     * - "builder" indicates that the instance has been configured for building AUXes.
     */
    playerMode: 'player' | 'builder';
}
