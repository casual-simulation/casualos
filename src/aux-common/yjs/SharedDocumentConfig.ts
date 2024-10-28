/**
 * Defines a config for a shared document.
 */
export interface SharedDocumentConfig {
    /**
     * The name of the record that the document is stored under.
     * If null, then the document is stored locally.
     */
    recordName: string | null;

    /**
     * The address of the document.
     */
    address: string;

    /**
     * The branch of the document to load.
     */
    branch: string;

    /**
     * The host of the document.
     */
    host: string;

    /**
     * The protocol to use for the document.
     * Currently, only "updates" is supported.
     */
    protocol?: 'updates';

    /**
     * The options for local persistence of the document.
     * If not provided, then the document will not be persisted locally.
     */
    localPersistence?: {
        /**
         * Whether to save the document to indexed db.
         */
        saveToIndexedDb?: boolean;

        /**
         * The key to use for encryption.
         */
        encryptionKey?: boolean;
    };
}
