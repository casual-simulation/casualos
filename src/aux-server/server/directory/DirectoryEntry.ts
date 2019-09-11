/**
 * Defines the set of information that a directory entry can contain.
 */
export interface DirectoryEntry {
    /**
     * The public human readable name of the directory entry.
     */
    publicName: string;

    /**
     * The key that can be used to identify the entry.
     */
    key: string;

    /**
     * The bcrypt hash of the password that was used to create the entry.
     */
    passwordHash: string;

    /**
     * The Private IP Address for the entry.
     */
    privateIpAddress: string;

    /**
     * The Public IP Address for the entry.
     */
    publicIpAddress: string;

    /**
     * The unix timestamp that the entry was last updated on.
     */
    lastUpdateTime: number;
}
