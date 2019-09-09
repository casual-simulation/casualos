/**
 * Defines the set of information that a directory entry can contain.
 */
export interface DirectoryEntry {
    /**
     * The public human readable name of the directory entry.
     */
    publicName: string;

    /**
     * The hash that can be used to identify the entry.
     */
    hash: string;

    /**
     * The IP Address that the entry is stored under.
     */
    ipAddress: string;

    /**
     * The unix timestamp that the entry was last updated on.
     */
    lastUpdateTime: number;
}
