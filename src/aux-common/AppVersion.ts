/**
 * Defines an interface for an application version.
 */
export interface AppVersion {
    /**
     * Gets the git tag that this version was built from.
     */
    gitTag: string;

    /**
     * Gets the Git hash that this version was built from.
     */
    gitHash: string;

    /**
     * Gets the API that this app has support for.
     */
    apiVersion: number;
}
