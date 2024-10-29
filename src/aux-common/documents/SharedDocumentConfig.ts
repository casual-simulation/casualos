import { RemoteCausalRepoProtocol } from '../partitions/AuxPartitionConfig';

/**
 * Defines a config for a shared document.
 */
export interface SharedDocumentConfig {
    /**
     * The branch of the document to load.
     */
    branch: string;

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
        encryptionKey?: string;
    };
}

export interface RemoteSharedDocumentConfig extends SharedDocumentConfig {
    /**
     * The name of the record that the document is stored under.
     * If null, then the document is stored locally.
     */
    recordName: string | null;

    /**
     * The inst that the document is stored in.
     */
    inst: string;

    /**
     * Whether the doc should be loaded in read-only mode.
     */
    readOnly?: boolean;

    /**
     * Whether the doc should be loaded without realtime updates and in a read-only mode.
     * Basically this means that all you get is the initial state.
     */
    static?: boolean;

    /**
     * Whether the doc should skip the initial load until the doc is upgraded to a realtime connection.
     */
    skipInitialLoad?: boolean;

    /**
     * Whether the doc should be temporary.
     */
    temporary?: boolean;

    /**
     * The protocol to use for the document.
     * Currently, only "updates" is supported.
     */
    connectionProtocol?: RemoteCausalRepoProtocol;
}
