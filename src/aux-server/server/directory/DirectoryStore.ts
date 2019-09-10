import { DirectoryEntry } from './DirectoryEntry';

/**
 * Defines a store for directory values.
 */
export interface DirectoryStore {
    init(): Promise<void>;

    /**
     * Updates the given entry in the database.
     * @param entry The entry.
     */
    update(entry: DirectoryEntry): Promise<void>;

    /**
     * Finds all of the entries that are at the given IP address.
     * @param ipAddress The IP Address.
     */
    findByPublicIpAddress(ipAddress: string): Promise<DirectoryEntry[]>;

    /**
     * Finds the entry with the given hash.
     * @param hash The hash.
     */
    findByHash(hash: string): Promise<DirectoryEntry>;
}
