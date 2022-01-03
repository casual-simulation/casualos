/**
 * Defines an interface for objects that can store records.
 */
export interface RecordsStore {
    /**
     * Updates the given record.
     * @param record The record that should be updated.
     */
    updateRecord(record: Record): Promise<void>;

    /**
     * Adds the given record to the store.
     * @param record The record to add.
     */
    addRecord(record: Record): Promise<void>;

    /**
     * Gets the record with the given name.
     * @param name The name of the record.
     */
    getRecordByName(name: string): Promise<Record>;
}

/**
 * Defines an interface for record objects.
 */
export interface Record {
    /**
     * The name of the record.
     */
    name: string;

    /**
     * The ID of the user that created the record.
     */
    ownerId: string;

    /**
     * The scrypt hashes of the secrets that allow access to the record.
     */
    secretHashes: string[];

    /**
     * The salt that is used to hash the secrets.
     *
     * Normally it is bad to share a salt between multiple secrets but in this case
     * it is fine because there are very few secrets per salt (i.e. not 1 salt per million users but 1 salt per couple record keys) and the secrets are randomly generated.
     */
    secretSalt: string;
}
