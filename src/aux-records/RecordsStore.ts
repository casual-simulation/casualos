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

    /**
     * Adds the given record key to the store.
     * @param key The key to add.
     */
    addRecordKey(key: RecordKey): Promise<void>;

    /**
     * Gets the record key for the given record name that has the given hash.
     * @param recordName The name of the record.
     * @param hash The scrypt hash of the key that should be retrieved.
     */
    getRecordKeyByRecordAndHash(recordName: string, hash: string): Promise<RecordKey>;
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


/**
 * Defines a type that represents the different kinds of policies that a record key can have.
 * 
 * - null and "subjectfull" indicate that actions performed with this key must require a subject to provide their access token in order for operations to succeed.
 * - "subjectless" indicates that actions may be performed with key despite not having an access key from a subject.
 */
export type PublicRecordKeyPolicy = null | 'subjectfull' | 'subjectless';

/**
 * Defines an interface for record key objects.
 */
export interface RecordKey {
    /**
     * The name of the record that the key is for.
     */
    recordName: string;

    /**
     * The scrypt hash of the secret that this key is for.
     */
    secretHash: string;

    /**
     * The policy that the key uses.
     */
    policy: PublicRecordKeyPolicy;

    /**
     * The ID of the user that created this key.
     */
    creatorId: string;
}
