import { InstRecordsClient } from 'websockets';
import { RemoteCausalRepoProtocol } from '../partitions/AuxPartitionConfig';

/**
 * Defines a config for a shared document that is stored locally.
 */
export interface SharedDocumentConfig {
    /**
     * The name of the record that the document is stored under.
     * If null, then the document will either be stored in a public inst or on the device.
     */
    recordName?: string | null;

    /**
     * The inst that the document is stored in.
     * If omitted or null, then the document will only be stored on the device.
     */
    inst?: string | null;

    /**
     * The branch of the document to load.
     * If omitted, then local persistence will not be supported.
     */
    branch?: string;

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
     * The host to connect to.
     * If omitted, then connecting to remote servers will not be supported.
     */
    host?: string;

    /**
     * The protocol to use for the document.
     * Currently, only "updates" is supported.
     */
    connectionProtocol?: RemoteCausalRepoProtocol;
}
