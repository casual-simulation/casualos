/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type { RemoteCausalRepoProtocol } from '../partitions/AuxPartitionConfig';

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
     * The markers that should be set on the inst if it is new.
     * If the inst already exists, this field is ignored.
     * If not provided, the default markers will be used (publicRead for public insts, private for record-based insts).
     */
    markers?: string[];

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
